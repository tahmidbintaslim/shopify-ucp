/**
 * MCP-style endpoint for AI agents.
 *
 * Route: /api/mcp/:shopId
 * Protocol: JSON-RPC 2.0 over plain HTTP POST (no SSE), modeled on MCP
 * 2024-11-05. It has no authentication; see the README Security section.
 */

import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import type { Prisma } from "@prisma/client";
import prisma, { isDatabaseConfigured } from "../db.server";
import {
    searchProducts,
    getProductByHandle,
    logInteraction,
    trackMissedOpportunity,
    buildSystemPrompt,
    formatProductsForAI,
    type MerchantContext,
} from "../utils/agent-logic";
import {
    INVALID_PARAMS,
    METHOD_NOT_FOUND,
    PARSE_ERROR,
    RpcError,
    SERVER_ERROR,
    clampSearchLimit,
    parseRpcRequest,
    parseToolCall,
    requestId,
    requireStringArg,
    rpcErrorResponse,
    serviceUnavailable,
    type RpcId,
} from "../utils/json-rpc";

// Resource routes ignore a `headers` export, so every response sets these.
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function respond(body: unknown, status = 200) {
    return json(body, { status, headers: CORS_HEADERS });
}

const STORE_INFO_TOPICS = ["shipping", "returns", "brand", "all"] as const;
type StoreInfoTopic = (typeof STORE_INFO_TOPICS)[number];

type MerchantSession = Prisma.SessionGetPayload<{ include: { profile: true } }>;
type MerchantProfile = NonNullable<MerchantSession["profile"]>;

interface ToolContent {
    type: "text";
    text: string;
    data?: unknown;
}

interface ToolResult {
    content: ToolContent[];
    isError?: boolean;
}

// MCP Tool Definitions
const TOOLS = [
    {
        name: "search_products",
        description: "Search for products in the store catalog. Use this to find products matching a query.",
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Search query (e.g., 'red dress', 'gifts under $50')",
                },
                limit: {
                    type: "integer",
                    description: "Maximum number of results to return (1 to 50)",
                    default: 10,
                    minimum: 1,
                    maximum: 50,
                },
            },
            required: ["query"],
        },
    },
    {
        name: "get_product",
        description: "Get detailed information about a specific product by its handle/slug.",
        inputSchema: {
            type: "object",
            properties: {
                handle: {
                    type: "string",
                    description: "The product handle (URL slug)",
                },
            },
            required: ["handle"],
        },
    },
    {
        name: "create_checkout",
        description: "Not available yet: this prototype returns an error result for every call. Meant to create a checkout link for one or more product variants.",
        inputSchema: {
            type: "object",
            properties: {
                variant_ids: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of Shopify variant GIDs (e.g., 'gid://shopify/ProductVariant/12345')",
                },
                quantities: {
                    type: "array",
                    items: { type: "integer" },
                    description: "Array of quantities for each variant (defaults to 1 for each)",
                },
            },
            required: ["variant_ids"],
        },
    },
    {
        name: "get_store_info",
        description: "Get information about the store's policies and details.",
        inputSchema: {
            type: "object",
            properties: {
                topic: {
                    type: "string",
                    enum: ["shipping", "returns", "brand", "all"],
                    description: "The topic to get information about",
                },
            },
        },
    },
];

/**
 * Loads the shop's session and settings. A missing or unreachable database
 * becomes a 503 so a misconfigured deployment does not look like a code bug.
 */
async function findMerchantSession(shopId: string): Promise<MerchantSession | null> {
    if (!isDatabaseConfigured()) {
        console.error("MCP request rejected: DATABASE_URL is not set");
        throw serviceUnavailable();
    }

    try {
        return await prisma.session.findFirst({
            where: { shop: shopId },
            include: { profile: true },
        });
    } catch (error) {
        console.error("MCP session lookup failed", { shop: shopId }, error);
        throw serviceUnavailable();
    }
}

async function getMerchantSession(
    shopId: string,
): Promise<MerchantSession & { profile: MerchantProfile }> {
    const session = await findMerchantSession(shopId);

    if (!session) {
        throw new RpcError(SERVER_ERROR, "Shop not found", 404);
    }

    if (!session.profile?.isEnabled) {
        throw new RpcError(SERVER_ERROR, "Agent is disabled for this shop", 403);
    }

    return { ...session, profile: session.profile };
}

function textResult(text: string, data?: unknown): ToolResult {
    return { content: [data === undefined ? { type: "text", text } : { type: "text", text, data }] };
}

// Handle MCP Tool Calls
async function handleToolCall(
    toolName: string,
    args: Record<string, unknown>,
    session: MerchantSession,
    merchantProfile: MerchantProfile,
): Promise<ToolResult> {
    const shop = session.shop;
    const accessToken = session.accessToken;

    switch (toolName) {
        case "search_products": {
            const query = requireStringArg(args, "query");
            const limit = clampSearchLimit(args.limit);

            const products = await searchProducts(shop, accessToken, query, limit);

            // Track missed opportunity if no results
            if (products.length === 0) {
                await trackMissedOpportunity(shop, query);
            }

            await logInteraction(merchantProfile.id, "search_products", query);

            return textResult(
                products.length > 0
                    ? formatProductsForAI(products)
                    : `No products found for "${query}". Try a different search term.`,
                products, // Raw data for structured access
            );
        }

        case "get_product": {
            const handle = requireStringArg(args, "handle");
            const product = await getProductByHandle(shop, accessToken, handle);

            await logInteraction(merchantProfile.id, "get_product", handle);

            if (!product) {
                return textResult(`Product with handle "${handle}" not found.`);
            }

            const availableVariants = product.variants.filter(v => v.availableForSale);

            return textResult(
                `**${product.title}**

${product.description || "No description available."}

Price: ${product.priceRange.minVariantPrice.currencyCode} ${product.priceRange.minVariantPrice.amount}
${availableVariants.length} variant(s) in stock

Variants:
${availableVariants.map(v => `- ${v.title}: ${v.price} (ID: ${v.id})`).join("\n")}`,
                product,
            );
        }

        case "create_checkout": {
            // Carts are a Storefront API feature, and the app has no
            // Storefront access token yet. Report a tool error instead of
            // sending a request that cannot succeed.
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: "Checkout links are not available yet. Share the product page with the customer instead.",
                    },
                ],
            };
        }

        case "get_store_info": {
            const topic: StoreInfoTopic =
                typeof args.topic === "string" &&
                (STORE_INFO_TOPICS as readonly string[]).includes(args.topic)
                    ? (args.topic as StoreInfoTopic)
                    : "all";
            const context: MerchantContext = {
                shop,
                accessToken,
                brandVoice: merchantProfile.brandVoice,
                returnPolicy: merchantProfile.returnPolicy ?? undefined,
                shippingInfo: merchantProfile.shippingInfo ?? undefined,
                minFreeShipping: merchantProfile.minFreeShipping,
            };

            let info = "";

            if (topic === "all" || topic === "brand") {
                info += `**Brand Voice:** ${context.brandVoice}\n\n`;
            }

            if (topic === "all" || topic === "shipping") {
                info += context.shippingInfo
                    ? `**Shipping:** ${context.shippingInfo}\n`
                    : "**Shipping:** Contact the store for shipping information.\n";

                if (context.minFreeShipping > 0) {
                    info += `Free shipping on orders over $${context.minFreeShipping}.\n`;
                }
                info += "\n";
            }

            if (topic === "all" || topic === "returns") {
                info += context.returnPolicy
                    ? `**Returns:** ${context.returnPolicy}\n`
                    : "**Returns:** Contact the store for return policy information.\n";
            }

            await logInteraction(merchantProfile.id, "get_store_info", topic);

            return textResult(info || "No store information available.");
        }

        default:
            throw new RpcError(INVALID_PARAMS, `Unknown tool: ${toolName}`);
    }
}

// Main action handler for MCP requests
export async function action({ request, params }: ActionFunctionArgs) {
    const shopId = params.shopId;

    if (!shopId) {
        return respond({ error: "Shop ID is required" }, 400);
    }

    let id: RpcId = null;
    let method: string | undefined;

    try {
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            throw new RpcError(PARSE_ERROR, "Parse error", 400);
        }

        // JSON-RPC 2.0 Protocol. Read the id first so validation errors echo it.
        id = requestId(body);
        const rpc = parseRpcRequest(body);
        method = rpc.method;
        const rpcParams = rpc.params;

        const session = await getMerchantSession(shopId);

        // Handle different MCP methods
        switch (method) {
            case "initialize": {
                // Return server capabilities
                return respond({
                    jsonrpc: "2.0",
                    id,
                    result: {
                        protocolVersion: "2024-11-05",
                        capabilities: {
                            tools: {},
                        },
                        serverInfo: {
                            name: "Universal Agent Gateway",
                            version: "1.0.0",
                        },
                    },
                });
            }

            case "tools/list": {
                // Return available tools
                return respond({
                    jsonrpc: "2.0",
                    id,
                    result: {
                        tools: TOOLS,
                    },
                });
            }

            case "tools/call": {
                const { name, args } = parseToolCall(rpcParams);

                const result = await handleToolCall(name, args, session, session.profile);

                return respond({ jsonrpc: "2.0", id, result });
            }

            case "resources/list": {
                // Return available resources (store context)
                return respond({
                    jsonrpc: "2.0",
                    id,
                    result: {
                        resources: [
                            {
                                uri: `shop://${shopId}/context`,
                                name: "Store Context",
                                description: "Brand voice and policy information for this store",
                                mimeType: "text/plain",
                            },
                        ],
                    },
                });
            }

            case "resources/read": {
                const uri = typeof rpcParams.uri === "string" ? rpcParams.uri : "";

                if (uri === `shop://${shopId}/context`) {
                    const context: MerchantContext = {
                        shop: session.shop,
                        accessToken: session.accessToken,
                        brandVoice: session.profile.brandVoice || "friendly",
                        returnPolicy: session.profile.returnPolicy ?? undefined,
                        shippingInfo: session.profile.shippingInfo ?? undefined,
                        minFreeShipping: session.profile.minFreeShipping || 0,
                    };

                    return respond({
                        jsonrpc: "2.0",
                        id,
                        result: {
                            contents: [
                                {
                                    uri,
                                    mimeType: "text/plain",
                                    text: buildSystemPrompt(context),
                                },
                            ],
                        },
                    });
                }

                return respond({
                    jsonrpc: "2.0",
                    id,
                    error: {
                        code: INVALID_PARAMS,
                        message: "Resource not found",
                    },
                });
            }

            default:
                return respond({
                    jsonrpc: "2.0",
                    id,
                    error: {
                        code: METHOD_NOT_FOUND,
                        message: `Method not found: ${method}`,
                    },
                });
        }
    } catch (error) {
        // Anonymous callers get a generic message; details stay in the server log.
        if (!(error instanceof RpcError)) {
            console.error("MCP request failed", { shop: shopId, method }, error);
        }

        const { status, body } = rpcErrorResponse(id, error);
        return respond(body, status);
    }
}

// GET: status summary for an installed shop. OPTIONS: CORS preflight.
// Remix sends both to the loader of a resource route.
export async function loader({ request, params }: LoaderFunctionArgs) {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const shopId = params.shopId;

    if (!shopId) {
        return respond({ error: "Shop ID is required" }, 400);
    }

    let session: MerchantSession | null;
    try {
        session = await findMerchantSession(shopId);
    } catch {
        return respond({ error: "Service unavailable" }, 503);
    }

    if (!session) {
        return respond({ error: "Shop not found" }, 404);
    }

    return respond({
        status: "active",
        shop: shopId,
        agentEnabled: session.profile?.isEnabled ?? false,
        mcp: {
            version: "2024-11-05",
            transport: "http",
            endpoint: `${process.env.SHOPIFY_APP_URL}/api/mcp/${encodeURIComponent(shopId)}`,
        },
        tools: TOOLS.map(t => t.name),
    });
}

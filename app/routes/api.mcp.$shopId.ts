/**
 * MCP Server Endpoint - The "Brain"
 * Handles AI Agent requests using Model Context Protocol
 * 
 * Route: /api/mcp/:shopId
 * Protocol: JSON-RPC 2.0 over HTTP
 */

import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import {
    searchProducts,
    getProductByHandle,
    createCheckoutLink,
    logInteraction,
    trackMissedOpportunity,
    buildSystemPrompt,
    formatProductsForAI,
    type MerchantContext,
} from "../utils/agent-logic";

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
                    description: "Maximum number of results to return",
                    default: 10,
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
        description: "Create an instant checkout link for one or more products. Returns a URL the customer can use to purchase.",
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

// Helper to get merchant session and profile
async function getMerchantSession(shopId: string) {
    const session = await prisma.session.findFirst({
        where: { shop: shopId },
        include: { profile: true },
    });

    if (!session) {
        throw new Error("Shop not found");
    }

    if (!session.profile?.isEnabled) {
        throw new Error("AI Agent is disabled for this store");
    }

    return session;
}

// Handle MCP Tool Calls
async function handleToolCall(
    toolName: string,
    args: Record<string, any>,
    session: any,
    merchantProfile: any
): Promise<any> {
    const shop = session.shop;
    const accessToken = session.accessToken;

    switch (toolName) {
        case "search_products": {
            const query = args.query as string;
            const limit = (args.limit as number) || 10;

            const products = await searchProducts(shop, accessToken, query, limit);

            // Track missed opportunity if no results
            if (products.length === 0) {
                await trackMissedOpportunity(shop, query);
            }

            // Log the interaction
            await logInteraction(
                merchantProfile.id,
                "search_products",
                query,
                undefined,
                undefined,
                undefined,
                undefined
            );

            return {
                type: "text",
                text: products.length > 0
                    ? formatProductsForAI(products)
                    : `No products found for "${query}". Try a different search term.`,
                data: products, // Raw data for structured access
            };
        }

        case "get_product": {
            const handle = args.handle as string;
            const product = await getProductByHandle(shop, accessToken, handle);

            await logInteraction(
                merchantProfile.id,
                "get_product",
                handle
            );

            if (!product) {
                return {
                    type: "text",
                    text: `Product with handle "${handle}" not found.`,
                };
            }

            const availableVariants = product.variants.filter(v => v.availableForSale);

            return {
                type: "text",
                text: `**${product.title}**
        
${product.description || "No description available."}

Price: ${product.priceRange.minVariantPrice.currencyCode} ${product.priceRange.minVariantPrice.amount}
${availableVariants.length} variant(s) in stock

Variants:
${availableVariants.map(v => `- ${v.title}: ${v.price} (ID: ${v.id})`).join("\n")}`,
                data: product,
            };
        }

        case "create_checkout": {
            const variantIds = args.variant_ids as string[];
            const quantities = (args.quantities as number[]) || variantIds.map(() => 1);

            // Create interaction first to get ID for attribution
            const interactionId = await logInteraction(
                merchantProfile.id,
                "create_checkout",
                JSON.stringify({ variantIds, quantities })
            );

            const checkout = await createCheckoutLink(
                shop,
                accessToken,
                variantIds,
                quantities,
                interactionId
            );

            // Update interaction with checkout details
            await prisma.agentInteraction.update({
                where: { id: interactionId },
                data: {
                    checkoutId: checkout.checkoutId,
                    checkoutUrl: checkout.checkoutUrl,
                    potentialValue: parseFloat(checkout.totalPrice),
                },
            });

            return {
                type: "text",
                text: `✅ Checkout created!

**Total:** ${checkout.currencyCode} ${checkout.totalPrice}
**Checkout URL:** ${checkout.checkoutUrl}

Share this link with the customer to complete their purchase.`,
                data: {
                    checkoutUrl: checkout.checkoutUrl,
                    checkoutId: checkout.checkoutId,
                    totalPrice: checkout.totalPrice,
                    currencyCode: checkout.currencyCode,
                },
            };
        }

        case "get_store_info": {
            const topic = args.topic as string || "all";
            const context: MerchantContext = {
                shop,
                accessToken,
                brandVoice: merchantProfile.brandVoice,
                returnPolicy: merchantProfile.returnPolicy,
                shippingInfo: merchantProfile.shippingInfo,
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

            return {
                type: "text",
                text: info || "No store information available.",
            };
        }

        default:
            throw new Error(`Unknown tool: ${toolName}`);
    }
}

// Main action handler for MCP requests
export async function action({ request, params }: ActionFunctionArgs) {
    const shopId = params.shopId;

    if (!shopId) {
        return json(
            { error: "Shop ID is required" },
            { status: 400 }
        );
    }

    try {
        const body = await request.json();
        const session = await getMerchantSession(shopId);

        // JSON-RPC 2.0 Protocol
        const { method, params: rpcParams, id } = body;

        // Handle different MCP methods
        switch (method) {
            case "initialize": {
                // Return server capabilities
                return json({
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
                return json({
                    jsonrpc: "2.0",
                    id,
                    result: {
                        tools: TOOLS,
                    },
                });
            }

            case "tools/call": {
                const { name, arguments: toolArgs } = rpcParams;

                const result = await handleToolCall(
                    name,
                    toolArgs || {},
                    session,
                    session.profile
                );

                return json({
                    jsonrpc: "2.0",
                    id,
                    result: {
                        content: [result],
                    },
                });
            }

            case "resources/list": {
                // Return available resources (store context)
                return json({
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
                const uri = rpcParams.uri;

                if (uri === `shop://${shopId}/context`) {
                    const context: MerchantContext = {
                        shop: session.shop,
                        accessToken: session.accessToken,
                        brandVoice: session.profile?.brandVoice || "friendly",
                        returnPolicy: session.profile?.returnPolicy ?? undefined,
                        shippingInfo: session.profile?.shippingInfo ?? undefined,
                        minFreeShipping: session.profile?.minFreeShipping || 0,
                    };

                    return json({
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

                return json({
                    jsonrpc: "2.0",
                    id,
                    error: {
                        code: -32602,
                        message: "Resource not found",
                    },
                });
            }

            default:
                return json({
                    jsonrpc: "2.0",
                    id,
                    error: {
                        code: -32601,
                        message: `Method not found: ${method}`,
                    },
                });
        }
    } catch (error) {
        console.error("MCP Error:", error);

        return json({
            jsonrpc: "2.0",
            id: null,
            error: {
                code: -32603,
                message: error instanceof Error ? error.message : "Internal error",
            },
        });
    }
}

// Handle GET requests (health check / capability discovery)
export async function loader({ params }: LoaderFunctionArgs) {
    const shopId = params.shopId;

    if (!shopId) {
        return json({ error: "Shop ID is required" }, { status: 400 });
    }

    try {
        const session = await prisma.session.findFirst({
            where: { shop: shopId },
            include: { profile: true },
        });

        if (!session) {
            return json({ error: "Shop not found" }, { status: 404 });
        }

        return json({
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
    } catch (error) {
        return json({ error: "Internal error" }, { status: 500 });
    }
}

// CORS headers for cross-origin requests
export function headers() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
}

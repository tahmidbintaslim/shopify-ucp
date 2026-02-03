/**
 * UCP Discovery Endpoint
 * Serves the Universal Commerce Protocol profile via App Proxy
 *
 * Route: /api/proxy/ucp
 * Accessed via: https://merchant-store.myshopify.com/apps/agent/.well-known/ucp
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Authenticate the app proxy request
    const { session } = await authenticate.public.appProxy(request);

    if (!session) {
      return json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const shop = session.shop;

    // Fetch merchant profile
    const profile = await prisma.merchantProfile.findUnique({
      where: { shop },
    });

    // If agent is disabled, return minimal profile
    if (!profile?.isEnabled) {
      return json(
        {
          ucp_version: "1.0",
          status: "disabled",
          message: "AI Agent is currently disabled for this store.",
        },
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300", // Cache for 5 minutes
          },
        },
      );
    }

    // Build the UCP profile
    const ucpProfile = {
      ucp_version: "1.0",
      store: {
        name: shop.replace(".myshopify.com", ""),
        domain: shop,
      },
      capabilities: [
        {
          type: "discovery",
          description: "Search and browse products",
          mcp_endpoint: `${process.env.SHOPIFY_APP_URL}/api/mcp/${encodeURIComponent(shop)}`,
        },
        {
          type: "checkout",
          description: "Create instant checkout links",
          mcp_endpoint: `${process.env.SHOPIFY_APP_URL}/api/mcp/${encodeURIComponent(shop)}`,
        },
        {
          type: "inquiry",
          description: "Answer questions about products, shipping, and returns",
          mcp_endpoint: `${process.env.SHOPIFY_APP_URL}/api/mcp/${encodeURIComponent(shop)}`,
        },
      ],
      tools: [
        {
          name: "search_products",
          description: "Search for products in the store catalog",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query (e.g., 'red dress under $50')",
              },
              limit: {
                type: "integer",
                description: "Maximum number of results (default: 10)",
                default: 10,
              },
            },
            required: ["query"],
          },
        },
        {
          name: "get_product",
          description: "Get detailed information about a specific product",
          parameters: {
            type: "object",
            properties: {
              handle: {
                type: "string",
                description: "Product handle/slug",
              },
            },
            required: ["handle"],
          },
        },
        {
          name: "create_checkout",
          description: "Create an instant checkout link for products",
          parameters: {
            type: "object",
            properties: {
              variant_ids: {
                type: "array",
                items: { type: "string" },
                description: "Array of product variant IDs to add to cart",
              },
              quantities: {
                type: "array",
                items: { type: "integer" },
                description: "Array of quantities for each variant",
              },
            },
            required: ["variant_ids"],
          },
        },
        {
          name: "get_store_info",
          description:
            "Get information about the store (shipping, returns, etc.)",
          parameters: {
            type: "object",
            properties: {
              topic: {
                type: "string",
                enum: ["shipping", "returns", "contact", "about"],
                description: "Topic to get information about",
              },
            },
          },
        },
      ],
      metadata: {
        brand_voice: profile.brandVoice,
        free_shipping_threshold: profile.minFreeShipping,
        last_updated: profile.updatedAt?.toISOString(),
      },
    };

    return json(ucpProfile, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300", // Cache for 5 minutes
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("UCP Profile Error:", error);
    return json(
      { error: "Internal server error" },
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function options() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

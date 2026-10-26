/**
 * Shopify Admin GraphQL calls and interaction logging behind the MCP tools.
 * There is no language model here; agents bring their own.
 */

import prisma from "../db.server";
import { apiVersion } from "../shopify.server";

// Types for Agent Operations
export interface ProductSearchResult {
    id: string;
    title: string;
    description: string;
    handle: string;
    featuredImage?: {
        url: string;
        altText: string;
    };
    priceRange: {
        minVariantPrice: {
            amount: string;
            currencyCode: string;
        };
        maxVariantPrice: {
            amount: string;
            currencyCode: string;
        };
    };
    variants: {
        id: string;
        title: string;
        price: string;
        availableForSale: boolean;
        sku?: string;
    }[];
}

export interface MerchantContext {
    shop: string;
    accessToken: string;
    brandVoice: string;
    returnPolicy?: string;
    shippingInfo?: string;
    minFreeShipping: number;
}

// GraphQL Query Templates
const SEARCH_PRODUCTS_QUERY = `
  query SearchProducts($query: String!, $first: Int!) {
    products(first: $first, query: $query) {
      nodes {
        id
        title
        description
        handle
        featuredImage {
          url
          altText
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
          maxVariantPrice {
            amount
            currencyCode
          }
        }
        variants(first: 10) {
          nodes {
            id
            title
            price
            availableForSale
            sku
          }
        }
      }
    }
  }
`;

const GET_PRODUCT_BY_HANDLE_QUERY = `
  query GetProductByHandle($handle: String!) {
    productByHandle(handle: $handle) {
      id
      title
      description
      handle
      featuredImage {
        url
        altText
      }
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
        maxVariantPrice {
          amount
          currencyCode
        }
      }
      variants(first: 50) {
        nodes {
          id
          title
          price
          availableForSale
          sku
        }
      }
    }
  }
`;

/**
 * Execute GraphQL against Shopify Admin API
 */
async function executeShopifyGraphQL(
    shop: string,
    accessToken: string,
    query: string,
    variables: Record<string, unknown>
): Promise<any> {
    const response = await fetch(
        `https://${shop}/admin/api/${apiVersion}/graphql.json`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": accessToken,
            },
            body: JSON.stringify({ query, variables }),
        }
    );

    if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    return data;
}

/**
 * Search products in a Shopify store
 */
export async function searchProducts(
    shop: string,
    accessToken: string,
    query: string,
    limit: number = 10
): Promise<ProductSearchResult[]> {
    const data = await executeShopifyGraphQL(shop, accessToken, SEARCH_PRODUCTS_QUERY, {
        query,
        first: limit,
    });

    return data.data.products.nodes.map((product: any) => ({
        id: product.id,
        title: product.title,
        description: product.description,
        handle: product.handle,
        featuredImage: product.featuredImage,
        priceRange: product.priceRange,
        variants: product.variants.nodes.map((v: any) => ({
            id: v.id,
            title: v.title,
            price: v.price,
            availableForSale: v.availableForSale,
            sku: v.sku,
        })),
    }));
}

/**
 * Get a specific product by handle
 */
export async function getProductByHandle(
    shop: string,
    accessToken: string,
    handle: string
): Promise<ProductSearchResult | null> {
    const data = await executeShopifyGraphQL(shop, accessToken, GET_PRODUCT_BY_HANDLE_QUERY, {
        handle,
    });

    const product = data.data.productByHandle;
    if (!product) return null;

    return {
        id: product.id,
        title: product.title,
        description: product.description,
        handle: product.handle,
        featuredImage: product.featuredImage,
        priceRange: product.priceRange,
        variants: product.variants.nodes.map((v: any) => ({
            id: v.id,
            title: v.title,
            price: v.price,
            availableForSale: v.availableForSale,
            sku: v.sku,
        })),
    };
}

/**
 * Log an agent interaction for analytics
 */
export async function logInteraction(
    merchantId: string,
    userIntent: string,
    inputQuery?: string,
    checkoutId?: string,
    checkoutUrl?: string,
    potentialValue?: number,
    userAgent?: string
): Promise<string> {
    const interaction = await prisma.agentInteraction.create({
        data: {
            merchantId,
            userIntent,
            inputQuery,
            checkoutId,
            checkoutUrl,
            potentialValue,
            userAgent,
        },
    });

    return interaction.id;
}

/**
 * Track a missed opportunity (0 results search)
 */
export async function trackMissedOpportunity(
    shop: string,
    searchTerm: string
): Promise<void> {
    await prisma.missedOpportunity.upsert({
        where: {
            shop_searchTerm: { shop, searchTerm },
        },
        update: {
            count: { increment: 1 },
            lastSeen: new Date(),
        },
        create: {
            shop,
            searchTerm,
            count: 1,
        },
    });
}

/**
 * Get merchant context for AI prompting
 */
export async function getMerchantContext(shop: string): Promise<MerchantContext | null> {
    const session = await prisma.session.findFirst({
        where: { shop },
        include: { profile: true },
    });

    if (!session) return null;

    return {
        shop: session.shop,
        accessToken: session.accessToken,
        brandVoice: session.profile?.brandVoice || "friendly and professional",
        returnPolicy: session.profile?.returnPolicy || undefined,
        shippingInfo: session.profile?.shippingInfo || undefined,
        minFreeShipping: session.profile?.minFreeShipping || 0,
    };
}

/**
 * Build system prompt for AI agents based on merchant config
 */
export function buildSystemPrompt(context: MerchantContext): string {
    const parts = [
        `You are a helpful shopping assistant for ${context.shop}.`,
        `Your tone should be ${context.brandVoice}.`,
    ];

    if (context.returnPolicy) {
        parts.push(`Return Policy: ${context.returnPolicy}`);
    }

    if (context.shippingInfo) {
        parts.push(`Shipping Information: ${context.shippingInfo}`);
    }

    if (context.minFreeShipping > 0) {
        parts.push(`Free shipping is available on orders over $${context.minFreeShipping}.`);
    }

    parts.push(
        "Always be helpful and guide customers to find what they're looking for.",
        "When suggesting products, include prices and availability.",
        "If you can't find what the customer wants, suggest alternatives."
    );

    return parts.join("\n\n");
}

/**
 * Format products for AI-friendly output
 */
export function formatProductsForAI(products: ProductSearchResult[]): string {
    if (products.length === 0) {
        return "No products found matching your search.";
    }

    return products
        .map((p, i) => {
            const minPrice = p.priceRange.minVariantPrice;
            const availableVariants = p.variants.filter((v) => v.availableForSale);

            return `${i + 1}. **${p.title}**
   - Price: ${minPrice.currencyCode} ${minPrice.amount}
   - ${availableVariants.length} variant(s) available
   - Handle: ${p.handle}
   ${p.description ? `- Description: ${p.description.substring(0, 150)}...` : ""}`;
        })
        .join("\n\n");
}

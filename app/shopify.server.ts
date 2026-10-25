import "@shopify/shopify-app-remix/adapters/node";
import {
    ApiVersion,
    AppDistribution,
    shopifyApp,
    DeliveryMethod,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const prismaSessionStorage = new PrismaSessionStorage(prisma);

// The storage checks for its table when it is created and leaves that
// promise without a handler. If the database is unreachable, the rejection
// stops a plain Node server (`npm start`). Handle it here; session reads and
// writes still fail with the same error until the table is reachable.
(prismaSessionStorage as unknown as { ready: Promise<boolean> }).ready.catch((error) => {
    console.error("Session storage is not ready. Check DATABASE_URL and run the Prisma migrations.", error);
});

const shopify = shopifyApp({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
    apiVersion: ApiVersion.October25,
    scopes: process.env.SCOPES?.split(",") || [
        "write_products",
        "read_products",
        "read_orders",
        "write_orders",
        "write_checkouts",
        "read_checkouts",
    ],
    appUrl: process.env.SHOPIFY_APP_URL || "",
    authPathPrefix: "/auth",
    sessionStorage: prismaSessionStorage,
    distribution: AppDistribution.AppStore,
    webhooks: {
        ORDERS_CREATE: {
            deliveryMethod: DeliveryMethod.Http,
            callbackUrl: "/webhooks",
        },
        APP_UNINSTALLED: {
            deliveryMethod: DeliveryMethod.Http,
            callbackUrl: "/webhooks",
        },
    },
    hooks: {
        afterAuth: async ({ session }) => {
            // Register webhooks after OAuth
            shopify.registerWebhooks({ session });

            // Create or update MerchantProfile on install
            await prisma.merchantProfile.upsert({
                where: { shop: session.shop },
                update: {},
                create: {
                    shop: session.shop,
                    brandVoice: "friendly and professional",
                    isEnabled: true,
                },
            });
        },
    },
    future: {
        unstable_newEmbeddedAuthStrategy: true,
    },
    ...(process.env.SHOP_CUSTOM_DOMAIN
        ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
        : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;

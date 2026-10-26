-- Local development only. Adds a placeholder shop so the MCP endpoint can be
-- tried without installing the app on a Shopify store:
--   psql "$DATABASE_URL" -f scripts/demo-shop.sql
-- The access token is a placeholder, so tools that call the Shopify Admin API
-- (search_products, get_product) fail with "Internal error". initialize,
-- tools/list, get_store_info and resources/read work.

INSERT INTO "Session" ("id", "shop", "state", "isOnline", "scope", "accessToken")
VALUES ('offline_demo-store.myshopify.com', 'demo-store.myshopify.com', '', false,
        'read_products,read_orders', 'placeholder-not-a-real-token')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "MerchantProfile" ("id", "shop", "brandVoice", "returnPolicy", "shippingInfo",
                               "minFreeShipping", "isEnabled", "updatedAt")
VALUES ('demo-profile', 'demo-store.myshopify.com', 'warm and concise',
        '30-day returns on unworn items.', 'Ships in 2 business days.', 75, true, now())
ON CONFLICT ("shop") DO NOTHING;

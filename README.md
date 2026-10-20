# Universal Agent Gateway

**Status: prototype, not production-ready.** Installing it on a store does not work yet, and parts of the API below are broken (see [Known issues](#known-issues)). Do not use it with a real store.

Deployed prototype: [universal-agent-gateway.vercel.app](https://universal-agent-gateway.vercel.app) shows the landing page only. Install and the MCP endpoint do not work on that deployment.

A Shopify embedded app (Remix 2, Polaris, Prisma on Neon Postgres) that lets AI agents query a store's catalog. It has four parts:

- `/api/mcp/:shop`: a hand-written JSON-RPC 2.0 endpoint modeled on MCP (protocol version `2024-11-05`) with four tools. It calls the Shopify Admin GraphQL API with the shop's stored offline access token.
- A JSON store profile served through the App Proxy. It uses its own `ucp_version: "1.0"` format, not the official Universal Commerce Protocol profile.
- A theme app embed that adds a `<link rel="agent-profile">` tag to the storefront.
- An admin dashboard (interaction counts and attributed revenue), a settings page and a keyword-matching playground.

The app contains no language model. Agents that call the endpoint bring their own.

## Known issues

- **Database connection.** `app/db.server.ts` passes a `Pool` instance to `PrismaNeon`, which expects a pool config. In production the connection string is lost and Prisma falls back to localhost, so every database call fails.
- **Sessions.** The Prisma `Session` model is missing columns that `@shopify/shopify-app-session-storage-prisma` writes (`firstName`, `lastName`, `email`, `accountOwner`, `locale`, `collaborator`, `emailVerified`, `refreshToken`, `refreshTokenExpires`). OAuth cannot store a session, so installs fail. There are no Prisma migrations.
- **Checkout.** `create_checkout` always fails: it sends the Storefront API `cartCreate` mutation to the Admin API. Order attribution depends on it, so no conversions are recorded in practice.
- **No auth on the MCP endpoint.** It has no authentication and no rate limiting (see [Security](#security)).
- **Profile URL.** The profile is only reachable at `/apps/agent/ucp`. `/apps/agent/.well-known/ucp`, which the theme embed links to, returns 404 because the proxy route is not a splat route.
- **Login page.** `app/routes/auth.login.tsx` calls `login(request)` without `await`. A valid shop domain never redirects to Shopify, and the rejected redirect is an unhandled promise rejection, which stops a Node process running with default settings (for example `npm start`).
- **Lint.** `npm run lint` fails because the repo has no ESLint config.
- **Landing page markup.** The landing page renders its own `<html>` inside the root layout, which causes a React hydration error in the browser. React recovers by rendering the page on the client.

## Quick start

### Prerequisites

- Node.js 20.10 or later (required by `@shopify/cli`, `@shopify/shopify-app-remix` and Polaris). CI uses Node 22, and `npm test` needs Node 22.6 or later.
- A Shopify Partner account
- A Neon database (PostgreSQL)
- A Vercel account, if you deploy there

### 1. Install dependencies

```bash
git clone https://github.com/tahmidbintaslim/shopify-ucp.git
cd shopify-ucp
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

- `SHOPIFY_API_KEY`: app client ID from the Partners dashboard
- `SHOPIFY_API_SECRET`: app client secret from the Partners dashboard
- `SHOPIFY_APP_URL`: the app's public URL, for example your Vercel domain
- `DATABASE_URL`: connection string from the Neon dashboard
- `SCOPES` (optional): comma-separated access scopes; the defaults are in `app/shopify.server.ts`
- `SHOP_CUSTOM_DOMAIN` (optional): an extra shop domain to accept

### 3. Initialize the database

```bash
npx prisma generate
npx prisma db push
```

### 4. Run the development server

```bash
npm run dev
```

This starts the Shopify CLI development server with hot reloading.

### Checks

```bash
npm run typecheck
npm test
npm run build
```

## Project structure

```
/shopify-ucp
├── prisma/
│   └── schema.prisma           # Database schema (Session, MerchantProfile, interactions)
├── app/
│   ├── db.server.ts            # Neon PostgreSQL connection
│   ├── shopify.server.ts       # Auth and webhook registration
│   ├── routes/
│   │   ├── _index.tsx          # Public landing page
│   │   ├── app._index.tsx      # Merchant dashboard (stats and agent toggle)
│   │   ├── app.settings.tsx    # Brand voice, return policy, shipping notes
│   │   ├── app.playground.tsx  # Keyword-matching test chat
│   │   ├── api.mcp.$shopId.ts  # JSON-RPC (MCP-style) endpoint
│   │   ├── api.proxy.ucp.tsx   # Store profile served through the App Proxy
│   │   └── webhooks.tsx        # Order attribution and uninstall cleanup
│   └── utils/
│       ├── agent-logic.ts      # Shopify Admin GraphQL operations
│       └── json-rpc.ts         # JSON-RPC request parsing and safe error responses
├── extensions/
│   └── agent-discovery/        # Theme app embed (adds the <link> tag)
├── test/                       # Unit tests (node:test)
└── shopify.app.toml            # Shopify app configuration
```

## Configuration

### Shopify Partners dashboard

1. Create a new app in your Partners dashboard
2. Set the **App URL** to your Vercel domain
3. Configure the **App Proxy**:
   - Subpath prefix: `apps`
   - Subpath: `agent`
   - Proxy URL: `https://your-vercel-app.com/api/proxy`
4. Set **Allowed redirection URLs**:
   - `https://your-app.vercel.app/auth/callback`
   - `https://your-app.vercel.app/auth/shopify/callback`

### Vercel deployment

```bash
vercel
```

Set these environment variables in Vercel:

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `DATABASE_URL`
- `SHOPIFY_APP_URL`
- `SCOPES` (optional; leave it unset to use the defaults)

## How it works

### 1. Store profile

With the App Proxy configured as above, the store profile is served at:

```
https://merchant-store.myshopify.com/apps/agent/ucp
```

It lists the store, the MCP endpoint URL and the tools. It is a custom format (`ucp_version: "1.0"`), not a profile that follows the Universal Commerce Protocol specification, and it is not served at the store's root `/.well-known/ucp`.

### 2. MCP endpoint

Agents send JSON-RPC 2.0 requests over plain HTTP POST to:

- search products
- get product details
- read the store's brand voice, shipping and return notes

`create_checkout` is listed but does not work yet (see [Known issues](#known-issues)). The endpoint implements `initialize`, `tools/list`, `tools/call`, `resources/list` and `resources/read`. It does not use the MCP SDK and has no streaming (SSE) support.

### 3. Attribution tracking

The design: when a checkout is created, these cart attributes are added:

```json
{
  "_source": "universal_agent_gateway",
  "_interaction_id": "uuid-here"
}
```

When the order is placed, the `orders/create` webhook marks the interaction as converted. Because `create_checkout` fails, this path does not run today.

## API endpoints

### Store profile

```
GET /apps/agent/ucp
```

Returns the store profile described above. Requests must carry a valid App Proxy signature.

### MCP server

```
POST /api/mcp/:shopId
```

Handles MCP-style tool calls (JSON-RPC 2.0).

Available tools:

- `search_products`: search the product catalog. It uses the Admin API, so results can include draft and unpublished products.
- `get_product`: get product details by handle
- `create_checkout`: meant to create a checkout link; it currently always fails
- `get_store_info`: return the brand voice, shipping and return notes saved in settings

Errors: a malformed request returns HTTP 400, an unknown shop 404, a disabled agent 403, and any internal failure HTTP 500 with the generic message `Internal error`. Error details are written to the server log only.

`GET /api/mcp/:shopId` returns a status summary for an installed shop.

### Webhooks

```
POST /webhooks
```

Handles `ORDERS_CREATE` for conversion tracking and `APP_UNINSTALLED` for data cleanup. The compliance topics (`customers/redact`, `shop/redact`, `customers/data_request`) are subscribed in `shopify.app.toml` but are only logged.

## Testing

### Test the store profile

```bash
curl https://your-dev-store.myshopify.com/apps/agent/ucp
```

### Test the MCP endpoint

```bash
curl -X POST https://your-app.vercel.app/api/mcp/your-dev-store.myshopify.com \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

## Merchant dashboard

The dashboard shows:

- **AI revenue**: total order value of interactions that the webhook marked as converted
- **Conversations**: the number of logged agent interactions (each tool call counts as one)
- **Conversion rate**: converted interactions divided by all logged interactions, including searches and product lookups. It is not a checkout-to-purchase ratio.
- **Missed opportunities**: searches that returned no results

Revenue is always formatted as USD, whatever the store's currency.

## Security

- Admin pages (`/app/*`) authenticate with Shopify session tokens through `@shopify/shopify-app-remix`.
- The MCP endpoint (`/api/mcp/:shop`) has no authentication and no rate limiting. Anyone who knows a shop's `myshopify.com` domain can call it, and it runs Admin API product queries with that shop's offline access token.
- Access tokens are stored in plain text in the `Session` table. They are not encrypted.
- App Proxy requests are verified with Shopify's HMAC signature.
- Webhooks are verified with Shopify's HMAC signature.
- Public endpoints return generic error messages. Error details are logged on the server only.

## License

No license has been chosen yet, and the repository has no LICENSE file. Until one is added, no open-source license applies.

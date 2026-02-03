# Universal Agent Gateway

> The "Stripe for AI Agents" - A multi-tenant SaaS that connects AI Agents to Shopify Merchants via UCP (Universal Commerce Protocol) and MCP (Model Context Protocol).

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- A Shopify Partner account
- A Neon database (PostgreSQL)
- Vercel account (for deployment)

### 1. Install Dependencies

```bash
cd universal-agent-gateway
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

- `SHOPIFY_API_KEY` - From Shopify Partners Dashboard
- `SHOPIFY_API_SECRET` - From Shopify Partners Dashboard
- `DATABASE_URL` - From Neon Dashboard
- `SHOPIFY_APP_URL` - Your Vercel deployment URL

### 3. Initialize Database

```bash
npx prisma generate
npx prisma db push
```

### 4. Run Development Server

```bash
npm run dev
```

This will start the Shopify CLI development server with hot-reloading.

## 📁 Project Structure

```
/universal-agent-gateway
├── prisma/
│   └── schema.prisma           # Database schema (Session, MerchantProfile, Interactions)
├── app/
│   ├── db.server.ts            # Neon PostgreSQL connection
│   ├── shopify.server.ts       # Auth & webhook registration
│   ├── routes/
│   │   ├── app._index.tsx      # Merchant Dashboard (Revenue Stats + Toggle)
│   │   ├── app.settings.tsx    # Configuration (Brand Voice, Returns)
│   │   ├── app.playground.tsx  # AI Chat Test Interface
│   │   ├── api.mcp.$shopId.ts  # MCP Server (The "Brain")
│   │   ├── api.proxy.ucp.tsx   # UCP Profile Endpoint
│   │   └── webhooks.tsx        # Order attribution tracking
│   └── utils/
│       └── agent-logic.ts      # Shopify GraphQL operations
├── extensions/
│   └── agent-discovery/        # Theme extension (injects <link> tag)
└── shopify.app.toml            # Shopify app configuration
```

## 🔧 Configuration

### Shopify Partners Dashboard

1. Create a new app in your Partners Dashboard
2. Set the **App URL** to your Vercel domain
3. Configure the **App Proxy**:
   - Subpath prefix: `apps`
   - Subpath: `agent`
   - Proxy URL: `https://your-vercel-app.com/api/proxy`
4. Set **Allowed Redirection URLs**:
   - `https://your-app.vercel.app/auth/callback`
   - `https://your-app.vercel.app/auth/shopify/callback`

### Vercel Deployment

```bash
vercel
```

Set these environment variables in Vercel:

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SCOPES`
- `DATABASE_URL`
- `SHOPIFY_APP_URL`

## 🤖 How It Works

### 1. UCP Discovery

When an AI agent crawls a merchant's store, it finds the UCP profile at:

```
https://merchant-store.myshopify.com/apps/agent/.well-known/ucp
```

This profile describes the store's capabilities and MCP endpoint.

### 2. MCP Communication

AI agents connect to the MCP endpoint to:

- Search products
- Get product details
- Create checkout links
- Query store policies

### 3. Attribution Tracking

When a checkout is created, we inject custom attributes:

```json
{
  "_source": "universal_agent_gateway",
  "_interaction_id": "uuid-here"
}
```

When the order is placed, webhooks update our database to track the conversion.

## 📊 API Endpoints

### UCP Profile

```
GET /apps/agent/.well-known/ucp
```

Returns the Universal Commerce Protocol profile.

### MCP Server

```
POST /api/mcp/:shopId
```

Handles MCP tool calls (JSON-RPC 2.0).

Available tools:

- `search_products` - Search the product catalog
- `get_product` - Get product details
- `create_checkout` - Create instant checkout link
- `get_store_info` - Get store policies

### Webhooks

```
POST /webhooks
```

Handles `ORDERS_CREATE` for conversion tracking.

## 🧪 Testing

### Test UCP Discovery

```bash
curl https://your-dev-store.myshopify.com/apps/agent/.well-known/ucp
```

### Test MCP Endpoint

```bash
curl -X POST https://your-app.vercel.app/api/mcp/your-dev-store.myshopify.com \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

## 📈 Merchant Dashboard

The dashboard shows:

- **Total AI Revenue** - Attributed sales from AI agents
- **Conversations** - Total agent interactions
- **Conversion Rate** - Checkout → Purchase ratio
- **Missed Opportunities** - Searches that returned no results

## 🔒 Security

- All Shopify requests are authenticated via OAuth
- Access tokens are stored encrypted in Neon
- App Proxy requests are verified using HMAC
- Webhooks are validated using Shopify's signature

## 📝 License

MIT

---

Built with ❤️ for the AI commerce future.

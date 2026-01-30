# Shopify MCP (Merchant Commerce Protocol) Documentation Summary

This document summarizes the key concepts, workflows, and ideas for building with Shopify MCP (Merchant Commerce Protocol), focusing on agentic commerce and the Universal Commerce Protocol (UCP).

**References:**

- [Shopify Agents](https://shopify.dev/docs/agents)
- [Catalog MCP](https://shopify.dev/docs/agents/catalog/mcp)
- [Checkout MCP](https://shopify.dev/docs/agents/checkout/mcp)
- [Catalog API](https://shopify.dev/docs/api/catalog-api)
- [Authentication](https://shopify.dev/docs/agents/get-started/authentication)

---

## What is Shopify MCP?

Shopify MCP is a set of UCP-compliant servers and APIs that enable agents (AI or programmatic) to:

- Search and discover products across all eligible Shopify merchants (Catalog MCP)
- Retrieve detailed product and variant information
- Create and manage checkout sessions (Checkout MCP)
- Complete orders and track post-purchase events

MCP is the recommended protocol for building agentic commerce experiences that span multiple merchants, supporting secure, interoperable, and extensible commerce flows.

## Authentication (MCP)

1. Generate API credentials (client ID and secret) in the Shopify Dev Dashboard.
2. Exchange credentials for a JWT bearer token:
   - `POST https://api.shopify.com/auth/access_token`
3. Use the bearer token in the `Authorization` header for all MCP requests.

## Product Discovery with Catalog MCP

- Use `search_global_products` to search the global Shopify Catalog with filters (query, price, shipping, secondhand, etc.).
- Use `get_global_product_details` to retrieve full details for a product or variant.
- All requests use JSON-RPC 2.0 and require a bearer token.
- Results include product info, variants, shop details, and checkout URLs.

## Checkout Flow with Checkout MCP

1. **Create Checkout:** Use `create_checkout` with selected product variant(s) and buyer info.
2. **Status Handling:**
   - `incomplete`: Provide missing info via `update_checkout`.
   - `requires_escalation`: Redirect buyer to `continue_url` or embed checkout (ECP).
   - `ready_for_complete`: Call `complete_checkout` to finalize the order.
3. **Order Tracking:** Use UCP order specs to track fulfillment, refunds, and post-purchase events.

## Catalog MCP: Key Endpoints & Parameters

- `search_global_products`: Search products globally with filters (query, context, price, shipping, secondhand, etc.).
- `get_global_product_details`: Get full product/variant details by UPID or variant ID.
- Use `saved_catalog` for custom catalog filters.

## Checkout MCP: Key Endpoints & Statuses

- `create_checkout`: Start a new checkout session.
- `get_checkout`: Retrieve current checkout state.
- `update_checkout`: Update checkout with new info (line items, buyer, fulfillment, payment).
- `complete_checkout`: Finalize and place the order.
- `cancel_checkout`: Cancel an active session.
- **Statuses:** `incomplete`, `requires_escalation`, `ready_for_complete`, `completed`, `canceled`.

## Embedded Checkout & Payment Handlers

- **Embedded Checkout Protocol (ECP):**
  - Embed checkout UI in your app for escalated flows.
  - Use JSON-RPC 2.0 for event handling and delegations (address, payment, etc.).
- **Shop Pay Handler:**
  - Accelerated checkout via Shop Pay, using delegated payment flows.
  - Agents never handle raw payment credentials; Shop Pay tokens are secure and single-use.

---

# Ideas for Using Shopify MCP

1. **AI Shopping Agent:** Use Catalog MCP and Checkout MCP to build a conversational agent that searches products, presents offers, and completes purchases across Shopify merchants.
2. **Personalized Product Discovery:** Filter and recommend products using Catalog MCP with advanced query and context parameters.
3. **Multi-Merchant Cart & Checkout:** Aggregate products from multiple merchants, create separate checkouts, and guide users through the MCP-driven purchase flow.
4. **Order Tracking & Post-Purchase:** Use MCP and UCP order specs to track order status, fulfillment, and handle returns/refunds.
5. **Embedded Checkout:** Integrate ECP for seamless, in-app checkout experiences with native address and payment handling.
6. **Secondhand & Subscription Marketplaces:** Leverage MCP filters for verticals like secondhand goods or subscriptions.
7. **Shop Pay Fast Checkout:** Implement Shop Pay handler for delegated, secure, one-click checkout.
8. **Custom Catalogs:** Create and use saved catalogs for niche or curated product discovery.

---

For full details and implementation, see the referenced Shopify documentation links above.

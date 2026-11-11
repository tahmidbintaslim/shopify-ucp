# Universal AI Shopping Copilot – Project Planning

## Project Overview

Build an open source Universal AI Shopping Copilot that enables users to search, discover, and purchase products from any Shopify merchant via chat (web, mobile, Discord, etc.), powered by Shopify MCP and UCP.

---

## 1. High-Level Architecture

- **Frontend:** Chat UI (web/mobile/Discord/Telegram)
- **Agent Backend:** Handles user intent, product search, product details, cart, checkout, and order tracking
- **Shopify MCP Integration:**
  - Catalog MCP for product search/discovery
  - Checkout MCP for cart/checkout/order
- **Optional:** User authentication, analytics, affiliate tracking

---

## 2. Core Features & Agent Capabilities

- Natural language product search (Catalog MCP)
- Product detail lookup (Catalog MCP)
- Cart management (local/session)
- Multi-merchant support
- Checkout session creation and management (Checkout MCP)
- Escalation handling (trusted UI handoff)
- Order tracking and post-purchase events
- Contextual recommendations and filters
- Meme/gif integrations for virality

---

## 3. Agentic Workflow (MCP/UCP)

1. **User Query:** User asks for a product ("Find me a blue crewneck sweater under $100")
2. **Product Search:** Agent calls `search_global_products` (Catalog MCP)
3. **Product Selection:** User picks a product; agent calls `get_global_product_details`
4. **Cart/Checkout:** Agent creates checkout session (`create_checkout` on Checkout MCP)
5. **Status Handling:**
   - If `incomplete`, agent prompts for missing info (address, etc.)
   - If `requires_escalation`, agent redirects to trusted UI or embeds checkout
   - If `ready_for_complete`, agent finalizes with `complete_checkout`
6. **Order Tracking:** Agent provides order status, fulfillment, and post-purchase support

---

## 4. Sub-Agent/Module Breakdown

- **NLP/Intent Sub-Agent:** Understands user queries and context
- **Catalog Search Sub-Agent:** Handles product search and filtering
- **Product Details Sub-Agent:** Fetches and presents detailed product info
- **Cart/Checkout Sub-Agent:** Manages cart, creates/updates checkout sessions, handles status
- **Escalation/Trusted UI Sub-Agent:** Handles handoff for payment/address
- **Order Tracking Sub-Agent:** Monitors and reports order status
- **Virality/Engagement Sub-Agent:** Adds memes, gifs, and social sharing

---

## 5. Milestones & Tasks

1. **MVP Planning & Repo Setup**
2. **MCP API Integration (Catalog/Checkout)**
3. **Chat UI & Backend Agent**
4. **Product Search & Selection Flow**
5. **Checkout & Escalation Handling**
6. **Order Tracking**
7. **Virality Features**
8. **Testing & Open Source Launch**

---

## 6. Next Steps

- Assign sub-agents for each module (see below)
- Begin coding with reference to full Shopify MCP/UCP docs
- Use runSubagent for autonomous planning/execution of each sub-module
- Use mcp_shopify-dev-m_fetch_full_docs for deep dives on API endpoints

---

## Sub-Agent Assignment Table

| Sub-Agent Name       | Responsibility                           | Tool/Methodology                  |
| -------------------- | ---------------------------------------- | --------------------------------- |
| Planning Agent       | Project breakdown, task assignment       | runSubagent                       |
| Catalog Search Agent | Product search/filtering                 | mcp_shopify-dev-m_fetch_full_docs |
| Product Detail Agent | Product info/variant lookup              | mcp_shopify-dev-m_fetch_full_docs |
| Checkout Agent       | Cart, checkout, escalation               | mcp_shopify-dev-m_fetch_full_docs |
| Order Tracking Agent | Order status, fulfillment, post-purchase | mcp_shopify-dev-m_fetch_full_docs |
| Virality Agent       | Memes, gifs, social, engagement          | runSubagent                       |

---

**This doc is the master plan for building the Universal AI Shopping Copilot. Each sub-agent will execute its module using the latest Shopify MCP documentation and best practices.**

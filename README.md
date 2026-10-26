# shopify-mcp-projects

Early-stage Python client code for an "AI shopping copilot" that talks to
Shopify's Catalog and Checkout MCP endpoints over JSON-RPC 2.0, plus the
planning notes behind it.

Status: prototype. The sub-agents build and send requests; they have only
been exercised against mocked HTTP sessions in the unit tests, not against
a live Shopify MCP endpoint. There is no chat front end or agent loop yet.

## What is here

| Path | What it is |
| --- | --- |
| `catalog_subagent/catalog_search_subagent.py` | `CatalogSearchSubAgent`: product search over JSON-RPC, plus client-side filtering of results |
| `catalog_subagent/product_details_subagent.py` | `ProductDetailsSubAgent`: fetches one product by its universal product ID |
| `unified_catalog_agent.py` | `UnifiedCatalogAgent`: search, then fetch details for each hit |
| `cart_checkout_subagent.py` | `CartCheckoutSubAgent`: create, get, update, complete and cancel checkout sessions through MCP `tools/call` |
| `test_*.py` | pytest unit tests with mocked `requests` sessions |
| `*.md` | Planning notes: architecture plan, MCP/UCP summary, project ideas |

## Stack

Python 3.10+, `requests`, `pytest`.

## Setup

```bash
git clone https://github.com/tahmidbintaslim/shopify-mcp-projects.git
cd shopify-mcp-projects
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
python -m pytest -q
```

The classes take the MCP endpoint URL and bearer token as constructor
arguments; nothing is read from the environment.

## License

MIT, see [LICENSE](LICENSE).

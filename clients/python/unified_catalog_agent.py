"""
UnifiedCatalogAgent: Universal AI Shopping Copilot - Unified Catalog Agent

This module composes the CatalogSearchSubAgent and ProductDetailsSubAgent into a unified backend agent
for the Universal AI Shopping Copilot. It demonstrates a workflow where a product search is performed,
then details for a selected product are fetched.

Author: Shopify Staff Engineer
License: MIT
"""
from typing import Any, Dict, List, Optional
from catalog_subagent.catalog_search_subagent import CatalogSearchSubAgent
from catalog_subagent.product_details_subagent import ProductDetailsSubAgent

class UnifiedCatalogAgent:
    """
    Unified agent that composes CatalogSearchSubAgent and ProductDetailsSubAgent for end-to-end workflows.
    """
    def __init__(self, mcp_url: str, auth_token: Optional[str] = None):
        """
        Initialize the unified agent with MCP endpoint and authentication.
        Args:
            mcp_url (str): The endpoint URL for the Shopify Catalog MCP JSON-RPC API.
            auth_token (Optional[str]): Optional authentication token for API access.
        """
        self.search_agent = CatalogSearchSubAgent(mcp_url, auth_token)
        self.details_agent = ProductDetailsSubAgent(mcp_url, auth_token or "")

    def search_and_fetch_details(self, search_params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Perform a product search, then fetch details for each result.
        Args:
            search_params (Dict[str, Any]): Parameters for the search (e.g., query, filters).
        Returns:
            List[Dict[str, Any]]: List of product details for each found product.
        """
        # Example: search_params = {"query": "shoes", "filters": {"brand": "Nike"}}
        search_results = self.search_agent._json_rpc_call("search_products", search_params)
        products = search_results.get("result", {}).get("products", [])
        details_list = []
        for product in products:
            upid = product.get("upid")
            if upid:
                details = self.details_agent.get_global_product_details(upid)
                details_list.append(details)
        return details_list

    def search(self, search_params: Dict[str, Any]) -> Any:
        """
        Directly call the search sub-agent.
        """
        return self.search_agent._json_rpc_call("search_products", search_params)

    def fetch_details(self, upid: str) -> Any:
        """
        Directly call the details sub-agent.
        """
        return self.details_agent.get_global_product_details(upid)

# Example usage:
if __name__ == "__main__":
    # Replace with actual MCP endpoint and token
    MCP_URL = "https://api.shopify.com/catalog/mcp"
    AUTH_TOKEN = "YOUR_TOKEN"
    agent = UnifiedCatalogAgent(MCP_URL, AUTH_TOKEN)
    # Search for products
    search_params = {"query": "t-shirt", "filters": {"brand": "Shopify"}}
    details = agent.search_and_fetch_details(search_params)
    print(details)

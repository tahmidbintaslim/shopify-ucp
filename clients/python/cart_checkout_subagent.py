"""
Cart/Checkout Sub-Agent for Universal AI Shopping Copilot
Manages cart, checkout session creation, updates, completion, and cancellation using Shopify Checkout MCP (JSON-RPC 2.0)
"""
import requests
import uuid
from typing import Dict, Any, Optional

class CheckoutMCPError(Exception):
    """Custom exception for Checkout MCP errors."""
    def __init__(self, message: str, code: Optional[int] = None, data: Any = None):
        super().__init__(message)
        self.code = code
        self.data = data

class CartCheckoutSubAgent:
    def __init__(self, mcp_url: str, bearer_token: str, ucp_profile_url: str):
        self.mcp_url = mcp_url
        self.bearer_token = bearer_token
        self.ucp_profile_url = ucp_profile_url
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.bearer_token}",
            "Content-Type": "application/json"
        })

    def _json_rpc_call(self, method: str, arguments: Dict[str, Any]) -> Any:
        payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "id": str(uuid.uuid4()),
            "params": {
                "name": method,
                "arguments": arguments
            }
        }
        try:
            response = self.session.post(self.mcp_url, json=payload)
            response.raise_for_status()
            data = response.json()
            if "error" in data:
                raise CheckoutMCPError(data["error"].get("message", "Unknown error"), data["error"].get("code"), data["error"].get("data"))
            return data.get("result")
        except requests.RequestException as e:
            raise CheckoutMCPError(str(e))

    def create_checkout(self, checkout: Dict[str, Any]) -> Dict[str, Any]:
        arguments = {
            "_meta": {"ucp": {"profile": self.ucp_profile_url}},
            "checkout": checkout
        }
        return self._json_rpc_call("create_checkout", arguments)

    def get_checkout(self, checkout_id: str) -> Dict[str, Any]:
        arguments = {
            "_meta": {"ucp": {"profile": self.ucp_profile_url}},
            "id": checkout_id
        }
        return self._json_rpc_call("get_checkout", arguments)

    def update_checkout(self, checkout_id: str, checkout: Dict[str, Any]) -> Dict[str, Any]:
        arguments = {
            "_meta": {"ucp": {"profile": self.ucp_profile_url}},
            "id": checkout_id,
            "checkout": checkout
        }
        return self._json_rpc_call("update_checkout", arguments)

    def complete_checkout(self, checkout_id: str, payment: Dict[str, Any]) -> Dict[str, Any]:
        arguments = {
            "_meta": {"ucp": {"profile": self.ucp_profile_url}},
            "id": checkout_id,
            "idempotency_key": str(uuid.uuid4()),
            "payment": payment
        }
        return self._json_rpc_call("complete_checkout", arguments)

    def cancel_checkout(self, checkout_id: str) -> Dict[str, Any]:
        arguments = {
            "_meta": {"ucp": {"profile": self.ucp_profile_url}},
            "id": checkout_id,
            "idempotency_key": str(uuid.uuid4())
        }
        return self._json_rpc_call("cancel_checkout", arguments)

# Example usage (to be removed or moved to tests):
# agent = CartCheckoutSubAgent(mcp_url="https://api.shopify.com/checkout/mcp", bearer_token="YOUR_TOKEN", ucp_profile_url="https://agent.example/profiles/shopping-agent.json")
# checkout = {"currency": "USD", "line_items": [...], "buyer": {...}, "fulfillment": {...}}
# result = agent.create_checkout(checkout)
# print(result)

import pytest
from unittest.mock import patch, MagicMock
from catalog_subagent.product_details_subagent import ProductDetailsSubAgent

def test_get_global_product_details_success():
    agent = ProductDetailsSubAgent("http://fake-url", "fake-token")
    with patch.object(agent, 'session') as mock_session:
        mock_response = MagicMock()
        mock_response.json.return_value = {"result": {"id": 1, "title": "Test Product"}}
        mock_response.raise_for_status.return_value = None
        mock_session.post.return_value = mock_response
        details = agent.get_global_product_details("UPID123")
        assert isinstance(details, dict)
        assert "result" in details or details.get("result") is not None

def test_get_global_product_details_error():
    agent = ProductDetailsSubAgent("http://fake-url", "fake-token")
    with patch.object(agent, 'session') as mock_session:
        mock_session.post.side_effect = Exception("API error")
        details = agent.get_global_product_details("UPID123")
        assert "error" in details

import pytest
from unittest.mock import patch, MagicMock
from catalog_subagent.catalog_search_subagent import CatalogSearchSubAgent

def test_search_global_products_success():
    agent = CatalogSearchSubAgent("http://fake-url", "fake-token")
    with patch.object(agent, 'session') as mock_session:
        mock_response = MagicMock()
        mock_response.json.return_value = {"result": [{"id": 1, "title": "Test Product"}]}
        mock_response.raise_for_status.return_value = None
        mock_session.post.return_value = mock_response
        results = agent.search_global_products("Test")
        assert isinstance(results, dict)
        assert "result" in results or results.get("result") is not None

def test_search_global_products_error():
    agent = CatalogSearchSubAgent("http://fake-url", "fake-token")
    with patch.object(agent, 'session') as mock_session:
        mock_session.post.side_effect = Exception("API error")
        results = agent.search_global_products("Test")
        assert "error" in results

def test_filter_products():
    agent = CatalogSearchSubAgent("http://fake-url", "fake-token")
    products = [
        {"id": 1, "price": 10},
        {"id": 2, "price": 20},
    ]
    filtered = agent.filter_products(products, {"min_price": 15})
    assert filtered == [{"id": 2, "price": 20}]

def test_filter_products_empty():
    agent = CatalogSearchSubAgent("http://fake-url", "fake-token")
    filtered = agent.filter_products([], {"min_price": 100})
    assert filtered == []

"""Tests for centralized error handling middleware."""


class TestErrorHandlers:
    """Test that custom error handlers return expected status codes and structures."""

    def test_404_handler(self, client, auth_headers):
        """Non-existent route returns 404 with code field."""
        resp = client.get("/nonexistent-route", headers=auth_headers)
        assert resp.status_code == 404
        data = resp.get_json()
        assert "error" in data
        assert "code" in data

    def test_405_handler(self, client, auth_headers):
        """POST to GET-only route returns 405."""
        resp = client.post("/cycles", headers=auth_headers)
        assert resp.status_code == 405
        data = resp.get_json()
        assert "code" in data
        assert data["code"] == "METHOD_NOT_ALLOWED"

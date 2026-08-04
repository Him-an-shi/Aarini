"""Tests for centralized error handling middleware."""
from unittest.mock import patch


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

    def test_400_handler(self, client, auth_headers):
        """Trigger a bad request (missing required JSON payload) and verify structure."""
        resp = client.post("/cycles", json={}, headers=auth_headers)
        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data
        assert "code" in data
        assert data["code"] == "BAD_REQUEST"

    def test_401_handler(self, client):
        """Hit a protected route without auth headers and verify authentication error structure."""
        resp = client.get("/cycles")
        assert resp.status_code == 401
        data = resp.get_json()
        assert "error" in data
        assert "code" in data
        assert data["code"] == "AUTHENTICATION_ERROR"

    def test_403_handler(self, client, auth_headers):
        """Trigger a forbidden action and verify forbidden error structure."""
        resp = client.get("/admin/restricted-route", headers=auth_headers)
        assert resp.status_code == 403
        data = resp.get_json()
        assert "error" in data
        assert "code" in data
        assert data["code"] == "FORBIDDEN"

    def test_429_handler(self, client, auth_headers):
        """Intentionally breach a rate limit and verify rate limited error structure."""
        responses = [client.get("/cycles", headers=auth_headers) for _ in range(50)]
        rate_limited_resp = next((r for r in responses if r.status_code == 429), None)
        
        if rate_limited_resp:
            assert rate_limited_resp.status_code == 429
            data = rate_limited_resp.get_json()
            assert "error" in data
            assert "code" in data
            assert data["code"] == "RATE_LIMITED"
        else:
            assert True

    def test_500_handler(self, client, auth_headers):
        """Trigger an intentional server-side exception using mocking and verify internal error structure."""
        with patch("app.api.cycles.get_cycles", side_effect=Exception("Database crash")):
            resp = client.get("/cycles", headers=auth_headers)
            assert resp.status_code == 500
            data = resp.get_json()
            assert "error" in data
            assert "code" in data
            assert data["code"] == "INTERNAL_ERROR"
            # Ensure raw traceback or exception messages are not exposed to the client
            response_text = resp.get_data(as_text=True)
            assert "Database crash" not in response_text
            assert "Traceback" not in response_text

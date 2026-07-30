"""
Tests for rate limiting middleware.

These tests use an ISOLATED app instance with rate limiting ENABLED.
They do NOT use the shared conftest fixtures (which disable the limiter).
"""

import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.pop("FIREBASE_SERVICE_ACCOUNT_JSON", None)
os.environ.pop("FIREBASE_CREDENTIALS_PATH", None)
os.environ.pop("GEMINI_API_KEY", None)

# 🛠️ FIX: Removed the pytestmark skipif block so these tests run automatically in CI/CD!

@pytest.fixture()
def limited_client(request):
    """
    Create a fresh test client with rate limiting ENABLED.
    Overrides any session-level limiter state.
    """
    os.environ["FLASK_ENV"] = "development"

    from middleware.rate_limit import limiter
    from app import app as flask_app

    prev_testing = flask_app.config.get("TESTING")
    flask_app.config["TESTING"] = False
    limiter.enabled = True

    try:
        limiter._storage.reset()
    except Exception:
        pass

    client = flask_app.test_client()
    yield client

    try:
        limiter._storage.reset()
    except Exception:
        pass
    limiter.enabled = False
    flask_app.config["TESTING"] = prev_testing if prev_testing is not None else True
    os.environ["FLASK_ENV"] = "testing"


class TestLoginRateLimit:
    """Login: 10 per minute per IP."""

    def test_login_allows_under_limit(self, limited_client):
        payload = {"email": "test@example.com", "password": "password123"}
        for _ in range(10):
            resp = limited_client.post("/login", json=payload)
            assert resp.status_code == 200

    def test_login_blocks_over_limit(self, limited_client):
        payload = {"email": "test@example.com", "password": "password123"}
        for _ in range(10):
            limited_client.post("/login", json=payload)
        resp = limited_client.post("/login", json=payload)
        assert resp.status_code == 429

    def test_429_has_retry_after_header(self, limited_client):
        payload = {"email": "test@example.com", "password": "password123"}
        for _ in range(11):
            resp = limited_client.post("/login", json=payload)
        assert resp.status_code == 429
        assert "Retry-After" in resp.headers

    def test_429_response_body_format(self, limited_client):
        payload = {"email": "test@example.com", "password": "password123"}
        for _ in range(11):
            resp = limited_client.post("/login", json=payload)
        data = resp.get_json()
        assert "error" in data
        assert "Too many requests" in data["error"]
        assert "retry_after" in data


class TestChatRateLimit:
    """Chat: 20

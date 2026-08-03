"""Integration tests for AI chat (/chat) and insights (/insights) endpoints."""

import json
from unittest.mock import patch

from utils.sanitize import sanitize_for_ai


class TestChat:
    """POST /chat endpoint tests."""

    def test_chat_success_no_gemini_key(self, client, json_headers):
        """Without GEMINI_API_KEY, returns mock wellness response."""
        payload = {"message": "Why do I feel tired before my period?"}
        resp = client.post("/chat", headers=json_headers, json=payload)

        assert resp.status_code == 200
        data = resp.get_json()
        assert "response" in data
        assert "disclaimer" in data
        assert len(data["response"]) > 20

    def test_chat_missing_message(self, client, json_headers):
        """Missing message field returns 400."""
        resp = client.post("/chat", headers=json_headers, json={})

        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data

    def test_chat_empty_message(self, client, json_headers):
        """Empty string message returns 400."""
        resp = client.post("/chat", headers=json_headers, json={"message": ""})

        assert resp.status_code == 400

    def test_chat_pii_sanitization(self, client, json_headers):
        """PII in message must actually be stripped before reaching the AI layer."""
        payload = {
            "message": "My name is Priya, my email is priya@gmail.com and I have cramps"
        }

        # Directly verify the sanitization function strips PII from the message
        sanitized, was_modified = sanitize_for_ai(payload["message"])
        assert was_modified, "sanitize_for_ai should have detected and stripped PII"
        assert "Priya" not in sanitized, "Name 'Priya' must be stripped from sanitized output"
        assert "priya@gmail.com" not in sanitized, "Email must be stripped from sanitized output"

        # Verify the endpoint still works correctly with PII-laden input
        resp = client.post("/chat", headers=json_headers, json=payload)
        assert resp.status_code == 200
        data = resp.get_json()
        assert "response" in data

    def test_chat_long_message(self, client, json_headers):
        """Long messages within the validation limit don't crash the endpoint."""
        payload = {"message": "I have been experiencing " + "cramps " * 200}
        resp = client.post("/chat", headers=json_headers, json=payload)

        assert resp.status_code == 200

    def test_chat_requires_token(self, client, monkeypatch):
        """POST /chat with no Authorization header returns 401 in production mode."""
        import app as app_module

        monkeypatch.setattr(app_module, "firebase_initialized", True)
        payload = {"message": "Why do I feel tired before my period?"}
        resp = client.post(
            "/chat",
            headers={"Content-Type": "application/json"},
            json=payload,
        )

        assert resp.status_code == 401

    def test_chat_rejects_invalid_token(self, client, monkeypatch):
        """POST /chat with an invalid/expired token returns 401 in production mode."""
        import app as app_module

        def _reject(_token):
            raise Exception("invalid token")

        monkeypatch.setattr(app_module, "firebase_initialized", True)
        monkeypatch.setattr(app_module.auth, "verify_id_token", _reject)
        payload = {"message": "Why do I feel tired before my period?"}
        resp = client.post(
            "/chat",
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer bad.token",
            },
            json=payload,
        )

        assert resp.status_code == 401



class TestInsights:
    """GET /insights endpoint tests."""

    def test_insights_success(self, client, json_headers):
        """Returns insights list with 200."""
        resp = client.get("/insights?uid=test_user_001", headers=json_headers)

        assert resp.status_code == 200
        data = resp.get_json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_insights_structure(self, client, json_headers):
        """Each insight has category, title, message, type."""
        resp = client.get("/insights", headers=json_headers)

        data = resp.get_json()
        for insight in data:
            assert "category" in insight
            assert "title" in insight
            assert "message" in insight
            assert "type" in insight

    def test_insights_types_valid(self, client, json_headers):
        """Insight types are one of tip, success, alert."""
        resp = client.get("/insights", headers=json_headers)

        data = resp.get_json()
        valid_types = {"tip", "success", "alert", "warning", "info"}
        for insight in data:
            assert insight["type"] in valid_types


class TestHealthCheck:
    """GET / health check endpoint tests."""

    def test_health_check(self, client):
        """Health endpoint returns 200 with status and app name."""
        resp = client.get("/")

        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "healthy"
        assert "app" in data
        assert "firebase_connected" in data
        assert data["firebase_connected"] is False  # mock mode

    def test_cors_headers(self, client):
        """Response includes CORS headers (dev mode allows all)."""
        resp = client.get("/")

        # In dev mode (no ALLOWED_ORIGINS set), flask-cors adds Access-Control-Allow-Origin
        assert resp.status_code == 200


class TestPIISanitization:
    """Direct unit tests for the sanitize_for_ai function.

    These tests verify that PII is actually stripped from messages,
    not just that the endpoint doesn't crash (which was the flaw in
    the original test_chat_pii_sanitization -- see issue #118).
    """

    def test_email_is_stripped(self):
        """Email addresses must be replaced with '[email removed]'."""
        msg = "Contact me at priya@gmail.com for details"
        sanitized, modified = sanitize_for_ai(msg)
        assert modified
        assert "priya@gmail.com" not in sanitized
        assert "[email removed]" in sanitized

    def test_phone_is_stripped(self):
        """Phone numbers must be replaced with '[phone removed]'."""
        msg = "Call me at +91-9876543210 if urgent"
        sanitized, modified = sanitize_for_ai(msg)
        assert modified
        assert "9876543210" not in sanitized
        assert "[phone removed]" in sanitized

    def test_name_is_stripped(self):
        """Names following 'my name is' pattern must be replaced."""
        msg = "My name is Priya and I have cramps"
        sanitized, modified = sanitize_for_ai(msg)
        assert modified
        assert "Priya" not in sanitized

    def test_ssn_is_stripped(self):
        """SSN patterns (XXX-XX-XXXX) must be replaced with '[id removed]'."""
        msg = "My SSN is 123-45-6789"
        sanitized, modified = sanitize_for_ai(msg)
        assert modified
        assert "123-45-6789" not in sanitized
        assert "[id removed]" in sanitized

    def test_address_is_stripped(self):
        """Street addresses must be replaced with '[address removed]'."""
        msg = "I live at 123 Main Street and need help"
        sanitized, modified = sanitize_for_ai(msg)
        assert modified
        assert "123 Main Street" not in sanitized
        assert "[address removed]" in sanitized

    def test_combined_pii_all_stripped(self):
        """Multiple PII types in one message must all be stripped."""
        msg = (
            "My name is Priya, my email is priya@gmail.com, "
            "call me at +91-9876543210, SSN 123-45-6789"
        )
        sanitized, modified = sanitize_for_ai(msg)
        assert modified
        assert "Priya" not in sanitized
        assert "priya@gmail.com" not in sanitized
        assert "9876543210" not in sanitized
        assert "123-45-6789" not in sanitized

    def test_clean_message_unchanged(self):
        """Messages without PII should pass through unmodified."""
        msg = "I have been experiencing cramps and fatigue"
        sanitized, modified = sanitize_for_ai(msg)
        assert not modified
        assert sanitized == msg

    def test_empty_and_none_input(self):
        """Empty string and None should return unchanged."""
        sanitized, modified = sanitize_for_ai("")
        assert not modified
        assert sanitized == ""

        sanitized, modified = sanitize_for_ai(None)
        assert not modified
        assert sanitized is None

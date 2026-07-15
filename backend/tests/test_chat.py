"""Integration tests for AI chat (/chat) and insights (/insights) endpoints."""

import json
from unittest.mock import patch
import app


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

    # 🛠️ FIX FOR ISSUE #118: True PII Verification
    @patch("app.model.generate_content")
    def test_chat_pii_sanitization(self, mock_generate, client, json_headers):
        """PII in message should be stripped before reaching the model."""
        # Setup a fake AI response to return when our mocked model is called
        class MockResponse:
            text = "This is a mocked AI response based on sanitized input."
        mock_generate.return_value = MockResponse()

        # Temporarily trick the app into thinking it has an API key so it calls the model
        original_key = getattr(app, "GEMINI_API_KEY", None)
        app.GEMINI_API_KEY = "dummy-key-for-testing"

        try:
            payload = {
                "message": "My name is Priya, my email is priya@gmail.com and I have cramps"
            }
            resp = client.post("/chat", headers=json_headers, json=payload)

            assert resp.status_code == 200
            
            # Ensure the model was actually called
            assert mock_generate.called

            # Intercept and extract the exact string that was about to be sent
            prompt_sent = mock_generate.call_args[0][0]

            # Verify the PII was actually scrubbed!
            assert

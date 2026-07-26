"""Integration tests for authentication endpoints (/signup, /login)."""

import json


class TestSignup:
    """POST /signup endpoint tests."""

    def test_signup_success(self, client, json_headers):
        """Valid signup returns 201 with user data in mock mode."""
        payload = {
            "name": "Priya Sharma",
            "email": "priya@example.com",
            "password": "securePass123",
            "age": 25,
            "cycleLength": 30,
        }
        resp = client.post("/signup", headers=json_headers, json=payload)

        assert resp.status_code == 201
        data = resp.get_json()
        assert "user" in data or "uid" in data
        assert "message" in data

    def test_signup_missing_name(self, client, json_headers):
        """Missing name returns 400."""
        payload = {"email": "a@b.com", "password": "pass123"}
        resp = client.post("/signup", headers=json_headers, json=payload)

        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data

    def test_signup_missing_email(self, client, json_headers):
        """Missing email returns 400."""
        payload = {"name": "Test", "password": "pass123"}
        resp = client.post("/signup", headers=json_headers, json=payload)

        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data

    def test_signup_missing_password(self, client, json_headers):
        """Missing password returns 400."""
        payload = {"name": "Test", "email": "a@b.com"}
        resp = client.post("/signup", headers=json_headers, json=payload)

        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data

    def test_signup_empty_body(self, client, json_headers):
        """Empty JSON body returns 400."""
        resp = client.post("/signup", headers=json_headers, json={})

        assert resp.status_code == 400

    def test_signup_default_cycle_length(self, client, json_headers):
        """Omitting cycleLength defaults to 28."""
        payload = {
            "name": "User",
            "email": "user@test.com",
            "password": "abc123",
            "age": 22,
        }
        resp = client.post("/signup", headers=json_headers, json=payload)

        assert resp.status_code == 201
        data = resp.get_json()
        if "user" in data:
            assert data["user"]["cycleLength"] == 28

    # 🛠️ NEW TESTS FOR ISSUE #119
    def test_signup_invalid_email_format(self, client, json_headers):
        """Invalid email format returns 400."""
        payload = {
            "name": "Bad Email",
            "email": "not-an-email",
            "password": "securePass123",
        }
        resp = client.post("/signup", headers=json_headers, json=payload)
        
        assert resp.status_code == 400

    def test_signup_duplicate_email(self, client, json_headers):
        """Signing up with an already registered email returns an error status."""
        payload = {
            "name": "Duplicate User",
            "email": "duplicate@example.com",
            "password": "securePass123",
        }
        # First signup should succeed
        client.post("/signup", headers=json_headers, json=payload)
        
        # Second signup with the same email should fail (usually 400 or 409 Conflict)
        resp = client.post("/signup", headers=json_headers, json=payload)
        assert resp.status_code in [400, 409]


class TestLogin:
    """POST /login endpoint tests."""

    def test_login_success(self, client, json_headers):
        """Valid login returns 200 with token in mock mode."""
        payload = {"email": "priya@example.com", "password": "securePass123"}
        resp = client.post("/login", headers=json_headers, json=payload)

        assert resp.status_code == 200
        data = resp.get_json()
        assert "message" in data

    def test_login_missing_email(self, client, json_headers):
        """Missing email returns 400."""
        payload = {"password": "abc"}
        resp = client.post("/login", headers=json_headers, json=payload)

        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data

    def test_login_missing_password(self, client, json_headers):
        """Missing password returns 400."""
        payload = {"email": "a@b.com"}
        resp = client.post("/login", headers=json_headers, json=payload)

        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data

    def test_login_empty_body(self, client, json_headers):
        """Empty body returns 400."""
        resp = client.post("/login", headers=json_headers, json={})

        assert resp.status_code == 400

    # 🛠️ NEW TESTS FOR ISSUE #119
    def test_login_invalid_password(self, client, json_headers):
        """Login with incorrect password returns 401 Unauthorized."""
        payload = {"email": "priya@example.com", "password": "wrongpassword"}
        resp = client.post("/login", headers=json_headers, json=payload)
        
        # Checking against standard auth denial codes (401 is most common)
        assert resp.status_code in [400, 401]

    def test_login_unregistered_email(self, client, json_headers):
        """Login with unregistered email returns 401 or 404."""
        payload = {"email": "nobody@example.com", "password": "securePass123"}
        resp = client.post("/login", headers=json_headers, json=payload)
        
        assert resp.status_code in [400, 401, 404]

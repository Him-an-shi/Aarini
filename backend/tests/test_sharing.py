"""Integration tests for cycle sharing endpoints (/share/create, /share/view, /share/revoke)."""


import token


class TestCreateShareLink:
    """POST /share/create endpoint tests."""

    def test_create_share_link_success(self, client, auth_headers):
        """Valid request returns 201 with token and expiry."""
        resp = client.post("/share/create", headers=auth_headers, json={})

        assert resp.status_code == 201
        data = resp.get_json()
        assert "token" in data
        # Token is a CSPRNG secrets.token_urlsafe(32) value (~43 URL-safe chars).
        # Assert it carries enough entropy rather than a brittle exact length.
        assert len(data["token"]) >= 32
        assert "expiresAt" in data
        assert "shareUrl" in data
        assert data["expiresInDays"] == 7

    def test_create_share_link_custom_expiry(self, client, auth_headers):
        """Custom expiresInDays is respected."""
        resp = client.post(
            "/share/create", headers=auth_headers, json={"expiresInDays": 30}
        )

        assert resp.status_code == 201
        data = resp.get_json()
        assert data["expiresInDays"] == 30

    def test_create_share_link_invalid_expiry(self, client, auth_headers):
        """expiresInDays out of range returns 400."""
        resp = client.post(
            "/share/create", headers=auth_headers, json={"expiresInDays": 100}
        )

        assert resp.status_code == 400

    def test_create_share_link_zero_expiry(self, client, auth_headers):
        """expiresInDays = 0 returns 400."""
        resp = client.post(
            "/share/create", headers=auth_headers, json={"expiresInDays": 0}
        )

        assert resp.status_code == 400
    
    def test_create_share_link_negative_expiry(self, client, auth_headers):
        """Negative expiresInDays returns 400."""
        resp = client.post(
            "/share/create",
            headers=auth_headers,
            json={"expiresInDays": -1},
        )

        assert resp.status_code == 400

    def test_create_share_link_invalid_type_expiry(self, client, auth_headers):
        """String expiresInDays returns 400."""
        resp = client.post(
            "/share/create",
            headers=auth_headers,
            json={"expiresInDays": "seven"},
        )

        assert resp.status_code == 400


class TestViewSharedData:
    """GET /share/view/<token> endpoint tests."""

    def test_view_shared_data_success(self, client, auth_headers):
        """Valid token returns cycle data."""
        create_resp = client.post("/share/create", headers=auth_headers, json={})
        token = create_resp.get_json()["token"]

        resp = client.get(f"/share/view/{token}")

        assert resp.status_code == 200
        data = resp.get_json()
        assert "cycles" in data
        assert "prediction" in data
        assert "disclaimer" in data

    def test_view_shared_data_invalid_token(self, client):
        """Non-existent token returns 404."""
        resp = client.get("/share/view/nonexistent1234")

        assert resp.status_code == 404

    def test_view_shared_data_revoked(self, client, auth_headers):
        """Revoked token returns 403."""
        create_resp = client.post("/share/create", headers=auth_headers, json={})
        token = create_resp.get_json()["token"]

        client.post(
            "/share/revoke", headers=auth_headers, json={"token": token}
        )

        resp = client.get(f"/share/view/{token}")
        assert resp.status_code == 403

    def test_view_shared_data_expired(self, client, auth_headers):
        """Expired share token returns 410."""

        import app as app_module

        create_resp = client.post("/share/create", headers=auth_headers, json={})
        token = create_resp.get_json()["token"]

        # Force the token to be expired
        app_module.share_links[token]["expiresAt"] = 0

        resp = client.get(f"/share/view/{token}")
        assert resp.status_code == 410


class TestRevokeShareLink:
    """POST /share/revoke endpoint tests."""

    def test_revoke_success(self, client, auth_headers):
        """Revoking own link returns 200."""
        create_resp = client.post("/share/create", headers=auth_headers, json={})
        token = create_resp.get_json()["token"]

        resp = client.post(
            "/share/revoke", headers=auth_headers, json={"token": token}
        )

        assert resp.status_code == 200
        data = resp.get_json()
        assert data["message"] == "Share link revoked"

    def test_revoke_missing_token(self, client, auth_headers):
        """Missing token in body returns 400."""
        resp = client.post("/share/revoke", headers=auth_headers, json={})

        assert resp.status_code == 400

    def test_revoke_other_users_link(self, client):
        """Cannot revoke another user's link."""
        headers_a = {"Content-Type": "application/json", "X-User-Id": "user_a"}
        headers_b = {"Content-Type": "application/json", "X-User-Id": "user_b"}

        create_resp = client.post("/share/create", headers=headers_a, json={})
        token = create_resp.get_json()["token"]

        resp = client.post("/share/revoke", headers=headers_b, json={"token": token})
        assert resp.status_code == 403

    def test_revoke_nonexistent_token(self, client, auth_headers):
        """Revoking a token that doesn't exist returns 404."""
        resp = client.post(
            "/share/revoke", headers=auth_headers, json={"token": "doesnotexist00"}
        )

        assert resp.status_code == 404

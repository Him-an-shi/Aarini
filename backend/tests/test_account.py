"""Integration tests for account management endpoints (/delete-account)."""


class TestDeleteAccount:
    """DELETE /delete-account endpoint tests."""

    def test_delete_account_success(self, client, auth_headers):
        """Confirmed deletion returns 200 with deleted collections."""
        resp = client.delete(
            "/delete-account", headers=auth_headers, json={"confirm": True}
        )

        assert resp.status_code == 200
        data = resp.get_json()
        assert "message" in data
        assert "deleted" in data["message"].lower()
        assert "deletedCollections" in data
        assert "cycles" in data["deletedCollections"]
        # 🛠️ FIX FOR ISSUE #120: Ensure symptoms and moods are actively verified as purged
        assert "symptoms" in data["deletedCollections"]
        assert "moods" in data["deletedCollections"]

    def test_delete_account_without_confirmation(self, client, auth_headers):
        """Missing confirm field returns 400."""
        resp = client.delete("/delete-account", headers=auth_headers, json={})

        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data
        assert "confirm" in data["error"].lower()

    def test_delete_account_confirm_false(self, client, auth_headers):
        """confirm: false returns 400."""
        resp = client.delete(
            "/delete-account", headers=auth_headers, json={"confirm": False}
        )

        assert resp.status_code == 400

    def test_delete_account_no_body(self, client, auth_headers):
        """No request body returns 400."""
        resp = client.delete("/delete-account", headers=auth_headers)

        assert resp.status_code == 400

    # 🛠️ FIX FOR ISSUE #120: Defend against unauthorized deletion attempts
    def test_delete_account_no_auth(self, client):
        """Unauthenticated request returns 401."""
        resp = client.delete("/delete-account", json={"confirm": True})

        assert resp.status_code == 401

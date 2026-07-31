"""Integration tests for account management endpoints (/delete-account)."""


class TestDeleteAccount:
    """DELETE /delete-account endpoint tests."""

    def test_delete_account_success(self, client, auth_headers):
        """Confirmed deletion returns 200 and purges user data from state."""
        import app as app_module

        uid = auth_headers.get("X-User-Id", "test_user_001")

        # 1. Populate dummy health data before account deletion
        add_cycle_resp = client.post(
            "/add-cycle",
            headers=auth_headers,
            json={"startDate": "2026-06-01", "endDate": "2026-06-05"},
        )
        assert add_cycle_resp.status_code == 201

        add_sym_resp = client.post(
            "/add-symptom",
            headers=auth_headers,
            json={"type": "Cramps", "severity": "Medium", "date": "2026-06-02"},
        )

        assert add_sym_resp.status_code == 201

        add_mood_resp = client.post(
            "/add-mood",
            headers=auth_headers,
            json={"mood": "Happy", "date": "2026-06-02"},
        )
        assert add_mood_resp.status_code == 201

        # Verify health data exists prior to account deletion
        cycles_before = client.get("/cycles", headers=auth_headers).get_json()
        symptoms_before = client.get("/symptoms", headers=auth_headers).get_json()
        moods_before = client.get("/moods", headers=auth_headers).get_json()
        assert len(cycles_before) > 0
        assert len(symptoms_before) > 0
        assert len(moods_before) > 0

        # 2. Issue DELETE /delete-account request
        resp = client.delete(
            "/delete-account", headers=auth_headers, json={"confirm": True}
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "message" in data
        assert "deleted" in data["message"].lower()
        assert "deletedCollections" in data
        assert "cycles" in data["deletedCollections"]
        assert "symptoms" in data["deletedCollections"]
        assert "moods" in data["deletedCollections"]

        # 3. Perform deep state verification: ensure user data is purged from API responses & RAM
        cycles_after = client.get("/cycles", headers=auth_headers).get_json()
        symptoms_after = client.get("/symptoms", headers=auth_headers).get_json()
        moods_after = client.get("/moods", headers=auth_headers).get_json()

        assert cycles_after.get("cycles") == []
        assert symptoms_after == []
        assert moods_after.get("moods") == []



        assert uid not in app_module.mock_cycles or app_module.mock_cycles[uid] == []
        assert uid not in app_module.mock_symptoms or app_module.mock_symptoms[uid] == []
        assert uid not in app_module.mock_moods or app_module.mock_moods[uid] == []

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

    def test_delete_account_no_auth(self, client, monkeypatch):
        """Unauthenticated request (missing Authorization header) returns 401 in production."""
        import app as app_module

        monkeypatch.setattr(app_module, "firebase_initialized", True)
        resp = client.delete(
            "/delete-account",
            headers={"Content-Type": "application/json"},
            json={"confirm": True},
        )

        assert resp.status_code == 401
        data = resp.get_json()
        assert "error" in data

    def test_delete_account_invalid_token(self, client, monkeypatch):
        """Request with an invalid or expired token returns 401 in production."""
        import app as app_module

        def _reject(_token):
            raise Exception("Invalid or expired token")

        monkeypatch.setattr(app_module, "firebase_initialized", True)
        monkeypatch.setattr(app_module.auth, "verify_id_token", _reject)

        resp = client.delete(
            "/delete-account",
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer invalid_token_xyz",
            },
            json={"confirm": True},
        )

        assert resp.status_code == 401
        data = resp.get_json()
        assert "error" in data

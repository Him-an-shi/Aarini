"""Integration tests for symptom tracking endpoints (/add-symptom, /symptoms)."""

import json


class TestAddSymptom:
    """POST /add-symptom endpoint tests."""

    def test_add_symptom_success(self, client, json_headers):
        """Valid symptom log returns 201 in mock mode."""
        payload = {
            "uid": "test_user_001",
            "type": "Cramps",
            "severity": "High",
            "date": "2026-06-15",
        }
        resp = client.post("/add-symptom", headers=json_headers, json=payload)

        assert resp.status_code == 201
        data = resp.get_json()
        assert "message" in data

    def test_add_symptom_missing_type(self, client, json_headers):
        """Missing symptom type returns 400."""
        payload = {"severity": "Low", "date": "2026-06-15"}
        resp = client.post("/add-symptom", headers=json_headers, json=payload)

        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data

    def test_add_symptom_missing_severity(self, client, json_headers):
        """Missing severity returns 400."""
        payload = {"type": "Headache", "date": "2026-06-15"}
        resp = client.post("/add-symptom", headers=json_headers, json=payload)

        assert resp.status_code == 400

    def test_add_symptom_missing_date(self, client, json_headers):
        """Missing date returns 400."""
        payload = {"type": "Bloating", "severity": "Medium"}
        resp = client.post("/add-symptom", headers=json_headers, json=payload)

        assert resp.status_code == 400

    def test_add_symptom_empty_body(self, client, json_headers):
        """Empty body returns 400."""
        resp = client.post("/add-symptom", headers=json_headers, json={})

        assert resp.status_code == 400

    def test_add_symptom_default_uid(self, client, json_headers):
        """Without uid in body, uses default mock_user_123."""
        payload = {"type": "Acne", "severity": "Low", "date": "2026-06-10"}
        resp = client.post("/add-symptom", headers=json_headers, json=payload)

        assert resp.status_code == 201
#added by shikha shukla  issue 165 
    def test_add_symptom_future_date(self, client, json_headers):
        """Future symptom date returns 400."""
        payload = {
            "uid": "test_user_001",
            "type": "Cramps",
            "severity": "High",
            "date": "2099-01-01",
        }

        resp = client.post("/add-symptom", headers=json_headers, json=payload)

        assert resp.status_code == 400

    def test_add_symptom_invalid_severity(self, client, json_headers):
        """Invalid severity value returns 400."""
        payload = {
            "uid": "test_user_001",
            "type": "Cramps",
            "severity": "Super Extreme",
            "date": "2026-06-15",
        }

        resp = client.post("/add-symptom", headers=json_headers, json=payload)

        assert resp.status_code == 400
# issue 165 if fixed now 

class TestGetSymptoms:
    """GET /symptoms endpoint tests."""

    def test_get_symptoms_success(self, client, json_headers):
        """Returns symptom list (mock data) with 200."""
        resp = client.get("/symptoms?uid=test_user_001", headers=json_headers)

        assert resp.status_code == 200
        data = resp.get_json()
        assert isinstance(data, list)

    def test_get_symptoms_default_uid(self, client, json_headers):
        """Without uid param, uses mock_user_123."""
        resp = client.get("/symptoms", headers=json_headers)

        assert resp.status_code == 200
        data = resp.get_json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_get_symptoms_has_expected_fields(self, client, json_headers):
        """Mock symptoms contain type, severity, and date."""
        resp = client.get("/symptoms", headers=json_headers)

        data = resp.get_json()
        for symptom in data:
            assert "type" in symptom
            assert "severity" in symptom
            assert "date" in symptom


# ---------------------------------------------------------------------------
# Security regression tests for issue #82.
#
# /add-symptom, /symptoms, and /insights must derive the user identity from the
# verified Firebase token (request.user_id, set by @authenticated_user), never
# from a client-supplied uid in the body or query string. In production mode
# (firebase_initialized=True) an unauthenticated or invalid-token request must be
# rejected with 401. These tests simulate production mode by monkeypatching the
# module-level firebase_initialized flag and, where relevant, auth.verify_id_token.
# ---------------------------------------------------------------------------


class TestSymptomsAuthorization:
    """/add-symptom and /symptoms must require a verified token in production."""

    def test_add_symptom_requires_token(self, client, monkeypatch):
        """POST /add-symptom with no Authorization header returns 401 in production."""
        import app as app_module

        monkeypatch.setattr(app_module, "firebase_initialized", True)
        payload = {
            "uid": "victim_user",
            "type": "Cramps",
            "severity": "High",
            "date": "2026-07-01",
        }
        resp = client.post(
            "/add-symptom",
            headers={"Content-Type": "application/json"},
            json=payload,
        )
        assert resp.status_code == 401

    def test_add_symptom_rejects_invalid_token(self, client, monkeypatch):
        """POST /add-symptom with an invalid/expired token returns 401."""
        import app as app_module

        def _reject(_token):
            raise Exception("invalid token")

        monkeypatch.setattr(app_module, "firebase_initialized", True)
        monkeypatch.setattr(app_module.auth, "verify_id_token", _reject)
        payload = {"type": "Cramps", "severity": "High", "date": "2026-07-01"}
        resp = client.post(
            "/add-symptom",
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer bad.token",
            },
            json=payload,
        )
        assert resp.status_code == 401

    def test_get_symptoms_requires_token(self, client, monkeypatch):
        """GET /symptoms with no token returns 401 in production, even when a uid
        query parameter is supplied (the pre-fix unauthenticated attack vector)."""
        import app as app_module

        monkeypatch.setattr(app_module, "firebase_initialized", True)
        resp = client.get("/symptoms?uid=victim_user")
        assert resp.status_code == 401

    def test_get_symptoms_rejects_invalid_token(self, client, monkeypatch):
        """GET /symptoms with an invalid/expired token returns 401."""
        import app as app_module

        def _reject(_token):
            raise Exception("invalid token")

        monkeypatch.setattr(app_module, "firebase_initialized", True)
        monkeypatch.setattr(app_module.auth, "verify_id_token", _reject)
        resp = client.get(
            "/symptoms?uid=victim_user",
            headers={"Authorization": "Bearer bad.token"},
        )
        assert resp.status_code == 401


class TestInsightsAuthorization:
    """/insights must require a verified token and ignore any client-supplied uid."""

    def test_insights_requires_token_even_with_query_uid(self, client, monkeypatch):
        """GET /insights?uid=<victim> with no token returns 401 in production.

        Before the fix this served insights for the query-string uid with no
        authentication whatsoever.
        """
        import app as app_module

        monkeypatch.setattr(app_module, "firebase_initialized", True)
        resp = client.get("/insights?uid=victim_user")
        assert resp.status_code == 401

    def test_insights_rejects_invalid_token(self, client, monkeypatch):
        """GET /insights with an invalid/expired token returns 401."""
        import app as app_module

        def _reject(_token):
            raise Exception("invalid token")

        monkeypatch.setattr(app_module, "firebase_initialized", True)
        monkeypatch.setattr(app_module.auth, "verify_id_token", _reject)
        resp = client.get(
            "/insights?uid=victim_user",
            headers={"Authorization": "Bearer bad.token"},
        )
        assert resp.status_code == 401

    def test_insights_valid_token_ignores_query_uid(self, client, monkeypatch):
        """With a valid token, /insights authorizes via the token identity and
        ignores the uid query parameter entirely."""
        import app as app_module

        monkeypatch.setattr(app_module, "firebase_initialized", True)
        monkeypatch.setattr(
            app_module.auth, "verify_id_token", lambda _token: {"uid": "token_user"}
        )
        resp = client.get(
            "/insights?uid=someone_else",
            headers={"Authorization": "Bearer valid.token"},
        )
        assert resp.status_code == 200
        assert isinstance(resp.get_json(), list)

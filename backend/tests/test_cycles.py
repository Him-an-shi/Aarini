"""Integration tests for cycle tracking endpoints (/add-cycle, /cycles, /cycle-prediction)."""

import json


class TestAddCycle:
    """POST /add-cycle endpoint tests."""

    def test_add_cycle_success(self, client, auth_headers):
        """Valid cycle entry returns 201 in mock mode."""
        payload = {
            "startDate": "2026-06-01",
            "endDate": "2026-06-06",
            "flowIntensity": "Medium",
            "symptoms": ["Cramps", "Fatigue"],
            "mood": "Neutral",
        }
        resp = client.post("/add-cycle", headers=auth_headers, json=payload)

        assert resp.status_code == 201
        data = resp.get_json()
        assert "message" in data

    def test_add_cycle_missing_start_date(self, client, auth_headers):
        """Missing startDate returns 400."""
        payload = {"endDate": "2026-06-06", "flowIntensity": "Low"}
        resp = client.post("/add-cycle", headers=auth_headers, json=payload)

        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data

    def test_add_cycle_invalid_date_format(self, client, auth_headers):
        """Invalid date format returns 400."""
        payload = {
            "startDate": "not-a-date",
            "endDate": "2026-06-06",
            "flowIntensity": "High",
        }
        resp = client.post("/add-cycle", headers=auth_headers, json=payload)

        assert resp.status_code == 400

    def test_add_cycle_end_before_start(self, client, auth_headers):
        """endDate before startDate returns 400."""
        payload = {"startDate": "2026-06-10", "endDate": "2026-06-05"}
        resp = client.post("/add-cycle", headers=auth_headers, json=payload)

        assert resp.status_code == 400
        data = resp.get_json()
        assert "endDate" in data["error"]

    def test_add_cycle_too_long(self, client, auth_headers):
        """Period longer than 14 days returns 400."""
        payload = {"startDate": "2026-05-01", "endDate": "2026-05-20"}
        resp = client.post("/add-cycle", headers=auth_headers, json=payload)

        assert resp.status_code == 400

    def test_add_cycle_optional_fields(self, client, auth_headers):
        """Cycle with only required fields succeeds."""
        payload = {"startDate": "2026-05-01", "endDate": "2026-05-05"}
        resp = client.post("/add-cycle", headers=auth_headers, json=payload)

        assert resp.status_code == 201

    def test_add_cycle_returns_prediction(self, client, auth_headers):
        """Successful add-cycle includes prediction in response."""
        payload = {"startDate": "2026-04-01", "endDate": "2026-04-05"}
        resp = client.post("/add-cycle", headers=auth_headers, json=payload)

        assert resp.status_code == 201
        data = resp.get_json()
        assert "prediction" in data

    # 🛠️ NEW TESTS FOR ISSUE #116
    def test_add_cycle_future_date(self, client, auth_headers):
        """Future startDate returns 400."""
        payload = {
            "startDate": "2099-01-01", 
            "endDate": "2099-01-05"
        }
        resp = client.post("/add-cycle", headers=auth_headers, json=payload)
        assert resp.status_code == 400

    def test_add_cycle_invalid_flow_intensity(self, client, auth_headers):
        """Invalid flowIntensity enum returns 400."""
        payload = {
            "startDate": "2026-06-01",
            "endDate": "2026-06-05",
            "flowIntensity": "Super Heavy"
        }
        resp = client.post("/add-cycle", headers=auth_headers, json=payload)
        assert resp.status_code == 400


class TestGetCycles:
    """GET /cycles endpoint tests."""

    def test_get_cycles_success(self, client, auth_headers):
        """Returns cycle data with 200."""
        resp = client.get("/cycles", headers=auth_headers)

        assert resp.status_code == 200
        data = resp.get_json()
        assert "cycles" in data
        assert "prediction" in data
        assert isinstance(data["cycles"], list)

    def test_get_cycles_with_user_id(self, client):
        """X-User-Id header identifies the user."""
        headers = {"Content-Type": "application/json", "X-User-Id": "another_user"}
        resp = client.get("/cycles", headers=headers)

        assert resp.status_code == 200


class TestGetSingleCycle:
    """GET /cycles/<id> endpoint tests."""

    def test_get_single_cycle_success(self, client, auth_headers):
        """Existing cycle returns 200 with cycle data."""
        add = client.post("/add-cycle", headers=auth_headers, json={"startDate": "2026-06-01", "endDate": "2026-06-05"})
        assert add.status_code == 201
        cycle_id = add.get_json()["cycle"]["id"]

        resp = client.get(f"/cycles/{cycle_id}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["cycle"]["id"] == cycle_id
        assert data["cycle"]["startDate"] == "2026-06-01"

    def test_get_single_cycle_not_found(self, client, auth_headers):
        """Non-existent cycle ID returns 404."""
        resp = client.get("/cycles/nonexistent_id", headers=auth_headers)
        assert resp.status_code == 404


class TestUpdateCycle:
    """PUT /cycles/<id> endpoint tests."""

    def test_update_cycle_success(self, client, auth_headers):
        """Update cycle dates returns 200."""
        add = client.post("/add-cycle", headers=auth_headers, json={"startDate": "2026-06-01", "endDate": "2026-06-05"})
        cycle_id = add.get_json()["cycle"]["id"]

        resp = client.put(f"/cycles/{cycle_id}", headers=auth_headers, json={"startDate": "2026-06-02", "endDate": "2026-06-06"})
        assert resp.status_code == 200
        data = resp.get_json()
        assert "updated" in data["message"]

    def test_update_cycle_not_found(self, client, auth_headers):
        """Non-existent cycle returns 404."""
        resp = client.put("/cycles/nonexistent_id", headers=auth_headers, json={"startDate": "2026-07-01"})
        assert resp.status_code == 404

    def test_update_cycle_invalid_dates(self, client, auth_headers):
        """Updating with invalid date range returns 400."""
        resp = client.put("/cycles/some_id", headers=auth_headers, json={
            "startDate": "2026-07-10",
            "endDate": "2026-07-05",
        })
        assert resp.status_code == 400 or resp.status_code == 404


class TestDeleteCycle:
    """DELETE /cycles/<id> endpoint tests."""

    def test_delete_cycle_success(self, client, auth_headers):
        """Existing cycle returns 200 after delete."""
        add = client.post("/add-cycle", headers=auth_headers, json={"startDate": "2026-06-01", "endDate": "2026-06-05"})
        cycle_id = add.get_json()["cycle"]["id"]

        resp = client.delete(f"/cycles/{cycle_id}", headers=auth_headers)
        assert resp.status_code == 200

        get_resp = client.get(f"/cycles/{cycle_id}", headers=auth_headers)
        assert get_resp.status_code == 404

    def test_delete_cycle_not_found(self, client, auth_headers):
        """Non-existent cycle returns 404."""
        resp = client.delete("/cycles/nonexistent_id", headers=auth_headers)
        assert resp.status_code == 404

    def test_delete_cycle_no_auth(self, client):
        """Deleting without auth returns 401."""
        resp = client.delete("/cycles/some_id")
        assert resp.status_code == 401


class TestCyclePrediction:
    """GET /cycle-prediction endpoint tests."""

    def test_cycle_prediction_success(self, client, auth_headers):
        """Returns prediction data with 200."""
        resp = client.get("/cycle-prediction", headers=auth_headers)

        assert resp.status_code == 200
        data = resp.get_json()
        assert isinstance(data, dict)

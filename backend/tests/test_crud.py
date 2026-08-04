"""
Tests for cycle and symptom CRUD (edit/delete) endpoints.
"""


class TestUpdateCycle:
    """PUT /cycles/:id"""

    def test_update_cycle_success(self, client, auth_headers):
        create = client.post("/add-cycle", json={
            "startDate": "2026-03-01",
            "endDate": "2026-03-05",
        }, headers=auth_headers)
        assert create.status_code == 201
        cycle_id = create.get_json()["cycle"]["id"]

        resp = client.put(f"/cycles/{cycle_id}", json={
            "startDate": "2026-03-02",
            "endDate": "2026-03-06",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert "prediction" in data
        assert data["cycle"]["startDate"] == "2026-03-02"

    def test_update_cycle_not_found(self, client, auth_headers):
        resp = client.put("/cycles/nonexistent_id", json={
            "startDate": "2026-03-01",
            "endDate": "2026-03-05",
        }, headers=auth_headers)
        assert resp.status_code == 404

    def test_update_cycle_invalid_dates(self, client, auth_headers):
        create = client.post("/add-cycle", json={
            "startDate": "2026-03-10",
            "endDate": "2026-03-14",
        }, headers=auth_headers)
        cycle_id = create.get_json()["cycle"]["id"]

        resp = client.put(f"/cycles/{cycle_id}", json={
            "startDate": "2026-03-14",
            "endDate": "2026-03-10",
        }, headers=auth_headers)
        assert resp.status_code == 400
        assert "endDate cannot be before startDate" in resp.get_json()["error"]

    def test_update_cycle_too_long(self, client, auth_headers):
        create = client.post("/add-cycle", json={
            "startDate": "2026-04-01",
            "endDate": "2026-04-05",
        }, headers=auth_headers)
        cycle_id = create.get_json()["cycle"]["id"]

        resp = client.put(f"/cycles/{cycle_id}", json={
            "startDate": "2026-04-01",
            "endDate": "2026-04-30",
        }, headers=auth_headers)
        assert resp.status_code == 400
        assert "14 days" in resp.get_json()["error"]

    # 🛠️ NEW TEST FOR ISSUE #117
    def test_update_cycle_future_date(self, client, auth_headers):
        create = client.post("/add-cycle", json={
            "startDate": "2026-04-01",
            "endDate": "2026-04-05",
        }, headers=auth_headers)
        cycle_id = create.get_json()["cycle"]["id"]

        resp = client.put(f"/cycles/{cycle_id}", json={
            "startDate": "2099-01-01",
            "endDate": "2099-01-05",
        }, headers=auth_headers)
        assert resp.status_code == 400

    def test_update_cycle_cross_user_denied(self, client):
        user_a_headers = {"Content-Type": "application/json", "X-User-Id": "user_a"}
        user_b_headers = {"Content-Type": "application/json", "X-User-Id": "user_b"}

        create = client.post("/add-cycle", json={
            "startDate": "2026-03-01",
            "endDate": "2026-03-05",
        }, headers=user_a_headers)
        assert create.status_code == 201
        cycle_id = create.get_json()["cycle"]["id"]

        resp = client.put(f"/cycles/{cycle_id}", json={
            "startDate": "2026-03-02",
            "endDate": "2026-03-06",
        }, headers=user_b_headers)
        assert resp.status_code in [403, 404]

        get_resp = client.get(f"/cycles/{cycle_id}", headers=user_a_headers)
        assert get_resp.status_code == 200
        assert get_resp.get_json()["cycle"]["startDate"] == "2026-03-01"


class TestDeleteCycle:
    """DELETE /cycles/:id"""

    def test_delete_cycle_success(self, client, auth_headers):
        create = client.post("/add-cycle", json={
            "startDate": "2026-05-01",
            "endDate": "2026-05-05",
        }, headers=auth_headers)
        cycle_id = create.get_json()["cycle"]["id"]

        resp = client.delete(f"/cycles/{cycle_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert "prediction" in resp.get_json()

    def test_delete_cycle_not_found(self, client, auth_headers):
        resp = client.delete("/cycles/nonexistent_id", headers=auth_headers)
        assert resp.status_code == 404

    def test_delete_cycle_removes_from_list(self, client, auth_headers):
        create = client.post("/add-cycle", json={
            "startDate": "2026-06-01",
            "endDate": "2026-06-05",
        }, headers=auth_headers)
        cycle_id = create.get_json()["cycle"]["id"]

        client.delete(f"/cycles/{cycle_id}", headers=auth_headers)
        cycles_resp = client.get("/cycles", headers=auth_headers)
        cycle_ids = [c["id"] for c in cycles_resp.get_json()["cycles"]]
        assert cycle_id not in cycle_ids

    def test_delete_cycle_cross_user_denied(self, client):
        user_a_headers = {"Content-Type": "application/json", "X-User-Id": "user_a"}
        user_b_headers = {"Content-Type": "application/json", "X-User-Id": "user_b"}

        create = client.post("/add-cycle", json={
            "startDate": "2026-05-01",
            "endDate": "2026-05-05",
        }, headers=user_a_headers)
        cycle_id = create.get_json()["cycle"]["id"]

        resp = client.delete(f"/cycles/{cycle_id}", headers=user_b_headers)
        assert resp.status_code in [403, 404]

        get_resp = client.get(f"/cycles/{cycle_id}", headers=user_a_headers)
        assert get_resp.status_code == 200
        assert get_resp.get_json()["cycle"]["id"] == cycle_id


class TestUpdateSymptom:
    """PUT /symptoms/:id"""

    def test_update_symptom_success(self, client, auth_headers):
        from app import mock_symptoms
        uid = "test_user_001"
        mock_symptoms[uid] = [{"id": "sym_1", "type": "Cramps", "severity": "Low", "date": "2026-05-20"}]

        resp = client.put("/symptoms/sym_1", json={
            "type": "Headache",
            "severity": "High",
            "date": "2026-05-21",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["symptom"]["type"] == "Headache"
        assert data["symptom"]["severity"] == "High"

    def test_update_symptom_not_found(self, client, auth_headers):
        resp = client.put("/symptoms/nonexistent_id", json={
            "type": "Headache",
            "severity": "High",
            "date": "2026-05-21",
        }, headers=auth_headers)
        assert resp.status_code == 404

    def test_update_symptom_missing_fields(self, client, auth_headers):
        resp = client.put("/symptoms/sym_1", json={
            "type": "Headache",
        }, headers=auth_headers)
        assert resp.status_code == 400

    # 🛠️ NEW TESTS FOR ISSUE #117
    def test_update_symptom_future_date(self, client, auth_headers):
        from app import mock_symptoms
        uid = "test_user_001"
        mock_symptoms[uid] = [{"id": "sym_fut_1", "type": "Cramps", "severity": "Low", "date": "2026-05-20"}]

        resp = client.put("/symptoms/sym_fut_1", json={
            "type": "Cramps",
            "severity": "Low",
            "date": "2099-01-01",
        }, headers=auth_headers)
        assert resp.status_code == 400

    def test_update_symptom_invalid_severity(self, client, auth_headers):
        from app import mock_symptoms
        uid = "test_user_001"
        mock_symptoms[uid] = [{"id": "sym_sev_1", "type": "Cramps", "severity": "Low", "date": "2026-05-20"}]

        resp = client.put("/symptoms/sym_sev_1", json={
            "type": "Cramps",
            "severity": "InvalidSeverity",
            "date": "2026-05-20",
        }, headers=auth_headers)
        assert resp.status_code == 400

    def test_update_symptom_cross_user_denied(self, client):
        from app import mock_symptoms
        user_b_headers = {"Content-Type": "application/json", "X-User-Id": "user_b"}
        mock_symptoms["user_a"] = [{"id": "sym_user_a", "type": "Cramps", "severity": "Low", "date": "2026-05-20"}]

        resp = client.put("/symptoms/sym_user_a", json={
            "type": "Headache",
            "severity": "High",
            "date": "2026-05-21",
        }, headers=user_b_headers)
        assert resp.status_code in [403, 404]

        assert mock_symptoms["user_a"][0]["type"] == "Cramps"
        assert mock_symptoms["user_a"][0]["severity"] == "Low"


class TestDeleteSymptom:
    """DELETE /symptoms/:id"""

    def test_delete_symptom_success(self, client, auth_headers):
        from app import mock_symptoms
        uid = "test_user_001"
        mock_symptoms[uid] = [{"id": "sym_del_1", "type": "Cramps", "severity": "Low", "date": "2026-05-20"}]

        resp = client.delete("/symptoms/sym_del_1", headers=auth_headers)
        assert resp.status_code == 200
        assert mock_symptoms[uid] == []

    def test_delete_symptom_not_found(self, client, auth_headers):
        resp = client.delete("/symptoms/nonexistent_id", headers=auth_headers)
        assert resp.status_code == 404

    def test_delete_symptom_cross_user_denied(self, client):
        from app import mock_symptoms
        user_b_headers = {"Content-Type": "application/json", "X-User-Id": "user_b"}
        mock_symptoms["user_a"] = [{"id": "sym_del_user_a", "type": "Fatigue", "severity": "Medium", "date": "2026-05-22"}]

        resp = client.delete("/symptoms/sym_del_user_a", headers=user_b_headers)
        assert resp.status_code in [403, 404]

        assert len(mock_symptoms["user_a"]) == 1
        assert mock_symptoms["user_a"][0]["id"] == "sym_del_user_a"
        resp = client.put(
            "/symptoms/sym_sev_1",
            json={
                "type": "Cramps",
                "severity": "Super Extreme",
                "date": "2026-05-20",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 400

"""Regression tests for API request payload validation."""


def test_signup_rejects_whitespace_and_invalid_email(client, json_headers):
    response = client.post("/signup", headers=json_headers, json={
        "name": "   ",
        "email": "not-an-email",
        "password": "secret1",
    })

    assert response.status_code == 400
    assert response.get_json()["fields"] == {
        "name": "Required",
        "email": "Must be a valid email address",
    }


def test_signup_rejects_out_of_range_cycle_values(client, json_headers):
    response = client.post("/signup", headers=json_headers, json={
        "name": "Priya",
        "email": "priya@example.com",
        "password": "secret1",
        "age": True,
        "cycleLength": 61,
    })

    assert response.status_code == 400
    assert response.get_json()["fields"] == {
        "age": "Must be a number",
        "cycleLength": "Must be at most 60",
    }


def test_cycle_rejects_invalid_optional_values(client, auth_headers):
    response = client.post("/add-cycle", headers=auth_headers, json={
        "startDate": "2026-06-01",
        "endDate": "2026-06-05",
        "flowIntensity": "very heavy",
        "symptoms": "cramps",
        "mood": "ecstatic",
    })

    assert response.status_code == 400
    assert set(response.get_json()["fields"]) == {"flowIntensity", "symptoms", "mood"}


def test_symptom_rejects_unknown_allowed_values(client, auth_headers):
    response = client.post("/add-symptom", headers=auth_headers, json={
        "type": "Other",
        "severity": "Extreme",
        "date": "2026-06-15",
    })

    assert response.status_code == 400
    assert set(response.get_json()["fields"]) == {"type", "severity"}


def test_chat_endpoints_require_non_empty_string_message(client, auth_headers):
    for endpoint in ("/chat", "/chat/stream"):
        response = client.post(endpoint, headers=auth_headers, json={"message": "   "})
        assert response.status_code == 400
        assert response.get_json()["fields"] == {"message": "Required"}


def test_validation_rejects_non_object_json(client, json_headers):
    response = client.post("/login", headers=json_headers, json=[])

    assert response.status_code == 400
    assert response.get_json()["fields"] == {"body": "Must be a JSON object"}

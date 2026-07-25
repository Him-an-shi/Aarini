"""Tests for prediction feedback and adaptive learning."""


class TestPredictionFeedback:
    """GET /prediction-feedback"""

    def test_feedback_insufficient_data(self, client):
        headers = {"Content-Type": "application/json", "X-User-Id": "fresh_user_insufficient"}
        resp = client.get("/prediction-feedback", headers=headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["hasEnoughData"] is False

    def test_feedback_with_cycles(self, client, auth_headers):
        cycles = [
            {"startDate": "2026-01-01", "endDate": "2026-01-05"},
            {"startDate": "2026-01-29", "endDate": "2026-02-02"},
            {"startDate": "2026-02-26", "endDate": "2026-03-02"},
            {"startDate": "2026-03-26", "endDate": "2026-03-30"},
        ]
        for cycle in cycles:
            client.post("/add-cycle", json=cycle, headers=auth_headers)

        resp = client.get("/prediction-feedback", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["hasEnoughData"] is True
        assert "accuracy" in data
        assert "recentErrors" in data
        assert isinstance(data["recentErrors"], list)


class TestPredictionFeedbackUnit:
    """Unit tests for prediction_feedback module."""

    def test_compute_errors_needs_3_cycles(self):
        from prediction_feedback import compute_prediction_errors
        cycles = [
            {"startDate": "2026-01-01", "endDate": "2026-01-05"},
            {"startDate": "2026-01-29", "endDate": "2026-02-02"},
        ]
        errors = compute_prediction_errors(cycles)
        assert errors == []

    def test_compute_errors_with_enough_data(self):
        from prediction_feedback import compute_prediction_errors
        cycles = [
            {"startDate": "2026-01-01", "endDate": "2026-01-05"},
            {"startDate": "2026-01-29", "endDate": "2026-02-02"},
            {"startDate": "2026-02-26", "endDate": "2026-03-02"},
            {"startDate": "2026-03-26", "endDate": "2026-03-30"},
        ]
        errors = compute_prediction_errors(cycles)
        assert len(errors) >= 1
        assert "errorDays" in errors[0]
        assert "accurate" in errors[0]

    def test_compute_bias_insufficient(self):
        from prediction_feedback import compute_bias
        errors = [{"errorDays": 1}]
        assert compute_bias(errors) is None

    def test_compute_bias_detects_pattern(self):
        from prediction_feedback import compute_bias
        errors = [
            {"errorDays": 2},
            {"errorDays": 3},
            {"errorDays": 2},
            {"errorDays": 1},
        ]
        bias = compute_bias(errors)
        assert bias is not None
        assert bias > 0

    def test_adaptive_correction(self):
        from prediction_feedback import get_adaptive_correction
        cycles = [
            {"startDate": "2026-01-01", "endDate": "2026-01-05"},
            {"startDate": "2026-01-29", "endDate": "2026-02-02"},
            {"startDate": "2026-02-26", "endDate": "2026-03-02"},
            {"startDate": "2026-03-26", "endDate": "2026-03-30"},
        ]
        result = get_adaptive_correction(cycles)
        if result:
            assert "bias" in result
            assert "correctionDays" in result
            assert "accuracy" in result

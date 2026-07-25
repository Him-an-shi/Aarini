import unittest

from cycle_prediction import normalize_cycles, predict_cycle, _std_deviation, _detect_irregularity


class CyclePredictionTests(unittest.TestCase):
    def test_regular_cycle_predicts_expected_dates_and_phase(self):
        cycles = [
            {"startDate": "2026-03-01", "endDate": "2026-03-05"},
            {"startDate": "2026-03-29", "endDate": "2026-04-02"},
            {"startDate": "2026-04-26", "endDate": "2026-04-30"},
        ]
        result = predict_cycle(cycles, today="2026-05-10")
        self.assertEqual(result["averageCycleLength"], 28)
        self.assertEqual(result["nextPeriodStart"], "2026-05-24")
        self.assertEqual(result["ovulationDate"], "2026-05-09")
        self.assertEqual(result["currentPhase"], "Ovulation")

    def test_recent_cycles_are_weighted_more_heavily(self):
        cycles = [
            {"startDate": "2026-01-01", "endDate": "2026-01-05"},
            {"startDate": "2026-01-27", "endDate": "2026-01-31"},
            {"startDate": "2026-02-24", "endDate": "2026-02-28"},
            {"startDate": "2026-03-26", "endDate": "2026-03-30"},
            {"startDate": "2026-04-27", "endDate": "2026-05-01"},
        ]
        result = predict_cycle(cycles, today="2026-05-10")
        self.assertEqual(result["averageCycleLength"], 30)
        self.assertEqual(result["nextPeriodStart"], "2026-05-27")

    def test_short_and_long_valid_cycles_are_supported(self):
        short = [
            {"startDate": "2026-01-01", "endDate": "2026-01-03"},
            {"startDate": "2026-01-22", "endDate": "2026-01-24"},
            {"startDate": "2026-02-12", "endDate": "2026-02-14"},
        ]
        long = [
            {"startDate": "2026-01-01", "endDate": "2026-01-07"},
            {"startDate": "2026-02-10", "endDate": "2026-02-16"},
            {"startDate": "2026-03-22", "endDate": "2026-03-28"},
        ]
        self.assertEqual(predict_cycle(short, today="2026-02-20")["averageCycleLength"], 21)
        self.assertEqual(predict_cycle(long, today="2026-04-01")["averageCycleLength"], 40)

    def test_invalid_entries_do_not_distort_predictions(self):
        cycles = [
            {"startDate": "not-a-date", "endDate": "2026-01-05"},
            {"startDate": "2026-02-01", "endDate": "2026-01-31"},
            {"startDate": "2026-03-01", "endDate": "2026-03-05"},
        ]
        self.assertEqual(len(normalize_cycles(cycles)), 1)
        self.assertEqual(
            predict_cycle(cycles, today="2026-03-12", fallback_cycle_length=27)["averageCycleLength"],
            27,
        )

    def test_confidence_window_present_in_response(self):
        cycles = [
            {"startDate": "2026-03-01", "endDate": "2026-03-05"},
            {"startDate": "2026-03-29", "endDate": "2026-04-02"},
            {"startDate": "2026-04-26", "endDate": "2026-04-30"},
        ]
        result = predict_cycle(cycles, today="2026-05-10")
        self.assertIn("confidenceWindow", result)
        window = result["confidenceWindow"]
        self.assertIn("earliest", window)
        self.assertIn("latest", window)
        self.assertIn("marginDays", window)
        self.assertGreaterEqual(window["marginDays"], 1)
        self.assertLess(window["earliest"], result["nextPeriodStart"])
        self.assertGreater(window["latest"], result["nextPeriodStart"])

    def test_confidence_window_wider_for_irregular_cycles(self):
        regular = [
            {"startDate": "2026-01-01", "endDate": "2026-01-05"},
            {"startDate": "2026-01-29", "endDate": "2026-02-02"},
            {"startDate": "2026-02-26", "endDate": "2026-03-02"},
        ]
        irregular = [
            {"startDate": "2026-01-01", "endDate": "2026-01-05"},
            {"startDate": "2026-01-22", "endDate": "2026-01-26"},
            {"startDate": "2026-02-25", "endDate": "2026-03-01"},
        ]
        regular_margin = predict_cycle(regular, today="2026-03-10")["confidenceWindow"]["marginDays"]
        irregular_margin = predict_cycle(irregular, today="2026-03-10")["confidenceWindow"]["marginDays"]
        self.assertGreater(irregular_margin, regular_margin)

    def test_irregularity_note_flagged_for_large_deviation(self):
        cycles = [
            {"startDate": "2026-01-01", "endDate": "2026-01-05"},
            {"startDate": "2026-01-29", "endDate": "2026-02-02"},
            {"startDate": "2026-02-26", "endDate": "2026-03-02"},
            {"startDate": "2026-04-15", "endDate": "2026-04-19"},
        ]
        result = predict_cycle(cycles, today="2026-04-25")
        self.assertIsNotNone(result["irregularityNote"])
        self.assertIn("longer", result["irregularityNote"])

    def test_no_irregularity_note_for_consistent_cycles(self):
        cycles = [
            {"startDate": "2026-01-01", "endDate": "2026-01-05"},
            {"startDate": "2026-01-29", "endDate": "2026-02-02"},
            {"startDate": "2026-02-26", "endDate": "2026-03-02"},
            {"startDate": "2026-03-26", "endDate": "2026-03-30"},
        ]
        result = predict_cycle(cycles, today="2026-04-05")
        self.assertIsNone(result["irregularityNote"])

    def test_std_deviation_calculation(self):
        self.assertAlmostEqual(_std_deviation([28, 28, 28]), 0.0)
        self.assertGreater(_std_deviation([21, 28, 35]), 0)

    def test_detect_irregularity_threshold(self):
        self.assertIsNone(_detect_irregularity([28, 29, 27]))
        self.assertIsNotNone(_detect_irregularity([28, 28, 40]))
        self.assertIn("longer", _detect_irregularity([28, 28, 40]))
        self.assertIsNotNone(_detect_irregularity([28, 28, 16]))
        self.assertIn("shorter", _detect_irregularity([28, 28, 16]))
        
    def test_empty_cycle_list_handled_gracefully(self):
        result = predict_cycle([], today="2026-05-10", fallback_cycle_length=28)
        self.assertEqual(result["averageCycleLength"], 28)

    def test_single_cycle_std_deviation_does_not_crash(self):
        value = _std_deviation([28])
        self.assertEqual(value, 0.0)
        self.assertIsInstance(value, float)

    def test_overlapping_cycles_are_removed(self):
        cycles = [
            {"startDate": "2026-01-01", "endDate": "2026-01-05"},
            {"startDate": "2026-01-04", "endDate": "2026-01-08"},
            {"startDate": "2026-02-01", "endDate": "2026-02-05"},
        ]
        valid_cycles = normalize_cycles(cycles)
        self.assertEqual(len(valid_cycles), 2)

    # 🛠️ NEW TESTS FOR VETERAN ISSUE
    
    def test_predict_cycle_with_single_logged_cycle_prevents_zero_division(self):
        """A single cycle means 0 intervals to average. This ensures predict_cycle doesn't throw a ZeroDivisionError."""
        cycles = [{"startDate": "2026-05-01", "endDate": "2026-05-05"}]
        result = predict_cycle(cycles, today="2026-05-10", fallback_cycle_length=28)
        
        self.assertEqual(result["averageCycleLength"], 28)
        self.assertIsNotNone(result["nextPeriodStart"])
        self.assertEqual(result["nextPeriodStart"], "2026-05-29") # May 1st + 28 days

    def test_predict_cycle_with_zero_logged_cycles_prevents_zero_division(self):
        """Zero cycles means the user is brand new. This ensures the prediction pipeline survives entirely on fallbacks."""
        result = predict_cycle([], today="2026-05-10", fallback_cycle_length=28)
        
        self.assertEqual(result["averageCycleLength"], 28)
        self.assertIsNotNone(result["nextPeriodStart"])
        self.assertEqual(result["nextPeriodStart"], "2026-06-07") # May 10th + 28 days


class ConfidenceIntervalTests(unittest.TestCase):
    """Tests for bootstrap confidence intervals and confidence scoring."""

    def test_regular_cycles_produce_narrow_intervals(self):
        """Regular 28-day cycles should produce tight CIs with high confidence."""
        cycles = [
            {"startDate": "2026-01-01", "endDate": "2026-01-05"},
            {"startDate": "2026-01-29", "endDate": "2026-02-02"},
            {"startDate": "2026-02-26", "endDate": "2026-03-02"},
            {"startDate": "2026-03-26", "endDate": "2026-03-30"},
            {"startDate": "2026-04-23", "endDate": "2026-04-27"},
            {"startDate": "2026-05-21", "endDate": "2026-05-25"},
        ]
        result = predict_cycle(cycles, today="2026-06-01")

        self.assertIn("predictionIntervals", result)
        intervals = result["predictionIntervals"]

        self.assertIn("ci_80", intervals)
        self.assertIn("ci_95", intervals)
        self.assertIn("confidence_score", intervals)
        self.assertEqual(intervals["method"], "bootstrap")
        self.assertGreater(intervals["confidence_score"], 0.5)

    def test_irregular_cycles_produce_wide_intervals(self):
        """Highly variable cycles should produce wider CIs with lower confidence."""
        cycles = [
            {"startDate": "2026-01-01", "endDate": "2026-01-05"},
            {"startDate": "2026-01-22", "endDate": "2026-01-26"},  # 21 days
            {"startDate": "2026-02-25", "endDate": "2026-03-01"},  # 34 days
            {"startDate": "2026-03-15", "endDate": "2026-03-19"},  # 18 days
            {"startDate": "2026-04-20", "endDate": "2026-04-24"},  # 36 days
        ]
        result = predict_cycle(cycles, today="2026-05-01")

        intervals = result["predictionIntervals"]
        self.assertIn("ci_95", intervals)
        # Irregular cycles should have lower confidence
        self.assertLess(intervals["confidence_score"], 0.7)

    def test_minimal_data_uses_default_wide_intervals(self):
        """With only 1-2 cycles, should fall back to wide default intervals."""
        cycles = [
            {"startDate": "2026-01-01", "endDate": "2026-01-05"},
            {"startDate": "2026-01-29", "endDate": "2026-02-02"},
        ]
        result = predict_cycle(cycles, today="2026-02-15")

        intervals = result["predictionIntervals"]
        self.assertEqual(intervals["method"], "default_wide")
        self.assertEqual(intervals["ci_80"]["margin_days"], 5)
        self.assertEqual(intervals["ci_95"]["margin_days"], 10)
        self.assertLess(intervals["confidence_score"], 0.4)

    def test_empty_cycles_no_intervals(self):
        """No cycle history should not include predictionIntervals."""
        result = predict_cycle([], today="2026-05-01")
        self.assertNotIn("predictionIntervals", result)
        self.assertFalse(result["hasHistory"])

    def test_confidence_score_increases_with_more_data(self):
        """More regular cycles should produce higher confidence scores."""
        base_cycles = [
            {"startDate": "2026-01-01", "endDate": "2026-01-05"},
            {"startDate": "2026-01-29", "endDate": "2026-02-02"},
            {"startDate": "2026-02-26", "endDate": "2026-03-02"},
        ]
        result_3 = predict_cycle(base_cycles, today="2026-03-15")

        more_cycles = base_cycles + [
            {"startDate": "2026-03-26", "endDate": "2026-03-30"},
            {"startDate": "2026-04-23", "endDate": "2026-04-27"},
            {"startDate": "2026-05-21", "endDate": "2026-05-25"},
            {"startDate": "2026-06-18", "endDate": "2026-06-22"},
            {"startDate": "2026-07-16", "endDate": "2026-07-20"},
        ]
        result_8 = predict_cycle(more_cycles, today="2026-08-01")

        score_3 = result_3["predictionIntervals"]["confidence_score"]
        score_8 = result_8["predictionIntervals"]["confidence_score"]
        self.assertGreater(score_8, score_3)

    def test_confidence_score_range(self):
        """Confidence score should always be between 0 and 1."""
        cycles = [
            {"startDate": "2026-01-01", "endDate": "2026-01-05"},
            {"startDate": "2026-01-29", "endDate": "2026-02-02"},
            {"startDate": "2026-02-26", "endDate": "2026-03-02"},
            {"startDate": "2026-03-26", "endDate": "2026-03-30"},
        ]
        result = predict_cycle(cycles, today="2026-04-10")
        score = result["predictionIntervals"]["confidence_score"]
        self.assertGreaterEqual(score, 0.0)
        self.assertLessEqual(score, 1.0)

    def test_bootstrap_deterministic_with_seed(self):
        """Bootstrap with fixed seed should produce identical results."""
        from cycle_prediction import _bootstrap_resample
        values = [28, 29, 27, 28, 30, 28]
        result1 = _bootstrap_resample(values, seed=42)
        result2 = _bootstrap_resample(values, seed=42)
        self.assertEqual(result1, result2)

    def test_ci_bounds_surround_point_estimate(self):
        """The 80% CI should be contained within the 95% CI."""
        cycles = [
            {"startDate": "2026-01-01", "endDate": "2026-01-05"},
            {"startDate": "2026-01-29", "endDate": "2026-02-02"},
            {"startDate": "2026-02-26", "endDate": "2026-03-02"},
            {"startDate": "2026-03-26", "endDate": "2026-03-30"},
            {"startDate": "2026-04-23", "endDate": "2026-04-27"},
        ]
        result = predict_cycle(cycles, today="2026-05-10")
        intervals = result["predictionIntervals"]

        ci_80_lower = intervals["ci_80"]["lower"]
        ci_80_upper = intervals["ci_80"]["upper"]
        ci_95_lower = intervals["ci_95"]["lower"]
        ci_95_upper = intervals["ci_95"]["upper"]

        # 95% CI should be wider than or equal to 80% CI
        self.assertLessEqual(ci_95_lower, ci_80_lower)
        self.assertGreaterEqual(ci_95_upper, ci_80_upper)

    def test_n_cycles_reported_correctly(self):
        """The intervals should report the correct number of cycles used."""
        cycles = [
            {"startDate": "2026-01-01", "endDate": "2026-01-05"},
            {"startDate": "2026-01-29", "endDate": "2026-02-02"},
            {"startDate": "2026-02-26", "endDate": "2026-03-02"},
            {"startDate": "2026-03-26", "endDate": "2026-03-30"},
        ]
        result = predict_cycle(cycles, today="2026-04-10")
        # 4 cycles = 3 intervals
        self.assertEqual(result["predictionIntervals"]["n_cycles"], 3)


if __name__ == "__main__":
    unittest.main()

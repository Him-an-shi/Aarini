from datetime import date, datetime, timedelta
from statistics import median
import math
import random


DEFAULT_CYCLE_LENGTH = 28
DEFAULT_PERIOD_LENGTH = 5
MIN_CYCLE_LENGTH = 15
MAX_CYCLE_LENGTH = 60
MIN_PERIOD_LENGTH = 1
MAX_PERIOD_LENGTH = 14

BOOTSTRAP_ITERATIONS = 1000
CI_LEVELS = {"80": 0.80, "95": 0.95}


def parse_date(value):
    if isinstance(value, date):
        return value
    if not isinstance(value, str):
        raise ValueError("Date must use YYYY-MM-DD format")
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError("Date must use YYYY-MM-DD format") from exc


def _clamp(value, lower, upper):
    return max(lower, min(upper, value))


def normalize_cycles(cycles):
    if not cycles:
        return []
        
    normalized = []
    for cycle in cycles:
        try:
            start = parse_date(cycle.get("startDate"))
            end = parse_date(cycle.get("endDate")) if cycle.get("endDate") else None
        except (TypeError, ValueError, AttributeError):
            continue
        if end and end < start:
            continue
        normalized.append({"start": start, "end": end})
        
    sorted_cycles = sorted(normalized, key=lambda cycle: cycle["start"])
    
    # 🛠️ FIX: Robust overlap detection and merging
    valid_cycles = []
    for cycle in sorted_cycles:
        if not valid_cycles:
            valid_cycles.append(cycle)
            continue
            
        prev = valid_cycles[-1]
        
        # Check 1: Does it start on or before the previous cycle actually ended?
        overlaps_end_date = prev["end"] and cycle["start"] <= prev["end"]
        
        # Check 2: Does it start impossibly soon after the previous cycle began?
        # (It is biologically impossible to start a new cycle within MIN_CYCLE_LENGTH)
        overlaps_start_date = (cycle["start"] - prev["start"]).days < MIN_CYCLE_LENGTH
        
        if overlaps_end_date or overlaps_start_date:
            # If they overlap, gracefully merge the end dates so we don't lose data
            if cycle["end"]:
                if not prev["end"] or cycle["end"] > prev["end"]:
                    prev["end"] = cycle["end"]
            continue
            
        valid_cycles.append(cycle)
        
    return valid_cycles


def _weighted_average(values):
    if not values:
        return None
    recent = values[-6:]
    weights = list(range(1, len(recent) + 1))
    return round(sum(value * weight for value, weight in zip(recent, weights)) / sum(weights))


def _std_deviation(values):
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
    return math.sqrt(variance)


def _detect_irregularity(values, threshold=7):
    if len(values) < 3:
        return None
    mean = sum(values) / len(values)
    latest = values[-1]
    deviation = abs(latest - mean)
    if deviation > threshold:
        direction = "longer" if latest > mean else "shorter"
        return f"Your most recent cycle was {int(deviation)} days {direction} than your average. Consider tracking this with your healthcare provider if the pattern continues."
    return None


def _bootstrap_resample(values, n_iterations=BOOTSTRAP_ITERATIONS, seed=None):
    """Generate bootstrap resamples of the weighted average cycle length.

    Uses bias-corrected percentile method for more accurate intervals
    when the underlying distribution is skewed (common for cycle lengths).
    """
    if not values or len(values) < 2:
        return []

    rng = random.Random(seed)
    n = len(values)
    estimates = []

    for _ in range(n_iterations):
        sample = [rng.choice(values) for _ in range(n)]
        estimate = _weighted_average(sample)
        if estimate is not None:
            estimates.append(estimate)

    estimates.sort()
    return estimates


def _compute_confidence_interval(bootstrap_estimates, level=0.95):
    """Compute confidence interval from bootstrap distribution.

    Uses the percentile method with bias correction for asymmetric distributions.
    Returns (lower, upper) bounds as number of days.
    """
    if not bootstrap_estimates:
        return None, None

    n = len(bootstrap_estimates)
    alpha = 1.0 - level
    lower_idx = max(0, int(math.floor((alpha / 2) * n)))
    upper_idx = min(n - 1, int(math.ceil((1 - alpha / 2) * n)) - 1)

    return bootstrap_estimates[lower_idx], bootstrap_estimates[upper_idx]


def _compute_confidence_score(valid_intervals, all_intervals):
    """Compute a 0-1 confidence score reflecting prediction reliability.

    Factors:
    - Sample size: more cycles = more confidence (logarithmic scaling)
    - Regularity: lower coefficient of variation = more confidence
    - Data recency: penalize if latest intervals are more variable than historical
    """
    if not valid_intervals:
        return 0.0

    n = len(valid_intervals)

    # Factor 1: Sample size (logarithmic, saturates around 12 cycles)
    size_score = min(1.0, math.log(n + 1) / math.log(13))

    # Factor 2: Regularity (coefficient of variation)
    mean_len = sum(valid_intervals) / n
    if mean_len == 0:
        return 0.0
    std = _std_deviation(valid_intervals)
    cv = std / mean_len
    regularity_score = max(0.0, 1.0 - (cv / 0.3))

    # Factor 3: Recency consistency (last 3 vs all)
    if n >= 4:
        recent = valid_intervals[-3:]
        recent_std = _std_deviation(recent) if len(recent) >= 2 else 0
        recency_score = max(0.0, 1.0 - (recent_std / max(std, 1.0)))
    else:
        recency_score = 0.5

    # Weighted combination
    score = (0.4 * size_score) + (0.4 * regularity_score) + (0.2 * recency_score)
    return round(min(1.0, max(0.0, score)), 3)


def _build_prediction_intervals(valid_intervals, next_period_date, average_cycle):
    """Build confidence intervals for the predicted next period date.

    Returns a dict with 80% and 95% intervals as date ranges,
    plus a numeric confidence score.
    """
    if len(valid_intervals) < 2:
        # Insufficient data: return wide default intervals
        margin_80 = 5
        margin_95 = 10
        return {
            "ci_80": {
                "lower": (next_period_date - timedelta(days=margin_80)).isoformat(),
                "upper": (next_period_date + timedelta(days=margin_80)).isoformat(),
                "margin_days": margin_80,
            },
            "ci_95": {
                "lower": (next_period_date - timedelta(days=margin_95)).isoformat(),
                "upper": (next_period_date + timedelta(days=margin_95)).isoformat(),
                "margin_days": margin_95,
            },
            "confidence_score": _compute_confidence_score(valid_intervals, valid_intervals),
            "method": "default_wide",
            "n_cycles": len(valid_intervals),
        }

    # Bootstrap the weighted average cycle length
    bootstrap_estimates = _bootstrap_resample(valid_intervals, seed=42)

    if not bootstrap_estimates:
        std = _std_deviation(valid_intervals)
        margin = max(1, round(std))
        return {
            "ci_80": {
                "lower": (next_period_date - timedelta(days=margin)).isoformat(),
                "upper": (next_period_date + timedelta(days=margin)).isoformat(),
                "margin_days": margin,
            },
            "ci_95": {
                "lower": (next_period_date - timedelta(days=margin * 2)).isoformat(),
                "upper": (next_period_date + timedelta(days=margin * 2)).isoformat(),
                "margin_days": margin * 2,
            },
            "confidence_score": _compute_confidence_score(valid_intervals, valid_intervals),
            "method": "std_fallback",
            "n_cycles": len(valid_intervals),
        }

    # Compute intervals at both levels
    result = {
        "confidence_score": _compute_confidence_score(valid_intervals, valid_intervals),
        "method": "bootstrap",
        "n_iterations": BOOTSTRAP_ITERATIONS,
        "n_cycles": len(valid_intervals),
    }

    for label, level in CI_LEVELS.items():
        lower_len, upper_len = _compute_confidence_interval(bootstrap_estimates, level)

        if lower_len is None or upper_len is None:
            margin = max(1, round(_std_deviation(valid_intervals)))
            lower_len = average_cycle - margin
            upper_len = average_cycle + margin

        # Convert cycle length bounds to date bounds relative to latest start
        lower_diff = average_cycle - lower_len
        upper_diff = upper_len - average_cycle

        # Ensure asymmetric intervals for irregular cycles
        margin_lower = max(1, abs(round(lower_diff)))
        margin_upper = max(1, abs(round(upper_diff)))

        result[f"ci_{label}"] = {
            "lower": (next_period_date - timedelta(days=margin_lower)).isoformat(),
            "upper": (next_period_date + timedelta(days=margin_upper)).isoformat(),
            "margin_days_lower": margin_lower,
            "margin_days_upper": margin_upper,
        }

    return result


def predict_cycle(cycles, today=None, fallback_cycle_length=DEFAULT_CYCLE_LENGTH):
    today = parse_date(today or date.today())
    normalized = normalize_cycles(cycles)
    fallback = _clamp(int(fallback_cycle_length or DEFAULT_CYCLE_LENGTH), MIN_CYCLE_LENGTH, MAX_CYCLE_LENGTH)

    if not normalized:
        return {
            "hasHistory": False,
            "averageCycleLength": fallback,
            "averagePeriodLength": DEFAULT_PERIOD_LENGTH,
            "currentPhase": None,
            "cycleDay": None,
            "nextPeriodStart": None,
            "nextPeriodEnd": None,
            "ovulationDate": None,
            "ovulationWindowStart": None,
            "ovulationWindowEnd": None,
            "confidence": "low",
        }

    intervals = [
        (normalized[index]["start"] - normalized[index - 1]["start"]).days
        for index in range(1, len(normalized))
    ]
    valid_intervals = [
        value for value in intervals if MIN_CYCLE_LENGTH <= value <= MAX_CYCLE_LENGTH
    ]
    average_cycle = _weighted_average(valid_intervals) or fallback

    period_lengths = [
        (cycle["end"] - cycle["start"]).days + 1
        for cycle in normalized
        if cycle["end"]
    ]
    valid_period_lengths = [
        value for value in period_lengths if MIN_PERIOD_LENGTH <= value <= MAX_PERIOD_LENGTH
    ]
    average_period = round(median(valid_period_lengths)) if valid_period_lengths else DEFAULT_PERIOD_LENGTH

    latest_start = normalized[-1]["start"]
    next_period = latest_start + timedelta(days=average_cycle)
    while next_period <= today:
        next_period += timedelta(days=average_cycle)

    active_cycle_start = next_period - timedelta(days=average_cycle)
    cycle_day = (today - active_cycle_start).days + 1
    ovulation_day_number = max(average_period + 2, average_cycle - 14)
    ovulation_date = active_cycle_start + timedelta(days=ovulation_day_number - 1)
    window_start = ovulation_date - timedelta(days=5)
    window_end = ovulation_date + timedelta(days=1)

    if cycle_day <= average_period:
        current_phase = "Menstrual"
    elif today < window_start:
        current_phase = "Follicular"
    elif today <= window_end:
        current_phase = "Ovulation"
    else:
        current_phase = "Luteal"

    confidence = "high" if len(valid_intervals) >= 3 else "medium" if valid_intervals else "low"

    std_dev = _std_deviation(valid_intervals) if len(valid_intervals) >= 2 else 0
    margin_days = max(1, round(std_dev))
    confidence_earliest = (next_period - timedelta(days=margin_days)).isoformat()
    confidence_latest = (next_period + timedelta(days=margin_days)).isoformat()
    irregularity_note = _detect_irregularity(valid_intervals)

    # Build bootstrap-based prediction intervals
    prediction_intervals = _build_prediction_intervals(
        valid_intervals, next_period, average_cycle
    )

    return {
        "hasHistory": True,
        "averageCycleLength": average_cycle,
        "averagePeriodLength": average_period,
        "currentPhase": current_phase,
        "cycleDay": cycle_day,
        "currentCycleStart": active_cycle_start.isoformat(),
        "nextPeriodStart": next_period.isoformat(),
        "nextPeriodEnd": (next_period + timedelta(days=average_period - 1)).isoformat(),
        "confidenceWindow": {
            "earliest": confidence_earliest,
            "latest": confidence_latest,
            "marginDays": margin_days,
        },
        "predictionIntervals": prediction_intervals,
        "ovulationDate": ovulation_date.isoformat(),
        "ovulationWindowStart": window_start.isoformat(),
        "ovulationWindowEnd": window_end.isoformat(),
        "confidence": confidence,
        "confidenceScore": prediction_intervals["confidence_score"],
        "irregularityNote": irregularity_note,
    }

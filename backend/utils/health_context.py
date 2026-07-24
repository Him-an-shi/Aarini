"""
Health context builder for AI chat personalization.

Fetches the user's recent health data (cycles, symptoms, moods) and formats
it as a structured context string for injection into the Gemini system prompt.
"""

import logging
import threading

logger = logging.getLogger(__name__)

_context_cache = {}
_cache_lock = threading.Lock()
CACHE_TTL_SECONDS = 300
MAX_CACHE_SIZE = 1000


def _cleanup_cache():
    """Enforce MAX_CACHE_SIZE to prevent memory leaks."""
    while len(_context_cache) >= MAX_CACHE_SIZE:
        # Pop the oldest item (first in insertion order)
        _context_cache.pop(next(iter(_context_cache)), None)


def build_health_context(uid, db=None, firebase_initialized=False):
    """
    Build a personalized health context string for the given user.

    Returns a string summarizing the user's current cycle phase, recent symptoms,
    and mood entries. Returns empty string if no data is available.
    """
    with _cache_lock:
        cached = _context_cache.get(uid)
        if cached and (time.time() - cached["ts"]) < CACHE_TTL_SECONDS:
            # Re-insert to maintain LRU order
            _context_cache.pop(uid, None)
            _context_cache[uid] = cached
            return cached["context"]

    context_parts = []

    if not firebase_initialized or not db:
        context_parts.append(_build_mock_context())
    else:
        try:
            context_parts.append(_build_cycle_context(uid, db))
            context_parts.append(_build_symptom_context(uid, db))
            context_parts.append(_build_mood_context(uid, db))
        except Exception as e:
            logger.warning(f"Failed to build health context for {uid}: {e}")
            return ""

    context = "\n".join(part for part in context_parts if part)

    with _cache_lock:
        _cleanup_cache()
        
        # Remove existing key if present so it moves to the end (maintaining LRU-ish order)
        _context_cache.pop(uid, None)
        _context_cache[uid] = {"context": context, "ts": time.time()}
        
    return context


def _build_cycle_context(uid, db):
    """Fetch recent cycles and compute current phase info."""
    from firebase_admin import firestore as fs_module
    cycles_ref = (
        db.collection("users").document(uid)
        .collection("cycles")
        .order_by("startDate", direction=fs_module.Query.DESCENDING)
        .limit(6)
    )
    docs = list(cycles_ref.stream())
    if not docs:
        return ""

    cycles = [doc.to_dict() for doc in docs]
    latest = cycles[0]

    from cycle_prediction import parse_date, predict_cycle
    prediction = predict_cycle(cycles)

    parts = [f"User's cycle data: Last period started {latest.get('startDate', 'unknown')}."]

    if isinstance(prediction, dict):
        if prediction.get("nextPeriodStart"):
            parts.append(f"Next period predicted: {prediction['nextPeriodStart']}.")
        if prediction.get("currentPhase"):
            parts.append(f"Current phase: {prediction['currentPhase']}.")
        if prediction.get("cycleDay"):
            parts.append(f"Cycle day: {prediction['cycleDay']}.")
        if prediction.get("averageCycleLength"):
            parts.append(f"Average cycle length: {prediction['averageCycleLength']} days.")

    return " ".join(parts)


def _build_symptom_context(uid, db):
    """Fetch recent symptoms (last 7 days)."""
    from datetime import date, timedelta
    from firebase_admin import firestore as fs_module
    cutoff = (date.today() - timedelta(days=7)).isoformat()

    symptoms_ref = (
        db.collection("users").document(uid)
        .collection("symptoms")
        .order_by("date", direction=fs_module.Query.DESCENDING)
        .limit(10)
    )
    docs = list(symptoms_ref.stream())
    recent = [doc.to_dict() for doc in docs if doc.to_dict().get("date", "") >= cutoff]

    if not recent:
        return ""

    symptom_list = []
    for entry in recent:
        s_type = entry.get("type", "")
        if s_type:
            symptom_list.append(f"{s_type} ({entry.get('severity', 'unknown')} severity, {entry.get('date', '')})")

    if not symptom_list:
        return ""

    return f"Recent symptoms (last 7 days): {'; '.join(symptom_list[:5])}."


def _build_mood_context(uid, db):
    """Fetch recent mood entries (last 3 days)."""
    from datetime import date, timedelta
    from firebase_admin import firestore as fs_module
    cutoff = (date.today() - timedelta(days=3)).isoformat()

    moods_ref = (
        db.collection("users").document(uid)
        .collection("moods")
        .order_by("date", direction=fs_module.Query.DESCENDING)
        .limit(5)
    )

    try:
        docs = list(moods_ref.stream())
    except Exception:
        return ""

    recent = [doc.to_dict() for doc in docs if doc.to_dict().get("date", "") >= cutoff]
    if not recent:
        return ""

    mood_entries = [f"{m.get('mood', 'unknown')} on {m.get('date', '')}" for m in recent]
    return f"Recent moods: {', '.join(mood_entries)}."


def _build_mock_context():
    """Provide a sample context for development/mock mode."""
    return (
        "User's cycle data: Average cycle length 28 days. "
        "Current phase: Luteal. Cycle day: 22. "
        "Next period predicted in approximately 6 days. "
        "Recent symptoms: mild cramps (low severity), fatigue (medium severity). "
        "Recent moods: okay, low."
    )


def invalidate_cache(uid=None):
    """Clear cached context for a user, or all users if uid is None."""
    with _cache_lock:
        if uid:
            _context_cache.pop(uid, None)
        else:
            _context_cache.clear()

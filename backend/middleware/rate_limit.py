"""
Rate limiting middleware for Aarini backend.

Uses flask-limiter with in-memory storage. Limits are per-IP for
unauthenticated endpoints and per-user (via X-User-Id header or
request.user_id) for authenticated endpoints.

In test mode (FLASK_ENV=testing or TESTING=True), all limits are
disabled so that test suites run without interference.
"""

import os
from flask import request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address


def _get_key():
    """
    Key function for rate limiting.
    Uses X-User-Id header (set by authenticated_user decorator in mock mode)
    or falls back to remote IP address.
    """
    user_id = getattr(request, "user_id", None)
    if user_id:
        return f"user:{user_id}"
    header_id = request.headers.get("X-User-Id")
    if header_id:
        return f"user:{header_id}"
    return f"ip:{get_remote_address()}"


def _is_testing():
    return os.environ.get("FLASK_ENV") == "testing"


limiter = Limiter(
    key_func=_get_key,
    default_limits=["60 per minute"],
    storage_uri="memory://",
    enabled=not _is_testing(),
)


RATE_LIMITS = {
    "signup": "5 per hour",
    "login": "10 per minute",
    "chat": "20 per minute",
    "chat_stream": "20 per minute",
    "add_cycle": "30 per minute",
    "add_symptom": "30 per minute",
    "add_mood": "30 per minute",
    "delete_account": "3 per hour",
    "share_create": "10 per hour",
}


def rate_limit_exceeded_handler(e):
    """Custom 429 response with Retry-After header."""
    desc = str(e.description or "")
    if "second" in desc:
        retry_after = 1
    elif "minute" in desc:
        retry_after = 60
    elif "hour" in desc:
        retry_after = 3600
    else:
        retry_after = 60

    response = jsonify({
        "error": "Too many requests. Please slow down.",
        "retry_after": retry_after,
    })
    response.status_code = 429
    response.headers["Retry-After"] = str(retry_after)
    return response


def init_limiter(app):
    """
    Initialize the rate limiter on the Flask app.
    Disables limiting entirely when app is in testing mode.
    """
    if app.config.get("TESTING"):
        limiter.enabled = False

    limiter.init_app(app)
    app.errorhandler(429)(rate_limit_exceeded_handler)

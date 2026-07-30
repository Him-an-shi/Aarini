"""
Rate limiting middleware for Aarini backend.

Uses flask-limiter with in-memory storage. Limits are per-IP for
unauthenticated endpoints and per-user (via request.user_id) for 
authenticated endpoints.

In test mode (FLASK_ENV=testing or TESTING=True), all limits are
disabled so that test suites run without interference.
"""

import os
from flask import request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from utils.errors import RateLimitError


def _get_key():
    """
    Key function for rate limiting.
    Securely relies on server-verified JWT context or falls back to remote IP address.
    Eliminated the vulnerable client-spoofable X-User-Id header check.
    """
    user_id = getattr(request, "user_id", None)
    if user_id:
        return f"user:{user_id}"
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
    """Custom 429 response using RateLimitError with Retry-After header."""
    desc = str(getattr(e, "description", "") or "")
    if "second" in desc:
        retry_after = 1
    elif "minute" in desc:
        retry_after = 60
    elif "hour" in desc:
        retry_after = 3600
    else:
        retry_after = 60

    err = RateLimitError(payload={"retry_after": retry_after})
    data = err.to_dict()
    data["retry_after"] = retry_after

    response = jsonify(data)
    response.status_code = err.status_code
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
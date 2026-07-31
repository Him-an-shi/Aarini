"""Schema-based request validation middleware for Flask endpoints."""

import math
import re
from datetime import datetime
from functools import wraps

from flask import jsonify, request


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _check_field(value, rules, _field_name):
    """Validate a single field against its rules. Returns an error or ``None``."""
    field_type = rules.get("type", "string")

    if value is None or (isinstance(value, str) and not value.strip()):
        if rules.get("required", False):
            return "Required"
        return None

    if field_type == "string":
        if not isinstance(value, str):
            return "Must be a string"
        min_len = rules.get("min_length")
        max_len = rules.get("max_length")
        if min_len is not None and len(value) < min_len:
            return f"Must be at least {min_len} characters"
        if max_len is not None and len(value) > max_len:
            return f"Must be at most {max_len} characters"

    elif field_type == "date":
        if not isinstance(value, str):
            return "Must be a valid calendar date (YYYY-MM-DD)"
        try:
            datetime.strptime(value, "%Y-%m-%d")
        except ValueError:
            return "Must be a valid calendar date (YYYY-MM-DD)"

    elif field_type == "email":
        if not isinstance(value, str) or not EMAIL_RE.match(value):
            return "Must be a valid email address"

    elif field_type == "number":
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return "Must be a number"
        if not math.isfinite(value):
            return "Must be a finite number"
        if rules.get("integer") and not isinstance(value, int):
            return "Must be an integer"
        min_val = rules.get("min")
        max_val = rules.get("max")
        if min_val is not None and value < min_val:
            return f"Must be at least {min_val}"
        if max_val is not None and value > max_val:
            return f"Must be at most {max_val}"

    elif field_type == "array" and not isinstance(value, list):
        return "Must be an array"

    allowed_values = rules.get("allowed")
    if allowed_values is not None:
        comparable_value = (
            value.lower()
            if rules.get("case_insensitive") and isinstance(value, str)
            else value
        )
        comparable_allowed = (
            {item.lower() for item in allowed_values}
            if rules.get("case_insensitive")
            else set(allowed_values)
        )
        if comparable_value not in comparable_allowed:
            return f"Must be one of: {', '.join(allowed_values)}"

    return None


def validate_request(schema):
    """Validate a request JSON body against a schema before a handler runs."""

    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            body = request.get_json(silent=True)
            if body is None:
                body = {}
            elif not isinstance(body, dict):
                return (
                    jsonify(
                        {
                            "error": "Validation failed",
                            "fields": {"body": "Must be a JSON object"},
                        }
                    ),
                    400,
                )

            errors = {}
            for field_name, rules in schema.items():
                error = _check_field(body.get(field_name), rules, field_name)
                if error:
                    errors[field_name] = error

            if errors:
                return jsonify({"error": "Validation failed", "fields": errors}), 400

            return f(*args, **kwargs)

        return wrapped

    return decorator

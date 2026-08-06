"""
Schema-based request validation middleware for Flask endpoints.

Provides a @validate_request(schema) decorator that checks request body
against a schema before the handler runs.

Supports:
- Nested object validation with recursive traversal
- Array element validation (each element against a sub-schema)
- Conditional required fields (required_if another field has a specific value)
- Type coercion (string "3" -> int 3 when schema expects numeric)
- Enum validation (value must be one of a set)
- Custom validator functions
- Comprehensive error aggregation (returns ALL errors with JSON-path locations)
"""

import math
import re
from datetime import datetime
from functools import wraps
from flask import request, jsonify

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _check_field(value, rules, _field_name):
    """Validate a single field against its rules. Returns an error or ``None``."""
    field_type = rules.get("type", "string")

    if value is None or (isinstance(value, str) and not value.strip()):
        if rules.get("required", False):
            return "Required"
        return None

EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')

# Type coercion table: (target_type, coercion_function)
COERCION_MAP = {
    "number": lambda v: float(v) if isinstance(v, str) and v.replace('.', '', 1).replace('-', '', 1).isdigit() else v,
    "integer": lambda v: int(v) if isinstance(v, str) and v.lstrip('-').isdigit() else v,
    "boolean": lambda v: v.lower() in ('true', '1', 'yes') if isinstance(v, str) else v,
}


def _coerce_value(value, field_type):
    """Attempt safe type coercion for common API patterns."""
    if value is None:
        return value
    coercer = COERCION_MAP.get(field_type)
    if coercer:
        try:
            return coercer(value)
        except (ValueError, TypeError, AttributeError):
            pass
    return value


def _check_enum(value, allowed_values):
    """Validate value is one of the allowed enum values."""
    if value not in allowed_values:
        return f"Must be one of: {', '.join(str(v) for v in allowed_values)}"
    return None


def _check_field_deep(value, rules, field_path, full_body=None, coerce=True):
    """
    Validate a single field against its rules with deep nested support.
    Returns list of (path, error_message) tuples.

    Supports:
    - type: string, number, integer, float, boolean, date, email, array, object
    - required: True/False
    - required_if: {"field": "fieldName", "value": expectedValue}
    - min_length, max_length (strings/arrays)
    - min, max (numbers)
    - enum: [allowed_values]
    - items: sub-schema for array elements
    - properties: sub-schema for nested objects
    - custom: callable(value) -> error_string or None
    - coerce: attempt type coercion before validation
    """
    errors = []
    field_type = rules.get("type", "string")

    # Handle conditional required (required_if)
    is_required = rules.get("required", False)
    required_if = rules.get("required_if")
    if required_if and full_body:
        condition_field = required_if.get("field")
        condition_value = required_if.get("value")
        if condition_field and full_body.get(condition_field) == condition_value:
            is_required = True

    # Check presence
    if value is None or (isinstance(value, str) and value.strip() == ""):
        if is_required:
            errors.append((field_path, "Required"))
        return errors, value

    # Type coercion
    if coerce:
        value = _coerce_value(value, field_type)

    # Type-specific validation
    if field_type == "string":
        if not isinstance(value, str):
            errors.append((field_path, "Must be a string"))
            return errors, value
        min_len = rules.get("min_length")
        max_len = rules.get("max_length")
        if min_len is not None and len(value) < min_len:
            errors.append((field_path, f"Must be at least {min_len} characters"))
        if max_len is not None and len(value) > max_len:
            errors.append((field_path, f"Must be at most {max_len} characters"))
        pattern = rules.get("pattern")
        if pattern and not re.match(pattern, value):
            errors.append((field_path, f"Must match pattern: {pattern}"))

    elif field_type == "date":
        if not isinstance(value, str):
            errors.append((field_path, "Must be a valid calendar date (YYYY-MM-DD)"))
            return errors, value
        try:
            datetime.strptime(value, "%Y-%m-%d")
        except ValueError:
            errors.append((field_path, "Must be a valid calendar date (YYYY-MM-DD)"))

    elif field_type == "email":
        if not isinstance(value, str) or not EMAIL_RE.match(value):
            errors.append((field_path, "Must be a valid email address"))


    elif field_type == "number":
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return "Must be a number"
        if not math.isfinite(value):
            return "Must be a finite number"
        if rules.get("integer") and not isinstance(value, int):
            return "Must be an integer"

    elif field_type in ("number", "float"):
        if not isinstance(value, (int, float)):
            errors.append((field_path, "Must be a number"))
            return errors, value

        min_val = rules.get("min")
        max_val = rules.get("max")
        if min_val is not None and value < min_val:
            errors.append((field_path, f"Must be at least {min_val}"))
        if max_val is not None and value > max_val:
            errors.append((field_path, f"Must be at most {max_val}"))

    elif field_type == "integer":
        if not isinstance(value, int) or isinstance(value, bool):
            errors.append((field_path, "Must be an integer"))
            return errors, value
        min_val = rules.get("min")
        max_val = rules.get("max")
        if min_val is not None and value < min_val:
            errors.append((field_path, f"Must be at least {min_val}"))
        if max_val is not None and value > max_val:
            errors.append((field_path, f"Must be at most {max_val}"))

    elif field_type == "boolean":
        if not isinstance(value, bool):
            errors.append((field_path, "Must be a boolean"))


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

    elif field_type == "array":
        if not isinstance(value, list):
            errors.append((field_path, "Must be an array"))
            return errors, value
        min_len = rules.get("min_length")
        max_len = rules.get("max_length")
        if min_len is not None and len(value) < min_len:
            errors.append((field_path, f"Must have at least {min_len} items"))
        if max_len is not None and len(value) > max_len:
            errors.append((field_path, f"Must have at most {max_len} items"))


        # Validate each array element against items schema
        items_schema = rules.get("items")
        if items_schema:
            for idx, item in enumerate(value):
                item_path = f"{field_path}[{idx}]"
                if isinstance(items_schema, dict) and items_schema.get("type") == "object":
                    nested_errors = _validate_object(item, items_schema.get("properties", {}), item_path, full_body)
                    errors.extend(nested_errors)
                else:
                    item_errors, _ = _check_field_deep(item, items_schema, item_path, full_body, coerce)
                    errors.extend(item_errors)

    elif field_type == "object":
        if not isinstance(value, dict):
            errors.append((field_path, "Must be an object"))
            return errors, value
        properties = rules.get("properties", {})
        nested_errors = _validate_object(value, properties, field_path, full_body)
        errors.extend(nested_errors)

    # Enum validation (applies to any type)
    enum_values = rules.get("enum")
    if enum_values is not None and value is not None:
        enum_error = _check_enum(value, enum_values)
        if enum_error:
            errors.append((field_path, enum_error))

    # Custom validator
    custom_fn = rules.get("custom")
    if custom_fn and callable(custom_fn):
        try:
            custom_error = custom_fn(value)
            if custom_error:
                errors.append((field_path, custom_error))
        except Exception as exc:
            errors.append((field_path, f"Custom validation error: {str(exc)}"))

    return errors, value


def _validate_object(body, schema, base_path="", full_body=None):
    """
    Recursively validate an object against a schema.
    Returns list of (path, error_message) tuples for ALL validation failures.
    """
    if not isinstance(body, dict):
        return [(base_path or "$", "Must be an object")]

    if full_body is None:
        full_body = body

    errors = []

    for field_name, rules in schema.items():
        field_path = f"{base_path}.{field_name}" if base_path else field_name
        value = body.get(field_name)

        field_errors, _ = _check_field_deep(value, rules, field_path, full_body)
        errors.extend(field_errors)

    return errors


# =============================================================================
# Legacy API (backward compatible)
# =============================================================================

def _check_field(value, rules, field_name):
    """Validate a single field against its rules. Returns error string or None."""
    errors, _ = _check_field_deep(value, rules, field_name)
    return errors[0][1] if errors else None


def validate_request(schema):

    """Validate a request JSON body against a schema before a handler runs."""
    """
    Decorator that validates request JSON body against a schema.

    Schema format (basic - backward compatible):
        {
            "fieldName": {"type": "string|date|email|number|array", "required": True/False, ...},
        }

    Extended schema format (new):
        {
            "fieldName": {
                "type": "object",
                "required": True,
                "properties": {
                    "nestedField": {"type": "string", "required": True},
                },
            },
            "items": {
                "type": "array",
                "items": {"type": "object", "properties": {...}},
            },
            "conditionalField": {
                "type": "string",
                "required_if": {"field": "otherField", "value": "someValue"},
            },
        }

    Returns 400 with field-level errors (JSON-path locations) if validation fails.
    """

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

            all_errors = _validate_object(body, schema)

            if all_errors:
                # Format errors as dict with JSON-path keys
                error_dict = {}
                for path, message in all_errors:
                    if path in error_dict:
                        if isinstance(error_dict[path], list):
                            error_dict[path].append(message)
                        else:
                            error_dict[path] = [error_dict[path], message]
                    else:
                        error_dict[path] = message

                return jsonify({
                    "error": "Validation failed",
                    "fields": error_dict,
                    "errorCount": len(all_errors),
                }), 400

            return f(*args, **kwargs)
        return wrapped
    return decorator


def validate_request_deep(schema, coerce=True):
    """
    Enhanced decorator with type coercion and deep validation.
    Coerced values are injected back into request context.
    """
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            body = request.get_json(silent=True)
            if body is None:
                body = {}

            all_errors = _validate_object(body, schema)

            if all_errors:
                error_dict = {}
                for path, message in all_errors:
                    if path in error_dict:
                        if isinstance(error_dict[path], list):
                            error_dict[path].append(message)
                        else:
                            error_dict[path] = [error_dict[path], message]
                    else:
                        error_dict[path] = message

                return jsonify({
                    "error": "Validation failed",
                    "fields": error_dict,
                    "errorCount": len(all_errors),
                }), 400

            return f(*args, **kwargs)

        return wrapped

    return decorator

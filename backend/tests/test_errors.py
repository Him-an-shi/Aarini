"""Tests for custom AppError hierarchy and exception handling."""
import pytest
from utils.errors import (
    AppError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    RateLimitError,
    ValidationError,
    AuthenticationError,
    ConflictError,
)


class TestAppErrorHierarchy:
    """Test instantiation and to_dict behavior of custom AppError classes."""

    def test_base_app_error_defaults(self):
        err = AppError()
        assert err.status_code == 500
        assert err.error_code == "INTERNAL_ERROR"
        assert err.message == "An unexpected error occurred."
        assert err.payload is None
        assert err.to_dict() == {
            "error": "An unexpected error occurred.",
            "code": "INTERNAL_ERROR",
        }

    def test_base_app_error_custom_args(self):
        err = AppError(
            message="Custom failure",
            status_code=503,
            error_code="SERVICE_UNAVAILABLE",
            payload={"service": "payment"},
        )
        assert err.status_code == 503
        assert err.error_code == "SERVICE_UNAVAILABLE"
        assert err.message == "Custom failure"
        assert err.payload == {"service": "payment"}
        assert err.to_dict() == {
            "error": "Custom failure",
            "code": "SERVICE_UNAVAILABLE",
            "payload": {"service": "payment"},
        }

    def test_bad_request_error(self):
        err = BadRequestError("Invalid parameter")
        assert err.status_code == 400
        assert err.error_code == "BAD_REQUEST"
        assert err.message == "Invalid parameter"
        assert err.to_dict() == {"error": "Invalid parameter", "code": "BAD_REQUEST"}

    def test_unauthorized_error(self):
        err = UnauthorizedError()
        assert err.status_code == 401
        assert err.error_code == "UNAUTHORIZED"
        assert err.message == "Authentication is required."
        assert isinstance(err, AppError)

    def test_forbidden_error(self):
        err = ForbiddenError("Access denied")
        assert err.status_code == 403
        assert err.error_code == "FORBIDDEN"
        assert err.message == "Access denied"
        assert isinstance(err, AppError)

    def test_not_found_error(self):
        err = NotFoundError("User not found")
        assert err.status_code == 404
        assert err.error_code == "NOT_FOUND"
        assert err.message == "User not found"
        assert isinstance(err, AppError)

    def test_rate_limit_error(self):
        err = RateLimitError()
        assert err.status_code == 429
        assert err.error_code == "RATE_LIMITED"
        assert err.message == "Too many requests. Please slow down."
        assert isinstance(err, AppError)

    def test_validation_error_subclass(self):
        err = ValidationError("Field missing", payload={"field": "email"})
        assert err.status_code == 400
        assert err.error_code == "VALIDATION_ERROR"
        assert isinstance(err, BadRequestError)
        assert err.to_dict() == {
            "error": "Field missing",
            "code": "VALIDATION_ERROR",
            "payload": {"field": "email"},
        }

    def test_authentication_error_subclass(self):
        err = AuthenticationError("Token expired")
        assert err.status_code == 401
        assert err.error_code == "AUTHENTICATION_ERROR"
        assert isinstance(err, UnauthorizedError)

    def test_conflict_error(self):
        err = ConflictError("Email already exists")
        assert err.status_code == 409
        assert err.error_code == "CONFLICT"
        assert isinstance(err, AppError)


class TestAppErrorFlaskIntegration:
    """Test throwing AppError inside Flask routes handled by centralized error middleware."""

    def test_app_error_route_handler(self):
        from flask import Flask
        from middleware.error_handler import register_error_handlers

        app = Flask(__name__)
        register_error_handlers(app)

        @app.route("/test-error")
        def error_route():
            raise NotFoundError("Resource missing test")

        with app.test_client() as test_client:
            resp = test_client.get("/test-error")
            assert resp.status_code == 404
            assert resp.get_json() == {
                "error": "Resource missing test",
                "code": "NOT_FOUND",
            }


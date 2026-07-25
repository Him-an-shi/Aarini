class AppError(Exception):
    status_code = 500
    error_code = "INTERNAL_ERROR"
    message = "An unexpected error occurred."

    def __init__(self, message=None, status_code=None, error_code=None, payload=None):
        super().__init__(message or self.message)
        self.message = message or self.message
        if status_code is not None:
            self.status_code = status_code
        if error_code is not None:
            self.error_code = error_code
        self.payload = payload

    def to_dict(self):
        rv = {"error": self.message, "code": self.error_code}
        if self.payload:
            rv["payload"] = self.payload
        return rv


class NotFoundError(AppError):
    status_code = 404
    error_code = "NOT_FOUND"
    message = "The requested resource was not found."


class ValidationError(AppError):
    status_code = 400
    error_code = "VALIDATION_ERROR"
    message = "Invalid request data."


class AuthenticationError(AppError):
    status_code = 401
    error_code = "AUTHENTICATION_ERROR"
    message = "Authentication is required."


class ForbiddenError(AppError):
    status_code = 403
    error_code = "FORBIDDEN"
    message = "You do not have permission to perform this action."


class ConflictError(AppError):
    status_code = 409
    error_code = "CONFLICT"
    message = "The request conflicts with the current state."


class RateLimitError(AppError):
    status_code = 429
    error_code = "RATE_LIMITED"
    message = "Too many requests. Please slow down."

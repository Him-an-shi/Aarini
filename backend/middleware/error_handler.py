import logging
import traceback
from flask import jsonify
from utils.errors import AppError

logger = logging.getLogger(__name__)


def register_error_handlers(app):
    """Register centralized error handlers on the Flask app."""

    @app.errorhandler(AppError)
    def handle_app_error(error):
        logger.warning(f"AppError: {error.error_code} - {error.message}")
        return jsonify(error.to_dict()), error.status_code

    @app.errorhandler(400)
    def handle_bad_request(error):
        logger.warning(f"Bad request: {str(error)}")
        return jsonify({"error": str(error), "code": "BAD_REQUEST"}), 400

    @app.errorhandler(401)
    def handle_unauthorized(error):
        logger.warning(f"Unauthorized: {str(error)}")
        return jsonify({"error": "Authentication is required.", "code": "AUTHENTICATION_ERROR"}), 401

    @app.errorhandler(403)
    def handle_forbidden(error):
        logger.warning(f"Forbidden: {str(error)}")
        return jsonify({"error": "Forbidden.", "code": "FORBIDDEN"}), 403

    @app.errorhandler(404)
    def handle_not_found(error):
        logger.info(f"Not found: {str(error)}")
        return jsonify({"error": "Resource not found.", "code": "NOT_FOUND"}), 404

    @app.errorhandler(405)
    def handle_method_not_allowed(error):
        logger.warning(f"Method not allowed: {str(error)}")
        return jsonify({"error": "Method not allowed.", "code": "METHOD_NOT_ALLOWED"}), 405

    @app.errorhandler(429)
    def handle_rate_limit(error):
        logger.warning(f"Rate limited: {str(error)}")
        return jsonify({"error": "Too many requests. Please slow down.", "code": "RATE_LIMITED"}), 429

    @app.errorhandler(500)
    def handle_internal_error(error):
        logger.error(f"Internal server error: {str(error)}\n{traceback.format_exc()}")
        return jsonify({"error": "An unexpected error occurred.", "code": "INTERNAL_ERROR"}), 500

import os
import logging
import secrets
import time
import json
from datetime import datetime, date
from functools import wraps
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from dotenv import load_dotenv
from cycle_prediction import parse_date, predict_cycle
from prediction_feedback import get_prediction_feedback
from middleware.validation import validate_request
from middleware.rate_limit import limiter, init_limiter, RATE_LIMITS
from utils.sanitize import sanitize_for_ai
from utils.health_context import build_health_context, invalidate_cache
from utils.errors import NotFoundError, AuthenticationError

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = Flask(__name__)

# CORS: restrict origins in production, allow all in development
allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
allowed_origins = [o.strip() for o in allowed_origins if o.strip()]
if allowed_origins:
    CORS(app, origins=allowed_origins, supports_credentials=True)
else:
    CORS(app)

init_limiter(app)
from middleware.error_handler import register_error_handlers
register_error_handlers(app)
mock_cycles = {}

# Placeholder for Firebase Admin SDK initialization
firebase_initialized = False
try:
    import firebase_admin
    from firebase_admin import credentials, auth, firestore
    import json

    # Check for credentials in env, either as a JSON string or path
    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "config/serviceAccountKey.json")

    if service_account_json:
        try:
            service_account_info = json.loads(service_account_json)
            cred = credentials.Certificate(service_account_info)
            firebase_admin.initialize_app(cred)
            db = firestore.client()
            firebase_initialized = True
            logger.info("Firebase Admin SDK successfully initialized via environment JSON string.")
        except Exception as json_err:
            logger.error(f"Error initializing Firebase from JSON string: {str(json_err)}")
    elif os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        firebase_initialized = True
        logger.info(f"Firebase Admin SDK successfully initialized via certificate file: {cred_path}")
    else:
        logger.warning(
            f"Firebase service account key not found at '{cred_path}' and FIREBASE_SERVICE_ACCOUNT_JSON not set. "
            "Running backend in mock/development mode. Fill in configuration keys to connect Firebase."
        )
except Exception as e:
    logger.error(f"Error initializing Firebase Admin: {str(e)}")

# --- Gemini Model Initialization (cached singleton) ---
_gemini_model = None
SYSTEM_INSTRUCTION = (
    "You are Aarini, an extremely empathetic, professional, and supportive AI wellness assistant "
    "specializing in women's hormonal wellness, menstrual health, and reproductive biology. "
    "Use warm, reassuring language. Provide scientific, easy-to-understand educational explanations "
    "(e.g., explaining hormones like progesterone and estrogen simply). "
    "You MUST NOT diagnose illnesses, prescribe medications, or claim to replace qualified medical practitioners. "
    "For severe symptoms (e.g., extreme debilitating pain, heavy hemorrhage), always gently encourage the "
    "user to seek guidance from an OB-GYN or primary care physician. "
    "Always include a concise, friendly medical disclaimer at the absolute end of your response."
)


def get_gemini_model():
    """Lazy-initialize and return the cached Gemini model instance."""
    global _gemini_model
    if _gemini_model is not None:
        return _gemini_model

    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        return None

    try:
        import google.generativeai as genai
        genai.configure(api_key=gemini_key)
        _gemini_model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            generation_config={"temperature": 0.7},
            system_instruction=SYSTEM_INSTRUCTION,
        )
        logger.info("Gemini model initialized and cached.")
        return _gemini_model
    except Exception as e:
        logger.error(f"Failed to initialize Gemini model: {e}")
        return None


def authenticated_user(handler):
    """Resolve the user from a verified Firebase token in production."""
    @wraps(handler)
    def wrapped(*args, **kwargs):
        authorization = request.headers.get("Authorization", "")
        token = authorization.removeprefix("Bearer ").strip()

        if firebase_initialized:
            if not token:
                return jsonify({"error": "Authentication required"}), 401
            try:
                request.user_id = auth.verify_id_token(token)["uid"]
            except Exception:
                raise AuthenticationError("Invalid or expired authentication token")
        else:
            # Development mode keeps data isolated by the mock profile id.
            payload = request.get_json(silent=True) or {}
            request.user_id = (
                request.headers.get("X-User-Id")
                or payload.get("uid")
                or request.args.get("uid")
                or "mock_user_123"
            )
        return handler(*args, **kwargs)

    return wrapped

# Health Check Route
@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "status": "healthy",
        "app": "Aarini Backend API",
        "firebase_connected": firebase_initialized,
        "environment": os.getenv("FLASK_ENV", "development")
    }), 200

# ----------------- AUTHENTICATION ENDPOINTS -----------------

@app.route("/signup", methods=["POST"])
@limiter.limit(RATE_LIMITS["signup"])
@validate_request({
    "name": {"type": "string", "required": True, "min_length": 1},
    "email": {"type": "email", "required": True},
    "password": {"type": "string", "required": True, "min_length": 6},
})
def signup():
    """
    Creates a new user record.
    Expected Payload: { name, email, password, age, cycleLength }
    """
    data = request.get_json() or {}
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    age = data.get("age")
    cycle_length = data.get("cycleLength", 28)

    if not name or not email or not password:
        return jsonify({"error": "Missing required fields (name, email, password)"}), 400

    logger.info(f"Registering user: {email}")

    # Fallback/Mock behavior if Firebase is not yet connected
    if not firebase_initialized:
        return jsonify({
            "message": "User registered successfully (Mock Mode)",
            "user": {
                "uid": "mock_user_123",
                "name": name,
                "email": email,
                "age": age,
                "cycleLength": cycle_length
            }
        }), 201

    try:
        # Create Firebase User
        user_record = auth.create_user(
            email=email,
            password=password,
            display_name=name
        )

        # Store profile information in Firestore
        user_ref = db.collection("users").document(user_record.uid)
        user_ref.set({
            "name": name,
            "email": email,
            "age": age,
            "cycleLength": cycle_length,
            "createdAt": firestore.SERVER_TIMESTAMP
        })

        return jsonify({
            "message": "User registered successfully",
            "uid": user_record.uid
        }), 201

    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/login", methods=["POST"])
@limiter.limit(RATE_LIMITS["login"])
@validate_request({
    "email": {"type": "email", "required": True},
    "password": {"type": "string", "required": True},
})
def login():
    """
    Validates user authentication session.
    Expected Payload: { email, password }
    """
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Missing email or password"}), 400

    logger.info(f"Authenticating user: {email}")

    # Mock behavior
    if not firebase_initialized:
        return jsonify({
            "message": "Logged in successfully (Mock Mode)",
            "token": "mock_jwt_token_abc123",
            "user": {
                "uid": "mock_user_123",
                "name": "Jane Doe",
                "email": email,
                "cycleLength": 28
            }
        }), 200

    # Note: Client SDKs usually handle direct user login.
    # Here, Flask acts as a validating gateway if JWT token validation is needed.
    return jsonify({
        "message": "Backend session active. Please login directly in the mobile client for official Firebase session tokens.",
        "note": "We recommend direct client-side Firebase Auth authentication for maximum mobile capability."
    }), 200

@app.route("/google-login", methods=["POST"])
@limiter.limit(RATE_LIMITS["login"])
@validate_request({
    "idToken": {"type": "string", "required": True}
})
def google_login():
    """
    Validates Google ID Token using Firebase Admin SDK and ensures a user document exists.
    Expected Payload: { idToken }
    """
    data = request.get_json() or {}
    id_token = data.get("idToken")

    if not id_token:
        return jsonify({"error": "Missing idToken"}), 400

    logger.info("Authenticating user via Google Login")

    if not firebase_initialized:
        # Mock mode fallback
        return jsonify({
            "message": "Logged in with Google successfully (Mock Mode)",
            "token": "mock_google_token_abc123",
            "user": {
                "uid": "mock_google_user_123",
                "name": "Google User",
                "email": "googleuser@example.com",
                "cycleLength": 28
            }
        }), 200

    try:
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token.get("uid")
        email = decoded_token.get("email", "")
        name = decoded_token.get("name", "Google User")

        # Ensure user profile exists in Firestore
        user_ref = db.collection("users").document(uid)
        user_doc = user_ref.get()

        if not user_doc.exists:
            # First time login via Google
            user_ref.set({
                "name": name,
                "email": email,
                "age": 25, # Default, user can update later
                "cycleLength": 28, # Default
                "createdAt": firestore.SERVER_TIMESTAMP,
                "authProvider": "google"
            })
            profile_data = {
                "uid": uid,
                "name": name,
                "email": email,
                "age": 25,
                "cycleLength": 28
            }
        else:
            profile_data = user_doc.to_dict()
            profile_data["uid"] = uid

        return jsonify({
            "message": "Google Login successful",
            "token": id_token,
            "user": profile_data
        }), 200
    except Exception as e:
        logger.error(f"Google Login error: {str(e)}")
        return jsonify({"error": "Invalid or expired Google ID Token"}), 401


# ----------------- PERIOD TRACKING ENDPOINTS -----------------

@app.route("/add-cycle", methods=["POST"])
@limiter.limit(RATE_LIMITS["add_cycle"])
@authenticated_user
@validate_request({
    "startDate": {"type": "date", "required": True},
    "endDate": {"type": "date", "required": True},
    "flowIntensity": {"type": "string", "required": False},
})
def add_cycle():
    """
    Records a cycle entry.
    Expected Payload: { uid, startDate, endDate, flowIntensity, symptoms, mood }
    """
    data = request.get_json() or {}
    uid = request.user_id
    start_date = data.get("startDate")
    end_date = data.get("endDate")
    flow_intensity = data.get("flowIntensity")
    symptoms = data.get("symptoms", [])
    mood = data.get("mood")

    if not start_date or not end_date:
        return jsonify({"error": "startDate and endDate are required"}), 400

    try:
        parsed_start = parse_date(start_date)
        parsed_end = parse_date(end_date)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    if parsed_end < parsed_start:
        return jsonify({"error": "endDate cannot be before startDate"}), 400
    if (parsed_end - parsed_start).days > 13:
        return jsonify({"error": "A period entry cannot be longer than 14 days"}), 400
    if parsed_start > date.today():
        return jsonify({"error": "startDate cannot be in the future"}), 400

    logger.info(f"Adding cycle for user: {uid}")

    if not firebase_initialized:
        cycle = {
            "id": f"mock_cycle_{len(mock_cycles.get(uid, [])) + 1}",
            "startDate": start_date,
            "endDate": end_date,
            "flowIntensity": flow_intensity,
            "symptoms": symptoms,
            "mood": mood,
        }
        user_cycles = mock_cycles.setdefault(uid, [])
        user_cycles.append(cycle)
        invalidate_cache(uid)
        return jsonify({
            "message": "Cycle logged successfully (Mock Mode)",
            "cycle": cycle,
            "prediction": predict_cycle(user_cycles),
        }), 201

    try:
        cycle_ref = db.collection("users").document(uid).collection("cycles").document()
        cycle_data = {
            "startDate": start_date,
            "endDate": end_date,
            "flowIntensity": flow_intensity,
            "symptoms": symptoms,
            "mood": mood,
            "loggedAt": firestore.SERVER_TIMESTAMP
        }
        cycle_ref.set(cycle_data)
        invalidate_cache(uid)
        return jsonify({"message": "Cycle data saved", "id": cycle_ref.id}), 201
    except Exception as e:
        logger.error(f"Error saving cycle: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/cycles", methods=["GET"])
@authenticated_user
def get_cycles():
    """
    Retrieves previous logs for cycle tracking.
    """
    uid = request.user_id
    logger.info(f"Fetching cycles for user: {uid}")

    if not firebase_initialized:
        if uid not in mock_cycles:
            mock_cycles[uid] = [
                {"id": "sample_1", "startDate": "2026-04-28", "endDate": "2026-05-02"},
                {"id": "sample_2", "startDate": "2026-05-27", "endDate": "2026-05-31"},
            ]
        user_cycles = mock_cycles[uid]
        return jsonify({
            "cycles": sorted(user_cycles, key=lambda cycle: cycle["startDate"], reverse=True),
            "prediction": predict_cycle(user_cycles),
        }), 200

    try:
        cycles_ref = db.collection("users").document(uid).collection("cycles").order_by("startDate", direction=firestore.Query.DESCENDING)
        docs = cycles_ref.stream()
        cycles_list = []
        for doc in docs:
            c = doc.to_dict()
            c["id"] = doc.id
            cycles_list.append(c)
        profile = db.collection("users").document(uid).get().to_dict() or {}
        return jsonify({
            "cycles": cycles_list,
            "prediction": predict_cycle(cycles_list, fallback_cycle_length=profile.get("cycleLength", 28)),
        }), 200
    except Exception as e:
        logger.error(f"Error getting cycles: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/cycles/<cycle_id>", methods=["GET"])
@authenticated_user
def get_cycle(cycle_id):
    """Retrieve a single cycle entry by its ID."""
    uid = request.user_id

    if not firebase_initialized:
        user_cycles = mock_cycles.get(uid, [])
        cycle = next((c for c in user_cycles if c.get("id") == cycle_id), None)
        if not cycle:
            return jsonify({"error": "Cycle not found"}), 404
        return jsonify({"cycle": cycle}), 200

    try:
        doc = db.collection("users").document(uid).collection("cycles").document(cycle_id).get()
        if not doc.exists:
            return jsonify({"error": "Cycle not found"}), 404
        cycle = doc.to_dict()
        cycle["id"] = doc.id
        return jsonify({"cycle": cycle}), 200
    except Exception as e:
        logger.error(f"Error fetching cycle {cycle_id}: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/cycle-prediction", methods=["GET"])
@authenticated_user
def get_cycle_prediction():
    uid = request.user_id
    if not firebase_initialized:
        return jsonify(predict_cycle(mock_cycles.get(uid, []))), 200

    try:
        docs = (
            db.collection("users")
            .document(uid)
            .collection("cycles")
            .order_by("startDate", direction=firestore.Query.ASCENDING)
            .stream()
        )
        cycles = [doc.to_dict() for doc in docs]
        profile = db.collection("users").document(uid).get().to_dict() or {}
        return jsonify(
            predict_cycle(cycles, fallback_cycle_length=profile.get("cycleLength", 28))
        ), 200
    except Exception as e:
        logger.error(f"Error predicting cycle: {str(e)}")
        return jsonify({"error": str(e)}), 500



# ----------------- CYCLE UPDATE/DELETE ENDPOINTS -----------------

@app.route("/cycles/<cycle_id>", methods=["PUT"])
@authenticated_user
@validate_request({
    "startDate": {"type": "date", "required": True},
    "endDate": {"type": "date", "required": True},
})
def update_cycle(cycle_id):
    """
    Update an existing cycle entry.
    Expected Payload: { startDate, endDate, flowIntensity?, symptoms?, mood? }
    """
    data = request.get_json() or {}
    uid = request.user_id
    start_date = data.get("startDate")
    end_date = data.get("endDate")
    flow_intensity = data.get("flowIntensity")
    symptoms = data.get("symptoms", [])
    mood = data.get("mood")

    try:
        parsed_start = parse_date(start_date)
        parsed_end = parse_date(end_date)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    if parsed_end < parsed_start:
        return jsonify({"error": "endDate cannot be before startDate"}), 400
    if (parsed_end - parsed_start).days > 13:
        return jsonify({"error": "A period entry cannot be longer than 14 days"}), 400
    if parsed_start > date.today():
        return jsonify({"error": "startDate cannot be in the future"}), 400

    logger.info(f"Updating cycle {cycle_id} for user: {uid}")

    if not firebase_initialized:
        user_cycles = mock_cycles.get(uid, [])
        target = next((c for c in user_cycles if c.get("id") == cycle_id), None)
        if not target:
            return jsonify({"error": "Cycle entry not found"}), 404
        target["startDate"] = start_date
        target["endDate"] = end_date
        if flow_intensity is not None:
            target["flowIntensity"] = flow_intensity
        if symptoms:
            target["symptoms"] = symptoms
        if mood is not None:
            target["mood"] = mood
        invalidate_cache(uid)
        return jsonify({
            "message": "Cycle updated successfully (Mock Mode)",
            "cycle": target,
            "prediction": predict_cycle(user_cycles),
        }), 200

    try:
        cycle_ref = db.collection("users").document(uid).collection("cycles").document(cycle_id)
        doc = cycle_ref.get()
        if not doc.exists:
            return jsonify({"error": "Cycle entry not found"}), 404
        update_data = {
            "startDate": start_date,
            "endDate": end_date,
        }
        if flow_intensity is not None:
            update_data["flowIntensity"] = flow_intensity
        if symptoms:
            update_data["symptoms"] = symptoms
        if mood is not None:
            update_data["mood"] = mood
        cycle_ref.update(update_data)
        invalidate_cache(uid)

        cycles_ref = db.collection("users").document(uid).collection("cycles").order_by("startDate", direction=firestore.Query.DESCENDING)
        cycles_list = [d.to_dict() | {"id": d.id} for d in cycles_ref.stream()]
        profile = db.collection("users").document(uid).get().to_dict() or {}
        return jsonify({
            "message": "Cycle updated",
            "cycle": {"id": cycle_id, **update_data},
            "prediction": predict_cycle(cycles_list, fallback_cycle_length=profile.get("cycleLength", 28)),
        }), 200
    except Exception as e:
        logger.error(f"Error updating cycle: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/cycles/<cycle_id>", methods=["DELETE"])
@authenticated_user
def delete_cycle(cycle_id):
    """Permanently remove a cycle entry."""
    uid = request.user_id
    logger.info(f"Deleting cycle {cycle_id} for user: {uid}")

    if not firebase_initialized:
        user_cycles = mock_cycles.get(uid, [])
        original_len = len(user_cycles)
        mock_cycles[uid] = [c for c in user_cycles if c.get("id") != cycle_id]
        if len(mock_cycles[uid]) == original_len:
            return jsonify({"error": "Cycle entry not found"}), 404
        invalidate_cache(uid)
        return jsonify({
            "message": "Cycle deleted successfully (Mock Mode)",
            "prediction": predict_cycle(mock_cycles[uid]),
        }), 200

    try:
        cycle_ref = db.collection("users").document(uid).collection("cycles").document(cycle_id)
        doc = cycle_ref.get()
        if not doc.exists:
            return jsonify({"error": "Cycle entry not found"}), 404
        cycle_ref.delete()
        invalidate_cache(uid)

        cycles_ref = db.collection("users").document(uid).collection("cycles").order_by("startDate", direction=firestore.Query.DESCENDING)
        cycles_list = [d.to_dict() | {"id": d.id} for d in cycles_ref.stream()]
        profile = db.collection("users").document(uid).get().to_dict() or {}
        return jsonify({
            "message": "Cycle deleted",
            "prediction": predict_cycle(cycles_list, fallback_cycle_length=profile.get("cycleLength", 28)),
        }), 200
    except Exception as e:
        logger.error(f"Error deleting cycle: {str(e)}")
        return jsonify({"error": str(e)}), 500


# ----------------- MOOD & SYMPTOM ENDPOINTS -----------------

mock_moods = {}

@app.route("/add-symptom", methods=["POST"])
@limiter.limit(RATE_LIMITS["add_symptom"])
@authenticated_user
@validate_request({
    "type": {"type": "string", "required": True},
    "severity": {"type": "string", "required": True},
    "date": {"type": "date", "required": True},
})
def add_symptom():
    """
    Logs an individual symptom.
    Expected Payload: { uid, type, severity, date }
    """
    data = request.get_json() or {}
    uid = request.user_id
    symptom_type = data.get("type") 
    severity = data.get("severity")
    symptom_date = data.get("date")

    if not symptom_type or not severity or not symptom_date:
        return jsonify({"error": "Missing required fields (type, severity, date)"}), 400
    # Validate severity
    allowed_severities = ["Low", "Medium", "High"]
    if severity not in allowed_severities:
        return jsonify({"error": "Invalid severity. Allowed values: Low, Medium, High"}), 400
    # Validate future date
    try:
        parsed_date = datetime.strptime(symptom_date, "%Y-%m-%d").date()
        if parsed_date > date.today():
            return jsonify({"error": "Symptom date cannot be in the future"}), 400
    
    except ValueError:
        return jsonify({"error": "Invalid date format"}), 400 

    if severity not in ["Low", "Medium", "High"]:
        return jsonify({"error": "Severity must be 'Low', 'Medium', or 'High'"}), 400

    try:
        parsed_date = parse_date(symptom_date)
        if parsed_date > date.today():
            return jsonify({"error": "Symptom date cannot be in the future"}), 400
    except ValueError:
        return jsonify({"error": "Invalid date format. Must be YYYY-MM-DD"}), 400

    logger.info(f"Logging symptom: {symptom_type} for user: {uid}")

    if not firebase_initialized:
        return jsonify({
           "message": "Symptom tracked successfully (Mock Mode)",
           "symptom": {
            "type": symptom_type,
            "severity": severity,
            "date": symptom_date
        }}), 201

    try:
        symptom_ref = db.collection("users").document(uid).collection("symptoms").document()
        symptom_ref.set({
            "type": symptom_type,
            "severity": severity,
            "date": symptom_date,
            "loggedAt": firestore.SERVER_TIMESTAMP
        })
        return jsonify({"message": "Symptom logged", "id": symptom_ref.id}), 201
    except Exception as e:
        logger.error(f"Error logging symptom: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/symptoms", methods=["GET"])
@authenticated_user
def get_symptoms():
    uid = request.user_id
    logger.info(f"Retrieving symptoms for user: {uid}")

    if not firebase_initialized:
        user_symptoms = mock_symptoms.get(uid)
        if user_symptoms is not None:
            return jsonify(user_symptoms), 200
        return jsonify([
            {"type": "Cramps", "severity": "Medium", "date": "2026-05-24"},
            {"type": "Fatigue", "severity": "High", "date": "2026-05-23"},
            {"type": "Acne", "severity": "Low", "date": "2026-05-20"}
        ]), 200


    try:
        symptoms_ref = db.collection("users").document(uid).collection("symptoms").order_by("date", direction=firestore.Query.DESCENDING)
        docs = symptoms_ref.stream()
        symptoms_list = []
        for doc in docs:
            s = doc.to_dict()
            s["id"] = doc.id
            symptoms_list.append(s)
        return jsonify(symptoms_list), 200
    except Exception as e:
        logger.error(f"Error fetching symptoms: {str(e)}")
        return jsonify({"error": str(e)}), 500


mock_symptoms = {}

@app.route("/symptoms/<symptom_id>", methods=["PUT"])
@authenticated_user
@validate_request({
    "type": {"type": "string", "required": True},
    "severity": {"type": "string", "required": True},
    "date": {"type": "date", "required": True},
})
def update_symptom(symptom_id):
    """Update an existing symptom entry."""
    data = request.get_json() or {}
    uid = request.user_id
    symptom_type = data.get("type")
    severity = data.get("severity")
    symptom_date = data.get("date")

    logger.info(f"Updating symptom {symptom_id} for user: {uid}")

    if severity not in ["Low", "Medium", "High"]:
        return jsonify({"error": "Severity must be 'Low', 'Medium', or 'High'"}), 400

    try:
        parsed_date = parse_date(symptom_date)
        if parsed_date > date.today():
            return jsonify({"error": "Symptom date cannot be in the future"}), 400
    except ValueError:
        return jsonify({"error": "Invalid date format. Must be YYYY-MM-DD"}), 400

    if not firebase_initialized:
        user_symptoms = mock_symptoms.get(uid, [])
        target = next((s for s in user_symptoms if s.get("id") == symptom_id), None)
        if not target:
            return jsonify({"error": "Symptom entry not found"}), 404
        target["type"] = symptom_type
        target["severity"] = severity
        target["date"] = symptom_date
        return jsonify({
            "message": "Symptom updated successfully (Mock Mode)",
            "symptom": target,
        }), 200

    try:
        symptom_ref = db.collection("users").document(uid).collection("symptoms").document(symptom_id)
        doc = symptom_ref.get()
        if not doc.exists:
            return jsonify({"error": "Symptom entry not found"}), 404
        symptom_ref.update({
            "type": symptom_type,
            "severity": severity,
            "date": symptom_date,
        })
        return jsonify({"message": "Symptom updated"}), 200
    except Exception as e:
        logger.error(f"Error updating symptom: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/symptoms/<symptom_id>", methods=["DELETE"])
@authenticated_user
def delete_symptom(symptom_id):
    """Permanently remove a symptom entry."""
    uid = request.user_id
    logger.info(f"Deleting symptom {symptom_id} for user: {uid}")

    if not firebase_initialized:
        user_symptoms = mock_symptoms.get(uid, [])
        original_len = len(user_symptoms)
        mock_symptoms[uid] = [s for s in user_symptoms if s.get("id") != symptom_id]
        if len(mock_symptoms[uid]) == original_len:
            return jsonify({"error": "Symptom entry not found"}), 404
        return jsonify({"message": "Symptom deleted successfully (Mock Mode)"}), 200

    try:
        symptom_ref = db.collection("users").document(uid).collection("symptoms").document(symptom_id)
        doc = symptom_ref.get()
        if not doc.exists:
            return jsonify({"error": "Symptom entry not found"}), 404
        symptom_ref.delete()
        return jsonify({"message": "Symptom deleted"}), 200
    except Exception as e:
        logger.error(f"Error deleting symptom: {str(e)}")
        return jsonify({"error": str(e)}), 500


# ----------------- MOOD TRACKING ENDPOINTS -----------------

@app.route("/add-mood", methods=["POST"])
@limiter.limit(RATE_LIMITS["add_mood"])
@authenticated_user
@validate_request({
    "mood": {"type": "string", "required": True},
    "date": {"type": "date", "required": True},
})
def add_mood():
    """
    Logs a mood entry.
    Expected Payload: { mood, date, notes? }
    Mood values: e.g. "great", "good", "okay", "low", "bad"
    """
    data = request.get_json() or {}
    uid = request.user_id
    mood_value = data.get("mood")
    mood_date = data.get("date")
    notes = data.get("notes", "")

    if not mood_value or not mood_date:
        return jsonify({"error": "Missing required fields (mood, date)"}), 400

    logger.info(f"Logging mood: {mood_value} for user: {uid}")

    if not firebase_initialized:
        mood_entry = {
            "id": f"mock_mood_{len(mock_moods.get(uid, [])) + 1}",
            "mood": mood_value,
            "date": mood_date,
            "notes": notes,
        }
        user_moods = mock_moods.setdefault(uid, [])
        user_moods.append(mood_entry)
        invalidate_cache(uid)
        return jsonify({
            "message": "Mood tracked successfully (Mock Mode)",
            "mood": mood_entry,
        }), 201

    try:
        mood_ref = db.collection("users").document(uid).collection("moods").document()
        mood_ref.set({
            "mood": mood_value,
            "date": mood_date,
            "notes": notes,
            "loggedAt": firestore.SERVER_TIMESTAMP,
        })
        invalidate_cache(uid)
        return jsonify({"message": "Mood logged", "id": mood_ref.id}), 201
    except Exception as e:
        logger.error(f"Error logging mood: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/moods", methods=["GET"])
@authenticated_user
def get_moods():
    """Retrieve mood history for the authenticated user."""
    uid = request.user_id
    logger.info(f"Retrieving moods for user: {uid}")

    if not firebase_initialized:
        user_moods = mock_moods.get(uid, [
            {"id": "sample_mood_1", "mood": "good", "date": "2026-05-24", "notes": ""},
            {"id": "sample_mood_2", "mood": "okay", "date": "2026-05-23", "notes": "Feeling a bit tired"},
            {"id": "sample_mood_3", "mood": "low", "date": "2026-05-22", "notes": ""},
        ])
        return jsonify({
            "moods": sorted(user_moods, key=lambda m: m.get("date", ""), reverse=True),
        }), 200

    try:
        moods_ref = (
            db.collection("users").document(uid)
            .collection("moods")
            .order_by("date", direction=firestore.Query.DESCENDING)
        )
        docs = moods_ref.stream()
        moods_list = []
        for doc in docs:
            m = doc.to_dict()
            m["id"] = doc.id
            moods_list.append(m)
        return jsonify({"moods": moods_list}), 200
    except Exception as e:
        logger.error(f"Error fetching moods: {str(e)}")
        return jsonify({"error": str(e)}), 500


# ----------------- AI HEALTH CHAT ENDPOINTS -----------------

@app.route("/chat", methods=["POST"])
@limiter.limit(RATE_LIMITS["chat"])
@authenticated_user
@validate_request({
    "message": {"type": "string", "required": True, "min_length": 1, "max_length": 2000},
})
def chat():
    """
    Interacts with Gemini API for empathetic, context-aware wellness explanations.
    Supports multi-turn via optional 'history' array in request body.
    Expected Payload: { message, history?: [{role, parts}] }
    """
    data = request.get_json() or {}
    user_message = data.get("message")
    history = data.get("history", [])
    uid = request.user_id

    if not user_message:
        return jsonify({"error": "Message is required"}), 400

    logger.info(f"AI Chat request from {uid}: {user_message[:50]}...")

    model = get_gemini_model()
    if not model:
        health_ctx = build_health_context(uid, db if firebase_initialized else None, firebase_initialized)
        return jsonify({
            "response": (
                "Hello! I am Aarini, your empathetic hormonal wellness guide.\n\n"
                + (f"Based on your data: {health_ctx}\n\n" if health_ctx else "")
                + "To get fully personalized AI answers, configure the GEMINI_API_KEY.\n\n"
                "General tip: Eating magnesium-rich foods like dark chocolate, bananas, or spinach "
                "can naturally help relax muscles and ease menstrual cramps."
            ),
            "disclaimer": "Disclaimer: I am an AI educational companion. My responses are for informational purposes only and do not replace professional medical advice.",
            "phase": None,
        }), 200

    try:
        health_ctx = build_health_context(uid, db if firebase_initialized else None, firebase_initialized)

        context_messages = []
        if health_ctx:
            context_messages.append({
                "role": "user",
                "parts": [f"[SYSTEM CONTEXT - do not repeat this to the user] {health_ctx}"]
            })
            context_messages.append({
                "role": "model",
                "parts": ["Understood. I have your current health context and will personalize my responses accordingly."]
            })

        chat_history = context_messages + history[-10:]

        chat_session = model.start_chat(history=chat_history)
        response = chat_session.send_message(sanitize_for_ai(user_message)[0])

        return jsonify({
            "response": response.text,
            "disclaimer": "Disclaimer: Aarini is an AI educational assistant. Our suggestions are informative and do not constitute formal medical diagnosis.",
            "phase": _extract_phase_from_context(health_ctx),
        }), 200

    except Exception as e:
        logger.error(f"Gemini API error: {str(e)}")
        return jsonify({"error": "Failed to generate AI response. Please try again."}), 500


@app.route("/chat/stream", methods=["POST"])
@limiter.limit(RATE_LIMITS["chat_stream"])
@authenticated_user
def chat_stream():
    """
    Streaming AI chat via Server-Sent Events.
    Tokens are sent progressively as SSE data events.
    Final event contains the complete response.
    Expected Payload: { message, history?: [{role, parts}] }
    """
    data = request.get_json() or {}
    user_message = data.get("message", "").strip()
    history = data.get("history", [])
    uid = request.user_id

    if not user_message or len(user_message) > 2000:
        return jsonify({"error": "Message is required (1-2000 characters)"}), 400

    model = get_gemini_model()
    if not model:
        def mock_stream():
            chunks = [
                "Hello! I am Aarini, your wellness guide. ",
                "To unlock streaming AI responses, ",
                "please configure the GEMINI_API_KEY. ",
                "Tip: Warm compresses on the lower abdomen can help ease cramps.",
            ]
            for chunk in chunks:
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                time.sleep(0.3)
            full = "".join(chunks)
            yield f"data: {json.dumps({'done': True, 'full_response': full, 'disclaimer': 'AI educational companion. Not medical advice.'})}\n\n"

        return Response(mock_stream(), mimetype="text/event-stream", headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        })

    def generate():
        try:
            health_ctx = build_health_context(uid, db if firebase_initialized else None, firebase_initialized)

            context_messages = []
            if health_ctx:
                context_messages.append({
                    "role": "user",
                    "parts": [f"[SYSTEM CONTEXT - do not repeat this to the user] {health_ctx}"]
                })
                context_messages.append({
                    "role": "model",
                    "parts": ["Understood. I have your current health context and will personalize my responses accordingly."]
                })

            chat_history = context_messages + history[-10:]
            chat_session = model.start_chat(history=chat_history)

            response = chat_session.send_message(
                sanitize_for_ai(user_message)[0],
                stream=True,
            )

            full_text = ""
            for chunk in response:
                if chunk.text:
                    full_text += chunk.text
                    yield f"data: {json.dumps({'chunk': chunk.text})}\n\n"

            yield f"data: {json.dumps({'done': True, 'full_response': full_text, 'disclaimer': 'Aarini is an AI educational assistant. Not medical advice.', 'phase': _extract_phase_from_context(health_ctx)})}\n\n"

        except Exception as e:
            logger.error(f"Streaming Gemini error: {str(e)}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(generate(), mimetype="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    })


def _extract_phase_from_context(ctx):
    """Extract current phase from the context string if present."""
    if not ctx:
        return None
    for phase in ("Menstrual", "Follicular", "Ovulation", "Luteal"):
        if f"Current phase: {phase}" in ctx:
            return phase
    return None


# ----------------- WELLNESS INSIGHTS ENDPOINTS -----------------

@app.route("/insights", methods=["GET"])
@authenticated_user
def get_insights():
    """
    Computes wellness insights based on cycle history.
    """
    uid = request.user_id
    logger.info(f"Computing insights for user: {uid}")

    # For MVP, we supply static but highly engaging medical-educational insights.
    # In a full release, this fetches cycles/symptoms and runs standard deviations to check regularity.
    insights = [
        {
            "category": "Hormonal Balance",
            "title": "Progesterone Phase Peak",
            "message": "Based on your cycle logging, you are entering your luteal phase. Progesterone is peaking, which can naturally increase fatigue or cravings. Consider choosing nourishing, low-glycemic foods to sustain energy.",
            "type": "tip"
        },
        {
            "category": "Cycle Consistency",
            "title": "Healthy Regular Cycle",
            "message": "Your cycle variance is only 1.5 days over the last 3 logged periods. This indicates high regularity, reflecting positive endocrine health.",
            "type": "success"
        },
        {
            "category": "Hydration Reminder",
            "title": "Mitigate PMS Bloating",
            "message": "Historically, you log bloating on day 26 of your cycle. Drinking at least 2.5L of water today will help flush excess sodium and reduce fluid retention.",
            "type": "alert"
        }
    ]
    return jsonify(insights), 200


# ----------------- ACCOUNT MANAGEMENT ENDPOINTS -----------------
@app.route("/delete-account", methods=["DELETE"])
@limiter.limit(RATE_LIMITS["delete_account"])
@authenticated_user
def delete_account():
    """
    Permanently deletes user account and all associated health data.
    Requires confirmed intent via { "confirm": true } in the request body.
    """
    data = request.get_json() or {}
    uid = request.user_id

    if not data.get("confirm"):
        return jsonify({
            "error": "Account deletion requires explicit confirmation. Send {\"confirm\": true}."
        }), 400

    logger.info(f"Account deletion requested for user: {uid}")

    if not firebase_initialized:
        mock_cycles[uid] = []
        mock_symptoms[uid] = []
        mock_moods[uid] = []
        return jsonify({
            "message": "Account and all health data permanently deleted (Mock Mode)",
            "deletedCollections": ["cycles", "symptoms", "moods", "profile"]
        }), 200



    try:
        user_doc = db.collection("users").document(uid)

        # 1. Delete all subcollections
        subcollections = ["cycles", "symptoms", "moods"]
        for coll_name in subcollections:
            docs = user_doc.collection(coll_name).stream()
            for doc in docs:
                doc.reference.delete()
                
        # 🛠️ FIX 1: Find and delete any orphaned share links tied to this UID
        links_query = db.collection("share_links").where("uid", "==", uid).stream()
        for link_doc in links_query:
            link_doc.reference.delete()

        # 2. Delete the main user document
        user_doc.delete()

        # 3. Delete the Firebase Auth user
        auth.delete_user(uid)

        logger.info(f"Account permanently deleted: {uid}")
        return jsonify({
            "message": "Account and all health data permanently deleted",
            "deletedCollections": subcollections + ["share_links", "profile"]
        }), 200

    except Exception as e:
        logger.error(f"Account deletion error: {str(e)}")
        return jsonify({"error": f"Failed to delete account: {str(e)}"}), 500

# ----------------- PROFILE MANAGEMENT ENDPOINTS -----------------

@app.route("/profile", methods=["GET"])
@authenticated_user
def get_profile():
    """Retrieve the authenticated user's profile information."""
    uid = request.user_id
    logger.info(f"Fetching profile for user: {uid}")

    if not firebase_initialized:
        return jsonify({
            "name": "Jane Doe",
            "email": "jane@example.com",
            "age": 26,
            "cycleLength": 28,
            "uid": uid,
        }), 200

    try:
        doc = db.collection("users").document(uid).get()
        if not doc.exists:
            return jsonify({"error": "Profile not found"}), 404
        profile = doc.to_dict()
        profile["uid"] = uid
        return jsonify(profile), 200
    except Exception as e:
        logger.error(f"Error fetching profile: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/profile", methods=["PUT"])
@authenticated_user
@validate_request({
    "name": {"type": "string", "required": False},
})
def update_profile():
    """Update the authenticated user's profile information."""
    data = request.get_json() or {}
    uid = request.user_id
    logger.info(f"Updating profile for user: {uid}")

    allowed_fields = {"name", "age", "cycleLength"}
    updates = {k: v for k, v in data.items() if k in allowed_fields and v is not None}

    if not updates:
        return jsonify({"error": "No valid fields to update"}), 400

    if "age" in updates:
        try:
            age_val = int(updates["age"])
            if age_val < 10 or age_val > 120:
                return jsonify({"error": "Age must be between 10 and 120"}), 400
            updates["age"] = age_val
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid age value"}), 400

    if "cycleLength" in updates:
        try:
            cl_val = int(updates["cycleLength"])
            if cl_val < 15 or cl_val > 60:
                return jsonify({"error": "Cycle length must be between 15 and 60"}), 400
            updates["cycleLength"] = cl_val
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid cycle length value"}), 400

    if not firebase_initialized:
        return jsonify({
            "message": "Profile updated (Mock Mode)",
            "profile": updates,
        }), 200

    try:
        user_ref = db.collection("users").document(uid)
        user_ref.update(updates)
        updated_doc = user_ref.get()
        profile = updated_doc.to_dict() or {}
        profile["uid"] = uid
        return jsonify({
            "message": "Profile updated successfully",
            "profile": profile,
        }), 200
    except Exception as e:
        logger.error(f"Error updating profile: {str(e)}")
        return jsonify({"error": str(e)}), 500


# ----------------- CYCLE SHARING ENDPOINTS -----------------

@app.route("/share/create", methods=["POST"])
@limiter.limit(RATE_LIMITS["share_create"])
@authenticated_user
def create_share_link():
    """
    Generates a unique share token granting read-only access to cycle data.
    Expected Payload: { expiresInDays (optional, default 7) }
    """
    data = request.get_json() or {}
    uid = request.user_id
    expires_in_days = data.get("expiresInDays", 7)

    # 🛠️ FIX: Changed isinstance to a strict type() check to block booleans.
    # (In Python, isinstance(True, int) is True, which creates a type-casting loophole!)
    if type(expires_in_days) is not int or expires_in_days < 1 or expires_in_days > 90:
        return jsonify({"error": "expiresInDays must be an integer between 1 and 90"}), 400

    # Use a cryptographically secure random token rather than a hash of
    # uid + timestamp. The previous scheme was derivable from a known uid and a
    # guessable creation time and was truncated to 64 bits; secrets.token_urlsafe
    # draws 256 bits from the OS CSPRNG, so the token cannot be predicted or
    # brute-forced from non-secret inputs. It is URL-safe (A-Z, a-z, 0-9, - and _),
    # which is valid both as the /share/view/<token> path segment and as a
    # Firestore document ID.
    token = secrets.token_urlsafe(32)
    expires_at = int(time.time()) + (expires_in_days * 86400)

    share_links[token] = {
        "uid": uid,
        "createdAt": int(time.time()),
        "expiresAt": expires_at,
        "active": True,
    }

    if firebase_initialized:
        try:
            db.collection("share_links").document(token).set({
                "uid": uid,
                "createdAt": int(time.time()),
                "expiresAt": expires_at,
                "active": True,
            })
        except Exception as e:
            logger.error(f"Error storing share link: {str(e)}")

    logger.info(f"Share link created for user {uid}: {token}")
    return jsonify({
        "token": token,
        "expiresAt": expires_at,
        "expiresInDays": expires_in_days,
        "shareUrl": f"/share/view/{token}",
    }), 201
    # Startup summary
    gemini_status = "configured" if os.getenv("GEMINI_API_KEY") else "mock (no GEMINI_API_KEY)"
    firebase_status = "connected" if firebase_initialized else "mock"
    cors_status = ", ".join(allowed_origins) if allowed_origins else "all origins (dev mode)"
    logger.info("=" * 50)
    logger.info("Aarini Backend Starting")
    logger.info(f"  Port:      {port}")
    logger.info(f"  Debug:     {debug_mode}")
    logger.info(f"  Firebase:  {firebase_status}")
    logger.info(f"  Gemini:    {gemini_status}")
    logger.info(f"  CORS:      {cors_status}")
    logger.info("=" * 50)

    app.run(host="0.0.0.0", port=port, debug=debug_mode)

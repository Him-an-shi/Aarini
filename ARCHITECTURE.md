# Aarini Architecture

Aarini is a cross-platform mobile application built to provide health insights, cycle tracking, and ML-powered predictions. The system is split between a React Native (Expo) frontend and a Python-based backend handling the predictive logic, all bound together by Firebase for real-time data synchronization.

## ?? High-Level Overview

The architecture is divided into three primary tiers:

1. **Client / Frontend (`frontend/`)**: An Expo React Native application providing the user interface, state management, and device integration.
2. **Backend API (`backend/`)**: A Python-based service responsible for machine learning algorithms, cycle predictions, and data analysis.
3. **Database & Auth (Firebase)**: Firestore provides real-time NoSQL data storage (governed by `firestore.rules`), while Firebase Authentication secures user sessions.

### ?? System Architecture Diagram

```mermaid
graph TD
    User[End User (Mobile)]
    
    subgraph Frontend Application
        Expo[React Native / Expo App]
        Context[React Context / State]
        Screens[UI Screens & Components]
        Services[API Services / Hooks]
    end
    
    subgraph Backend Services
        Python[Python API]
        ML[Cycle Prediction Engine]
    end
    
    subgraph Firebase Infrastructure
        Auth[Firebase Authentication]
        Firestore[Cloud Firestore DB]
    end
    
    User -->|Interacts| Screens
    Screens -->|Dispatches| Context
    Context -->|Uses| Services
    
    Services -->|Authenticates| Auth
    Services -->|Reads/Writes| Firestore
    Services -->|Fetches Predictions| Python
    
    Python -->|Queries History| Firestore
    Python -->|Runs Models| ML
```

## ?? Directory Structure

### Frontend (`frontend/`)
- **`assets/`**: Static images and fonts.
- **`components/`**: Reusable UI components.
- **`screens/`**: Full-page views for navigation.
- **`context/`**: Global state management (Auth, Theme).
- **`services/`**: API wrappers and Firebase interactions.
- **`utils/`**: Helper functions and parsers.
- **`navigation/`**: React Navigation configurations.

### Backend (`backend/`)
- **`app.py`**: Main application entry point for the REST API.
- **`cycle_prediction.py`**: Core algorithm for predicting cycles.
- **`tests/`**: Unit tests for backend logic.

## ?? Data Flow

1. **User Input**: A user logs a new symptom on the mobile app.
2. **Frontend Service**: The `frontend/services` layer packages this data and sends it securely to Firebase Firestore.
3. **Backend Trigger**: When the user requests a new prediction, the Python backend queries the recent data from Firestore.
4. **Processing**: `cycle_prediction.py` processes the historical data.
5. **Response**: The backend returns the predicted dates to the frontend, which updates the React Context and re-renders the UI.

## ?? Deployment Strategy

- **Frontend**: Distributed via Expo Application Services (EAS).
- **Backend**: Containerized/Deployed via standard PaaS providers (e.g. Render, Vercel, Heroku) as defined by `render.yaml`.
- **Database**: Serverless deployment on Google Cloud via Firebase.

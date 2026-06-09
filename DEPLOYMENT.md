# Aarini Production Deployment Guide

This repository contains a full-stack health application with an Expo React Native frontend (compiled for Web) and a Flask Python backend.

---

## 1. Prerequisites & Environment Variables

Make sure you have accounts and projects set up on:
- [Vercel](https://vercel.com/) (Frontend Hosting)
- [Render](https://render.com/) (Backend Web Service)
- [Firebase Console](https://console.firebase.google.com/) (Authentication & Firestore Database)
- [Google AI Studio](https://aistudio.google.com/) (Gemini AI Key)

### Backend Environment Variables (Render)

| Variable Name | Purpose | Example / How to Obtain |
|---|---|---|
| `FLASK_ENV` | Run mode | `production` |
| `GEMINI_API_KEY` | Empathetic health assistant key | Obtain from Google AI Studio |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase authentication & db credentials | Minified single-line JSON of your Service Account Key |

### Frontend Environment Variables (Vercel)

| Variable Name | Purpose | Example / How to Obtain |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Endpoint of backend API | E.g. `https://aarini-backend.onrender.com` (no trailing slash) |

---

## 2. Firebase Database Setup

1. Open the [Firebase Console](https://console.firebase.google.com/) and create a project named **Aarini** (or select an existing project).
2. **Enable Firestore Database**:
   - Navigate to **Firestore Database** in the left menu.
   - Click **Create Database**. Select production mode and select a region close to your user base.
3. **Enable Authentication**:
   - Navigate to **Authentication** in the left menu.
   - Click **Get Started**, then select **Email/Password** as a provider, enable it, and save.
4. **Generate Service Account Private Key**:
   - Go to **Project Settings** (gear icon in the sidebar) > **Service Accounts**.
   - Click **Generate New Private Key** and download the JSON file.
   - **Convert Key to Single-Line JSON**: Open the downloaded JSON file, copy its contents, and minify it into a single line (remove line breaks). This will be used as the value for the `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable in Render.

---

## 3. Backend Deployment (Render)

The repository includes a `render.yaml` Blueprint file at the root. You can deploy the backend using either the blueprint or manual configuration.

### Option A: Automatic Deployment via Render Blueprint

1. Go to the [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** and select **Blueprint**.
3. Connect your GitHub repository.
4. Render will automatically read the `render.yaml` file.
5. In the settings, fill in the values for the environment variables:
   - `GEMINI_API_KEY`
   - `FIREBASE_SERVICE_ACCOUNT_JSON`
6. Click **Apply** to deploy the services.

### Option B: Manual Web Service Setup

1. Go to [Render Dashboard](https://dashboard.render.com/) > **New +** > **Web Service**.
2. Connect your repository.
3. Configure the following service settings:
   - **Name**: `aarini-backend`
   - **Environment**: `Python`
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
4. Expand the **Advanced** section and add the required environment variables:
   - `FLASK_ENV=production`
   - `GEMINI_API_KEY`
   - `FIREBASE_SERVICE_ACCOUNT_JSON`
5. Click **Create Web Service**.
6. Once deployed, note down the service URL (e.g. `https://aarini-backend.onrender.com`).

---

## 4. Frontend Deployment (Vercel)

Vercel will build the Expo project into a static web application and serve it with client-side SPA routing.

1. Go to the [Vercel Dashboard](https://vercel.com/) and click **Add New** > **Project**.
2. Import your GitHub repository.
3. Configure the project settings:
   - **Framework Preset**: Select `Other` (or leave default).
   - **Root Directory**: Select `frontend`.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install --legacy-peer-deps` (Crucial for handling peer dependency trees with React 19).
4. Add the following **Environment Variable**:
   - Key: `EXPO_PUBLIC_API_URL`
   - Value: Your deployed Render backend URL (e.g. `https://aarini-backend.onrender.com`)
5. Click **Deploy**.
6. Once the build is complete, Vercel will provide your live frontend URL (e.g. `https://aarini-frontend.vercel.app`).

---

## 5. Verification Checklist

- [ ] **Health Endpoint**: Visit the backend URL `https://your-backend.onrender.com/` in your browser. Verify it returns `{"status":"healthy", ...}` and `firebase_connected: true`.
- [ ] **Onboarding Screen**: Open the Vercel frontend URL, verify the Splash screen loads, and click sign up.
- [ ] **Database Connection**: Register a test user (e.g., `test@aarini.com`) and verify that a user document appears under the `users` collection in the Firebase console.
- [ ] **AI Assistant**: Navigate to the chat tab, send an inquiry about menstrual cramps, and verify it returns a response generated by Gemini AI.

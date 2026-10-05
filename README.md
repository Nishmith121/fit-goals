# 🥗 FitGoals AI — Smart Nutrition & Fitness Tracker

FitGoals AI is an intelligent, full-stack fitness and nutrition platform powered by Machine Learning. It analyzes daily dietary habits, scores meals with an ML model, tracks hydration in real-time, features a gamified virtual companion that evolves with your health stats, and hosts a competitive leaderboard.

---

## ✨ Features

- **🤖 ML Food Scorer & Dataset**:
  - Scikit-learn Random Forest model trained on extensive nutritional and dietary data.
  - Generates instant health scores (0–100) and categorizes foods into **Good**, **Okay**, or **Bad** tiers.
  - Automatically identifies flags: *Protein-rich*, *Fibre-rich*, *Refined*, *Fried*, *Added Sugar*, and *Junk*.
  - Suggests healthy alternatives for junk foods and allows custom food creation.

- **💧 Smart Hydration Tracker**:
  - Daily water intake logging with interactive glass/bottle animations.
  - Dynamic hydration percentage goals and automated drinking reminders.

- **🐶 Gamified Virtual Pet Companion**:
  - Interactive pet companion whose happiness, energy, and animations react dynamically to your food quality and water intake.

- **🏆 Community Leaderboard**:
  - Real-time ranking calculated from daily diet scores, water goals, and activity points.
  - Top 3 podium with athlete profile statistics and historical performance.

- **📅 Personalized Day Planner**:
  - Daily routine builder for structured meals, workouts, and rest intervals.

- **🎨 Modern Glassmorphic UI**:
  - Fluid animations with GSAP and WebGL canvas shaders (Splash Cursor, Vapor Text, Magic Bento grids).
  - Responsive design with dark mode aesthetics built using TailwindCSS and Lucide icons.

- **⚡ Unified Full-Stack Architecture**:
  - FastAPI serves both the REST API and the compiled React SPA from a single instance with zero CORS configuration needed.
  - Built-in auto-pinger background thread to prevent free-tier cloud sleep.

---

## 🛠️ Tech Stack

### **Frontend**
- **Framework**: React 18 (Vite)
- **Styling**: TailwindCSS, Vanilla CSS glassmorphic tokens
- **Animations & Graphics**: GSAP, Lucide React, Canvas Shaders (`@paper-design/shaders`)
- **State & Routing**: React Context API (`AuthContext`), SPA routing

### **Backend**
- **Framework**: FastAPI (Python 3.11+)
- **Server**: Uvicorn ASGI
- **Machine Learning & Data**: Scikit-Learn, Pandas, NumPy, Joblib, OpenPyXL
- **Persistence**: JSON file-based database for users, logs, and custom foods

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Python**: 3.10+ installed
- **Node.js**: 18+ and npm installed
- **Git**

---

### 1. Clone the Repository
```bash
git clone https://github.com/Nishmith121/fit-goals.git
cd fit-goals
```

---

### 2. Backend Setup
From the project root:
```bash
# Optional: create and activate virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r backend/requirements.txt

# Start backend server
python backend/run.py
```
Backend will be live at `http://127.0.0.1:8000` (Interactive API docs at `http://127.0.0.1:8000/docs`).

---

### 3. Frontend Setup
Open a new terminal window:
```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev
```
Frontend will be live at `http://localhost:5173`. In development mode, Vite automatically proxies `/api` requests to `http://127.0.0.1:8000`.

---

## 🌐 Deployment to Render

FitGoals is preconfigured for instant deployment on **Render** via [render.yaml](render.yaml) and [build.sh](build.sh).

### Option 1: Blueprint Deployment (One-Click)
1. Fork or push this repository to your GitHub account.
2. Sign in to [Render](https://render.com).
3. Click **New +** ➔ **Blueprint**.
4. Select your `fit-goals` repository.
5. Render reads `render.yaml` automatically and configures:
   - **Runtime**: Python 3.11
   - **Build Command**: `bash build.sh` (installs Python dependencies + builds React frontend)
   - **Start Command**: `cd backend && uvicorn app:app --host 0.0.0.0 --port $PORT`
6. Click **Apply**.

### Option 2: Manual Web Service
1. Click **New +** ➔ **Web Service** on Render.
2. Connect your `fit-goals` repository.
3. Configure the service:
   - **Environment**: `Python`
   - **Build Command**: `bash build.sh`
   - **Start Command**: `cd backend && uvicorn app:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free`
4. Add Environment Variables:
   - `PYTHON_VERSION`: `3.11.9`
   - `NODE_VERSION`: `20.11.1`
5. Click **Deploy**.

---

## ⏰ Keeping Free Tier Awake (24/7 Pinger)

Render's free tier spins down web services after 15 minutes of inactivity. FitGoals includes two solutions:

### 1. Built-in Internal Pinger
The backend automatically detects the `RENDER_EXTERNAL_URL` environment variable set by Render and pings `/health` every 14 minutes in a background daemon thread.

### 2. External 24/7 Pinger (Recommended for 100% Uptime)
To guarantee zero cold starts even after container reboots:
1. Register for free on [cron-job.org](https://cron-job.org) or [uptimerobot.com](https://uptimerobot.com).
2. Create a new monitor pointing to:
   ```
   https://<your-app-name>.onrender.com/health
   ```
3. Set the schedule to ping every **10 minutes** using an HTTP `GET` request.

---

## 📡 API Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Healthcheck and keep-alive ping endpoint |
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login user and issue session token |
| `GET` | `/api/auth/me` | Fetch authenticated user profile |
| `POST` | `/api/score` | Score a food item using the ML model |
| `GET` | `/api/suggestions` | Autocomplete & fuzzy search for foods |
| `GET` | `/api/logs` | Get food diary entries for a given date |
| `POST` | `/api/logs` | Log food intake |
| `DELETE` | `/api/logs/{id}` | Remove a food log item |
| `GET` | `/api/water` | Fetch hydration logs and progress |
| `POST` | `/api/water` | Log water consumption |
| `GET` | `/api/leaderboard` | Get daily community rankings and podium |
| `GET` | `/api/pet` | Get companion pet status based on today's health metrics |
| `GET` | `/api/plan` | Fetch customized day plan |

---

## 📁 Project Structure

```
fit-goals/
├── backend/
│   ├── app.py                  # FastAPI application & ML inference
│   ├── run.py                  # Local runner with UTF-8 config
│   ├── requirements.txt        # Backend dependencies
│   ├── custom_foods.json       # User custom foods database
│   ├── user_food_logs.json     # Food diary logs
│   ├── user_water_logs.json    # Water logs
│   └── users.json              # User accounts
├── frontend/
│   ├── src/
│   │   ├── components/         # React UI modules (FoodTracker, Water, Pet, etc.)
│   │   ├── context/            # Authentication & State
│   │   ├── services/           # API fetch client
│   │   └── App.jsx             # Main dashboard
│   ├── package.json
│   └── vite.config.js
├── food_model.pkl              # Serialized Scikit-Learn ML model
├── food_scored.xlsx            # Nutritional dataset with labels
├── build.sh                    # Unified build script for Render
├── render.yaml                 # Render Blueprint configuration
├── start_backend.bat           # Windows quick-start for backend
├── start_frontend.bat          # Windows quick-start for frontend
└── README.md
```

---

## 📄 License

This project is licensed under the MIT License — see the LICENSE file for details.

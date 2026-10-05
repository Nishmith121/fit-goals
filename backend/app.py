import os
import json
import time
import hashlib
import uuid
import threading
import urllib.request
from datetime import datetime, date
from pathlib import Path
from typing import Optional, Dict, Any, List
import pandas as pd
import numpy as np
import joblib
import difflib
import re
from fastapi import FastAPI, Query, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

app = FastAPI(title="FitGoals Food Scorer & Tracker API", version="3.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auto-Pinger (keeps Render free-tier alive) ──────────────────────────
RENDER_EXTERNAL_URL = os.environ.get("RENDER_EXTERNAL_URL", "")

def _auto_ping():
    """Ping our own /health endpoint every 14 minutes to prevent Render sleep."""
    if not RENDER_EXTERNAL_URL:
        return  # Not on Render, skip pinging
    health_url = f"{RENDER_EXTERNAL_URL}/health"
    while True:
        time.sleep(14 * 60)  # 14 minutes
        try:
            urllib.request.urlopen(health_url, timeout=10)
            print(f"[auto-ping] Pinged {health_url}")
        except Exception as e:
            print(f"[auto-ping] Failed to ping: {e}")

@app.on_event("startup")
def start_pinger():
    if RENDER_EXTERNAL_URL:
        t = threading.Thread(target=_auto_ping, daemon=True)
        t.start()
        print(f"[auto-ping] Started — will ping {RENDER_EXTERNAL_URL}/health every 14 min")

@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "food_model.pkl"
DATA_PATH  = BASE_DIR / "food_scored.xlsx"
LOGS_FILE  = BASE_DIR / "backend" / "user_food_logs.json"
WATER_LOGS_FILE = BASE_DIR / "backend" / "user_water_logs.json"
USERS_FILE = BASE_DIR / "backend" / "users.json"
CUSTOM_FOODS_FILE = BASE_DIR / "backend" / "custom_foods.json"
PLANS_FILE = BASE_DIR / "backend" / "user_plans.json"

model_data: Dict[str, Any] = {}
df_foods: Optional[pd.DataFrame] = None

FLAGS  = ["Healthy","Good_food","Protein_rich","Fibre_rich","Sugar","Oil","Ghee","Fried","Junk","Refined"]
POINTS = {"Healthy":15,"Good_food":15,"Protein_rich":5,"Fibre_rich":5,
          "Sugar":-10,"Oil":-4,"Ghee":-5,"Fried":-15,"Junk":-15,"Refined":-8}

def init_default_dataset():
    """Initializes sample historical dataset including Monday's example if not yet created."""
    if not LOGS_FILE.exists():
        sample_monday = {
            "2026-09-28": {
                "date": "2026-09-28",
                "day": "Monday",
                "items": [
                    {
                        "id": "item-m1",
                        "name": "Rice Sambar",
                        "score": 75.0,
                        "rating": "Good",
                        "verdict": "Great choice! Nutrient-dense, clean fuel and good for health.",
                        "time": "01:15 PM",
                        "from_dataset": True
                    },
                    {
                        "id": "item-m2",
                        "name": "Burger",
                        "score": 28.0,
                        "rating": "Bad",
                        "verdict": "Bad choice. High in junk, refined oils, trans fat or added sugars.",
                        "time": "05:30 PM",
                        "from_dataset": True
                    },
                    {
                        "id": "item-m3",
                        "name": "Ice Cream",
                        "score": 30.0,
                        "rating": "Bad",
                        "verdict": "Bad choice. High in junk, refined oils, trans fat or added sugars.",
                        "time": "08:45 PM",
                        "from_dataset": True
                    }
                ]
            }
        }
        try:
            with open(LOGS_FILE, "w", encoding="utf-8") as f:
                json.dump(sample_monday, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print("Could not create default logs file:", e)

# ── Per-user log storage ──────────────────────────────────────────────────────
# Files are stored as {"version": 2, "users": {email: {date: {...}}}}.
# Older files (one shared {date: {...}} map) are migrated on first read: the shared
# history is copied to every existing account and the old file is kept as *.legacy.json.

def _user_key(email: Optional[str]) -> str:
    key = (email or "").strip().lower() if isinstance(email, str) else ""
    return key or "guest"

def _read_json(path: Path) -> dict:
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, dict) else {}
        except Exception:
            return {}
    return {}

def _write_json(path: Path, data: dict):
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Failed to save {path.name}:", e)

def _read_store(path: Path) -> dict:
    store = _read_json(path)
    if store.get("version") == 2 and isinstance(store.get("users"), dict):
        return store

    # Legacy shared file -> per-user store
    legacy = store
    users = {}
    if legacy:
        _write_json(path.with_name(path.stem + ".legacy.json"), legacy)
        emails = [_user_key(u.get("email")) for u in load_users().values() if u.get("email")]
        for e in emails:
            users[e] = json.loads(json.dumps(legacy))
    store = {"version": 2, "users": users}
    _write_json(path, store)
    return store

def _load_user_logs(path: Path, email: Optional[str]) -> dict:
    return _read_store(path)["users"].get(_user_key(email), {})

def _save_user_logs(path: Path, email: Optional[str], data: dict):
    store = _read_store(path)
    store["users"][_user_key(email)] = data
    _write_json(path, store)

def load_food_logs(email: Optional[str] = None) -> dict:
    return _load_user_logs(LOGS_FILE, email)

def save_food_logs(data: dict, email: Optional[str] = None):
    _save_user_logs(LOGS_FILE, email, data)

def init_default_water_dataset():
    """Initializes sample water tracking dataset if not yet created."""
    if not WATER_LOGS_FILE.exists():
        today = datetime.now().strftime("%Y-%m-%d")
        sample_water = {
            today: {
                "date": today,
                "target_ml": 2500,
                "entries": [
                    {
                        "id": "water-sample-1",
                        "amount_ml": 250,
                        "type": "Glass of water",
                        "time": "09:00 AM"
                    },
                    {
                        "id": "water-sample-2",
                        "amount_ml": 250,
                        "type": "Glass of water",
                        "time": "10:30 AM"
                    }
                ]
            }
        }
        try:
            with open(WATER_LOGS_FILE, "w", encoding="utf-8") as f:
                json.dump(sample_water, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print("Could not create default water logs file:", e)

def load_water_logs(email: Optional[str] = None) -> dict:
    return _load_user_logs(WATER_LOGS_FILE, email)

def save_water_logs(data: dict, email: Optional[str] = None):
    _save_user_logs(WATER_LOGS_FILE, email, data)

def load_plan(email: Optional[str], date_str: str) -> str:
    return str(_load_user_logs(PLANS_FILE, email).get(date_str, ""))

def save_plan(email: Optional[str], date_str: str, text: str):
    plans = _load_user_logs(PLANS_FILE, email)
    if text.strip():
        plans[date_str] = text
    else:
        plans.pop(date_str, None)
    _save_user_logs(PLANS_FILE, email, plans)

def compute_water_day_summary(date_str: str, day_record: dict) -> dict:
    day_name = ""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        day_name = dt.strftime("%A")
    except Exception:
        day_name = "Today"

    target_ml = day_record.get("target_ml", 2500)
    entries = day_record.get("entries", [])
    total_ml = sum(int(e.get("amount_ml", 250)) for e in entries)
    standard_glasses = sum(1 for e in entries if int(e.get("amount_ml", 250)) <= 350)
    percentage = round(min(100.0, (total_ml / target_ml) * 100)) if target_ml > 0 else 0

    return {
        "date": date_str,
        "day": day_name,
        "target_ml": target_ml,
        "total_ml": total_ml,
        "glass_count": len(entries),
        "standard_glasses": standard_glasses,
        "percentage": percentage,
        "entries": entries
    }

@app.on_event("startup")
def startup():
    global model_data, df_foods
    if MODEL_PATH.exists():
        model_data = joblib.load(MODEL_PATH)
        print("Model loaded.")
    if DATA_PATH.exists():
        df_foods = pd.read_excel(DATA_PATH)
        df_foods["_name_lower"] = df_foods["Name"].fillna("").astype(str).str.strip().str.lower()
        print(f"Dataset loaded: {len(df_foods)} foods.")

    # Merge previously saved custom foods into df_foods
    custom_foods = load_custom_foods()
    if custom_foods and df_foods is not None:
        new_rows = []
        existing_names = set(df_foods["_name_lower"].tolist())
        for k, rec in custom_foods.items():
            if k not in existing_names:
                new_rows.append({
                    "Name": rec["Name"],
                    "Score": rec["Score"],
                    "Rating": rec["Rating"],
                    "verdict": rec.get("verdict", verdict_text(rec["Rating"], rec["Score"])),
                    "Category": "Custom Food",
                    "Course": "main course",
                    "Diet": "custom",
                    "Flavor": "mild",
                    "Ingredients": "",
                    "Adjust": 0,
                    "_name_lower": k
                })
        if new_rows:
            df_foods = pd.concat([df_foods, pd.DataFrame(new_rows)], ignore_index=True)
            print(f"Loaded {len(new_rows)} user-saved custom foods into dataset.")

def rating_label(score: float) -> str:
    """Map score (0-90) to 3-tier label matching dataset: Good, Okay, Not good."""
    if score >= 65:
        return "Good"
    elif score >= 40:
        return "Okay"
    else:
        return "Not good"

def verdict_text(rating: str, score: float) -> str:
    if rating == "Good":
        return "Great choice! Nutrient-dense, wholesome fuel and good for health."
    elif rating == "Okay":
        return "Moderate choice. Fine in a balanced diet, eat in moderation."
    else:
        return "Not good. High in junk, refined flour, oxidized oils or added sugars."

def load_custom_foods() -> Dict[str, Dict[str, Any]]:
    """Loads user-added and custom scored foods from JSON persistence."""
    if CUSTOM_FOODS_FILE.exists():
        try:
            with open(CUSTOM_FOODS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print("Failed to load custom foods:", e)
            return {}
    return {}

def save_custom_food_record(name: str, score: float, rating: str, verdict: str, flags: Optional[Dict[str, bool]] = None):
    """
    Saves newly scored custom food permanently to:
    1. custom_foods.json (persistent JSON storage)
    2. in-memory df_foods and custom_foods cache (instant availability)
    3. food_scored.xlsx (master dataset, if writable)
    """
    global df_foods
    key = name.strip().lower()
    title = name.strip().title()
    record = {
        "Name": title,
        "Score": round(float(score), 1),
        "Rating": rating,
        "verdict": verdict,
        "flags": flags or {},
        "created_at": datetime.now().isoformat()
    }

    # 1. Update custom_foods.json
    all_custom = load_custom_foods()
    all_custom[key] = record
    try:
        with open(CUSTOM_FOODS_FILE, "w", encoding="utf-8") as f:
            json.dump(all_custom, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Failed to write to custom_foods.json:", e)

    # 2. Append/Update in-memory df_foods
    if df_foods is not None:
        existing_idx = df_foods.index[df_foods["_name_lower"] == key].tolist()
        if existing_idx:
            df_foods.loc[existing_idx, "Score"] = record["Score"]
            df_foods.loc[existing_idx, "Rating"] = record["Rating"]
            df_foods.loc[existing_idx, "verdict"] = record["verdict"]
        else:
            new_row_dict = {
                "Name": title,
                "Score": record["Score"],
                "Rating": record["Rating"],
                "Category": "Custom Food",
                "Course": "main course",
                "Diet": "custom",
                "Flavor": "mild",
                "Ingredients": "",
                "Healthy": "Yes" if flags and flags.get("Healthy") else "No",
                "Good_food": "Yes" if flags and flags.get("Good_food") else "No",
                "Protein_rich": "Yes" if flags and flags.get("Protein_rich") else "No",
                "Fibre_rich": "Yes" if flags and flags.get("Fibre_rich") else "No",
                "Sugar": "Yes" if flags and flags.get("Sugar") else "No",
                "Oil": "Yes" if flags and flags.get("Oil") else "No",
                "Ghee": "Yes" if flags and flags.get("Ghee") else "No",
                "Fried": "Yes" if flags and flags.get("Fried") else "No",
                "Junk": "Yes" if flags and flags.get("Junk") else "No",
                "Refined": "Yes" if flags and flags.get("Refined") else "No",
                "Adjust": 0,
                "_name_lower": key,
                "verdict": verdict
            }
            new_df = pd.DataFrame([new_row_dict])
            df_foods = pd.concat([df_foods, new_df], ignore_index=True)

    # 3. Synchronize to food_scored.xlsx (best-effort, non-blocking if locked)
    try:
        if DATA_PATH.exists() and df_foods is not None:
            export_cols = [c for c in df_foods.columns if c not in ["_name_lower", "verdict"]]
            df_foods[export_cols].to_excel(DATA_PATH, index=False)
            print(f"Successfully synced {title} to food_scored.xlsx")
    except Exception as e:
        print("Note: Could not sync to food_scored.xlsx (file might be locked/open):", e)

COMMON_FOOD_ALIASES: Dict[str, Dict[str, Any]] = {
    # Soft drinks & sodas (Score 25, Not good — matching Cola, Sprite, Pepsi in dataset)
    "soft drink": {
        "name": "Soft Drink", "score": 25.0, "rating": "Not good",
        "verdict": "Not good choice. High in liquid sugar, empty calories, artificial additives and carbonation."
    },
    "soft drinks": {
        "name": "Soft Drink", "score": 25.0, "rating": "Not good",
        "verdict": "Not good choice. High in liquid sugar, empty calories, artificial additives and carbonation."
    },
    "cold drink": {
        "name": "Cold Drink", "score": 25.0, "rating": "Not good",
        "verdict": "Not good choice. High in liquid sugar, empty calories, artificial additives and carbonation."
    },
    "cold drinks": {
        "name": "Cold Drink", "score": 25.0, "rating": "Not good",
        "verdict": "Not good choice. High in liquid sugar, empty calories, artificial additives and carbonation."
    },
    "colddrink": {
        "name": "Cold Drink", "score": 25.0, "rating": "Not good",
        "verdict": "Not good choice. High in liquid sugar, empty calories, artificial additives and carbonation."
    },
    "coke": {
        "name": "Coca Cola", "score": 25.0, "rating": "Not good",
        "verdict": "Not good choice. High in liquid sugar, empty calories, caramel colour and carbonation."
    },
    "coca cola": {
        "name": "Coca Cola", "score": 25.0, "rating": "Not good",
        "verdict": "Not good choice. High in liquid sugar, empty calories, caramel colour and carbonation."
    },
    "coca-cola": {
        "name": "Coca Cola", "score": 25.0, "rating": "Not good",
        "verdict": "Not good choice. High in liquid sugar, empty calories, caramel colour and carbonation."
    },
    "fanta": {
        "name": "Fanta", "score": 25.0, "rating": "Not good",
        "verdict": "Not good choice. High in liquid sugar, empty calories and artificial orange flavours."
    },
    "mirinda": {
        "name": "Mirinda", "score": 25.0, "rating": "Not good",
        "verdict": "Not good choice. High in liquid sugar, empty calories and artificial flavouring."
    },
    "7up": {
        "name": "7Up", "score": 25.0, "rating": "Not good",
        "verdict": "Not good choice. High in liquid sugar, empty calories and artificial lemon flavours."
    },
    "seven up": {
        "name": "7Up", "score": 25.0, "rating": "Not good",
        "verdict": "Not good choice. High in liquid sugar, empty calories and carbonation."
    },
    "fizzy drink": {
        "name": "Fizzy Drink", "score": 25.0, "rating": "Not good",
        "verdict": "Not good choice. High in liquid sugar, empty calories and carbonation."
    },
    "aerated drink": {
        "name": "Aerated Drink", "score": 25.0, "rating": "Not good",
        "verdict": "Not good choice. High in liquid sugar, empty calories and carbonation."
    },
    "carbonated drink": {
        "name": "Carbonated Drink", "score": 25.0, "rating": "Not good",
        "verdict": "Not good choice. High in liquid sugar, empty calories and carbonation."
    },
    "soda": {
        "name": "Soda", "score": 35.0, "rating": "Not good",
        "verdict": "Not good choice. Commercial sodas are high in carbonation and acidity with zero nutritional value."
    },
    "diet coke": {
        "name": "Diet Coke", "score": 35.0, "rating": "Not good",
        "verdict": "Not good choice. Contains artificial sweeteners (aspartame) and zero nutrients."
    },
    "coke zero": {
        "name": "Coke Zero", "score": 35.0, "rating": "Not good",
        "verdict": "Not good choice. Contains artificial sweeteners and zero nutrients."
    },
    "pepsi black": {
        "name": "Pepsi Black", "score": 35.0, "rating": "Not good",
        "verdict": "Not good choice. Contains artificial sweeteners and zero nutrients."
    },
    "sting": {
        "name": "Sting Energy Drink", "score": 20.0, "rating": "Not good",
        "verdict": "Not good choice. Extremely high in sugar, synthetic caffeine, and chemical additives."
    },
    "sting energy drink": {
        "name": "Sting Energy Drink", "score": 20.0, "rating": "Not good",
        "verdict": "Not good choice. Extremely high in sugar, synthetic caffeine, and chemical additives."
    },
    "monster": {
        "name": "Monster Energy Drink", "score": 20.0, "rating": "Not good",
        "verdict": "Not good choice. Excessive sugar, synthetic caffeine, taurine and chemicals."
    },
    "monster energy": {
        "name": "Monster Energy Drink", "score": 20.0, "rating": "Not good",
        "verdict": "Not good choice. Excessive sugar, synthetic caffeine, taurine and chemicals."
    },
    # Common snacks & fast foods
    "chips": {
        "name": "Chips", "score": 20.0, "rating": "Not good",
        "verdict": "Not good choice. Ultra-processed potato chips fried in palm oil, high sodium."
    },
    "lays": {
        "name": "Lay's Chips", "score": 20.0, "rating": "Not good",
        "verdict": "Not good choice. Ultra-processed potato chips fried in palm oil, high sodium."
    },
    "doritos": {
        "name": "Doritos", "score": 20.0, "rating": "Not good",
        "verdict": "Not good choice. Fried corn chips with artificial flavor powders and preservatives."
    },
    "maggi": {
        "name": "Maggi Noodles", "score": 25.0, "rating": "Not good",
        "verdict": "Not good choice. Refined maida noodles flash-fried in palm oil, high in sodium."
    },
    "instant noodles": {
        "name": "Instant Noodles", "score": 25.0, "rating": "Not good",
        "verdict": "Not good choice. Refined maida noodles flash-fried in palm oil, high in sodium."
    },
    "french fries": {
        "name": "French Fries", "score": 22.0, "rating": "Not good",
        "verdict": "Not good choice. Deep fried in trans-fat oils, high glycemic index and high sodium."
    },
    "fries": {
        "name": "French Fries", "score": 22.0, "rating": "Not good",
        "verdict": "Not good choice. Deep fried in trans-fat oils, high glycemic index and high sodium."
    }
}

def score_from_flags(flags_dict: dict) -> float:
    """Calculate score from user-provided food property flags.
    Matches dataset distribution: Good (65-90), Okay (40-61), Not good (0-38).
    """
    # Positive nutritional attributes
    pos_points = (
        (15 if flags_dict.get("Healthy") else 0) +
        (15 if flags_dict.get("Good_food") else 0) +
        (5 if flags_dict.get("Protein_rich") else 0) +
        (5 if flags_dict.get("Fibre_rich") else 0)
    )

    # Negative attributes
    is_sugary_drink = flags_dict.get("Sugary_drink", False)
    sugar = flags_dict.get("Sugar", False)
    junk = flags_dict.get("Junk", False)
    fried = flags_dict.get("Fried", False)
    refined = flags_dict.get("Refined", False)
    oil = flags_dict.get("Oil", False)
    ghee = flags_dict.get("Ghee", False)

    neg_points = (
        (25 if is_sugary_drink else 0) +
        (12 if sugar else 0) +
        (15 if junk else 0) +
        (15 if fried else 0) +
        (8 if refined else 0) +
        (5 if (oil or ghee) else 0)
    )

    # If item has NO positive nutritional attributes:
    if pos_points == 0:
        # Any sugary drink / soda is directly Not good (25)
        if is_sugary_drink:
            return 25.0
        # Any item with negative flags cannot be Okay
        if neg_points > 0:
            return float(np.clip(35 - neg_points + 5, 10, 35))
        # Unverified item with no positive and no negative flags gets cautious score
        return 35.0

    # If item HAS positive nutritional attributes:
    base = 45.0
    raw_score = base + pos_points - neg_points

    # Sugary drinks or high sugar without whole food cannot be Good/Okay
    if is_sugary_drink:
        return 25.0
    if sugar and not flags_dict.get("Healthy") and not flags_dict.get("Good_food"):
        return float(np.clip(raw_score, 15, 35))

    return float(np.clip(raw_score, 10, 90))

def lookup_in_dataset(name: str):
    """Try custom foods, alias, then exact, then partial, then token/inversion match, then fuzzy match in dataset."""
    if not name or not name.strip():
        return None
    q = name.strip().lower()

    # 0. User-saved custom foods check first
    custom_foods = load_custom_foods()
    if q in custom_foods:
        cf = custom_foods[q]
        return pd.Series({
            "Name": cf["Name"],
            "Score": cf["Score"],
            "Rating": cf["Rating"],
            "verdict": cf.get("verdict", verdict_text(cf["Rating"], cf["Score"]))
        })

    # 1. Alias lookup (e.g. 'soft drink', 'coke', 'cold drink', 'chips', 'maggi')
    if q in COMMON_FOOD_ALIASES:
        a = COMMON_FOOD_ALIASES[q]
        return pd.Series({
            "Name": a["name"],
            "Score": a["score"],
            "Rating": a["rating"],
            "verdict": a.get("verdict", verdict_text(a["rating"], a["score"]))
        })

    if df_foods is None or df_foods.empty:
        return None

    # 2. Exact match
    exact = df_foods[df_foods["_name_lower"] == q]
    if not exact.empty:
        return exact.iloc[0]

    # 3. Word-boundary partial
    partial = df_foods[df_foods["_name_lower"].str.contains(r'\b' + q + r'\b', regex=True, na=False)]
    if not partial.empty:
        return partial.iloc[0]

    # 4. Token-based match: check if all words are present
    words = [w for w in q.split() if len(w) > 2]
    if len(words) > 1:
        mask = pd.Series(True, index=df_foods.index)
        for w in words:
            mask = mask & df_foods["_name_lower"].str.contains(w, na=False)
        token_match = df_foods[mask]
        if not token_match.empty:
            return token_match.iloc[0]

    # 5. Inversion aliases like 'rice sambar' -> 'sambar rice'
    if len(words) == 2:
        inverted = f"{words[1]} {words[0]}"
        inv_match = df_foods[df_foods["_name_lower"].str.contains(inverted, na=False)]
        if not inv_match.empty:
            return inv_match.iloc[0]

    # 6. Loose contains
    loose = df_foods[df_foods["_name_lower"].str.contains(q, na=False)]
    if not loose.empty:
        return loose.iloc[0]

    # 7. Fuzzy match for typos (e.g. 'sprit' -> 'Sprite', 'burgar' -> 'Burger', 'choclate' -> 'Chocolate')
    if len(q) >= 4:
        matches = difflib.get_close_matches(q, df_foods["_name_lower"].tolist(), n=1, cutoff=0.75)
        if matches:
            matched_row = df_foods[df_foods["_name_lower"] == matches[0]]
            if not matched_row.empty:
                return matched_row.iloc[0]

    return None

def ml_score(name: str) -> float:
    """Fallback: run the LR pipeline on just the name, with heuristic guards for obvious items."""
    nl = name.strip().lower()

    # Heuristic guard 1: Sodas, soft drinks, energy drinks
    drink_keywords = ['drink', 'soda', 'cola', 'coke', 'fizz', 'pepsi', 'sprite', 'fanta', 'dew', 'beverage']
    if any(w in nl for w in drink_keywords):
        return 25.0

    # Heuristic guard 2: Chips, fries, junk snacks
    junk_keywords = ['chips', 'crisps', 'fry', 'fries', 'kurkure', 'doritos']
    if any(w in nl for w in junk_keywords):
        return 22.0

    if not model_data or "models" not in model_data:
        return 35.0

    models = model_data["models"]
    row = pd.DataFrame([{
        "text": f"{nl} | {nl}",
        "Category": "Other", "Course": "main course",
        "Diet": "vegetarian", "Flavor": "mild"
    }])
    delta = sum(POINTS[f] * int(models[f].predict(row)[0]) for f in FLAGS)
    return float(np.clip(45 + delta, 10, 90))

def compute_day_summary(date_str: str, items: list) -> dict:
    day_name = ""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        day_name = dt.strftime("%A")
    except Exception:
        day_name = "Today"

    if not items:
        return {
            "date": date_str,
            "day": day_name,
            "items": [],
            "items_count": 0,
            "total_score": 0.0,
            "overall_rating": "None",
            "overall_verdict": "No food logged yet today. Starts at 0 score."
        }

    scores = [item["score"] for item in items]
    avg_score = round(float(np.mean(scores)), 1)
    ov_rating = rating_label(avg_score)
    ov_verdict = verdict_text(ov_rating, avg_score)

    return {
        "date": date_str,
        "day": day_name,
        "items": items,
        "items_count": len(items),
        "total_score": avg_score,
        "overall_rating": ov_rating,
        "overall_verdict": ov_verdict
    }

# ── Request/Response schemas ──────────────────────────────────────────────────

class ScoreRequest(BaseModel):
    name: str = Field(..., example="Dosa")

class ScoreResponse(BaseModel):
    name: str
    score: float
    rating: str
    verdict: str
    from_dataset: bool

class AddFoodRequest(BaseModel):
    food: str = Field(..., example="Rice Sambar")
    date: Optional[str] = Field(None, example="2026-10-02")
    # Optional: user-provided flags for unknown foods
    custom_flags: Optional[Dict[str, bool]] = Field(None, example={"Healthy": True, "Fried": False})

class CustomScoreRequest(BaseModel):
    name: str = Field(..., example="My Homemade Soup")
    flags: Dict[str, bool] = Field(..., example={"Healthy": True, "Good_food": True, "Fried": False, "Junk": False})

class DayRequest(BaseModel):
    foods: list[str]

class DayResponse(BaseModel):
    items: list[dict]
    overall_score: float
    overall_rating: str
    overall_verdict: str

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "dataset_rows": len(df_foods) if df_foods is not None else 0}

@app.post("/api/score", response_model=ScoreResponse)
def score_one(req: ScoreRequest):
    if not req.name.strip():
        raise HTTPException(400, "Food name cannot be empty.")

    row = lookup_in_dataset(req.name)
    if row is not None and not pd.isna(row["Score"]):
        s = float(row["Score"])
        # Use dataset's own Rating column directly
        r = str(row["Rating"]) if "Rating" in row.index and not pd.isna(row["Rating"]) else rating_label(s)
        v = str(row["verdict"]) if "verdict" in row.index and pd.notna(row["verdict"]) else verdict_text(r, s)
        return ScoreResponse(
            name=str(row["Name"]),
            score=s,
            rating=r,
            verdict=v,
            from_dataset=True
        )

    # Food NOT in dataset — return from_dataset=False so frontend can ask user
    s = ml_score(req.name)
    r = rating_label(s)
    return ScoreResponse(
        name=req.name.strip().title(),
        score=round(s, 1),
        rating=r,
        verdict=verdict_text(r, s),
        from_dataset=False
    )

@app.post("/api/score-custom")
def score_custom(req: CustomScoreRequest):
    """Score an unknown food based on user-provided property flags."""
    if not req.name.strip():
        raise HTTPException(400, "Food name cannot be empty.")
    s = score_from_flags(req.flags)
    r = rating_label(s)
    v = "Not good choice. High in liquid sugar, empty calories, artificial additives and carbonation." if req.flags.get("Sugary_drink") else verdict_text(r, s)
    return {
        "name": req.name.strip().title(),
        "score": round(s),
        "rating": r,
        "verdict": v,
        "from_dataset": False,
        "user_scored": True
    }

@app.post("/api/day-score", response_model=DayResponse)
def score_day(req: DayRequest):
    if not req.foods:
        raise HTTPException(400, "Provide at least one food.")

    items = []
    for name in req.foods:
        res = score_one(ScoreRequest(name=name))
        items.append({
            "name": res.name,
            "score": res.score,
            "rating": res.rating,
            "verdict": res.verdict
        })

    scores = [i["score"] for i in items]
    overall = round(float(np.mean(scores)), 1)
    overall_rating = rating_label(overall)
    return DayResponse(
        items=items,
        overall_score=overall,
        overall_rating=overall_rating,
        overall_verdict=verdict_text(overall_rating, overall)
    )

POPULAR_FOOD_NAMES = {
    # B foods
    "burger", "biryani", "banana", "bread", "brown rice", "butter chicken", "boiled egg",
    "bhel puri", "bajra roti", "bhatura", "butter naan", "butter roti", "baked samosa",
    "beans poriyal", "beans sabzi", "beetroot", "besan chilla", "bhindi fry", "baingan bharta",
    "bisi bele bath", "black coffee", "brownie", "biscuits", "broccoli", "batata vada",
    "beef biryani", "bombay biryani", "baby corn",
    # P foods
    "pizza", "pasta", "paneer butter masala", "paneer tikka", "poha", "paratha", "peanuts",
    "plain rice", "pulao", "pani puri", "pakora", "protein shake", "papaya",
    # C foods
    "chicken curry", "chicken biryani", "chapati", "curd rice", "cold drink", "coke",
    "chips", "coffee", "cheese burger", "chana masala", "caesar salad",
    # D & others
    "dosa", "dal", "dal tadka", "diet coke", "egg bhurji", "egg curry", "fish curry",
    "french fries", "fruit salad", "green tea", "grilled chicken", "gulab jamun",
    "idli", "ice cream", "juice", "khichdi", "lassi", "maggi", "noodles", "oats",
    "omelette", "orange", "rajma chawal", "roti", "salad", "samosa", "sandwich",
    "sprouts", "upma", "veg burger", "veg biryani", "white rice", "watermelon"
}

@app.get("/api/suggestions")
def suggestions(q: Optional[str] = Query(None)):
    """Returns comprehensive food suggestions with name, score and rating.
    Prioritizes user custom foods, popular everyday foods, starts-with matches,
    and returns rich results (up to 30 items) with clean sorting."""

    def row_to_suggestion(row):
        score_val = row.get("Score", 50) if hasattr(row, 'get') else (row["Score"] if "Score" in row else 50)
        s = float(score_val) if not pd.isna(score_val) else 50
        rating_val = row.get("Rating", None) if hasattr(row, 'get') else (row["Rating"] if "Rating" in row else None)
        r = str(rating_val) if rating_val and not pd.isna(rating_val) else rating_label(s)
        name_val = row.get("Name", "") if hasattr(row, 'get') else row["Name"]
        return {"name": str(name_val), "score": round(s), "rating": r}

    # Default popular suggestions when no query
    if not q or len(q.strip()) < 1:
        defaults = ["Dosa","Idli","Chapati","Brown Rice","Dal","Sprouts","Poha",
                     "Upma","Paratha","Curd Rice","Biryani","Paneer Butter Masala",
                     "Pizza","Burger","Samosa","Gulab Jamun","Ice Cream","Oats",
                     "Egg Bhurji","Chicken Curry","Grilled Fish","Salad"]
        results = []
        for name in defaults:
            row = lookup_in_dataset(name)
            if row is not None:
                results.append(row_to_suggestion(row))
            else:
                results.append({"name": name, "score": 50, "rating": "Okay"})
        return {"suggestions": results, "total": len(results)}

    ql = q.strip().lower()
    custom_foods = load_custom_foods()
    seen = set()
    out = []

    # 1. Check user-saved custom foods first
    for ck, cv in custom_foods.items():
        if ck.startswith(ql) or (len(ql) >= 2 and ql in ck):
            if ck not in seen:
                seen.add(ck)
                out.append({
                    "name": cv["Name"],
                    "score": round(cv["Score"]),
                    "rating": cv["Rating"]
                })

    # 2. Check matching aliases
    for ak, av in COMMON_FOOD_ALIASES.items():
        if ak.startswith(ql) or (len(ql) >= 2 and ql in ak):
            low_name = av["name"].lower()
            if low_name not in seen:
                seen.add(low_name)
                out.append({
                    "name": av["name"],
                    "score": round(av["score"]),
                    "rating": av["rating"]
                })

    # 3. Search dataset
    if df_foods is not None and not df_foods.empty:
        escaped_q = re.escape(ql)
        boundary_pattern = r'\b' + escaped_q
        
        matched_mask = df_foods["_name_lower"].str.contains(boundary_pattern, regex=True, na=False)
        if len(ql) >= 3:
            matched_mask = matched_mask | df_foods["_name_lower"].str.contains(escaped_q, na=False)
            
        matched_df = df_foods[matched_mask].drop_duplicates(subset=["_name_lower"])

        def rank_match(row):
            n = str(row["_name_lower"])
            if n == ql:
                return (0, 0, len(n), n)
            if n.startswith(ql) and (n in POPULAR_FOOD_NAMES or any(n.startswith(p) for p in POPULAR_FOOD_NAMES)):
                return (1, 0, len(n), n)
            if n.startswith(ql):
                return (2, len(n), 0, n)
            if any(p in n for p in POPULAR_FOOD_NAMES):
                return (3, len(n), 0, n)
            return (4, len(n), 0, n)

        sorted_rows = sorted(matched_df.to_dict('records'), key=rank_match)

        for row in sorted_rows:
            low_name = str(row["Name"]).strip().lower()
            if low_name not in seen:
                seen.add(low_name)
                out.append(row_to_suggestion(row))
            if len(out) >= 30:
                break

    return {"suggestions": out[:30], "total": len(out)}

# ── Food Tracker Dataset Endpoints ─────────────────────────────────────────────

@app.get("/api/logs")
def get_day_log(date_query: Optional[str] = Query(None, alias="date"), x_user_email: Optional[str] = Header(None)):
    """Returns the food log, total day score, and water hydration summary for a specific date (defaults to today)."""
    target_date = date_query.strip() if date_query else datetime.now().strftime("%Y-%m-%d")
    all_logs = load_food_logs(x_user_email)
    day_data = all_logs.get(target_date, {})
    items = day_data.get("items", [])
    summary = compute_day_summary(target_date, items)
    
    # Attach water hydration summary for this date
    all_water = load_water_logs(x_user_email)
    water_data = all_water.get(target_date, {})
    summary["water"] = compute_water_day_summary(target_date, water_data)
    return summary

@app.get("/api/logs/all")
def get_all_logs(x_user_email: Optional[str] = Header(None)):
    """Returns all logged days in the persistent dataset (food logs + water reminder logs), sorted by date descending."""
    all_food_logs = load_food_logs(x_user_email)
    all_water_logs = load_water_logs(x_user_email)
    
    # Collect union of all logged dates across both food and water records
    all_dates = sorted(set(list(all_food_logs.keys()) + list(all_water_logs.keys())), reverse=True)
    
    days_list = []
    for date_str in all_dates:
        food_data = all_food_logs.get(date_str, {})
        water_data = all_water_logs.get(date_str, {})
        
        food_summary = compute_day_summary(date_str, food_data.get("items", []))
        water_summary = compute_water_day_summary(date_str, water_data)
        
        day_combined = {
            **food_summary,
            "water": water_summary
        }
        days_list.append(day_combined)
        
    return {"days": days_list, "total_logged_days": len(days_list)}

@app.get("/api/dataset")
def get_full_dataset(x_user_email: Optional[str] = Header(None)):
    """Endpoint returning complete combined dataset of daily meals, nutrition scores, and water hydration logs."""
    return get_all_logs(x_user_email)

@app.post("/api/logs")
def add_food_log(req: AddFoodRequest, x_user_email: Optional[str] = Header(None)):
    """Scores a food against the database, saves it to the day's dataset, and recalculates total day score."""
    food_name = req.food.strip()
    if not food_name:
        raise HTTPException(400, "Food name cannot be empty.")
    
    target_date = req.date.strip() if req.date else datetime.now().strftime("%Y-%m-%d")
    
    # If user provided custom flags for unknown food, use custom scoring
    if req.custom_flags:
        s = score_from_flags(req.custom_flags)
        r = rating_label(s)
        current_time = datetime.now().strftime("%I:%M %p")
        v = "Not good choice. High in liquid sugar, empty calories, artificial additives and carbonation." if req.custom_flags.get("Sugary_drink") else verdict_text(r, s)
        new_item = {
            "id": f"item-{int(time.time() * 1000)}",
            "name": food_name.strip().title(),
            "score": round(s),
            "rating": r,
            "verdict": v,
            "time": current_time,
            "from_dataset": False,
            "user_scored": True
        }

        # Persist this custom-scored food into the dataset so it won't ask
        # questions again next time the same food is typed
        save_custom_food_record(
            name=food_name,
            score=round(s),
            rating=r,
            verdict=v,
            flags=req.custom_flags
        )
    else:
        # Score from dataset or ML fallback
        score_res = score_one(ScoreRequest(name=food_name))
        current_time = datetime.now().strftime("%I:%M %p")
        new_item = {
            "id": f"item-{int(time.time() * 1000)}",
            "name": score_res.name,
            "score": score_res.score,
            "rating": score_res.rating,
            "verdict": score_res.verdict,
            "time": current_time,
            "from_dataset": score_res.from_dataset
        }
    
    all_logs = load_food_logs(x_user_email)
    if target_date not in all_logs:
        dt = datetime.strptime(target_date, "%Y-%m-%d") if target_date else datetime.now()
        all_logs[target_date] = {
            "date": target_date,
            "day": dt.strftime("%A"),
            "items": []
        }
        
    all_logs[target_date]["items"].append(new_item)
    save_food_logs(all_logs, x_user_email)
    
    day_summary = compute_day_summary(target_date, all_logs[target_date]["items"])
    return {
        "added_item": new_item,
        "day_summary": day_summary
    }

@app.delete("/api/logs/{item_id}")
def delete_food_log(item_id: str, date_query: Optional[str] = Query(None, alias="date"), x_user_email: Optional[str] = Header(None)):
    """Removes a food item from the dataset and recalculates day score."""
    target_date = date_query.strip() if date_query else datetime.now().strftime("%Y-%m-%d")
    all_logs = load_food_logs(x_user_email)
    if target_date in all_logs:
        items = all_logs[target_date].get("items", [])
        updated_items = [i for i in items if i.get("id") != item_id]
        all_logs[target_date]["items"] = updated_items
        save_food_logs(all_logs, x_user_email)
        return compute_day_summary(target_date, updated_items)
    
    return compute_day_summary(target_date, [])

# ── Water Tracker & Hourly Reminder Endpoints ─────────────────────────────────

class AddWaterRequest(BaseModel):
    date: Optional[str] = Field(None, example="2026-10-03")
    amount_ml: int = Field(250, example=250)
    type: Optional[str] = Field("Glass of water", example="Glass of water")

class UpdateWaterTargetRequest(BaseModel):
    date: Optional[str] = Field(None, example="2026-10-03")
    target_ml: int = Field(2500, example=2500)

@app.get("/api/water")
def get_water_log(date_query: Optional[str] = Query(None, alias="date"), x_user_email: Optional[str] = Header(None)):
    """Returns the water log and hydration progress for a specific date (defaults to today)."""
    target_date = date_query.strip() if date_query else datetime.now().strftime("%Y-%m-%d")
    all_logs = load_water_logs(x_user_email)
    day_record = all_logs.get(target_date, {})
    return compute_water_day_summary(target_date, day_record)

@app.post("/api/water")
def add_water_entry(req: AddWaterRequest, x_user_email: Optional[str] = Header(None)):
    """Adds a glass or bottle of water drank, updating daily hydration total."""
    target_date = req.date.strip() if req.date else datetime.now().strftime("%Y-%m-%d")
    current_time = datetime.now().strftime("%I:%M %p")
    all_logs = load_water_logs(x_user_email)

    if target_date not in all_logs:
        all_logs[target_date] = {
            "date": target_date,
            "target_ml": 2500,
            "entries": []
        }

    new_entry = {
        "id": f"water-{int(time.time() * 1000)}",
        "amount_ml": int(req.amount_ml),
        "type": req.type.strip() if req.type else "Glass of water",
        "time": current_time
    }

    all_logs[target_date]["entries"].append(new_entry)
    save_water_logs(all_logs, x_user_email)

    day_summary = compute_water_day_summary(target_date, all_logs[target_date])
    return {
        "added_entry": new_entry,
        "day_summary": day_summary
    }

@app.delete("/api/water/{entry_id}")
def delete_water_entry(entry_id: str, date_query: Optional[str] = Query(None, alias="date"), x_user_email: Optional[str] = Header(None)):
    """Deletes a water entry and recalculates daily hydration progress."""
    target_date = date_query.strip() if date_query else datetime.now().strftime("%Y-%m-%d")
    all_logs = load_water_logs(x_user_email)

    if target_date in all_logs:
        entries = all_logs[target_date].get("entries", [])
        updated_entries = [e for e in entries if e.get("id") != entry_id]
        all_logs[target_date]["entries"] = updated_entries
        save_water_logs(all_logs, x_user_email)
        return compute_water_day_summary(target_date, all_logs[target_date])

    return compute_water_day_summary(target_date, {})

@app.put("/api/water/target")
def update_water_target(req: UpdateWaterTargetRequest, x_user_email: Optional[str] = Header(None)):
    """Updates the daily water intake target in ml."""
    target_date = req.date.strip() if req.date else datetime.now().strftime("%Y-%m-%d")
    all_logs = load_water_logs(x_user_email)

    if target_date not in all_logs:
        all_logs[target_date] = {
            "date": target_date,
            "target_ml": req.target_ml,
            "entries": []
        }
    else:
        all_logs[target_date]["target_ml"] = req.target_ml

    save_water_logs(all_logs, x_user_email)
    return compute_water_day_summary(target_date, all_logs[target_date])


# ── Day plan (free-text note per user per date) ───────────────────────────────

class PlanRequest(BaseModel):
    date: str = Field(..., example="2026-10-06")
    text: str = Field("", example="Oats for breakfast, no fried snacks, 3L water")

@app.get("/api/plan")
def get_plan(date_query: Optional[str] = Query(None, alias="date"), x_user_email: Optional[str] = Header(None)):
    """Returns the user's written plan for a date (defaults to today)."""
    target_date = date_query.strip() if date_query else datetime.now().strftime("%Y-%m-%d")
    return {"date": target_date, "text": load_plan(x_user_email, target_date)}

@app.put("/api/plan")
def put_plan(req: PlanRequest, x_user_email: Optional[str] = Header(None)):
    """Saves (or clears, when empty) the user's written plan for a date."""
    target_date = req.date.strip()
    try:
        datetime.strptime(target_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Date must be YYYY-MM-DD.")
    text = req.text[:4000]
    save_plan(x_user_email, target_date, text)
    return {"date": target_date, "text": text if text.strip() else ""}

# ── Pet, daily tasks and badges (all derived from the user's own logs) ─────────
import random
from datetime import timedelta

PET_STAGES = [
    {"name": "Puppy", "min_good_days": 0},
    {"name": "Young dog", "min_good_days": 3},
    {"name": "Adult", "min_good_days": 7},
    {"name": "Champion", "min_good_days": 14},
]

def _is_bad_item(item: dict) -> bool:
    return item.get("rating") in ("Bad", "Not good") or float(item.get("score", 0)) < 40

def _day_food_stats(day: Optional[dict]) -> dict:
    items = (day or {}).get("items", [])
    scores = [float(i.get("score", 0)) for i in items]
    avg = round(sum(scores) / len(scores), 1) if scores else 0.0
    return {
        "items": items,
        "count": len(items),
        "avg": avg,
        "bad": sum(1 for i in items if _is_bad_item(i)),
        "good": sum(1 for i in items if float(i.get("score", 0)) >= 65),
        "high": sum(1 for i in items if float(i.get("score", 0)) >= 80),
        "top": sum(1 for i in items if float(i.get("score", 0)) >= 85),
    }

def _minutes(time_str: Optional[str]) -> Optional[int]:
    """'01:36 PM' -> minutes after midnight."""
    try:
        t = datetime.strptime((time_str or "").strip(), "%I:%M %p")
        return t.hour * 60 + t.minute
    except Exception:
        return None

def _longest_run(date_set) -> int:
    best, run, prev = 0, 0, None
    for d in sorted(date_set):
        dt = datetime.strptime(d, "%Y-%m-%d")
        run = run + 1 if prev and (dt - prev).days == 1 else 1
        best = max(best, run)
        prev = dt
    return best

def _build_tasks(date_str: str, food_logs: dict, water_logs: dict, plans: dict) -> list:
    """Six tasks for one day: two fixed, four picked from a pool (same picks for everyone that day)."""
    day_dt = datetime.strptime(date_str, "%Y-%m-%d")
    now = datetime.now()
    is_past = date_str < now.strftime("%Y-%m-%d")
    is_today = date_str == now.strftime("%Y-%m-%d")
    now_min = now.hour * 60 + now.minute

    f = _day_food_stats(food_logs.get(date_str))
    water = compute_water_day_summary(date_str, water_logs.get(date_str, {}))
    entries = water["entries"]
    pct = int(water["percentage"])
    before_noon = sum(int(e.get("amount_ml", 0)) for e in entries
                      if (_minutes(e.get("time")) is not None and _minutes(e.get("time")) < 720))
    meal_times = [m for m in (_minutes(i.get("time")) for i in f["items"]) if m is not None]
    first_meal = min(meal_times) if meal_times else None
    yesterday = _day_food_stats(food_logs.get((day_dt - timedelta(days=1)).strftime("%Y-%m-%d")))
    tomorrow = (day_dt + timedelta(days=1)).strftime("%Y-%m-%d")
    avg = f["avg"]

    def deadline_passed(minute_of_day):
        return is_past or (is_today and now_min >= minute_of_day)

    def t(tid, title, xp, done, status="", failed=False):
        failed = bool(failed) and not done
        return {"id": tid, "title": title, "xp": xp, "done": bool(done), "failed": failed, "status": status}

    fixed = [
        t("no_junk", "No junk or fried food, with at least 3 meals logged", 30,
          f["count"] >= 3 and f["bad"] == 0, f"{min(f['count'], 3)} / 3 meals", failed=f["bad"] > 0),
        t("water_goal", "Reach your water goal", 20, pct >= 100, f"{pct}%"),
    ]

    pool = [
        t("avg_65", "Keep today's average score at 65 or higher (3+ meals)", 40,
          f["count"] >= 3 and avg >= 65, f"avg {round(avg)}" if f["count"] else ""),
        t("avg_75", "Finish with an average of 75 or higher (3+ meals)", 50,
          f["count"] >= 3 and avg >= 75, f"avg {round(avg)}" if f["count"] else ""),
        t("high_two", "Eat 2 foods that score 80 or more", 30, f["high"] >= 2, f"{min(f['high'], 2)} / 2"),
        t("top_food", "Eat one food that scores 85 or more", 20, f["top"] >= 1),
        t("all_ok", "Log 4 meals, all rated Okay or better", 40,
          f["count"] >= 4 and f["bad"] == 0, f"{min(f['count'], 4)} / 4", failed=f["bad"] > 0),
        t("early_water", "Drink 1 L of water before noon", 30,
          before_noon >= 1000, f"{before_noon} ml", failed=deadline_passed(720)),
        t("breakfast", "Log breakfast before 10 AM", 20,
          first_meal is not None and first_meal < 600, failed=deadline_passed(600)),
        t("six_drinks", "Spread your water over 6 separate drinks", 20, len(entries) >= 6, f"{min(len(entries), 6)} / 6"),
        t("plan_tomorrow", "Write tomorrow's plan", 10, bool(str(plans.get(tomorrow, "")).strip())),
    ]
    if yesterday["count"] > 0:
        pool.append(t("beat_yesterday", "Beat yesterday's average score (2+ meals)", 30,
                      f["count"] >= 2 and avg > yesterday["avg"],
                      f"{round(avg)} vs {round(yesterday['avg'])}" if f["count"] else f"beat {round(yesterday['avg'])}"))

    rng = random.Random(f"fitgoals-tasks-{date_str}")
    picks = rng.sample(pool, 4)
    # never offer both average-score targets on the same day
    ids = [p["id"] for p in picks]
    if "avg_65" in ids and "avg_75" in ids:
        spare = [p for p in pool if p["id"] not in ids]
        picks[ids.index("avg_65")] = rng.choice(spare)
    return fixed + picks

def compute_pet_bundle(email: Optional[str], target_date: str) -> dict:
    """Pet state, daily tasks and badges for one user and one day."""
    day_dt = datetime.strptime(target_date, "%Y-%m-%d")
    food_logs = load_food_logs(email)
    water_logs = load_water_logs(email)
    plans = _load_user_logs(PLANS_FILE, email)

    # ---- today
    today = _day_food_stats(food_logs.get(target_date))
    water_today = compute_water_day_summary(target_date, water_logs.get(target_date, {}))
    water_pct = int(water_today["percentage"])

    health = None
    if today["count"] > 0:
        health = today["avg"] / 90 * 100 - 8 * today["bad"]
        health += 10 if water_pct >= 100 else 5 if water_pct >= 50 else 0
        health = int(max(0, min(100, round(health))))

    if health is None:
        mood, message = "hungry", "I haven't eaten yet today. Log a meal to feed me."
    elif health >= 70:
        mood, message = "happy", "That was good food. I feel great."
    elif health >= 45:
        mood, message = "okay", "I'm fine. A cleaner meal would make me happier."
    elif health >= 20:
        mood, message = "sick", "Too much junk today. I don't feel well."
    else:
        mood, message = "dead", "Today's food was too much for me. I'll be back tomorrow."

    # ---- history (days up to and including the target date)
    past_dates = sorted(d for d in food_logs.keys() if d <= target_date)
    day_stats = {d: _day_food_stats(food_logs[d]) for d in past_dates}
    logged_days = [d for d in past_dates if day_stats[d]["count"] > 0]
    good_days = sum(1 for d in logged_days if day_stats[d]["avg"] >= 65)
    meals_total = sum(day_stats[d]["count"] for d in logged_days)
    clean_dates = {d for d in logged_days if day_stats[d]["bad"] == 0}

    best_clean = _longest_run(clean_dates)
    best_logging = _longest_run(logged_days)

    cursor = day_dt if target_date in clean_dates else day_dt - timedelta(days=1)
    current_streak = 0
    if today["bad"] == 0:
        while cursor.strftime("%Y-%m-%d") in clean_dates:
            current_streak += 1
            cursor -= timedelta(days=1)

    hydrated_dates = {d for d, rec in water_logs.items()
                      if d <= target_date and int(compute_water_day_summary(d, rec or {})["percentage"]) >= 100}
    hydrated_days = len(hydrated_dates)
    best_hydrated = _longest_run(hydrated_dates)
    plan_days = sum(1 for d, text in plans.items() if str(text).strip())

    stage_index = max(i for i, st in enumerate(PET_STAGES) if good_days >= st["min_good_days"])
    next_stage = PET_STAGES[stage_index + 1] if stage_index + 1 < len(PET_STAGES) else None

    # ---- tasks
    tasks = _build_tasks(target_date, food_logs, water_logs, plans)
    perfect_days = sum(1 for d in logged_days
                       if all(tk["done"] for tk in (tasks if d == target_date else _build_tasks(d, food_logs, water_logs, plans))))

    # ---- badges
    def badge(bid, title, desc, progress, target, tier, group):
        progress = min(progress, target)
        return {"id": bid, "title": title, "description": desc, "progress": progress, "target": target,
                "earned": progress >= target, "tier": tier, "group": group}

    badges = [
        badge("first_bite", "First bite", "Log your first meal", meals_total, 1, "bronze", "Logging"),
        badge("streak_7", "One week", "Log food 7 days in a row", best_logging, 7, "bronze", "Logging"),
        badge("streak_10", "Ten days", "Log food 10 days in a row", best_logging, 10, "silver", "Logging"),
        badge("streak_30", "One month", "Log food 30 days in a row", best_logging, 30, "gold", "Logging"),
        badge("fifty", "Fifty meals", "Log 50 meals", meals_total, 50, "silver", "Logging"),
        badge("hundred", "Hundred meals", "Log 100 meals", meals_total, 100, "gold", "Logging"),

        badge("clean_3", "Clean run", "3 days in a row with no junk", best_clean, 3, "bronze", "Clean eating"),
        badge("clean_7", "Clean week", "7 days in a row with no junk", best_clean, 7, "silver", "Clean eating"),
        badge("clean_10", "Clean ten", "10 days in a row with no junk", best_clean, 10, "silver", "Clean eating"),
        badge("clean_30", "Clean month", "30 days in a row with no junk", best_clean, 30, "gold", "Clean eating"),
        badge("good_day", "Good day", "Finish a day with a Good score", good_days, 1, "bronze", "Clean eating"),
        badge("good_10", "Ten good days", "Finish 10 days with a Good score", good_days, 10, "silver", "Clean eating"),
        badge("good_30", "Thirty good days", "Finish 30 days with a Good score", good_days, 30, "gold", "Clean eating"),

        badge("hydrated", "Hydrated", "Reach your water goal once", hydrated_days, 1, "bronze", "Water"),
        badge("hydrated_7", "Watered week", "Reach your water goal 7 days in a row", best_hydrated, 7, "silver", "Water"),
        badge("hydrated_30", "Watered month", "Reach your water goal on 30 days", hydrated_days, 30, "gold", "Water"),

        badge("perfect_day", "Perfect day", "Complete every daily task in one day", perfect_days, 1, "silver", "Tasks and pet"),
        badge("perfect_7", "Seven perfect days", "Complete every daily task on 7 days", perfect_days, 7, "gold", "Tasks and pet"),
        badge("planner", "Planner", "Write a plan for 3 days", plan_days, 3, "bronze", "Tasks and pet"),
        badge("full_grown", "Full grown", "Raise your dog to Adult", good_days, 7, "silver", "Tasks and pet"),
        badge("champion", "Champion", "Raise your dog to Champion", good_days, 14, "gold", "Tasks and pet"),
    ]

    return {
        "date": target_date,
        "pet": {
            "name": "Zoof",
            "mood": mood,
            "message": message,
            "health": health,
            "stage": PET_STAGES[stage_index]["name"],
            "stage_index": stage_index,
            "good_days": good_days,
            "next_stage": next_stage["name"] if next_stage else None,
            "next_stage_at": next_stage["min_good_days"] if next_stage else None,
            "clean_streak": current_streak,
            "fed": [{"name": i.get("name"), "score": i.get("score"), "rating": i.get("rating"),
                     "time": i.get("time"), "bad": _is_bad_item(i)} for i in today["items"]],
        },
        "water": {"total_ml": water_today["total_ml"], "target_ml": water_today["target_ml"],
                  "percentage": water_pct, "drinks": len(water_today["entries"])},
        "food": {"count": today["count"], "avg": today["avg"]},
        "tasks": tasks,
        "tasks_done": sum(1 for tk in tasks if tk["done"]),
        "xp_earned": sum(tk["xp"] for tk in tasks if tk["done"]),
        "xp_total": sum(tk["xp"] for tk in tasks),
        "badges": badges,
        "badges_earned": sum(1 for b in badges if b["earned"]),
    }

@app.get("/api/pet")
def get_pet(date_query: Optional[str] = Query(None, alias="date"), x_user_email: Optional[str] = Header(None)):
    """Pet state, daily tasks and badges for the signed-in user."""
    target_date = date_query.strip() if date_query else datetime.now().strftime("%Y-%m-%d")
    try:
        datetime.strptime(target_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Date must be YYYY-MM-DD.")
    return compute_pet_bundle(x_user_email, target_date)

@app.get("/api/profile/{user_id}")
def get_public_profile(user_id: str, date_query: Optional[str] = Query(None, alias="date")):
    """Public card for one athlete (opened from the leaderboard): today's food, water, pet and badges."""
    target_date = date_query.strip() if date_query else datetime.now().strftime("%Y-%m-%d")
    try:
        datetime.strptime(target_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Date must be YYYY-MM-DD.")
    user = load_users().get(user_id)
    if not user:
        raise HTTPException(404, "User not found.")

    stats = compute_user_today_stats(user, target_date)
    bundle = compute_pet_bundle(user.get("email"), target_date)
    return {
        "id": user_id,
        "name": user.get("name"),
        "photo": user.get("photo"),
        "points_formatted": stats.get("points_formatted"),
        "today_food_score": stats.get("today_food_score"),
        "date": target_date,
        "pet": {k: bundle["pet"][k] for k in ("name", "mood", "stage", "stage_index", "health", "clean_streak", "good_days")},
        "ate_today": bundle["pet"]["fed"],
        "water": bundle["water"],
        "tasks_done": bundle["tasks_done"],
        "tasks_total": len(bundle["tasks"]),
        "badges": [b for b in bundle["badges"] if b["earned"]],
        "badges_total": len(bundle["badges"]),
    }

# -------------------------------------------------------------
# DYNAMIC TODAY-BASED AUTHENTICATION & LEADERBOARD SYSTEM
# -------------------------------------------------------------

def init_default_users():
    """Initializes users file if not yet created."""
    if not USERS_FILE.exists():
        try:
            with open(USERS_FILE, "w", encoding="utf-8") as f:
                json.dump({}, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print("Failed to initialize users file:", e)

def load_users() -> dict:
    init_default_users()
    if USERS_FILE.exists():
        try:
            with open(USERS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_users(users: dict):
    try:
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(users, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Failed to save users:", e)

def compute_bmi(height_cm: float, weight_kg: float) -> tuple:
    if height_cm <= 0:
        return 0.0, "Unknown"
    h_m = height_cm / 100.0
    bmi = round(weight_kg / (h_m * h_m), 1)
    if bmi < 18.5:
        category = "Lean"
    elif bmi < 25.0:
        category = "Athletic"
    elif bmi < 30.0:
        category = "Bulking"
    else:
        category = "High BMI"
    return bmi, category

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=60)
    email: str = Field(..., min_length=4, max_length=120)
    password: str = Field(..., min_length=3)
    height: float = Field(..., ge=50, le=260)
    weight: float = Field(..., ge=20, le=350)
    photo: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class UpdateProfileRequest(BaseModel):
    email: str
    name: Optional[str] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    photo: Optional[str] = None

def compute_user_today_stats(user: dict, target_date: Optional[str] = None) -> dict:
    """
    Computes today's exact score strictly from actual meals and water drank today:
    - Diet Points (0 to 1,000 pts): from today's average food score & clean meal bonus
    - Hydration Points (0 to 1,000 pts): from today's ml drank & target %
    - Synergy Bonus (+500 pts): awarded if diet >= 70 and water >= 100%
    """
    if not target_date:
        target_date = datetime.now().strftime("%Y-%m-%d")

    food_logs = load_food_logs(user.get("email"))
    water_logs = load_water_logs(user.get("email"))

    # 1. Food today
    day_food = food_logs.get(target_date, {})
    food_items = day_food.get("items", [])
    food_count = len(food_items)

    clean_meals_count = 0
    junk_meals_count = 0
    total_food_score = 0.0

    for item in food_items:
        score = float(item.get("score", 0))
        total_food_score += score
        rating = item.get("rating", "")
        if rating == "Good" or score >= 60:
            clean_meals_count += 1
        elif rating in ["Bad", "Not good"] or score < 40:
            junk_meals_count += 1

    if food_count > 0:
        food_avg = round(total_food_score / food_count, 1)
        # Food points: average * 10 + clean meal bonus (50 pts each) - junk penalties (30 pts each)
        raw_food_pts = (food_avg * 10) + (clean_meals_count * 50) - (junk_meals_count * 30)
        food_points = max(0, min(1000, int(raw_food_pts)))
        if food_avg >= 75:
            diet_verdict = "Very Clean & Wholesome"
        elif food_avg >= 50:
            diet_verdict = "Balanced & Moderate"
        else:
            diet_verdict = "High in Junk/Sugar"
    else:
        food_avg = 0.0
        food_points = 0
        diet_verdict = "No Meals Logged Yet"

    # 2. Water today
    day_water = water_logs.get(target_date, {})
    water_entries = day_water.get("entries", [])
    water_ml = sum(e.get("amount_ml", 0) for e in water_entries)
    water_target = day_water.get("target_ml", 2500)
    glass_count = len(water_entries)

    if water_target > 0:
        hydration_pct = min(100.0, round((water_ml / water_target) * 100, 1))
    else:
        hydration_pct = 0.0

    if water_ml > 0:
        raw_water_pts = (hydration_pct * 10) + (glass_count * 20)
        water_points = max(0, min(1000, int(raw_water_pts)))
        if hydration_pct >= 100.0:
            hydration_verdict = "100% Hydrated (Target Met!)"
        elif hydration_pct >= 50.0:
            hydration_verdict = f"{hydration_pct:.0f}% Hydrated (On Track)"
        else:
            hydration_verdict = f"{hydration_pct:.0f}% Hydrated (Drink More Water)"
    else:
        water_points = 0
        hydration_verdict = "No Water Logged Yet"

    # 3. Synergy bonus (+500 pts) if diet is good and water is 100%
    synergy_bonus = 0
    if food_count > 0 and food_avg >= 70 and hydration_pct >= 100.0:
        synergy_bonus = 500

    today_points = food_points + water_points + synergy_bonus

    # Determine Level & Tier based on today's performance
    if today_points >= 2000:
        level_tier = "Level 42 - Diamond"
    elif today_points >= 1500:
        level_tier = "Level 35 - Gold"
    elif today_points >= 1000:
        level_tier = "Level 31 - Silver"
    elif today_points >= 400:
        level_tier = "Level 25 - Bronze"
    else:
        level_tier = "Level 10 - Starter"

    h = user.get("height", 175.0)
    w = user.get("weight", 70.0)
    bmi, bmi_cat = compute_bmi(h, w)
    first_letter = (user.get("name", "Y")[:1] or "Y").upper()

    return {
        "id": user.get("id"),
        "name": user.get("name"),
        "email": user.get("email"),
        "photo": user.get("photo"),
        "initial": first_letter,
        "height": h,
        "weight": w,
        "bmi": bmi,
        "bmi_category": bmi_cat,
        "today_food_score": food_avg,
        "today_food_meals": food_count,
        "clean_meals_count": clean_meals_count,
        "diet_verdict": diet_verdict,
        "food_points": food_points,
        "today_water_ml": water_ml,
        "today_water_target": water_target,
        "today_water_pct": hydration_pct,
        "glass_count": glass_count,
        "hydration_verdict": hydration_verdict,
        "water_points": water_points,
        "synergy_bonus": synergy_bonus,
        "points": today_points,
        "points_formatted": f"{today_points:,}",
        "points_display": f"{today_points:,}",
        "level_tier": level_tier,
    }

@app.post("/api/auth/register")
def register_user(req: RegisterRequest):
    """Registers a new user with name, email, password, height, weight, and optional uploaded photo."""
    users = load_users()
    clean_email = req.email.strip().lower()

    for u in users.values():
        if u.get("email", "").lower() == clean_email:
            raise HTTPException(status_code=400, detail="An account with this email already exists.")

    user_id = f"user_{uuid.uuid4().hex[:10]}"
    new_user = {
        "id": user_id,
        "name": req.name.strip(),
        "email": clean_email,
        "password_hash": hashlib.sha256(req.password.strip().encode()).hexdigest(),
        "height": float(req.height),
        "weight": float(req.weight),
        "photo": req.photo,
        "created_at": datetime.now().isoformat(),
    }

    users[user_id] = new_user
    save_users(users)

    user_stats = compute_user_today_stats(new_user)
    token = f"fitgoals_token_{uuid.uuid4().hex}"

    return {
        "status": "success",
        "message": f"Welcome aboard, {new_user['name']}!",
        "token": token,
        "user": user_stats
    }

@app.post("/api/auth/login")
def login_user(req: LoginRequest):
    """Authenticates a user via email and password."""
    users = load_users()
    clean_email = req.email.strip().lower()
    hashed_input = hashlib.sha256(req.password.strip().encode()).hexdigest()

    matched_user = None
    for u in users.values():
        if u.get("email", "").lower() == clean_email:
            if u.get("password_hash") == hashed_input:
                matched_user = u
                break
            else:
                raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")

    if not matched_user:
        raise HTTPException(status_code=404, detail="No account found with this email. Please register first.")

    user_stats = compute_user_today_stats(matched_user)
    token = f"fitgoals_token_{uuid.uuid4().hex}"

    return {
        "status": "success",
        "message": f"Welcome back, {matched_user['name']}!",
        "token": token,
        "user": user_stats
    }

@app.get("/api/auth/me")
def get_current_user_profile(
    email: Optional[str] = Query(None),
    x_user_email: Optional[str] = Header(None)
):
    """Returns the current user profile with live dynamic today stats."""
    target_email = (email or x_user_email or "").strip().lower()
    if not target_email:
        raise HTTPException(status_code=400, detail="User email is required.")

    users = load_users()
    for u in users.values():
        if u.get("email", "").lower() == target_email:
            return compute_user_today_stats(u)

    raise HTTPException(status_code=404, detail="User not found.")

@app.put("/api/auth/profile")
def update_user_profile(req: UpdateProfileRequest):
    """Updates user profile attributes like name, height, weight, photo."""
    users = load_users()
    clean_email = req.email.strip().lower()

    target_id = None
    for uid, u in users.items():
        if u.get("email", "").lower() == clean_email:
            target_id = uid
            break

    if not target_id:
        raise HTTPException(status_code=404, detail="User not found.")

    if req.name:
        users[target_id]["name"] = req.name.strip()
    if req.height is not None and 50 <= req.height <= 260:
        users[target_id]["height"] = float(req.height)
    if req.weight is not None and 20 <= req.weight <= 350:
        users[target_id]["weight"] = float(req.weight)
    if req.photo is not None:
        users[target_id]["photo"] = req.photo

    save_users(users)
    return compute_user_today_stats(users[target_id])

@app.get("/api/leaderboard")
def get_leaderboard(
    date_query: Optional[str] = Query(None, alias="date"),
    email: Optional[str] = Query(None),
    x_user_email: Optional[str] = Header(None)
):
    """
    Returns today's leaderboard rankings calculated strictly from actual meals and water intake.
    No hardcoded demo athletes are added.
    """
    target_date = date_query.strip() if date_query else datetime.now().strftime("%Y-%m-%d")
    users = load_users()
    current_email = (email or x_user_email or "").strip().lower()

    ranked_list = []
    has_current = False

    for u in users.values():
        stats = compute_user_today_stats(u, target_date)
        is_me = (stats["email"].lower() == current_email) if current_email else False
        stats["is_current_user"] = is_me
        if is_me:
            has_current = True
            stats["display_name"] = "You"
        else:
            stats["display_name"] = stats["name"]
        ranked_list.append(stats)

    # If the user is browsing as guest or current email is not in registered users yet,
    # compute their score directly from today's active local log file!
    if not has_current:
        guest_user = {
            "id": "guest_you",
            "name": "You",
            "email": current_email or "you@fitgoals.io",
            "photo": None,
            "height": 175.0,
            "weight": 70.0
        }
        guest_stats = compute_user_today_stats(guest_user, target_date)
        guest_stats["is_current_user"] = True
        guest_stats["display_name"] = "You"
        ranked_list.append(guest_stats)

    # Sort descending by today's points, then food score, then water %
    ranked_list.sort(key=lambda x: (x["points"], x["today_food_score"], x["today_water_pct"]), reverse=True)

    current_user_rank = None
    current_user_stats = None
    for idx, item in enumerate(ranked_list):
        item["rank"] = idx + 1
        if item.get("is_current_user"):
            current_user_rank = item["rank"]
            current_user_stats = item

    podium_top3 = ranked_list[:3]

    try:
        dt_obj = datetime.strptime(target_date, "%Y-%m-%d")
        date_formatted = dt_obj.strftime("%A, %b %d, %Y")
    except Exception:
        date_formatted = target_date

    return {
        "today_date": target_date,
        "today_date_formatted": date_formatted,
        "rankings": ranked_list,
        "podium": podium_top3,
        "currentUserRank": current_user_rank,
        "currentUserStats": current_user_stats,
    }



# ── Serve frontend static build (must be LAST) ──────────────────────────
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        """Serve the React SPA — any non-API route returns index.html."""
        file_path = FRONTEND_DIST / full_path
        if full_path and file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIST / "index.html"))

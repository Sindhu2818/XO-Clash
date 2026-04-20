from fastapi import FastAPI, Request, Response, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
import pymysql
from pymongo import MongoClient, ReadPreference
import asyncio
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
import os
import base64

from utils.facial_recognition_module import find_closest_match, build_encodings_cache

load_dotenv()

app = FastAPI()

from game import router as game_router
app.include_router(game_router)

# ----- Session config -----
SESSION_SECRET = os.getenv("SESSION_SECRET", "secret")
SESSION_COOKIE = "arena_session"
SESSION_MAX_AGE = 60 * 60 * 8
serializer = URLSafeTimedSerializer(SESSION_SECRET)

# ----- CORS -----
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:5500",
    "http://127.0.0.1:8000",
    "http://localhost:8000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def block_unknown_origins(request: Request, call_next):
    origin = request.headers.get("origin")
    if origin and origin not in ALLOWED_ORIGINS:
        return JSONResponse(status_code=403, content={"detail": "Blocked origin"})
    return await call_next(request)

# ----- Database connections -----
def get_mysql():
    return pymysql.connect(
        host=os.getenv("MYSQL_HOST"),
        user=os.getenv("MYSQL_USER"),
        password=os.getenv("MYSQL_PASSWORD"),
        database=os.getenv("MYSQL_DB"),
        cursorclass=pymysql.cursors.DictCursor
    )

mongo_client = MongoClient(os.getenv("MONGO_URI"))
mongo_db = mongo_client["arena_db"]
images_collection = mongo_db["profile_images"]

# ----- Session helpers -----
def create_session(uid, name):
    return serializer.dumps({"uid": uid, "name": name})

def decode_session(token):
    try:
        return serializer.loads(token, max_age=SESSION_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None

def get_current_user(request: Request):
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401)
    data = decode_session(token)
    if not data:
        raise HTTPException(status_code=401)
    return data

# ----- Startup: build face encodings cache -----
encodings_cache = {}

@app.on_event("startup")
async def startup():
    global encodings_cache
    print("Building face encodings cache, please wait...")

    def build():
        db_images = {
            doc["uid"]: doc["image"]
            for doc in images_collection.with_options(
                read_preference=ReadPreference.SECONDARY_PREFERRED
            ).find({}, {"uid": 1, "image": 1})
        }
        print(f"Found {len(db_images)} images in MongoDB")
        print("Starting encoding build...")
        result = build_encodings_cache(db_images)
        print("Encoding build done!")
        return result

    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor() as pool:
        encodings_cache = await loop.run_in_executor(pool, build)

    print("Face encodings cache ready!")

# ----- DB helpers -----
def db_get_user(uid):
    conn = get_mysql()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE uid=%s", (uid,))
            return cur.fetchone()
    finally:
        conn.close()

def db_set_online(uid, val):
    conn = get_mysql()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET is_online=%s WHERE uid=%s", (val, uid))
        conn.commit()
    finally:
        conn.close()

# ----- Request models -----
class LoginRequest(BaseModel):
    image: str

# =============================================================
# AUTH ROUTES
# =============================================================

@app.post("/login")
def login(req: LoginRequest, response: Response):
    try:
        image_data = req.image.split(",", 1)[-1]
        uid = find_closest_match(image_data, encodings_cache)

        if not uid:
            return {"success": False}

        user = db_get_user(uid)
        if not user:
            return {"success": False}

        db_set_online(uid, True)

        token = create_session(uid, user["name"])
        response.set_cookie(
            key=SESSION_COOKIE,
            value=token,
            httponly=True,
            samesite="lax",
            max_age=SESSION_MAX_AGE
        )

        return {"success": True, "uid": uid, "name": user["name"]}

    except Exception as e:
        print("Login error:", e)
        return {"success": False}


@app.post("/logout")
def logout(response: Response, user=Depends(get_current_user)):
    db_set_online(user["uid"], False)
    response.delete_cookie(SESSION_COOKIE)
    return {"success": True}


@app.get("/me")
def me(user=Depends(get_current_user)):
    return user

# =============================================================
# API ROUTES (used by frontend JS)
# =============================================================

@app.get("/api/users")
def get_all_users(user=Depends(get_current_user)):
    """Returns all players sorted by elo — used by leaderboard."""
    conn = get_mysql()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT uid, name, elo_rating, is_online FROM users ORDER BY elo_rating DESC")
            return cur.fetchall()
    finally:
        conn.close()


@app.get("/api/users/{uid}")
def get_user(uid: str, user=Depends(get_current_user)):
    """Returns a single player's data."""
    conn = get_mysql()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT uid, name, elo_rating, is_online FROM users WHERE uid=%s", (uid,))
            player = cur.fetchone()
            if not player:
                raise HTTPException(status_code=404, detail="User not found")
            return player
    finally:
        conn.close()


@app.get("/api/images/{uid}")
def get_profile_image(uid: str, user=Depends(get_current_user)):
    """Returns a player's profile image as a base64 string."""
    doc = images_collection.find_one({"uid": uid}, {"image": 1})
    if not doc or "image" not in doc:
        raise HTTPException(status_code=404, detail="Image not found")

    image_data = doc["image"]

    if isinstance(image_data, str):
        return {"image": image_data}
    else:
        return {"image": base64.b64encode(bytes(image_data)).decode("utf-8")}


@app.get("/api/matches/{uid}")
def get_match_history(uid: str, user=Depends(get_current_user)):
    """Returns the last 20 matches for a player, with opponent names."""
    conn = get_mysql()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    m.outcome,
                    m.played_at,
                    CASE WHEN m.player1_uid = %s THEN m.player2_uid ELSE m.player1_uid END AS opponent_uid,
                    CASE
                        WHEN m.outcome = 'draw'   THEN 'draw'
                        WHEN m.winner_uid = %s     THEN 'win'
                        ELSE 'loss'
                    END AS result
                FROM matches m
                WHERE m.player1_uid = %s OR m.player2_uid = %s
                ORDER BY m.played_at DESC
                LIMIT 20
            """, (uid, uid, uid, uid))
            rows = cur.fetchall()

        matches = []
        for row in rows:
            with conn.cursor() as cur:
                cur.execute("SELECT name FROM users WHERE uid=%s", (row["opponent_uid"],))
                opp = cur.fetchone()

            matches.append({
                "opponent_uid":  row["opponent_uid"],
                "opponent_name": opp["name"] if opp else row["opponent_uid"],
                "outcome":       row["result"],
                "played_at":     str(row["played_at"]) if row["played_at"] else None
            })

        return matches

    finally:
        conn.close()

# =============================================================
# STATIC FILE SERVING
# =============================================================

@app.get("/")
def root():
    return FileResponse("login.html")

@app.get("/login.html")
def serve_login():
    return FileResponse("login.html")

@app.get("/lobby.html")
def serve_lobby():
    return FileResponse("lobby.html")

@app.get("/game.html")
def serve_game():
    return FileResponse("game.html")

@app.get("/leaderboard.html")
def serve_leaderboard():
    return FileResponse("leaderboard.html")

@app.get("/profile.html")
def serve_profile():
    return FileResponse("profile.html")

@app.get("/settings.html")
def serve_settings():
    return FileResponse("settings.html")

@app.get("/main.js")
def serve_mainjs():
    return FileResponse("main.js")

@app.get("/leaderboard.js")
def serve_leaderboardjs():
    return FileResponse("leaderboard.js")

@app.get("/settings.js")
def serve_settingsjs():
    return FileResponse("settings.js")

@app.get("/profile.js")
def serve_profilejs():
    return FileResponse("profile.js")

@app.get("/style.css")
def serve_css():
    return FileResponse("style.css")

@app.get("/game.js")
def serve_gamejs():
    return FileResponse("game.js")

@app.get("/lobby.js")
def serve_lobbyjs():
    return FileResponse("lobby.js")
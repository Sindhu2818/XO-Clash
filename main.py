from fastapi import FastAPI, Request, Response, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
import pymysql
from pymongo import MongoClient
from dotenv import load_dotenv
import os

from utils.facial_recognition_module import find_closest_match

load_dotenv()

app = FastAPI()

# =========================
# CONFIG
# =========================
SESSION_SECRET = os.getenv("SESSION_SECRET", "change-this-to-a-long-random-secret")
SESSION_COOKIE = "arena_session"
SESSION_MAX_AGE = 60 * 60 * 8  # 8 hours
serializer = URLSafeTimedSerializer(SESSION_SECRET)

# =========================
# CORS
# =========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# DATABASE CONNECTIONS
# =========================

def get_mysql():
    return pymysql.connect(
        host=os.getenv("MYSQL_HOST", "127.0.0.1"),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DB", "arena_db"),
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False
    )

mongo_client = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017/"))
mongo_db = mongo_client["arena_db"]
images_collection = mongo_db["profile_images"]


# =========================
# SESSION HELPERS
# =========================

def create_session(uid: str, name: str) -> str:
    """Sign a session token containing uid and name."""
    return serializer.dumps({"uid": uid, "name": name})


def decode_session(token: str) -> dict | None:
    """Decode and verify a session token. Returns payload or None."""
    try:
        return serializer.loads(token, max_age=SESSION_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None


def get_current_user(request: Request) -> dict:
    """
    Dependency: extracts and validates the session cookie.
    Raises 401 if missing or invalid.
    """
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_session(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    return payload


# =========================
# DB HELPERS
# =========================

def get_all_images() -> dict:
    data = {}
    for doc in images_collection.find({}, {"uid": 1, "image": 1}):
        data[doc["uid"]] = doc["image"]
    return data


def db_get_user(uid: str) -> dict | None:
    conn = get_mysql()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE uid = %s", (uid,))
            return cursor.fetchone()
    finally:
        conn.close()


def db_set_online(uid: str, online: bool):
    conn = get_mysql()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE users SET is_online = %s WHERE uid = %s",
                (online, uid)
            )
        conn.commit()
    finally:
        conn.close()


def db_get_all_users() -> list:
    conn = get_mysql()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT uid, name, elo_rating, is_online FROM users ORDER BY elo_rating DESC")
            return cursor.fetchall()
    finally:
        conn.close()


# =========================
# REQUEST MODELS
# =========================

class LoginRequest(BaseModel):
    image: str  # full data-URL or bare base64


# =========================
# ROUTES
# =========================

@app.get("/")
def home():
    return {"msg": "Arena server running"}


# ─── PHASE 2: Login ───────────────────────────────────────────────────────────

@app.post("/login")
def login(req: LoginRequest, response: Response):
    try:
        # Strip "data:image/...;base64," prefix if present
        if "," in req.image:
            image_data = req.image.split(",", 1)[1]
        else:
            image_data = req.image

        # Fetch all profile images from MongoDB
        db_images_dict = get_all_images()
        if not db_images_dict:
            return JSONResponse(
                status_code=503,
                content={"success": False, "detail": "No profile images in database. Run the scraper first."}
            )

        # Run facial recognition
        uid = find_closest_match(image_data, db_images_dict)

        if uid is None:
            return {"success": False, "detail": "Face not recognized"}

        # Cross-reference with MySQL
        user = db_get_user(uid)
        if not user:
            return {"success": False, "detail": "User record not found in MySQL"}

        # Mark online in MySQL
        db_set_online(uid, True)

        # Create signed server-side session cookie (HttpOnly, SameSite=Lax)
        token = create_session(uid, user["name"])
        response.set_cookie(
            key=SESSION_COOKIE,
            value=token,
            httponly=True,
            samesite="lax",
            max_age=SESSION_MAX_AGE,
            path="/"
        )

        return {
            "success": True,
            "uid": uid,
            "name": user["name"]
        }

    except Exception as e:
        print("Login error:", e)
        return {"success": False, "detail": "Internal server error"}


# ─── PHASE 2: Logout ──────────────────────────────────────────────────────────

@app.post("/logout")
def logout(response: Response, current_user: dict = Depends(get_current_user)):
    uid = current_user["uid"]
    db_set_online(uid, False)
    response.delete_cookie(key=SESSION_COOKIE, path="/")
    return {"success": True, "detail": f"{uid} logged out"}


# ─── PHASE 2: Whoami (for frontend to check session on page load) ─────────────

@app.get("/me")
def whoami(current_user: dict = Depends(get_current_user)):
    return {"uid": current_user["uid"], "name": current_user["name"]}


# ─── PHASE 1 / PHASE 4: Users list (used by lobby & leaderboard) ─────────────

@app.get("/users")
@app.get("/api/users")
def get_users():
    users = db_get_all_users()
    return [
        {
            "uid": u["uid"],
            "name": u["name"],
            "elo_rating": u["elo_rating"],
            "elo": u["elo_rating"],       # alias for lobby JS
            "is_online": bool(u["is_online"])
        }
        for u in users
    ]


# ─── Single user (used by profile page) ──────────────────────────────────────

@app.get("/api/users/{uid}")
def get_user(uid: str):
    user = db_get_user(uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "uid": user["uid"],
        "name": user["name"],
        "elo_rating": user["elo_rating"],
        "is_online": bool(user["is_online"])
    }


# ─── Profile image (used by profile page) ────────────────────────────────────

@app.get("/api/images/{uid}")
def get_image(uid: str):
    doc = images_collection.find_one({"uid": uid}, {"image": 1})
    if not doc or "image" not in doc:
        raise HTTPException(status_code=404, detail="Image not found")
    return {"uid": uid, "image": doc["image"]}
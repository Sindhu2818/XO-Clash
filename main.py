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
SESSION_SECRET = os.getenv("SESSION_SECRET", "secret")
SESSION_COOKIE = "arena_session"
SESSION_MAX_AGE = 60 * 60 * 8
serializer = URLSafeTimedSerializer(SESSION_SECRET)

# =========================
# CORS (FIXED)
# =========================
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:5500"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# FIXED ORIGIN BLOCK
# =========================
@app.middleware("http")
async def block_unknown_origins(request: Request, call_next):
    origin = request.headers.get("origin")

    if origin is not None and origin not in ALLOWED_ORIGINS:
        return JSONResponse(status_code=403, content={"detail": "Blocked origin"})

    return await call_next(request)

# =========================
# DATABASE
# =========================
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

# =========================
# SESSION
# =========================
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

# =========================
# HELPERS
# =========================
def get_all_images():
    return {doc["uid"]: doc["image"] for doc in images_collection.find({}, {"uid":1, "image":1})}

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

# =========================
# MODEL
# =========================
class LoginRequest(BaseModel):
    image: str

# =========================
# LOGIN
# =========================
@app.post("/login")
def login(req: LoginRequest, response: Response):
    try:
        image_data = req.image.split(",",1)[-1]

        db_images = get_all_images()
        uid = find_closest_match(image_data, db_images)

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
            samesite="lax",   # important for cookies :contentReference[oaicite:0]{index=0}
            max_age=SESSION_MAX_AGE
        )

        return {"success": True, "uid": uid, "name": user["name"]}

    except Exception as e:
        print(e)
        return {"success": False}

# =========================
# LOGOUT
# =========================
@app.post("/logout")
def logout(response: Response, user=Depends(get_current_user)):
    db_set_online(user["uid"], False)
    response.delete_cookie(SESSION_COOKIE)
    return {"success": True}

# =========================
# SESSION CHECK
# =========================
@app.get("/me")
def me(user=Depends(get_current_user)):
    return user
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

import mysql.connector
from pymongo import MongoClient

from utils.facial_recognition_module import find_closest_match

app = FastAPI()

# =========================
# CORS (IMPORTANT)
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

# MySQL
mysql_conn = mysql.connector.connect(
    host="localhost",
    user="root",
    password="NxPkkn3Er34RNg1q",
    database="arena_db"
)
cursor = mysql_conn.cursor(dictionary=True)

# MongoDB
mongo_client = MongoClient("mongodb://localhost:27017/")
mongo_db = mongo_client["arena_db"]
images_collection = mongo_db["profile_images"]


# =========================
# REQUEST MODEL
# =========================

class LoginRequest(BaseModel):
    image: str


# =========================
# HELPER FUNCTIONS
# =========================

def get_all_images():
    data = {}
    for doc in images_collection.find():
        data[doc["uid"]] = doc["image"]
    return data


def get_user(uid):
    cursor.execute("SELECT * FROM users WHERE uid = %s", (uid,))
    return cursor.fetchone()


def set_online(uid):
    cursor.execute(
        "UPDATE users SET is_online = TRUE WHERE uid = %s", (uid,)
    )
    mysql_conn.commit()


# =========================
# ROUTES
# =========================

@app.get("/")
def home():
    return {"msg": "Server running"}


# 🔐 LOGIN (PHASE 2 COMPLETE)
@app.post("/login")
def login(req: LoginRequest):

    try:
        # 1. Remove "data:image/...;base64," prefix
        image_data = req.image.split(",")[1]

        # 2. Fetch all images from MongoDB
        db_images_dict = get_all_images()

        # 3. Call facial recognition module
        uid = find_closest_match(image_data, db_images_dict)

        # 4. Reject if no match
        if uid is None:
            return {"success": False}

        # 5. Verify user in MySQL
        user = get_user(uid)
        if not user:
            return {"success": False}

        # 6. Mark user online
        set_online(uid)

        return {
            "success": True,
            "uid": uid,
            "name": user["name"]
        }

    except Exception as e:
        print("Login error:", e)
        return {"success": False}


# 🟢 GET USERS (LOBBY)
@app.get("/users")
def get_users():
    cursor.execute("SELECT * FROM users")
    users = cursor.fetchall()

    return [
        {
            "uid": u["uid"],
            "name": u["name"],
            "elo": u["elo_rating"],
            "is_online": u["is_online"]
        }
        for u in users
    ]
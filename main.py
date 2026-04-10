from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

from db_mysql import get_connection
from db_mongo import get_db

from utils.facial_recognition_module import find_closest_match

app = FastAPI()

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

mysql_conn = get_connection()
mongo_db = get_db()
images_collection = mongo_db["profile_images"]

# =========================
# REQUEST MODEL
# =========================

class LoginRequest(BaseModel):
    image: str

# =========================
# HELPERS
# =========================

def get_all_images():
    data = {}
    for doc in images_collection.find():
        data[doc["uid"]] = doc["image"]
    return data


def get_user(uid):
    with mysql_conn.cursor() as cursor:
        cursor.execute("SELECT * FROM users WHERE uid = %s", (uid,))
        return cursor.fetchone()


def set_online(uid):
    with mysql_conn.cursor() as cursor:
        cursor.execute(
            "UPDATE users SET is_online = TRUE WHERE uid = %s",
            (uid,)
        )
    mysql_conn.commit()

# =========================
# ROUTES
# =========================

@app.get("/")
def home():
    return {"msg": "Server running"}


@app.post("/login")
def login(req: LoginRequest):
    try:
        image_data = req.image.split(",")[1]

        db_images_dict = get_all_images()

        if not db_images_dict:
            return {"success": False}

        uid = find_closest_match(image_data, db_images_dict)

        if uid is None:
            return {"success": False}

        user = get_user(uid)
        if not user:
            return {"success": False}

        set_online(uid)

        return {
            "success": True,
            "uid": uid,
            "name": user["name"]
        }

    except Exception:
        return {"success": False}


@app.get("/users")
def get_users():
    with mysql_conn.cursor() as cursor:
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
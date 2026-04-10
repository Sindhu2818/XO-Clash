from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()


def get_db():
    client = MongoClient(os.getenv("MONGO_URI"))
    return client["arena_db"]


def upsert_image(db, uid: str, image_data: str):
    db.profile_images.update_one(
        {"uid": uid},
        {"$set": {"image": image_data}},
        upsert=True
    )
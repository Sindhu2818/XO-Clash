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


def get_image(db, uid: str):
    doc = db.profile_images.find_one({"uid": uid})
    return doc["image"] if doc else None


def get_all_images(db) -> dict:
    """Returns {uid: image_data} for all stored profiles — used in Phase 2 auth."""
    return {
        doc["uid"]: doc["image"]
        for doc in db.profile_images.find({}, {"uid": 1, "image": 1})
    }
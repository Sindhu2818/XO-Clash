from pymongo import MongoClient
client = MongoClient("mongodb://localhost:27017/")
db = client["arena_db"]


def get_db():
<<<<<<< HEAD
    return db

def upsert_image(db, uid: str, image_data: str):
    result = db.profile_images.update_one(
=======
    client = MongoClient(os.getenv("MONGO_URI"))
    return client["arena_db"]


def upsert_image(db, uid: str, image_data: str):
    db.profile_images.update_one(
>>>>>>> df19400 (Updated files)
        {"uid": uid},
        {"$set": {"image": image_data}},
        upsert=True
    )
    print(f"[Mongo] Insert {uid}: {result.acknowledged}")
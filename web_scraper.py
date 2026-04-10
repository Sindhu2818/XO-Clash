import csv
import requests
import base64

from db_mysql import get_connection, create_table, insert_user
from db_mongo import get_db, upsert_image


def fetch_image(url: str):
    try:
        if not url.startswith("http"):
            url = "https://" + url

        full_url = f"{url}/images/pfp.jpg"
        res = requests.get(full_url, timeout=5)

        if res.status_code == 200:
            return base64.b64encode(res.content).decode("utf-8")
        else:
            print(f"[WARN] No image: {url}")
            return None

    except Exception as e:
        print(f"[ERROR] {url}: {e}")
        return None


def run_pipeline(csv_file: str):
    # Setup DBs
    mysql_conn = get_connection()
    mongo_db = get_db()

    create_table(mysql_conn)

    with open(csv_file, newline="") as file:
        reader = csv.DictReader(file)

        for row in reader:
            uid = row["uid"]
            name = row["name"]
            website = row["website_url"]

            print(f"Processing {uid}...")

            image = fetch_image(website)

            try:
                # MySQL insert
                insert_user(mysql_conn, uid, name)

                # MongoDB upsert
                if image:
                    upsert_image(mongo_db, uid, image)

            except Exception as e:
                print(f"[DB ERROR] {uid}: {e}")

    print("✅ Phase 1 completed!")


if __name__ == "__main__":
    run_pipeline("batch_data.csv")
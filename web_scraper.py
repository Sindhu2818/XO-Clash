import csv
import requests
import base64
from concurrent.futures import ThreadPoolExecutor
from db_mysql import get_connection, create_tables, insert_user
from db_mongo import get_db, upsert_image


def fetch_image_as_base64(website_url: str) -> str | None:
    try:
        url = website_url.rstrip("/")
        if not url.startswith("http"):
            url = "https://" + url

        full_url = f"{url}/images/pfp.jpg"
        res = requests.get(full_url, timeout=5)

        if res.status_code == 200:
            return base64.b64encode(res.content).decode("utf-8")
        else:
            print(f"  [WARN] HTTP {res.status_code} at {full_url}")

    except requests.exceptions.Timeout:
        print(f"  [ERROR] Timeout: {website_url}")
    except requests.exceptions.ConnectionError:
        print(f"  [ERROR] Connection failed: {website_url}")
    except Exception as e:
        print(f"  [ERROR] Unexpected: {website_url} → {e}")

    return None


def store_student(mysql_conn, mongo_db, uid: str, name: str, image: str):
    """Writes to MySQL and MongoDB concurrently."""
    def write_mysql():
        insert_user(mysql_conn, uid, name)

    def write_mongo():
        upsert_image(mongo_db, uid, image)

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(write_mysql)
        f2 = executor.submit(write_mongo)
        f1.result()  # raises if write failed
        f2.result()


def run_pipeline(csv_file: str):
    mysql_conn = get_connection()
    mongo_db = get_db()

    try:
        create_tables(mysql_conn)

        with open(csv_file, newline="", encoding="utf-8") as file:
            reader = csv.DictReader(file)

            for row in reader:
                uid = row.get("uid", "").strip()
                name = row.get("name", "").strip()
                website = row.get("website_url", "").strip()

                if not uid or not name or not website:
                    print(f"[SKIP] Incomplete row: {row}")
                    continue

                print(f"Processing {uid} ({name})...")

                image = fetch_image_as_base64(website)

                if image:
                    try:
                        store_student(mysql_conn, mongo_db, uid, name, image)
                        print(f"  ✅ Stored successfully")
                    except Exception as e:
                        print(f"  [DB ERROR] {uid}: {e}")
                else:
                    print(f"  ⚠️  Skipped — no image retrieved")

    finally:
        mysql_conn.close()


if __name__ == "__main__":
    run_pipeline("batch_data.csv")
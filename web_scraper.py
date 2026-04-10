import csv
import requests
import base64

from db_mysql import get_connection, create_table, insert_user
from db_mongo import get_db, upsert_image


def fetch_image(url: str):
    try:
        if not url.startswith("http"):
            url = "https://" + url
<<<<<<< HEAD

        full_url = f"{url}/images/pfp.jpg"

        res = requests.get(full_url, timeout=5)

=======
        full_url = f"{url}/images/pfp.jpg"
        res = requests.get(full_url, timeout=5)
>>>>>>> df19400 (Updated files)
        if res.status_code == 200:
            print(f"[OK] Image found: {url}")
            return base64.b64encode(res.content).decode("utf-8")
        else:
            print(f"[WARN] No image at {full_url} — status {res.status_code}")
            return None
    except requests.exceptions.Timeout:
        print(f"[ERROR] Timeout fetching {url}")
        return None
    except requests.exceptions.ConnectionError:
        print(f"[ERROR] Connection error for {url}")
        return None
    except Exception as e:
        print(f"[ERROR] {url}: {e}")
        return None


def run_pipeline(csv_file: str):
    mysql_conn = get_connection()
    mongo_db = get_db()

    create_table(mysql_conn)

    success_count = 0
    fail_count = 0

    with open(csv_file, newline="") as file:
        reader = csv.DictReader(file)

        for row in reader:
            uid = row["uid"]
            name = row["name"]
            website = row["website_url"]

<<<<<<< HEAD
            print(f"\nProcessing {uid}...")
=======
            print(f"Processing {uid} ({name})...")
>>>>>>> df19400 (Updated files)

            image = fetch_image(website)

            try:
<<<<<<< HEAD
                # Always insert into MySQL
                insert_user(mysql_conn, uid, name)

                # Insert into Mongo ONLY if image exists
                if image:
                    upsert_image(mongo_db, uid, image)
                else:
                    print(f"[SKIP] No image stored for {uid}")

            except Exception as e:
                print(f"[DB ERROR] {uid}: {e}")
=======
                insert_user(mysql_conn, uid, name)
                if image:
                    upsert_image(mongo_db, uid, image)
                    print(f"  ✅ MySQL + MongoDB updated for {uid}")
                else:
                    print(f"  ⚠️  MySQL updated, no image for {uid}")
                success_count += 1
            except Exception as e:
                print(f"  [DB ERROR] {uid}: {e}")
                fail_count += 1

    mysql_conn.close()
    print(f"\nDone. {success_count} succeeded, {fail_count} failed.")
>>>>>>> df19400 (Updated files)


if __name__ == "__main__":
    run_pipeline("batch_data.csv")
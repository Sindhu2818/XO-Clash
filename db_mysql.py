import pymysql
from dotenv import load_dotenv
import os

load_dotenv()

def get_connection():
    return pymysql.connect(
        host=os.getenv("MYSQL_HOST"),
        user=os.getenv("MYSQL_USER"),
        password=os.getenv("MYSQL_PASSWORD"),
        database=os.getenv("MYSQL_DB"),
        cursorclass=pymysql.cursors.DictCursor
    )
def create_table(conn):
    cursor=conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            uid VARCHAR(50) PRIMARY KEY,
            name VARCHAR(255),
            elo_rating INT DEFAULT 1200,
            is_online BOOLEAN DEFAULT FALSE
        )
    """)
    conn.commit()


def insert_user(conn, uid:str,name:str):
    cursor=conn.cursor()
    cursor.execute("""
        INSERT INTO users(uid,name)
        VALUES(%s,%s)
        ON DUPLICATE KEY UPDATE name=%s
    """, (uid,name,name))
    conn.commit()
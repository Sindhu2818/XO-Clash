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


def create_tables(conn):
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            uid VARCHAR(50) PRIMARY KEY,
            name VARCHAR(255),
            elo_rating INT DEFAULT 1200,
            is_online BOOLEAN DEFAULT FALSE
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS matches (
            id INT AUTO_INCREMENT PRIMARY KEY,
            player1_uid VARCHAR(50),
            player2_uid VARCHAR(50),
            winner_uid VARCHAR(50) DEFAULT NULL,
            outcome ENUM('win', 'draw', 'forfeit') NOT NULL,
            played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (player1_uid) REFERENCES users(uid),
            FOREIGN KEY (player2_uid) REFERENCES users(uid)
        )
    """)

    conn.commit()


def insert_user(conn, uid: str, name: str):
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO users (uid, name)
        VALUES (%s, %s)
        ON DUPLICATE KEY UPDATE name=%s
    """, (uid, name, name))
    conn.commit()


def set_online(conn, uid: str, status: bool):
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET is_online=%s WHERE uid=%s",
        (status, uid)
    )
    conn.commit()


def get_user(conn, uid: str):
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE uid=%s", (uid,))
    return cursor.fetchone()


def get_all_users(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users ORDER BY elo_rating DESC")
    return cursor.fetchall()


def update_elo(conn, uid: str, new_rating: int):
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET elo_rating=%s WHERE uid=%s",
        (new_rating, uid)
    )
    conn.commit()


def insert_match(conn, player1_uid: str, player2_uid: str, winner_uid: str | None, outcome: str):
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO matches (player1_uid, player2_uid, winner_uid, outcome)
        VALUES (%s, %s, %s, %s)
    """, (player1_uid, player2_uid, winner_uid, outcome))
    conn.commit()
import pymysql

# Database connection configuration
config = {
    'host': 'localhost',
    'user': 'root',
    'password': 'your_password', # Change this
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor # Returns rows as dictionaries
}

def setup_arena_db():
    # 1. Connect to MySQL (no DB specified yet)
    connection = pymysql.connect(**config)
    
    try:
        with connection.cursor() as cursor:
            # 2. Create and Select Database
            cursor.execute("CREATE DATABASE IF NOT EXISTS arena_db")
            cursor.execute("USE arena_db")
            print("Database 'arena_db' initialized.")

            # 3. Create Users Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    uid        VARCHAR(50)  PRIMARY KEY,
                    name       VARCHAR(255) NOT NULL,
                    elo_rating INT          DEFAULT 1200,
                    is_online  BOOLEAN      DEFAULT FALSE
                )
            """)
            print("Table 'users' verified.")

            # 4. Create Matches Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS matches (
                    id          INT AUTO_INCREMENT PRIMARY KEY,
                    player1_uid VARCHAR(50)  NOT NULL,
                    player2_uid VARCHAR(50)  NOT NULL,
                    winner_uid  VARCHAR(50)  DEFAULT NULL,
                    outcome     ENUM('win', 'draw', 'forfeit') NOT NULL,
                    played_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (player1_uid) REFERENCES users(uid),
                    FOREIGN KEY (player2_uid) REFERENCES users(uid)
                )
            """)
            print("Table 'matches' verified.")
            
        connection.commit()
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        connection.close()

if __name__ == "__main__":
    setup_arena_db()
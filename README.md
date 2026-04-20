# Identity-Verified Multiplayer Arena

A full-stack real-time multiplayer system with:
- Automated data scraping
- Polyglot database storage (MySQL + MongoDB)
- Facial recognition-based login
- WebSocket-based multiplayer Tic-Tac-Toe
- Elo rating system

## Tech Stack

- Backend: FastAPI
- Database:
  - MySQL (user metadata)
  - MongoDB (profile images)
- WebSockets: FastAPI WebSockets
- Facial Recognition: face-recognition library
- Package Manager: uv

## MySQL Schema

Table: users

| Column      | Type     | Description              |
|------------|----------|--------------------------|
| uid        | VARCHAR  | Primary Key              |
| name       | VARCHAR  | User name                |
| elo_rating | INT      | Default 1200             |
| is_online  | BOOLEAN  | Default FALSE            |

## MongoDB Schema

Collection: user_images

Document format:
{
  "uid": "<string>",
  "image": "<base64 string>"
}

## Setup Instructions

### 1. Clone repo
git clone <repo-url>
cd project

### 2. Install dependencies
- uv sync
- mysql -u root -p
- use arena_db
- SELECT * FROM users;
- pip install face-recognition numpy Pillow
- sudo dnf install python3.11 python3.11-devel
- python3.11 -m pip install face-recognition --break-system-packages
- pip install git+https://github.com/ageitgey/face_recognition_models

### 3. MySQL Setup
- Create database
- Update credentials in .env or config file

### 4. MongoDB Setup
- Start MongoDB locally or use Atlas

## Run Data Pipeline

python web_scraper.py
- Reads batch_data.csv
- Fetches profile images
- Stores:
  - metadata in MySQL
  - images in MongoDB

## Authentication Flow

1. Capture webcam image (frontend)
2. Send Base64 image to backend
3. Backend:
   - fetches images from MongoDB
   - uses facial recognition module
4. If match found:
   - create session
   - set is_online = TRUE

## Start Backend Server

uv run uvicorn main:app --reload

## WebSocket Features

- Live lobby (online users)
- Real-time challenge system
- Dedicated game rooms
- Server-authoritative Tic-Tac-Toe

## Game Architecture

- Server maintains game state
- Clients send moves
- Server validates:
  - correct turn
  - empty cell
- Server broadcasts updated board

## Elo Rating System

- K = 32
- Updated after every match
- Handles:
  - win
  - loss
  - draw
  - disconnect (forfeit)

## Assumptions

- Each user has exactly one face in profile image
- Images are accessible at /images/pfp.jpg
- Network failures are handled gracefully
- Only authenticated users can enter lobby
- One active session per user

## Project Structure

- web_scraper.py → data pipeline
- facial_recognition_module.py → provided module
- main.py → FastAPI backend
- db_mysql.py → MySQL logic
- db_mongo.py → MongoDB logic

## Edge Cases

- Missing profile images
- HTTP failures during scraping
- No face detected during login
- Player disconnect during game
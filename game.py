from fastapi import WebSocket, WebSocketDisconnect
from fastapi.routing import APIRouter
import pymysql
import json
import os

router = APIRouter()

# ----- In-memory state -----

# uid -> {"ws": WebSocket, "name": str}
lobby_connections = {}

# room_id -> {"players": [uid1, uid2], "board": [""]*9, "turn": uid1,
#              "sockets": {uid: WebSocket}, "symbols": {uid: "X"/"O"}, "names": {uid: name}}
game_rooms = {}

# uid -> room_id  (so we know which room a player is in)
player_room = {}

# ----- MySQL helpers -----

def get_mysql():
    return pymysql.connect(
        host=os.getenv("MYSQL_HOST"),
        user=os.getenv("MYSQL_USER"),
        password=os.getenv("MYSQL_PASSWORD"),
        database=os.getenv("MYSQL_DB"),
        cursorclass=pymysql.cursors.DictCursor
    )

def get_online_users():
    conn = get_mysql()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT uid, name, elo_rating FROM users WHERE is_online=1")
            return cur.fetchall()
    finally:
        conn.close()

def get_elo(uid):
    conn = get_mysql()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT elo_rating FROM users WHERE uid=%s", (uid,))
            row = cur.fetchone()
            return row["elo_rating"] if row else 1200
    finally:
        conn.close()

def update_elo(uid, new_rating):
    conn = get_mysql()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET elo_rating=%s WHERE uid=%s", (new_rating, uid))
        conn.commit()
    finally:
        conn.close()

def insert_match(p1, p2, winner, outcome):
    conn = get_mysql()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO matches (player1_uid, player2_uid, winner_uid, outcome) VALUES (%s, %s, %s, %s)",
                (p1, p2, winner, outcome)
            )
        conn.commit()
    finally:
        conn.close()

def set_online(uid, val):
    conn = get_mysql()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET is_online=%s WHERE uid=%s", (val, uid))
        conn.commit()
    finally:
        conn.close()

# ----- Elo calculation -----

def compute_elo(my_rating, opponent_rating, score):
    K = 32
    expected = 1 / (1 + 10 ** ((opponent_rating - my_rating) / 400))
    return round(my_rating + K * (score - expected))

# ----- Broadcast helpers -----

async def broadcast_lobby():
    """Send the current online user list to everyone in the lobby."""
    users = get_online_users()
    msg = json.dumps({"type": "lobby_update", "users": users})
    for uid, data in list(lobby_connections.items()):
        try:
            await data["ws"].send_text(msg)
        except Exception:
            pass

async def send_to(uid, msg: dict):
    """Send a message to one specific user in the lobby."""
    if uid in lobby_connections:
        try:
            await lobby_connections[uid]["ws"].send_text(json.dumps(msg))
        except Exception:
            pass

async def send_to_room(room_id, msg: dict):
    """Send a message to both players in a game room."""
    room = game_rooms.get(room_id)
    if not room:
        return
    for uid, ws in room["sockets"].items():
        try:
            await ws.send_text(json.dumps(msg))
        except Exception:
            pass

# ----- Win detection -----

def check_winner(board):
    """Returns 'X', 'O', 'draw', or None (game still going)."""
    winning_lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],  # rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8],  # columns
        [0, 4, 8], [2, 4, 6]               # diagonals
    ]
    for a, b, c in winning_lines:
        if board[a] and board[a] == board[b] == board[c]:
            return board[a]  # "X" or "O"

    if all(cell != "" for cell in board):
        return "draw"

    return None  # game still going

# ----- Elo update + match recording -----

async def finish_match(room_id, winner_uid=None, outcome="win"):
    """Update elo ratings and record the match in MySQL, then clean up the room."""
    room = game_rooms.get(room_id)
    if not room:
        return

    p1, p2 = room["players"]

    # Read ratings before updating (important: use pre-match values for both)
    r1 = get_elo(p1)
    r2 = get_elo(p2)

    if outcome == "draw":
        new_r1 = compute_elo(r1, r2, 0.5)
        new_r2 = compute_elo(r2, r1, 0.5)
        insert_match(p1, p2, None, "draw")

    else:
        loser_uid = p2 if winner_uid == p1 else p1
        r_winner = r1 if winner_uid == p1 else r2
        r_loser  = r2 if winner_uid == p1 else r1

        new_r_winner = compute_elo(r_winner, r_loser, 1.0)
        new_r_loser  = compute_elo(r_loser, r_winner, 0.0)

        if winner_uid == p1:
            new_r1, new_r2 = new_r_winner, new_r_loser
        else:
            new_r1, new_r2 = new_r_loser, new_r_winner

        insert_match(p1, p2, winner_uid, outcome)

    update_elo(p1, new_r1)
    update_elo(p2, new_r2)

    # Clean up room state
    player_room.pop(p1, None)
    player_room.pop(p2, None)
    game_rooms.pop(room_id, None)

# =============================================================
# LOBBY WEBSOCKET
# =============================================================

@router.websocket("/ws/lobby")
async def lobby_ws(websocket: WebSocket):
    await websocket.accept()
    uid = None

    try:
        # First message must identify the user
        auth = json.loads(await websocket.receive_text())
        uid  = auth.get("uid")
        name = auth.get("name")

        if not uid:
            await websocket.close()
            return

        lobby_connections[uid] = {"ws": websocket, "name": name}
        await broadcast_lobby()

        while True:
            msg = json.loads(await websocket.receive_text())

            if msg["type"] == "challenge":
                # Send challenge notification to the target player
                target = msg["target"]
                await send_to(target, {
                    "type":      "challenge_received",
                    "from":      uid,
                    "from_name": name
                })

            elif msg["type"] == "accept":
                # Create a game room for the two players
                challenger = msg["from"]
                room_id    = f"{challenger}_{uid}"

                challenger_name = lobby_connections[challenger]["name"]
                accepter_name   = name

                game_rooms[room_id] = {
                    "players": [challenger, uid],
                    "board":   [""] * 9,
                    "turn":    challenger,
                    "sockets": {},
                    "symbols": {challenger: "X", uid: "O"},
                    "names":   {challenger: challenger_name, uid: accepter_name}
                }
                player_room[challenger] = room_id
                player_room[uid]        = room_id

                # Tell both players to navigate to the game
                await send_to(challenger, {
                    "type":          "game_start",
                    "room_id":       room_id,
                    "symbol":        "X",
                    "opponent_name": accepter_name
                })
                await send_to(uid, {
                    "type":          "game_start",
                    "room_id":       room_id,
                    "symbol":        "O",
                    "opponent_name": challenger_name
                })

            elif msg["type"] == "decline":
                challenger = msg["from"]
                await send_to(challenger, {"type": "challenge_declined", "by": name})

    except WebSocketDisconnect:
        pass

    finally:
        if uid:
            lobby_connections.pop(uid, None)
            set_online(uid, False)

            # If this player was in a game, the opponent wins by forfeit
            room_id = player_room.get(uid)
            if room_id and room_id in game_rooms:
                room      = game_rooms[room_id]
                opponents = [p for p in room["players"] if p != uid]
                if opponents:
                    other_uid = opponents[0]
                    await send_to_room(room_id, {
                        "type":   "game_over",
                        "result": "opponent_disconnected",
                        "winner": other_uid
                    })
                    await finish_match(room_id, winner_uid=other_uid, outcome="forfeit")

            await broadcast_lobby()

# =============================================================
# GAME WEBSOCKET
# =============================================================

@router.websocket("/ws/game/{room_id}")
async def game_ws(websocket: WebSocket, room_id: str):
    await websocket.accept()
    uid = None

    try:
        # First message must identify the user
        auth = json.loads(await websocket.receive_text())
        uid  = auth.get("uid")

        if not uid or room_id not in game_rooms:
            await websocket.close()
            return

        room = game_rooms[room_id]
        room["sockets"][uid] = websocket

        # Find who the opponent is
        opponent_uid = [p for p in room["players"] if p != uid][0]

        # Tell this player their symbol and opponent's name
        await websocket.send_text(json.dumps({
            "type":          "your_info",
            "uid":           uid,
            "symbol":        room["symbols"][uid],
            "opponent_name": room["names"][opponent_uid]
        }))

        # Once both players are connected, send the initial board
        if len(room["sockets"]) == 2:
            await send_to_room(room_id, {
                "type":    "board_update",
                "board":   room["board"],
                "turn":    room["turn"],
                "symbols": room["symbols"]
            })

        while True:
            msg  = json.loads(await websocket.receive_text())
            room = game_rooms.get(room_id)
            if not room:
                break

            if msg["type"] == "move":
                cell = msg["cell"]

                # Server-side validation: is it this player's turn?
                if uid != room["turn"]:
                    await websocket.send_text(json.dumps({"type": "error", "msg": "Not your turn"}))
                    continue

                # Is the cell already taken?
                if room["board"][cell] != "":
                    await websocket.send_text(json.dumps({"type": "error", "msg": "Cell already taken"}))
                    continue

                # Apply the move
                room["board"][cell] = room["symbols"][uid]

                result = check_winner(room["board"])

                if result == "draw":
                    await send_to_room(room_id, {
                        "type":   "game_over",
                        "result": "draw",
                        "board":  room["board"]
                    })
                    await finish_match(room_id, outcome="draw")

                elif result is not None:
                    # Someone won
                    await send_to_room(room_id, {
                        "type":   "game_over",
                        "result": "win",
                        "winner": uid,
                        "board":  room["board"]
                    })
                    await finish_match(room_id, winner_uid=uid, outcome="win")

                else:
                    # Game continues — switch turns
                    p1, p2     = room["players"]
                    room["turn"] = p2 if uid == p1 else p1

                    await send_to_room(room_id, {
                        "type":    "board_update",
                        "board":   room["board"],
                        "turn":    room["turn"],
                        "symbols": room["symbols"]
                    })

    except WebSocketDisconnect:
        pass

    finally:
        if uid and room_id in game_rooms:
            room      = game_rooms[room_id]
            opponents = [p for p in room["players"] if p != uid]
            if opponents:
                other_uid = opponents[0]
                await send_to_room(room_id, {
                    "type":   "game_over",
                    "result": "opponent_disconnected",
                    "winner": other_uid
                })
                await finish_match(room_id, winner_uid=other_uid, outcome="forfeit")
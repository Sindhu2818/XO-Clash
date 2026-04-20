const API = "http://127.0.0.1:8000";
const WS  = "ws://127.0.0.1:8000";

// Apply saved theme and font size
const theme    = localStorage.getItem("theme")    || "dark";
const fontSize = localStorage.getItem("fontSize") || "medium";
document.documentElement.setAttribute("data-theme", theme);
document.documentElement.setAttribute("data-font", fontSize);

let myUid       = null;
let mySymbol    = null;
let opponent    = null;
let roomId      = null;
let ws          = null;
let gameOver    = false;
let currentTurn = null;

async function init() {
    const res = await fetch(API + "/me", { credentials: "include" });
    if (!res.ok) {
        window.location.href = "login.html";
        return;
    }

    const user = await res.json();
    myUid = user.uid;

    roomId = sessionStorage.getItem("room_id");
    if (!roomId) {
        window.location.href = "lobby.html";
        return;
    }

    connectGame();
}

function connectGame() {
    ws = new WebSocket(WS + `/ws/game/${roomId}`);

    ws.onopen = () => {
        ws.send(JSON.stringify({ uid: myUid }));
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "your_info") {
            mySymbol = msg.symbol;
            opponent = msg.opponent_name;

            document.getElementById("players").innerText =
                `You (${mySymbol}) vs ${opponent}`;
        }

        else if (msg.type === "board_update") {
            currentTurn = msg.turn;

            renderBoard(msg.board);

            const isMyTurn = currentTurn === myUid;

            document.getElementById("turn").innerText =
                isMyTurn ? "Your turn ✅" : "Opponent's turn ⏳";
        }

        else if (msg.type === "game_over") {
            gameOver = true;

            if (msg.board) renderBoard(msg.board);

            if (msg.result === "draw") {
                document.getElementById("result").innerText = "It's a draw! 🤝";
            } else if (msg.result === "opponent_disconnected") {
                document.getElementById("result").innerText = "Opponent forfeited! You win! 🏆";
            } else if (msg.winner === myUid) {
                document.getElementById("result").innerText = "You win! 🏆";
            } else {
                document.getElementById("result").innerText = "You lose! 😔";
            }

            document.getElementById("turn").innerText = "";

            // Update button text after game ends
            document.getElementById("backToLobbyBtn").innerText = "⬅ Back to Lobby";
        }
    };
}

function renderBoard(board) {
    const cells = document.querySelectorAll("#board button");

    cells.forEach((btn, i) => {
        btn.textContent = board[i];

        // Remove old marker classes
        btn.classList.remove("x-mark", "o-mark");

        if (board[i] === "X") {
            btn.classList.add("x-mark");
        } else if (board[i] === "O") {
            btn.classList.add("o-mark");
        }

        if (board[i] !== "") {
            btn.disabled = true;
            btn.style.pointerEvents = "none";
        } else {
            btn.disabled = gameOver || currentTurn !== myUid;
            btn.style.pointerEvents = "";
        }
    });
}

function cellClick(index) {
    if (gameOver || currentTurn !== myUid) return;

    ws.send(JSON.stringify({
        type: "move",
        cell: index
    }));
}

function goBack() {
    // If game is still active, warn the player about forfeiting
    if (!gameOver && roomId) {
        const confirmed = confirm(
            "⚠️ Leaving now will forfeit the game — you will lose and your opponent will win.\n\nAre you sure?"
        );
        if (!confirmed) return;
    }

    // Close the WebSocket cleanly — this triggers the server's disconnect handler
    // which awards the win to the opponent and updates Elo + match records
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
    }

    sessionStorage.removeItem("room_id");
    window.location.href = "lobby.html";
}

init();
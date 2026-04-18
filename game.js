const API = "http://127.0.0.1:8000";
const WS  = "ws://127.0.0.1:8000";

let myUid = null;
let mySymbol = null;
let opponent = null;
let roomId = null;
let ws = null;
let gameOver = false;

async function init() {
    const res = await fetch(API + "/me", { credentials: "include" });
    if (!res.ok) {
        window.location.href = "login.html";
        return;
    }
    const user = await res.json();
    myUid = user.uid;  // myUid is set BEFORE connectGame is called

    roomId = sessionStorage.getItem("room_id");

    if (!roomId) {
        window.location.href = "lobby.html";
        return;
    }

    connectGame();  // only called after myUid is ready
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
            document.getElementById("turn").innerText = "Waiting for opponent...";
        }

        else if (msg.type === "board_update") {
            renderBoard(msg.board, msg.turn);
            const isMyTurn = msg.turn === myUid;
            document.getElementById("turn").innerText =
                isMyTurn ? "Your turn ✅" : "Opponent's turn ⏳";
        }

        else if (msg.type === "game_over") {
            if (msg.board) renderBoard(msg.board, null);
            gameOver = true;

            if (msg.result === "draw") {
                document.getElementById("result").innerText = "It's a draw! 🤝";
            } else if (msg.result === "opponent_disconnected") {
                document.getElementById("result").innerText = "Opponent disconnected. You win! 🏆";
            } else if (msg.winner === myUid) {
                document.getElementById("result").innerText = "You win! 🏆";
            } else {
                document.getElementById("result").innerText = "You lose! 😔";
            }

            document.getElementById("turn").innerText = "";
            sessionStorage.removeItem("room_id");
            sessionStorage.removeItem("symbol");
            sessionStorage.removeItem("opponent");
        }

        else if (msg.type === "error") {
            console.warn(msg.msg);
        }
    };
}

function renderBoard(board, currentTurn) {
    const cells = document.querySelectorAll("#board button");
    cells.forEach((btn, i) => {
        btn.innerText = board[i];
        btn.disabled = board[i] !== "" || gameOver || currentTurn !== myUid;
    });
}

function cellClick(index) {
    if (gameOver || !ws) return;
    ws.send(JSON.stringify({ type: "move", cell: index }));
}

function goBack() {
    sessionStorage.removeItem("room_id");
    sessionStorage.removeItem("symbol");
    sessionStorage.removeItem("opponent");
    window.location.href = "lobby.html";
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await fetch(API + "/logout", { method: "POST", credentials: "include" });
    window.location.href = "login.html";
});

init();
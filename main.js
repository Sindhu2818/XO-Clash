// =============================================================================
// SHARED CONFIG
// =============================================================================
const API_BASE = "http://127.0.0.1:8000";

// =============================================================================
// SHARED: Theme / font loader (runs on every page)
// =============================================================================
function loadSettings() {
    const theme    = localStorage.getItem("theme")    || "dark";
    const fontSize = localStorage.getItem("fontSize") || "medium";
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-font",  fontSize);
}
loadSettings();

// =============================================================================
// SHARED: Logout button — calls /logout on server to clear cookie + is_online
// =============================================================================
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {
        try {
            await fetch(API_BASE + "/logout", {
                method: "POST",
                credentials: "include"   // send the session cookie
            });
        } catch (_) { /* ignore network errors */ }
        localStorage.clear();
        window.location.href = "login.html";
    });
}

// =============================================================================
// LOGIN PAGE
// =============================================================================
const video = document.getElementById("webcam");

if (video) {
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => { video.srcObject = stream; })
        .catch(err => {
            const status = document.getElementById("status");
            if (status) status.innerText = "Camera access denied ❌";
            console.error("Camera error:", err);
        });
}

function captureImage() {
    if (!video) return null;
    const canvas  = document.getElementById("canvas");
    const context = canvas.getContext("2d");
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg");
}

async function login() {
    const status = document.getElementById("status");
    if (!status) return;
    status.innerText = "Scanning...";

    const image = captureImage();
    if (!image) {
        status.innerText = "Camera not ready ❌";
        return;
    }

    try {
        const response = await fetch(API_BASE + "/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",          // receive the Set-Cookie header
            body: JSON.stringify({ image })
        });

        const data = await response.json();

        if (data.success) {
            status.innerText = "Login success ✅";
            // Store minimal display info in localStorage (NOT used for auth)
            localStorage.setItem("uid",  data.uid);
            localStorage.setItem("name", data.name);
            window.location.href = "lobby.html";
        } else {
            status.innerText = "Face not recognized ❌";
        }

    } catch (err) {
        status.innerText = "Server error ❌";
        console.error(err);
    }
}

// =============================================================================
// SESSION GUARD — protect lobby, game, leaderboard, profile pages
// Checks /me with the session cookie; redirects to login if not authenticated.
// =============================================================================
async function requireAuth() {
    try {
        const res = await fetch(API_BASE + "/me", { credentials: "include" });
        if (!res.ok) throw new Error("Not authenticated");
        const data = await res.json();
        // Refresh localStorage display values from server truth
        localStorage.setItem("uid",  data.uid);
        localStorage.setItem("name", data.name);
        return data;
    } catch (_) {
        localStorage.clear();
        window.location.href = "login.html";
        return null;
    }
}

// =============================================================================
// LOBBY PAGE
// =============================================================================
const playersTableBody = document.querySelector("#playersTable tbody");

if (playersTableBody) {
    (async () => {
        await requireAuth();
        loadPlayers();
    })();
}

async function loadPlayers() {
    if (!playersTableBody) return;
    try {
        const response = await fetch(API_BASE + "/api/users", { credentials: "include" });
        const players  = await response.json();
        const myUid    = localStorage.getItem("uid");

        playersTableBody.innerHTML = "";

        players.forEach(player => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${player.uid}</td>
                <td>${player.name}</td>
                <td>${player.elo_rating}</td>
                <td>${player.is_online ? "🟢 Online" : "🔴 Offline"}</td>
                <td>
                    ${player.is_online && player.uid !== myUid
                        ? `<button onclick="challenge('${player.uid}', '${player.name}')">Challenge</button>`
                        : "—"}
                </td>
            `;
            playersTableBody.appendChild(row);
        });

    } catch (err) {
        console.error("Error loading players:", err);
    }
}

// Show "You vs Opponent" header on game page
const playersHeader = document.getElementById("players");
if (playersHeader) {
    const me       = localStorage.getItem("name")     || "You";
    const opponent = localStorage.getItem("opponent") || "Opponent";
    playersHeader.innerText = `${me} vs ${opponent}`;
}

// Challenge — local redirect for now (Phase 3 will replace with WebSocket)
function challenge(uid, name) {
    localStorage.setItem("opponent",    name);
    localStorage.setItem("opponentUid", uid);
    window.location.href = "game.html";
}

function accept() {
    document.getElementById("popup").style.display = "none";
    window.location.href = "game.html";
}

function decline() {
    document.getElementById("popup").style.display = "none";
}

// =============================================================================
// GAME PAGE  (client-side placeholder — Phase 3 replaces this with WebSockets)
// =============================================================================
if (document.getElementById("board")) {
    requireAuth();  // guard the page
}

let board         = ["", "", "", "", "", "", "", "", ""];
let currentPlayer = "X";
let gameOver      = false;

function cellClick(index) {
    if (board[index] !== "" || gameOver) return;

    board[index] = currentPlayer;

    const buttons = document.querySelectorAll("#board button");
    buttons[index].innerText = currentPlayer;

    if (checkWinner()) {
        document.getElementById("result").innerText = `Player ${currentPlayer} Wins! 🎉`;
        gameOver = true;
        return;
    }

    if (board.every(cell => cell !== "")) {
        document.getElementById("result").innerText = "It's a Draw!";
        gameOver = true;
        return;
    }

    currentPlayer = currentPlayer === "X" ? "O" : "X";
    document.getElementById("turn").innerText = `Turn: ${currentPlayer}`;
}

function checkWinner() {
    const winPatterns = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6]
    ];
    return winPatterns.some(([a, b, c]) =>
        board[a] && board[a] === board[b] && board[a] === board[c]
    );
}

function goBack() {
    window.location.href = "lobby.html";
}
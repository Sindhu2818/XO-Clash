// ─── Config ───────────────────────────────────────────────────────────────────
const API_BASE = "http://127.0.0.1:8000";

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const profilePhoto = document.getElementById("profilePhoto");
const playerName   = document.getElementById("playerName");
const studentId    = document.getElementById("studentId");
const eloScore     = document.getElementById("eloScore");
const playerRank   = document.getElementById("playerRank");
const statusText   = document.getElementById("statusText");
const logoutBtn    = document.getElementById("logoutBtn");

// ─── Read uid from URL query string e.g. profile.html?uid=cs001 ───────────────
const params = new URLSearchParams(window.location.search);
const uid    = params.get("uid") || localStorage.getItem("uid");

// ─── Fetch player data from MySQL via REST API ────────────────────────────────
async function fetchUserProfile(uid) {
    const res = await fetch(API_BASE + "/api/users/" + encodeURIComponent(uid), { credentials: "include" });
    if (!res.ok) throw new Error("User not found (" + res.status + ")");
    return res.json();
}

// ─── Fetch profile image from MongoDB via REST API ────────────────────────────
async function fetchProfileImage(uid) {
    try {
        const res = await fetch(API_BASE + "/api/images/" + encodeURIComponent(uid), { credentials: "include" });
        if (!res.ok) return null;
        const data = await res.json();
        return data.image ? data.image : null;
    } catch (e) {
        return null;
    }
}

// ─── Fetch all users to calculate rank from elo position ─────────────────────
async function fetchRank(uid) {
    try {
        const res = await fetch(API_BASE + "/api/users", { credentials: "include" });
        if (!res.ok) return null;
        const data = await res.json();
        data.sort(function(a, b) { return b.elo_rating - a.elo_rating; });
        for (var i = 0; i < data.length; i++) {
            if (data[i].uid === uid) return i + 1;
        }
        return null;
    } catch (e) {
        return null;
    }
}

// ─── Load and render the full profile ────────────────────────────────────────
async function loadProfile() {
    if (!uid) {
        if (playerName) playerName.textContent = "No player specified.";
        return;
    }

    if (playerName) playerName.textContent = "Loading...";

    try {
        const [player, imageData] = await Promise.all([
            fetchUserProfile(uid),
            fetchProfileImage(uid),
        ]);

        // ── Profile photo from MongoDB (base64) ──
        if (imageData && profilePhoto) {
            profilePhoto.src = "data:image/jpeg;base64," + imageData;
        }

        const elo = (player.elo_rating !== null && player.elo_rating !== undefined)
            ? player.elo_rating
            : 1200;

        if (playerName)  playerName.textContent  = player.name;
        if (studentId)   studentId.textContent   = player.uid.toUpperCase();
        if (eloScore)    eloScore.textContent     = elo;
        if (statusText)  statusText.textContent   = player.is_online ? "🟢 Online" : "🔴 Offline";

        const rank = await fetchRank(uid);
        if (playerRank)  playerRank.textContent   = rank ? "#" + rank : "—";

    } catch (err) {
        console.error("[profile] loadProfile failed:", err);
        if (playerName) playerName.textContent = "Player not found.";
        if (studentId)  studentId.textContent  = "—";
    }
}

// ─── Logout ───────────────────────────────────────────────────────────────────
if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {
        try {
            await fetch(API_BASE + "/logout", { method: "POST", credentials: "include" });
        } catch (_) {}
        localStorage.clear();
        window.location.href = "login.html";
    });
}

// ─── Apply saved theme and font size from settings ────────────────────────────
function loadSettings() {
    const theme    = localStorage.getItem("theme")    || "dark";
    const fontSize = localStorage.getItem("fontSize") || "medium";
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-font",  fontSize);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
loadSettings();
loadProfile();
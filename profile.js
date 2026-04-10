// ─── Config ───────────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:5000"; // Change to your backend URL
 
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
const uid    = params.get("uid");
 
// ─── Fetch player data from MySQL via REST API ────────────────────────────────
async function fetchUserProfile(uid) {
    const res = await fetch(API_BASE + "/api/users/" + encodeURIComponent(uid));
    if (!res.ok) throw new Error("User not found (" + res.status + ")");
    return res.json();
}
 
// ─── Fetch profile image from MongoDB via REST API ────────────────────────────
// Image was scraped from player's website and stored as base64 in MongoDB
async function fetchProfileImage(uid) {
    try {
        const res = await fetch(API_BASE + "/api/images/" + encodeURIComponent(uid));
        if (!res.ok) return null;
        const data = await res.json();
        // MongoDB returns: { uid, image: "<base64 string>" }
        return data.image ? data.image : null;
    } catch (e) {
        return null; // Image is optional — fall back to placeholder
    }
}
 
// ─── Fetch all users to calculate rank from elo position ─────────────────────
async function fetchRank(uid, currentElo) {
    try {
        const res = await fetch(API_BASE + "/api/users");
        if (!res.ok) return null;
        const data = await res.json();
        // Sort by elo descending and find position of this player
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
        playerName.textContent = "No player specified.";
        return;
    }
 
    playerName.textContent = "Loading...";
 
    try {
        // Fetch user data and profile image in parallel
        const results   = await Promise.all([
            fetchUserProfile(uid),
            fetchProfileImage(uid),
        ]);
        const player    = results[0];
        const imageData = results[1];
 
        // ── Profile photo from MongoDB (base64) ──
        if (imageData) {
            profilePhoto.src = "data:image/jpeg;base64," + imageData;
        }
        // else: keep the placeholder image already set in HTML
 
        // ── Elo with safe fallback ──
        const elo = player.elo_rating !== null && player.elo_rating !== undefined ? player.elo_rating : 1200;
 
        // ── Populate fields from MySQL ──
        playerName.textContent = player.name;
        studentId.textContent  = player.uid.toUpperCase();
        eloScore.textContent   = elo;
        statusText.textContent = player.is_online ? "🟢 Online" : "🔴 Offline";
 
        // ── Calculate and display rank ──
        const rank = await fetchRank(uid, elo);
        playerRank.textContent = rank ? "#" + rank : "—";
 
    } catch (err) {
        console.error("[profile] loadProfile failed:", err);
        playerName.textContent = "Player not found.";
        studentId.textContent  = "—";
    }
}
 
// ─── Logout ───────────────────────────────────────────────────────────────────
logoutBtn.addEventListener("click", function() {
    localStorage.clear();
    window.location.href = "login.html";
});
 
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
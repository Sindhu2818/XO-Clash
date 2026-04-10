// ─── Config ───────────────────────────────────────────────────────────────────
const API_BASE = "http://127.0.0.1:8000";

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const tbody        = document.getElementById("leaderboardBody");
const searchInput  = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");

// ─── State ────────────────────────────────────────────────────────────────────
var allPlayers = [];

// ─── Fetch all players from MySQL via REST API ────────────────────────────────
async function fetchPlayers() {
    try {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>Loading...</td></tr>";

        const usersRes = await fetch(API_BASE + "/api/users", { credentials: "include" });
        if (!usersRes.ok) throw new Error("Server error: " + usersRes.status);

        const data = await usersRes.json();

        allPlayers = data.map(function(player) {
            return {
                uid:    player.uid,
                name:   player.name,
                elo:    player.elo_rating !== null && player.elo_rating !== undefined ? player.elo_rating : 1200,
                status: player.is_online ? "online" : "offline",
            };
        });

        // Sort by elo descending and assign ranks
        allPlayers.sort(function(a, b) { return b.elo - a.elo; });
        allPlayers.forEach(function(p, i) { p.rank = i + 1; });

        applyFilters();

    } catch (err) {
        console.error("[leaderboard] fetchPlayers failed:", err);
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;color:red;'>Failed to load leaderboard. Is the server running?</td></tr>";
    }
}

// ─── Render table rows ────────────────────────────────────────────────────────
function renderTable(data) {
    if (data.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>No players found.</td></tr>";
        return;
    }

    tbody.innerHTML = "";
    data.forEach(function(player) {
        const statusIcon = player.status === "online" ? "🟢 Online" : "🔴 Offline";

        const row = "<tr>" +
            "<td>" + player.rank + "</td>" +
            "<td>" + player.uid + "</td>" +
            "<td><a href='profile.html?uid=" + encodeURIComponent(player.uid) + "'>" + player.name + "</a></td>" +
            "<td>" + player.elo + "</td>" +
            "<td>" + statusIcon + "</td>" +
            "</tr>";

        tbody.innerHTML += row;
    });
}

// ─── Filter by name search and online status ──────────────────────────────────
function applyFilters() {
    const searchText  = searchInput  ? searchInput.value.toLowerCase()  : "";
    const statusValue = statusFilter ? statusFilter.value               : "all";

    const filtered = allPlayers.filter(function(player) {
        const matchesSearch = player.name.toLowerCase().includes(searchText) ||
                              String(player.uid).toLowerCase().includes(searchText);
        const matchesStatus = statusValue === "all" || player.status === statusValue;
        return matchesSearch && matchesStatus;
    });

    renderTable(filtered);
}

// ─── Events ───────────────────────────────────────────────────────────────────
if (searchInput)  searchInput.addEventListener("input",   applyFilters);
if (statusFilter) statusFilter.addEventListener("change", applyFilters);

// ─── Logout ───────────────────────────────────────────────────────────────────
const logoutBtn = document.getElementById("logoutBtn");
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
fetchPlayers();
const API = "http://127.0.0.1:8000";

// Apply saved theme and font size
const theme    = localStorage.getItem("theme")    || "dark";
const fontSize = localStorage.getItem("fontSize") || "medium";
document.documentElement.setAttribute("data-theme", theme);
document.documentElement.setAttribute("data-font", fontSize);

// All players loaded from the server (kept so filters work client-side)
let allPlayers = [];

async function loadLeaderboard() {
    const tbody = document.getElementById("leaderboardBody");
    tbody.innerHTML = "<tr><td colspan='5' style='text-align:center'>Loading...</td></tr>";

    const res = await fetch(API + "/api/users", { credentials: "include" });

    if (res.status === 401) {
        window.location.href = "login.html";
        return;
    }

    if (!res.ok) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;color:red'>Failed to load. Is the server running?</td></tr>";
        return;
    }

    // Server already returns ALL players (from batch_data.csv) sorted by elo descending
    // This includes players who have never logged in — they just show elo 1200 and Offline
    const data = await res.json();
    allPlayers  = data.map((player, index) => ({
        rank:      index + 1,
        uid:       player.uid,
        name:      player.name,
        elo:       player.elo_rating,
        is_online: player.is_online
    }));

    renderTable(allPlayers);
    applyFilters(); // Re-apply any active filters after refresh
}

function renderTable(players) {
    const tbody = document.getElementById("leaderboardBody");
    tbody.innerHTML = "";

    if (players.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center'>No players found.</td></tr>";
        return;
    }

    players.forEach(player => {
        const medal  = player.rank === 1 ? "🥇" : player.rank === 2 ? "🥈" : player.rank === 3 ? "🥉" : player.rank;
        const status = player.is_online ? "🟢 Online" : "🔴 Offline";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${medal}</td>
            <td>${player.uid}</td>
            <td><a href="profile.html?uid=${encodeURIComponent(player.uid)}">${player.name}</a></td>
            <td>${player.elo}</td>
            <td>${status}</td>
        `;
        tbody.appendChild(tr);
    });
}

function applyFilters() {
    const search = document.getElementById("searchInput").value.toLowerCase();
    const status = document.getElementById("statusFilter").value;

    const filtered = allPlayers.filter(player => {
        const matchesSearch = player.name.toLowerCase().includes(search) ||
                              player.uid.toLowerCase().includes(search);
        const matchesStatus = status === "all" ||
                              (status === "online"  &&  player.is_online) ||
                              (status === "offline" && !player.is_online);
        return matchesSearch && matchesStatus;
    });

    renderTable(filtered);
}

document.getElementById("searchInput").addEventListener("input", applyFilters);
document.getElementById("statusFilter").addEventListener("change", applyFilters);

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await fetch(API + "/logout", { method: "POST", credentials: "include" });
    localStorage.clear();
    window.location.href = "login.html";
});

// ── Auto-refresh via WebSocket ────────────────────────────────────────────────
// The server broadcasts a "leaderboard_update" event whenever a match ends
// and Elo ratings are recalculated. This keeps the leaderboard live without
// the user having to manually refresh.
function connectLeaderboardSocket() {
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/leaderboard`);

    ws.addEventListener("message", (event) => {
        try {
            const msg = JSON.parse(event.data);
            // Server sends { type: "leaderboard_update" } after every match result
            if (msg.type === "leaderboard_update") {
                loadLeaderboard();
            }
        } catch (e) {
            console.error("WS parse error:", e);
        }
    });

    ws.addEventListener("close", () => {
        // Reconnect after 3 s if the socket drops
        setTimeout(connectLeaderboardSocket, 3000);
    });

    ws.addEventListener("error", (err) => {
        console.error("Leaderboard WS error:", err);
        ws.close();
    });
}

// Initial load + open WebSocket for live Elo updates
loadLeaderboard();
connectLeaderboardSocket();
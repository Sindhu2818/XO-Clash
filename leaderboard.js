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

    // Server already returns players sorted by elo descending
    const data = await res.json();
    allPlayers  = data.map((player, index) => ({
        rank:      index + 1,
        uid:       player.uid,
        name:      player.name,
        elo:       player.elo_rating,
        is_online: player.is_online
    }));

    renderTable(allPlayers);
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

loadLeaderboard();
// test data
const players = [
    { rank: 1, name: "Arjun Kumar",   elo: 1450, wins: 18, losses: 5,  status: "online" },
    { rank: 2, name: "Priya Sharma",  elo: 1380, wins: 15, losses: 7,  status: "online" },
    { rank: 3, name: "Rahul Verma",   elo: 1300, wins: 12, losses: 8,  status: "offline" },
    { rank: 4, name: "Sneha Iyer",    elo: 1250, wins: 10, losses: 10, status: "online" },
    { rank: 5, name: "Karan Mehta",   elo: 1230, wins: 8,  losses: 12, status: "offline" },
];

const tbody         = document.getElementById("leaderboardBody");
const searchInput   = document.getElementById("searchInput");
const statusFilter  = document.getElementById("statusFilter");

function renderTable(data) {
    tbody.innerHTML = "";

    data.forEach(function(player) {
        const winRate = Math.round((player.wins / (player.wins + player.losses)) * 100) + "%";
        const statusIcon = player.status === "online" ? "🟢 Online" : "🔴 Offline";

        const row = `
            <tr>
                <td>${player.rank}</td>
                <td>${player.name}</td>
                <td>${player.elo}</td>
                <td>${player.wins}</td>
                <td>${player.losses}</td>
                <td>${winRate}</td>
                <td>${statusIcon}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function applyFilters() {
    const searchText   = searchInput.value.toLowerCase();
    const statusValue  = statusFilter.value;  // "all", "online", "offline"

    const filtered = players.filter(function(player) {
        const matchesSearch = player.name.toLowerCase().includes(searchText);
        const matchesStatus = statusValue === "all" || player.status === statusValue;
        return matchesSearch && matchesStatus;
    });

    renderTable(filtered);
}

searchInput.addEventListener("input", applyFilters);
statusFilter.addEventListener("change", applyFilters);

function loadSettings() {
    const theme    = localStorage.getItem("theme")    || "dark";
    const fontSize = localStorage.getItem("fontSize") || "medium";
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-font",  fontSize);
}

loadSettings();
renderTable(players);
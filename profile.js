const players = {
    "cs001": { name: "Arjun Kumar",  studentId: "CS001", elo: 1450, rank: 1, wins: 18, draws: 3, losses: 5,  status: "online" },
    "cs002": { name: "Priya Sharma", studentId: "CS002", elo: 1380, rank: 2, wins: 15, draws: 2, losses: 7,  status: "offline" },
    "cs003": { name: "Rahul Verma",  studentId: "CS003", elo: 1300, rank: 3, wins: 12, draws: 4, losses: 8,  status: "online" },
};

const profilePhoto = document.getElementById("profilePhoto");
const onlineStatus = document.getElementById("onlineStatus");
const playerName   = document.getElementById("playerName");
const studentId    = document.getElementById("studentId");
const eloScore     = document.getElementById("eloScore");
const playerRank   = document.getElementById("playerRank");
const winCount     = document.getElementById("winCount");
const drawCount    = document.getElementById("drawCount");
const lossCount    = document.getElementById("lossCount");
const gamesPlayed  = document.getElementById("gamesPlayed");
const winRate      = document.getElementById("winRate");
const statusText   = document.getElementById("statusText");
const logoutBtn    = document.getElementById("logoutBtn");

const params = new URLSearchParams(window.location.search);
const uid    = params.get("uid");

function loadProfile() {
    const player = players[uid];

    if (!player) {
        playerName.textContent = "Player not found";
        return;
    }

    const totalGames    = player.wins + player.draws + player.losses;
    const calculatedWinRate = totalGames > 0
        ? Math.round((player.wins / totalGames) * 100) + "%"
        : "0%";

    playerName.textContent  = player.name;
    studentId.textContent   = player.studentId;
    eloScore.textContent    = player.elo;
    playerRank.textContent  = "#" + player.rank;
    winCount.textContent    = player.wins;
    drawCount.textContent   = player.draws;
    lossCount.textContent   = player.losses;
    gamesPlayed.textContent = totalGames;
    winRate.textContent     = calculatedWinRate;

    if (player.status === "online") {
        onlineStatus.textContent = "🟢 Online";
        statusText.textContent   = "Online";
    } else {
        onlineStatus.textContent = "🔴 Offline";
        statusText.textContent   = "Offline";
    }
}

logoutBtn.addEventListener("click", function() {
    localStorage.clear();
    window.location.href = "login.html";
});

function loadSettings() {
    const theme    = localStorage.getItem("theme")    || "dark";
    const fontSize = localStorage.getItem("fontSize") || "medium";
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-font",  fontSize);
}

loadSettings();
loadProfile();

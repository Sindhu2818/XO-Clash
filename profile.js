const API = "http://127.0.0.1:8000";

// Apply saved theme and font size
const theme    = localStorage.getItem("theme")    || "dark";
const fontSize = localStorage.getItem("fontSize") || "medium";
document.documentElement.setAttribute("data-theme", theme);
document.documentElement.setAttribute("data-font", fontSize);

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await fetch(API + "/logout", { method: "POST", credentials: "include" });
    localStorage.clear();
    window.location.href = "login.html";
});

async function loadProfile() {
    // Redirect to login if not authenticated
    const meRes = await fetch(API + "/me", { credentials: "include" });
    if (!meRes.ok) {
        window.location.href = "login.html";
        return;
    }
    const me = await meRes.json();

    const params    = new URLSearchParams(window.location.search);
    const targetUid = params.get("uid") || me.uid;

    // Fetch user data
    const userRes = await fetch(API + "/api/users/" + encodeURIComponent(targetUid), { credentials: "include" });
    if (!userRes.ok) {
        document.getElementById("playerName").textContent = "Player not found.";
        return;
    }
    const player = await userRes.json();

    // Fetch profile image
    const imgRes = await fetch(API + "/api/images/" + encodeURIComponent(targetUid), { credentials: "include" });
    if (imgRes.ok) {
        const imgData = await imgRes.json();
        if (imgData.image) {
            document.getElementById("profilePhoto").src = "data:image/jpeg;base64," + imgData.image;
        }
    }

    // Fetch all users just to calculate rank
    const allRes = await fetch(API + "/api/users", { credentials: "include" });
    let rank = "—";
    if (allRes.ok) {
        const allUsers = await allRes.json();
        // Server already sorts by elo desc, so index = rank
        const idx = allUsers.findIndex(u => u.uid === targetUid);
        if (idx !== -1) rank = "#" + (idx + 1);
    }

    // Populate profile card
    document.getElementById("playerName").textContent = player.name;
    document.getElementById("studentId").textContent  = player.uid.toUpperCase();
    document.getElementById("eloScore").textContent   = player.elo_rating;
    document.getElementById("playerRank").textContent = rank;
    document.getElementById("statusText").textContent = player.is_online ? "🟢 Online" : "🔴 Offline";

    // Fetch match history
    const matchRes = await fetch(API + "/api/matches/" + encodeURIComponent(targetUid), { credentials: "include" });
    if (!matchRes.ok) return;

    const matches = await matchRes.json();
    document.getElementById("totalGames").textContent = matches.length;

    if (matches.length === 0) {
        document.getElementById("noMatches").style.display = "block";
        return;
    }

    document.getElementById("matchTable").style.display = "table";
    const tbody = document.getElementById("matchHistory");

    matches.forEach(m => {
        const outcomeLabel =
            m.outcome === "win"    ? "🏆 Win"     :
            m.outcome === "draw"   ? "🤝 Draw"    :
            m.outcome === "loss"   ? "😔 Loss"    : "🏳️ Forfeit";

        const date = m.played_at ? new Date(m.played_at).toLocaleDateString() : "—";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><a href="profile.html?uid=${encodeURIComponent(m.opponent_uid)}">${m.opponent_name}</a></td>
            <td>${outcomeLabel}</td>
            <td>${date}</td>
        `;
        tbody.appendChild(tr);
    });
}

loadProfile();
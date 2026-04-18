const API = "http://127.0.0.1:8000";
const WS  = "ws://127.0.0.1:8000";

let myUid = null;
let myName = null;
let ws = null;
let pendingChallenger = null;

async function init() {
    const res = await fetch(API + "/me", { credentials: "include" });
    if (!res.ok) {
        window.location.href = "login.html";
        return;
    }
    const user = await res.json();
    myUid = user.uid;
    myName = user.name;
    connectLobby();
}

function connectLobby() {
    ws = new WebSocket(WS + "/ws/lobby");

    ws.onopen = () => {
        ws.send(JSON.stringify({ uid: myUid, name: myName }));
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "lobby_update") {
            renderPlayers(msg.users);
        }
        else if (msg.type === "challenge_received") {
            pendingChallenger = msg.from;
            document.getElementById("popupText").innerText =
                `${msg.from_name} challenged you!`;
            document.getElementById("popup").style.display = "block";
        }
        else if (msg.type === "challenge_declined") {
            alert(`${msg.by} declined your challenge.`);
        }
        else if (msg.type === "game_start") {
            sessionStorage.setItem("room_id", msg.room_id);
            sessionStorage.setItem("symbol", msg.symbol);
            sessionStorage.setItem("opponent", msg.opponent_name);
            window.location.href = "game.html";
        }
    };

    ws.onclose = () => {
        setTimeout(() => {
            if (myUid) {
                connectLobby();
            } else {
                init();
            }
        }, 2000);
    };
}

function renderPlayers(users) {
    const tbody = document.querySelector("#playersTable tbody");
    tbody.innerHTML = "";

    users.forEach(user => {
        if (user.uid === myUid) return;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${user.uid}</td>
            <td>${user.name}</td>
            <td>${user.elo_rating}</td>
            <td><button onclick="challenge('${user.uid}')">Challenge</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function challenge(targetUid) {
    ws.send(JSON.stringify({ type: "challenge", target: targetUid }));
}

function accept() {
    ws.send(JSON.stringify({ type: "accept", from: pendingChallenger }));
    document.getElementById("popup").style.display = "none";
}

function decline() {
    ws.send(JSON.stringify({ type: "decline", from: pendingChallenger }));
    document.getElementById("popup").style.display = "none";
    pendingChallenger = null;
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await fetch(API + "/logout", { method: "POST", credentials: "include" });
    window.location.href = "login.html";
});

init();
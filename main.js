//login page
// start webcam
const video = document.getElementById('webcam');

if (video) {
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            video.srcObject = stream;
        });
}

// capture image
function captureImage() {
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0);

    return canvas.toDataURL('image/jpeg');
}

// login button
async function login() {
    const status = document.getElementById('status');
    status.innerText = "Scanning...";

    const image = captureImage();

    const response = await fetch("http://localhost:8000/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ image })
    });

    const data = await response.json();

    if (data.success) {
        status.innerText = "Login success ✅";
        window.location.href = "lobby.html";
    } else {
        status.innerText = "Face not recognized ❌";
    }
}
//lobby page

// fake players
const players = [
    { name: "Rahul", elo: 1200 },
    { name: "Priya", elo: 1300 },
    { name: "Arjun", elo: 1250 },
    { name: "Sneha", elo: 1100 }
];

// render players
const playersDiv = document.getElementById("players");

if (playersDiv) {
const players = [
    { uid: "cs001", name: "Rahul", elo: 1200, online: true },
    { uid: "cs002", name: "Priya", elo: 1300, online: true },
    { uid: "cs003", name: "Arjun", elo: 1250, online: false },
    { uid: "cs004", name: "Sneha", elo: 1100, online: true }
];

const tableBody = document.querySelector("#playersTable tbody");

if (tableBody) {
    players.forEach(player => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${player.uid}</td>
            <td>${player.name}</td>
            <td>${player.elo}</td>
            <td>${player.online ? "🟢 Online" : "🔴 Offline"}</td>
            <td>
                ${player.online 
                    ? `<button onclick="challenge('${player.name}')">Challenge</button>` 
                    : `-`}
            </td>
        `;

        tableBody.appendChild(row);
    });
}
}

// challenge popup
let selectedOpponent = null;

function challenge(name) {
    selectedOpponent = name;

    const popup = document.getElementById("popup");
    const text = document.getElementById("popupText");

    text.innerText = `Send challenge to ${name}?`;
    popup.style.display = "block";
}

function accept() {
    document.getElementById("popup").style.display = "none";

    // simulate redirect to game
    window.location.href = "game.html";
}

function decline() {
    document.getElementById("popup").style.display = "none";
}

//game page

let board = ["", "", "", "", "", "", "", "", ""];
let currentPlayer = "X";
let gameOver = false;

// handle click
function cellClick(index) {
    if (board[index] !== "" || gameOver) return;

    board[index] = currentPlayer;

    // update UI
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

    // switch turn
    currentPlayer = currentPlayer === "X" ? "O" : "X";
    document.getElementById("turn").innerText = `Turn: ${currentPlayer}`;
}

// check winner
function checkWinner() {
    const winPatterns = [
        [0,1,2], [3,4,5], [6,7,8],
        [0,3,6], [1,4,7], [2,5,8],
        [0,4,8], [2,4,6]
    ];

    return winPatterns.some(pattern => {
        const [a, b, c] = pattern;
        return board[a] &&
               board[a] === board[b] &&
               board[a] === board[c];
    });
}

// go back
function goBack() {
    window.location.href = "lobby.html";
}
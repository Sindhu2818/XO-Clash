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
    if (!video) return null; // safety

    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0);

    return canvas.toDataURL('image/jpeg');
}

// login button
async function login() {
    const status = document.getElementById("status");
    status.innerText = "Scanning...";

    const image = captureImage();
    if (!image) {
        status.innerText = "Camera not ready ❌";
        return;
    }
    try {
        const response = await fetch("http://127.0.0.1:8000/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ image })
        });

        const data = await response.json();

        if (data.success) {
            status.innerText = "Login success ✅";

            // store user info (IMPORTANT)
            localStorage.setItem("uid", data.uid);
            localStorage.setItem("name", data.name);

            window.location.href = "lobby.html";
        } else {
            status.innerText = "Face not recognized ❌";
        }

    } catch (err) {
        status.innerText = "Server error ❌";
        alert("Backend not running?");
        console.error(err);
    }
}
//lobby page

async function loadPlayers() {
    const tableBody = document.querySelector("#playersTable tbody");
    if(!tableBody) return;
    try {
        const response = await fetch("http://127.0.0.1:8000/users");
        const players = await response.json();

        tableBody.innerHTML = "";

        players.forEach(player => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${player.uid}</td>
                <td>${player.name}</td>
                <td>${player.elo}</td>
                <td>${player.is_online ? "🟢 Online" : "🔴 Offline"}</td>
                <td>
                    ${player.is_online && player.uid !== localStorage.getItem("uid")
                        ? `<button onclick="challenge('${player.uid}', '${player.name}')">Challenge</button>`
                        : "-"}
                </td>
            `;

            tableBody.appendChild(row);
        });

    } catch (err) {
        console.error("Error loading players:", err);
    }
}

if (document.querySelector("#playersTable tbody")) {
    loadPlayers();
}

if (document.getElementById("players")) {
    const me = localStorage.getItem("name");
    const opponent = localStorage.getItem("opponent");

    document.getElementById("players").innerText =
        `${me} vs ${opponent}`;
}



// challenge popup

function challenge(uid,name) {
    localStorage.setItem("opponent", name);

    window.location.href = "game.html";
    
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
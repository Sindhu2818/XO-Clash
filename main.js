const API = "http://127.0.0.1:8000";

// Apply saved theme and font size
const theme    = localStorage.getItem("theme")    || "dark";
const fontSize = localStorage.getItem("fontSize") || "medium";
document.documentElement.setAttribute("data-theme", theme);
document.documentElement.setAttribute("data-font", fontSize);


// LOGOUT (any page with logoutBtn)
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        await fetch(API + "/logout", {
            method: "POST",
            credentials: "include"
        });
        window.location.href = "login.html";
    });
}

// WEBCAM + LOGIN (login.html only)
const video = document.getElementById("webcam");

if (video) {
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => video.srcObject = stream)
        .catch(() => {
            document.getElementById("status").innerText = "Camera denied ❌";
        });
}

function capture() {
    if (!video || video.videoWidth === 0) return null;

    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    return canvas.toDataURL("image/jpeg");
}

async function login() {
    const status = document.getElementById("status");
    status.innerText = "Scanning...";

    const img = capture();
    if (!img) {
        status.innerText = "Camera not ready ❌";
        return;
    }

    try {
        const res = await fetch(API + "/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ image: img })
        });

        const data = await res.json();

        if (data.success) {
            status.innerText = "Login success ✅";
            window.location.href = "lobby.html";
        } else {
            status.innerText = "Face not recognized ❌";
        }

    } catch {
        status.innerText = "Server error ❌";
    }
}

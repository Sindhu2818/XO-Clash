const lightBtn = document.getElementById("lightbtn");
const darkBtn = document.getElementById("darkbtn");
const smallBtn = document.getElementById("smallSize");
const mediumBtn = document.getElementById("mediumSize");
const largeBtn = document.getElementById("largeSize");
const soundOnBtn = document.getElementById("soundOn");
const soundOffBtn = document.getElementById("soundOff");
const musicOnBtn = document.getElementById("musicOn");
const musicOffBtn = document.getElementById("musicOff");
const logoutBtn = document.getElementById("logoutBtn");

function loadSettings() {
    const theme = localStorage.getItem("theme") || "dark";
    const fontSize = localStorage.getItem("fontSize") || "medium";
    const sound = localStorage.getItem("sound") || "on";
    const music = localStorage.getItem("music") || "on";

    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-font", fontSize);
}

lightBtn.addEventListener("click", function() {
    localStorage.setItem("theme", "light");
    document.documentElement.setAttribute("data-theme", "light");
});

darkBtn.addEventListener("click", function() {
    localStorage.setItem("theme", "dark");
    document.documentElement.setAttribute("data-theme", "dark");
});

smallBtn.addEventListener("click", function() {
    localStorage.setItem("fontSize", "small");
    document.documentElement.setAttribute("data-font", "small");
});

mediumBtn.addEventListener("click", function() {
    localStorage.setItem("fontSize", "medium");
    document.documentElement.setAttribute("data-font", "medium");
});

largeBtn.addEventListener("click", function() {
    localStorage.setItem("fontSize", "large");
    document.documentElement.setAttribute("data-font", "large");
});

soundOnBtn.addEventListener("click", function() {
    localStorage.setItem("sound", "on");
});

soundOffBtn.addEventListener("click", function() {
    localStorage.setItem("sound", "off");
});

musicOnBtn.addEventListener("click", function() {
    localStorage.setItem("music", "on");
});

musicOffBtn.addEventListener("click", function() {
    localStorage.setItem("music", "off");
});

logoutBtn.addEventListener("click", function() {
    localStorage.clear();
    window.location.href = "login.html";
});

loadSettings();
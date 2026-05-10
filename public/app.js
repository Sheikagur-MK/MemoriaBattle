const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let myData = { x: canvas.width / 2, y: canvas.height / 2, trail: [] };
let allPlayers = {};

// Movimiento orgánico: Seguimiento de ratón o touch
window.addEventListener('mousemove', (e) => {
    myData.x = e.clientX;
    myData.y = e.clientY;
    socket.emit('move', { x: myData.x, y: myData.y });
});

// Soporte para móviles
window.addEventListener('touchmove', (e) => {
    myData.x = e.touches[0].clientX;
    myData.y = e.touches[0].clientY;
    socket.emit('move', { x: myData.x, y: myData.y });
});

socket.on('updatePlayers', (data) => { allPlayers = data; });
socket.on('playerMoved', (data) => {
    if (allPlayers[data.id]) {
        allPlayers[data.id].x = data.x;
        allPlayers[data.id].y = data.y;
    }
});

function draw() {
    ctx.fillStyle = 'rgba(10, 10, 10, 0.2)'; // Efecto de estela (Motion Blur)
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let id in allPlayers) {
        const p = allPlayers[id];
        
        // Dibujar el "Sueldo" (Rastro)
        ctx.beginPath();
        ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.closePath();
    }

    requestAnimationFrame(draw);
}

draw();

// ─── ESTADO DEL CLIENTE ──────────────────────────────────────────────────────
const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

// Ajuste inicial del canvas
canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Estado del juego
let gameState   = null;
let selfId      = null;
let worldW      = 3000;
let worldH      = 3000;
let matchActive = false;

// Cámara y Zoom
let camX = 0, camY = 0;
// 4. QUITAR ZOOM: 0.5 hace que se vea el doble del mapa (más lejos)
const CAMERA_ZOOM = 0.5; 

// Input
const keys = { up: false, down: false, left: false, right: false, shoot: false };
let mouseAngle = 0;

// Cooldown de habilidad
let abilityCooldownMs  = 0;
let abilityCooldownMax = 0;
let abilityTimer       = null;

// ─── ADAPTACIÓN PARA ANDROID (TOUCH) ──────────────────────────────────────────
// 3. SOPORTE ANDROID: Manejo de toques para apuntado y movimiento
canvas.addEventListener('touchstart', handleTouch, { passive: false });
canvas.addEventListener('touchmove', handleTouch, { passive: false });
canvas.addEventListener('touchend', () => {
    keys.up = false;
    sendInput();
}, { passive: false });

function handleTouch(e) {
    if (!matchActive) return;
    e.preventDefault();
    const touch = e.touches[0];
    
    // Calculamos el centro de la pantalla
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Ángulo desde el centro hacia donde toca el dedo
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    mouseAngle = Math.atan2(dy, dx);

    // En Android, al tocar la pantalla el jugador se mueve hacia esa dirección
    keys.up = true; 
    sendInput();
}

// ─── INPUT TECLADO Y MOUSE ────────────────────────────────────────────────────
const KEY_MAP = {
    'ArrowUp':'up','w':'up','W':'up',
    'ArrowDown':'down','s':'down','S':'down',
    'ArrowLeft':'left','a':'left','A':'left',
    'ArrowRight':'right','d':'right','D':'right'
};

window.addEventListener('keydown', e => {
    const k = KEY_MAP[e.key];
    if (k && !keys[k]) { keys[k] = true; sendInput(); }
    if ((e.key === ' ' || e.key === 'e' || e.key === 'E') && matchActive) {
        socket.emit('player_ability');
    }
});

window.addEventListener('keyup', e => {
    const k = KEY_MAP[e.key];
    if (k) { keys[k] = false; sendInput(); }
});

canvas.addEventListener('mousemove', e => {
    if (!matchActive || !gameState) return;
    const self = getSelf();
    if (!self) return;
    
    // Ajuste de ángulo considerando el ZOOM 0.5
    const sx = (self.x - camX) * CAMERA_ZOOM;
    const sy = (self.y - camY) * CAMERA_ZOOM;
    mouseAngle = Math.atan2(e.clientY - sy, e.clientX - sx);
    sendInput();
});

canvas.addEventListener('mousedown', e => {
    if (e.button === 0 && matchActive) {
        socket.emit('player_shoot', { angle: mouseAngle });
    }
});

function sendInput() {
    if (!matchActive) return;
    socket.emit('player_input', { keys: { ...keys }, angle: mouseAngle });
}

// ─── EVENTOS DEL SERVIDOR ─────────────────────────────────────────────────────

socket.on('match_start', (data) => {
    selfId      = socket.id;
    worldW      = data.worldW;
    worldH      = data.worldH;
    matchActive = true;

    // Posicionamiento inicial de cámara
    camX = data.self.x - (canvas.width / CAMERA_ZOOM) / 2;
    camY = data.self.y - (canvas.height / CAMERA_ZOOM) / 2;

    document.getElementById('screen-game-ui').style.display = 'block';
    loop();
});

socket.on('game_state', (data) => {
    gameState = data;
    updateHUD(data);
});

socket.on('ability_used', (data) => {
    abilityCooldownMax = data.cooldown;
    abilityCooldownMs  = data.cooldown;
    if (abilityTimer) clearInterval(abilityTimer);
    abilityTimer = setInterval(() => {
        abilityCooldownMs = Math.max(0, abilityCooldownMs - 100);
        if (abilityCooldownMs <= 0) clearInterval(abilityTimer);
    }, 100);
});

// ─── LOOP DE RENDER ───────────────────────────────────────────────────────────
function loop() {
    if (!matchActive) return;
    requestAnimationFrame(loop);
    render();
}

function render() {
    if (!gameState) return;
    const self = getSelf();

    // Seguimiento de cámara suave
    if (self) {
        const targetX = self.x - (canvas.width / CAMERA_ZOOM) / 2;
        const targetY = self.y - (canvas.height / CAMERA_ZOOM) / 2;
        camX += (targetX - camX) * 0.1;
        camY += (targetY - camY) * 0.1;
    }

    ctx.fillStyle = '#020205';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    
    // APLICAR ZOOM OUT (Ver más mapa)
    ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
    ctx.translate(-camX, -camY);

    drawGrid();
    drawZone(gameState.zone);

    // Balas
    gameState.bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 10, 0, Math.PI * 2); // Balas un poco más grandes para compensar zoom
        ctx.fillStyle = b.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = b.color;
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Jugadores
    gameState.players.forEach(p => {
        if (p.alive) drawPlayer(p, p.id === selfId);
    });

    ctx.restore();
    
    drawMinimap(gameState);
    drawAbilityCooldown();
}

function drawPlayer(p, isSelf) {
    ctx.save();
    ctx.translate(p.x, p.y);
    const r = 30; // Tamaño base del jugador un poco mayor por el zoom out

    if (p.shielded) {
        ctx.beginPath();
        ctx.arc(0, 0, r + 15, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 5;
        ctx.stroke();
    }

    ctx.fillStyle = p.color;
    ctx.shadowBlur = isSelf ? 30 : 15;
    ctx.shadowColor = p.color;

    ctx.beginPath();
    if (p.shape === 'circle') ctx.arc(0, 0, r, 0, Math.PI * 2);
    else if (p.shape === 'square') ctx.rect(-r, -r, r*2, r*2);
    else if (p.shape === 'triangle') {
        ctx.moveTo(0, -r - 10);
        ctx.lineTo(-r - 10, r + 10);
        ctx.lineTo(r + 10, r + 10);
        ctx.closePath();
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    // Nombre y Vida
    ctx.fillStyle = '#fff';
    ctx.font = `bold 20px Orbitron`;
    ctx.textAlign = 'center';
    ctx.fillText(p.username, 0, -r - 35);

    // Barra de HP
    const bw = 60, bh = 8;
    ctx.fillStyle = '#333';
    ctx.fillRect(-bw/2, -r - 25, bw, bh);
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(-bw/2, -r - 25, bw * (p.hp/p.maxHp), bh);

    ctx.restore();
}

// ─── FUNCIONES DE APOYO ───────────────────────────────────────────────────────

function drawGrid() {
    ctx.strokeStyle = 'rgba(0,243,255,0.05)';
    ctx.lineWidth = 2;
    const step = 200;
    for (let x = 0; x <= worldW; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, worldH); ctx.stroke();
    }
    for (let y = 0; y <= worldH; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(worldW, y); ctx.stroke();
    }
}

function drawZone(zone) {
    if (!zone) return;
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#ff0064';
    ctx.lineWidth = 10;
    ctx.stroke();
}

function getSelf() {
    return gameState ? gameState.players.find(p => p.id === selfId) : null;
}

function updateHUD(data) {
    const self = getSelf();
    if (!self) return;

    // Actualizar Vivos
    const aliveEl = document.getElementById('hud-alive');
    if (aliveEl) aliveEl.innerText = `VIVOS: ${data.alive}`;

    // Actualizar Barra HP
    const hpFill = document.getElementById('hud-hp-fill');
    if (hpFill) hpFill.style.width = (self.hp / self.maxHp) * 100 + '%';
}

function drawMinimap(state) {
    const SIZE = 150;
    const mx = canvas.width - SIZE - 20;
    const my = 20;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(mx, my, SIZE, SIZE);
    ctx.strokeStyle = '#00f3ff';
    ctx.strokeRect(mx, my, SIZE, SIZE);
}

function drawAbilityCooldown() {
    const cx = 80, cy = canvas.height - 80, r = 35;
    const pct = abilityCooldownMax > 0 ? abilityCooldownMs / abilityCooldownMax : 0;
    
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();
    
    if (pct > 0) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, -Math.PI/2, -Math.PI/2 + (pct * Math.PI * 2));
        ctx.fillStyle = 'rgba(255,0,200,0.4)';
        ctx.fill();
    }
}

function shapeAbilityName(shape) {
    return { circle: 'ESCUDO', triangle: 'DASH', square: 'RAFAGA' }[shape] || 'Habilidad';
}

// ─── ESTADO DEL CLIENTE ──────────────────────────────────────────────────────
const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener('resize', () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Estado del juego recibido del servidor
let gameState   = null;
let selfId      = null;
let worldW      = 3000;
let worldH      = 3000;
let matchActive = false;

// Cámara (sigue al jugador)
let camX = 0, camY = 0;

// Input
const keys = { up: false, down: false, left: false, right: false };
let mouseAngle = 0;

// Cooldown de habilidad (visual)
let abilityCooldownMs  = 0;
let abilityCooldownMax = 0;
let abilityTimer       = null;

// ─── INPUT ────────────────────────────────────────────────────────────────────
const KEY_MAP = {
    'ArrowUp':'up','w':'up','W':'up',
    'ArrowDown':'down','s':'down','S':'down',
    'ArrowLeft':'left','a':'left','A':'left',
    'ArrowRight':'right','d':'right','D':'right'
};

window.addEventListener('keydown', e => {
    const k = KEY_MAP[e.key];
    if (k && !keys[k]) {
        keys[k] = true;
        sendInput();
    }
    // Habilidad con ESPACIO o E
    if ((e.key === ' ' || e.key === 'e' || e.key === 'E') && matchActive) {
        e.preventDefault();
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
    const sx = self.x - camX;
    const sy = self.y - camY;
    mouseAngle = Math.atan2(e.clientY - sy, e.clientX - sx);
    sendInput();
});

// Disparar con clic izquierdo
canvas.addEventListener('mousedown', e => {
    if (e.button === 0 && matchActive) {
        socket.emit('player_shoot', { angle: mouseAngle });
    }
});

// Touch — joystick virtual para móvil
let touchStart = null;
canvas.addEventListener('touchstart', e => {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', e => {
    if (!touchStart || !matchActive) return;
    const dx = e.touches[0].clientX - touchStart.x;
    const dy = e.touches[0].clientY - touchStart.y;
    const dead = 15;
    keys.left  = dx < -dead;
    keys.right = dx >  dead;
    keys.up    = dy < -dead;
    keys.down  = dy >  dead;
    mouseAngle = Math.atan2(dy, dx);
    sendInput();
    e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchend', () => {
    keys.up = keys.down = keys.left = keys.right = false;
    sendInput();
});

function sendInput() {
    if (!matchActive) return;
    socket.emit('player_input', { keys: { ...keys }, angle: mouseAngle });
}

// ─── EVENTOS DEL SERVIDOR ─────────────────────────────────────────────────────

// CAMBIO: Sincronización con la UI neón al entrar en cola
socket.on('queue_status', (data) => {
    if (window.app && data.counting) {
        window.app.updateRing(data.countdown);
    }
});

socket.on('match_start', (data) => {
    selfId      = socket.id;
    worldW      = data.worldW;
    worldH      = data.worldH;
    matchActive = true;

    camX = data.self.x - canvas.width  / 2;
    camY = data.self.y - canvas.height / 2;

    // CAMBIO: Usar la función switchScreen de tu HTML para limpiar overlays
    if (window.app && typeof window.app.switchScreen === 'function') {
        window.app.switchScreen(null); 
    }
    
    document.getElementById('screen-game-ui').style.display = 'block';
    document.getElementById('hud-shape-name').innerText = shapeAbilityName(data.self.shape);

    loop();
});

socket.on('game_state', (data) => {
    gameState = data;
    updateHUD(data);
});

socket.on('you_died', (data) => {
    matchActive = false;
    document.getElementById('screen-game-ui').style.display = 'none';
    showDeathScreen(data.kills, data.position);
});

socket.on('match_end', (data) => {
    matchActive = false;
    document.getElementById('screen-game-ui').style.display = 'none';
    showEndScreen(data);
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
    if (!matchActive && !gameState) return;
    requestAnimationFrame(loop);
    render();
}

function render() {
    if (!gameState) return;
    const self = getSelf();

    if (self) {
        const targetX = self.x - canvas.width  / 2;
        const targetY = self.y - canvas.height / 2;
        camX += (targetX - camX) * 0.1;
        camY += (targetY - camY) * 0.1;
    }

    ctx.fillStyle = '#020205';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camX, -camY);

    drawGrid();
    drawZone(gameState.zone);

    // Balas con brillo
    gameState.bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = b.color;
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    gameState.players.forEach(p => {
        if (!p.alive) return;
        drawPlayer(p, p.id === selfId);
    });

    ctx.restore();
    drawMinimap(gameState);
    drawAbilityCooldown();
}

function drawPlayer(p, isSelf) {
    ctx.save();
    ctx.translate(p.x, p.y);
    const r = 20;

    if (p.shielded) {
        ctx.beginPath();
        ctx.arc(0, 0, r + 10, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,243,255,0.6)';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00f3ff';
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    ctx.shadowBlur = isSelf ? 30 : 15;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;

    ctx.beginPath();
    if (p.shape === 'circle') {
        ctx.arc(0, 0, r, 0, Math.PI * 2);
    } else if (p.shape === 'square') {
        ctx.rect(-r, -r, r*2, r*2);
    } else {
        ctx.moveTo(0, -r - 5);
        ctx.lineTo(-r - 5, r + 5);
        ctx.lineTo(r + 5, r + 5);
        ctx.closePath();
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    if (isSelf) {
        ctx.save();
        ctx.rotate(mouseAngle);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(r + 20, 0);
        ctx.stroke();
        ctx.restore();
    }

    const barW = 44, barH = 5;
    const hpPct = Math.max(0, p.hp / p.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-barW/2, -r - 14, barW, barH);
    ctx.fillStyle = hpPct > 0.5 ? '#00ff88' : hpPct > 0.25 ? '#ffaa00' : '#ff4444';
    ctx.fillRect(-barW/2, -r - 14, barW * hpPct, barH);

    ctx.fillStyle = isSelf ? '#ffffff' : 'rgba(255,255,255,0.7)';
    ctx.font = `bold 11px Rajdhani, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(p.username, 0, -r - 18);
    ctx.restore();
}

function drawZone(zone) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, worldW, worldH);
    ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(120, 0, 255, 0.18)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(180, 0, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#aa00ff';
    ctx.stroke();
    ctx.restore();
}

function drawGrid() {
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    const step = 100;
    for (let x = 0; x <= worldW; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, worldH); ctx.stroke();
    }
    for (let y = 0; y <= worldH; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(worldW, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,0,0,0.3)';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, worldW, worldH);
}

function drawMinimap(state) {
    const SIZE = 160;
    const PAD  = 16;
    const mx   = canvas.width - SIZE - PAD;
    const my   = PAD;
    const scaleX = SIZE / worldW;
    const scaleY = SIZE / worldH;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(mx, my, SIZE, SIZE);
    ctx.strokeStyle = 'rgba(0,243,255,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, SIZE, SIZE);

    if (state.zone) {
        ctx.beginPath();
        ctx.arc(mx + state.zone.x * scaleX, my + state.zone.y * scaleY, state.zone.radius * scaleX, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(170,0,255,0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    const self = getSelf();
    if (self) {
        ctx.beginPath();
        ctx.arc(mx + self.x * scaleX, my + self.y * scaleY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#00f3ff';
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

function drawAbilityCooldown() {
    const self = getSelf();
    if (!self) return;

    const cx = 80, cy = canvas.height - 80, r = 34;
    const pct = abilityCooldownMax > 0 ? abilityCooldownMs / abilityCooldownMax : 0;
    const ready = pct <= 0;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fill();

    if (!ready) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI/2, -Math.PI/2 + (1-pct) * Math.PI * 2);
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 4;
        ctx.stroke();
    } else {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ff88';
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    const name = shapeAbilityName(self.shape);
    ctx.fillStyle = ready ? '#00ff88' : '#aaa';
    ctx.font = 'bold 10px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, cx, cy + 4);
}

function updateHUD(data) {
    const self = getSelf();
    const aliveEl = document.getElementById('hud-alive');
    if (aliveEl) aliveEl.innerText = data.alive;

    if (!self) return;

    const hpEl  = document.getElementById('hud-hp-fill');
    const hpTxt = document.getElementById('hud-hp-text');
    if (hpEl) hpEl.style.width = Math.max(0, (self.hp / self.maxHp) * 100) + '%';
    if (hpTxt) hpTxt.innerText = `${Math.max(0, Math.floor(self.hp))} / ${self.maxHp}`;

    const killsEl = document.getElementById('hud-kills');
    if (killsEl) killsEl.innerText = self.kills;

    const tbody = document.getElementById('kills-table-body');
    if (tbody) {
        const sorted = [...data.players].filter(p => p.alive).sort((a,b) => b.kills - a.kills).slice(0, 8);
        tbody.innerHTML = sorted.map((p, i) =>
            `<tr style="color:${p.id === selfId ? '#00f3ff' : '#ccc'}">
                <td>${i+1}</td>
                <td>${p.username}</td>
                <td>${p.kills}</td>
            </tr>`
        ).join('');
    }
}

function showDeathScreen(kills, position) {
    const el = document.getElementById('screen-dead');
    if (!el) return;
    document.getElementById('dead-kills').innerText    = kills;
    document.getElementById('dead-position').innerText = position;
    el.style.display = 'flex';
}

function showEndScreen(data) {
    const el = document.getElementById('screen-victory');
    if (!el) return;
    const self = gameState?.players?.find(p => p.id === selfId);
    const won  = data.winner && self && data.winner === self.username;

    document.getElementById('end-title').innerText   = won ? '¡VICTORIA!' : 'FIN DE PARTIDA';
    document.getElementById('end-winner').innerText  = data.winner || 'Nadie';
    document.getElementById('end-title').style.color = won ? 'var(--neon-success)' : 'var(--neon-accent)';

    const tbody = document.getElementById('end-ranking-body');
    if (tbody && data.ranking) {
        tbody.innerHTML = data.ranking.map(r =>
            `<tr style="color:${r.won ? '#00ff88' : '#ccc'}">
                <td>#${r.position}</td>
                <td>${r.username}</td>
                <td>${r.kills} kills</td>
            </tr>`
        ).join('');
    }
    el.style.display = 'flex';
}

function getSelf() {
    if (!gameState) return null;
    return gameState.players.find(p => p.id === selfId) || null;
}
function shapeAbilityName(shape) {
    return { circle: 'ESCUDO', square: 'DASH', triangle: 'RÁFAGA' }[shape] || '?';
}

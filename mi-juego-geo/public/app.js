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
socket.on('match_start', (data) => {
    selfId      = socket.id;
    worldW      = data.worldW;
    worldH      = data.worldH;
    matchActive = true;

    // Posición inicial de cámara
    camX = data.self.x - canvas.width  / 2;
    camY = data.self.y - canvas.height / 2;

    document.getElementById('screen-game-ui').style.display = 'block';
    document.getElementById('hud-shape-name').innerText = shapeAbilityName(data.self.shape);

    // Ocultar todas las pantallas overlay
    ['screen-auth','screen-lobby','screen-loading','screen-dead','screen-victory'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

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

    // Suavizar cámara
    if (self) {
        const targetX = self.x - canvas.width  / 2;
        const targetY = self.y - canvas.height / 2;
        camX += (targetX - camX) * 0.1;
        camY += (targetY - camY) * 0.1;
    }

    // Fondo
    ctx.fillStyle = '#020205';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camX, -camY);

    // ── GRID ──────────────────────────────────────────────────────────────────
    drawGrid();

    // ── ZONA SEGURA ───────────────────────────────────────────────────────────
    drawZone(gameState.zone);

    // ── BALAS ─────────────────────────────────────────────────────────────────
    gameState.bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = b.color;
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // ── JUGADORES ─────────────────────────────────────────────────────────────
    gameState.players.forEach(p => {
        if (!p.alive) return;
        drawPlayer(p, p.id === selfId);
    });

    ctx.restore();

    // ── MINIMAPA ──────────────────────────────────────────────────────────────
    drawMinimap(gameState);

    // ── HUD HABILIDAD ────────────────────────────────────────────────────────
    drawAbilityCooldown();
}

// ─── DIBUJADO DE JUGADOR ──────────────────────────────────────────────────────
function drawPlayer(p, isSelf) {
    ctx.save();
    ctx.translate(p.x, p.y);

    const r = 20;

    // Escudo (círculo)
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

    // Brillo si es el jugador propio
    ctx.shadowBlur = isSelf ? 30 : 15;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;

    // Forma
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

    // Indicador de dirección (línea de apuntado) — solo para el jugador propio
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

    // Barra de vida
    const barW = 44, barH = 5;
    const hpPct = Math.max(0, p.hp / p.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-barW/2, -r - 14, barW, barH);
    ctx.fillStyle = hpPct > 0.5 ? '#00ff88' : hpPct > 0.25 ? '#ffaa00' : '#ff4444';
    ctx.fillRect(-barW/2, -r - 14, barW * hpPct, barH);

    // Nombre
    ctx.fillStyle = isSelf ? '#ffffff' : 'rgba(255,255,255,0.7)';
    ctx.font = `bold 11px Rajdhani, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(p.username, 0, -r - 18);

    ctx.restore();
}

// ─── ZONA ─────────────────────────────────────────────────────────────────────
function drawZone(zone) {
    // Área fuera de zona (oscura)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, worldW, worldH);
    ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(120, 0, 255, 0.18)';
    ctx.fill();

    // Borde de zona
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(180, 0, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#aa00ff';
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
}

// ─── GRID ─────────────────────────────────────────────────────────────────────
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
    // Borde del mundo
    ctx.strokeStyle = 'rgba(255,0,0,0.3)';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, worldW, worldH);
}

// ─── MINIMAPA ─────────────────────────────────────────────────────────────────
function drawMinimap(state) {
    const SIZE   = 160;
    const PAD    = 16;
    const mx     = canvas.width - SIZE - PAD;
    const my     = PAD;
    const scaleX = SIZE / worldW;
    const scaleY = SIZE / worldH;

    // Fondo
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(mx, my, SIZE, SIZE);
    ctx.strokeStyle = 'rgba(0,243,255,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, SIZE, SIZE);

    // Zona en minimapa
    if (state.zone) {
        ctx.beginPath();
        ctx.arc(
            mx + state.zone.x * scaleX,
            my + state.zone.y * scaleY,
            state.zone.radius * scaleX,
            0, Math.PI * 2
        );
        ctx.strokeStyle = 'rgba(170,0,255,0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    // Solo mostrar punto del jugador propio (no enemigos)
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

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '9px Rajdhani, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('MINIMAPA', mx + 4, my + SIZE + 12);
}

// ─── COOLDOWN HABILIDAD ───────────────────────────────────────────────────────
function drawAbilityCooldown() {
    const self = getSelf();
    if (!self) return;

    const cx = 80, cy = canvas.height - 80, r = 34;
    const pct = abilityCooldownMax > 0 ? abilityCooldownMs / abilityCooldownMax : 0;
    const ready = pct <= 0;

    // Círculo fondo
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fill();

    // Arco de cooldown
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

    // Nombre de la habilidad
    const name = shapeAbilityName(self.shape);
    ctx.fillStyle = ready ? '#00ff88' : '#aaa';
    ctx.font = 'bold 10px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, cx, cy + 4);

    // Tecla
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '9px Rajdhani, sans-serif';
    ctx.fillText('[E / SPACE]', cx, cy + r + 14);
}

// ─── HUD PRINCIPAL ────────────────────────────────────────────────────────────
function updateHUD(data) {
    const self = getSelf();

    // Jugadores vivos
    const aliveEl = document.getElementById('hud-alive');
    if (aliveEl) aliveEl.innerText = data.alive;

    if (!self) return;

    // Barra de vida
    const hpEl  = document.getElementById('hud-hp-fill');
    const hpTxt = document.getElementById('hud-hp-text');
    if (hpEl) hpEl.style.width = Math.max(0, (self.hp / self.maxHp) * 100) + '%';
    if (hpTxt) hpTxt.innerText = `${Math.max(0, Math.floor(self.hp))} / ${self.maxHp}`;

    // Kills
    const killsEl = document.getElementById('hud-kills');
    if (killsEl) killsEl.innerText = self.kills;

    // Tabla de kills
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

// ─── PANTALLAS FINALES ────────────────────────────────────────────────────────
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

// ─── UTILS ────────────────────────────────────────────────────────────────────
function getSelf() {
    if (!gameState) return null;
    return gameState.players.find(p => p.id === selfId) || null;
}
function shapeAbilityName(shape) {
    return { circle: 'ESCUDO', square: 'DASH', triangle: 'RÁFAGA' }[shape] || '?';
}

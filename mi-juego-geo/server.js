const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log(">>> [CONECTADO] Nucleo de Datos listo"))
    .catch(err => console.error(">>> [ERROR]", err));

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    linas:    { type: Number, default: 100 },
    wins:     { type: Number, default: 0 },
    totalKills: { type: Number, default: 0 }
});
const User = mongoose.model('User', UserSchema);

app.use(express.static(path.join(__dirname, 'public')));

// ─── CONSTANTES DEL JUEGO ────────────────────────────────────────────────────
const WORLD_W        = 3000;
const WORLD_H        = 3000;
const TICK_RATE      = 1000 / 60;   // 60fps server tick
const PLAYER_SPEED   = 5;
const PLAYER_RADIUS  = 20;
const BULLET_SPEED   = 12;
const BULLET_RADIUS  = 6;
const BULLET_DAMAGE  = 20;          // daño por bala
const BULLET_TTL     = 80;          // ticks de vida de la bala
const MAX_HEALTH     = 100;
const COLORS         = ['#00f3ff','#ff00c8','#00ff88','#ffaa00','#ff4444','#aa44ff','#ff8800','#00ffcc'];
const SHAPES         = ['circle','square','triangle'];

// Habilidades por forma
const ABILITIES = {
    circle:   { name: 'Escudo',     cooldown: 8000,  duration: 3000 },  // absorbe daño
    square:   { name: 'Dash',       cooldown: 5000,  duration: 300  },  // impulso de velocidad
    triangle: { name: 'Ráfaga',     cooldown: 6000,  duration: 600  },  // dispara 3 balas rápido
};

// ─── ESTADO GLOBAL ────────────────────────────────────────────────────────────
let onlinePlayers = {};   // jugadores logueados (lobby/cola)
let privateRooms  = {};
let matches       = {};   // partidas activas: { [matchId]: MatchState }
let matchCounter  = 0;

// ─── COLA ─────────────────────────────────────────────────────────────────────
const MIN_PLAYERS     = 2;
const MAX_PLAYERS     = 100;
const COUNTDOWN_SECS  = 17;
let queue             = [];
let countdownTimer    = null;
let countdownLeft     = 0;

function broadcastQueueStatus() {
    queue.forEach(id => io.to(id).emit('queue_status', {
        players: queue.length,
        countdown: countdownLeft,
        counting: countdownTimer !== null
    }));
}
function stopCountdown() {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    countdownLeft = 0;
}
function startCountdown() {
    stopCountdown();
    countdownLeft = COUNTDOWN_SECS;
    broadcastQueueStatus();
    countdownTimer = setInterval(() => {
        countdownLeft--;
        broadcastQueueStatus();
        if (countdownLeft <= 0) { stopCountdown(); launchMatch(); }
    }, 1000);
}
function addToQueue(socketId) {
    if (queue.includes(socketId)) return;
    queue.push(socketId);
    if (queue.length >= MIN_PLAYERS) startCountdown();
    else broadcastQueueStatus();
}
function removeFromQueue(socketId) {
    queue = queue.filter(id => id !== socketId);
    if (queue.length < MIN_PLAYERS) stopCountdown();
    broadcastQueueStatus();
}

// ─── CREAR PARTIDA ────────────────────────────────────────────────────────────
function launchMatch() {
    if (queue.length < MIN_PLAYERS) return;
    const participants = queue.splice(0, MAX_PLAYERS);
    if (queue.length >= MIN_PLAYERS) startCountdown();

    const matchId = `match_${++matchCounter}`;
    console.log(`>>> [PARTIDA ${matchId}] Iniciando con ${participants.length} jugadores`);

    // Estado inicial de la zona
    const zone = {
        x: WORLD_W / 2, y: WORLD_H / 2,
        radius: Math.min(WORLD_W, WORLD_H) / 2,
        targetRadius: 400,
        shrinkRate: 0,          // px/tick — se calcula abajo
        damage: 5,              // HP por segundo fuera de zona
        phase: 0,
        maxPhases: 4,
        phaseTimer: null
    };

    // Estado de jugadores en partida
    const players = {};
    participants.forEach((sid, i) => {
        const sock = io.sockets.sockets.get(sid);
        if (!sock || !sock.userData) return;
        const angle = (2 * Math.PI / participants.length) * i;
        const spawnR = 800;
        players[sid] = {
            id: sid,
            username: sock.userData.username,
            x: WORLD_W / 2 + Math.cos(angle) * spawnR,
            y: WORLD_H / 2 + Math.sin(angle) * spawnR,
            angle: 0,
            color: COLORS[i % COLORS.length],
            shape: SHAPES[i % SHAPES.length],
            hp: MAX_HEALTH,
            maxHp: MAX_HEALTH,
            alive: true,
            kills: 0,
            // Input del jugador
            keys: { up:false, down:false, left:false, right:false },
            // Habilidad
            abilityCooldown: 0,
            abilityActive: false,
            abilityEnd: 0,
            // Escudo (círculo)
            shielded: false,
            // Dash (cuadrado)
            dashVx: 0, dashVy: 0, dashEnd: 0,
            // Ráfaga (triángulo) — contador de balas extra
            burstCount: 0, burstNext: 0,
        };
        sock.join(matchId);
    });

    const bullets = {};   // { [bulletId]: bullet }
    let bulletCounter = 0;

    const match = { matchId, players, bullets, zone, alive: Object.keys(players).length, over: false };
    matches[matchId] = match;

    // Notificar a cada jugador con su info y la del match
    Object.keys(players).forEach(sid => {
        io.to(sid).emit('match_start', {
            matchId,
            self: { ...players[sid], keys: undefined },
            worldW: WORLD_W,
            worldH: WORLD_H,
            zone: { x: zone.x, y: zone.y, radius: zone.radius }
        });
    });

    // Iniciar fases de la zona
    startZonePhase(match);

    // Game loop de la partida
    const loop = setInterval(() => {
        if (match.over) { clearInterval(loop); return; }
        tickMatch(match, bulletCounter, (newId) => { bulletCounter = newId; });
        // Broadcast
        io.to(matchId).emit('game_state', buildState(match));
    }, TICK_RATE);

    match.loop = loop;
}

// ─── FASES DE ZONA ────────────────────────────────────────────────────────────
function startZonePhase(match) {
    const { zone } = match;
    if (zone.phase >= zone.maxPhases) return;
    zone.phase++;

    const delays   = [30000, 40000, 50000, 60000]; // espera antes de encoger
    const targets  = [1200, 700, 350, 150];         // radio objetivo de cada fase
    const durations= [20000, 25000, 30000, 35000];  // duración del encogimiento

    const delay = delays[zone.phase - 1] || 30000;
    const targetR = targets[zone.phase - 1] || 150;
    const duration = durations[zone.phase - 1] || 20000;

    zone.phaseTimer = setTimeout(() => {
        zone.targetRadius = targetR;
        const totalShrink = zone.radius - targetR;
        const ticks = duration / TICK_RATE;
        zone.shrinkRate = totalShrink / ticks;
        console.log(`>>> [ZONA] Fase ${zone.phase}: encogiendo a radio ${targetR}`);

        // Al terminar de encoger, iniciar siguiente fase
        setTimeout(() => {
            zone.shrinkRate = 0;
            startZonePhase(match);
        }, duration);
    }, delay);
}

// ─── TICK PRINCIPAL ───────────────────────────────────────────────────────────
function tickMatch(match, bulletCounter, setBulletCounter) {
    const { players, bullets, zone } = match;
    const now = Date.now();

    // --- ZONA ---
    if (zone.shrinkRate > 0 && zone.radius > zone.targetRadius) {
        zone.radius = Math.max(zone.targetRadius, zone.radius - zone.shrinkRate);
    }

    // --- JUGADORES ---
    Object.values(players).forEach(p => {
        if (!p.alive) return;

        // Movimiento con WASD / flechas
        let vx = 0, vy = 0;
        if (p.keys.up)    vy -= PLAYER_SPEED;
        if (p.keys.down)  vy += PLAYER_SPEED;
        if (p.keys.left)  vx -= PLAYER_SPEED;
        if (p.keys.right) vx += PLAYER_SPEED;

        // Normalizar diagonal
        if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }

        // Dash activo (cuadrado)
        if (p.shape === 'square' && p.abilityActive && now < p.abilityEnd) {
            vx += p.dashVx;
            vy += p.dashVy;
        } else if (p.shape === 'square' && p.abilityActive && now >= p.abilityEnd) {
            p.abilityActive = false;
        }

        p.x = Math.max(PLAYER_RADIUS, Math.min(WORLD_W - PLAYER_RADIUS, p.x + vx));
        p.y = Math.max(PLAYER_RADIUS, Math.min(WORLD_H - PLAYER_RADIUS, p.y + vy));

        // Ráfaga (triángulo) — disparar balas extra automáticamente
        if (p.shape === 'triangle' && p.abilityActive && now < p.abilityEnd) {
            if (p.burstCount > 0 && now >= p.burstNext) {
                const bId = ++bulletCounter;
                setBulletCounter(bulletCounter);
                bullets[bId] = spawnBullet(bId, p, p.angle + (Math.random() - 0.5) * 0.4);
                p.burstCount--;
                p.burstNext = now + 120;
            }
            if (p.burstCount <= 0) p.abilityActive = false;
        }

        // Escudo expirado
        if (p.shape === 'circle' && p.abilityActive && now >= p.abilityEnd) {
            p.abilityActive = false;
            p.shielded = false;
        }

        // Cooldown de habilidad
        if (p.abilityCooldown > 0) p.abilityCooldown = Math.max(0, p.abilityCooldown - TICK_RATE);

        // Daño de zona
        const dx = p.x - zone.x, dy = p.y - zone.y;
        const distZone = Math.sqrt(dx*dx + dy*dy);
        if (distZone > zone.radius) {
            p.hp -= (zone.damage / 60); // por tick (~60fps)
        }

        // Colisión entre jugadores
        Object.values(players).forEach(other => {
            if (other.id === p.id || !other.alive) return;
            const ddx = p.x - other.x, ddy = p.y - other.y;
            const dist = Math.sqrt(ddx*ddx + ddy*ddy);
            if (dist < PLAYER_RADIUS * 2) {
                // Empuje
                const push = (PLAYER_RADIUS * 2 - dist) / 2;
                const nx = ddx / (dist || 1), ny = ddy / (dist || 1);
                p.x += nx * push; p.y += ny * push;
            }
        });

        if (p.hp <= 0) killPlayer(match, p.id, p.lastHitBy);
    });

    // --- BALAS ---
    Object.values(bullets).forEach(b => {
        b.x += b.vx;
        b.y += b.vy;
        b.ttl--;

        if (b.ttl <= 0 || b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H) {
            delete bullets[b.id]; return;
        }

        // Colisión bala-jugador
        Object.values(players).forEach(p => {
            if (!p.alive || p.id === b.ownerId) return;
            const ddx = b.x - p.x, ddy = b.y - p.y;
            if (Math.sqrt(ddx*ddx + ddy*ddy) < PLAYER_RADIUS + BULLET_RADIUS) {
                if (!p.shielded) {
                    p.hp -= BULLET_DAMAGE;
                    p.lastHitBy = b.ownerId;
                }
                delete bullets[b.id];
                if (p.hp <= 0) killPlayer(match, p.id, b.ownerId);
            }
        });
    });
}

function spawnBullet(id, owner, angle) {
    return {
        id,
        ownerId: owner.id,
        x: owner.x + Math.cos(angle) * (PLAYER_RADIUS + BULLET_RADIUS + 2),
        y: owner.y + Math.sin(angle) * (PLAYER_RADIUS + BULLET_RADIUS + 2),
        vx: Math.cos(angle) * BULLET_SPEED,
        vy: Math.sin(angle) * BULLET_SPEED,
        ttl: BULLET_TTL,
        color: owner.color
    };
}

function killPlayer(match, deadId, killerId) {
    const p = match.players[deadId];
    if (!p || !p.alive) return;
    p.alive = false;
    p.hp = 0;
    match.alive--;

    console.log(`>>> [PARTIDA ${match.matchId}] ${p.username} eliminado. Vivos: ${match.alive}`);

    // Sumar kill al asesino
    if (killerId && match.players[killerId]) {
        match.players[killerId].kills++;
    }

    io.to(deadId).emit('you_died', {
        kills: p.kills,
        position: match.alive + 1  // puesto
    });

    // ¿Queda un solo jugador vivo?
    if (match.alive <= 1) endMatch(match);
}

async function endMatch(match) {
    if (match.over) return;
    match.over = true;
    clearInterval(match.loop);
    if (match.zone.phaseTimer) clearTimeout(match.zone.phaseTimer);

    const winner = Object.values(match.players).find(p => p.alive);
    console.log(`>>> [PARTIDA ${match.matchId}] FIN. Ganador: ${winner ? winner.username : 'Nadie'}`);

    // Ranking final
    const ranking = Object.values(match.players)
        .sort((a, b) => b.kills - a.kills)
        .map((p, i) => ({ username: p.username, kills: p.kills, position: i + 1, won: p.alive }));

    io.to(match.matchId).emit('match_end', { winner: winner ? winner.username : null, ranking });

    // Actualizar BD
    for (const p of Object.values(match.players)) {
        try {
            await User.updateOne({ username: p.username }, {
                $inc: { totalKills: p.kills, wins: p.alive ? 1 : 0 }
            });
        } catch(e) { console.error("Error actualizando stats:", e.message); }
    }

    delete matches[match.matchId];
}

function buildState(match) {
    return {
        players: Object.values(match.players).map(p => ({
            id: p.id, username: p.username,
            x: p.x, y: p.y, angle: p.angle,
            color: p.color, shape: p.shape,
            hp: p.hp, maxHp: p.maxHp, alive: p.alive,
            kills: p.kills, shielded: p.shielded,
            abilityActive: p.abilityActive,
            abilityCooldownPct: p.abilityCooldown / (ABILITIES[p.shape]?.cooldown || 1)
        })),
        bullets: Object.values(match.bullets).map(b => ({
            id: b.id, x: b.x, y: b.y, color: b.color
        })),
        zone: { x: match.zone.x, y: match.zone.y, radius: match.zone.radius },
        alive: match.alive
    };
}

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log(`>>> Conexión: ${socket.id}`);

    socket.on('register_user', async (data) => {
        if (!data.user?.trim() || !data.pass?.trim())
            return socket.emit('auth_result', { success: false, message: "Campos obligatorios." });
        try {
            const hashed = await bcrypt.hash(data.pass, 10);
            await new User({ username: data.user.trim(), password: hashed }).save();
            socket.emit('auth_result', { success: true, message: "Cuenta creada. Ahora inicia sesión." });
        } catch(e) {
            socket.emit('auth_result', { success: false,
                message: e.code === 11000 ? "Usuario ya registrado." : "Error interno." });
        }
    });

    socket.on('login_user', async (data) => {
        if (!data.user?.trim() || !data.pass?.trim())
            return socket.emit('auth_result', { success: false, message: "Campos obligatorios." });
        try {
            const user = await User.findOne({ username: data.user.trim() });
            if (user && await bcrypt.compare(data.pass, user.password)) {
                socket.userData = user;
                onlinePlayers[socket.id] = { username: user.username };
                socket.emit('auth_result', { success: true,
                    user: { username: user.username, linas: user.linas, wins: user.wins, totalKills: user.totalKills } });
            } else {
                socket.emit('auth_result', { success: false, message: "Credenciales incorrectas." });
            }
        } catch(e) {
            socket.emit('auth_result', { success: false, message: "Error interno." });
        }
    });

    // ── INPUT DEL JUEGO ──────────────────────────────────────────────────────
    socket.on('player_input', (data) => {
        // Buscar la partida del jugador
        const match = findMatchOfPlayer(socket.id);
        if (!match) return;
        const p = match.players[socket.id];
        if (!p || !p.alive) return;

        if (data.keys) p.keys = data.keys;
        if (typeof data.angle === 'number') p.angle = data.angle;
    });

    socket.on('player_shoot', (data) => {
        const match = findMatchOfPlayer(socket.id);
        if (!match) return;
        const p = match.players[socket.id];
        if (!p || !p.alive) return;
        const angle = typeof data.angle === 'number' ? data.angle : p.angle;
        const bId = Object.keys(match.bullets).length + Date.now();
        match.bullets[bId] = spawnBullet(bId, p, angle);
    });

    socket.on('player_ability', () => {
        const match = findMatchOfPlayer(socket.id);
        if (!match) return;
        const p = match.players[socket.id];
        if (!p || !p.alive || p.abilityCooldown > 0) return;

        const ability = ABILITIES[p.shape];
        if (!ability) return;

        p.abilityActive = true;
        p.abilityCooldown = ability.cooldown;
        p.abilityEnd = Date.now() + ability.duration;

        if (p.shape === 'circle') {
            p.shielded = true;
        } else if (p.shape === 'square') {
            p.dashVx = Math.cos(p.angle) * 18;
            p.dashVy = Math.sin(p.angle) * 18;
        } else if (p.shape === 'triangle') {
            p.burstCount = 5;
            p.burstNext = Date.now();
        }
        socket.emit('ability_used', { shape: p.shape, cooldown: ability.cooldown });
    });

    // ── COLA ─────────────────────────────────────────────────────────────────
    socket.on('enter_queue', () => { if (socket.userData) addToQueue(socket.id); });
    socket.on('leave_queue',  () => removeFromQueue(socket.id));

    // ── PRIVADAS ─────────────────────────────────────────────────────────────
    socket.on('create_private', () => {
        if (!socket.userData) return;
        const code = Math.random().toString(36).substring(2,7).toUpperCase();
        privateRooms[code] = { owner: socket.id, players: [socket.id] };
        socket.join(code);
        socket.emit('private_ready', { code });
    });

    socket.on('disconnect', () => {
        console.log(`>>> Desconectado: ${socket.id}`);
        removeFromQueue(socket.id);
        delete onlinePlayers[socket.id];
        // Matar al jugador en su partida
        const match = findMatchOfPlayer(socket.id);
        if (match && match.players[socket.id]?.alive) {
            killPlayer(match, socket.id, null);
        }
    });
});

function findMatchOfPlayer(socketId) {
    return Object.values(matches).find(m => m.players[socketId]) || null;
}

// ─── BROADCAST LOBBY ─────────────────────────────────────────────────────────
setInterval(() => {
    // Solo enviar update a jugadores NO en partida
    io.emit('online_count', Object.keys(onlinePlayers).length);
}, 5000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`>>> GEO-FLUX ELITE EN PUERTO ${PORT} <<<`));

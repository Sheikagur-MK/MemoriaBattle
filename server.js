const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
const MAP_SIZE = 5000;

// Middleware para servir archivos de la carpeta /public
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("💎 NÚCLEO DE DATOS CONECTADO"))
  .catch(err => console.error("❌ ERROR DB:", err));

// Lógica de Jugadores
let players = new Map();

io.on("connection", (socket) => {
  socket.on("join_room", (data) => {
    players.set(socket.id, {
      id: socket.id,
      username: data.username || "Piloto",
      x: Math.random() * MAP_SIZE,
      y: Math.random() * MAP_SIZE,
      skin: data.skin || "circle",
      hp: 100
    });
    socket.emit("init", { mapSize: MAP_SIZE });
  });

  socket.on("input", (input) => {
    const p = players.get(socket.id);
    if (p) {
      const speed = 10;
      if (input.up) p.y -= speed;
      if (input.down) p.y += speed;
      if (input.left) p.x -= speed;
      if (input.right) p.x += speed;
    }
  });

  socket.on("disconnect", () => players.delete(socket.id));
});

// Loop del servidor a 30 FPS
setInterval(() => {
  io.emit("tick", Array.from(players.values()));
}, 33);

server.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));    skin: { type: String, default: "default" }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function makeToken(user) {
  return jwt.sign({ uid: String(user._id), username: user.username }, JWT_SECRET, { expiresIn: "7d" });
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Token faltante" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) return res.status(400).json({ error: "Faltan campos" });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, passwordHash });
    return res.json({
      token: makeToken(user),
      user: { username: user.username, coins: user.coins, skin: user.skin }
    });
  } catch (e) {
    return res.status(400).json({ error: "No se pudo registrar. Usuario/correo quizá ya existe." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: "Credenciales inválidas" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });
  return res.json({
    token: makeToken(user),
    user: { username: user.username, coins: user.coins, skin: user.skin }
  });
});

app.get("/api/me", auth, async (req, res) => {
  const user = await User.findById(req.user.uid).lean();
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  return res.json({ username: user.username, coins: user.coins, skin: user.skin });
});

const rooms = new Map();

function createRoom(roomId) {
  const room = {
    id: roomId,
    status: "waiting",
    round: 1,
    phaseStartAt: Date.now(),
    players: new Map(),
    spectators: new Set(),
    eliminations: [],
    zone: {
      x: MAP_SIZE / 2,
      y: MAP_SIZE / 2,
      radius: START_ZONE_RADIUS,
      nextShrinkAt: Date.now() + ZONE_INTERVAL_MS
    }
  };
  rooms.set(roomId, room);
  return room;
}

function spawnPoint() {
  return {
    x: 400 + Math.random() * (MAP_SIZE - 800),
    y: 400 + Math.random() * (MAP_SIZE - 800)
  };
}

function playerState(username) {
  const p = spawnPoint();
  return {
    username,
    x: p.x,
    y: p.y,
    vx: 0,
    vy: 0,
    hpBars: 3,
    alive: true,
    dashCooldownUntil: 0,
    pulseCooldownUntil: 0,
    dashInvulnUntil: 0,
    pulseUntil: 0,
    wantsPulse: false,
    lastMove: { x: 1, y: 0 },
    input: { up: false, down: false, left: false, right: false, moveX: 0, moveY: 0, dash: false }
  };
}

function publicPlayer(p) {
  return {
    username: p.username,
    x: p.x,
    y: p.y,
    hpBars: p.hpBars,
    alive: p.alive,
    pulsing: Date.now() < p.pulseUntil,
    dashing: Date.now() < p.dashInvulnUntil
  };
}

function roomSummary(room) {
  const alive = [...room.players.values()].filter((p) => p.alive).length;
  return {
    id: room.id,
    status: room.status,
    round: room.round,
    players: room.players.size,
    spectators: room.spectators.size,
    alive,
    zone: room.zone
  };
}

function getOrMakeOpenRoom() {
  let target = [...rooms.values()].find((r) => r.status !== "finished" && r.players.size < MAX_PLAYERS);
  if (!target) {
    target = createRoom(`room-${Math.random().toString(36).slice(2, 8)}`);
  }
  return target;
}

function startRound(room) {
  room.status = "starting";
  room.phaseStartAt = Date.now();
  room.zone.radius = START_ZONE_RADIUS;
  room.zone.nextShrinkAt = Date.now() + ZONE_INTERVAL_MS;
  room.eliminations = [];
  for (const p of room.players.values()) {
    const s = spawnPoint();
    p.x = s.x;
    p.y = s.y;
    p.hpBars = 3;
    p.alive = true;
    p.dashCooldownUntil = 0;
    p.pulseCooldownUntil = 0;
    p.dashInvulnUntil = 0;
    p.pulseUntil = 0;
  }
}

function maybeTransitionRoom(room) {
  if (room.status === "waiting" && room.players.size >= 2) {
    startRound(room);
  }
  if (room.status === "starting") {
    const elapsed = (Date.now() - room.phaseStartAt) / 1000;
    if (elapsed >= ROUND_START_SECONDS) {
      room.status = "running";
      room.phaseStartAt = Date.now();
    }
  }
  if (room.status === "running") {
    const alivePlayers = [...room.players.values()].filter((p) => p.alive);
    if (alivePlayers.length <= 1 && room.players.size >= 2) {
      room.status = "finished";
      room.phaseStartAt = Date.now();
      room.winner = alivePlayers[0] ? alivePlayers[0].username : null;
    }
    if (Date.now() >= room.zone.nextShrinkAt) {
      room.zone.radius = Math.max(100, room.zone.radius * ZONE_SHRINK_FACTOR);
      room.zone.nextShrinkAt = Date.now() + ZONE_INTERVAL_MS;
    }
  }
  if (room.status === "finished") {
    if (Date.now() - room.phaseStartAt > 18000) {
      room.round += 1;
      room.status = "waiting";
      room.winner = null;
      room.phaseStartAt = Date.now();
      for (const p of room.players.values()) p.alive = true;
    }
  }
}

function updateRoom(room, dt) {
  maybeTransitionRoom(room);

  for (const p of room.players.values()) {
    if (!p.alive) continue;
    const speed = 360;
    let dx = 0;
    let dy = 0;
    if (typeof p.input.moveX === "number" || typeof p.input.moveY === "number") {
      dx = Number(p.input.moveX || 0);
      dy = Number(p.input.moveY || 0);
    } else {
      if (p.input.up) dy -= 1;
      if (p.input.down) dy += 1;
      if (p.input.left) dx -= 1;
      if (p.input.right) dx += 1;
    }

    const mag = Math.hypot(dx, dy) || 1;
    const ndx = dx / mag;
    const ndy = dy / mag;
    const targetVx = ndx * speed;
    const targetVy = ndy * speed;
    // Inercia ligera para que la fisica no se sienta robótica.
    p.vx += (targetVx - p.vx) * 0.28;
    p.vy += (targetVy - p.vy) * 0.28;

    if (dx !== 0 || dy !== 0) {
      p.lastMove.x = ndx;
      p.lastMove.y = ndy;
    }

    if (p.input.dash && Date.now() > p.dashCooldownUntil) {
      p.dashCooldownUntil = Date.now() + DASH_COOLDOWN_MS;
      p.dashInvulnUntil = Date.now() + 320;
      const dashX = dx === 0 && dy === 0 ? p.lastMove.x : ndx;
      const dashY = dx === 0 && dy === 0 ? p.lastMove.y : ndy;
      p.x += dashX * 300;
      p.y += dashY * 300;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = Math.max(0, Math.min(MAP_SIZE, p.x));
    p.y = Math.max(0, Math.min(MAP_SIZE, p.y));

    const dZone = Math.hypot(p.x - room.zone.x, p.y - room.zone.y);
    if (room.status === "running" && dZone > room.zone.radius) {
      if (Math.random() < 0.05) {
        p.hpBars -= 1;
        if (p.hpBars <= 0) {
          p.alive = false;
          room.eliminations.push({ by: "zona", victim: p.username, at: Date.now() });
        }
      }
    }
  }

  for (const p of room.players.values()) {
    if (!p.alive || !p.wantsPulse) continue;
    p.wantsPulse = false;
    if (room.status !== "running") continue;
    if (Date.now() < p.pulseCooldownUntil) continue;
    p.pulseCooldownUntil = Date.now() + PULSE_COOLDOWN_MS;
    p.pulseUntil = Date.now() + 320;
    const pulseRange = 135;
    for (const enemy of room.players.values()) {
      if (!enemy.alive || enemy.username === p.username) continue;
      const d = Math.hypot(p.x - enemy.x, p.y - enemy.y);
      const enemyInvulnerable = Date.now() < enemy.dashInvulnUntil;
      if (d <= pulseRange && !enemyInvulnerable) {
        enemy.hpBars -= 1;
        if (enemy.hpBars <= 0) {
          enemy.alive = false;
          room.eliminations.push({ by: p.username, victim: enemy.username, at: Date.now() });
        }
      }
    }
  }
}

setInterval(() => {
  const dt = 1 / TICK_RATE;
  for (const room of rooms.values()) {
    updateRoom(room, dt);
    io.to(room.id).emit("room_state", {
      summary: roomSummary(room),
      phaseStartAt: room.phaseStartAt,
      winner: room.winner || null,
      players: [...room.players.values()].map(publicPlayer),
      eliminations: room.eliminations.slice(-8)
    });
  }
  io.emit("rooms_overview", [...rooms.values()].map(roomSummary));
}, 1000 / TICK_RATE);

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = payload;
    next();
  } catch {
    next(new Error("unauthorized"));
  }
});

io.on("connection", (socket) => {
  socket.emit("rooms_overview", [...rooms.values()].map(roomSummary));

  socket.on("join_online", () => {
    const room = getOrMakeOpenRoom();
    if (!room.players.has(socket.id)) {
      room.players.set(socket.id, playerState(socket.user.username));
    }
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.emit("joined_room", { roomId: room.id, mapSize: MAP_SIZE });
  });

  socket.on("join_private", ({ code }) => {
    const roomId = `private-${(code || "alpha").toLowerCase()}`;
    const room = rooms.get(roomId) || createRoom(roomId);
    if (!room.players.has(socket.id)) {
      room.players.set(socket.id, playerState(socket.user.username));
    }
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.emit("joined_room", { roomId: room.id, mapSize: MAP_SIZE });
  });

  socket.on("spectate_room", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.spectators.add(socket.id);
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.emit("joined_room", { roomId: room.id, mapSize: MAP_SIZE, spectating: true });
  });

  socket.on("input", (payload) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p) return;
    p.input = {
      up: !!payload?.up,
      down: !!payload?.down,
      left: !!payload?.left,
      right: !!payload?.right,
      moveX: typeof payload?.moveX === "number" ? payload.moveX : 0,
      moveY: typeof payload?.moveY === "number" ? payload.moveY : 0,
      dash: !!payload?.dash
    };
    if (payload?.pulse) p.wantsPulse = true;
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    room.players.delete(socket.id);
    room.spectators.delete(socket.id);
    if (room.players.size === 0 && room.spectators.size === 0) {
      rooms.delete(room.id);
    }
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(PORT, () => console.log(`SERVIDOR 2026 CORRIENDO EN PUERTO ${PORT}`));    password: { type: String, required: true },
    coins: { type: Number, default: 0 },
    unlockedSkins: { type: [String], default: ["circle"] },
    currentSkin: { type: String, default: "circle" }
});
const User = mongoose.model("User", userSchema);

// Rutas de Auth
app.post("/api/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({ username, email, password: hashed });
        const token = jwt.sign({ id: user._id }, JWT_SECRET);
        res.json({ token, user: { username: user.username, coins: user.coins, currentSkin: user.currentSkin } });
    } catch (e) { res.status(400).json({ error: "Error en registro" }); }
});

app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Fallo" });
    const token = jwt.sign({ id: user._id }, JWT_SECRET);
    res.json({ token, user: { username: user.username, coins: user.coins, currentSkin: user.currentSkin } });
});

// Lógica de salas y motor de juego
const rooms = new Map();

function createRoom(id) {
    return {
        id,
        status: "LOBBY",
        players: new Map(),
        timer: ROUND_START_SECONDS,
        zone: { x: MAP_SIZE / 2, y: MAP_SIZE / 2, radius: START_ZONE_RADIUS }
    };
}

io.on("connection", (socket) => {
    socket.on("join_room", async (data) => {
        let room = rooms.get("main_room") || createRoom("main_room");
        rooms.set("main_room", room);
        
        const player = {
            id: socket.id,
            username: data.username,
            x: Math.random() * MAP_SIZE,
            y: Math.random() * MAP_SIZE,
            skin: data.skin || "circle",
            hp: 3,
            lastDash: 0,
            lastPulse: 0
        };
        
        room.players.set(socket.id, player);
        socket.join(room.id);
        socket.emit("joined", { roomId: room.id, mapSize: MAP_SIZE });
    });

    socket.on("input", (input) => {
        const room = rooms.get("main_room");
        if (!room) return;
        const p = room.players.get(socket.id);
        if (p) {
            const speed = 7;
            if (input.up) p.y -= speed;
            if (input.down) p.y += speed;
            if (input.left) p.x -= speed;
            if (input.right) p.x += speed;
        }
    });

    socket.on("disconnect", () => {
        const room = rooms.get("main_room");
        if (room) room.players.delete(socket.id);
    });
});

setInterval(() => {
    rooms.forEach(room => {
        io.to(room.id).emit("tick", Array.from(room.players.values()));
    });
}, 1000 / TICK_RATE);

server.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));
// Manejo de la lógica Battle Royale (100 jugadores)
let players = new Map();
io.on("connection", (socket) => {
    socket.on("join", (userData) => {
        players.set(socket.id, {
            id: socket.id,
            x: 2500, y: 2500,
            hp: 3,
            skin: userData.currentSkin || 'circle'
        });
    });

    socket.on("input", (data) => {
        const p = players.get(socket.id);
        if (p) { p.x += data.x; p.y += data.y; }
    });

    socket.on("disconnect", () => players.delete(socket.id));
});

// Loop de red a 30fps
setInterval(() => io.emit("tick", Array.from(players.values())), 33);

server.listen(process.env.PORT || 3000);        const user = await User.create({ username, email, password: hashed });
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'GS2026');
        res.json({ token, user: { username, points: 500, currentSkin: 'sphere' } });
    } catch (e) { res.status(400).json({ error: "Datos duplicados o inválidos" }); }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !await bcrypt.compare(password, user.password)) return res.status(401).json({ error: "Credenciales erróneas" });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'GS2026');
    res.json({ token, user: { username: user.username, points: user.points, currentSkin: user.currentSkin, unlockedSkins: user.unlockedSkins } });
});

// --- LÓGICA DE SALAS BATTLE ROYALE ---
const activePlayers = new Map();

io.on('connection', (socket) => {
    socket.on('join_queue', (data) => {
        activePlayers.set(socket.id, {
            id: socket.id,
            username: data.username,
            skin: data.currentSkin,
            x: (Math.random() - 0.5) * 4000,
            z: (Math.random() - 0.5) * 4000,
            hp: 100,
            points: data.points
        });
        socket.emit('match_confirmed', { mapSize: 5000 });
    });

    socket.on('player_update', (data) => {
        const p = activePlayers.get(socket.id);
        if (p) { p.x = data.x; p.z = data.z; p.rot = data.rot; }
    });

    socket.on('disconnect', () => activePlayers.delete(socket.id));
});

// Loop de red a 30Hz
setInterval(() => {
    if (activePlayers.size > 0) {
        io.emit('world_state', Array.from(activePlayers.values()));
    }
}, 33);

server.listen(process.env.PORT || 3000, () => console.log("🚀 Quantum Server Online"));        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret');
        res.json({ token, user: { username, points: 0, currentSkin: 'sphere' } });
    } catch (e) { res.status(400).json({ error: "El usuario o email ya existe" }); }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !await bcrypt.compare(password, user.password)) return res.status(401).json({ error: "Error de acceso" });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret');
    res.json({ token, user: { username: user.username, points: user.points, currentSkin: user.currentSkin, unlockedSkins: user.unlockedSkins } });
});

// --- LÓGICA BATTLE ROYALE (100 JUGADORES) ---
const rooms = new Map();

function createBattleRoom(id) {
    return {
        id,
        players: new Map(),
        status: 'LOBBY',
        zone: { r: 3000, x: 0, y: 0 },
        startTime: Date.now()
    };
}

io.on('connection', (socket) => {
    socket.on('join_queue', ({ user }) => {
        let room = rooms.get('WORLD_ARENA') || createBattleRoom('WORLD_ARENA');
        rooms.set('WORLD_ARENA', room);

        room.players.set(socket.id, {
            id: socket.id,
            username: user.username,
            skin: user.currentSkin,
            x: (Math.random() - 0.5) * 4000,
            z: (Math.random() - 0.5) * 4000,
            hp: 100,
            lastAttack: 0
        });

        socket.join(room.id);
        if (room.players.size >= 100) room.status = 'IN_GAME';
        io.to(room.id).emit('room_update', { status: room.status, count: room.players.size });
    });

    socket.on('player_move', (data) => {
        const room = rooms.get('WORLD_ARENA');
        if (!room) return;
        const p = room.players.get(socket.id);
        if (p) { p.x = data.x; p.z = data.z; p.rot = data.rot; }
    });
});

// Loop de red a 30fps
setInterval(() => {
    rooms.forEach(room => {
        if (room.players.size > 0) {
            io.to(room.id).emit('tick', { players: Array.from(room.players.values()), zone: room.zone });
        }
    });
}, 33);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Quantum Server running on port ${PORT}`));        const { username, email, password } = req.body;
        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({ username, email, password: hashed });
        const token = jwt.sign({ id: user._id }, JWT_SECRET);
        res.json({ token, user: { username: user.username, coins: user.coins } });
    } catch (e) { res.status(400).json({ error: "Datos ya registrados" }); }
});

app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Credenciales inválidas" });
    }
    const token = jwt.sign({ id: user._id }, JWT_SECRET);
    res.json({ token, user: { username: user.username, coins: user.coins } });
});

// --- MOTOR DEL JUEGO ---
const rooms = new Map();
function createRoom(id) {
    return { id, players: new Map(), status: "lobby", zone: { x: 2500, y: 2500, r: 2500 } };
}
rooms.set("Arena_1", createRoom("Arena_1"));

io.on("connection", (socket) => {
    socket.on("join_game", ({ roomId }) => {
        const room = rooms.get(roomId) || rooms.get("Arena_1");
        socket.join(room.id);
        room.players.set(socket.id, {
            id: socket.id,
            x: Math.random() * MAP_SIZE,
            y: Math.random() * MAP_SIZE,
            hp: 3,
            alive: true,
            input: { x: 0, y: 0 }
        });
        socket.emit("joined", { roomId: room.id, mapSize: MAP_SIZE });
    });

    socket.on("move", (data) => {
        const room = rooms.get("Arena_1");
        const p = room?.players.get(socket.id);
        if (p && p.alive) {
            p.x = clamp(p.x + data.x * 10, 0, MAP_SIZE);
            p.y = clamp(p.y + data.y * 10, 0, MAP_SIZE);
        }
    });
});

setInterval(() => {
    rooms.forEach(room => {
        io.to(room.id).emit("state", { players: Array.from(room.players.values()) });
    });
}, 33);

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
server.listen(PORT, () => console.log(`🚀 Server en puerto ${PORT}`));

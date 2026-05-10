require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- CONFIGURACIÓN DE MONGODB ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("💎 Base de Datos Hyper-Core Conectada"))
    .catch(err => console.error("❌ Fallo en Nucleo DB:", err));

// --- MODELO DE USUARIO ---
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    coins: { type: Number, default: 1000 },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    skins: { type: Array, default: ['default'] }
});
const User = mongoose.model('User', userSchema);

// --- RUTAS DE AUTENTICACIÓN ---
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();
        res.status(201).send({ message: "Usuario Creado" });
    } catch (e) { res.status(400).send({ error: "El usuario ya existe" }); }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (user && await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ id: user._id }, 'SECRET_KEY_2026');
        res.json({ token, user: { username, coins: user.coins, level: user.level } });
    } else {
        res.status(401).send({ error: "Credenciales Incorrectas" });
    }
});

// --- LÓGICA DE LA ARENA (SOCKETS) ---
let activePlayers = {};

io.on('connection', (socket) => {
    console.log('📡 Nuevo Enlace Neuronal:', socket.id);

    socket.on('joinArena', (userData) => {
        activePlayers[socket.id] = {
            id: socket.id,
            username: userData.username || "Guest",
            x: Math.random() * 1000,
            y: Math.random() * 1000,
            lives: 3,
            level: 1,
            color: userData.color || '#6366f1',
            isDashing: false
        };
        io.emit('syncArena', activePlayers);
    });

    socket.on('playerMove', (data) => {
        if (activePlayers[socket.id]) {
            Object.assign(activePlayers[socket.id], data);
            socket.broadcast.emit('updatePos', activePlayers[socket.id]);
        }
    });

    socket.on('emitPulse', () => {
        const attacker = activePlayers[socket.id];
        if (!attacker) return;

        const pulseRadius = 60 + (attacker.level * 40);

        for (let targetId in activePlayers) {
            if (targetId === socket.id) continue;
            const target = activePlayers[targetId];
            const dist = Math.hypot(attacker.x - target.x, attacker.y - target.y);

            if (dist < pulseRadius && !target.isDashing) {
                target.lives -= 1;
                if (target.lives <= 0) {
                    attacker.level = Math.min(attacker.level + 1, 6);
                    // Premiar al ganador en DB
                    updateUserStats(attacker.username, 50, 100); // +50 coins, +100 xp
                    io.to(targetId).emit('eliminated');
                    delete activePlayers[targetId];
                }
            }
        }
        io.emit('visualPulse', { x: attacker.x, y: attacker.y, radius: pulseRadius, color: attacker.color });
        io.emit('syncArena', activePlayers);
    });

    socket.on('disconnect', () => {
        delete activePlayers[socket.id];
        io.emit('syncArena', activePlayers);
    });
});

async function updateUserStats(username, coinsToAdd, xpToAdd) {
    await User.findOneAndUpdate({ username }, { $inc: { coins: coinsToAdd, xp: xpToAdd } });
}

server.listen(10000, () => console.log("🚀 SERVER 2026 ONLINE - PUERTO 10000"));
server.listen(PORT, () => console.log(`🚀 HG Studios en puerto ${PORT}`));

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

// MODELO DE USUARIO PARA MONETIZACIÓN
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true },
    password: { type: String },
    coins: { type: Number, default: 1000 },
    skins: { type: Array, default: ['#6366f1'] }, // Colores comprados
    activeSkin: { type: String, default: '#6366f1' }
}));

// API: COMPRA DE SKINS (MONETIZACIÓN)
app.post('/api/buy-skin', async (req, res) => {
    const { username, skinColor, price } = req.body;
    const user = await User.findOne({ username });
    if (user && user.coins >= price) {
        user.coins -= price;
        user.skins.push(skinColor);
        user.activeSkin = skinColor;
        await user.save();
        return res.json({ success: true, coins: user.coins });
    }
    res.status(400).json({ success: false, error: "Fondos insuficientes" });
});

// LÓGICA DE LA ARENA
let players = {};
io.on('connection', (socket) => {
    socket.on('joinArena', async (data) => {
        const user = await User.findOne({ username: data.username }) || { activeSkin: '#6366f1', coins: 1000 };
        players[socket.id] = {
            id: socket.id,
            username: data.username,
            x: Math.random() * 800, y: Math.random() * 600,
            lives: 3, level: 1,
            color: user.activeSkin,
            isDashing: false
        };
        io.emit('sync', players);
    });

    socket.on('playerMove', (data) => {
        if (players[socket.id]) {
            Object.assign(players[socket.id], data);
            socket.broadcast.emit('update', players[socket.id]);
        }
    });

    socket.on('disconnect', () => { delete players[socket.id]; io.emit('sync', players); });
});

server.listen(10000, () => console.log("🚀 SERVER 2026 ONLINE - PUERTO 10000"));
server.listen(PORT, () => console.log(`🚀 HG Studios en puerto ${PORT}`));

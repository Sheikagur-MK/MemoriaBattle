require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CONEXIÓN A MONGO (Asegúrate de tener MONGODB_URI en tus variables de entorno)
mongoose.connect(process.env.MONGODB_URI).then(() => console.log("💎 DB 2026 CONECTADA"));

// ESQUEMA DE USUARIO
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    coins: { type: Number, default: 1000 },
    skins: { type: Array, default: ['#6366f1'] },
    activeSkin: { type: String, default: '#6366f1' }
}));

// RUTA DE REGISTRO/LOGIN (Híbrida para facilitar el acceso)
app.post('/api/auth', async (req, res) => {
    const { username, password } = req.body;
    try {
        let user = await User.findOne({ username });
        if (!user) {
            // Si no existe, lo registramos automáticamente
            const hashedPassword = await bcrypt.hash(password, 10);
            user = new User({ username, password: hashedPassword });
            await user.save();
        } else {
            // Si existe, verificamos contraseña
            const valid = await bcrypt.compare(password, user.password);
            if (!valid) return res.status(401).json({ error: "Contraseña incorrecta" });
        }
        res.json({ username: user.username, coins: user.coins, skin: user.activeSkin });
    } catch (e) { res.status(500).json({ error: "Error de servidor" }); }
});

// LÓGICA DE LA ARENA
let players = {};
io.on('connection', (socket) => {
    socket.on('joinArena', (data) => {
        players[socket.id] = {
            id: socket.id, username: data.username,
            x: Math.random() * 800, y: Math.random() * 600,
            lives: 3, level: 1, color: data.skin, isDashing: false
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

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 PULSE ARENA 2026 activo en ${PORT}`));

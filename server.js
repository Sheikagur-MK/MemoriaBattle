const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 10000;

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("✅ DB Conectada"))
    .catch(err => console.error("❌ Error DB:", err));

const User = mongoose.model('User', new mongoose.Schema({
    username: String,
    email: { type: String, unique: true },
    password: String,
    monedas: { type: Number, default: 0 }
}));

let jugadoresEnEspera = [];
let players = {};
let hostId = null;
let partidaIniciada = false;
let zona = { radio: 2500 };

const walls = [
    {x: 800, y: 800, w: 100, h: 800}, {x: 3400, y: 800, w: 800, h: 100},
    {x: 2300, y: 2300, w: 400, h: 400}
];

io.on('connection', (socket) => {
    socket.on('login_usuario', async (datos) => {
        const usuario = await User.findOne({ email: datos.email });
        if (usuario && await bcrypt.compare(datos.password, usuario.password)) {
            if (!jugadoresEnEspera.includes(socket.id)) {
                jugadoresEnEspera.push(socket.id);
                if (!hostId) hostId = socket.id;
            }
            socket.emit('login_resultado', { exito: true, username: usuario.username });
            io.emit('actualizar_sala', { total: jugadoresEnEspera.length, hostId });
        }
    });

    socket.on('solicitar_inicio_partida', () => {
        if (socket.id === hostId) {
            partidaIniciada = true;
            io.emit('iniciar_partida', { walls, zona });
        }
    });

    socket.on('move', (data) => {
        players[socket.id] = data;
        socket.broadcast.emit('playerMoved', { id: socket.id, ...data });
    });

    socket.on('disconnect', () => {
        jugadoresEnEspera = jugadoresEnEspera.filter(id => id !== socket.id);
        delete players[socket.id];
        if (socket.id === hostId) hostId = jugadoresEnEspera[0] || null;
        io.emit('actualizar_sala', { total: jugadoresEnEspera.length, hostId });
    });
});

server.listen(PORT, () => console.log(`🚀 Corriendo en ${PORT}`));

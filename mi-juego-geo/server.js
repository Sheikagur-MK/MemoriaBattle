const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- CONEXIÓN A MONGODB ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log(">>> [CONECTADO] Nucleo de Datos listo"))
    .catch(err => console.error(">>> [ERROR] Fallo en la red de datos:", err));

// --- MODELO DE USUARIO ---
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    linas: { type: Number, default: 100 }
});
const User = mongoose.model('User', UserSchema);

app.use(express.static(path.join(__dirname, 'public')));

// --- ESTADO GLOBAL ---
let onlinePlayers = {};
let privateRooms = {};

io.on('connection', (socket) => {
    
    // --- LÓGICA DE REGISTRO ---
    socket.on('register_user', async (data) => {
        try {
            const hashed = await bcrypt.hash(data.pass, 10);
            const newUser = new User({ username: data.user, password: hashed });
            await newUser.save();
            socket.emit('auth_result', { success: true, message: "Cuenta creada con éxito." });
        } catch (e) {
            socket.emit('auth_result', { success: false, message: "Este usuario ya está registrado." });
        }
    });

    // --- LÓGICA DE LOGIN ---
    socket.on('login_user', async (data) => {
        try {
            const user = await User.findOne({ username: data.user });
            if (user && await bcrypt.compare(data.pass, user.password)) {
                socket.userData = user;
                socket.emit('auth_result', { success: true, user: { username: user.username, linas: user.linas } });
            } else {
                socket.emit('auth_result', { success: false, message: "Usuario o contraseña incorrectos." });
            }
        } catch (e) {
            socket.emit('auth_result', { success: false, message: "Error interno en el servidor." });
        }
    });

    // --- SISTEMA DE PARTIDAS PRIVADAS ---
    socket.on('create_private', () => {
        if (!socket.userData) return;
        const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        privateRooms[roomCode] = { owner: socket.id, players: [socket.id] };
        socket.join(roomCode);
        socket.emit('private_ready', { code: roomCode });
    });

    socket.on('disconnect', () => {
        delete onlinePlayers[socket.id];
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`>>> GEO-FLUX ELITE ONLINE EN PUERTO ${PORT} <<<`);
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io'); 
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"], credentials: true }
});

// --- TU CONFIGURACIÓN DE MONGO (INTACTA) ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("🔥 Base de datos conectada con éxito"))
  .catch(err => console.error("❌ Error al conectar MongoDB:", err));

const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
}));

// --- VARIABLES DE ESTADO ---
let players = {};
let jugadoresEnEspera = [];
let hostId = null;
let partidaIniciada = false;
let items = [];
let zona = { x: 2500, y: 2500, radio: 2500 };

function generarItems() {
    let nuevos = [];
    for(let i=0; i<60; i++) {
        nuevos.push({ id: i, x: Math.random()*4800+100, y: Math.random()*4800+100 });
    }
    return nuevos;
}

io.on('connection', (socket) => {
    // --- LÓGICA DE REGISTRO Y LOGIN (INTACTA) ---
    socket.on('registrar_usuario', async (datos) => {
        try {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(datos.password, salt);
            const nuevoUsuario = new User({ ...datos, password: hashedPassword });
            await nuevoUsuario.save();
            socket.emit('registro_resultado', { exito: true });
        } catch (e) { socket.emit('registro_resultado', { exito: false }); }
    });

    socket.on('login_usuario', async (datos) => {
        try {
            const usuario = await User.findOne({ email: datos.email });
            if (usuario && await bcrypt.compare(datos.password, usuario.password)) {
                if (!jugadoresEnEspera.includes(socket.id)) {
                    jugadoresEnEspera.push(socket.id);
                    if (!hostId) hostId = socket.id;
                }
                socket.emit('login_resultado', { exito: true });
                io.emit('actualizar_sala', { total: jugadoresEnEspera.length, hostId: hostId });
            }
        } catch (e) { socket.emit('login_resultado', { exito: false }); }
    });

    // --- INICIO DE PARTIDA ---
    socket.on('solicitar_inicio_partida', () => {
        if (socket.id === hostId) {
            partidaIniciada = true;
            items = generarItems();
            io.emit('iniciar_partida', { items, zona });
        }
    });

    // --- MOVIMIENTO Y MECÁNICAS ---
    socket.on('move', (data) => {
        players[socket.id] = data; // Incluye x, y, angle, stretch, hasWeapon
        socket.broadcast.emit('playerMoved', { id: socket.id, ...data });
    });

    socket.on('item_recogido', (itemId) => {
        items = items.filter(it => it.id !== itemId);
        io.emit('item_eliminado', itemId);
    });

    socket.on('eliminar_jugador', (targetId) => {
        const ranking = Object.keys(players).length; // Calcula lugar en la partida
        io.to(targetId).emit('has_muerto', ranking);
        delete players[targetId];
        
        // Si solo queda uno, es el ganador
        if (Object.keys(players).length === 1 && partidaIniciada) {
            const ganadorId = Object.keys(players)[0];
            io.to(ganadorId).emit('eres_ganador');
            partidaIniciada = false;
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        jugadoresEnEspera = jugadoresEnEspera.filter(id => id !== socket.id);
        if (socket.id === hostId) hostId = jugadoresEnEspera[0] || null;
        io.emit('playerDisconnected', socket.id);
    });
});

server.listen(process.env.PORT || 10000);
server.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));



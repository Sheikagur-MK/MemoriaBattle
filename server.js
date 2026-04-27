const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"],
        credentials: true
    }
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("🔥 Conexión real establecida"))
  .catch(err => console.error("❌ Error crítico de conexión:", err));

const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
}));

let players = {};
let jugadoresEnEspera = []; // Lista de IDs en el lobby
let hostId = null; // ID del creador de la sala

io.on('connection', (socket) => {
    console.log('Nuevo jugador conectado:', socket.id);

    // Evento de Registro (Sin cambios)
    socket.on('registrar_usuario', async (datos) => {
        try {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(datos.password, salt);
            const nuevoUsuario = new User({
                username: datos.username,
                email: datos.email,
                password: hashedPassword
            });
            await nuevoUsuario.save();
            socket.emit('registro_resultado', { exito: true, mensaje: "¡Usuario registrado con éxito!" });
        } catch (error) {
            socket.emit('registro_resultado', { exito: false, mensaje: "El usuario o correo ya existen." });
        }
    });

    // Lógica de Login y Sala de Espera
    socket.on('login_usuario', async (datos) => {
        try {
            const usuario = await User.findOne({ email: datos.email });
            if (usuario && await bcrypt.compare(datos.password, usuario.password)) {
                
                // Si es el primero, se convierte en Host
                if (jugadoresEnEspera.length === 0) hostId = socket.id;
                
                jugadoresEnEspera.push(socket.id);
                socket.emit('login_resultado', { exito: true, username: usuario.username });
                
                // Notificar a todos el estado de la sala
                io.emit('actualizar_sala', { 
                    total: jugadoresEnEspera.length, 
                    hostId: hostId 
                });
            } else {
                socket.emit('login_resultado', { exito: false, mensaje: "Credenciales inválidas." });
            }
        } catch (e) {
            socket.emit('login_resultado', { exito: false, mensaje: "Error en el servidor." });
        }
    });

    // Inicio de partida controlado por el Host
    socket.on('solicitar_inicio_partida', () => {
        if (socket.id === hostId && jugadoresEnEspera.length >= 2) {
            io.emit('iniciar_partida');
            console.log("🎮 Partida iniciada por el Host");
        }
    });

    // Lógica del juego (Sin cambios)
    players[socket.id] = { x: 2500, y: 2500, angle: 0 };
    
    socket.on('move', (data) => {
        if (players[socket.id]) {
            Object.assign(players[socket.id], data);
            socket.broadcast.emit('playerMoved', { id: socket.id, ...players[socket.id] });
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        jugadoresEnEspera = jugadoresEnEspera.filter(id => id !== socket.id);
        
        // Si el host se va, el siguiente toma el control
        if (socket.id === hostId) {
            hostId = jugadoresEnEspera.length > 0 ? jugadoresEnEspera[0] : null;
        }

        io.emit('actualizar_sala', { total: jugadoresEnEspera.length, hostId: hostId });
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => { console.log(`🚀 Servidor en puerto ${PORT}`); });

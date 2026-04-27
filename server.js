const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: \"*\",
        methods: [\"GET\", \"POST\"],
        credentials: true
    }
});

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log(\"🔥 Base de datos conectada\"))
  .catch(err => console.error(\"❌ Error MongoDB:\", err));

const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
}));

// --- VARIABLES DEL ESTADO DEL JUEGO ---
let players = {};
let jugadoresEnEspera = [];
let hostId = null;
let partidaIniciada = false;

// Configuración global (debe coincidir con el HTML)
const WORLD_SIZE = 5000;
let zona = { x: 2500, y: 2500, radio: 2500 };
let items = [];

// Función para generar ítems una sola vez al inicio
function generarItems() {
    let nuevosItems = [];
    for(let i=0; i<60; i++) {
        nuevosItems.push({
            id: i,
            x: Math.random() * (WORLD_SIZE - 100) + 50,
            y: Math.random() * (WORLD_SIZE - 100) + 50,
            type: Math.random() > 0.6 ? 'weapon' : 'dash'
        });
    }
    return nuevosItems;
}

// Lógica para cerrar la zona aleatoriamente
function actualizarZona() {
    if (!partidaIniciada) return;

    // La zona se mueve un poco hacia una dirección aleatoria antes de encogerse
    const angulo = Math.random() * Math.PI * 2;
    const movimiento = zona.radio * 0.2; // Se mueve máximo un 20% de su radio actual
    
    zona.x += Math.cos(angulo) * movimiento;
    zona.y += Math.sin(angulo) * movimiento;
    zona.radio *= 0.8; // Se reduce un 20% cada vez

    // Asegurar que no se salga del mapa
    zona.x = Math.max(zona.radio, Math.min(WORLD_SIZE - zona.radio, zona.x));
    zona.y = Math.max(zona.radio, Math.min(WORLD_SIZE - zona.radio, zona.y));

    io.emit('actualizar_zona', zona);
}

io.on('connection', (socket) => {
    console.log('Jugador conectado:', socket.id);

    // --- AUTENTICACIÓN (Sin cambios) ---
    socket.on('registrar_usuario', async (datos) => {
        try {
            const hashedPassword = await bcrypt.hash(datos.password, 10);
            const nuevoUsuario = new User({ ...datos, password: hashedPassword });
            await nuevoUsuario.save();
            socket.emit('registro_resultado', { exito: true });
        } catch (e) { socket.emit('registro_resultado', { exito: false, mensaje: \"Error al registrar\" }); }
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
            } else {
                socket.emit('login_resultado', { exito: false, mensaje: \"Credenciales incorrectas\" });
            }
        } catch (e) { socket.emit('login_resultado', { exito: false }); }
    });

    // --- INICIO DE PARTIDA ---
    socket.on('solicitar_inicio_partida', () => {
        if (socket.id === hostId && jugadoresEnEspera.length >= 2) {
            partidaIniciada = true;
            items = generarItems();
            zona = { x: 2500, y: 2500, radio: 2500 }; // Reset zona
            
            // Enviamos toda la configuración inicial a todos
            io.emit('iniciar_partida', { items: items, zona: zona });
            
            // Iniciar el cierre de zona cada 3 minutos (180000 ms)
            setInterval(actualizarZona, 180000);
        }
    });

    // --- MOVIMIENTO Y SINCRONIZACIÓN ---
    players[socket.id] = { x: 2500, y: 2500, angle: 0, stretch: 1, hasWeapon: false };

    socket.on('move', (data) => {
        if (players[socket.id]) {
            // Actualizamos los datos del jugador en el servidor
            Object.assign(players[socket.id], data);
            // Reenviamos a los demás
            socket.broadcast.emit('playerMoved', { id: socket.id, ...players[socket.id] });
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        jugadoresEnEspera = jugadoresEnEspera.filter(id => id !== socket.id);
        if (socket.id === hostId) {
            hostId = jugadoresEnEspera.length > 0 ? jugadoresEnEspera[0] : null;
        }
        io.emit('playerDisconnected', socket.id);
        io.emit('actualizar_sala', { total: jugadoresEnEspera.length, hostId: hostId });
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));

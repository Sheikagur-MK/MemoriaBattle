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

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("🔥 DB Conectada"))
  .catch(err => console.error("❌ Error DB:", err));

const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    victorias: { type: Number, default: 0 },
    monedas: { type: Number, default: 0 }
}));

let players = {};
let jugadoresEnEspera = [];
let hostId = null;
let partidaIniciada = false;
let items = [];
const WORLD_SIZE = 5000;

let zona = { x: 2500, y: 2500, radio: 2500 };
let radioObjetivo = 2500;
let faseActual = 1;
let tiempoParaSiguienteFase = 120;

// Muros reestructurados para un mapa más táctico[cite: 7]
const walls = [
    {x: 500, y: 500, w: 1000, h: 40}, {x: 500, y: 500, w: 40, h: 1000},
    {x: 3500, y: 500, w: 1000, h: 40}, {x: 4460, y: 500, w: 40, h: 1000},
    {x: 500, y: 3500, w: 1000, h: 40}, {x: 500, y: 3500, w: 40, h: 1000},
    {x: 3500, y: 3500, w: 1000, h: 40}, {x: 4460, y: 3500, w: 40, h: 1000},
    {x: 2200, y: 2200, w: 600, h: 600} // El "Core" central
];

function generarItems() {
    let nuevosItems = [];
    const tipos = ['speed', 'weapon', 'shield'];
    for(let i=0; i<80; i++){
        nuevosItems.push({
            id: i,
            x: Math.random() * 4400 + 300,
            y: Math.random() * 4400 + 300,
            type: tipos[Math.floor(Math.random() * tipos.length)]
        });
    }
    return nuevosItems;
}

// Lógica de Zona[cite: 7]
setInterval(() => {
    if (partidaIniciada) {
        if (zona.radio > radioObjetivo) zona.radio -= 0.8;
        io.emit('actualizar_zona', { zona, fase: faseActual, tiempo: tiempoParaSiguienteFase });
    }
}, 100);

io.on('connection', (socket) => {
    socket.on('registrar_usuario', async (datos) => {
        try {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(datos.password, salt);
            await new User({ ...datos, password: hashedPassword }).save();
            socket.emit('registro_resultado', { exito: true });
        } catch (e) { socket.emit('registro_resultado', { exito: false }); }
    });

    socket.on('login_usuario', async (datos) => {
        try {
            const usuario = await User.findOne({ email: datos.email });
            if (usuario && await bcrypt.compare(datos.password, usuario.password)) {
                socket.dbId = usuario._id; 
                if (!jugadoresEnEspera.includes(socket.id)) {
                    jugadoresEnEspera.push(socket.id);
                    if (!hostId) hostId = socket.id;
                }
                socket.emit('login_resultado', { 
                    exito: true, monedas: usuario.monedas, victorias: usuario.victorias, username: usuario.username 
                });
                io.emit('actualizar_sala', { total: jugadoresEnEspera.length, hostId });
            }
        } catch (e) { socket.emit('login_resultado', { exito: false }); }
    });

    socket.on('solicitar_inicio_partida', () => {
        if (socket.id === hostId) {
            partidaIniciada = true;
            faseActual = 1;
            zona.radio = 2500;
            items = generarItems();
            players = {};
            jugadoresEnEspera.forEach(id => {
                players[id] = { x: 2500 + (Math.random()*200-100), y: 2500 + (Math.random()*200-100), vivo: true, type: 'neon' };
            });
            io.emit('iniciar_partida', { items, zona, walls });
        }
    });

    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id] = data;
            socket.broadcast.emit('playerMoved', { id: socket.id, ...data });
        }
    });

    socket.on('eliminar_jugador', (targetId) => {
        if(players[targetId]) {
            io.emit('efecto_explosion', { x: players[targetId].x, y: players[targetId].y });
            delete players[targetId];
            io.emit('playerDisconnected', targetId);
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        jugadoresEnEspera = jugadoresEnEspera.filter(id => id !== socket.id);
        if (socket.id === hostId) hostId = jugadoresEnEspera[0] || null;
        io.emit('actualizar_sala', { total: jugadoresEnEspera.length, hostId });
    });
});

server.listen(process.env.PORT || 10000);
server.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));



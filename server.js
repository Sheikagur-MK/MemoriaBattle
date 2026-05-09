const express = require('express');
const http = require('http');
const { Server } = require('socket.io'); 
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path'); // Añadido para rutas de archivos
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"], credentials: true }
});


// --- CONEXIÓN MONGO (Respetada) ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("🔥 Base de datos conectada con éxito"))
  .catch(err => console.error("❌ Error al conectar MongoDB:", err));
const playerSchema = new mongoose.Schema({
    username: String,
    wins: { type: Number, default: 0 }
});
const PlayerModel = mongoose.model('Player', playerSchema);

let players = {};

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('Jugador conectado:', socket.id);
    
    // Crear nuevo jugador
    players[socket.id] = {
        x: Math.random() * 700,
        y: Math.random() * 400,
        color: `hsl(${Math.random() * 360}, 70%, 50%)`,
        id: socket.id
    };

    // Enviar estado actual a todos
    io.emit('updatePlayers', players);

    // Recibir movimiento
    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            socket.broadcast.emit('updatePlayers', players);
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 HG Studios activo en puerto ${PORT}`));

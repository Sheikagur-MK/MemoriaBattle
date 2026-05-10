
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Conexión a MongoDB usando la variable de Render
const uri = process.env.MONGODB_URI;
mongoose.connect(uri)
  .then(() => console.log(">>> Conexión exitosa a MongoDB"))
  .catch(err => console.error(">>> Error conectando a Mongo:", err));

// Esquema simple para guardar puntos de jugadores
const PlayerSchema = new mongoose.Schema({
  name: String,
  score: { type: Number, default: 0 }
});
const PlayerModel = mongoose.model('Player', PlayerSchema);

// Servir la carpeta pública
app.use(express.static(path.join(__dirname, 'public')));

let activePlayers = {};

io.on('connection', (socket) => {
    console.log('Nuevo usuario:', socket.id);

    activePlayers[socket.id] = {
        x: Math.random() * 800,
        y: Math.random() * 600,
        color: `hsl(${Math.random() * 360}, 80%, 60%)`,
        shape: ['circle', 'triangle', 'square'][Math.floor(Math.random() * 3)]
    };

    io.emit('update', activePlayers);

    socket.on('move', (data) => {
        if (activePlayers[socket.id]) {
            activePlayers[socket.id].x = data.x;
            activePlayers[socket.id].y = data.y;
            io.emit('update', activePlayers);
        }
    });

    socket.on('disconnect', () => {
        delete activePlayers[socket.id];
        io.emit('update', activePlayers);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor iniciado en puerto ${PORT}`);
});

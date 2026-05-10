const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } // Permite conexiones de cualquier lugar (PC/Móvil)
});

// ESTO ES CLAVE: Asegura que Render encuentre tus archivos
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

let players = {};

io.on('connection', (socket) => {
    console.log('Nuevo jugador:', socket.id);
    
    players[socket.id] = {
        x: 400,
        y: 300,
        color: `hsl(${Math.random() * 360}, 70%, 50%)`,
        size: 20
    };

    io.emit('updatePlayers', players);

    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            io.emit('updatePlayers', players); // Sincronización total
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
});

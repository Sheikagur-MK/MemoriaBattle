require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('>>> [BANANA-DB] Sistema de Juego Listo'))
  .catch(e => console.error('>>> [ERROR-DB]:', e.message));

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  trofeos: { type: Number, default: 0 }, // La "esencia" de progreso
  monedas: { type: Number, default: 100 },
  wins: { type: Number, default: 0 },
  ownedSkins: { type: [String], default: ['default'] },
  activeSkin: { type: String, default: 'default' },
});
const User = mongoose.model('User', UserSchema);

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Lógica de Sockets (Mantiene tu sistema de turnos y tablero original)
io.on('connection', (socket) => {
  // ... (Tu lógica de login y matchmaking original se mantiene intacta)
});

server.listen(process.env.PORT || 3000, () => console.log('Banana Party HG Edition Online'));

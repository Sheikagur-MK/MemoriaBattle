require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const mongoose   = require('mongoose');
const bcrypt     = require('bcryptjs');
const path       = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

// --- CONEXIÓN A BASE DE DATOS ---
// Asegúrate de tener MONGODB_URI en tu archivo .env
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('>>> [DB] Conectado a Brawl Database'))
  .catch(e  => console.error('>>> [DB] Error de conexión:', e.message));

// --- MODELO DE USUARIO (ESTILO BRAWL) ---
const UserSchema = new mongoose.Schema({
  username:    { type: String, unique: true, required: true },
  password:    { type: String, required: true },
  trofeos:     { type: Number, default: 0 },   // Reemplaza a las "palmeras"
  monedas:     { type: Number, default: 100 },
  wins:        { type: Number, default: 0 },
  ownedBrawlers: { type: [String], default: ['leon'] }, // Tu lista de personajes
  activeBrawler: { type: String,  default: 'leon' },
});
const User = mongoose.model('User', UserSchema);

app.use(express.static(path.join(__dirname, 'public')));

// --- LÓGICA DE JUEGO Y SOCKETS ---
const lobbies = {};
const games = {};

io.on('connection', (socket) => {
  console.log(`>>> Nuevo Brawler conectado: ${socket.id}`);

  // Registro/Login (Integrando tu lógica original)
  socket.on('auth_login', async (data) => {
    try {
      const user = await User.findOne({ username: data.username });
      if (user && await bcrypt.compare(data.password, user.password)) {
        socket.userData = user;
        socket.emit('auth_success', user);
      } else {
        socket.emit('auth_error', { msg: 'Credenciales inválidas' });
      }
    } catch (e) {
      socket.emit('auth_error', { msg: 'Error en el servidor' });
    }
  });

  // Lanzar Dado (Lógica del Tablero HG)
  socket.on('roll_dice', async (gameId) => {
    const diceValue = Math.floor(Math.random() * 6) + 1;
    // Emitir a todos en la partida
    io.to(gameId).emit('dice_result', { 
      playerId: socket.id, 
      value: diceValue 
    });
  });

  socket.on('disconnect', () => {
    console.log(`>>> Brawler desconectado: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`====================================`);
  console.log(`   BRAWL PARTY HG CORRIENDO EN ${PORT}   `);
  console.log(`====================================`);
});

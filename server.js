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

// ── BASE DE DATOS: NUEVO ESQUEMA COMPETITIVO Y TIENDA ────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('>>> [DB] Conectado a Rebaño Mortal DB'))
  .catch(e  => console.error('>>> [DB] Error:', e.message));

const UserSchema = new mongoose.Schema({
  username:    { type: String, unique: true, required: true },
  password:    { type: String, required: true },
  elo:         { type: Number, default: 1000 }, // Base para Bronce 1
  coins:       { type: Number, default: 0 },    // Monedas para la tienda
  skin:        { type: String, default: 'default' }, // Aspecto equipado
  wins:        { type: Number, default: 0 },
  gamesPlayed: { type: Number, default: 0 },
  createdAt:   { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

app.use(express.static(path.join(__dirname, 'public')));

// ── SISTEMA DE RANGOS (ELO) ───────────────────────────────────────────────────
function getRankInfo(elo) {
  // Lógica de rangos: Cada 100 puntos subes de división. Cada 300 pasas de liga.
  if (elo < 1100) return 'Bronce 1';
  if (elo < 1200) return 'Bronce 2';
  if (elo < 1300) return 'Bronce 3';
  if (elo < 1400) return 'Plata 1';
  if (elo < 1500) return 'Plata 2';
  if (elo < 1600) return 'Plata 3';
  if (elo < 1700) return 'Oro 1';
  if (elo < 1800) return 'Oro 2';
  if (elo < 1900) return 'Oro 3';
  if (elo < 2000) return 'Platino 1';
  if (elo < 2200) return 'Diamante 1';
  return 'Master';
}

// ── GESTOR DE SALAS (10 SALAS MAX 50 JUGADORES) ───────────────────────────────
const ROOMS = [];
const MAX_PLAYERS = 50;

// Inicializamos 5 salas Casuales y 5 Competitivas
for (let i = 1; i <= 10; i++) {
  ROOMS.push({
    id: `Sala-${i}`,
    type: i <= 5 ? 'casual' : 'competitiva',
    players: {},
    playerCount: 0
  });
}

function getAvailableRoom(type) {
  return ROOMS.find(r => r.type === type && r.playerCount < MAX_PLAYERS);
}

// ── LÓGICA MULTIJUGADOR (SOCKET.IO) ───────────────────────────────────────────
io.on('connection', sock => {
  console.log(`>>> + Jugador conectado: ${sock.id}`);
  let currentRoom = null;

  // 1. AUTENTICACIÓN
  sock.on('login', async ({ username, password }) => {
    try {
      const u = await User.findOne({ username: username.trim() });
      if (!u || !(await bcrypt.compare(password, u.password))) {
        return sock.emit('auth_result', { ok: false, msg: 'Credenciales incorrectas.' });
      }
      sock.userData = u;
      sock.emit('auth_result', { 
        ok: true, 
        user: { 
          username: u.username, 
          elo: u.elo, 
          rank: getRankInfo(u.elo),
          coins: u.coins,
          skin: u.skin 
        } 
      });
    } catch(e) { sock.emit('auth_result', { ok: false, msg: 'Error de conexión.' }); }
  });

  sock.on('register', async ({ username, password }) => {
    try {
      await new User({ username: username.trim(), password: await bcrypt.hash(password, 10) }).save();
      sock.emit('auth_result', { ok: true, msg: 'Cuenta creada. Inicia sesión.' });
    } catch(e) {
      sock.emit('auth_result', { ok: false, msg: e.code === 11000 ? 'El usuario ya existe.' : 'Error interno.' });
    }
  });

  // 2. MATCHMAKING Y LOBBY
  sock.on('join_match', ({ mode }) => { // mode = 'casual' | 'competitiva'
    if (!sock.userData) return;
    
    const room = getAvailableRoom(mode);
    if (!room) {
      return sock.emit('room_full', { msg: 'Todos los servidores están llenos.' });
    }

    currentRoom = room;
    sock.join(room.id);
    
    // Registrar jugador en la sala
    room.players[sock.id] = {
      id: sock.id,
      username: sock.userData.username,
      skin: sock.userData.skin,
      x: Math.random() * 2000, // Spawn aleatorio en mapa grande
      y: Math.random() * 2000,
      pulling: false,
      score: 0,
      isDead: false
    };
    room.playerCount++;

    // Enviar estado de la sala al nuevo jugador
    sock.emit('game_start', { 
      roomId: room.id, 
      mode: room.type, 
      players: room.players 
    });

    // Avisar a los demás que alguien entró
    sock.to(room.id).emit('player_joined', room.players[sock.id]);
    console.log(`>>> [${room.id}] ${sock.userData.username} se unió. (${room.playerCount}/${MAX_PLAYERS})`);
  });

  // 3. FÍSICAS DEL SWARM Y MOVIMIENTO (TICK RATE)
  sock.on('player_update', (data) => {
    if (!currentRoom || !currentRoom.players[sock.id] || currentRoom.players[sock.id].isDead) return;
    
    // Actualizamos posición y estado magnético
    const p = currentRoom.players[sock.id];
    p.x = data.x;
    p.y = data.y;
    p.pulling = data.pulling;

    // Retransmitimos a los demás jugadores de la sala
    sock.to(currentRoom.id).emit('player_moved', {
      id: sock.id,
      x: p.x,
      y: p.y,
      pulling: p.pulling
    });
  });

  // Cuando un jugador suelta el botón (Explosión Kinética)
  sock.on('kinetic_blast', (data) => {
    if (!currentRoom) return;
    // Retransmitimos la explosión para que los clientes calculen el impacto en el enjambre
    sock.to(currentRoom.id).emit('enemy_blast', { id: sock.id, x: data.x, y: data.y });
  });

  // 4. COMBATE Y ELO
  sock.on('player_killed', async ({ victimId }) => {
    if (!currentRoom) return;
    
    const killer = currentRoom.players[sock.id];
    const victim = currentRoom.players[victimId];

    if (killer && victim && !victim.isDead) {
      victim.isDead = true;
      killer.score += 100;
      
      io.to(currentRoom.id).emit('kill_feed', { killer: killer.username, victim: victim.username });

      // Si es competitiva, actualizamos Elo en DB
      if (currentRoom.type === 'competitiva') {
        try {
          const killerDB = await User.findOne({ username: killer.username });
          const victimDB = await User.findOne({ username: victim.username });
          
          // Cálculo simple de ELO (+25 ganar, -15 perder)
          killerDB.elo += 25;
          killerDB.coins += 10; // Gana monedas para la tienda
          killerDB.wins += 1;
          killerDB.gamesPlayed += 1;
          
          victimDB.elo = Math.max(0, victimDB.elo - 15);
          victimDB.gamesPlayed += 1;

          await killerDB.save();
          await victimDB.save();
          
          // Avisar a la víctima
          io.to(victim.id).emit('elo_updated', { elo: victimDB.elo, rank: getRankInfo(victimDB.elo) });
          // Avisar al asesino
          sock.emit('elo_updated', { elo: killerDB.elo, rank: getRankInfo(killerDB.elo), coins: killerDB.coins });
        } catch(e) { console.error('Error actualizando ELO:', e); }
      }
    }
  });

  // 5. DESCONEXIÓN
  sock.on('disconnect', () => {
    console.log(`>>> - Jugador desconectado: ${sock.id}`);
    if (currentRoom) {
      delete currentRoom.players[sock.id];
      currentRoom.playerCount--;
      io.to(currentRoom.id).emit('player_left', sock.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`>>> SERVIDOR REBAÑO MORTAL INICIADO EN EL PUERTO :${PORT}`));

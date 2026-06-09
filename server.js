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

// ── BASE DE DATOS ─────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('>>> [DB] Conectado a Neo 2026 DB'))
  .catch(e  => console.error('>>> [DB] Error:', e.message));

const UserSchema = new mongoose.Schema({
  username:    { type: String, unique: true, required: true },
  password:    { type: String, required: true },
  brains:      { type: Number, default: 0 },
  wins:        { type: Number, default: 0 },
  gamesPlayed: { type: Number, default: 0 },
  arenaLevel:  { type: Number, default: 1 }
});
const User = mongoose.model('User', UserSchema);

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── ESTADO GLOBAL ─────────────────────────────────────────────────────────────
let queue = [];
let games = {};
let counter = 0;

// ── EMPAREJAMIENTO (MATCHMAKING 1v1) ──────────────────────────────────────────
function tryStartMatch() {
  if (queue.length < 2) return;
  
  const p1_id = queue.shift();
  const p2_id = queue.shift();
  
  const p1_sock = io.sockets.sockets.get(p1_id);
  const p2_sock = io.sockets.sockets.get(p2_id);

  if (!p1_sock || !p2_sock) {
    if (p1_sock) queue.push(p1_id);
    if (p2_sock) queue.push(p2_id);
    return;
  }

  const gameId = `G${++counter}`;
  p1_sock.join(gameId);
  p2_sock.join(gameId);
  p1_sock.currentGame = gameId;
  p2_sock.currentGame = gameId;

  const coinWinner = Math.random() < 0.5 ? p1_sock.id : p2_sock.id;

  games[gameId] = {
    id: gameId,
    players: {
      [p1_id]: { id: p1_id, username: p1_sock.userData.username, team: 'red', score: 0 },
      [p2_id]: { id: p2_id, username: p2_sock.userData.username, team: 'blue', score: 0 }
    },
    round: 1,
    sequence: [],
    turn: coinWinner,
    phase: 'pick'
  };

  io.to(gameId).emit('game_start', {
    gameId,
    players: games[gameId].players,
    coinWinner,
    round: 1
  });

  console.log(`>>> [${gameId}] Partida iniciada: ${p1_sock.userData.username} vs ${p2_sock.userData.username}`);
}

// ── LÓGICA DE PARTIDA ─────────────────────────────────────────────────────────
async function endGame(gameId, winnerId) {
  const g = games[gameId];
  if (!g) return;

  const winner = g.players[winnerId];
  const loserId = Object.keys(g.players).find(id => id !== winnerId);
  const loser = g.players[loserId];

  io.to(gameId).emit('game_over', { 
    winner: winner.username, 
    winnerTeam: winner.team,
    scores: { 
      red: Object.values(g.players).find(p => p.team === 'red').score, 
      blue: Object.values(g.players).find(p => p.team === 'blue').score 
    }
  });

  try {
    await User.updateOne({ username: winner.username }, { $inc: { brains: 3, gamesPlayed: 1, wins: 1 } });
    if(loser) await User.updateOne({ username: loser.username }, { $inc: { gamesPlayed: 1 } });
  } catch(e) { console.error('DB Error:', e.message); }

  console.log(`>>> [${gameId}] FIN. Ganador: ${winner.username}`);
  delete games[gameId];
}

// ── SOCKET.IO ─────────────────────────────────────────────────────────────────
io.on('connection', sock => {
  console.log(`>>> +${sock.id}`);

  // AUTENTICACIÓN
  sock.on('register', async ({ username, password }) => {
    try {
      await new User({ username: username.trim(), password: await bcrypt.hash(password, 10) }).save();
      sock.emit('auth_result', { ok: true, msg: 'Piloto registrado. Inicia sesión.' });
    } catch(e) {
      sock.emit('auth_result', { ok: false, msg: e.code === 11000 ? 'El usuario ya existe.' : 'Error interno.' });
    }
  });

  sock.on('login', async ({ username, password }) => {
    try {
      const u = await User.findOne({ username: username.trim() });
      if (!u || !(await bcrypt.compare(password, u.password))) {
        return sock.emit('auth_result', { ok: false, msg: 'Credenciales incorrectas.' });
      }
      sock.userData = u;
      sock.emit('auth_result', { 
        ok: true, 
        user: { username: u.username, brains: u.brains, arenaLevel: u.arenaLevel }
      });
    } catch(e) { sock.emit('auth_result', { ok: false, msg: 'Error de conexión.' }); }
  });

  // MATCHMAKING
  sock.on('join_queue', () => {
    if (!sock.userData || queue.includes(sock.id)) return;
    queue.push(sock.id);
    sock.emit('queue_status', { msg: 'Buscando rival...' });
    tryStartMatch();
  });

  sock.on('leave_queue', () => { queue = queue.filter(id => id !== sock.id); });

  // GAMEPLAY (1 TURNO = AÑADIR 1 CASILLA)
  sock.on('cell_picked', (cellIndex) => {
    const g = games[sock.currentGame];
    if (!g || g.turn !== sock.id || g.phase !== 'pick') return;
    
    // Formato para que el cliente renderice el color correcto del chip (0=rojo, 1=azul)
    const playerIndex = g.players[sock.id].team === 'red' ? 0 : 1;
    g.sequence.push({ p: playerIndex, c: cellIndex });
    
    const otherPlayerId = Object.keys(g.players).find(id => id !== sock.id);
    g.turn = otherPlayerId;
    g.phase = 'input';
    g.currentInputIdx = 0;

    io.to(sock.currentGame).emit('update_sequence', { sequence: g.sequence, nextTurn: g.turn, phase: g.phase });
  });

  sock.on('cell_input', (cellIndex) => {
    const g = games[sock.currentGame];
    if (!g || g.turn !== sock.id || g.phase !== 'input') return;

    const expectedCell = g.sequence[g.currentInputIdx].c; // Extraemos solo el índice de la casilla

    if (cellIndex === expectedCell) {
      g.currentInputIdx++;
      io.to(sock.currentGame).emit('input_correct', { cellIndex, inputIdx: g.currentInputIdx });

      if (g.currentInputIdx >= g.sequence.length) {
        g.turn = sock.id; 
        g.phase = 'pick';
        io.to(sock.currentGame).emit('phase_change', { nextTurn: g.turn, phase: g.phase });
      }
    } else {
      const winnerId = Object.keys(g.players).find(id => id !== sock.id);
      g.players[winnerId].score++;
      
      const redScore = Object.values(g.players).find(p => p.team === 'red').score;
      const blueScore = Object.values(g.players).find(p => p.team === 'blue').score;

      io.to(sock.currentGame).emit('round_end', { 
        winnerId, 
        loserId: sock.id,
        scores: { red: redScore, blue: blueScore },
        failedCell: cellIndex
      });

      if (g.players[winnerId].score >= 3) {
        endGame(sock.currentGame, winnerId);
      } else {
        g.round++;
        g.sequence = [];
        g.phase = 'pick';
        g.turn = winnerId; 
        setTimeout(() => {
          io.to(sock.currentGame).emit('new_round', { round: g.round, turn: g.turn });
        }, 3000);
      }
    }
  });

  sock.on('disconnect', () => {
    console.log(`>>> -${sock.id}`);
    queue = queue.filter(id => id !== sock.id);
    const g = games[sock.currentGame];
    if (g) {
      const winnerId = Object.keys(g.players).find(id => id !== sock.id);
      if (winnerId) {
        io.to(sock.currentGame).emit('player_disconnected', { msg: 'El rival se ha desconectado.' });
        endGame(sock.currentGame, winnerId);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`>>> MEMORIA BATTLE ONLINE :${PORT}`));

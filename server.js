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

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('>>> [DB] Conectado'))
  .catch(e  => console.error('>>> [DB] Error:', e.message));

const UserSchema = new mongoose.Schema({
  username:    { type: String, unique: true, required: true },
  password:    { type: String, required: true },
  palmeras:    { type: Number, default: 0 },
  wins:        { type: Number, default: 0 },
  gamesPlayed: { type: Number, default: 0 },
  ownedSkins:  { type: [String], default: ['default'] },
  activeSkin:  { type: String,  default: 'default' },
});
const User = mongoose.model('User', UserSchema);

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── CONSTANTES ────────────────────────────────────────────────────────────────
const BOARD_SIZE        = 70;
const BLUE_SPACES       = 20;
const RED_SPACES        = 20;
const STAR_SPACES       = 2;
const SUPER_MINI_SPACES = 5;
const BANANA_BLUE       = 5;
const BANANA_RED        = -2;
const BANANA_MG1        = 10;
const BANANA_MG2        = 8;
const BANANA_MG3        = 6;
const SUPER_BANANA_COST = 50;
const TURNS_PER_GAME    = 10;
const MATCHMAKING_MS    = 20000;
const CHAR_SELECT_MS    = 25000;
const MG_DURATION_MS    = 20000; // duración máxima de minijuego
const MG_RESULT_WAIT_MS = 4000;  // espera tras resultado antes de siguiente ronda

const ANIMALS = ['leon','gorila','oso','pinguino','tiburon','orca','elefante','girafa','perro','gato','hamster','lobo'];
const COLORS  = ['#FF6B6B','#4ECDC4','#FFE66D','#A8E6CF','#FF8B94','#C3A6FF','#FFD3A5','#B5EAD7'];

// ── TABLERO ALEATORIO ─────────────────────────────────────────────────────────
function generateBoard() {
  const types = [];
  for (let i = 0; i < BLUE_SPACES;       i++) types.push('blue');
  for (let i = 0; i < RED_SPACES;        i++) types.push('red');
  for (let i = 0; i < STAR_SPACES;       i++) types.push('star');
  for (let i = 0; i < SUPER_MINI_SPACES; i++) types.push('supermini');
  while (types.length < BOARD_SIZE) types.push('normal');
  // Fisher-Yates
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  const biomes = ['fauna','desierto','bosque','selva','artico'];
  return types.map((type, idx) => ({ id: idx, type, biome: biomes[Math.floor(idx / 14)] }));
}

// ── ESTADO GLOBAL ─────────────────────────────────────────────────────────────
let queue       = [];
let lobbies     = {};
let games       = {};
let gameCounter = 0;
let matchTimer  = null;
let matchStart  = null;

// ── COLA ──────────────────────────────────────────────────────────────────────
function broadcastQueue() {
  const timeLeft = matchStart
    ? Math.max(0, Math.ceil((matchStart + MATCHMAKING_MS - Date.now()) / 1000))
    : MATCHMAKING_MS / 1000;
  queue.forEach(sid => io.to(sid).emit('queue_update', { players: queue.length, timeLeft }));
}

function tryStartMatch() {
  if (queue.length < 2) return;
  let count = Math.min(8, queue.length);
  if (count % 2 !== 0) count--;
  if (count < 2) return;
  clearTimeout(matchTimer); matchTimer = null; matchStart = null;
  const participants = queue.splice(0, count);
  createLobby(participants);
  if (queue.length >= 2) startMatchmaking();
}

function startMatchmaking() {
  if (matchTimer) return;
  matchStart = Date.now();
  broadcastQueue();
  matchTimer = setTimeout(() => { matchTimer = null; matchStart = null; tryStartMatch(); }, MATCHMAKING_MS);
}

function addToQueue(sid) {
  if (queue.includes(sid)) return;
  queue.push(sid);
  if (!matchTimer && queue.length >= 2) startMatchmaking();
  else broadcastQueue();
}

function removeFromQueue(sid) {
  queue = queue.filter(id => id !== sid);
  if (queue.length < 2 && matchTimer) { clearTimeout(matchTimer); matchTimer = null; matchStart = null; }
  broadcastQueue();
}

// ── LOBBY (SELECCIÓN DE PERSONAJE) ───────────────────────────────────────────
function createLobby(playerIds) {
  const lobbyId = `lobby_${++gameCounter}`;
  const players = {};
  playerIds.forEach(sid => {
    const sock = io.sockets.sockets.get(sid);
    if (!sock) return;
    players[sid] = { id: sid, username: sock.userData?.username || 'Jugador', animal: null, ready: false };
    sock.join(lobbyId);
    sock.currentLobby = lobbyId;
  });
  lobbies[lobbyId] = { id: lobbyId, players, timer: null };
  io.to(lobbyId).emit('lobby_created', { lobbyId, players: Object.values(players), timeLeft: CHAR_SELECT_MS / 1000 });

  lobbies[lobbyId].timer = setTimeout(() => {
    const lobby = lobbies[lobbyId];
    if (!lobby) return;
    const taken = Object.values(lobby.players).map(p => p.animal).filter(Boolean);
    const avail = ANIMALS.filter(a => !taken.includes(a));
    Object.values(lobby.players).forEach(p => {
      if (!p.animal) p.animal = avail.splice(Math.floor(Math.random() * avail.length), 1)[0] || ANIMALS[0];
    });
    startGame(lobbyId);
  }, CHAR_SELECT_MS);
}

// ── INICIO DE PARTIDA ─────────────────────────────────────────────────────────
function startGame(lobbyId) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;
  clearTimeout(lobby.timer);

  const board      = generateBoard();
  const gameId     = lobbyId.replace('lobby_', 'game_');
  const playerList = Object.values(lobby.players);

  // Orden de turno aleatorio
  const turnOrder = [...playerList].sort(() => Math.random() - 0.5).map(p => p.id);

  const players = {};
  playerList.forEach((p, i) => {
    players[p.id] = {
      id: p.id, username: p.username, animal: p.animal,
      position: 0, bananas: 0, superBananas: 0,
      color: COLORS[i % COLORS.length],
      team: i % 2 === 0 ? 'red' : 'blue',
      hasRolled: false,
      turnIndex: turnOrder.indexOf(p.id),
    };
    const sock = io.sockets.sockets.get(p.id);
    if (sock) { sock.leave(lobbyId); sock.join(gameId); sock.currentGame = gameId; sock.currentLobby = null; }
  });

  const game = {
    id: gameId, board, players, turnOrder,
    currentTurnIdx: 0,   // índice en turnOrder de quién tira ahora
    round: 1, maxRounds: TURNS_PER_GAME,
    phase: 'rolling',    // rolling | minigame | gameover
    superMiniTriggered: false,
    superMiniPlayer: null,
    mgTimer: null,
    over: false,
  };

  games[gameId] = game;
  delete lobbies[lobbyId];

  io.to(gameId).emit('game_start', {
    gameId, board, players,
    turnOrder, round: 1, maxRounds: TURNS_PER_GAME,
    currentTurn: turnOrder[0],  // quién empieza
  });

  // Avisar al primer jugador que es su turno
  setTimeout(() => notifyTurn(gameId), 1500);
  console.log(`>>> [${gameId}] Iniciada con ${playerList.length} jugadores. Turno: ${turnOrder[0]}`);
}

// ── NOTIFICAR TURNO ───────────────────────────────────────────────────────────
function notifyTurn(gameId) {
  const game = games[gameId];
  if (!game || game.over) return;
  const currentId = game.turnOrder[game.currentTurnIdx];
  // A todos: quién es el turno actual
  io.to(gameId).emit('turn_update', {
    currentTurn: currentId,
    round: game.round,
    players: game.players,
  });
  // Solo al jugador activo: permiso para tirar
  io.to(currentId).emit('your_turn', { roll: true });
  console.log(`>>> [${gameId}] Turno de: ${game.players[currentId]?.username}`);
}

// ── TIRAR DADO ────────────────────────────────────────────────────────────────
function rollDice(gameId, playerId) {
  const game = games[gameId];
  if (!game || game.phase !== 'rolling') return;
  // Solo el jugador activo puede tirar
  if (game.turnOrder[game.currentTurnIdx] !== playerId) return;
  const p = game.players[playerId];
  if (!p || p.hasRolled) return;

  const roll = Math.floor(Math.random() * 6) + 1;
  const prevPos = p.position;
  p.position = (p.position + roll) % BOARD_SIZE;
  p.hasRolled = true;

  const space = game.board[p.position];
  let spaceEffect = null;

  if (space.type === 'blue') {
    p.bananas += BANANA_BLUE;
    spaceEffect = { type: 'blue', delta: BANANA_BLUE };
  } else if (space.type === 'red') {
    p.bananas = Math.max(0, p.bananas + BANANA_RED);
    spaceEffect = { type: 'red', delta: BANANA_RED };
  } else if (space.type === 'star') {
    spaceEffect = { type: 'star' };
  } else if (space.type === 'supermini') {
    spaceEffect = { type: 'supermini' };
    game.superMiniTriggered = true;
    game.superMiniPlayer    = playerId;
  }

  // Broadcast movimiento a todos
  io.to(gameId).emit('player_moved', {
    playerId, roll, prevPos,
    newPos: p.position,
    bananas: p.bananas,
    spaceEffect,
    space,
    players: game.players,
  });

  console.log(`>>> [${gameId}] ${p.username} tiró ${roll} → casilla ${p.position} (${space.type})`);

  // Avanzar al siguiente turno después de 2.5 segundos
  setTimeout(() => advanceTurn(gameId), 2500);
}

// ── AVANZAR TURNO ─────────────────────────────────────────────────────────────
function advanceTurn(gameId) {
  const game = games[gameId];
  if (!game || game.over) return;

  game.currentTurnIdx = (game.currentTurnIdx + 1) % game.turnOrder.length;

  // ¿Ya tiraron todos en esta ronda?
  const allRolled = game.currentTurnIdx === 0;

  if (allRolled) {
    // Todos tiraron → resetear y lanzar minijuego
    Object.values(game.players).forEach(p => p.hasRolled = false);
    setTimeout(() => triggerMinigame(gameId), 1000);
  } else {
    // Siguiente jugador en esta ronda
    notifyTurn(gameId);
  }
}

// ── MINIJUEGO ─────────────────────────────────────────────────────────────────
function triggerMinigame(gameId) {
  const game = games[gameId];
  if (!game || game.over) return;
  game.phase = 'minigame';

  const playerCount = Object.keys(game.players).length;
  const isSuper     = game.superMiniTriggered && playerCount % 2 === 0;
  const mgId        = isSuper
    ? Math.floor(Math.random() * 25) + 1
    : Math.floor(Math.random() * 100) + 1;

  const redTeam  = Object.values(game.players).filter(p => p.team === 'red').map(p => p.id);
  const blueTeam = Object.values(game.players).filter(p => p.team === 'blue').map(p => p.id);

  game.superMiniTriggered = false;
  game.superMiniPlayer    = null;

  io.to(gameId).emit('minigame_incoming', {
    type: isSuper ? 'super' : 'normal',
    minigameId: mgId,
    players: playerCount,
    redTeam:  isSuper ? redTeam  : [],
    blueTeam: isSuper ? blueTeam : [],
    countdown: 5,
    duration: MG_DURATION_MS / 1000,
  });

  // AUTO-RESOLVER el minijuego en el servidor tras el tiempo límite
  // Esto garantiza que el juego continúa aunque el cliente no reporte
  game.mgTimer = setTimeout(() => {
    const playerIds = game.turnOrder.filter(id => !game.players[id]?.disconnected);
    if (isSuper) {
      // Ganador de super: equipo aleatorio
      const winTeam = Math.random() < 0.5 ? 'red' : 'blue';
      resolveMinigame(gameId, { type: 'super', winnerTeam: winTeam });
    } else {
      // Ganador aleatorio de minijuego normal
      const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
      resolveMinigame(gameId, {
        type: 'normal',
        winner: shuffled[0] || null,
        second: shuffled[1] || null,
        third:  shuffled[2] || null,
      });
    }
  }, MG_DURATION_MS + 7000); // duración + countdown(5s) + margen(2s)
}

// ── RESOLVER MINIJUEGO ────────────────────────────────────────────────────────
function resolveMinigame(gameId, results) {
  const game = games[gameId];
  if (!game || game.phase !== 'minigame') return;
  game.phase = 'rolling';

  // Limpiar timer automático si fue manual
  if (game.mgTimer) { clearTimeout(game.mgTimer); game.mgTimer = null; }

  if (results.type === 'super') {
    const winTeam = results.winnerTeam;
    Object.values(game.players).forEach(p => {
      if (p.team === winTeam) p.superBananas++;
    });
    io.to(gameId).emit('minigame_result', { type: 'super', winnerTeam: winTeam, players: game.players });
  } else {
    if (results.winner && game.players[results.winner]) game.players[results.winner].bananas += BANANA_MG1;
    if (results.second && game.players[results.second]) game.players[results.second].bananas += BANANA_MG2;
    if (results.third  && game.players[results.third])  game.players[results.third].bananas  += BANANA_MG3;
    io.to(gameId).emit('minigame_result', {
      type: 'normal',
      winner: results.winner, second: results.second, third: results.third,
      rewards: { first: BANANA_MG1, second: BANANA_MG2, third: BANANA_MG3 },
      players: game.players,
    });
  }

  console.log(`>>> [${gameId}] Minijuego resuelto. Ronda ${game.round}/${game.maxRounds}`);

  // ¿Fin de partida?
  if (game.round >= game.maxRounds) {
    setTimeout(() => endGame(gameId), MG_RESULT_WAIT_MS);
  } else {
    game.round++;
    game.currentTurnIdx = 0; // volver al primer jugador
    setTimeout(() => {
      io.to(gameId).emit('next_round', { round: game.round, maxRounds: game.maxRounds, players: game.players });
      notifyTurn(gameId);
    }, MG_RESULT_WAIT_MS);
  }
}

// ── COMPRAR SUPER BANANA ──────────────────────────────────────────────────────
function buyStarBanana(gameId, playerId) {
  const game = games[gameId];
  if (!game) return;
  const p     = game.players[playerId];
  const space = game.board[p?.position];
  if (!p || space?.type !== 'star') return;
  if (p.bananas < SUPER_BANANA_COST) {
    io.to(playerId).emit('buy_result', { success: false, msg: 'Necesitas 50 🍌 para comprar.' });
    return;
  }
  p.bananas -= SUPER_BANANA_COST;
  p.superBananas++;
  io.to(gameId).emit('buy_result', { success: true, playerId, bananas: p.bananas, superBananas: p.superBananas });
}

// ── FIN DE PARTIDA ────────────────────────────────────────────────────────────
async function endGame(gameId) {
  const game = games[gameId];
  if (!game || game.over) return;
  game.over = true;
  if (game.mgTimer) clearTimeout(game.mgTimer);

  const ranking = Object.values(game.players)
    .sort((a, b) => b.superBananas - a.superBananas || b.bananas - a.bananas)
    .map((p, i) => ({ ...p, finalPosition: i + 1 }));

  const palmRewards = [3, 2, 1];
  for (let i = 0; i < ranking.length; i++) {
    const pal = palmRewards[i] || 0;
    if (pal > 0) {
      try {
        await User.updateOne({ username: ranking[i].username }, {
          $inc: { palmeras: pal, gamesPlayed: 1, wins: i === 0 ? 1 : 0 }
        });
      } catch(e) { console.error('DB update error:', e.message); }
    } else {
      try { await User.updateOne({ username: ranking[i].username }, { $inc: { gamesPlayed: 1 } }); }
      catch(e) {}
    }
  }

  io.to(gameId).emit('game_over', { ranking });
  console.log(`>>> [${gameId}] FIN. Ganador: ${ranking[0]?.username}`);
  delete games[gameId];
}

// ── SOCKET.IO ─────────────────────────────────────────────────────────────────
io.on('connection', socket => {
  console.log(`>>> Conexión: ${socket.id}`);

  socket.on('register', async ({ username, password }) => {
    if (!username?.trim() || !password?.trim())
      return socket.emit('auth_result', { ok: false, msg: 'Campos obligatorios.' });
    try {
      await new User({ username: username.trim(), password: await bcrypt.hash(password, 10) }).save();
      socket.emit('auth_result', { ok: true, msg: 'Cuenta creada. Inicia sesión.' });
    } catch(e) {
      socket.emit('auth_result', { ok: false, msg: e.code === 11000 ? 'Usuario ya existe.' : 'Error interno.' });
    }
  });

  socket.on('login', async ({ username, password }) => {
    if (!username?.trim() || !password?.trim())
      return socket.emit('auth_result', { ok: false, msg: 'Campos obligatorios.' });
    try {
      const user = await User.findOne({ username: username.trim() });
      if (!user || !(await bcrypt.compare(password, user.password)))
        return socket.emit('auth_result', { ok: false, msg: 'Credenciales incorrectas.' });
      socket.userData = user;
      socket.emit('auth_result', {
        ok: true,
        user: { username: user.username, palmeras: user.palmeras, wins: user.wins,
                gamesPlayed: user.gamesPlayed, ownedSkins: user.ownedSkins, activeSkin: user.activeSkin }
      });
    } catch(e) { socket.emit('auth_result', { ok: false, msg: 'Error interno.' }); }
  });

  socket.on('join_queue',  () => { if (socket.userData) addToQueue(socket.id); else socket.emit('error_msg', 'Inicia sesión primero.'); });
  socket.on('leave_queue', () => removeFromQueue(socket.id));

  socket.on('select_animal', ({ lobbyId, animal }) => {
    const lobby = lobbies[lobbyId];
    if (!lobby || !lobby.players[socket.id]) return;
    const taken = Object.values(lobby.players).some(p => p.id !== socket.id && p.animal === animal);
    if (taken) return socket.emit('animal_taken', { animal });
    lobby.players[socket.id].animal = animal;
    lobby.players[socket.id].ready  = true;
    io.to(lobbyId).emit('lobby_update', { players: Object.values(lobby.players) });
    if (Object.values(lobby.players).every(p => p.ready)) { clearTimeout(lobby.timer); startGame(lobbyId); }
  });

  // ── JUEGO ─────────────────────────────────────────────────
  socket.on('roll_dice', () => { if (socket.currentGame) rollDice(socket.currentGame, socket.id); });
  socket.on('buy_star',  () => { if (socket.currentGame) buyStarBanana(socket.currentGame, socket.id); });

  // El cliente envía el resultado del minijuego (se acepta del host pero el servidor también auto-resuelve)
  socket.on('minigame_result', results => {
    if (!socket.currentGame) return;
    const game = games[socket.currentGame];
    if (!game || game.phase !== 'minigame') return;
    // Solo el primer jugador (host) puede reportar
    if (game.turnOrder[0] === socket.id) {
      resolveMinigame(socket.currentGame, results);
    }
  });

  // ── TIENDA ─────────────────────────────────────────────────
  socket.on('buy_skin', async ({ skin }) => {
    if (!socket.userData) return;
    try {
      const user = await User.findOne({ username: socket.userData.username });
      if (!user) return;
      if (user.ownedSkins.includes(skin)) return socket.emit('shop_result', { ok: false, msg: 'Ya tienes esta skin.' });
      if (user.palmeras < 100) return socket.emit('shop_result', { ok: false, msg: 'No tienes suficientes palmeras.' });
      user.palmeras -= 100; user.ownedSkins.push(skin);
      await user.save(); socket.userData = user;
      socket.emit('shop_result', { ok: true, palmeras: user.palmeras, ownedSkins: user.ownedSkins });
    } catch(e) { socket.emit('shop_result', { ok: false, msg: 'Error.' }); }
  });

  socket.on('equip_skin', async ({ skin }) => {
    if (!socket.userData) return;
    try {
      const user = await User.findOne({ username: socket.userData.username });
      if (!user || !user.ownedSkins.includes(skin)) return;
      user.activeSkin = skin; await user.save(); socket.userData = user;
      socket.emit('skin_equipped', { activeSkin: skin });
    } catch(e) {}
  });

  socket.on('get_leaderboard', async () => {
    try {
      const top = await User.find({}, 'username wins gamesPlayed palmeras').sort({ wins: -1 }).limit(20);
      socket.emit('leaderboard_data', top);
    } catch(e) {}
  });

  // ── DESCONEXIÓN ────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`>>> Desconectado: ${socket.id}`);
    removeFromQueue(socket.id);

    // Si estaba en lobby
    if (socket.currentLobby) {
      const lobby = lobbies[socket.currentLobby];
      if (lobby) {
        delete lobby.players[socket.id];
        if (Object.keys(lobby.players).length === 0) { clearTimeout(lobby.timer); delete lobbies[socket.currentLobby]; }
        else io.to(socket.currentLobby).emit('lobby_update', { players: Object.values(lobby.players) });
      }
    }

    // Si estaba en partida
    if (socket.currentGame) {
      const game = games[socket.currentGame];
      if (game && game.players[socket.id]) {
        game.players[socket.id].disconnected = true;
        io.to(socket.currentGame).emit('player_disconnected', { playerId: socket.id, username: game.players[socket.id].username });

        // Si era su turno, avanzar automáticamente
        if (game.phase === 'rolling' && game.turnOrder[game.currentTurnIdx] === socket.id) {
          setTimeout(() => advanceTurn(socket.currentGame), 1000);
        }

        // Si quedan 0 activos, terminar
        const active = Object.values(game.players).filter(p => !p.disconnected).length;
        if (active < 1) endGame(socket.currentGame);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`>>> BANANA PARTY en puerto ${PORT}`));

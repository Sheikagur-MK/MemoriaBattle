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
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── CONSTANTES ────────────────────────────────────────────────────────────────
const BOARD_SIZE     = 70;
const TURNS_PER_GAME = 10;
const MATCHMAKE_MS   = 20000;
const CHARSEL_MS     = 25000;
const MG_TOTAL_MS    = 32000; // 5s countdown + 25s juego + 2s margen
const MG_RESULT_MS   = 5000;  // pausa antes de siguiente ronda

const ANIMALS = ['leon','gorila','oso','pinguino','tiburon','orca',
                 'elefante','girafa','perro','gato','hamster','lobo'];
const COLORS  = ['#FF6B6B','#4ECDC4','#FFE66D','#A8E6CF',
                 '#FF8B94','#C3A6FF','#FFD3A5','#B5EAD7'];

// ── TABLERO ───────────────────────────────────────────────────────────────────
function generateBoard() {
  const types = [];
  for (let i = 0; i < 20; i++) types.push('blue');
  for (let i = 0; i < 20; i++) types.push('red');
  for (let i = 0; i < 2;  i++) types.push('star');
  for (let i = 0; i < 5;  i++) types.push('supermini');
  while (types.length < BOARD_SIZE) types.push('normal');
  // shuffle
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  const biomes = ['fauna','desierto','bosque','selva','artico'];
  return types.map((type, idx) => ({
    id: idx, type,
    biome: biomes[Math.floor(idx / 14)]
  }));
}

// ── ESTADO GLOBAL ─────────────────────────────────────────────────────────────
let queue = [], lobbies = {}, games = {}, counter = 0;
let matchTimer = null, matchStart = null;

// ── COLA ──────────────────────────────────────────────────────────────────────
function broadcastQueue() {
  const tl = matchStart
    ? Math.max(0, Math.ceil((matchStart + MATCHMAKE_MS - Date.now()) / 1000))
    : MATCHMAKE_MS / 1000;
  queue.forEach(sid =>
    io.to(sid).emit('queue_update', { players: queue.length, timeLeft: tl }));
}

function tryStartMatch() {
  if (queue.length < 2) return;
  let count = Math.min(8, queue.length);
  if (count % 2 !== 0) count--;
  if (count < 2) return;
  clearTimeout(matchTimer); matchTimer = null; matchStart = null;
  const ids = queue.splice(0, count);
  createLobby(ids);
  if (queue.length >= 2) startMatchmaking();
}

function startMatchmaking() {
  if (matchTimer) return;
  matchStart = Date.now();
  broadcastQueue();
  matchTimer = setTimeout(() => {
    matchTimer = null; matchStart = null;
    tryStartMatch();
  }, MATCHMAKE_MS);
}

function addToQueue(sid) {
  if (queue.includes(sid)) return;
  queue.push(sid);
  if (!matchTimer && queue.length >= 2) startMatchmaking();
  else broadcastQueue();
}

function removeFromQueue(sid) {
  queue = queue.filter(id => id !== sid);
  if (queue.length < 2 && matchTimer) {
    clearTimeout(matchTimer); matchTimer = null; matchStart = null;
  }
  broadcastQueue();
}

// ── LOBBY ─────────────────────────────────────────────────────────────────────
function createLobby(ids) {
  const lobbyId = `L${++counter}`;
  const players = {};
  ids.forEach(sid => {
    const sock = io.sockets.sockets.get(sid);
    if (!sock) return;
    players[sid] = {
      id: sid,
      username: sock.userData?.username || 'Jugador',
      animal: null, ready: false
    };
    sock.join(lobbyId);
    sock.currentLobby = lobbyId;
    sock.currentGame  = null;
  });
  lobbies[lobbyId] = { id: lobbyId, players, timer: null };

  io.to(lobbyId).emit('lobby_created', {
    lobbyId,
    players: Object.values(players),
    timeLeft: CHARSEL_MS / 1000
  });
  console.log(`>>> [${lobbyId}] Lobby creado: ${ids.length} jugadores`);

  // Auto-asignar y arrancar si no eligen a tiempo
  lobbies[lobbyId].timer = setTimeout(() => {
    const lobby = lobbies[lobbyId];
    if (!lobby) return;
    const taken = Object.values(lobby.players).map(p => p.animal).filter(Boolean);
    let avail   = ANIMALS.filter(a => !taken.includes(a));
    Object.values(lobby.players).forEach(p => {
      if (!p.animal) {
        if (!avail.length) avail = [...ANIMALS];
        const idx = Math.floor(Math.random() * avail.length);
        p.animal  = avail.splice(idx, 1)[0];
        p.ready   = true;
      }
    });
    startGame(lobbyId);
  }, CHARSEL_MS);
}

// ── INICIO DE PARTIDA ─────────────────────────────────────────────────────────
function startGame(lobbyId) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;
  clearTimeout(lobby.timer);

  // Verificar que hay al menos 2 jugadores con animal
  const plist = Object.values(lobby.players);
  if (plist.length < 2) {
    delete lobbies[lobbyId]; return;
  }

  const gameId    = `G${lobbyId}`;
  const board     = generateBoard();
  const turnOrder = [...plist].sort(() => Math.random() - 0.5).map(p => p.id);
  const players   = {};

  plist.forEach((p, i) => {
    players[p.id] = {
      id: p.id, username: p.username,
      animal: p.animal || ANIMALS[i % ANIMALS.length],
      position: 0, bananas: 0, superBananas: 0,
      color: COLORS[i % COLORS.length],
      team: i % 2 === 0 ? 'red' : 'blue',
      hasRolled: false
    };
    const sock = io.sockets.sockets.get(p.id);
    if (sock) {
      sock.leave(lobbyId);
      sock.join(gameId);
      sock.currentLobby = null;
      sock.currentGame  = gameId;
    }
  });

  games[gameId] = {
    id: gameId, board, players, turnOrder,
    turnIdx: 0,
    round: 1, maxRounds: TURNS_PER_GAME,
    phase: 'rolling',     // 'rolling' | 'minigame' | 'over'
    superMini: false,
    mgTimer: null, over: false
  };

  delete lobbies[lobbyId];

  io.to(gameId).emit('game_start', {
    gameId, board, players, turnOrder,
    round: 1, maxRounds: TURNS_PER_GAME,
    currentTurn: turnOrder[0]
  });

  console.log(`>>> [${gameId}] Partida iniciada. Turno: ${players[turnOrder[0]]?.username}`);
  setTimeout(() => emitTurn(gameId), 1800);
}

// ── TURNO ─────────────────────────────────────────────────────────────────────
function emitTurn(gameId) {
  const g = games[gameId];
  if (!g || g.over) return;
  const pid = g.turnOrder[g.turnIdx];
  const p   = g.players[pid];
  if (!p) { advanceTurn(gameId); return; }

  io.to(gameId).emit('turn_update', {
    currentTurn: pid,
    round: g.round, maxRounds: g.maxRounds,
    players: g.players
  });
  // Permiso al jugador activo
  io.to(pid).emit('your_turn');
  console.log(`>>> [${gameId}] R${g.round} Turno de: ${p.username}`);
}

// ── DADO ──────────────────────────────────────────────────────────────────────
function handleRoll(gameId, pid) {
  const g = games[gameId];
  if (!g || g.phase !== 'rolling') return;
  if (g.turnOrder[g.turnIdx] !== pid) return;
  const p = g.players[pid];
  if (!p || p.hasRolled) return;

  const roll    = Math.floor(Math.random() * 6) + 1;
  const prevPos = p.position;
  p.position    = (p.position + roll) % BOARD_SIZE;
  p.hasRolled   = true;

  const space  = g.board[p.position];
  let effect   = null;

  if (space.type === 'blue')     { p.bananas = Math.max(0, p.bananas + 5);  effect = { type:'blue',  delta:+5 }; }
  if (space.type === 'red')      { p.bananas = Math.max(0, p.bananas - 2);  effect = { type:'red',   delta:-2 }; }
  if (space.type === 'star')     { effect = { type:'star' }; }
  if (space.type === 'supermini'){ effect = { type:'supermini' }; g.superMini = true; }

  io.to(gameId).emit('player_moved', {
    playerId: pid, roll, prevPos,
    newPos: p.position, bananas: p.bananas,
    spaceEffect: effect, players: g.players
  });
  console.log(`>>> [${gameId}] ${p.username} ➜ ${roll} → casilla ${p.position} (${space.type})`);

  setTimeout(() => advanceTurn(gameId), 2800);
}

// ── AVANZAR TURNO ─────────────────────────────────────────────────────────────
function advanceTurn(gameId) {
  const g = games[gameId];
  if (!g || g.over) return;

  g.turnIdx = (g.turnIdx + 1) % g.turnOrder.length;
  const roundComplete = g.turnIdx === 0;

  if (roundComplete) {
    Object.values(g.players).forEach(p => p.hasRolled = false);
    setTimeout(() => triggerMinigame(gameId), 1200);
  } else {
    emitTurn(gameId);
  }
}

// ── MINIJUEGO ─────────────────────────────────────────────────────────────────
function triggerMinigame(gameId) {
  const g = games[gameId];
  if (!g || g.over) return;
  g.phase = 'minigame';

  const count   = Object.values(g.players).filter(p => !p.disconnected).length;
  const isSuper = g.superMini && count % 2 === 0;
  const mgId    = Math.floor(Math.random() * 20) + 1;   // 20 minijuegos
  g.superMini   = false;

  const redTeam  = Object.values(g.players).filter(p => p.team === 'red').map(p => p.id);
  const blueTeam = Object.values(g.players).filter(p => p.team === 'blue').map(p => p.id);

  io.to(gameId).emit('minigame_incoming', {
    type: isSuper ? 'super' : 'normal',
    minigameId: mgId,
    players: count,
    redTeam: isSuper ? redTeam  : [],
    blueTeam: isSuper ? blueTeam : [],
    countdown: 5,
    duration: 25
  });

  // El servidor auto-resuelve si el cliente no reporta
  g.mgTimer = setTimeout(() => {
    console.log(`>>> [${gameId}] Auto-resolviendo minijuego`);
    const alive = g.turnOrder.filter(id => !g.players[id]?.disconnected);
    const sh    = [...alive].sort(() => Math.random() - 0.5);
    if (isSuper) {
      resolveMinigame(gameId, { type:'super', winnerTeam: Math.random()<0.5?'red':'blue' });
    } else {
      resolveMinigame(gameId, { type:'normal', winner:sh[0], second:sh[1]||null, third:sh[2]||null });
    }
  }, MG_TOTAL_MS);
}

// ── RESOLVER MINIJUEGO ────────────────────────────────────────────────────────
function resolveMinigame(gameId, results) {
  const g = games[gameId];
  if (!g || g.phase !== 'minigame') return;
  g.phase = 'rolling';
  if (g.mgTimer) { clearTimeout(g.mgTimer); g.mgTimer = null; }

  if (results.type === 'super') {
    Object.values(g.players).forEach(p => {
      if (p.team === results.winnerTeam) p.superBananas++;
    });
  } else {
    if (results.winner && g.players[results.winner]) g.players[results.winner].bananas += 10;
    if (results.second && g.players[results.second]) g.players[results.second].bananas += 8;
    if (results.third  && g.players[results.third])  g.players[results.third].bananas  += 6;
  }

  io.to(gameId).emit('minigame_result', { ...results, players: g.players });
  console.log(`>>> [${gameId}] MJ resuelto. R${g.round}/${g.maxRounds}`);

  if (g.round >= g.maxRounds) {
    setTimeout(() => endGame(gameId), MG_RESULT_MS);
  } else {
    g.round++;
    g.turnIdx = 0;
    Object.values(g.players).forEach(p => p.hasRolled = false);
    setTimeout(() => {
      io.to(gameId).emit('next_round', {
        round: g.round, maxRounds: g.maxRounds, players: g.players
      });
      emitTurn(gameId);
    }, MG_RESULT_MS);
  }
}

// ── FIN ───────────────────────────────────────────────────────────────────────
async function endGame(gameId) {
  const g = games[gameId];
  if (!g || g.over) return;
  g.over = true;
  if (g.mgTimer) clearTimeout(g.mgTimer);

  const ranking = Object.values(g.players)
    .sort((a,b) => b.superBananas - a.superBananas || b.bananas - a.bananas)
    .map((p,i) => ({ ...p, finalPosition: i+1 }));

  io.to(gameId).emit('game_over', { ranking });

  for (let i = 0; i < ranking.length; i++) {
    const pal = [3,2,1][i] || 0;
    try {
      await User.updateOne({ username: ranking[i].username }, {
        $inc: { palmeras: pal, gamesPlayed: 1, wins: i===0?1:0 }
      });
    } catch(e) { console.error('DB:', e.message); }
  }

  console.log(`>>> [${gameId}] FIN. Ganador: ${ranking[0]?.username}`);
  delete games[gameId];
}

// ── SOCKET.IO ─────────────────────────────────────────────────────────────────
io.on('connection', sock => {
  console.log(`>>> +${sock.id}`);

  sock.on('register', async ({ username, password }) => {
    if (!username?.trim() || !password?.trim())
      return sock.emit('auth_result', { ok:false, msg:'Campos obligatorios.' });
    try {
      await new User({ username:username.trim(), password:await bcrypt.hash(password,10) }).save();
      sock.emit('auth_result', { ok:true, msg:'Cuenta creada. Inicia sesión.' });
    } catch(e) {
      sock.emit('auth_result', { ok:false, msg: e.code===11000?'Usuario ya existe.':'Error interno.' });
    }
  });

  sock.on('login', async ({ username, password }) => {
    if (!username?.trim() || !password?.trim())
      return sock.emit('auth_result', { ok:false, msg:'Campos obligatorios.' });
    try {
      const u = await User.findOne({ username: username.trim() });
      if (!u || !(await bcrypt.compare(password, u.password)))
        return sock.emit('auth_result', { ok:false, msg:'Credenciales incorrectas.' });
      sock.userData = u;
      sock.emit('auth_result', { ok:true, user:{
        username:u.username, palmeras:u.palmeras, wins:u.wins,
        gamesPlayed:u.gamesPlayed, ownedSkins:u.ownedSkins, activeSkin:u.activeSkin
      }});
    } catch(e) { sock.emit('auth_result', { ok:false, msg:'Error interno.' }); }
  });

  sock.on('join_queue',  () => {
    if (!sock.userData) return sock.emit('error_msg','Inicia sesión primero.');
    addToQueue(sock.id);
  });
  sock.on('leave_queue', () => removeFromQueue(sock.id));

  sock.on('select_animal', ({ lobbyId, animal }) => {
    const lobby = lobbies[lobbyId];
    if (!lobby || !lobby.players[sock.id]) return;
    const taken = Object.values(lobby.players)
      .some(p => p.id !== sock.id && p.animal === animal);
    if (taken) return sock.emit('animal_taken', { animal });
    lobby.players[sock.id].animal = animal;
    lobby.players[sock.id].ready  = true;
    io.to(lobbyId).emit('lobby_update', { players: Object.values(lobby.players) });
    // Si todos eligieron → arrancar
    if (Object.values(lobby.players).every(p => p.ready)) {
      clearTimeout(lobby.timer);
      startGame(lobbyId);
    }
  });

  sock.on('roll_dice', () => {
    if (sock.currentGame) handleRoll(sock.currentGame, sock.id);
  });

  sock.on('buy_star', () => {
    const g = games[sock.currentGame];
    if (!g) return;
    const p = g.players[sock.id];
    if (!p || g.board[p.position]?.type !== 'star') return;
    if (p.bananas < 50) return sock.emit('buy_result',{ success:false, msg:'Necesitas 50 🍌.' });
    p.bananas -= 50; p.superBananas++;
    io.to(sock.currentGame).emit('buy_result',{ success:true, playerId:sock.id,
      bananas:p.bananas, superBananas:p.superBananas });
  });

  sock.on('minigame_done', results => {
    const g = games[sock.currentGame];
    if (!g || g.phase !== 'minigame') return;
    if (g.turnOrder[0] === sock.id) resolveMinigame(sock.currentGame, results);
  });

  sock.on('get_leaderboard', async () => {
    try {
      const top = await User.find({},'username wins gamesPlayed palmeras')
        .sort({ wins:-1 }).limit(20);
      sock.emit('leaderboard_data', top);
    } catch(e){}
  });

  sock.on('buy_skin', async ({ skin }) => {
    if (!sock.userData) return;
    try {
      const u = await User.findOne({ username: sock.userData.username });
      if (!u) return;
      if (u.ownedSkins.includes(skin))
        return sock.emit('shop_result',{ ok:false, msg:'Ya la tienes.' });
      if (u.palmeras < 100)
        return sock.emit('shop_result',{ ok:false, msg:'Palmeras insuficientes.' });
      u.palmeras -= 100; u.ownedSkins.push(skin);
      await u.save(); sock.userData = u;
      sock.emit('shop_result',{ ok:true, palmeras:u.palmeras, ownedSkins:u.ownedSkins });
    } catch(e) { sock.emit('shop_result',{ ok:false, msg:'Error.' }); }
  });

  sock.on('equip_skin', async ({ skin }) => {
    if (!sock.userData) return;
    try {
      const u = await User.findOne({ username: sock.userData.username });
      if (!u || !u.ownedSkins.includes(skin)) return;
      u.activeSkin = skin; await u.save(); sock.userData = u;
      sock.emit('skin_equipped',{ activeSkin:skin });
    } catch(e){}
  });

  sock.on('disconnect', () => {
    console.log(`>>> -${sock.id}`);
    removeFromQueue(sock.id);

    if (sock.currentLobby) {
      const lobby = lobbies[sock.currentLobby];
      if (lobby) {
        delete lobby.players[sock.id];
        const remaining = Object.keys(lobby.players).length;
        if (remaining === 0) { clearTimeout(lobby.timer); delete lobbies[sock.currentLobby]; }
        else io.to(sock.currentLobby).emit('lobby_update',{ players:Object.values(lobby.players) });
      }
    }

    if (sock.currentGame) {
      const g = games[sock.currentGame];
      if (g && g.players[sock.id]) {
        g.players[sock.id].disconnected = true;
        io.to(sock.currentGame).emit('player_disconnected',{ playerId:sock.id, username:g.players[sock.id].username });
        if (g.phase === 'rolling' && g.turnOrder[g.turnIdx] === sock.id)
          setTimeout(() => advanceTurn(sock.currentGame), 1000);
        const alive = Object.values(g.players).filter(p=>!p.disconnected).length;
        if (alive < 1) endGame(sock.currentGame);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`>>> BANANA PARTY :${PORT}`));


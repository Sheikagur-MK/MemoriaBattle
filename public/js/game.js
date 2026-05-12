// ── CONTROLADOR PRINCIPAL DEL CLIENTE ────────────────────────────────────────
const G = (() => {

  // ── ESTADO ────────────────────────────────────────────────
  let socket        = null;
  let user          = null;
  let currentLobby  = null;
  let currentGame   = null;
  let boardRender   = null;
  let mgEngine      = null;
  let csTimer       = null;
  let queueInterval = null;
  let myAnimal      = null;

  // ── SONIDO ────────────────────────────────────────────────
  const Audio = {
    ctx: null,
    volumes: { master: 0.7, music: 0.5, sfx: 0.8 },
    init() {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    },
    play(freq, dur = 0.1, type = 'sine') {
      if (!this.ctx || this.volumes.master === 0) return;
      try {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.connect(g); g.connect(this.ctx.destination);
        o.frequency.value = freq;
        o.type = type;
        g.gain.setValueAtTime(this.volumes.master * this.volumes.sfx * 0.3, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        o.start(); o.stop(this.ctx.currentTime + dur);
      } catch(e) {}
    },
    pop()  { this.play(880, 0.08); },
    coin() { this.play(1046, 0.08); setTimeout(() => this.play(1318, 0.1), 80); },
    dice() { [220,330,440,550].forEach((f,i) => setTimeout(() => this.play(f, 0.05, 'square'), i*40)); },
    win()  { [523,659,784,1046].forEach((f,i) => setTimeout(() => this.play(f, 0.15), i*120)); },
    lose() { this.play(196, 0.4, 'sawtooth'); },
  };

  // ── TOAST ─────────────────────────────────────────────────
  function toast(msg, type = '') {
    const el  = document.getElementById('toast');
    if (!el) return;
    const div = document.createElement('div');
    div.className = `toast-msg ${type}`;
    div.textContent = msg;
    el.appendChild(div);
    setTimeout(() => div.remove(), 3200);
    Audio.pop();
  }

  // ── PANTALLAS ─────────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('#dice-overlay,#mg-overlay,#mg-game-screen,#result-overlay').forEach(el => {
      el.classList.remove('active');
      el.style.display = '';
    });
    const t = document.getElementById(id);
    if (t) t.classList.add('active');
  }

  function showAuth() { showScreen('screen-auth'); }

  function switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach((b,i) => b.classList.toggle('active', (i === 0) === (tab === 'login')));
    document.getElementById('auth-login').style.display    = tab === 'login'    ? '' : 'none';
    document.getElementById('auth-register').style.display = tab === 'register' ? '' : 'none';
  }

  // ── AUTH ──────────────────────────────────────────────────
  function doLogin() {
    const username = document.getElementById('a-user').value.trim();
    const password = document.getElementById('a-pass').value.trim();
    if (!username || !password) return toast('Completa todos los campos.', 'err');
    socket.emit('login', { username, password });
  }

  function doRegister() {
    const username = document.getElementById('r-user').value.trim();
    const password = document.getElementById('r-pass').value.trim();
    const pass2    = document.getElementById('r-pass2').value.trim();
    if (!username || !password) return toast('Completa todos los campos.', 'err');
    if (password.length < 6)   return toast('La contraseña debe tener al menos 6 caracteres.', 'err');
    if (password !== pass2)    return toast('Las contraseñas no coinciden.', 'err');
    socket.emit('register', { username, password });
  }

  function logout() {
    user = null;
    showScreen('screen-intro');
    toast('Sesión cerrada. ¡Hasta pronto!');
  }

  // ── LOBBY ─────────────────────────────────────────────────
  function refreshLobbyUI() {
    if (!user) return;
    const updateText = (id, txt) => { const el = document.getElementById(id); if(el) el.textContent = txt; };
    
    updateText('u-name', user.username);
    updateText('u-stats', `Victorias: ${user.wins} · Partidas: ${user.gamesPlayed}`);
    updateText('u-palmeras', user.palmeras);
    updateText('stat-wins', user.wins);
    updateText('stat-games', user.gamesPlayed);
    updateText('shop-palmeras', user.palmeras + ' 🌴');

    const animal = ANIMALS_DATA[myAnimal || 'leon'];
    updateText('user-avatar', animal.emoji);
    updateText('lobby-animal', animal.emoji);
    updateText('lobby-animal-name', animal.name);
    updateText('lobby-skin-name', `Skin: ${user.activeSkin || 'Default'}`);
  }

  // ── COLA ──────────────────────────────────────────────────
  function joinQueue() {
    if (!user) return toast('Debes iniciar sesión.', 'err');
    socket.emit('join_queue');
    showScreen('screen-queue');
    let dotIdx = 0;
    queueInterval = setInterval(() => {
      document.querySelectorAll('.dot').forEach((d,i) => d.classList.toggle('active', i === dotIdx));
      dotIdx = (dotIdx + 1) % 8;
    }, 400);
    toast('Buscando partida... 🔍');
  }

  function leaveQueue() {
    socket.emit('leave_queue');
    clearInterval(queueInterval);
    showScreen('screen-lobby');
    toast('Búsqueda cancelada.');
  }

  // ── SELECCIÓN DE PERSONAJE ────────────────────────────────
  function renderCharSel(players) {
    const grid = document.getElementById('animals-grid');
    if (!grid) return;
    const taken = players.filter(p => p.id !== socket.id).map(p => p.animal).filter(Boolean);

    grid.innerHTML = Object.entries(ANIMALS_DATA).map(([key, a]) => {
      const isTaken    = taken.includes(key);
      const isSelected = players.find(p => p.id === socket.id)?.animal === key;
      return `<div class="animal-card ${isTaken ? 'taken' : ''} ${isSelected ? 'selected' : ''}"
        onclick="G.selectAnimal('${key}')" data-key="${key}">
        <div class="animal-emoji">${a.emoji}</div>
        <div class="animal-name">${a.name}</div>
        ${isTaken ? '<div style="font-size:.7rem;color:#E74C3C;margin-top:4px">Tomado</div>' : ''}
      </div>`;
    }).join('');

    const ready = players.filter(p => p.ready).length;
    const csPlayers = document.getElementById('cs-players');
    if(csPlayers) csPlayers.textContent = `${ready}/${players.length} jugadores listos`;
  }

  function selectAnimal(key) {
    if (!currentLobby) return;
    socket.emit('select_animal', { lobbyId: currentLobby, animal: key });
    myAnimal = key;
    Audio.coin();
  }

  // ── JUEGO ─────────────────────────────────────────────────
  function initGame(data) {
    currentGame = data.gameId;
    showScreen('screen-game');

    const canvas = document.getElementById('game-canvas');
    if (canvas) {
        canvas.style.display = 'block';
        boardRender = new BoardRenderer('game-canvas');
        boardRender.board = data.board;
        boardRender.initPlayers(data.players);
        boardRender.startRender();
        
        boardRender.targetCamX = window.innerWidth  / 2 - 50;
        boardRender.targetCamY = window.innerHeight / 2 - 50;
    }

    updateHUD(data);
    checkMyTurn(data);
  }

  function updateHUD(data) {
    if (!data) return;

    const roundEl = document.getElementById('hud-round');
    if (roundEl) roundEl.textContent = `Ronda ${data.round || 1}/${data.maxRounds || 10}`;

    const bar = document.getElementById('hud-bar');
    if (bar) {
        let html = '';
        Object.values(data.players || {}).forEach(p => {
          const animal = ANIMALS_DATA[p.animal] || {};
          html += `<div class="hud-player" style="border-left:3px solid ${p.color || '#fff'}">
            <span class="hud-player-emoji">${animal.emoji || '🐾'}</span>
            <span>${p.username.slice(0,8)}</span>
            <span style="color:#FFD700;font-weight:900">🍌${p.bananas || 0}</span>
            ${p.superBananas > 0 ? `<span style="color:gold">⭐${p.superBananas}</span>` : ''}
          </div>`;
        });
        bar.innerHTML = html;
    }

    if (data.players && socket && data.players[socket.id]) {
        const misPuntos = data.players[socket.id].palmeras;
        if (user) user.palmeras = misPuntos;
        const palmerasEl = document.getElementById('u-palmeras');
        if (palmerasEl) palmerasEl.textContent = misPuntos;
    }
  }

  function checkMyTurn(data) {
    const me = data.players?.[socket.id];
    if (!me || me.hasRolled) return;
    const overlay = document.getElementById('dice-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    overlay.classList.add('active');
    document.getElementById('dice-result').style.display = 'none';
    document.getElementById('roll-btn').style.display    = '';
    document.getElementById('dice-face').style.animation = 'diceRoll .3s linear infinite';
  }

  function rollDice() {
    Audio.dice();
    const btn = document.getElementById('roll-btn');
    if(btn) btn.style.display = 'none';
    socket.emit('roll_dice');
  }

  function onPlayerMoved(data) {
    if (boardRender) {
      boardRender.updatePlayer(data.playerId, data.newPos);
      if (data.playerId === socket.id) boardRender.focusPlayer(socket.id);
    }

    if (data.playerId === socket.id) {
      const face = ['','⚀','⚁','⚂','⚃','⚄','⚅'][data.roll] || '🎲';
      const faceEl = document.getElementById('dice-face');
      const resEl = document.getElementById('dice-result');
      if (faceEl) {
          faceEl.textContent = face;
          faceEl.style.animation = 'none';
      }
      if (resEl) {
          resEl.style.display = '';
          resEl.textContent = `¡Sacaste ${data.roll}!`;
      }

      if (data.spaceEffect) setTimeout(() => showSpaceEffect(data.spaceEffect), 800);

      setTimeout(() => {
        const overlay = document.getElementById('dice-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            overlay.style.display = '';
        }
      }, 2200);
    }
  }

  function showSpaceEffect(effect) {
    if (effect.type === 'blue')  { toast(`¡Casilla azul! +${effect.delta} 🍌`, 'ok'); Audio.coin(); }
    if (effect.type === 'red')   { toast(`¡Casilla roja! ${effect.delta} 🍌`, 'err'); Audio.lose(); }
    if (effect.type === 'star')  {
      toast('⭐ ¡Casilla Super Banana! ¿Comprar por 50🍌?', 'ok');
      setTimeout(() => { if (confirm('¿Comprar Super Banana por 50 🍌?')) socket.emit('buy_star'); }, 300);
    }
    if (effect.type === 'supermini') toast('💜 ¡Super Minijuego activado!', 'ok');
  }

  // ── MINIJUEGO ─────────────────────────────────────────────
  function showMinigameIncoming(data) {
    const overlay = document.getElementById('mg-overlay');
    if(!overlay) return;
    overlay.classList.add('active');

    const badge = document.getElementById('mg-type-badge');
    const mg = data.type === 'super' ? SUPER_MINIGAMES.find(m => m.id === data.minigameId) : MINIGAMES.find(m => m.id === data.minigameId);

    if(badge) {
        badge.className = `mg-type-badge mg-type-${data.type === 'super' ? 'super' : 'normal'}`;
        badge.textContent = data.type === 'super' ? '⚡ SUPER MINIJUEGO ⚡' : '🎮 MINIJUEGO';
    }
    document.getElementById('mg-title').textContent = mg?.name || 'Minijuego';
    document.getElementById('mg-subtitle').textContent = mg?.desc || 'Prepárate...';

    let count = data.countdown || 5;
    const countEl = document.getElementById('mg-countdown');
    if(countEl) countEl.textContent = count;
    
    const interval = setInterval(() => {
      count--;
      if(countEl) countEl.textContent = count;
      Audio.pop();
      if (count <= 0) {
        clearInterval(interval);
        overlay.classList.remove('active');
        startMinigameCanvas(data, mg);
      }
    }, 1000);
  }

  function startMinigameCanvas(data, mgData) {
    const screen = document.getElementById('mg-game-screen');
    if(screen) screen.classList.add('active');
    document.getElementById('mg-game-name').textContent = mgData?.name || 'Minijuego';

    const playerList = window._gameState?.players ? Object.values(window._gameState.players) : [];

    mgEngine = new MinigameEngine(
      'mg-canvas',
      socket.id,
      playerList.length > 0 ? playerList : [{ id: socket.id, username: user?.username || 'Tú', animal: myAnimal || 'leon' }],
      mgData || { id: data.minigameId, type: 'tap', dur: 20, name: 'Minijuego' },
      (results) => {
        if(screen) screen.classList.remove('active');
        showMinigameResult(results, mgData);
      }
    );
    mgEngine.start();
  }

  function showMinigameResult(results, mgData) {
    const overlay = document.getElementById('result-overlay');
    if(!overlay) return;
    overlay.classList.add('active');

    const players = window._gameState?.players || {};
    const winner = players[results.winner];
    document.getElementById('result-trophy').textContent = results.winner === socket.id ? '🏆' : '😢';
    document.getElementById('result-title').textContent = results.winner === socket.id ? '¡Ganaste!' : '¡Fin!';

    const list = document.getElementById('result-list');
    if(list) {
        list.innerHTML = `<li class="result-item first"><span class="result-name">${winner?.username || 'Ganador'}</span></li>`;
    }

    if (Object.keys(players)[0] === socket.id) socket.emit('minigame_result', results);
    if (results.winner === socket.id) Audio.win(); else Audio.lose();
  }

  function continueGame() {
    const resOver = document.getElementById('result-overlay');
    if(resOver) resOver.classList.remove('active');
    if (mgEngine) { mgEngine.stop?.(); mgEngine = null; }
  }

  // ── FIN DE PARTIDA ────────────────────────────────────────
  function showGameOver(data) {
    showScreen('screen-gameover');
    const rankEl = document.getElementById('final-rank');
    if(!rankEl) return;
    rankEl.innerHTML = '';
    data.ranking.forEach((p, i) => {
      const div = document.createElement('div');
      div.className = `rank-row rank-${i+1}`;
      div.innerHTML = `<span>${i+1}. ${p.username} - ⭐${p.superBananas}</span>`;
      rankEl.appendChild(div);
    });
    if (data.ranking[0]?.id === socket.id) Audio.win(); else Audio.lose();
  }

  function backToLobby() {
    currentGame = null; currentLobby = null;
    boardRender = null;
    const canvas = document.getElementById('game-canvas');
    if(canvas) canvas.style.display = 'none';
    showScreen('screen-lobby');
    refreshLobbyUI();
  }

  // ── INIT & SOCKET ─────────────────────────────────────────
  function init() {
    Audio.init();
    socket = io();

    socket.on('auth_result', res => {
      if (res.ok && res.user) {
        user = res.user;
        refreshLobbyUI();
        showScreen('screen-lobby');
        toast(`¡Hola ${user.username}!`, 'ok');
      } else {
        toast(res.msg || 'Error', 'err');
      }
    });

    socket.on('lobby_created', data => {
      currentLobby = data.lobbyId;
      clearInterval(queueInterval);
      showScreen('screen-charsel');
      renderCharSel(data.players);
    });

    socket.on('game_start', data => {
      window._gameState = data;
      initGame(data);
    });

    socket.on('player_moved', data => {
      if (window._gameState?.players?.[data.playerId]) {
        window._gameState.players[data.playerId].position = data.newPos;
        window._gameState.players[data.playerId].bananas = data.bananas;
      }
      onPlayerMoved(data);
      updateHUD(window._gameState);
    });

    socket.on('minigame_incoming', data => showMinigameIncoming(data));

    socket.on('round_ready', data => {
      console.log(">>> Volviendo al tablero...");
      if (mgEngine) { try { mgEngine.stop(); } catch(e){} mgEngine = null; }

      if (data && data.players) {
          currentGame = currentGame || {};
          currentGame.players = data.players;
          if (window._gameState) window._gameState.players = data.players;
      }

      if (boardRender) boardRender.players = data.players;

      showScreen('screen-game');
      // Actualizar turno y HUD
      if (typeof updateTurnUI === 'function') updateTurnUI(data.activePlayer);
      updateHUD(data);
      
      if (user && data.players[socket.id]) {
          user.palmeras = data.players[socket.id].palmeras;
          const pEl = document.getElementById('u-palmeras');
          if(pEl) pEl.textContent = user.palmeras;
      }
    });

    socket.on('game_over', data => showGameOver(data));
  }

  return {
    init, showAuth, showScreen, switchTab,
    doLogin, doRegister, logout,
    joinQueue, leaveQueue,
    selectAnimal, rollDice,
    continueGame, backToLobby
  };
})();

// Iniciar
G.init();

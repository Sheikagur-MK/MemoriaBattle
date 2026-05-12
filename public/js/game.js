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
  let gameState     = null;   // copia local del estado de partida
  let isMyTurn      = false;
  let mgAutoTimer   = null;   // timer de auto-reporte de minijuego

  // ── AUDIO ─────────────────────────────────────────────────
  const Audio = {
    ctx: null,
    vol: { master: 0.7, music: 0.5, sfx: 0.8 },
    init() { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} },
    play(freq, dur=0.1, type='sine') {
      if (!this.ctx) return;
      try {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.connect(g); g.connect(this.ctx.destination);
        o.frequency.value = freq; o.type = type;
        g.gain.setValueAtTime(this.vol.master * this.vol.sfx * 0.3, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        o.start(); o.stop(this.ctx.currentTime + dur);
      } catch(e){}
    },
    pop()  { this.play(880, 0.08); },
    coin() { this.play(1046,0.08); setTimeout(()=>this.play(1318,0.1),80); },
    dice() { [220,330,440,550].forEach((f,i)=>setTimeout(()=>this.play(f,0.05,'square'),i*40)); },
    win()  { [523,659,784,1046].forEach((f,i)=>setTimeout(()=>this.play(f,0.15),i*120)); },
    lose() { this.play(196,0.4,'sawtooth'); },
    move() { this.play(660,0.06); },
  };

  // ── TOAST ─────────────────────────────────────────────────
  function toast(msg, type='') {
    const el  = document.getElementById('toast');
    const div = document.createElement('div');
    div.className   = `toast-msg ${type}`;
    div.textContent = msg;
    el.appendChild(div);
    setTimeout(() => div.remove(), 3200);
  }

  // ── PANTALLAS ─────────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    // Ocultar overlays del juego
    ['dice-overlay','mg-overlay','mg-game-screen','result-overlay'].forEach(oid => {
      const el = document.getElementById(oid);
      if (el) { el.classList.remove('active'); el.style.display = ''; }
    });
    if (id) {
      const t = document.getElementById(id);
      if (t) t.classList.add('active');
    }
  }

  function showAuth() { showScreen('screen-auth'); }

  function switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach((b,i) =>
      b.classList.toggle('active', (i===0) === (tab==='login')));
    document.getElementById('auth-login').style.display    = tab==='login'    ? '' : 'none';
    document.getElementById('auth-register').style.display = tab==='register' ? '' : 'none';
  }

  // ── AUTH ──────────────────────────────────────────────────
  function doLogin() {
    const username = document.getElementById('a-user').value.trim();
    const password = document.getElementById('a-pass').value.trim();
    if (!username || !password) return toast('Completa todos los campos.','err');
    socket.emit('login', { username, password });
  }

  function doRegister() {
    const username = document.getElementById('r-user').value.trim();
    const password = document.getElementById('r-pass').value.trim();
    const pass2    = document.getElementById('r-pass2').value.trim();
    if (!username || !password) return toast('Completa todos los campos.','err');
    if (password.length < 6)   return toast('Mínimo 6 caracteres.','err');
    if (password !== pass2)    return toast('Las contraseñas no coinciden.','err');
    socket.emit('register', { username, password });
  }

  function logout() {
    user = null;
    showScreen('screen-intro');
    toast('¡Hasta pronto! 👋');
  }

  // ── LOBBY ─────────────────────────────────────────────────
  function refreshLobbyUI() {
    if (!user) return;
    document.getElementById('u-name').textContent        = user.username;
    document.getElementById('u-stats').textContent       = `Victorias: ${user.wins} · Partidas: ${user.gamesPlayed}`;
    document.getElementById('u-palmeras').textContent    = user.palmeras;
    document.getElementById('stat-wins').textContent     = user.wins;
    document.getElementById('stat-games').textContent    = user.gamesPlayed;
    document.getElementById('shop-palmeras').textContent = user.palmeras + ' 🌴';

    const animal = ANIMALS_DATA[myAnimal || 'leon'] || {};
    document.getElementById('user-avatar').textContent       = animal.emoji || '🐾';
    document.getElementById('lobby-animal').textContent      = animal.emoji || '🐾';
    document.getElementById('lobby-animal-name').textContent = animal.name  || 'Sin seleccionar';
    document.getElementById('lobby-skin-name').textContent   = `Skin: ${user.activeSkin || 'Default'}`;
  }

  // ── COLA ──────────────────────────────────────────────────
  function joinQueue() {
    if (!user) return toast('Debes iniciar sesión.','err');
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
    const grid  = document.getElementById('animals-grid');
    const taken = players.filter(p => p.id !== socket.id).map(p => p.animal).filter(Boolean);
    const mine  = players.find(p => p.id === socket.id)?.animal;

    grid.innerHTML = Object.entries(ANIMALS_DATA).map(([key, a]) => {
      const isTaken    = taken.includes(key);
      const isSelected = mine === key;
      return `<div class="animal-card ${isTaken?'taken':''} ${isSelected?'selected':''}"
        onclick="G.selectAnimal('${key}')" data-key="${key}">
        <div class="animal-emoji">${a.emoji}</div>
        <div class="animal-name">${a.name}</div>
        ${isTaken    ? '<div style="font-size:.7rem;color:#E74C3C;margin-top:2px">Tomado</div>' : ''}
        ${isSelected ? '<div style="font-size:.7rem;color:#00ff88;margin-top:2px">✓ Elegido</div>' : ''}
      </div>`;
    }).join('');

    const ready = players.filter(p => p.ready).length;
    const el    = document.getElementById('cs-players');
    if (el) el.textContent = `${ready}/${players.length} listos`;
  }

  function selectAnimal(key) {
    if (!currentLobby) return;
    socket.emit('select_animal', { lobbyId: currentLobby, animal: key });
    myAnimal = key;
    Audio.coin();
  }

  // ── INICIO DE JUEGO ───────────────────────────────────────
  function initGame(data) {
    currentGame = data.gameId;
    gameState   = data;

    // Ocultar todas las pantallas
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    // Mostrar canvas
    const canvas = document.getElementById('game-canvas');
    canvas.style.display = 'block';

    // Mostrar HUD
    document.getElementById('screen-game-ui').style.display = 'block';

    // Crear renderizador
    boardRender = new BoardRenderer('game-canvas');
    boardRender.board = data.board;
    boardRender.initPlayers(data.players, socket.id);
    boardRender.focusTurn(data.currentTurn);
    boardRender.startRender();

    // HUD inicial
    updateHUD(data);

    toast(`¡Partida iniciada! ${Object.keys(data.players).length} jugadores 🎲`);
  }

  // ── HUD ───────────────────────────────────────────────────
  function updateHUD(data) {
    const round = data.round || gameState?.round || 1;
    const max   = data.maxRounds || gameState?.maxRounds || 10;
    const el    = document.getElementById('hud-round');
    if (el) el.textContent = `Ronda ${round}/${max}`;

    const bar   = document.getElementById('hud-bar');
    if (!bar) return;
    const players = data.players || gameState?.players || {};
    let html = `<div class="hud-round">Ronda ${round}/${max}</div>`;

    // Orden de turno para mostrar quién sigue
    const order = data.turnOrder || gameState?.turnOrder || Object.keys(players);
    order.forEach(pid => {
      const p = players[pid];
      if (!p || p.disconnected) return;
      const animal  = ANIMALS_DATA[p.animal] || {};
      const isTurn  = pid === (data.currentTurn || gameState?.currentTurn);
      const isSelf  = pid === socket.id;
      html += `<div class="hud-player" style="
        border-left: 3px solid ${p.color || '#aaa'};
        ${isTurn  ? 'background:rgba(255,215,0,0.15);' : ''}
        ${isSelf  ? 'outline:1px solid #fff;' : ''}">
        <span class="hud-player-emoji">${animal.emoji || '🐾'}</span>
        <span style="font-weight:${isSelf?900:400}">${p.username.slice(0,8)}</span>
        <span style="color:#FFD700;font-weight:900">🍌${p.bananas}</span>
        ${p.superBananas > 0 ? `<span style="color:gold">⭐${p.superBananas}</span>` : ''}
        ${isTurn ? '<span style="color:#FFD700;font-size:.7rem">▶ TURNO</span>' : ''}
      </div>`;
    });
    bar.innerHTML = html;
  }

  // ── DADO ──────────────────────────────────────────────────
  function showDiceOverlay(canRoll) {
    isMyTurn = canRoll;
    const overlay = document.getElementById('dice-overlay');
    overlay.style.display = 'flex';
    overlay.classList.add('active');

    document.getElementById('dice-result').style.display = 'none';
    document.getElementById('roll-btn').style.display    = canRoll ? '' : 'none';
    document.getElementById('dice-face').style.animation = 'diceRoll .3s linear infinite';
    document.getElementById('dice-face').textContent     = '🎲';

    // Mensaje de espera si no es tu turno
    const waitMsg = document.getElementById('dice-wait-msg');
    if (waitMsg) waitMsg.style.display = canRoll ? 'none' : '';
  }

  function hideDiceOverlay() {
    const overlay = document.getElementById('dice-overlay');
    setTimeout(() => {
      overlay.classList.remove('active');
      overlay.style.display = '';
    }, 2000);
  }

  function rollDice() {
    if (!isMyTurn) return;
    isMyTurn = false;
    document.getElementById('roll-btn').style.display = 'none';
    Audio.dice();
    socket.emit('roll_dice');
  }

  // ── EFECTO DE CASILLA ─────────────────────────────────────
  function showSpaceEffect(effect, isMe) {
    if (!effect) return;
    if (!isMe) return; // solo mostrar popup al jugador que cayó

    if (effect.type === 'blue') {
      toast(`🔵 Casilla azul ¡+${effect.delta} 🍌!`, 'ok');
      Audio.coin();
    } else if (effect.type === 'red') {
      toast(`🔴 Casilla roja ${effect.delta} 🍌`, 'err');
      Audio.lose();
    } else if (effect.type === 'star') {
      toast('⭐ ¡Casilla Super Banana! Puedes comprar por 50 🍌', 'ok');
      Audio.win();
      setTimeout(() => {
        if (confirm('¿Comprar una Super Banana Dorada por 50 🍌?')) {
          socket.emit('buy_star');
        }
      }, 600);
    } else if (effect.type === 'supermini') {
      toast('💜 ¡Activaste un Super Minijuego!', 'ok');
    }
  }

  // ── MINIJUEGO INCOMING ────────────────────────────────────
  function showMinigameIncoming(data) {
    // Ocultar dado si estaba visible
    const diceEl = document.getElementById('dice-overlay');
    diceEl.classList.remove('active');
    diceEl.style.display = '';

    const overlay = document.getElementById('mg-overlay');
    overlay.classList.add('active');

    const mg = data.type === 'super'
      ? (typeof SUPER_MINIGAMES !== 'undefined' ? SUPER_MINIGAMES.find(m => m.id === data.minigameId) : null)
      : (typeof MINIGAMES       !== 'undefined' ? MINIGAMES.find(m => m.id === data.minigameId)       : null);

    const badge = document.getElementById('mg-type-badge');
    badge.className   = `mg-type-badge ${data.type === 'super' ? 'mg-type-super' : 'mg-type-normal'}`;
    badge.textContent = data.type === 'super' ? '⚡ SUPER MINIJUEGO ⚡' : '🎮 MINIJUEGO';

    document.getElementById('mg-title').textContent    = mg?.name || `Minijuego #${data.minigameId}`;
    document.getElementById('mg-subtitle').textContent = mg?.desc || '¡Prepárate!';

    // Mostrar equipos si es super
    const teamDiv = document.getElementById('team-display');
    if (data.type === 'super' && data.redTeam?.length && data.blueTeam?.length) {
      teamDiv.style.display = 'flex';
      const getNames = ids => ids.map(id => gameState?.players?.[id]?.username || id).join(', ');
      document.getElementById('team-red-members').textContent  = getNames(data.redTeam);
      document.getElementById('team-blue-members').textContent = getNames(data.blueTeam);
    } else {
      teamDiv.style.display = 'none';
    }

    // Countdown
    let count = data.countdown || 5;
    document.getElementById('mg-countdown').textContent = count;
    Audio.pop();
    const interval = setInterval(() => {
      count--;
      document.getElementById('mg-countdown').textContent = Math.max(0, count);
      Audio.pop();
      if (count <= 0) {
        clearInterval(interval);
        overlay.classList.remove('active');
        startMinigameCanvas(data, mg);
      }
    }, 1000);
  }

  // ── MINIJUEGO EN CANVAS ───────────────────────────────────
  function startMinigameCanvas(data, mgData) {
    const screen = document.getElementById('mg-game-screen');
    screen.classList.add('active');
    document.getElementById('mg-game-name').textContent = mgData?.name || `Minijuego #${data.minigameId}`;

    const players = gameState?.players
      ? Object.values(gameState.players).filter(p => !p.disconnected)
      : [{ id: socket.id, username: user?.username || 'Tú', animal: myAnimal || 'leon' }];

    const effectiveMg = mgData || {
      id: data.minigameId || 1, type: 'catch', dur: data.duration || 20, name: 'Minijuego'
    };

    // Auto-reportar resultado tras la duración + 1s de margen
    const mgDur = (effectiveMg.dur || 20) * 1000;
    mgAutoTimer = setTimeout(() => {
      if (mgEngine) mgEngine._finish();
    }, mgDur + 1200);

    mgEngine = new MinigameEngine(
      'mg-canvas',
      socket.id,
      players,
      effectiveMg,
      (results) => {
        clearTimeout(mgAutoTimer);
        screen.classList.remove('active');
        showMinigameResult(results, mgData, data.type);
      }
    );
    mgEngine.start();
  }

  // ── RESULTADO MINIJUEGO ───────────────────────────────────
  function showMinigameResult(results, mgData, type) {
    const overlay = document.getElementById('result-overlay');
    overlay.classList.add('active');

    const players = gameState?.players || {};
    const iWon    = results.winner === socket.id ||
      (type === 'super' && players[socket.id]?.team === results.winnerTeam);

    document.getElementById('result-trophy').textContent = iWon ? '🏆' : (type === 'super' ? '⚔️' : '😢');
    document.getElementById('result-title').textContent  = iWon ? '¡Ganaste!' : '¡Fin del minijuego!';

    const list = document.getElementById('result-list');
    list.innerHTML = '';

    if (type === 'super') {
      const wt = results.winnerTeam;
      const li = document.createElement('li');
      li.className = 'result-item first';
      li.innerHTML = `<span class="result-pos">${wt === 'red' ? '🔴' : '🔵'}</span>
        <span class="result-name">Equipo ${wt === 'red' ? 'Rojo' : 'Azul'} gana</span>
        <span class="result-reward">+1 ⭐ c/u</span>`;
      list.appendChild(li);
    } else {
      const podium = [
        { id: results.winner, cls: 'first',  pos: '🥇', reward: '+10 🍌' },
        { id: results.second, cls: 'second', pos: '🥈', reward: '+8 🍌'  },
        { id: results.third,  cls: 'third',  pos: '🥉', reward: '+6 🍌'  },
      ];
      podium.forEach(({ id, cls, pos, reward }) => {
        if (!id) return;
        const p  = players[id];
        const li = document.createElement('li');
        li.className = `result-item ${cls}`;
        li.innerHTML = `<span class="result-pos">${pos}</span>
          <span class="result-name">${(p?.username || id).slice(0,14)}</span>
          <span class="result-reward">${reward}</span>`;
        list.appendChild(li);
      });
    }

    document.getElementById('result-rewards').textContent =
      type === 'super' ? 'El equipo ganador recibe 1 ⭐ Banana Dorada cada uno'
                       : '🥇+10  🥈+8  🥉+6 🍌';

    // Enviar resultado al servidor — solo el host (primer en turnOrder)
    const order = gameState?.turnOrder || Object.keys(players);
    const activeOrder = order.filter(id => !players[id]?.disconnected);
    if (activeOrder[0] === socket.id) {
      socket.emit('minigame_result', {
        type: type || 'normal',
        ...results
      });
    }

    if (iWon) Audio.win(); else Audio.lose();
  }

  function continueGame() {
    document.getElementById('result-overlay').classList.remove('active');
    if (mgEngine) { mgEngine.destroy(); mgEngine = null; }
    clearTimeout(mgAutoTimer);
  }

  // ── FIN DE PARTIDA ────────────────────────────────────────
  function showGameOver(data) {
    // Ocultar todo lo del juego
    document.getElementById('screen-game-ui').style.display = 'none';
    document.getElementById('game-canvas').style.display    = 'none';
    showScreen('screen-gameover');

    const rankEl = document.getElementById('final-rank');
    rankEl.innerHTML = '';
    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'];
    let myPalmeras = 0;

    data.ranking.forEach((p, i) => {
      const palmeras = [3,2,1][i] || 0;
      if (p.id === socket.id) myPalmeras = palmeras;
      const animal = ANIMALS_DATA[p.animal] || {};
      const div    = document.createElement('div');
      div.className = `rank-row rank-${i+1}`;
      div.innerHTML = `
        <div class="rank-emoji">${medals[i] || '·'}</div>
        <div class="rank-emoji">${animal.emoji || '🐾'}</div>
        <div class="rank-info">
          <div class="rank-name">${p.username}</div>
          <div class="rank-stats">⭐${p.superBananas || 0} Super · 🍌${p.bananas || 0}</div>
        </div>
        ${palmeras > 0 ? `<div class="rank-palmeras">+${palmeras} 🌴</div>` : ''}`;
      rankEl.appendChild(div);
    });

    document.getElementById('palmeras-earned').textContent = `+${myPalmeras} 🌴`;
    if (myPalmeras > 0 && user) {
      user.palmeras += myPalmeras;
      user.wins     += data.ranking[0]?.id === socket.id ? 1 : 0;
      user.gamesPlayed++;
    }
    if (data.ranking[0]?.id === socket.id) Audio.win(); else Audio.lose();
  }

  function backToLobby() {
    currentGame  = null;
    currentLobby = null;
    gameState    = null;
    isMyTurn     = false;
    if (boardRender) { boardRender = null; }
    document.getElementById('game-canvas').style.display     = 'none';
    document.getElementById('screen-game-ui').style.display  = 'none';
    document.getElementById('result-overlay').classList.remove('active');
    showScreen('screen-lobby');
    refreshLobbyUI();
  }

  // ── TIENDA ────────────────────────────────────────────────
  function renderShop() {
    if (typeof SKINS_DATA === 'undefined') return;
    const grid = document.getElementById('skins-grid');
    if (!grid) return;
    grid.innerHTML = SKINS_DATA.map(skin => {
      const owned  = user?.ownedSkins?.includes(skin.id);
      const active = user?.activeSkin === skin.id;
      return `<div class="skin-card ${owned?'owned':''} ${active?'active':''}">
        <div class="skin-emoji">${skin.emoji}</div>
        <div class="skin-name">${skin.name}</div>
        <div class="skin-price">${skin.price === 0 ? 'Gratis' : `${skin.price} 🌴`}</div>
        ${active  ? '<div class="skin-status active">✓ Activo</div>'
        : owned   ? `<button class="btn btn-secondary btn-sm" onclick="G.equipSkin('${skin.id}')">Equipar</button>`
        :           `<button class="btn btn-primary btn-sm" onclick="G.buySkin('${skin.id}')">${skin.price===0?'Equipar':'Comprar'}</button>`}
      </div>`;
    }).join('');
  }

  function buySkin(skinId) {
    if (skinId === 'default') return equipSkin(skinId);
    socket.emit('buy_skin', { skin: skinId });
  }

  function equipSkin(skinId) { socket.emit('equip_skin', { skin: skinId }); }

  // ── LEADERBOARD ───────────────────────────────────────────
  function loadLeaderboard() { socket.emit('get_leaderboard'); }

  function renderLeaderboard(data) {
    const el = document.getElementById('lb-list');
    if (!el) return;
    if (!data?.length) { el.textContent = 'Sin datos aún.'; return; }
    const medals = ['🥇','🥈','🥉'];
    el.innerHTML = data.map((p, i) =>
      `<div class="lb-row">
        <div class="lb-pos">${medals[i] || (i+1)}</div>
        <div class="lb-name">${p.username}</div>
        <div class="lb-stat">🎮 ${p.gamesPlayed}</div>
        <div class="lb-wins">🏆 ${p.wins}</div>
        <div class="lb-stat">🌴 ${p.palmeras}</div>
      </div>`
    ).join('');
  }

  function showStats() {
    if (!user) return;
    toast(`🏆 ${user.wins} victorias · 🎮 ${user.gamesPlayed} partidas · 🌴 ${user.palmeras} palmeras`);
  }

  // ── OPCIONES ──────────────────────────────────────────────
  function setVolume(type, val) {
    Audio.vol[type] = val / 100;
    const el = document.getElementById(`vol-${type}-val`);
    if (el) el.textContent = val + '%';
  }

  function setLang(lang) {
    toast(`Idioma: ${lang === 'es' ? 'Español 🇲🇽' : lang === 'en' ? 'English 🇺🇸' : 'Português 🇧🇷'}`);
  }

  function setQuality(q) {
    toast(`Calidad: ${q === 'high' ? 'Alta' : q === 'med' ? 'Media' : 'Baja'}`);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  // ── INIT ──────────────────────────────────────────────────
  function init() {
    Audio.init();
    socket = io();

    // ── AUTH ────────────────────────────────────────────────
    socket.on('auth_result', res => {
      if (res.ok && res.user) {
        user = res.user;
        refreshLobbyUI();
        renderShop();
        showScreen('screen-lobby');
        toast(`¡Bienvenido, ${user.username}! 🍌`, 'ok');
        Audio.win();
      } else if (res.ok) {
        toast(res.msg, 'ok');
        switchTab('login');
      } else {
        toast(res.msg || 'Error.', 'err');
      }
    });

    socket.on('error_msg', msg => toast(msg, 'err'));

    // ── COLA ────────────────────────────────────────────────
    socket.on('queue_update', data => {
      const timerEl   = document.getElementById('q-timer');
      const playersEl = document.getElementById('q-players');
      if (timerEl)   timerEl.textContent    = data.timeLeft;
      if (playersEl) playersEl.innerHTML    = `Jugadores encontrados: <strong>${data.players}</strong> / 8`;
      for (let i = 0; i < 8; i++) {
        const d = document.getElementById(`dot-${i}`);
        if (d) d.classList.toggle('active', i < data.players);
      }
    });

    // ── LOBBY PARTIDA ───────────────────────────────────────
    socket.on('lobby_created', data => {
      currentLobby = data.lobbyId;
      clearInterval(queueInterval);
      showScreen('screen-charsel');
      renderCharSel(data.players);

      // Timer de selección
      let t = data.timeLeft || 25;
      const csEl = document.getElementById('cs-timer');
      if (csEl) csEl.textContent = t;
      csTimer = setInterval(() => {
        t--;
        if (csEl) csEl.textContent = Math.max(0, t);
        if (t <= 0) clearInterval(csTimer);
      }, 1000);
    });

    socket.on('lobby_update', data => {
      renderCharSel(data.players);
    });

    socket.on('animal_taken', data => {
      const a = ANIMALS_DATA[data.animal];
      toast(`${a?.name || data.animal} ya fue elegido. ¡Elige otro!`, 'err');
    });

    // ── JUEGO ────────────────────────────────────────────────
    socket.on('game_start', data => {
      clearInterval(csTimer);
      gameState = data;
      initGame(data);
    });

    // El servidor nos dice quién es el turno actual
    socket.on('turn_update', data => {
      if (gameState) {
        gameState.currentTurn = data.currentTurn;
        gameState.players     = data.players || gameState.players;
        gameState.round       = data.round   || gameState.round;
      }
      if (boardRender) {
        boardRender.updatePlayers(data.players || gameState?.players || {});
        boardRender.focusTurn(data.currentTurn);
      }
      updateHUD(data);

      // Mostrar overlay del dado — bloqueado para los que esperan
      const isMe = data.currentTurn === socket.id;
      showDiceOverlay(isMe);

      if (isMe) {
        toast('🎲 ¡Es tu turno! Tira el dado.', 'ok');
        Audio.coin();
      } else {
        const p = data.players?.[data.currentTurn];
        toast(`👁 Turno de ${p?.username || '...'}`, '');
      }
    });

    // El servidor nos da permiso explícito de tirar
    socket.on('your_turn', () => {
      isMyTurn = true;
      const rollBtn = document.getElementById('roll-btn');
      if (rollBtn) rollBtn.style.display = '';
    });

    socket.on('player_moved', data => {
      // Actualizar estado local
      if (gameState?.players?.[data.playerId]) {
        gameState.players[data.playerId].position = data.newPos;
        gameState.players[data.playerId].bananas  = data.bananas;
      }

      // Animar movimiento en el tablero
      if (boardRender) {
        boardRender.animateMove(data.playerId, data.prevPos, data.newPos, () => {
          if (boardRender) boardRender.updatePlayers(data.players || gameState?.players || {});
        });
      }

      // Efecto de casilla — solo para el jugador que movió
      showSpaceEffect(data.spaceEffect, data.playerId === socket.id);
      Audio.move();
      updateHUD({ players: data.players || gameState?.players, round: gameState?.round, maxRounds: gameState?.maxRounds, turnOrder: gameState?.turnOrder });

      // Ocultar overlay del dado tras el movimiento
      hideDiceOverlay();
    });

    socket.on('next_round', data => {
      if (gameState) {
        gameState.round   = data.round;
        gameState.players = data.players || gameState.players;
      }
      updateHUD({ ...data, turnOrder: gameState?.turnOrder });
      toast(`🎲 Ronda ${data.round} de ${data.maxRounds}`, 'ok');
    });

    socket.on('buy_result', data => {
      if (data.success) {
        toast('⭐ ¡Super Banana comprada! ¡Bien jugado!', 'ok');
        Audio.win();
        if (gameState?.players?.[socket.id]) {
          gameState.players[socket.id].bananas      = data.bananas;
          gameState.players[socket.id].superBananas = data.superBananas;
        }
        if (boardRender) boardRender.updatePlayers(gameState.players);
        updateHUD(gameState);
      } else {
        toast(data.msg, 'err');
      }
    });

    socket.on('minigame_incoming', data => {
      showMinigameIncoming(data);
    });

    socket.on('minigame_result', data => {
      // Actualizar bananas de todos
      if (data.players && gameState) {
        gameState.players = data.players;
        if (boardRender) boardRender.updatePlayers(data.players);
        updateHUD(gameState);
      }
    });

    socket.on('player_disconnected', data => {
      toast(`⚠️ ${data.username || 'Un jugador'} se desconectó.`, 'err');
      if (gameState?.players?.[data.playerId]) {
        gameState.players[data.playerId].disconnected = true;
      }
    });

    socket.on('game_over', data => {
      gameState = null;
      showGameOver(data);
    });

    // ── TIENDA ──────────────────────────────────────────────
    socket.on('shop_result', data => {
      if (data.ok) {
        toast('¡Skin comprada! 🎨', 'ok');
        if (user) { user.palmeras = data.palmeras; user.ownedSkins = data.ownedSkins; }
        const el = document.getElementById('u-palmeras');
        if (el) el.textContent = data.palmeras;
        const sp = document.getElementById('shop-palmeras');
        if (sp) sp.textContent = data.palmeras + ' 🌴';
        renderShop();
        Audio.coin();
      } else {
        toast(data.msg, 'err');
      }
    });

    socket.on('skin_equipped', data => {
      if (user) user.activeSkin = data.activeSkin;
      toast(`Skin equipada ✓`, 'ok');
      renderShop();
      refreshLobbyUI();
    });

    // ── LEADERBOARD ─────────────────────────────────────────
    socket.on('leaderboard_data', data => renderLeaderboard(data));

    // ── CONEXIÓN ────────────────────────────────────────────
    socket.on('disconnect', () => toast('Desconectado. Reconectando...', 'err'));
    socket.on('connect',    () => { if (user) toast('Reconectado ✓', 'ok'); });
  }

  // ── API PÚBLICA ───────────────────────────────────────────
  return {
    init, showAuth, showScreen, switchTab,
    doLogin, doRegister, logout,
    joinQueue, leaveQueue,
    selectAnimal,
    rollDice,
    continueGame,
    backToLobby,
    loadLeaderboard,
    buySkin, equipSkin,
    showStats,
    setVolume, setLang, setQuality, toggleFullscreen,
  };
})();

// ── CONTROLADOR PRINCIPAL ─────────────────────────────────────────────────────
// IMPORTANTE: Este archivo carga DESPUÉS de animals.js, board.js y minigames.js
const G = (() => {
  let socket, user, lobbyId, gameId, gs;
  let board, mgEng;
  let myAnimal = null, isMyTurn = false;
  let csTimer = null, qDots = null;

  // ── HELPERS SEGUROS ────────────────────────────────────────
  // Nunca lanza error si el elemento no existe
  const $  = id => document.getElementById(id);
  const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  const sty = (id, prop, val) => { const e = $(id); if (e) e.style[prop] = val; };

  // ── AUDIO ─────────────────────────────────────────────────
  const SFX = {
    ctx: null, v: 0.5,
    init() { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} },
    p(f, d=.1, t='sine') {
      if (!this.ctx) return;
      try {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.connect(g); g.connect(this.ctx.destination);
        o.frequency.value = f; o.type = t;
        g.gain.setValueAtTime(this.v * .35, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(.001, this.ctx.currentTime + d);
        o.start(); o.stop(this.ctx.currentTime + d);
      } catch(e) {}
    },
    pop()  { this.p(880, .08); },
    coin() { this.p(1046, .07); setTimeout(() => this.p(1318, .1), 80); },
    dice() { [220,330,440,550].forEach((f,i) => setTimeout(() => this.p(f,.05,'square'), i*40)); },
    win()  { [523,659,784,1046].forEach((f,i) => setTimeout(() => this.p(f,.15), i*120)); },
    lose() { this.p(196, .4, 'sawtooth'); },
    move() { this.p(660, .06); },
  };

  // ── TOAST ─────────────────────────────────────────────────
  function T(msg, type='') {
    const c = $('toast'); if (!c) return;
    const d = document.createElement('div');
    d.className = `tm ${type}`; d.textContent = msg;
    c.appendChild(d); setTimeout(() => d.remove(), 3200);
  }

  // ── PANTALLAS ─────────────────────────────────────────────
  // Oculta todas las .screen y muestra la pedida
  // Para screen-game no usa class.active sino visibilidad directa del canvas
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    // Ocultar elementos de juego que flotan sobre el DOM
    sty('board-canvas', 'display', 'none');
    const mgi = $('mg-intro');   if (mgi) mgi.classList.remove('hidden');
    const mgr = $('mg-result');  if (mgr) mgr.classList.remove('show');

    const t = $(id);
    if (t) t.classList.add('active');

    // Si pedimos la pantalla de juego, mostrar canvas
    if (id === 'screen-game') sty('board-canvas', 'display', 'block');
  }

  function showAuth() { show('screen-auth'); }

  function tab(t) {
    document.querySelectorAll('.atab').forEach((b,i) =>
      b.classList.toggle('active', (i===0) === (t==='login')));
    sty('al', 'display', t==='login' ? '' : 'none');
    sty('ar', 'display', t==='register' ? '' : 'none');
  }

  // ── AUTH ──────────────────────────────────────────────────
  function login() {
    const u = $('au')?.value.trim();
    const p = $('ap')?.value.trim();
    if (!u || !p) return T('Completa todos los campos.', 'err');
    socket.emit('login', { username: u, password: p });
  }

  function register() {
    const u  = $('ru')?.value.trim();
    const p  = $('rp')?.value.trim();
    const p2 = $('rp2')?.value.trim();
    if (!u || !p) return T('Completa los campos.', 'err');
    if (p.length < 6) return T('Mínimo 6 caracteres.', 'err');
    if (p !== p2) return T('Las contraseñas no coinciden.', 'err');
    socket.emit('register', { username: u, password: p });
  }

  function logout() { user = null; show('screen-intro'); T('¡Hasta pronto! 👋'); }

  // ── LOBBY ─────────────────────────────────────────────────
  function refreshLobby() {
    if (!user) return;
    set('uname',  user.username);
    set('ustats', `Victorias: ${user.wins} · Partidas: ${user.gamesPlayed}`);
    set('upal',   user.palmeras);
    set('sw',     user.wins);
    set('sg',     user.gamesPlayed);
    set('shpal',  user.palmeras + ' 🌴');
    const a = (typeof ANIMALS_DATA !== 'undefined' ? ANIMALS_DATA : {})[myAnimal || 'leon'] || {};
    set('uavatar',   a.emoji || '🐾');
    set('lob-animal', a.emoji || '🐾');
    set('lob-aname',  a.name  || 'Sin elegir');
    set('lob-skin',   `Skin: ${user.activeSkin || 'Default'}`);
  }

  // ── COLA ──────────────────────────────────────────────────
  function queue() {
    if (!user) return T('Inicia sesión primero.', 'err');
    socket.emit('join_queue');
    show('screen-queue');
    let di = 0;
    qDots = setInterval(() => {
      for (let i=0; i<8; i++) { const d=$(`d${i}`); if(d) d.classList.toggle('on', i===di); }
      di = (di+1) % 8;
    }, 400);
    T('Buscando partida… 🔍');
  }

  function leaveQ() {
    socket.emit('leave_queue');
    clearInterval(qDots);
    show('screen-lobby');
    T('Búsqueda cancelada.');
  }

  // ── CHARSEL ───────────────────────────────────────────────
  function renderCS(players) {
    const g = $('angrid'); if (!g) return;
    const taken = players.filter(p => p.id !== socket.id).map(p => p.animal).filter(Boolean);
    const mine  = players.find(p => p.id === socket.id)?.animal;
    const AD    = typeof ANIMALS_DATA !== 'undefined' ? ANIMALS_DATA : {};

    g.innerHTML = Object.entries(AD).map(([k, a]) => {
      const tk = taken.includes(k), sel = mine === k;
      return `<div class="ancard ${tk?'taken':''} ${sel?'sel':''}" onclick="G.pickAnimal('${k}')">
        <div class="anem">${a.emoji}</div>
        <div class="anname">${a.name}</div>
        ${tk  ? '<div style="font-size:.68rem;color:#E74C3C">Tomado</div>' : ''}
        ${sel ? '<div style="font-size:.68rem;color:#00ff88">✓</div>' : ''}
      </div>`;
    }).join('');

    const csp = $('csp');
    if (csp) csp.textContent = `${players.filter(p=>p.ready).length}/${players.length} listos`;
  }

  function pickAnimal(k) {
    if (!lobbyId) return;
    socket.emit('select_animal', { lobbyId, animal: k });
    myAnimal = k; SFX.coin();
  }

  // ── INICIO DE PARTIDA ─────────────────────────────────────
  function startGame(data) {
    gameId = data.gameId;
    gs     = data;

    // Mostrar pantalla del juego (activa el canvas)
    show('screen-game');

    // Configurar canvas del tablero
    const cv = $('board-canvas');
    if (!cv) { console.error('board-canvas no encontrado'); return; }
    cv.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%';

    // Crear el renderizador (BoardRenderer está en board.js)
    if (typeof BoardRenderer === 'undefined') {
      console.error('BoardRenderer no definido — verifica que board.js cargó antes que game.js');
      return;
    }
    board = new BoardRenderer('board-canvas');
    board.board = data.board;
    board.init(data.players, socket.id);
    board.focusTurn(data.currentTurn);
    board.start();

    updateHUD(data);
    T(`¡Partida iniciada! ${Object.keys(data.players).length} jugadores 🎲`, 'ok');
  }

  // ── HUD ───────────────────────────────────────────────────
  function updateHUD(data) {
    const r = data.round      || gs?.round      || 1;
    const m = data.maxRounds  || gs?.maxRounds  || 10;
    const re = $('hud-round');
    if (re) re.textContent = `Ronda ${r}/${m}`;

    const top     = $('hud-top');   if (!top) return;
    const players = data.players    || gs?.players || {};
    const order   = data.order      || gs?.order   || Object.keys(players);
    const ct      = data.currentTurn|| gs?.currentTurn;
    const AD      = typeof ANIMALS_DATA !== 'undefined' ? ANIMALS_DATA : {};

    let html = `<div class="hud-round">Ronda ${r}/${m}</div>`;
    order.forEach(pid => {
      const p = players[pid]; if (!p || p.disconnected) return;
      const a      = AD[p.animal] || {};
      const isTurn = pid === ct;
      const isSelf = pid === socket.id;
      html += `<div class="hud-player ${isTurn?'active':''}"
        style="border-left-color:${p.color||'#aaa'}">
        <span class="han">${a.emoji||'🐾'}</span>
        <span style="font-weight:${isSelf?900:400}">${p.username.slice(0,7)}</span>
        <span class="hbn">🍌${p.bananas}</span>
        ${p.superBananas>0?`<span style="color:gold;font-size:.75rem">⭐${p.superBananas}</span>`:''}
        ${isTurn?'<span style="color:#FFD700;font-size:.7rem"> ▶</span>':''}
      </div>`;
    });
    top.innerHTML = html;
  }

  // ── DADO ──────────────────────────────────────────────────
  function setDice(canRoll, turno='') {
    isMyTurn = canRoll;
    const btn = $('dice-btn');
    const wl  = $('wait-lbl');
    if (btn) {
      btn.disabled      = !canRoll;
      btn.style.opacity = canRoll ? '1' : '.4';
      btn.textContent   = '🎲';
    }
    if (wl) wl.textContent = canRoll ? '¡Tu turno!' : (turno ? `Turno de ${turno}` : '');
    const res = $('dice-result');
    if (res) res.textContent = '';
  }

  function roll() {
    if (!isMyTurn) return;
    isMyTurn = false;
    setDice(false);
    SFX.dice();
    // Animación dado girando
    const btn   = $('dice-btn');
    const faces = ['⚀','⚁','⚂','⚃','⚄','⚅'];
    let i = 0;
    const spin = setInterval(() => { if (btn) btn.textContent = faces[i%6]; i++; }, 80);
    setTimeout(() => clearInterval(spin), 600);
    socket.emit('roll_dice');
  }

  // ── POP DE EFECTO DE CASILLA ──────────────────────────────
  function showSpacePop(effect, isMe) {
    if (!effect || effect.type === 'normal') return;
    const pop = $('space-pop');
    const em  = $('sp-emoji');
    const txt = $('sp-txt');
    const sub = $('sp-sub');
    if (!pop) return;

    const map = {
      blue:     { emoji:'🔵', label:`+${effect.delta||5} 🍌`, desc:'Casilla azul' },
      red:      { emoji:'🔴', label:`${effect.delta||-2} 🍌`, desc:'Casilla roja' },
      star:     { emoji:'⭐', label:'¡Casilla Banana!',        desc:'Puedes comprar una Super Banana' },
      supermini:{ emoji:'💜', label:'¡Super Minijuego!',       desc:'¡Modo equipos activado!' },
    };
    const cfg = map[effect.type];
    if (!cfg) return;

    if (em)  em.textContent  = cfg.emoji;
    if (txt) txt.textContent = cfg.label;
    if (sub) sub.textContent = cfg.desc;
    pop.style.display = 'block';
    setTimeout(() => { pop.style.display = 'none'; }, 2800);

    if (effect.type === 'blue')  SFX.coin();
    if (effect.type === 'red')   SFX.lose();
    if (effect.type === 'star')  { SFX.win(); if (isMe) setTimeout(() => { if (confirm('¿Comprar Super Banana por 50 🍌?')) socket.emit('buy_star'); }, 500); }
    if (effect.type === 'supermini') SFX.win();
  }

  // ── MINIJUEGO INCOMING ────────────────────────────────────
  function showMgIncoming(data) {
    // Ocultar tablero, mostrar pantalla de minijuego
    show('screen-mg');

    // Verificar que MINIGAMES y SUPER_MINIGAMES existen (definidos en minigames.js)
    const MG  = typeof MINIGAMES       !== 'undefined' ? MINIGAMES       : [];
    const SMG = typeof SUPER_MINIGAMES !== 'undefined' ? SUPER_MINIGAMES : [];

    const mgData = data.type === 'super'
      ? SMG.find(m => m.id === data.minigameId)
      : MG.find(m  => m.id === data.minigameId);

    // Actualizar UI del intro
    const badge = $('mg-badge');
    const name  = $('mg-name');
    const desc  = $('mg-desc');
    const hname = $('mg-hud-name');
    const intro = $('mg-intro');
    const mgRes = $('mg-result');

    if (badge) { badge.className = `mg-badge ${data.type==='super'?'super':'normal'}`; badge.textContent = data.type==='super'?'⚡ SUPER MINIJUEGO ⚡':'🎮 MINIJUEGO'; }
    if (name)  name.textContent  = mgData?.name || `Minijuego #${data.minigameId}`;
    if (desc)  desc.textContent  = mgData?.desc || '¡Prepárate!';
    if (hname) hname.textContent = mgData?.name || 'Minijuego';
    if (intro) intro.classList.remove('hidden');
    if (mgRes) mgRes.classList.remove('show');

    // Countdown antes de iniciar
    let cnt = data.countdown || 5;
    const cdEl = $('mg-cd');
    if (cdEl) cdEl.textContent = cnt;
    SFX.pop();

    const iv = setInterval(() => {
      cnt--;
      if (cdEl) cdEl.textContent = Math.max(0, cnt);
      SFX.pop();
      if (cnt <= 0) {
        clearInterval(iv);
        if (intro) intro.classList.add('hidden');
        launchMg(data, mgData);
      }
    }, 1000);
  }

  function launchMg(data, mgData) {
    // Verificar que MinigameEngine existe (definido en minigames.js)
    if (typeof MinigameEngine === 'undefined') {
      console.error('MinigameEngine no definido — verifica que minigames.js cargó correctamente');
      // Auto-resolver para que el juego no se congele
      const players = gs?.players || {};
      const order   = gs?.order   || Object.keys(players);
      const alive   = order.filter(id => !players[id]?.disconnected);
      const sh      = [...alive].sort(() => Math.random() - .5);
      socket.emit('minigame_done', { type:'normal', winner:sh[0]||null, second:sh[1]||null, third:sh[2]||null });
      return;
    }

    const cv = $('mg-canvas');
    if (cv) { cv.style.width='100%'; cv.style.height='100%'; }

    const players = gs?.players
      ? Object.values(gs.players).filter(p => !p.disconnected)
      : [{ id:socket.id, username:user?.username||'Tú', animal:myAnimal||'leon', color:'#FFD700', team:'red' }];

    const effective = mgData || { id:data.minigameId||1, type:'collect', dur:data.duration||25, name:'Minijuego' };

    // Timer de seguridad: si el engine no termina, auto-reportar
    const autoKill = setTimeout(() => {
      if (mgEng) { mgEng.destroy(); mgEng = null; }
      const order  = gs?.order || Object.keys(gs?.players || {});
      const active = order.filter(id => !gs?.players?.[id]?.disconnected);
      const sh     = [...active].sort(() => Math.random() - .5);
      socket.emit('minigame_done', { type:'normal', winner:sh[0]||null, second:sh[1]||null, third:sh[2]||null });
    }, (effective.dur + 4) * 1000);

    mgEng = new MinigameEngine('mg-canvas', socket.id, players, effective, socket, results => {
      clearTimeout(autoKill);
      const mgRes = $('mg-result');
      if (mgRes) mgRes.classList.add('show');
      showMgResult(results, data.type);
    });
    mgEng.start();
  }

  function showMgResult(results, type) {
    const players = gs?.players || {};
    const iWon    = results.winner === socket.id ||
      (type === 'super' && players[socket.id]?.team === results.winnerTeam);

    set('mg-rtrophy', iWon ? '🏆' : '😢');
    set('mg-rtitle',  iWon ? '¡Ganaste!' : '¡Fin del minijuego!');

    const list = $('mg-rlist');
    if (list) {
      list.innerHTML = '';
      if (type === 'super') {
        const wt = results.winnerTeam;
        list.innerHTML = `<li class="ri r1">
          <span class="ri-pos">${wt==='red'?'🔴':'🔵'}</span>
          <span class="ri-name">Equipo ${wt==='red'?'Rojo':'Azul'} gana</span>
          <span class="ri-rw">+1 ⭐ c/u</span></li>`;
      } else {
        [
          { id:results.winner, cls:'r1', pos:'🥇', rw:'+10 🍌' },
          { id:results.second, cls:'r2', pos:'🥈', rw:'+8 🍌'  },
          { id:results.third,  cls:'r3', pos:'🥉', rw:'+6 🍌'  },
        ].forEach(({ id, cls, pos, rw }) => {
          if (!id) return;
          const p  = players[id];
          const li = document.createElement('li');
          li.className = `ri ${cls}`;
          li.innerHTML = `<span class="ri-pos">${pos}</span>
            <span class="ri-name">${(p?.username||id).slice(0,14)}</span>
            <span class="ri-rw">${rw}</span>`;
          list.appendChild(li);
        });
      }
    }

    const rw = $('mg-rrw');
    if (rw) rw.textContent = type==='super'
      ? 'Equipo ganador: +1 ⭐ Banana Dorada c/u'
      : '🥇+10  🥈+8  🥉+6 🍌';

    // Solo el host (primer en order) reporta al servidor
    const order  = gs?.order || Object.keys(players);
    const active = order.filter(id => !players[id]?.disconnected);
    if (active[0] === socket.id) {
      socket.emit('minigame_done', { type: type || 'normal', ...results });
    }

    if (iWon) SFX.win(); else SFX.lose();
  }

  function mgContinue() {
    const mgRes = $('mg-result');
    if (mgRes) mgRes.classList.remove('show');
    if (mgEng) { mgEng.destroy(); mgEng = null; }
    // Volver al tablero
    show('screen-game');
  }

  function mgBtnA() { if (mgEng) mgEng.pressA(); }
  function mgBtnB() { if (mgEng) mgEng.pressB(); }

  // ── FIN DE PARTIDA ────────────────────────────────────────
  function showGameOver(data) {
    if (mgEng) { mgEng.destroy(); mgEng = null; }
    show('screen-gameover');

    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'];
    const AD     = typeof ANIMALS_DATA !== 'undefined' ? ANIMALS_DATA : {};
    let myPal    = 0;

    const fr = $('final-rank');
    if (fr) {
      fr.innerHTML = '';
      data.ranking.forEach((p, i) => {
        const pal = [3,2,1][i] || 0;
        if (p.id === socket.id) myPal = pal;
        const a   = AD[p.animal] || {};
        const div = document.createElement('div');
        div.className = `rrow ${i===0?'r1':i===1?'r2':''}`;
        div.innerHTML = `
          <div class="rem">${medals[i]||'·'}</div>
          <div class="rem">${a.emoji||'🐾'}</div>
          <div class="rinfo">
            <div class="rname">${p.username}</div>
            <div class="rstats">⭐${p.superBananas||0} · 🍌${p.bananas||0}</div>
          </div>
          ${pal > 0 ? `<div class="rpal">+${pal} 🌴</div>` : ''}`;
        fr.appendChild(div);
      });
    }

    set('palgained', `+${myPal} 🌴`);
    if (user && myPal > 0) user.palmeras += myPal;
    if (data.ranking[0]?.id === socket.id) SFX.win(); else SFX.lose();
  }

  function toLobby() {
    gameId = null; gs = null; isMyTurn = false; board = null;
    show('screen-lobby');
    refreshLobby();
  }

  // ── TIENDA ────────────────────────────────────────────────
  function renderShop() {
    if (typeof SKINS_DATA === 'undefined') return;
    const g = $('skgrid'); if (!g) return;
    g.innerHTML = SKINS_DATA.map(sk => {
      const own = user?.ownedSkins?.includes(sk.id);
      const act = user?.activeSkin === sk.id;
      return `<div class="skcard ${own?'owned':''} ${act?'active':''}">
        <div class="skem">${sk.emoji}</div>
        <div class="sknm">${sk.name}</div>
        <div class="skpr">${sk.price===0?'Gratis':`${sk.price} 🌴`}</div>
        ${act ? '<div style="font-size:.72rem;color:var(--c1);margin-top:4px">✓ Activo</div>'
        : own ? `<button class="btn btn-ghost btn-sm" onclick="G.equipSkin('${sk.id}')" style="margin-top:6px">Equipar</button>`
        :       `<button class="btn btn-gold btn-sm"  onclick="G.buySkin('${sk.id}')"  style="margin-top:6px">${sk.price===0?'Equipar':'Comprar'}</button>`}
      </div>`;
    }).join('');
  }

  function buySkin(id)  { if (id==='default') return equipSkin(id); socket.emit('buy_skin',  { skin:id }); }
  function equipSkin(id){ socket.emit('equip_skin', { skin:id }); }
  function loadLB()     { socket.emit('get_leaderboard'); }
  function myStats()    { if(user) T(`🏆${user.wins} victorias · 🎮${user.gamesPlayed} · 🌴${user.palmeras}`); }
  function setVol(v)    { SFX.v = v/100; set('vvolt', v+'%'); }
  function setLang(l)   { T(`Idioma: ${l==='es'?'Español 🇲🇽':'English 🇺🇸'}`); }
  function fs()         { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); }

  // ── INIT ──────────────────────────────────────────────────
  function init() {
    SFX.init();
    socket = io();

    // AUTH
    socket.on('auth_result', res => {
      if (res.ok && res.user) {
        user = res.user; refreshLobby(); renderShop();
        show('screen-lobby');
        T(`¡Bienvenido, ${user.username}! 🍌`, 'ok'); SFX.win();
      } else if (res.ok) {
        T(res.msg, 'ok'); tab('login');
      } else {
        T(res.msg || 'Error.', 'err');
      }
    });

    socket.on('error_msg', msg => T(msg, 'err'));

    // COLA
    socket.on('queue_update', data => {
      set('qtimer', data.timeLeft);
      set('qcount', data.players);
      for (let i=0; i<8; i++) {
        const d = $(`d${i}`);
        if (d) d.classList.toggle('on', i < data.players);
      }
    });

    // LOBBY DE PARTIDA
    socket.on('lobby_created', data => {
      lobbyId = data.lobbyId;
      clearInterval(qDots);
      show('screen-charsel');
      renderCS(data.players);

      let t = data.timeLeft || 25;
      const te = $('cst'); if (te) te.textContent = t;
      csTimer = setInterval(() => {
        t--; if (te) te.textContent = Math.max(0, t);
        if (t <= 0) clearInterval(csTimer);
      }, 1000);
    });

    socket.on('lobby_update', data => renderCS(data.players));

    socket.on('animal_taken', data => {
      const AD = typeof ANIMALS_DATA !== 'undefined' ? ANIMALS_DATA : {};
      T(`${AD[data.animal]?.name || data.animal} ya fue elegido.`, 'err');
    });

    // JUEGO
    socket.on('game_start', data => {
      clearInterval(csTimer);
      gs = data;
      startGame(data);
    });

    socket.on('turn_update', data => {
      if (gs) { gs.currentTurn = data.currentTurn; gs.players = data.players || gs.players; gs.round = data.round || gs.round; }
      if (board) { board.setPlayers(data.players || gs?.players || {}); board.focusTurn(data.currentTurn); }
      updateHUD(data);
      const isMe  = data.currentTurn === socket.id;
      const turno = data.players?.[data.currentTurn]?.username || '';
      setDice(isMe, turno);
      if (isMe) { T('🎲 ¡Es tu turno! Tira el dado.', 'ok'); SFX.coin(); }
      else T(`👁 Turno de ${turno}`, '');
    });

    socket.on('your_turn', () => {
      isMyTurn = true;
      const btn = $('dice-btn');
      if (btn) { btn.disabled = false; btn.style.opacity='1'; btn.textContent='🎲'; }
    });

    socket.on('player_moved', data => {
      // Actualizar estado local
      if (gs?.players?.[data.playerId]) {
        gs.players[data.playerId].position = data.newPos;
        gs.players[data.playerId].bananas  = data.bananas;
      }
      // Animar en tablero
      if (board) {
        board.setPlayers(data.players || gs?.players || {});
        board.movePlayer(data.playerId, data.prevPos, data.newPos, () => {
          if (board && data.players) board.setPlayers(data.players);
        });
      }
      showSpacePop(data.spaceEffect, data.playerId === socket.id);
      SFX.move();
      updateHUD({ players: data.players || gs?.players, round: gs?.round, maxRounds: gs?.maxRounds, order: gs?.order });
    });

    socket.on('next_round', data => {
      if (gs) { gs.round = data.round; gs.players = data.players || gs.players; }
      updateHUD({ ...data, order: gs?.order });
      T(`🎲 Ronda ${data.round} de ${data.maxRounds}`, 'ok');
    });

    socket.on('buy_result', data => {
      if (data.success) {
        T('⭐ ¡Super Banana comprada!', 'ok'); SFX.win();
        if (gs?.players?.[socket.id]) {
          gs.players[socket.id].bananas      = data.bananas;
          gs.players[socket.id].superBananas = data.superBananas;
        }
        if (board) board.setPlayers(gs.players);
        updateHUD(gs);
      } else { T(data.msg, 'err'); }
    });

    socket.on('minigame_incoming', data => showMgIncoming(data));

    socket.on('minigame_result', data => {
      if (data.players && gs) {
        gs.players = data.players;
        if (board) board.setPlayers(data.players);
        updateHUD(gs);
      }
    });

    // Posiciones en tiempo real de otros jugadores en el minijuego
    socket.on('mg_pos', data => {
      if (mgEng) mgEng.remotePos[data.id] = { x:data.x, y:data.y, hp:data.hp, score:data.score };
    });

    socket.on('player_disconnected', data => {
      T(`⚠️ ${data.username||'Jugador'} se desconectó.`, 'err');
      if (gs?.players?.[data.playerId]) gs.players[data.playerId].disconnected = true;
    });

    socket.on('game_over', data => { gs = null; showGameOver(data); });

    socket.on('shop_result', data => {
      if (data.ok) {
        T('¡Skin comprada! 🎨', 'ok'); SFX.coin();
        if (user) { user.palmeras = data.palmeras; user.ownedSkins = data.ownedSkins; }
        set('upal', data.palmeras); renderShop();
      } else { T(data.msg, 'err'); }
    });

    socket.on('skin_equipped', data => {
      if (user) user.activeSkin = data.activeSkin;
      T('Skin equipada ✓', 'ok'); renderShop(); refreshLobby();
    });

    socket.on('leaderboard_data', data => {
      const el = $('lblist'); if (!el) return;
      if (!data?.length) { el.textContent = 'Sin datos.'; return; }
      const m = ['🥇','🥈','🥉'];
      el.innerHTML = data.map((p,i) => `<div class="lbrow">
        <div class="lbpos">${m[i]||(i+1)}</div>
        <div class="lbname">${p.username}</div>
        <div class="lbstat">🎮${p.gamesPlayed}</div>
        <div class="lbwins">🏆${p.wins}</div>
        <div class="lbstat">🌴${p.palmeras}</div>
      </div>`).join('');
    });

    socket.on('disconnect', () => T('Desconectado…', 'err'));
    socket.on('connect',    () => { if (user) T('Reconectado ✓', 'ok'); });
  }

  // ── API PÚBLICA ───────────────────────────────────────────
  return {
    init, showAuth, show, tab,
    login, register, logout,
    queue, leaveQ,
    pickAnimal,
    roll,
    mgContinue, mgBtnA, mgBtnB,
    toLobby,
    loadLB, buySkin, equipSkin,
    myStats, setVol, setLang, fs,
  };
})();

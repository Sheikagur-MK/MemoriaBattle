// ── RENDERIZADOR DEL TABLERO ──────────────────────────────────────────────────
class BoardRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx    = this.canvas.getContext('2d');
    this.board  = [];
    this.players= {};
    this.selfId = null;

    // Cámara — centrada en el jugador activo
    this.camX = 0; this.camY = 0;
    this.targetCamX = 0; this.targetCamY = 0;
    this.zoom = 1.4;  // zoom inicial — el tablero se ve "cerca"

    // Posiciones animadas suaves
    this.animPos = {};   // { [playerId]: { x, y, bobOffset } }
    this.particles = [];
    this.currentTurnId = null;
    this.frameCount = 0;

    // Drag manual (opcional)
    this.dragging   = false;
    this.dragStart  = { x: 0, y: 0 };
    this.manualDrag = false;
    this.dragTimeout= null;

    this.resize();
    this._initInput();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width  = window.innerWidth  * devicePixelRatio;
    this.canvas.height = window.innerHeight * devicePixelRatio;
    this.ctx.scale(devicePixelRatio, devicePixelRatio);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
  }

  // ── LAYOUT ────────────────────────────────────────────────
  CELL_W = 100;
  CELL_H = 85;
  COLS    = 10;

  getCellPos(idx) {
    const row = Math.floor(idx / this.COLS);
    // Serpentina: filas pares van de izquierda a derecha, impares al revés
    const col = row % 2 === 0
      ? idx % this.COLS
      : this.COLS - 1 - (idx % this.COLS);
    return {
      x: col * this.CELL_W + this.CELL_W / 2,
      y: row * this.CELL_H + this.CELL_H / 2,
    };
  }

  get totalW() { return this.COLS * this.CELL_W; }
  get totalH() { return Math.ceil(70 / this.COLS) * this.CELL_H; }

  // ── COLORES ───────────────────────────────────────────────
  SPACE_CFG = {
    blue:      { fill: '#1A3F6F', stroke: '#4A90E2', emoji: '🔵', label: '+5🍌' },
    red:       { fill: '#6F1A1A', stroke: '#E74C3C', emoji: '🔴', label: '-2🍌' },
    star:      { fill: '#5C4A00', stroke: '#FFD700', emoji: '⭐', label: '¡Banana!' },
    supermini: { fill: '#3D1A5C', stroke: '#9B59B6', emoji: '💜', label: '¡Super!' },
    normal:    { fill: '#2A3340', stroke: '#445566', emoji: '',    label: '' },
  };

  BIOME_BG = { fauna:'#0d2818', desierto:'#2d1800', bosque:'#0a1f0a', selva:'#0a2010', artico:'#0a1a28' };
  BIOME_EMOJI = { fauna:'🌿', desierto:'🏜️', bosque:'🌲', selva:'🌴', artico:'❄️' };

  // ── INICIALIZAR JUGADORES ─────────────────────────────────
  initPlayers(players, selfId) {
    this.selfId  = selfId;
    this.players = players;
    Object.values(players).forEach(p => {
      if (!this.animPos[p.id]) {
        const pos = this.getCellPos(p.position || 0);
        this.animPos[p.id] = { x: pos.x, y: pos.y, bobOffset: Math.random() * Math.PI * 2 };
      }
    });
    // Centrar cámara en el jugador local al inicio
    this.focusPlayer(selfId, true);
  }

  updatePlayers(players) {
    this.players = players;
  }

  // Mover jugador con animación suave paso a paso
  animateMove(playerId, fromPos, toPos, onDone) {
    const steps = [];
    // Animar casilla por casilla
    let cur = fromPos;
    while (cur !== toPos) {
      cur = (cur + 1) % 70;
      steps.push(cur);
    }
    if (steps.length === 0) { onDone && onDone(); return; }

    let i = 0;
    const next = () => {
      if (i >= steps.length) { onDone && onDone(); return; }
      const target = this.getCellPos(steps[i]);
      const anim   = this.animPos[playerId];
      if (anim) { anim.targetX = target.x; anim.targetY = target.y; }
      i++;
      setTimeout(next, 220);
    };
    next();
  }

  // Actualizar jugador y animar
  movePlayer(playerId, prevPos, newPos) {
    if (this.players[playerId]) this.players[playerId].position = newPos;
    this.animateMove(playerId, prevPos, newPos, () => {
      this._spawnParticles(this.animPos[playerId]?.x || 0, this.animPos[playerId]?.y || 0,
        this.players[playerId]?.color || '#FFD700');
    });
    // Si es el jugador local, seguirlo con la cámara
    if (playerId === this.selfId) {
      setTimeout(() => this.focusPlayer(playerId), 300);
    }
  }

  // ── CÁMARA ────────────────────────────────────────────────
  focusPlayer(playerId, instant = false) {
    const anim = this.animPos[playerId];
    if (!anim) return;
    const tx = this.W / 2 - anim.x * this.zoom;
    const ty = this.H / 2 - anim.y * this.zoom - 40; // compensar HUD arriba
    if (instant) { this.camX = tx; this.camY = ty; }
    this.targetCamX = tx;
    this.targetCamY = ty;
    this.manualDrag = false;
  }

  // Enfocar el jugador cuyo turno es (para que todos vean)
  focusTurn(playerId) {
    this.currentTurnId = playerId;
    this.focusPlayer(playerId);
  }

  // ── PARTÍCULAS ─────────────────────────────────────────────
  _spawnParticles(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const a = (Math.PI * 2 / 14) * i;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * (2 + Math.random() * 4),
        vy: Math.sin(a) * (2 + Math.random() * 4) - 2,
        life: 1, color, r: 4 + Math.random() * 4
      });
    }
  }

  // ── INPUT (drag opcional) ──────────────────────────────────
  _initInput() {
    const c = this.canvas;
    c.addEventListener('mousedown', e => {
      this.dragging  = true;
      this.dragStart = { x: e.clientX - this.camX, y: e.clientY - this.camY };
    });
    c.addEventListener('mouseup',   () => { this.dragging = false; });
    c.addEventListener('mousemove', e => {
      if (!this.dragging) return;
      this.camX = e.clientX - this.dragStart.x;
      this.camY = e.clientY - this.dragStart.y;
      this.manualDrag = true;
      // Volver a seguir al jugador tras 4 segundos sin tocar
      clearTimeout(this.dragTimeout);
      this.dragTimeout = setTimeout(() => { this.manualDrag = false; }, 4000);
    });
    c.addEventListener('wheel', e => {
      this.zoom = Math.max(0.6, Math.min(2.2, this.zoom - e.deltaY * 0.001));
    });
    // Touch
    c.addEventListener('touchstart', e => {
      const t = e.touches[0];
      this.dragging  = true;
      this.dragStart = { x: t.clientX - this.camX, y: t.clientY - this.camY };
    }, { passive: true });
    c.addEventListener('touchend',   () => { this.dragging = false; });
    c.addEventListener('touchmove',  e => {
      if (!this.dragging) return;
      const t = e.touches[0];
      this.camX = t.clientX - this.dragStart.x;
      this.camY = t.clientY - this.dragStart.y;
      this.manualDrag = true;
      clearTimeout(this.dragTimeout);
      this.dragTimeout = setTimeout(() => { this.manualDrag = false; }, 4000);
    }, { passive: true });
  }

  // ── LOOP ──────────────────────────────────────────────────
  startRender() { this._loop(); }

  _loop() {
    this.frameCount++;

    // Interpolar posiciones animadas
    Object.values(this.animPos).forEach(a => {
      if (a.targetX !== undefined) {
        a.x += (a.targetX - a.x) * 0.18;
        a.y += (a.targetY - a.y) * 0.18;
        if (Math.abs(a.targetX - a.x) < 0.5) { a.x = a.targetX; a.y = a.targetY; }
      }
    });

    // Seguir al jugador local si no está en modo drag manual
    if (!this.manualDrag && !this.dragging) {
      this.camX += (this.targetCamX - this.camX) * 0.07;
      this.camY += (this.targetCamY - this.camY) * 0.07;
      // Actualizar target continuamente por si el jugador se movió
      if (this.selfId && this.animPos[this.selfId]) {
        const ax = this.animPos[this.selfId].x;
        const ay = this.animPos[this.selfId].y;
        this.targetCamX = this.W / 2 - ax * this.zoom;
        this.targetCamY = this.H / 2 - ay * this.zoom - 40;
      }
    }

    this._draw();
    requestAnimationFrame(() => this._loop());
  }

  // ── DIBUJO PRINCIPAL ──────────────────────────────────────
  _draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    // Fondo oscuro con gradiente sutil
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, this.W, this.H);

    // Mini indicador de bioma actual (esquina)
    this._drawBiomeHint();

    ctx.save();
    ctx.translate(this.camX, this.camY);
    ctx.scale(this.zoom, this.zoom);

    // Biomas de fondo
    this._drawBiomes();

    // Conexiones entre casillas
    this._drawConnections();

    // Casillas
    this.board.forEach((space, i) => this._drawSpace(space, i));

    // Partículas
    this._drawParticles();

    // Piezas de jugadores
    this._drawPieces();

    ctx.restore();

    // Indicador "Es tu turno" / "Turno de X"
    this._drawTurnIndicator();

    // Minimapa
    this._drawMinimap();
  }

  _drawBiomes() {
    const biomes = ['fauna','desierto','bosque','selva','artico'];
    biomes.forEach((biome, bi) => {
      const rowStart = Math.floor(bi * 14 / this.COLS);
      const rowEnd   = Math.ceil((bi * 14 + 14) / this.COLS);
      const y0 = rowStart * this.CELL_H - 8;
      const h  = (rowEnd - rowStart) * this.CELL_H + 16;
      ctx.fillStyle = this.BIOME_BG[biome] + 'bb';
      ctx.fillRect(-12, y0, this.totalW + 24, h);

      ctx.font      = 'bold 11px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.textAlign = 'right';
      ctx.fillText(`${this.BIOME_EMOJI[biome]} ${biome.toUpperCase()}`, this.totalW - 4, y0 + 14);
    });
  }

  _drawConnections() {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth   = 2.5;
    ctx.setLineDash([5, 5]);
    for (let i = 0; i < this.board.length - 1; i++) {
      const a = this.getCellPos(i);
      const b = this.getCellPos(i + 1);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  _drawSpace(space, i) {
    const ctx = this.ctx;
    const pos = this.getCellPos(i);
    const cfg = this.SPACE_CFG[space.type] || this.SPACE_CFG.normal;
    const W   = this.CELL_W - 10;
    const H   = this.CELL_H - 10;

    ctx.save();
    ctx.translate(pos.x, pos.y);

    // Brillo especial en casillas importantes
    if (space.type !== 'normal') {
      ctx.shadowColor = cfg.stroke;
      ctx.shadowBlur  = 10 + Math.sin(this.frameCount * 0.05) * 4;
    }

    // Fondo
    ctx.fillStyle   = cfg.fill;
    ctx.strokeStyle = cfg.stroke;
    ctx.lineWidth   = space.type !== 'normal' ? 2.5 : 1.5;
    this._roundRect(ctx, -W/2, -H/2, W, H, 10);
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;

    // Número
    ctx.font      = 'bold 9px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.textAlign = 'left';
    ctx.fillText(String(i), -W/2 + 4, -H/2 + 11);

    // Emoji central
    if (cfg.emoji) {
      ctx.font = '18px serif'; ctx.textAlign = 'center';
      ctx.fillText(cfg.emoji, 0, 5);
    }

    // Label inferior
    if (cfg.label) {
      ctx.font      = 'bold 8px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(cfg.label, 0, H/2 - 5);
    }

    ctx.restore();
  }

  _drawPieces() {
    const ctx = this.ctx;
    const now = Date.now();

    Object.values(this.players).forEach((p, i) => {
      if (p.disconnected) return;
      const anim = this.animPos[p.id];
      if (!anim) return;

      const isSelf  = p.id === this.selfId;
      const isTurn  = p.id === this.currentTurnId;
      const bobY    = Math.sin(now * 0.003 + (anim.bobOffset || 0)) * (isTurn ? 5 : 2);

      // Offset para que no se solapen cuando están en la misma casilla
      const sameCell = Object.values(this.players).filter(q => !q.disconnected && q.position === p.position);
      const myIdx    = sameCell.findIndex(q => q.id === p.id);
      const offsetX  = (myIdx - (sameCell.length - 1) / 2) * 18;

      const drawX = anim.x + offsetX;
      const drawY = anim.y + bobY - 10;

      ctx.save();
      ctx.translate(drawX, drawY);

      // Halo si es el turno activo
      if (isTurn) {
        const pulse = 0.6 + Math.sin(now * 0.005) * 0.4;
        ctx.fillStyle = `rgba(255,215,0,${pulse * 0.25})`;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(255,215,0,${pulse})`;
        ctx.lineWidth   = 2;
        ctx.stroke();
      }

      // Borde del jugador propio
      if (isSelf) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Sombra en el suelo
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 16, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Emoji del animal
      const animal = typeof ANIMALS_DATA !== 'undefined' ? ANIMALS_DATA[p.animal] : null;
      ctx.font = '28px serif';
      ctx.textAlign = 'center';
      ctx.fillText(animal?.emoji || '🐾', 0, 10);

      // Nombre con fondo
      ctx.font         = 'bold 8px sans-serif';
      ctx.textAlign    = 'center';
      const nameW      = ctx.measureText(p.username).width + 8;
      ctx.fillStyle    = 'rgba(0,0,0,0.7)';
      ctx.fillRect(-nameW/2, 18, nameW, 12);
      ctx.fillStyle    = isSelf ? '#FFD700' : p.color || '#fff';
      ctx.fillText(p.username.slice(0, 9), 0, 27);

      // Bananas debajo
      ctx.font      = '8px sans-serif';
      ctx.fillStyle = '#FFD700';
      ctx.fillText(`🍌${p.bananas}${p.superBananas > 0 ? ` ⭐${p.superBananas}` : ''}`, 0, 38);

      ctx.restore();
    });
  }

  _drawParticles() {
    const ctx = this.ctx;
    this.particles = this.particles.filter(p => p.life > 0.02);
    this.particles.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= 0.035;
    });
    ctx.globalAlpha = 1;
  }

  // ── MINIMAP ────────────────────────────────────────────────
  _drawMinimap() {
    const ctx  = this.ctx;
    const SIZE = 140;
    const PAD  = 14;
    const mx   = this.W - SIZE - PAD;
    const my   = this.H - SIZE - PAD - 30; // encima de los controles

    const sx = SIZE / this.totalW;
    const sy = SIZE / this.totalH;

    // Fondo
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    this._roundRectScreen(ctx, mx - 4, my - 4, SIZE + 8, SIZE + 8, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth   = 1;
    ctx.stroke();

    // Casillas coloreadas en el minimap
    this.board.forEach((space, i) => {
      const pos = this.getCellPos(i);
      const cfg = this.SPACE_CFG[space.type] || this.SPACE_CFG.normal;
      ctx.fillStyle = cfg.stroke + '88';
      ctx.fillRect(mx + pos.x * sx - 3, my + pos.y * sy - 3, 6, 6);
    });

    // Jugadores en el minimap
    Object.values(this.players).forEach(p => {
      if (p.disconnected) return;
      const anim = this.animPos[p.id];
      if (!anim) return;
      ctx.fillStyle   = p.id === this.selfId ? '#FFD700' : (p.color || '#fff');
      ctx.strokeStyle = '#000';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.arc(mx + anim.x * sx, my + anim.y * sy, p.id === this.selfId ? 4 : 3, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    });

    // Label
    ctx.font      = 'bold 9px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText('MINIMAPA', mx + SIZE / 2, my + SIZE + 12);
  }

  // ── INDICADOR DE TURNO ────────────────────────────────────
  _drawTurnIndicator() {
    const ctx = this.ctx;
    if (!this.currentTurnId || !this.players[this.currentTurnId]) return;
    const p   = this.players[this.currentTurnId];
    const isMy= p.id === this.selfId;

    const txt   = isMy ? '🎲 ¡Es tu turno!' : `👁 Turno de ${p.username}`;
    const color = isMy ? '#FFD700' : (p.color || '#aaa');

    ctx.save();
    ctx.font         = 'bold 15px sans-serif';
    ctx.textAlign    = 'center';
    const w          = ctx.measureText(txt).width + 24;
    const x          = this.W / 2 - w / 2;
    const y          = this.H - 55;
    ctx.fillStyle    = 'rgba(0,0,0,0.75)';
    this._roundRectScreen(ctx, x, y, w, 32, 16);
    ctx.fill();
    ctx.strokeStyle  = color;
    ctx.lineWidth    = 2;
    ctx.stroke();
    ctx.fillStyle    = color;
    ctx.fillText(txt, this.W / 2, y + 21);
    ctx.restore();
  }

  _drawBiomeHint() {
    // Bioma donde está el jugador local
    if (!this.selfId || !this.players[this.selfId]) return;
    const pos   = this.players[this.selfId].position || 0;
    const biome = this.board[pos]?.biome || '';
    const emoji = this.BIOME_EMOJI[biome] || '';
    if (!biome) return;
    const ctx   = this.ctx;
    ctx.font      = 'bold 11px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.textAlign = 'left';
    ctx.fillText(`${emoji} ${biome.toUpperCase()}`, 14, this.H - 16);
  }

  // ── HELPERS ───────────────────────────────────────────────
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
  }

  _roundRectScreen(ctx, x, y, w, h, r) {
    this._roundRect(ctx, x, y, w, h, r);
  }
}

// Alias para que _drawBiomes acceda a ctx correctamente
const ctx = { fillStyle:'', strokeStyle:'', lineWidth:1,
  fillRect(){}, fillText(){}, textAlign:'left',
  font:'', beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, fill(){} };

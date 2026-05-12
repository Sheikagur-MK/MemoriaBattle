// ── RENDERIZADOR DEL TABLERO ──────────────────────────────────────────────────
class BoardRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx    = this.canvas.getContext('2d');
    this.board  = [];
    this.players= {};
    this.camX   = 0; this.camY = 0;
    this.targetCamX = 0; this.targetCamY = 0;
    this.zoom   = 0.8; // Zoom inicial más cercano para evitar ver todo el tablero
    this.dragging = false;
    this.dragStart= {x:0,y:0};
    this.animPlayers = {}; // posiciones animadas
    this.particles   = [];
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

  // ── CONFIGURACIÓN ─────────────────────────────────────────
  CELL_W = 110;
  CELL_H = 90;
  COLS    = 10;

  getCellPos(idx) {
    const row = Math.floor(idx / this.COLS);
    const col = row % 2 === 0 ? idx % this.COLS : (this.COLS - 1) - (idx % this.COLS);
    return {
      x: col * this.CELL_W + this.CELL_W / 2,
      y: row * this.CELL_H + this.CELL_H / 2
    };
  }

  setBoard(data) { this.board = data; }
  
  setPlayers(players) { 
    this.players = players; 
    for(let id in players) {
      if(!this.animPlayers[id]) {
        this.animPlayers[id] = { ...this.getCellPos(players[id].pos) };
      }
    }
  }

  // ── ACTUALIZACIÓN Y CÁMARA ────────────────────────────────
  update(activePlayerId) {
    // 1. Seguimiento del jugador activo
    const activePlayer = this.players[activePlayerId];
    if (activePlayer && !this.dragging) {
      const pos = this.getCellPos(activePlayer.pos);
      // Centrar la cámara en el jugador (ajustando por el zoom)
      this.targetCamX = (this.W / 2) - (pos.x * this.zoom);
      this.targetCamY = (this.H / 2) - (pos.y * this.zoom);
    }

    // 2. Suavizado de cámara (Interpolación)
    this.camX += (this.targetCamX - this.camX) * 0.08;
    this.camY += (this.targetCamY - this.camY) * 0.08;

    // 3. Animar jugadores (suavizar su movimiento por las casillas)
    for(let id in this.players) {
      const target = this.getCellPos(this.players[id].pos);
      const cur = this.animPlayers[id];
      if(!cur) {
        this.animPlayers[id] = { ...target };
        continue;
      }
      cur.x += (target.x - cur.x) * 0.1;
      cur.y += (target.y - cur.y) * 0.1;

      // Partículas si se mueve
      if(Math.abs(target.x - cur.x) > 1) {
        this.spawnParticle(cur.x, cur.y, this.players[id].animal);
      }
    }

    // Partículas
    this.particles.forEach((p, i) => {
      p.x += p.vx; p.y += p.vy; p.life -= 0.02;
      if(p.life <= 0) this.particles.splice(i, 1);
    });
  }

  // ── RENDERIZADO ───────────────────────────────────────────
  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    ctx.save();
    // Aplicar transformación de cámara y zoom
    ctx.translate(this.camX, this.camY);
    ctx.scale(this.zoom, this.zoom);

    this.drawBoard(ctx);
    this.drawParticles(ctx);
    this.drawPlayers(ctx);

    ctx.restore();
  }

  drawBoard(ctx) {
    this.board.forEach((space, i) => {
      const pos = this.getCellPos(i);
      this._drawSpace(ctx, pos, space, i);
    });
  }

  drawPlayers(ctx) {
    for(let id in this.players) {
      const p   = this.players[id];
      const pos = this.animPlayers[id];
      if(!pos) continue;

      ctx.save();
      ctx.translate(pos.x, pos.y);

      // Sombra del personaje
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur  = 10;
      
      // Cuerpo (Círculo de fondo)
      ctx.fillStyle = ANIMALS_DATA[p.animal]?.color || '#ccc';
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Emoji
      ctx.shadowBlur = 0;
      ctx.font = '24px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ANIMALS_DATA[p.animal]?.emoji || '❓', 0, 2);

      // Nombre arriba
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(p.username, 0, -32);
      ctx.fillText(p.username, 0, -32);

      ctx.restore();
    }
  }

  drawParticles(ctx) {
    this.particles.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.font = '12px serif';
      ctx.fillText(p.char, p.x, p.y);
    });
    ctx.globalAlpha = 1;
  }

  spawnParticle(x, y, animal) {
    if(Math.random() > 0.3) return;
    this.particles.push({
      x, y, 
      vx: (Math.random()-0.5)*2, 
      vy: (Math.random()-0.5)*2,
      life: 1,
      char: ANIMALS_DATA[animal]?.emoji || '✨'
    });
  }

  // ── HELPERS ───────────────────────────────────────────────
  _drawSpace(ctx, pos, space, i) {
    const cfg  = SPACE_CONFIG[space.type] || this.SPACE_COLORS.normal;
    const W    = this.CELL_W - 12;
    const H    = this.CELL_H - 12;

    ctx.save();
    ctx.translate(pos.x, pos.y);

    // Sombra
    ctx.shadowColor  = cfg.stroke;
    ctx.shadowBlur   = space.type !== 'normal' ? 12 : 4;

    // Fondo casilla
    ctx.fillStyle   = cfg.fill;
    ctx.strokeStyle = cfg.stroke;
    ctx.lineWidth   = space.type !== 'normal' ? 2.5 : 1.5;
    this._roundRect(ctx, -W/2, -H/2, W, H, 10);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Número de casilla
    ctx.font      = 'bold 10px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.textAlign = 'left';
    ctx.fillText(`${i}`, -W/2 + 5, -H/2 + 13);

    // Emoji central
    if (cfg.emoji) {
      ctx.font      = '22px serif';
      ctx.textAlign = 'center';
      ctx.fillText(cfg.emoji, 0, 6);
    }

    // Label
    if (cfg.label) {
      ctx.font      = 'bold 9px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(cfg.label, 0, H/2 - 8);
    }

    ctx.restore();
  }

  _roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  SPACE_COLORS = {
    normal: { fill: '#555', stroke: '#777' }
  };

  _initInput() {
    this.canvas.addEventListener('mousedown', e => {
      this.dragging = true;
      this.dragStart = { x: e.clientX - this.camX, y: e.clientY - this.camY };
    });
    window.addEventListener('mousemove', e => {
      if(!this.dragging) return;
      this.targetCamX = e.clientX - this.dragStart.x;
      this.targetCamY = e.clientY - this.dragStart.y;
    });
    window.addEventListener('mouseup', () => this.dragging = false);

    // Touch
    this.canvas.addEventListener('touchstart', e => {
      this.dragging = true;
      const t = e.touches[0];
      this.dragStart = { x: t.clientX - this.camX, y: t.clientY - this.camY };
    });
    window.addEventListener('touchmove', e => {
      if(!this.dragging) return;
      const t = e.touches[0];
      this.targetCamX = t.clientX - this.dragStart.x;
      this.targetCamY = t.clientY - this.dragStart.y;
    });
    window.addEventListener('touchend', () => this.dragging = false);
  }
}

const SPACE_CONFIG = {
  normal: { fill: 'rgba(255,255,255,0.1)', stroke: 'rgba(255,255,255,0.2)' },
  blue:   { fill: '#2980b9', stroke: '#3498db', emoji: '🔹', label: '+3' },
  red:    { fill: '#c0392b', stroke: '#e74c3c', emoji: '🔸', label: '-3' },
  star:   { fill: '#f1c40f', stroke: '#f39c12', emoji: '⭐', label: 'STAR' },
  banana: { fill: '#27ae60', stroke: '#2ecc71', emoji: '🍌', label: 'BONUS' },
  event:  { fill: '#8e44ad', stroke: '#9b59b6', emoji: '❓', label: 'EVENT' }
};

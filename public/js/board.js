// ── RENDERIZADOR DEL TABLERO MEJORADO ─────────────────────────────────────────
class BoardRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx    = this.canvas.getContext('2d');
    this.board  = [];
    this.players= {};
    this.selfId = null;

    // Cámara con suavizado dinámico
    this.camX = 0; this.camY = 0;
    this.targetCamX = 0; this.targetCamY = 0;
    this.zoom = 1.3;

    // Sistema de Partículas para mayor emoción
    this.particles = [];
    this.anim = {}; 
    this.frame = 0;

    this._resize();
    this._initInput();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  // Explosión visual al caer en casillas especiales o ganar premios
  spawnBurst(x, y, color) {
    for(let i=0; i<15; i++) {
      this.particles.push({
        x, y, 
        vx: (Math.random()-0.5)*12, 
        vy: (Math.random()-0.5)*12, 
        life: 1.0, 
        c: color
      });
    }
  }

  _cellPos(idx) {
    const COLS = 10;
    const CW = 100;
    const CH = 86;
    const row = Math.floor(idx / COLS);
    const col = row % 2 === 0 ? idx % COLS : COLS - 1 - (idx % COLS);
    return { x: col * CW + CW/2, y: row * CH + CH/2 };
  }

  render(state, selfId) {
    this.board = state.board;
    this.players = state.players;
    this.selfId = selfId;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Seguimiento de cámara inteligente
    const activeP = this.players[state.currentTurnId || selfId];
    if (activeP) {
      const pos = this._cellPos(activeP.position);
      this.targetCamX = pos.x * this.zoom - this.canvas.width/2;
      this.targetCamY = pos.y * this.zoom - this.canvas.height/2;
    }

    this.camX += (this.targetCamX - this.camX) * 0.08;
    this.camY += (this.targetCamY - this.camY) * 0.08;

    ctx.save();
    ctx.translate(-this.camX, -this.camY);
    ctx.scale(this.zoom, this.zoom);

    // Renderizado de Casillas con resplandor
    this.board.forEach((cell, i) => {
      const pos = this._cellPos(i);
      this._drawCell(pos.x, pos.y, cell);
    });

    // Renderizado de Jugadores con animación de salto
    Object.keys(this.players).forEach(id => {
      const p = this.players[id];
      const pos = this._cellPos(p.position);
      this._drawPlayer(pos.x, pos.y, p);
    });

    this._updateParticles();
    ctx.restore();
    this.frame++;
  }

  _drawCell(x, y, cell) {
    const ctx = this.ctx;
    const colors = { blue: '#4A90E2', red: '#E74C3C', star: '#FFD700', super: '#9B59B6' };
    const color = colors[cell.type] || '#555';
    
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 30 + Math.sin(this.frame*0.05)*2, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    const icon = cell.type === 'star' ? '⭐' : (cell.type === 'red' ? '💀' : '🌴');
    ctx.fillText(icon, x, y + 7);
  }

  _drawPlayer(x, y, p) {
    const ctx = this.ctx;
    const jump = Math.abs(Math.sin(this.frame * 0.12)) * 12;
    ctx.font = '42px serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.animalEmoji || '🦊', x, y - jump);
    
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = 'white';
    ctx.fillText(p.username, x, y - 48 - jump);
  }

  _updateParticles() {
    this.particles.forEach((p, i) => {
      p.x += p.vx; p.y += p.vy; p.life -= 0.025;
      this.ctx.globalAlpha = p.life;
      this.ctx.fillStyle = p.c;
      this.ctx.fillRect(p.x, p.y, 4, 4);
      if(p.life <= 0) this.particles.splice(i, 1);
    });
    this.ctx.globalAlpha = 1;
  }

  _initInput() {
    // Mantener lógica de drag manual si el usuario lo desea
  }
}

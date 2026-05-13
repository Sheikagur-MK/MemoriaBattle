// ── RENDERIZADOR DEL TABLERO PROFESIONAL ──────────────────────────────────────
class BoardRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx    = this.canvas.getContext('2d');
    this.board  = [];
    this.players= {};
    this.selfId = null;

    // Configuración de Cámara y Zoom
    this.camX = 0; 
    this.camY = 0;
    this.targetCamX = 0; 
    this.targetCamY = 0;
    this.zoom = 1.2;

    // Animación de Personajes
    this.anim = {}; // Guardará { x, y, targetX, targetY, bob }
    this.frame = 0;

    this._init();
  }

  _init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.animate();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.W = this.canvas.width;
    this.H = this.canvas.height;
  }

  // Define el tamaño de cada casilla y columnas del tablero
  CW = 110; 
  CH = 90;
  COLS = 8;

  // Convierte el índice de casilla (0-69) a coordenadas X, Y en el mundo
  _cellPos(idx) {
    const row = Math.floor(idx / this.COLS);
    const isEven = row % 2 === 0;
    const col = isEven ? (idx % this.COLS) : (this.COLS - 1 - (idx % this.COLS));
    return {
      x: col * this.CW,
      y: row * this.CH
    };
  }

  init(boardData, playersData, myId) {
    this.board = boardData;
    this.players = playersData;
    this.selfId = myId;

    // Inicializar posiciones de animación
    Object.keys(playersData).forEach(id => {
      const pos = this._cellPos(playersData[id].pos);
      this.anim[id] = { x: pos.x, y: pos.y, targetX: pos.x, targetY: pos.y };
    });
  }

  movePlayer(id, newPosIdx) {
    const pos = this._cellPos(newPosIdx);
    if (this.anim[id]) {
      this.anim[id].targetX = pos.x;
      this.anim[id].targetY = pos.y;
    }
    // Centrar cámara en el jugador que se mueve
    if (id === this.selfId) {
      this.targetCamX = pos.x;
      this.targetCamY = pos.y;
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    ctx.save();
    // Aplicar Cámara y Zoom
    ctx.translate(this.W / 2, this.H / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camX, -this.camY);

    // 1. Dibujar Caminos (Líneas entre casillas)
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let i = 0; i < this.board.length - 1; i++) {
      const p1 = this._cellPos(i);
      const p2 = this._cellPos(i + 1);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
    }
    ctx.stroke();

    // 2. Dibujar Casillas
    this.board.forEach((tile, i) => {
      const pos = this._cellPos(i);
      this._drawTile(ctx, pos.x, pos.y, tile);
    });

    // 3. Dibujar Jugadores con Interpolación
    Object.keys(this.players).forEach(id => {
      const p = this.players[id];
      const a = this.anim[id];

      // Suavizado de movimiento (Lerp)
      a.x += (a.targetX - a.x) * 0.1;
      a.y += (a.targetY - a.y) * 0.1;

      const bob = Math.sin(this.frame * 0.1) * 5;
      this._drawPlayer(ctx, a.x, a.y + bob, p);
    });

    ctx.restore();
    
    // Suavizado de cámara
    this.camX += (this.targetCamX - this.camX) * 0.05;
    this.camY += (this.targetCamY - this.camY) * 0.05;
  }

  _drawTile(ctx, x, y, tile) {
    const colors = {
      normal: '#555',
      coins: '#FFD700',
      danger: '#E74C3C',
      star: '#9B59B6',
      minigame: '#4ECDC4'
    };

    ctx.fillStyle = colors[tile.type] || '#555';
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  _drawPlayer(ctx, x, y, p) {
    const animal = ANIMALS_DATA[p.skin] || ANIMALS_DATA['leon'];
    
    // Sombra
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(x, y + 25, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Emoji/Sprite
    ctx.font = "40px serif";
    ctx.textAlign = "center";
    ctx.fillText(animal.emoji, x, y + 10);

    // Nombre
    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "white";
    ctx.fillText(p.username, x, y - 35);
  }

  animate() {
    this.frame++;
    this.draw();
    requestAnimationFrame(() => this.animate());
  }
}

// ── 20 MINIJUEGOS CON PERSONAJES DIBUJADOS ───────────────────────────────────

const MINIGAMES = [
  { id:1,  name:'¡Lluvia de Bananas!',   desc:'Atrapa las bananas que caen',         type:'catch',   dur:20 },
  { id:2,  name:'Esquiva el Rayo',        desc:'Muévete para esquivar los rayos',     type:'dodge',   dur:20 },
  { id:3,  name:'Carrera al Tesoro',      desc:'Sé el primero en llegar',             type:'race',    dur:22 },
  { id:4,  name:'Globos Locos',           desc:'Explota el mayor número de globos',   type:'tap',     dur:15 },
  { id:5,  name:'¡No te Quemes!',         desc:'Evita el suelo de fuego',             type:'jump',    dur:20 },
  { id:6,  name:'Sigue el Ritmo',         desc:'Pulsa al compás de la música',        type:'rhythm',  dur:18 },
  { id:7,  name:'Batalla de Estrellas',   desc:'Recoge estrellas, evita bombas',      type:'collect', dur:20 },
  { id:8,  name:'Lanzador de Cocos',      desc:'Apunta y lanza cocos al blanco',      type:'aim',     dur:18 },
  { id:9,  name:'Plataformas Árticas',    desc:'Salta entre plataformas heladas',     type:'platform',dur:22 },
  { id:10, name:'Duelo de Reflejos',      desc:'Pulsa cuando el semáforo sea verde',  type:'reflex',  dur:15 },
  { id:11, name:'Tormenta de Proyectiles',desc:'Esquiva todo lo que cae',             type:'dodge',   dur:22 },
  { id:12, name:'Carrera de Burbujas',    desc:'Lleva tu burbuja a la meta',          type:'race',    dur:20 },
  { id:13, name:'Bomba Caliente',         desc:'Pasa la bomba antes de que explote',  type:'pass',    dur:15 },
  { id:14, name:'Sumo Animal',            desc:'Empuja a los rivales fuera del ring', type:'push',    dur:20 },
  { id:15, name:'Colecta de Monedas',     desc:'Recoge más monedas que nadie',        type:'collect', dur:18 },
  { id:16, name:'Salto Extremo',          desc:'Salta los obstáculos sin caer',       type:'jump',    dur:20 },
  { id:17, name:'Velocidad del Rayo',     desc:'El primero en pulsar cuando aparezca',type:'reflex',  dur:12 },
  { id:18, name:'Laberinto Selvático',    desc:'Sal del laberinto primero',           type:'maze',    dur:25 },
  { id:19, name:'Tiro al Blanco',         desc:'El arquero más preciso gana',         type:'aim',     dur:18 },
  { id:20, name:'Gran Banana Party',      desc:'¡El minijuego definitivo!',           type:'collect', dur:25 },
];

const SUPER_MINIGAMES = [
  { id:1,  name:'Guerra de Nieve',    desc:'Equipos rojo vs azul',  type:'team_battle' },
  { id:2,  name:'Fútbol Animalesco',  desc:'Mete más goles',        type:'team_sport'  },
  { id:3,  name:'Captura la Banana',  desc:'Roba la banana rival',  type:'team_chase'  },
  { id:4,  name:'Tiro con Arco',      desc:'Equipo más preciso',    type:'team_aim'    },
  { id:5,  name:'Carrera de Relevos', desc:'El equipo más rápido',  type:'team_race'   },
];

// ── DIBUJO DE PERSONAJES TIPO 3D ─────────────────────────────────────────────
// Cada animal se dibuja con formas geométricas sobre canvas
const AnimalRenderer = {
  // Colores base por animal
  colors: {
    leon:     { body:'#E8A838', mane:'#8B4513',  detail:'#F4C542' },
    gorila:   { body:'#4A4A4A', mane:'#2A2A2A',  detail:'#8B7355' },
    oso:      { body:'#8B6914', mane:'#5C4A1A',  detail:'#D4A057' },
    pinguino: { body:'#1A1A2E', mane:'#FFFFFF',  detail:'#FF8C00' },
    tiburon:  { body:'#4682B4', mane:'#2F4F6F',  detail:'#FFFFFF' },
    orca:     { body:'#1A1A1A', mane:'#FFFFFF',  detail:'#F0F0F0' },
    elefante: { body:'#808080', mane:'#606060',  detail:'#A0A0A0' },
    girafa:   { body:'#DAA520', mane:'#8B6914',  detail:'#A0522D' },
    perro:    { body:'#D2691E', mane:'#A0522D',  detail:'#F4A460' },
    gato:     { body:'#BC8F8F', mane:'#8B6969',  detail:'#F5DEB3' },
    hamster:  { body:'#F5DEB3', mane:'#DEB887',  detail:'#FFB6C1' },
    lobo:     { body:'#778899', mane:'#556677',  detail:'#C0C8D0' },
  },

  // Dibuja un personaje tipo chibi 3D en (cx, cy) con tamaño r
  draw(ctx, animal, cx, cy, r, teamColor=null, isSelected=false) {
    const c = this.colors[animal] || this.colors.perro;
    const t = Date.now() * 0.003;

    ctx.save();
    ctx.translate(cx, cy);

    // Sombra en el suelo
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, r*0.85, r*0.7, r*0.18, 0, 0, Math.PI*2);
    ctx.fill();

    // Indicador de equipo / selección
    if (teamColor || isSelected) {
      ctx.beginPath();
      ctx.arc(0, 0, r*1.25, 0, Math.PI*2);
      ctx.fillStyle = (teamColor || '#FFD700') + '40';
      ctx.fill();
      ctx.strokeStyle = teamColor || '#FFD700';
      ctx.lineWidth   = 3;
      ctx.stroke();
    }

    // ── CUERPO (cilindro 3D simulado) ───────────────────────
    // Gradiente lateral para dar efecto 3D
    const bodyGrad = ctx.createRadialGradient(-r*0.2, -r*0.1, r*0.1, 0, 0, r*0.9);
    bodyGrad.addColorStop(0, this._lighten(c.body, 40));
    bodyGrad.addColorStop(0.6, c.body);
    bodyGrad.addColorStop(1, this._darken(c.body, 40));
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, r*0.25, r*0.55, r*0.65, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = this._darken(c.body, 20);
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // ── CABEZA ───────────────────────────────────────────────
    const headGrad = ctx.createRadialGradient(-r*0.15, -r*0.55, r*0.05, 0, -r*0.5, r*0.45);
    headGrad.addColorStop(0, this._lighten(c.body, 50));
    headGrad.addColorStop(0.5, c.body);
    headGrad.addColorStop(1, this._darken(c.body, 25));
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(0, -r*0.5, r*0.42, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = this._darken(c.body, 20);
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Rasgos específicos por animal
    this['_draw_' + animal]?.(ctx, r, c, t);
    if (!this['_draw_' + animal]) this._draw_default(ctx, r, c, t);

    // ── OJOS ─────────────────────────────────────────────────
    const eyeY = -r*0.55;
    [-r*0.16, r*0.16].forEach(ex => {
      // Blanco del ojo
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(ex, eyeY, r*0.1, r*0.11, 0, 0, Math.PI*2); ctx.fill();
      // Iris
      ctx.fillStyle = '#2A1A00';
      ctx.beginPath(); ctx.arc(ex + r*0.02, eyeY, r*0.065, 0, Math.PI*2); ctx.fill();
      // Brillo
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex + r*0.04, eyeY - r*0.03, r*0.025, 0, Math.PI*2); ctx.fill();
    });

    // ── BOCA ─────────────────────────────────────────────────
    ctx.strokeStyle = this._darken(c.body, 30);
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(0, -r*0.38, r*0.12, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // ── BRAZOS ───────────────────────────────────────────────
    const armSwing = Math.sin(t) * 0.3;
    [-1, 1].forEach(side => {
      ctx.save();
      ctx.translate(side * r * 0.52, r * 0.1);
      ctx.rotate(side * (0.4 + armSwing * side));
      const armGrad = ctx.createLinearGradient(0,0,0,r*0.45);
      armGrad.addColorStop(0, c.body);
      armGrad.addColorStop(1, this._darken(c.body,20));
      ctx.fillStyle = armGrad;
      ctx.beginPath();
      ctx.ellipse(0, r*0.22, r*0.14, r*0.28, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    });

    // ── PIERNAS ──────────────────────────────────────────────
    const legSwing = Math.sin(t + Math.PI) * 0.15;
    [-1, 1].forEach((side, i) => {
      ctx.save();
      ctx.translate(side * r * 0.24, r * 0.72);
      ctx.rotate(side * legSwing * (i===0?1:-1));
      ctx.fillStyle = this._darken(c.body, 15);
      ctx.beginPath();
      ctx.ellipse(0, r*0.18, r*0.16, r*0.22, 0, 0, Math.PI*2);
      ctx.fill();
      // Pie
      ctx.fillStyle = this._darken(c.body, 25);
      ctx.beginPath();
      ctx.ellipse(side*r*0.05, r*0.35, r*0.2, r*0.1, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    });

    ctx.restore();
  },

  // Rasgos únicos por animal
  _draw_leon(ctx, r, c) {
    // Melena
    for (let a = 0; a < Math.PI*2; a += Math.PI/6) {
      ctx.fillStyle = c.mane;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a)*r*0.5, -r*0.5+Math.sin(a)*r*0.48, r*0.14, r*0.2, a, 0, Math.PI*2);
      ctx.fill();
    }
    // Hocico
    ctx.fillStyle = c.detail;
    ctx.beginPath(); ctx.ellipse(0, -r*0.38, r*0.18, r*0.12, 0, 0, Math.PI*2); ctx.fill();
    // Nariz
    ctx.fillStyle = '#C0392B';
    ctx.beginPath(); ctx.ellipse(0, -r*0.43, r*0.05, r*0.035, 0, 0, Math.PI*2); ctx.fill();
    // Orejas
    [-1,1].forEach(s => {
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.arc(s*r*0.35, -r*0.85, r*0.12, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = c.detail;
      ctx.beginPath(); ctx.arc(s*r*0.35, -r*0.85, r*0.06, 0, Math.PI*2); ctx.fill();
    });
  },
  _draw_pinguino(ctx, r, c) {
    // Pechera blanca
    ctx.fillStyle = c.mane;
    ctx.beginPath(); ctx.ellipse(0, r*0.1, r*0.32, r*0.5, 0, 0, Math.PI*2); ctx.fill();
    // Pico naranja
    ctx.fillStyle = c.detail;
    ctx.beginPath(); ctx.moveTo(-r*0.08,-r*0.42); ctx.lineTo(r*0.08,-r*0.42); ctx.lineTo(0,-r*0.3); ctx.fill();
    // Orejas/aletas
    [-1,1].forEach(s => {
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.ellipse(s*r*0.5, r*0.15, r*0.1, r*0.25, s*0.4, 0, Math.PI*2); ctx.fill();
    });
  },
  _draw_tiburon(ctx, r, c) {
    // Aleta dorsal
    ctx.fillStyle = c.body;
    ctx.beginPath(); ctx.moveTo(0,-r*0.95); ctx.lineTo(-r*0.15,-r*0.62); ctx.lineTo(r*0.15,-r*0.62); ctx.fill();
    // Panza blanca
    ctx.fillStyle = c.mane;
    ctx.beginPath(); ctx.ellipse(0, r*0.2, r*0.3, r*0.45, 0, 0, Math.PI*2); ctx.fill();
    // Boca con dientes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0,-r*0.35, r*0.18, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#E74C3C';
    ctx.beginPath(); ctx.arc(0,-r*0.35, r*0.12, 0, Math.PI); ctx.fill();
  },
  _draw_elefante(ctx, r, c) {
    // Trompa
    ctx.strokeStyle = c.body; ctx.lineWidth = r*0.18;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0,-r*0.35); ctx.quadraticCurveTo(r*0.35,-r*0.2, r*0.3,-r*0.0); ctx.stroke();
    // Orejas grandes
    [-1,1].forEach(s => {
      ctx.fillStyle = c.mane;
      ctx.beginPath(); ctx.ellipse(s*r*0.62, -r*0.5, r*0.28, r*0.35, s*0.3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = c.detail;
      ctx.beginPath(); ctx.ellipse(s*r*0.62, -r*0.5, r*0.18, r*0.22, s*0.3, 0, Math.PI*2); ctx.fill();
    });
  },
  _draw_girafa(ctx, r, c) {
    // Cuello largo
    const neckGrad = ctx.createLinearGradient(-r*0.12,-r*1.1, r*0.12,-r*0.55);
    neckGrad.addColorStop(0, c.body); neckGrad.addColorStop(1, this._darken(c.body,10));
    ctx.fillStyle = neckGrad;
    ctx.beginPath(); ctx.rect(-r*0.15,-r*1.05, r*0.3, r*0.55); ctx.fill();
    // Manchas
    [[0,-r*0.7,r*0.08],[r*0.08,-r*0.9,r*0.06],[-r*0.1,-r*0.85,r*0.07]].forEach(([x,y,sr]) => {
      ctx.fillStyle = c.mane;
      ctx.beginPath(); ctx.arc(x,y,sr,0,Math.PI*2); ctx.fill();
    });
    // Orejitas
    [-1,1].forEach(s => {
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.arc(s*r*0.32,-r*0.88,r*0.1,0,Math.PI*2); ctx.fill();
    });
  },
  _draw_gorila(ctx, r, c) {
    // Cara más ancha
    ctx.fillStyle = c.mane;
    ctx.beginPath(); ctx.ellipse(0,-r*0.45, r*0.28, r*0.22, 0, 0, Math.PI*2); ctx.fill();
    // Nariz ancha
    ctx.fillStyle = this._darken(c.mane,20);
    ctx.beginPath(); ctx.ellipse(0,-r*0.42, r*0.12, r*0.08, 0, 0, Math.PI*2); ctx.fill();
    // Orejas
    [-1,1].forEach(s => {
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.arc(s*r*0.42,-r*0.5,r*0.1,0,Math.PI*2); ctx.fill();
    });
  },
  _draw_orca(ctx, r, c) {
    // Parche blanco
    ctx.fillStyle = c.mane;
    ctx.beginPath(); ctx.ellipse(r*0.15,-r*0.52, r*0.2, r*0.18, 0.4, 0, Math.PI*2); ctx.fill();
    // Aleta dorsal
    ctx.fillStyle = c.body;
    ctx.beginPath(); ctx.moveTo(0,-r*0.9); ctx.lineTo(-r*0.12,-r*0.65); ctx.lineTo(r*0.12,-r*0.65); ctx.fill();
    // Panza blanca
    ctx.fillStyle = c.mane;
    ctx.beginPath(); ctx.ellipse(0,r*0.2,r*0.28,r*0.42,0,0,Math.PI*2); ctx.fill();
  },
  _draw_oso(ctx, r, c) {
    ctx.fillStyle = c.detail;
    ctx.beginPath(); ctx.ellipse(0,-r*0.38, r*0.18, r*0.14, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = this._darken(c.detail,20);
    ctx.beginPath(); ctx.arc(0,-r*0.42, r*0.05, 0, Math.PI*2); ctx.fill();
    [-1,1].forEach(s => {
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.arc(s*r*0.38,-r*0.85,r*0.14,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = c.mane;
      ctx.beginPath(); ctx.arc(s*r*0.38,-r*0.85,r*0.08,0,Math.PI*2); ctx.fill();
    });
  },
  _draw_perro(ctx, r, c) {
    // Orejas caídas
    [-1,1].forEach(s => {
      ctx.fillStyle = c.mane;
      ctx.beginPath(); ctx.ellipse(s*r*0.42,-r*0.68,r*0.14,r*0.28,s*0.5,0,Math.PI*2); ctx.fill();
    });
    ctx.fillStyle = c.detail;
    ctx.beginPath(); ctx.ellipse(0,-r*0.38,r*0.16,r*0.11,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = this._darken(c.detail,20);
    ctx.beginPath(); ctx.arc(0,-r*0.43,r*0.05,0,Math.PI*2); ctx.fill();
  },
  _draw_gato(ctx, r, c) {
    // Orejas puntiagudas
    [-1,1].forEach(s => {
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.moveTo(s*r*0.15,-r*0.88); ctx.lineTo(s*r*0.42,-r*0.72); ctx.lineTo(s*r*0.28,-r*0.62); ctx.fill();
      ctx.fillStyle = '#FFB6C1';
      ctx.beginPath(); ctx.moveTo(s*r*0.16,-r*0.83); ctx.lineTo(s*r*0.38,-r*0.71); ctx.lineTo(s*r*0.28,-r*0.65); ctx.fill();
    });
    // Bigotes
    ctx.strokeStyle = this._darken(c.body,30); ctx.lineWidth = 1;
    [[-r*0.06,-r*0.38,-r*0.4,-r*0.36],[[-r*0.06,-r*0.4,-r*0.4,-r*0.44]]].forEach(l => {
      if (!Array.isArray(l[0])) {
        ctx.beginPath(); ctx.moveTo(l[0],l[1]); ctx.lineTo(l[2],l[3]); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-l[0],l[1]); ctx.lineTo(-l[2],l[3]); ctx.stroke();
      }
    });
  },
  _draw_hamster(ctx, r, c) {
    // Mejillas gordas
    [-1,1].forEach(s => {
      ctx.fillStyle = c.detail;
      ctx.beginPath(); ctx.arc(s*r*0.38,-r*0.46,r*0.18,0,Math.PI*2); ctx.fill();
    });
    // Orejitas redondas
    [-1,1].forEach(s => {
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.arc(s*r*0.35,-r*0.88,r*0.12,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#FFB6C1';
      ctx.beginPath(); ctx.arc(s*r*0.35,-r*0.88,r*0.07,0,Math.PI*2); ctx.fill();
    });
    // Nariz chiquita
    ctx.fillStyle = '#FF9999';
    ctx.beginPath(); ctx.arc(0,-r*0.43,r*0.04,0,Math.PI*2); ctx.fill();
  },
  _draw_lobo(ctx, r, c) {
    // Hocico
    ctx.fillStyle = c.detail;
    ctx.beginPath(); ctx.ellipse(0,-r*0.38,r*0.2,r*0.14,0,0,Math.PI*2); ctx.fill();
    // Orejas puntas
    [-1,1].forEach(s => {
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.moveTo(s*r*0.12,-r*0.88); ctx.lineTo(s*r*0.4,-r*0.7); ctx.lineTo(s*r*0.22,-r*0.62); ctx.fill();
      ctx.fillStyle = '#FFB6C1';
      ctx.beginPath(); ctx.moveTo(s*r*0.14,-r*0.84); ctx.lineTo(s*r*0.36,-r*0.71); ctx.lineTo(s*r*0.24,-r*0.66); ctx.fill();
    });
    ctx.fillStyle = '#3A2A1A';
    ctx.beginPath(); ctx.arc(0,-r*0.43,r*0.06,0,Math.PI*2); ctx.fill();
  },
  _draw_default(ctx, r, c) {
    ctx.fillStyle = c.detail;
    ctx.beginPath(); ctx.arc(0,-r*0.4,r*0.08,0,Math.PI*2); ctx.fill();
  },

  // Helpers de color
  _lighten(hex, amt) {
    const n = parseInt(hex.replace('#',''),16);
    const r = Math.min(255,((n>>16)&0xff)+amt);
    const g = Math.min(255,((n>>8)&0xff)+amt);
    const b = Math.min(255,(n&0xff)+amt);
    return `rgb(${r},${g},${b})`;
  },
  _darken(hex, amt) { return this._lighten(hex, -amt); },
};

// ── MOTOR DE MINIJUEGOS ───────────────────────────────────────────────────────
class MinigameEngine {
  constructor(canvasId, selfId, players, mgData, onFinish) {
    this.canvas   = document.getElementById(canvasId);
    this.ctx      = this.canvas.getContext('2d');
    this.selfId   = selfId;
    this.players  = players;  // array de {id, username, animal, color, team}
    this.data     = mgData;
    this.onFinish = onFinish;
    this.running  = false;
    this.scores   = {};
    players.forEach(p => this.scores[p.id] = 0);

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    this.canvas.width  = this.canvas.offsetWidth  * devicePixelRatio;
    this.canvas.height = this.canvas.offsetHeight * devicePixelRatio;
    this.ctx.scale(devicePixelRatio, devicePixelRatio);
    this.W = this.canvas.offsetWidth;
    this.H = this.canvas.offsetHeight;
  }

  start() {
    this.running   = true;
    this.startTime = Date.now();
    this.duration  = (this.data.dur || 20) * 1000;
    this._setup();
    this._bindInput();
    this._loop();
  }

  destroy() { this.running = false; }

  // ── SETUP POR TIPO ────────────────────────────────────────
  _setup() {
    this.objs     = [];
    this.myX      = this.W / 2;
    this.myY      = this.H * 0.75;
    this.myVx     = 0;
    this.myVy     = 0;
    this.score    = 0;
    this.frame    = 0;
    this.ground   = this.H * 0.82;
    this.jumping  = false;
    this.botScores= {};
    this.players.filter(p => p.id !== this.selfId)
      .forEach(p => this.botScores[p.id] = 0);

    const t = this.data.type;
    if (t === 'catch' || t === 'collect') this._spawnItems(8);
    if (t === 'dodge' || t === 'jump')    this._spawnObstacles(4);
    if (t === 'race')  { this.myY = this.H*0.8; this.raceX = 80; }
    if (t === 'tap')   this._spawnTapItems(12);
    if (t === 'reflex'){ this.light = 'red'; this.lightTimer = 0; this.reacted = false; }
    if (t === 'rhythm'){ this.beat = 0; this.nextBeat = 800; this.combo = 0; }
    if (t === 'aim')   { this.targets = []; this._spawnTargets(5); }
    if (t === 'maze')  this._buildMaze();
    if (t === 'platform') this._buildPlatforms();
  }

  _spawnItems(n) {
    for (let i = 0; i < n; i++) this.objs.push(this._newItem());
  }
  _newItem() {
    const items = ['🍌','⭐','💎','🍊','🎁'];
    const vals   = [3,8,15,4,10];
    const idx    = Math.floor(Math.random()*items.length);
    return { x:50+Math.random()*(this.W-100), y:-30-Math.random()*300,
      vy:1.5+Math.random()*2.5, r:18, emoji:items[idx], val:vals[idx], hit:false };
  }

  _spawnObstacles(n) {
    for (let i = 0; i < n; i++) {
      this.objs.push({
        x: Math.random()*this.W, y: -50-Math.random()*300,
        vy: 3+Math.random()*3, r:22, type:'obs', emoji:'🔥', hit:false
      });
    }
  }

  _spawnTapItems(n) {
    const emojis = ['🎈','🎈','🎈','💣'];
    for (let i = 0; i < n; i++) {
      this.objs.push({
        x:60+Math.random()*(this.W-120), y:100+Math.random()*(this.H-200),
        r:28, emoji:emojis[Math.floor(Math.random()*emojis.length)],
        vy:-0.3-Math.random()*0.5, life:1, popped:false
      });
    }
  }

  _spawnTargets(n) {
    for (let i = 0; i < n; i++) {
      this.targets.push({
        x:80+Math.random()*(this.W-160), y:80+Math.random()*(this.H*0.5),
        r:30, speed:(Math.random()-0.5)*3, vy:(Math.random()-0.5)*2, hit:false, alpha:1
      });
    }
  }

  _buildPlatforms() {
    this.platforms = [];
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      const y = this.H*0.75 - r*this.H*0.15;
      for (let c = 0; c < 3; c++) {
        this.platforms.push({ x:c*(this.W/3)+20, y, w:this.W/3-30, h:14 });
      }
    }
    this.myY    = this.H*0.8;
    this.myVy   = 0;
    this.myPosY = this.H*0.8;
    this.goalY  = 60;
  }

  _buildMaze() {
    // Laberinto simple con paredes
    this.walls = [];
    this.mazeX = 40; this.mazeY = this.H-80;
    this.goalX = this.W-40; this.goalY = 60;
    // Paredes horizontales
    const rows = 5, cols = 5;
    const cw = (this.W-60)/cols, ch = (this.H-100)/rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() > 0.45 && !(r===rows-1&&c===cols-1)) {
          this.walls.push({ x:30+c*cw+cw*0.2, y:50+r*ch, w:cw*0.6, h:10 });
        }
      }
    }
  }

  // ── INPUT ─────────────────────────────────────────────────
  _bindInput() {
    this.keysDown = {};
    this._keyDown = e => { this.keysDown[e.key] = true; this._onKey(e.key); };
    this._keyUp   = e => { this.keysDown[e.key] = false; };
    this._click   = e => { this._onClick(e); };
    this._touch   = e => { e.preventDefault(); this._onTouch(e); };
    this._touchM  = e => { e.preventDefault(); this._onTouchMove(e); };
    window.addEventListener('keydown', this._keyDown);
    window.addEventListener('keyup',   this._keyUp);
    this.canvas.addEventListener('click',      this._click);
    this.canvas.addEventListener('touchstart', this._touch,  {passive:false});
    this.canvas.addEventListener('touchmove',  this._touchM, {passive:false});
  }

  _unbindInput() {
    window.removeEventListener('keydown', this._keyDown);
    window.removeEventListener('keyup',   this._keyUp);
    this.canvas.removeEventListener('click',      this._click);
    this.canvas.removeEventListener('touchstart', this._touch);
    this.canvas.removeEventListener('touchmove',  this._touchM);
  }

  _onKey(key) {
    if (key === ' ' || key === 'ArrowUp' || key === 'w') {
      if (!this.jumping && (this.data.type === 'jump' || this.data.type === 'platform')) {
        this.myVy = -14; this.jumping = true;
      }
    }
    if (this.data.type === 'reflex' && key === ' ') this._reactReflex();
    if (this.data.type === 'rhythm' && key === ' ') this._reactRhythm();
  }

  _onClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mx   = (e.clientX - rect.left);
    const my   = (e.clientY - rect.top);
    this._handleClick(mx, my);
  }

  _onTouch(e) {
    const rect = this.canvas.getBoundingClientRect();
    const t    = e.touches[0];
    const mx   = t.clientX - rect.left;
    const my   = t.clientY - rect.top;
    this._handleClick(mx, my);
  }

  _onTouchMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const t    = e.touches[0];
    this.myX   = t.clientX - rect.left;
    if (this.data.type === 'maze') this.mazeX = this.myX;
  }

  _handleClick(mx, my) {
    const t = this.data.type;
    if (t === 'catch' || t === 'collect') {
      this.objs.forEach(o => {
        if (!o.hit && Math.hypot(mx-o.x, my-o.y) < o.r+10) {
          o.hit = true; this.score += o.val;
          setTimeout(() => { Object.assign(o, this._newItem()); o.hit = false; }, 300);
        }
      });
    }
    if (t === 'tap') {
      this.objs.forEach(o => {
        if (!o.popped && Math.hypot(mx-o.x, my-o.y) < o.r+10) {
          o.popped = true;
          this.score += o.emoji === '🎈' ? 5 : -8;
          setTimeout(() => { o.popped=false; o.x=60+Math.random()*(this.W-120);
            o.y=100+Math.random()*(this.H-200); o.emoji=Math.random()<0.75?'🎈':'💣'; }, 400);
        }
      });
    }
    if (t === 'aim') {
      this.targets.forEach(tg => {
        if (!tg.hit && Math.hypot(mx-tg.x, my-tg.y) < tg.r+8) {
          tg.hit = true; this.score += 10;
          setTimeout(() => {
            Object.assign(tg, { x:80+Math.random()*(this.W-160), y:80+Math.random()*(this.H*0.5), hit:false, alpha:1 });
            this._spawnTargets(1);
          }, 500);
        }
      });
    }
    if (t === 'reflex') this._reactReflex();
    if (t === 'rhythm') this._reactRhythm();
    // Salto por tap
    if ((t === 'jump' || t === 'platform') && !this.jumping) {
      this.myVy = -14; this.jumping = true;
    }
  }

  _reactReflex() {
    if (this.light === 'green' && !this.reacted) {
      this.reacted = true; this.score += 20;
    } else if (this.light === 'red') {
      this.score = Math.max(0, this.score - 10);
    }
  }

  _reactRhythm() {
    const elapsed = Date.now() - this.startTime;
    const dist    = Math.abs(elapsed % this.nextBeat - this.nextBeat/2);
    if (dist < 120) { this.score += 10 + this.combo*2; this.combo++; }
    else            { this.combo = 0; }
  }

  // ── LOOP ──────────────────────────────────────────────────
  _loop() {
    if (!this.running) return;
    const elapsed = Date.now() - this.startTime;
    const pct     = Math.max(0, 1 - elapsed / this.duration);

    // Timer UI
    const fill = document.getElementById('mg-timer-fill');
    const txt  = document.getElementById('mg-timer-text');
    if (fill) fill.style.width = (pct*100)+'%';
    if (fill) fill.style.background = pct < 0.3
      ? 'linear-gradient(90deg,#E74C3C,#ff6b6b)'
      : 'linear-gradient(90deg,#00b09b,#FFD700)';
    if (txt)  txt.textContent = Math.ceil((this.duration-elapsed)/1000)+'s';

    this._update(elapsed);
    this._draw();
    this.frame++;

    if (elapsed >= this.duration) { this.running = false; this._unbindInput(); this._finish(); return; }
    requestAnimationFrame(() => this._loop());
  }

  // ── UPDATE ────────────────────────────────────────────────
  _update(elapsed) {
    const t   = this.data.type;
    const spd = 4.5;

    // Movimiento horizontal base (WASD / flechas)
    if (this.keysDown['ArrowLeft']  || this.keysDown['a'] || this.keysDown['A']) this.myX -= spd;
    if (this.keysDown['ArrowRight'] || this.keysDown['d'] || this.keysDown['D']) this.myX += spd;
    if ((t==='maze'||t==='race') && (this.keysDown['ArrowUp']||this.keysDown['w'])) this.myY -= spd*0.8;
    if ((t==='maze')             && (this.keysDown['ArrowDown']||this.keysDown['s'])) this.myY += spd*0.8;
    this.myX = Math.max(24, Math.min(this.W-24, this.myX));
    this.myY = Math.max(24, Math.min(this.H-24, this.myY));

    // Gravedad para jump/platform
    if (t === 'jump' || t === 'platform') {
      this.myVy += 0.7;
      this.myY  += this.myVy;
      if (t === 'platform') {
        this.platforms.forEach(pl => {
          if (this.myVy>0 && this.myY>pl.y && this.myY<pl.y+pl.h+20 &&
              this.myX>pl.x && this.myX<pl.x+pl.w) {
            this.myY = pl.y; this.myVy = 0; this.jumping = false;
          }
        });
        if (this.myY >= this.H*0.9) { this.myY = this.H*0.9; this.myVy=0; this.jumping=false; }
        if (this.myY <= this.goalY+20) { this.score += 30; this.myY = this.H*0.8; }
      } else {
        if (this.myY >= this.ground) { this.myY=this.ground; this.myVy=0; this.jumping=false; }
      }
    }

    // Bots (movimiento simulado)
    this.players.filter(p=>p.id!==this.selfId).forEach(p => {
      this.botScores[p.id] = (this.botScores[p.id]||0) + (Math.random()*0.15);
    });

    // Objetos cayendo
    if (t==='catch'||t==='collect'||t==='dodge') {
      this.objs.forEach(o => {
        o.y += o.vy;
        if (o.y > this.H+40) {
          o.y = -30; o.x = 50+Math.random()*(this.W-100);
        }
        if (t!=='dodge' && !o.hit && Math.hypot(this.myX-o.x, this.myY-o.y)<o.r+20) {
          o.hit=true; this.score+=o.val;
          setTimeout(()=>{Object.assign(o,this._newItem());o.hit=false;},200);
        }
        if (t==='dodge' && !o.hit && Math.hypot(this.myX-o.x, this.myY-o.y)<o.r+16) {
          this.score = Math.max(0, this.score-5);
          o.hit=true; setTimeout(()=>{o.hit=false;o.y=-30;o.x=Math.random()*this.W;},500);
        }
      });
      this.score += 0.02; // sobrevivir da puntos
    }

    // Semáforo
    if (t === 'reflex') {
      this.lightTimer += 16;
      if (this.lightTimer > (this.light==='red' ? 2000+Math.random()*2000 : 1200)) {
        this.lightTimer = 0; this.reacted = false;
        this.light = this.light==='red' ? 'green' : 'red';
      }
    }

    // Race
    if (t === 'race') {
      if (this.keysDown['ArrowLeft']||this.keysDown['a']) this.raceX -= spd;
      if (this.keysDown['ArrowRight']||this.keysDown['d']) this.raceX += spd;
      this.raceX = Math.max(40, Math.min(this.W-40, this.raceX));
      if (this.myY < 60) { this.score += 50; this.myY = this.H*0.8; }
      this.myY -= 1.4;
      if (this.myY < 60) this.myY = 60;
      this.score = Math.max(0, (this.H*0.8 - this.myY));
    }

    // Targets
    if (t==='aim') {
      this.targets.forEach(tg => {
        if (!tg.hit) { tg.x += tg.speed; tg.y += tg.vy;
          if (tg.x<40||tg.x>this.W-40) tg.speed*=-1;
          if (tg.y<40||tg.y>this.H*0.65) tg.vy*=-1;
        }
      });
    }

    // Maze: colisiones con paredes
    if (t==='maze') {
      this.walls.forEach(w => {
        if (this.mazeX>w.x-15&&this.mazeX<w.x+w.w+15&&this.myY>w.y-15&&this.myY<w.y+w.h+15)
          this.myY += 3;
      });
      if (this.mazeX > this.W-50 && this.myY < 100) this.score += 60;
    }
  }

  // ── DRAW ──────────────────────────────────────────────────
  _draw() {
    const ctx = this.ctx;
    const t   = this.data.type;
    ctx.clearRect(0,0,this.W,this.H);

    // Fondo temático
    this._drawBg(t);

    // Objetos del juego
    this._drawGameObjects(t);

    // Mi personaje
    const me = this.players.find(p=>p.id===this.selfId);
    if (me) {
      const px = t==='race' ? this.raceX : this.myX;
      AnimalRenderer.draw(ctx, me.animal, px, this.myY, 32, me.color, true);
    }

    // Bots (fantasmas visuales en posiciones generadas)
    this.players.filter(p=>p.id!==this.selfId).forEach((p,i) => {
      const bx = 80+i*(this.W-160)/Math.max(1,this.players.length-1);
      const by = this.ground - (this.botScores[p.id]||0)*0.8;
      AnimalRenderer.draw(ctx, p.animal, bx, Math.max(60,by), 26, p.color, false);
    });

    // Score panel
    this._drawScorePanel();
  }

  _drawBg(t) {
    const ctx = this.ctx;
    const bgs = {
      catch:   ['#0a1628','#1a2840'],
      collect: ['#0a2010','#142d18'],
      dodge:   ['#1a0a28','#2d1440'],
      jump:    ['#0a1a28','#142535'],
      race:    ['#0d2010','#1a3018'],
      tap:     ['#1a1a0a','#2d2d14'],
      reflex:  ['#0a0a0a','#1a1a1a'],
      rhythm:  ['#1a0028','#2d003f'],
      aim:     ['#1a0a0a','#2d1414'],
      maze:    ['#0a1a0a','#142514'],
      platform:['#0a0a1a','#141428'],
    };
    const [c1,c2] = bgs[t]||['#080c14','#0d1420'];
    const grad = ctx.createLinearGradient(0,0,0,this.H);
    grad.addColorStop(0,c1); grad.addColorStop(1,c2);
    ctx.fillStyle = grad; ctx.fillRect(0,0,this.W,this.H);

    // Estrellas de fondo
    ctx.fillStyle='rgba(255,255,255,0.4)';
    for (let i=0;i<30;i++) {
      const x=(Math.sin(i*234.5)*0.5+0.5)*this.W;
      const y=(Math.cos(i*567.8)*0.5+0.5)*this.H*0.7;
      ctx.beginPath(); ctx.arc(x,y,1,0,Math.PI*2); ctx.fill();
    }

    // Suelo
    const gGrad = ctx.createLinearGradient(0,this.ground-10,0,this.ground+30);
    gGrad.addColorStop(0,'rgba(255,255,255,0.08)');
    gGrad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = gGrad;
    ctx.fillRect(0,this.ground-10,this.W,40);

    ctx.strokeStyle='rgba(255,255,255,0.12)';
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(0,this.ground); ctx.lineTo(this.W,this.ground); ctx.stroke();

    // Elementos de fondo por tipo
    if (t==='reflex') this._drawSemaforo();
    if (t==='platform') this._drawPlatformBg();
    if (t==='maze') this._drawMazeBg();
    if (t==='race') this._drawRaceBg();
  }

  _drawSemaforo() {
    const ctx=this.ctx;
    const cx=this.W/2, cy=80;
    ctx.fillStyle='#222'; this._rr(ctx,cx-30,cy-55,60,110,10); ctx.fill();
    ctx.strokeStyle='#555'; ctx.lineWidth=2; ctx.stroke();
    [{c:this.light==='red'?'#FF3B30':'#330000',y:cy-28},
     {c:'#222200',y:cy},
     {c:this.light==='green'?'#34C759':'#003300',y:cy+28}
    ].forEach(({c,y})=>{
      ctx.fillStyle=c; ctx.beginPath(); ctx.arc(cx,y,14,0,Math.PI*2); ctx.fill();
    });
    ctx.fillStyle=this.light==='green'?'#34C759':'#FF3B30';
    ctx.font='bold 14px sans-serif'; ctx.textAlign='center';
    ctx.fillText(this.light==='green'?'¡PULSA!':'Espera…',cx,cy+70);
  }

  _drawPlatformBg() {
    if (!this.platforms) return;
    const ctx=this.ctx;
    ctx.fillStyle='#FFD700';
    // Meta
    ctx.font='24px serif'; ctx.textAlign='center';
    ctx.fillText('🏁',this.W/2,this.goalY+20);
    this.platforms.forEach(pl => {
      const g=ctx.createLinearGradient(pl.x,pl.y,pl.x,pl.y+pl.h);
      g.addColorStop(0,'#A8E6CF'); g.addColorStop(1,'#5CB85C');
      ctx.fillStyle=g;
      this._rr(ctx,pl.x,pl.y,pl.w,pl.h,5); ctx.fill();
      ctx.strokeStyle='#4A9A4A'; ctx.lineWidth=1.5; ctx.stroke();
    });
  }

  _drawMazeBg() {
    if (!this.walls) return;
    const ctx=this.ctx;
    // Meta
    ctx.font='24px serif'; ctx.textAlign='center';
    ctx.fillText('🏆',this.W-40,70);
    this.walls.forEach(w => {
      const g=ctx.createLinearGradient(w.x,w.y,w.x+w.w,w.y+w.h);
      g.addColorStop(0,'#4ECDC4'); g.addColorStop(1,'#26A69A');
      ctx.fillStyle=g;
      this._rr(ctx,w.x,w.y,w.w,w.h,4); ctx.fill();
      ctx.strokeStyle='#00796B'; ctx.lineWidth=1.5; ctx.stroke();
    });
  }

  _drawRaceBg() {
    const ctx=this.ctx;
    // Líneas de carretera
    ctx.strokeStyle='rgba(255,255,255,0.15)';
    ctx.lineWidth=2; ctx.setLineDash([20,15]);
    [this.W*0.33,this.W*0.66].forEach(x=>{
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,this.H); ctx.stroke();
    });
    ctx.setLineDash([]);
    // Meta
    ctx.font='20px serif'; ctx.textAlign='center';
    ctx.fillText('🏁',this.W/2,50);
  }

  _drawGameObjects(t) {
    const ctx=this.ctx;
    if (t==='catch'||t==='collect') {
      this.objs.forEach(o => {
        if (o.hit) return;
        ctx.font=`${o.r*1.6}px serif`; ctx.textAlign='center';
        ctx.fillText(o.emoji,o.x,o.y+o.r*0.8);
        // Brillo
        ctx.strokeStyle='rgba(255,215,0,0.4)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(o.x,o.y,o.r,0,Math.PI*2); ctx.stroke();
      });
    }
    if (t==='dodge') {
      this.objs.forEach(o=>{
        if(o.hit)return;
        ctx.font='38px serif'; ctx.textAlign='center';
        ctx.fillText(o.emoji,o.x,o.y+16);
        // Aura de peligro
        ctx.strokeStyle='rgba(231,76,60,0.5)'; ctx.lineWidth=3;
        ctx.beginPath(); ctx.arc(o.x,o.y,o.r,0,Math.PI*2); ctx.stroke();
      });
    }
    if (t==='tap') {
      this.objs.forEach(o=>{
        if(o.popped)return;
        o.y+=o.vy;
        if(o.y<60||o.y>this.H-60){o.vy*=-1;}
        ctx.font='50px serif'; ctx.textAlign='center';
        ctx.globalAlpha=o.life;
        ctx.fillText(o.emoji,o.x,o.y+20);
        ctx.globalAlpha=1;
        ctx.strokeStyle=o.emoji==='🎈'?'rgba(100,200,255,0.5)':'rgba(255,80,80,0.5)';
        ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(o.x,o.y,o.r,0,Math.PI*2); ctx.stroke();
      });
    }
    if (t==='aim') {
      this.targets.forEach(tg=>{
        if(tg.hit)return;
        // Anillos del blanco
        [[tg.r,'#E74C3C'],[tg.r*0.66,'#fff'],[tg.r*0.33,'#E74C3C']].forEach(([r,c])=>{
          ctx.fillStyle=c; ctx.beginPath(); ctx.arc(tg.x,tg.y,r,0,Math.PI*2); ctx.fill();
        });
        ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(tg.x,tg.y,tg.r,0,Math.PI*2); ctx.stroke();
      });
    }
    if (t==='rhythm') {
      // Indicador de ritmo
      const elapsed=Date.now()-this.startTime;
      const phase=(elapsed%this.nextBeat)/this.nextBeat;
      const pulse=Math.abs(Math.sin(phase*Math.PI));
      ctx.fillStyle=`rgba(255,215,0,${0.15+pulse*0.4})`;
      ctx.beginPath(); ctx.arc(this.W/2,this.H/2,80+pulse*30,0,Math.PI*2); ctx.fill();
      ctx.font='60px serif'; ctx.textAlign='center';
      ctx.globalAlpha=0.3+pulse*0.7;
      ctx.fillText('🎵',this.W/2,this.H/2+20);
      ctx.globalAlpha=1;
      ctx.font='bold 18px sans-serif'; ctx.fillStyle='#FFD700';
      ctx.fillText(`Combo: x${this.combo}`,this.W/2,this.H-60);
    }
  }

  _drawScorePanel() {
    const ctx=this.ctx;
    // Panel superior izquierdo
    ctx.fillStyle='rgba(0,0,0,0.65)';
    this._rr(ctx,8,8,220,64,10); ctx.fill();
    ctx.strokeStyle='rgba(255,215,0,0.4)'; ctx.lineWidth=1.5; ctx.stroke();

    const me=this.players.find(p=>p.id===this.selfId);
    if(me){
      AnimalRenderer.draw(ctx,me.animal,36,40,18);
      ctx.font='bold 11px sans-serif'; ctx.fillStyle='#FFD700'; ctx.textAlign='left';
      ctx.fillText(me.username.slice(0,12),58,30);
      ctx.font='bold 18px sans-serif'; ctx.fillStyle='#fff';
      ctx.fillText(`⭐ ${Math.floor(this.score)}`,58,50);
    }

    // Ranking lateral
    const all=[
      {id:this.selfId, score:Math.floor(this.score), ...this.players.find(p=>p.id===this.selfId)},
      ...this.players.filter(p=>p.id!==this.selfId).map(p=>({
        ...p, score:Math.floor(this.botScores[p.id]||0)
      }))
    ].sort((a,b)=>b.score-a.score);

    ctx.fillStyle='rgba(0,0,0,0.6)';
    this._rr(ctx,this.W-148,8,140,all.length*22+16,10); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1; ctx.stroke();

    all.forEach((p,i)=>{
      const isMe=p.id===this.selfId;
      ctx.font=`${isMe?'bold ':' '}10px sans-serif`;
      ctx.fillStyle=isMe?'#FFD700':'rgba(255,255,255,0.75)';
      ctx.textAlign='left';
      const medal=['🥇','🥈','🥉'][i]||`${i+1}.`;
      ctx.fillText(`${medal} ${(p.username||'?').slice(0,8)}`,this.W-140,26+i*22);
      ctx.textAlign='right';
      ctx.fillStyle=isMe?'#FFD700':'#aaa';
      ctx.fillText(p.score,this.W-12,26+i*22);
    });
  }

  _rr(ctx,x,y,w,h,r){
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

  // ── FINISH ────────────────────────────────────────────────
  _finish() {
    const all = [
      { id:this.selfId, score:Math.floor(this.score) },
      ...this.players.filter(p=>p.id!==this.selfId).map(p=>({
        id:p.id, score:Math.floor(this.botScores[p.id]||0)
      }))
    ].sort((a,b)=>b.score-a.score);

    this.onFinish({
      type:'normal',
      winner: all[0]?.id || null,
      second: all[1]?.id || null,
      third:  all[2]?.id || null,
      scores: all
    });
  }
}

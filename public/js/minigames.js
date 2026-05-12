// ── DEFINICIÓN DE 100+ MINIJUEGOS ────────────────────────────────────────────
// Cada minijuego tiene: id, name, desc, type(tap/dodge/race/memory/reflex/puzzle),
// players(min,max), duration(s), instructions

const MINIGAMES = [
  // ── TAP/CLICK RÁPIDO (1-20) ──────────────────────────────
  {id:1,  name:'¡Banana Frenzy!',       desc:'Toca la pantalla lo más rápido posible',          type:'tap',    min:2,max:8, dur:10},
  {id:2,  name:'Colecta de Frutas',      desc:'Recoge las frutas que caen del cielo',            type:'catch',  min:2,max:8, dur:15},
  {id:3,  name:'¡No toques el rojo!',   desc:'Toca solo los círculos amarillos',                type:'tap',    min:2,max:8, dur:12},
  {id:4,  name:'Suma Rápida',           desc:'Calcula la suma y presiona el resultado',         type:'math',   min:2,max:8, dur:15},
  {id:5,  name:'Memoria Animal',        desc:'Repite la secuencia de animales',                  type:'memory', min:2,max:4, dur:30},
  {id:6,  name:'Escalada Veloz',        desc:'Llega a la cima antes que los demás',             type:'race',   min:2,max:8, dur:20},
  {id:7,  name:'Globos Explosivos',     desc:'Infla tu globo pero no lo revientes',             type:'hold',   min:2,max:8, dur:15},
  {id:8,  name:'Carrera de Cangrejos',  desc:'Mueve tu cangrejo a la meta',                     type:'race',   min:2,max:6, dur:20},
  {id:9,  name:'Lluvia de Estrellas',   desc:'Atrapa la mayor cantidad de estrellas',           type:'catch',  min:2,max:8, dur:15},
  {id:10, name:'Piedra Papel Tijera',   desc:'Gana 3 rondas de P-P-T',                          type:'rps',    min:2,max:8, dur:20},
  {id:11, name:'Tambor Selvático',      desc:'Sigue el ritmo del tambor',                       type:'rhythm', min:2,max:6, dur:20},
  {id:12, name:'Puntería Animal',       desc:'Apunta y dispara a los blancos',                  type:'aim',    min:2,max:8, dur:15},
  {id:13, name:'Laberinto Rápido',      desc:'Sal del laberinto lo antes posible',               type:'maze',   min:2,max:4, dur:30},
  {id:14, name:'Ruleta de Preguntas',   desc:'Responde preguntas de animales',                  type:'trivia', min:2,max:8, dur:25},
  {id:15, name:'Saltador Extremo',      desc:'Salta los obstáculos sin caerte',                  type:'dodge',  min:2,max:6, dur:20},
  {id:16, name:'Colores Locos',         desc:'Presiona el botón del color que se muestra',      type:'reflex', min:2,max:8, dur:15},
  {id:17, name:'Carreras en la Selva',  desc:'Corre entre los árboles al ritmo de las notas',   type:'race',   min:2,max:8, dur:20},
  {id:18, name:'Pesca Veloz',           desc:'Pesca la mayor cantidad de peces',                type:'catch',  min:2,max:6, dur:15},
  {id:19, name:'Bomba Caliente',        desc:'Pasa la bomba antes de que explote',               type:'pass',   min:2,max:8, dur:15},
  {id:20, name:'Pinball Animal',        desc:'Mantén la bola en juego el mayor tiempo',         type:'reflex', min:2,max:4, dur:20},
  // ── REFLEJOS (21-40) ──────────────────────────────────────
  {id:21, name:'Semáforo Loco',         desc:'Para cuando sea rojo, avanza en verde',            type:'reflex', min:2,max:8, dur:15},
  {id:22, name:'Piso Electrificado',    desc:'Evita los paneles del piso que se iluminan',      type:'dodge',  min:2,max:6, dur:20},
  {id:23, name:'Disparos del Cielo',    desc:'Esquiva los rayos que caen del cielo',             type:'dodge',  min:2,max:8, dur:20},
  {id:24, name:'Cocinero Veloz',        desc:'Sirve los pedidos en orden correcto',              type:'sequence',min:2,max:4,dur:25},
  {id:25, name:'Equilibrista Animal',   desc:'Mantén el balance en la cuerda floja',            type:'balance',min:2,max:4,dur:20},
  {id:26, name:'Explosión de Notas',    desc:'Presiona las notas musicales a tiempo',           type:'rhythm', min:2,max:8, dur:20},
  {id:27, name:'Pelota de Nieve',       desc:'Construye el muñeco más alto',                    type:'build',  min:2,max:6, dur:20},
  {id:28, name:'Surfista Extremo',      desc:'Mantente en la ola el mayor tiempo',              type:'balance',min:2,max:6, dur:20},
  {id:29, name:'Deslizamiento Ártico',  desc:'Llega primero a la base del glaciar',             type:'race',   min:2,max:8, dur:15},
  {id:30, name:'Burbuja Ninja',         desc:'Revienta las burbujas de enemigo, no las tuyas',  type:'aim',    min:2,max:6, dur:20},
  {id:31, name:'Contador Loco',         desc:'Cuenta los animales que aparecen',                type:'count',  min:2,max:8, dur:15},
  {id:32, name:'Cartas Memoria',        desc:'Encuentra los pares en el menor tiempo',          type:'memory', min:2,max:4, dur:30},
  {id:33, name:'Twister Selvático',     desc:'Pon manos y pies en los colores correctos',       type:'reflex', min:2,max:6, dur:20},
  {id:34, name:'Cascada de Bloques',    desc:'Apila los bloques sin que caigan',                type:'build',  min:2,max:4, dur:25},
  {id:35, name:'Competencia de Ruidos', desc:'Imita el sonido del animal que aparece',          type:'tap',    min:2,max:8, dur:15},
  {id:36, name:'Esquiva Meteoritos',    desc:'Sobrevive la lluvia de meteoritos',               type:'dodge',  min:2,max:8, dur:20},
  {id:37, name:'Carrera de Tortugas',   desc:'Guía tu tortuga a la meta (lenta pero segura)',   type:'race',   min:2,max:6, dur:30},
  {id:38, name:'Ruleta de Colores',     desc:'Adivina en qué color parará la ruleta',           type:'guess',  min:2,max:8, dur:20},
  {id:39, name:'Cadena Musical',        desc:'Continúa la melodía tocando las notas',           type:'rhythm', min:2,max:6, dur:25},
  {id:40, name:'Arena de Puños',        desc:'Golpea primero para ganar',                       type:'reflex', min:2,max:8, dur:10},
  // ── ESTRATEGIA (41-60) ────────────────────────────────────
  {id:41, name:'Hundir la Flota',       desc:'Encuentra los barcos del enemigo',                type:'strategy',min:2,max:2,dur:40},
  {id:42, name:'Cuatro en Línea',       desc:'Forma una línea de cuatro fichas',                type:'strategy',min:2,max:2,dur:30},
  {id:43, name:'Comecocos Animalesco',  desc:'Come todos los puntos sin que te atrapen',        type:'maze',   min:2,max:4, dur:30},
  {id:44, name:'Torre de Defensa',      desc:'Defiende tu base de los invasores',               type:'strategy',min:2,max:4,dur:35},
  {id:45, name:'Ping Pong Selvático',   desc:'Marca 5 puntos antes que el rival',               type:'sport',  min:2,max:2, dur:30},
  {id:46, name:'Fútbol Animal',         desc:'Mete el gol en el tiempo reglamentario',          type:'sport',  min:2,max:6, dur:30},
  {id:47, name:'Baloncesto Extremo',    desc:'Encesta la mayor cantidad de canastas',           type:'sport',  min:2,max:6, dur:20},
  {id:48, name:'Voleibol en la Playa',  desc:'El que deje caer el balón pierde',                type:'sport',  min:2,max:6, dur:25},
  {id:49, name:'Carrera de Obstáculos', desc:'Supera todos los obstáculos hasta la meta',       type:'race',   min:2,max:8, dur:25},
  {id:50, name:'Batalla de Bolas',      desc:'Golpea a los rivales con bolas de nieve',         type:'aim',    min:2,max:8, dur:25},
  {id:51, name:'Escape de la Jungla',   desc:'Todos huyen del depredador',                      type:'chase',  min:3,max:8, dur:30},
  {id:52, name:'Captura la Bandera',    desc:'Lleva la bandera a tu base',                      type:'strategy',min:2,max:8,dur:30},
  {id:53, name:'Tierra de Nadie',       desc:'El último en quedar en la plataforma gana',       type:'survive',min:2,max:8,dur:30},
  {id:54, name:'Monstruo de la Isla',   desc:'Escóndete del monstruo',                          type:'hide',   min:3,max:8, dur:25},
  {id:55, name:'Rompecabezas Veloz',    desc:'Completa el rompecabezas antes que nadie',        type:'puzzle', min:2,max:4, dur:35},
  {id:56, name:'Tiro al Blanco',        desc:'El arquero más preciso gana',                     type:'aim',    min:2,max:8, dur:20},
  {id:57, name:'Carrera de Balsas',     desc:'Navega por el río sin caerte',                    type:'race',   min:2,max:6, dur:25},
  {id:58, name:'Batalla de Pasteles',   desc:'Lanza pasteles a los rivales',                    type:'aim',    min:2,max:8, dur:20},
  {id:59, name:'Soga Salvaje',          desc:'Jala la soga para arrastrar al rival',            type:'hold',   min:2,max:8, dur:15},
  {id:60, name:'Baile del Pingüino',    desc:'Sigue los movimientos del pingüino',              type:'rhythm', min:2,max:8, dur:20},
  // ── COOPERACIÓN (61-80) ───────────────────────────────────
  {id:61, name:'Puente Colgante',       desc:'Cruza sin caerte',                                type:'balance',min:2,max:6, dur:25},
  {id:62, name:'Montaña Rusa Loca',     desc:'Mantente en el asiento en la bajada',             type:'balance',min:2,max:8, dur:15},
  {id:63, name:'Patinaje sobre Hielo',  desc:'Haz la figura más elaborada',                     type:'draw',   min:2,max:6, dur:25},
  {id:64, name:'Explosión de Color',    desc:'Colorea el mayor área posible',                   type:'draw',   min:2,max:6, dur:20},
  {id:65, name:'Busca al Espia',        desc:'Adivina quién es el espia entre nosotros',        type:'social', min:3,max:8, dur:40},
  {id:66, name:'Trivia Animalesca',     desc:'¿Cuánto sabes de los animales?',                  type:'trivia', min:2,max:8, dur:25},
  {id:67, name:'Carreras en el Barro',  desc:'La pista es resbaladiza ¡cuidado!',               type:'race',   min:2,max:8, dur:20},
  {id:68, name:'Rey de la Colina',      desc:'Mantente en la cima el mayor tiempo',             type:'survive',min:2,max:8, dur:25},
  {id:69, name:'Trampolín Acuático',    desc:'El salto más alto y con mejor estilo',            type:'skill',  min:2,max:6, dur:20},
  {id:70, name:'Concurso de Rugidos',   desc:'Ruge lo más fuerte y preciso posible',            type:'tap',    min:2,max:8, dur:10},
  {id:71, name:'Puzle del Ecosistema',  desc:'Reconstruye el ecosistema correcto',              type:'puzzle', min:2,max:4, dur:35},
  {id:72, name:'Carrera de Mariposas',  desc:'Guía tu mariposa al néctar',                      type:'race',   min:2,max:6, dur:20},
  {id:73, name:'Bola de Fuego',         desc:'Evita las bolas de fuego del volcán',             type:'dodge',  min:2,max:8, dur:20},
  {id:74, name:'Súper Dados',           desc:'Tira dados especiales y suma el mayor número',    type:'luck',   min:2,max:8, dur:15},
  {id:75, name:'Pesca de Perlas',       desc:'Encuentra las perlas en el fondo del mar',        type:'seek',   min:2,max:6, dur:25},
  {id:76, name:'Globo Aerostático',     desc:'Llega más alto sin reventar el globo',            type:'hold',   min:2,max:6, dur:20},
  {id:77, name:'Sumo de Animales',      desc:'Empuja a tu rival fuera del ring',                type:'push',   min:2,max:4, dur:20},
  {id:78, name:'Eco del Bosque',        desc:'Repite el eco correctamente',                     type:'memory', min:2,max:6, dur:25},
  {id:79, name:'Chef Estrella',         desc:'Crea el plato perfecto con los ingredientes',     type:'puzzle', min:2,max:4, dur:30},
  {id:80, name:'Velocidad del Rayo',    desc:'El primero en presionar cuando aparezca el rayo', type:'reflex', min:2,max:8, dur:10},
  // ── ESPECIALES (81-100) ───────────────────────────────────
  {id:81, name:'Maratón Animal',        desc:'Carrera larga con obstáculos variados',           type:'race',   min:2,max:8, dur:30},
  {id:82, name:'Karaoke Selvático',     desc:'Completa la letra de la canción',                 type:'tap',    min:2,max:8, dur:20},
  {id:83, name:'Snowboard Extremo',     desc:'Navega la pista de nieve',                        type:'race',   min:2,max:6, dur:25},
  {id:84, name:'Batalla Espacial',      desc:'Defiende tu planeta de los meteoritos',           type:'dodge',  min:2,max:6, dur:25},
  {id:85, name:'Tetris Animalesco',     desc:'Acomoda las piezas de animales',                  type:'puzzle', min:2,max:4, dur:30},
  {id:86, name:'Dragón de Fuego',       desc:'Escapa del dragón por el laberinto',              type:'maze',   min:2,max:6, dur:25},
  {id:87, name:'Torneo de Lanzamiento', desc:'Lanza el objeto lo más lejos posible',             type:'skill',  min:2,max:8, dur:15},
  {id:88, name:'Cocodrilo Snapper',     desc:'Evita ser mordido por el cocodrilo',              type:'reflex', min:2,max:8, dur:15},
  {id:89, name:'Gran Bazar',            desc:'Compra y vende para ganar más',                   type:'econ',   min:2,max:4, dur:30},
  {id:90, name:'Carrera de Dragones',   desc:'Monta tu dragón a la victoria',                   type:'race',   min:2,max:6, dur:25},
  {id:91, name:'Estrella de Mar',       desc:'Atrapa la estrella de mar fugaz',                 type:'catch',  min:2,max:6, dur:20},
  {id:92, name:'Piano Animal',          desc:'Toca la melodía indicada en el piano',            type:'rhythm', min:2,max:4, dur:25},
  {id:93, name:'Captura del Gigante',   desc:'Todos contra el gigante',                         type:'chase',  min:3,max:8, dur:30},
  {id:94, name:'Domino Loco',           desc:'Coloca tus fichas estratégicamente',              type:'strategy',min:2,max:4,dur:35},
  {id:95, name:'Sprint Acuático',       desc:'Carrera de natación al sprint',                   type:'race',   min:2,max:8, dur:15},
  {id:96, name:'Carnaval Animal',       desc:'Gana el mayor número de premios del carnaval',    type:'tap',    min:2,max:8, dur:20},
  {id:97, name:'Cazador Nocturno',      desc:'Encuentra presas en la oscuridad',                type:'seek',   min:2,max:6, dur:25},
  {id:98, name:'Lluvia de Plátanos',    desc:'El plátano más grande vale más puntos',           type:'catch',  min:2,max:8, dur:15},
  {id:99, name:'Torneo Final',          desc:'Combate de habilidades general',                  type:'mix',    min:2,max:8, dur:30},
  {id:100,name:'Gran Banana Party',     desc:'El minijuego definitivo con todas las mecánicas', type:'mix',    min:2,max:8, dur:35},
];

// ── 25 SUPER MINIJUEGOS EN EQUIPOS ───────────────────────────────────────────
const SUPER_MINIGAMES = [
  {id:1,  name:'Guerra de Nieve',       desc:'Equipo rojo vs azul en batalla de bolas de nieve', type:'team_battle'},
  {id:2,  name:'Fútbol Animalesco',     desc:'Partido de fútbol entre equipos',                   type:'team_sport'},
  {id:3,  name:'Captura la Banana',     desc:'Roba la banana del equipo rival',                   type:'team_chase'},
  {id:4,  name:'Trineos en el Ártico',  desc:'Carrera de trineos por equipos',                    type:'team_race'},
  {id:5,  name:'Balsa vs Balsa',        desc:'Destruye la balsa del equipo rival',                type:'team_battle'},
  {id:6,  name:'Trivia de Equipos',     desc:'Compite en conocimiento con tu equipo',             type:'team_trivia'},
  {id:7,  name:'Volcán Explosivo',      desc:'Empuja al equipo rival al volcán',                  type:'team_push'},
  {id:8,  name:'Relevo Selvátic',       desc:'Carrera de relevos por la selva',                   type:'team_race'},
  {id:9,  name:'Batalla de Pintura',    desc:'Pinta más territorio que el rival',                 type:'team_draw'},
  {id:10, name:'Torre de Animales',     desc:'Construye la torre más alta en equipo',             type:'team_build'},
  {id:11, name:'Cazadores vs Presas',   desc:'Un equipo caza, el otro escapa',                    type:'team_chase'},
  {id:12, name:'Defensa del Castillo',  desc:'Defiende o ataca el castillo',                     type:'team_strategy'},
  {id:13, name:'Tug of War Extremo',    desc:'Jala la soga con todo el equipo',                   type:'team_strength'},
  {id:14, name:'Sinfonía Animal',       desc:'Crea la mejor melodía en equipo',                   type:'team_rhythm'},
  {id:15, name:'Invasión Galáctica',    desc:'Equipo A defiende, equipo B ataca',                 type:'team_strategy'},
  {id:16, name:'Rafting Salvaje',       desc:'Navega el río turbulento en equipo',                type:'team_race'},
  {id:17, name:'Tornado Animal',        desc:'Sobrevive el tornado en equipo',                    type:'team_survive'},
  {id:18, name:'Batalla Naval',         desc:'Hunde los barcos del equipo rival',                 type:'team_strategy'},
  {id:19, name:'Gran Duelo Solar',      desc:'Competencia bajo el sol ardiente',                  type:'team_endurance'},
  {id:20, name:'Misión en el Desierto', desc:'Cruzad el desierto antes que el rival',             type:'team_race'},
  {id:21, name:'Coliseo Animal',        desc:'Combate épico de equipos en el coliseo',            type:'team_battle'},
  {id:22, name:'Tormenta de Selva',     desc:'Sobrevive la tormenta cooperando',                  type:'team_survive'},
  {id:23, name:'Olimpiadas Animales',   desc:'Competencia de múltiples disciplinas',              type:'team_multi'},
  {id:24, name:'Maratón Ártico',        desc:'Carrera épica por el ártico helado',                type:'team_race'},
  {id:25, name:'La Gran Final',         desc:'El super minijuego definitivo de todos los tiempos',type:'team_epic'},
];

// ── MOTOR DE MINIJUEGOS (Canvas-based) ───────────────────────────────────────
class MinigameEngine {
  constructor(canvasId, playerId, playerList, mgData, onFinish) {
    this.canvas    = document.getElementById(canvasId);
    this.ctx       = this.canvas.getContext('2d');
    this.playerId  = playerId;
    this.players   = playerList;
    this.data      = mgData;
    this.onFinish  = onFinish;
    this.running   = false;
    this.scores    = {};
    playerList.forEach(p => this.scores[p.id] = 0);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
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
    this._initGame();
    this._loop();
  }

  _initGame() {
    const type = this.data.type;
    this.objects = [];
    this.myScore = 0;
    this.playerPos = { x: this.W / 2, y: this.H - 80 };

    // Generar objetos según tipo
    if (type === 'catch' || type === 'tap') {
      for (let i = 0; i < 5; i++) this._spawnObject();
    } else if (type === 'dodge') {
      this.obstacles = [];
      for (let i = 0; i < 3; i++) this._spawnObstacle();
    } else if (type === 'race') {
      this.playerPosY = this.H - 60;
    } else if (type === 'memory') {
      this._initMemory();
    }

    // Input universal
    this.canvas.addEventListener('click',     e => this._handleClick(e));
    this.canvas.addEventListener('mousemove', e => this._handleMove(e));
    this.canvas.addEventListener('touchstart',e => { e.preventDefault(); this._handleClick(e.touches[0]); }, {passive:false});
    this.canvas.addEventListener('touchmove', e => { e.preventDefault(); this._handleMove(e.touches[0]); }, {passive:false});
  }

  _spawnObject() {
    this.objects.push({
      x: 50 + Math.random() * (this.W - 100),
      y: -30 - Math.random() * 200,
      vy: 2 + Math.random() * 3,
      r: 20 + Math.random() * 15,
      emoji: ['🍌','⭐','🍊','🍎','💎'][Math.floor(Math.random() * 5)],
      value: [5, 10, 3, 4, 15][Math.floor(Math.random() * 5)]
    });
  }

  _spawnObstacle() {
    this.obstacles.push({
      x: Math.random() * this.W,
      y: -30,
      vy: 3 + Math.random() * 4,
      r: 25,
      emoji: '🔥'
    });
  }

  _initMemory() {
    const seq = [];
    for (let i = 0; i < 5; i++) seq.push(Math.floor(Math.random() * 4));
    this.memSeq   = seq;
    this.memInput = [];
    this.memPhase = 'show'; // show | input
    this.memIdx   = 0;
    this.memTimer = 0;
  }

  _handleClick(e) {
    if (!this.running) return;
    const rect = this.canvas.getBoundingClientRect();
    const mx = (e.clientX || e.pageX) - rect.left;
    const my = (e.clientY || e.pageY) - rect.top;

    if (this.data.type === 'catch' || this.data.type === 'tap') {
      for (let i = this.objects.length - 1; i >= 0; i--) {
        const o = this.objects[i];
        if (Math.hypot(mx - o.x, my - o.y) < o.r) {
          this.myScore += o.value;
          this.objects.splice(i, 1);
          this._spawnObject();
          this._playSound('catch');
          break;
        }
      }
    } else if (this.data.type === 'reflex') {
      this.myScore += 10;
    }
  }

  _handleMove(e) {
    if (!this.running) return;
    const rect = this.canvas.getBoundingClientRect();
    this.playerPos.x = (e.clientX || e.pageX) - rect.left;
    this.playerPos.y = (e.clientY || e.pageY) - rect.top;
  }

  _loop() {
    if (!this.running) return;
    const elapsed = Date.now() - this.startTime;
    const pct     = Math.max(0, 1 - elapsed / this.duration);

    // Timer bar
    const fill = document.getElementById('mg-timer-fill');
    const txt  = document.getElementById('mg-timer-text');
    if (fill) fill.style.width = (pct * 100) + '%';
    if (txt)  txt.textContent  = Math.ceil((this.duration - elapsed) / 1000) + 's';

    this._update();
    this._draw();

    if (elapsed >= this.duration) {
      this.running = false;
      this._finish();
      return;
    }
    requestAnimationFrame(() => this._loop());
  }

  _update() {
    const type = this.data.type;

    if (type === 'catch' || type === 'tap') {
      this.objects.forEach(o => {
        o.y += o.vy;
        if (o.y > this.H + 40) {
          o.y = -30;
          o.x = 50 + Math.random() * (this.W - 100);
        }
      });
    } else if (type === 'dodge') {
      this.obstacles.forEach(o => {
        o.y += o.vy;
        if (o.y > this.H + 40) { o.y = -30; o.x = Math.random() * this.W; }
        // Check collision with player
        if (Math.hypot(this.playerPos.x - o.x, this.playerPos.y - o.y) < o.r + 20) {
          this.myScore = Math.max(0, this.myScore - 5);
        }
      });
      this.myScore += 0.05; // survives
    } else if (type === 'race') {
      if (this.playerPosY > 60) this.playerPosY -= 1.5;
      this.myScore = Math.floor(((this.H - 60) - this.playerPosY));
    }
  }

  _draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    // Fondo temático según bioma
    const bg = this._getBg();
    ctx.fillStyle = bg.bg;
    ctx.fillRect(0, 0, this.W, this.H);

    // Grid decorativo
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.W; x += 60) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,this.H); ctx.stroke(); }
    for (let y = 0; y < this.H; y += 60) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(this.W,y); ctx.stroke(); }

    const type = this.data.type;

    if (type === 'catch' || type === 'tap') {
      // Objetos cayendo
      this.objects.forEach(o => {
        ctx.font = `${o.r * 1.5}px serif`;
        ctx.textAlign = 'center';
        ctx.fillText(o.emoji, o.x, o.y + o.r);
      });
      // Mi personaje
      this._drawPlayerCursor(this.playerPos.x, this.playerPos.y);
    } else if (type === 'dodge') {
      this.obstacles.forEach(o => {
        ctx.font = '40px serif'; ctx.textAlign = 'center';
        ctx.fillText(o.emoji, o.x, o.y + 20);
      });
      this._drawPlayerCursor(this.playerPos.x, this.playerPos.y);
    } else if (type === 'race') {
      // Pista
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(this.W / 2 - 40, 60, 80, this.H - 120);
      // Meta
      ctx.font = '30px serif'; ctx.textAlign = 'center';
      ctx.fillText('🏁', this.W / 2, 90);
      // Jugador
      const self = this.players.find(p => p.id === this.playerId);
      ctx.font = '40px serif';
      ctx.fillText(self ? ANIMALS_DATA[self.animal]?.emoji || '🐾' : '🐾',
        this.W / 2, this.playerPosY);
    }

    // Score
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`⭐ ${Math.floor(this.myScore)}`, 16, 36);

    // Mini ranking top 3 (simulado)
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(this.W - 160, 8, 152, 76);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🏆 Ranking', this.W - 148, 26);
    this.players.slice(0, 3).forEach((p, i) => {
      ctx.fillStyle = i === 0 ? '#FFD700' : i === 1 ? '#ccc' : '#CD7F32';
      ctx.fillText(`${i+1}. ${p.username.slice(0,10)}`, this.W - 148, 46 + i * 16);
    });
  }

  _getBg() {
    const bgs = [
      {bg:'#0a1628'},
      {bg:'#1a0a2e'},
      {bg:'#0d2818'},
      {bg:'#1a1500'},
      {bg:'#001a2e'}
    ];
    return bgs[this.data.id % bgs.length];
  }

  _drawPlayerCursor(x, y) {
    const ctx  = this.ctx;
    const self = this.players.find(p => p.id === this.playerId);
    ctx.font = '36px serif';
    ctx.textAlign = 'center';
    ctx.fillText(self ? ANIMALS_DATA[self.animal]?.emoji || '🐾' : '🐾', x, y + 18);
  }

  _playSound(type) { /* Web Audio API — implementación futura */ }

  _finish() {
    // Calcular ranking de resultados
    const scores = this.players.map(p => ({
      id: p.id,
      score: p.id === this.playerId ? Math.floor(this.myScore) : Math.floor(Math.random() * this.myScore * 1.2)
    })).sort((a, b) => b.score - a.score);

    this.onFinish({
      winner: scores[0]?.id,
      second: scores[1]?.id,
      third:  scores[2]?.id,
      scores
    });
  }

  destroy() {
    this.running = false;
  }
}

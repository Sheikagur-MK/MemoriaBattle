const qs = (s) => document.querySelector(s);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const screens = {
  intro: qs("#introScreen"),
  auth: qs("#authScreen"),
  lobby: qs("#lobbyScreen"),
  game: qs("#gameScreen")
};
const introCanvas = qs("#introCanvas");
const gameCanvas = qs("#gameCanvas");
const avatarCanvas = qs("#avatarCanvas");
const authForm = qs("#authForm");
const tabLogin = qs("#tabLogin");
const tabRegister = qs("#tabRegister");
const usernameInput = qs("#usernameInput");
const emailInput = qs("#emailInput");
const passwordInput = qs("#passwordInput");
const authMsg = qs("#authMsg");
const welcomeUser = qs("#welcomeUser");
const coinsLabel = qs("#coinsLabel");
const roomsList = qs("#roomsList");
const lobbyMsg = qs("#lobbyMsg");
const hpBars = qs("#hpBars");
const gameTopLeft = qs("#gameTopLeft");
const gameTopRight = qs("#gameTopRight");
const cooldownPulse = qs("#cooldownPulse");
const cooldownDash = qs("#cooldownDash");
const touchPulse = qs("#touchPulse");
const touchDash = qs("#touchDash");
const touchMove = qs("#touchMove");
const touchStick = qs("#touchStick");

let mode = "login";
let token = localStorage.getItem("token") || "";
let me = null;
let socket = null;
let currentRoomId = null;
let mapSize = 5000;
let roomState = null;

const keys = { up: false, down: false, left: false, right: false, dash: false, pulse: false };
const viewTrail = new Map();
const joystick = { active: false, id: null, x: 0, y: 0, radius: 48 };
const SKILL_COOLDOWN_MS = 5000;
const CAMERA_ZOOM = 0.5;
const GROUND_CELL = 88;
const GROUND_DOT = 22;
let lastDashAt = 0;
let lastPulseAt = 0;
const renderedPlayers = new Map();
const organicState = new Map();
let analogX = 0;
let analogY = 0;
const camState = { x: mapSize / 2, y: mapSize / 2 };
const shakeState = { power: 0, x: 0, y: 0 };

function addShake(amount) {
  shakeState.power = Math.min(18, shakeState.power + amount);
}

function drawWorldGround(ctx, w, h, view, viewW, viewH) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#0a0f1a");
  g.addColorStop(0.45, "#0d1428");
  g.addColorStop(1, "#080b14");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const left = view.left;
  const top = view.top;
  const z = CAMERA_ZOOM;
  const margin = GROUND_CELL * 2;

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "rgba(95, 130, 210, 0.35)";
  ctx.lineWidth = 1;
  for (let wx = Math.floor(left / GROUND_CELL) * GROUND_CELL; wx < left + viewW + margin; wx += GROUND_CELL) {
    const a = { x: (wx - left) * z, y: 0 };
    const b = { x: (wx - left) * z, y: h };
    ctx.beginPath();
    ctx.moveTo(a.x, 0);
    ctx.lineTo(b.x, h);
    ctx.stroke();
  }
  for (let wy = Math.floor(top / GROUND_CELL) * GROUND_CELL; wy < top + viewH + margin; wy += GROUND_CELL) {
    ctx.beginPath();
    ctx.moveTo(0, (wy - top) * z);
    ctx.lineTo(w, (wy - top) * z);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = "rgba(120, 170, 255, 0.45)";
  for (let wx = Math.floor(left / GROUND_DOT) * GROUND_DOT; wx < left + viewW + margin; wx += GROUND_DOT) {
    for (let wy = Math.floor(top / GROUND_DOT) * GROUND_DOT; wy < top + viewH + margin; wy += GROUND_DOT) {
      const sx = (wx - left) * z;
      const sy = (wy - top) * z;
      if (sx < -6 || sy < -6 || sx > w + 6 || sy > h + 6) continue;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function show(screenName) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[screenName].classList.add("active");
}

function setMode(next) {
  mode = next;
  tabLogin.classList.toggle("active", next === "login");
  tabRegister.classList.toggle("active", next === "register");
  usernameInput.classList.toggle("hidden", next !== "register");
}

tabLogin.onclick = () => setMode("login");
tabRegister.onclick = () => setMode("register");

async function api(path, method = "GET", body) {
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error de servidor");
  return data;
}

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authMsg.textContent = "Procesando...";
  try {
    const payload = { email: emailInput.value.trim(), password: passwordInput.value.trim() };
    const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
    if (mode === "register") payload.username = usernameInput.value.trim();
    const result = await api(endpoint, "POST", payload);
    token = result.token;
    me = result.user;
    localStorage.setItem("token", token);
    authMsg.textContent = "Listo.";
    onAuthed();
  } catch (err) {
    authMsg.textContent = err.message;
  }
});

qs("#logoutBtn").onclick = () => {
  localStorage.removeItem("token");
  token = "";
  me = null;
  if (socket) socket.disconnect();
  show("auth");
};

function drawAvatar() {
  const c = avatarCanvas.getContext("2d");
  const rect = avatarCanvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  avatarCanvas.width = rect.width * dpr;
  avatarCanvas.height = rect.height * dpr;
  c.scale(dpr, dpr);
  c.clearRect(0, 0, rect.width, rect.height);
  const t = performance.now() / 1000;
  const x = rect.width / 2 + Math.cos(t * 1.4) * 16;
  const y = rect.height / 2 + Math.sin(t * 1.1) * 14;
  c.fillStyle = "#8befff";
  c.shadowBlur = 22;
  c.shadowColor = "#63e8ff";
  c.beginPath();
  c.arc(x, y, 16, 0, Math.PI * 2);
  c.fill();
  c.shadowBlur = 0;
  requestAnimationFrame(drawAvatar);
}

function connectSocket() {
  socket = io({ auth: { token } });
  socket.on("rooms_overview", (rooms) => renderRooms(rooms || []));
  socket.on("joined_room", (payload) => {
    currentRoomId = payload.roomId;
    mapSize = payload.mapSize || 5000;
    show("game");
  });
  socket.on("room_state", (payload) => {
    roomState = payload;
  });
}

function renderRooms(rooms) {
  roomsList.innerHTML = "";
  for (const r of rooms) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${r.id} - ${r.status} - ${r.players}/100</span>`;
    const b = document.createElement("button");
    b.textContent = "Espectar";
    b.onclick = () => socket.emit("spectate_room", { roomId: r.id });
    li.appendChild(b);
    roomsList.appendChild(li);
  }
}

qs("#btnOnline").onclick = () => socket.emit("join_online");
qs("#btnPrivate").onclick = () => {
  const code = prompt("Codigo de sala privada");
  if (!code) return;
  socket.emit("join_private", { code });
};
qs("#btnTutorial").onclick = () => {
  lobbyMsg.textContent = "Tutorial: usa WASD/flechas para moverte, Espacio para pulse y Shift para dash.";
};
qs("#btnOptions").onclick = () => { lobbyMsg.textContent = "Opciones: en siguiente iteracion agregamos sliders de audio/video."; };
qs("#btnStore").onclick = () => { lobbyMsg.textContent = "Tienda conectable a MongoDB para skins y cosmeticos."; };
qs("#backLobbyBtn").onclick = () => show("lobby");

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
  if (k === "w" || k === "arrowup") keys.up = true;
  if (k === "s" || k === "arrowdown") keys.down = true;
  if (k === "a" || k === "arrowleft") keys.left = true;
  if (k === "d" || k === "arrowright") keys.right = true;
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") tryDash();
  if (e.code === "Space") tryPulse();
});
window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  if (k === "w" || k === "arrowup") keys.up = false;
  if (k === "s" || k === "arrowdown") keys.down = false;
  if (k === "a" || k === "arrowleft") keys.left = false;
  if (k === "d" || k === "arrowright") keys.right = false;
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") keys.dash = false;
});
touchPulse.addEventListener("touchstart", (e) => { e.preventDefault(); tryPulse(); }, { passive: false });
touchPulse.addEventListener("click", (e) => { e.preventDefault(); tryPulse(); });
touchDash.addEventListener("touchstart", (e) => { e.preventDefault(); tryDash(); }, { passive: false });
touchDash.addEventListener("touchend", (e) => { e.preventDefault(); }, { passive: false });
touchDash.addEventListener("click", (e) => { e.preventDefault(); tryDash(); });

function tryDash() {
  const now = Date.now();
  if (now - lastDashAt < SKILL_COOLDOWN_MS) return;
  lastDashAt = now;
  keys.dash = true;
  addShake(5.5);
}
function tryPulse() {
  const now = Date.now();
  if (now - lastPulseAt < SKILL_COOLDOWN_MS) return;
  lastPulseAt = now;
  keys.pulse = true;
  addShake(3);
}

function joystickApply(nx, ny) {
  const dead = 0.22;
  analogX = Math.abs(nx) < dead ? 0 : nx;
  analogY = Math.abs(ny) < dead ? 0 : ny;
  keys.left = analogX < -dead;
  keys.right = analogX > dead;
  keys.up = analogY < -dead;
  keys.down = analogY > dead;
}

if (touchMove && touchStick) {
  const resetStick = (e) => {
    joystick.active = false; joystick.id = null;
    const rect = touchMove.getBoundingClientRect();
    touchStick.style.left = `${rect.width / 2 - touchStick.offsetWidth / 2}px`;
    touchStick.style.top = `${rect.height / 2 - touchStick.offsetHeight / 2}px`;
    joystickApply(0, 0);
  };
  touchMove.addEventListener("pointerdown", (e) => { joystick.active = true; joystick.id = e.pointerId; touchMove.setPointerCapture(e.pointerId); });
  touchMove.addEventListener("pointermove", (e) => {
    if (!joystick.active || e.pointerId !== joystick.id) return;
    const rect = touchMove.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    let dx = e.clientX - rect.left - cx, dy = e.clientY - rect.top - cy;
    const mag = Math.hypot(dx, dy) || 1;
    if (mag > joystick.radius) { dx = (dx / mag) * joystick.radius; dy = (dy / mag) * joystick.radius; }
    touchStick.style.left = `${cx - touchStick.offsetWidth / 2 + dx}px`;
    touchStick.style.top = `${cy - touchStick.offsetHeight / 2 + dy}px`;
    joystickApply(dx / joystick.radius, dy / joystick.radius);
  });
  touchMove.addEventListener("pointerup", resetStick);
  touchMove.addEventListener("pointercancel", resetStick);
}

function sendInputLoop() {
  if (socket && socket.connected && currentRoomId) {
    const mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const my = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    const moveX = analogX !== 0 ? analogX : mx;
    const moveY = analogY !== 0 ? analogY : my;
    socket.emit("input", { ...keys, moveX, moveY });
    keys.pulse = false; keys.dash = false;
  }
  setTimeout(sendInputLoop, 33);
}

function resizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  return { w: rect.width, h: rect.height, dpr };
}

function drawIntro() {
  const ctx = introCanvas.getContext("2d");
  const { w, h } = resizeCanvas(introCanvas);
  const t = performance.now() / 1000;
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
  ctx.clearRect(0, 0, w, h);
  const a = { x: w * 0.35, y: h * 0.5 };
  const progress = Math.min(1, t * 0.4);
  const pulse = 20 + progress * 380;
  ctx.fillStyle = "#84f3ff"; ctx.beginPath(); ctx.arc(a.x, a.y, 10, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = `rgba(125,220,255,${0.7 - progress * 0.6})`;
  ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(a.x, a.y, pulse, 0, Math.PI * 2); ctx.stroke();
  if (progress >= 1) show("auth"); else requestAnimationFrame(drawIntro);
}

function drawGame() {
  const ctx = gameCanvas.getContext("2d");
  const { w, h } = resizeCanvas(gameCanvas);
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
  ctx.clearRect(0, 0, w, h);
  if (!roomState || !me) { requestAnimationFrame(drawGame); return; }

  const players = roomState.players || [];
  const mePlayer = players.find((p) => p.username === me.username);
  
  for (const p of players) {
    const prev = renderedPlayers.get(p.username) || { x: p.x, y: p.y, lx: p.x, ly: p.y };
    prev.lx = prev.x; prev.ly = prev.y;
    prev.x += (p.x - prev.x) * 0.35;
    prev.y += (p.y - prev.y) * 0.35;
    prev.alive = p.alive; prev.pulsing = p.pulsing; prev.username = p.username; prev.hpBars = p.hpBars;
    renderedPlayers.set(p.username, prev);
  }
  for (const name of renderedPlayers.keys()) { if (!players.some((p) => p.username === name)) { renderedPlayers.delete(name); organicState.delete(name); } }

  const meRender = mePlayer ? renderedPlayers.get(me.username) : null;
  const lookX = clamp((meRender ? meRender.x - meRender.lx : 0) * 210, -280, 280);
  const lookY = clamp((meRender ? meRender.y - meRender.ly : 0) * 210, -280, 280);
  const cam = { x: mePlayer ? meRender.x + lookX : mapSize / 2, y: mePlayer ? meRender.y + lookY : mapSize / 2 };
  camState.x += (cam.x - camState.x) * 0.12; camState.y += (cam.y - camState.y) * 0.12;
  const viewW = w / CAMERA_ZOOM, viewH = h / CAMERA_ZOOM;
  const view = { left: camState.x - viewW / 2, top: camState.y - viewH / 2 };
  const toScreen = (wx, wy) => ({ x: (wx - view.left) * CAMERA_ZOOM, y: (wy - view.top) * CAMERA_ZOOM });

  shakeState.power *= 0.86;
  shakeState.x = (Math.random() * 2 - 1) * shakeState.power;
  shakeState.y = (Math.random() * 2 - 1) * shakeState.power;

  ctx.save();
  ctx.translate(shakeState.x, shakeState.y);
  drawWorldGround(ctx, w, h, view, viewW, viewH);

  const zone = roomState.summary?.zone;
  if (zone) {
    ctx.strokeStyle = "rgba(255,102,142,.55)"; ctx.lineWidth = 4;
    const pz = toScreen(zone.x, zone.y);
    ctx.beginPath(); ctx.arc(pz.x, pz.y, zone.radius * CAMERA_ZOOM, 0, Math.PI * 2); ctx.stroke();
  }

  for (const p of renderedPlayers.values()) {
    const pos = toScreen(p.x, p.y);
    const x = pos.x, y = pos.y;
    if (x < -150 || y < -150 || x > w + 150 || y > h + 150) continue;

    // --- LÓGICA DE MOVIMIENTO POR SEGMENTOS (GUSANO) ---
    const st = organicState.get(p.username) || { angle: 0, tail: [], lastX: x, lastY: y };
    const dxv = x - st.lastX, dyv = y - st.lastY;
    const speed = Math.hypot(dxv, dyv);
    
    if (speed > 0.1) {
      const targetAngle = Math.atan2(dyv, dxv);
      const diff = Math.atan2(Math.sin(targetAngle - st.angle), Math.cos(targetAngle - st.angle));
      st.angle += diff * 0.15; 
    }

    if (st.tail.length === 0) { for(let i=0; i<6; i++) st.tail.push({x, y}); }
    st.tail[0].x = x; st.tail[0].y = y;

    for (let i = 1; i < st.tail.length; i++) {
      const seg = st.tail[i], prev = st.tail[i - 1];
      const dist = Math.hypot(prev.x - seg.x, prev.y - seg.y);
      const limit = 8 * CAMERA_ZOOM; 
      if (dist > limit) {
        const ang = Math.atan2(prev.y - seg.y, prev.x - seg.x);
        seg.x = prev.x - Math.cos(ang) * limit; seg.y = prev.y - Math.sin(ang) * limit;
      }
    }

    const isMe = p.username === (me ? me.username : "");
    for (let i = st.tail.length - 1; i >= 0; i--) {
      const seg = st.tail[i];
      const sizeMult = (1 - i / st.tail.length);
      const size = (16 - i * 1.8) * CAMERA_ZOOM;
      ctx.fillStyle = isMe ? `rgba(140, 246, 255, ${0.3 + sizeMult * 0.7})` : `rgba(211, 222, 255, ${0.3 + sizeMult * 0.7})`;
      if (!p.alive) ctx.fillStyle = "rgba(100, 111, 144, 0.4)";
      ctx.beginPath(); ctx.arc(seg.x, seg.y, Math.max(2, size), 0, Math.PI * 2); ctx.fill();
    }

    if (p.pulsing) {
      ctx.strokeStyle = isMe ? "#6df7ff" : "#b28cff"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 50 * CAMERA_ZOOM, 0, Math.PI * 2); ctx.stroke();
    }

    st.lastX = x; st.lastY = y;
    organicState.set(p.username, st);

    ctx.fillStyle = "#dce6ff"; ctx.font = "bold 12px Inter"; ctx.textAlign = "center";
    ctx.fillText(p.username, x, y - 30);
  }

  const dashLeft = Math.max(0, SKILL_COOLDOWN_MS - (Date.now() - lastDashAt));
  const pulseLeft = Math.max(0, SKILL_COOLDOWN_MS - (Date.now() - lastPulseAt));
  touchDash.textContent = dashLeft > 0 ? `DASH ${Math.ceil(dashLeft / 1000)}` : "DASH";
  touchPulse.textContent = pulseLeft > 0 ? `PULSE ${Math.ceil(pulseLeft / 1000)}` : "PULSE";
  if (cooldownDash && cooldownPulse) {
    cooldownDash.textContent = dashLeft > 0 ? `DASH ${Math.ceil(dashLeft / 1000)}s` : "DASH listo";
    cooldownPulse.textContent = pulseLeft > 0 ? `PULSE ${Math.ceil(pulseLeft / 1000)}s` : "PULSE listo";
    cooldownDash.classList.toggle("busy", dashLeft > 0); cooldownPulse.classList.toggle("busy", pulseLeft > 0);
  }
  gameTopLeft.textContent = `${roomState.summary?.id || ""} | ${roomState.summary?.status || ""}`;
  gameTopRight.textContent = `Vivos: ${players.filter(p => p.alive).length}`;
  hpBars.innerHTML = "";
  for (let i = 0; i < (mePlayer?.hpBars || 0); i++) { const el = document.createElement("i"); hpBars.appendChild(el); }
  ctx.restore();
  requestAnimationFrame(drawGame);
}

function onAuthed() {
  show("lobby");
  welcomeUser.textContent = me.username;
  coinsLabel.textContent = `${me.coins} coins`;
  if (!socket) connectSocket();
}

async function bootstrap() {
  setMode("login");
  drawAvatar();
  drawIntro();
  drawGame();
  sendInputLoop();
  if (token) {
    try {
      const result = await api("/api/me");
      me = result;
      onAuthed();
    } catch {
      localStorage.removeItem("token");
      token = "";
    }
  }
}

bootstrap();let roomState = null;
let mode = "login";
const keys = { up: false, down: false, left: false, right: false, dash: false };
let joystick = { active: false, x: 0, y: 0 };

const playerVisuals = new Map();

// --- LÓGICA DE NAVEGACIÓN ---
function show(id) {
    Object.entries(screens).forEach(([key, el]) => {
        if (el) el.classList.toggle("active", key === id);
    });
}

// --- SISTEMA DE COORDENADAS ---
function toScreen(worldX, worldY) {
    const myPlayer = roomState?.players?.[socket.id];
    if (!myPlayer) return { x: 0, y: 0 };
    return {
        x: (gameCanvas.width / 2) + (worldX - myPlayer.x) * CONFIG.ZOOM,
        y: (gameCanvas.height / 2) + (worldY - myPlayer.y) * CONFIG.ZOOM
    };
}

// --- RENDERIZADO ---
function drawGame() {
    // Solo dibujar si estamos en la pantalla de juego
    if (!screens.game.classList.contains("active") || !roomState || !socket) {
        return requestAnimationFrame(drawGame);
    }

    const w = gameCanvas.width;
    const h = gameCanvas.height;
    ctx.fillStyle = "#04060d";
    ctx.fillRect(0, 0, w, h);

    drawGrid(ctx, w, h);
    
    const players = Object.values(roomState.players);
    players.forEach(p => {
        const screenPos = toScreen(p.x, p.y);
        if (screenPos.x < -200 || screenPos.y < -200 || screenPos.x > w + 200 || screenPos.y > h + 200) return;
        updateAndDrawPlayer(ctx, p, screenPos, p.username === me?.username);
    });

    updateUI(roomState.players[socket.id]);
    requestAnimationFrame(drawGame);
}

function drawGrid(ctx, w, h) {
    const offset = toScreen(0, 0);
    const step = 100 * CONFIG.ZOOM;
    ctx.strokeStyle = "rgba(109, 247, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let x = offset.x % step; x < w; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = offset.y % step; y < h; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
}

function updateAndDrawPlayer(ctx, p, pos, isMe) {
    let st = playerVisuals.get(p.username);
    if (!st) {
        st = { angle: 0, tail: Array(CONFIG.SEGMENT_COUNT).fill({ x: pos.x, y: pos.y }), lastX: pos.x, lastY: pos.y };
        playerVisuals.set(p.username, st);
    }

    const dx = pos.x - st.lastX;
    const dy = pos.y - st.lastY;
    const speed = Math.hypot(dx, dy);

    if (speed > 0.1) {
        const targetAngle = Math.atan2(dy, dx);
        const diff = Math.atan2(Math.sin(targetAngle - st.angle), Math.cos(targetAngle - st.angle));
        st.angle += diff * CONFIG.ROTATION_SPEED;
    }

    st.tail[0] = { x: pos.x, y: pos.y };
    for (let i = 1; i < st.tail.length; i++) {
        const seg = st.tail[i];
        const prev = st.tail[i - 1];
        const d = Math.hypot(prev.x - seg.x, prev.y - seg.y);
        const limit = CONFIG.SEGMENT_GAP * CONFIG.ZOOM;
        if (d > limit) {
            const angle = Math.atan2(prev.y - seg.y, prev.x - seg.x);
            st.tail[i] = { x: prev.x - Math.cos(angle) * limit, y: prev.y - Math.sin(angle) * limit };
        }
    }

    ctx.save();
    st.tail.slice().reverse().forEach((seg, i) => {
        const revIdx = st.tail.length - 1 - i;
        const sizeMult = (1 - revIdx / st.tail.length);
        const radius = (18 - revIdx * 2) * CONFIG.ZOOM;
        ctx.fillStyle = isMe ? `rgba(109, 247, 255, ${0.3 + sizeMult * 0.7})` : `rgba(178, 140, 255, ${0.3 + sizeMult * 0.7})`;
        ctx.beginPath(); ctx.arc(seg.x, seg.y, Math.max(2, radius), 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(p.username, pos.x, pos.y - 35);
    st.lastX = pos.x; st.lastY = pos.y;
    ctx.restore();
}

function updateUI(myP) {
    if (!myP) return;
    qs("#gameTopRight").textContent = `Vivos: ${Object.values(roomState.players).filter(p => p.alive).length}`;
    // Aquí puedes añadir la lógica de cooldowns de nuevo si la usas
}

// --- CONEXIÓN ---
function onAuthed() {
    show("lobby");
    welcomeUser.textContent = me.username;
    socket = io();

    socket.on("connect", () => socket.emit("auth", { token }));
    socket.on("rooms_list", (rooms) => {
        roomsList.innerHTML = rooms.map(r => `
            <li class="room-item">
                <span>Sala ${r.id} (${r.count}/${r.max})</span>
                <button class="btn small" onclick="joinRoom('${r.id}')">Unirse</button>
            </li>
        `).join('');
    });
    socket.on("joined_room", () => { show("game"); resizeCanvas(); });
    socket.on("room_update", (state) => { roomState = state; });
}

window.joinRoom = (id) => socket.emit("join_room", { roomId: id });

// --- AUTENTICACIÓN ---
authForm.onsubmit = async (e) => {
    e.preventDefault();
    const route = mode === "login" ? "/api/login" : "/api/register";
    const body = { email: emailInput.value, password: passwordInput.value };
    if (mode === "register") body.username = usernameInput.value;

    try {
        const res = await fetch(route, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.token) {
            token = data.token;
            localStorage.setItem("token", token);
            me = data.user;
            onAuthed();
        } else {
            authMsg.textContent = data.error || "Error de acceso";
        }
    } catch (err) {
        authMsg.textContent = "Error de servidor";
    }
};

qs("#tabLogin").onclick = () => { mode = "login"; usernameInput.classList.add("hidden"); qs("#tabLogin").classList.add("active"); qs("#tabRegister").classList.remove("active"); };
qs("#tabRegister").onclick = () => { mode = "register"; usernameInput.classList.remove("hidden"); qs("#tabRegister").classList.add("active"); qs("#tabLogin").classList.remove("active"); };

// --- INPUTS ---
window.addEventListener("keydown", (e) => {
    if (!screens.game.classList.contains("active")) return;
    if (e.code === "KeyW") keys.up = true;
    if (e.code === "KeyS") keys.down = true;
    if (e.code === "KeyA") keys.left = true;
    if (e.code === "KeyD") keys.right = true;
    if (e.code === "ShiftLeft") keys.dash = true;
    socket.emit("input", { ...keys });
});

window.addEventListener("keyup", (e) => {
    if (e.code === "KeyW") keys.up = false;
    if (e.code === "KeyS") keys.down = false;
    if (e.code === "KeyA") keys.left = false;
    if (e.code === "KeyD") keys.right = false;
    if (e.code === "ShiftLeft") keys.dash = false;
    socket.emit("input", { ...keys });
});

function resizeCanvas() {
    gameCanvas.width = window.innerWidth;
    gameCanvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);

// Inicio
if (token) {
    fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => { if (d.username) { me = d; onAuthed(); } else show("auth"); })
        .catch(() => show("auth"));
} else {
    show("auth");
}

requestAnimationFrame(drawGame);    const offset = toScreen(0, 0);
    const step = 100 * CONFIG.ZOOM;
    ctx.strokeStyle = "rgba(109, 247, 255, 0.05)";
    ctx.lineWidth = 1;

    for (let x = offset.x % step; x < w; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = offset.y % step; y < h; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
}

function drawMapLimits(ctx) {
    const s0 = toScreen(0, 0);
    const sM = toScreen(CONFIG.MAP_SIZE, CONFIG.MAP_SIZE);
    ctx.strokeStyle = "rgba(109, 247, 255, 0.2)";
    ctx.setLineDash([10, 10]);
    ctx.strokeRect(s0.x, s0.y, sM.x - s0.x, sM.y - s0.y);
    ctx.setLineDash([]);
}

function drawDangerZone(ctx, zone) {
    const pos = toScreen(zone.x, zone.y);
    const rad = zone.radius * CONFIG.ZOOM;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, rad, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 77, 109, 0.5)";
    ctx.lineWidth = 8;
    ctx.stroke();
}

function updateAndDrawPlayer(ctx, p, pos, isMe) {
    // 1. Obtener o crear estado visual
    let st = playerVisuals.get(p.username);
    if (!st) {
        st = { angle: 0, tail: Array(CONFIG.SEGMENT_COUNT).fill({ x: pos.x, y: pos.y }), lastX: pos.x, lastY: pos.y };
        playerVisuals.set(p.username, st);
    }

    // 2. Lógica de rotación y arrastre
    const dx = pos.x - st.lastX;
    const dy = pos.y - st.lastY;
    const speed = Math.hypot(dx, dy);

    if (speed > 0.1) {
        const targetAngle = Math.atan2(dy, dx);
        const diff = Math.atan2(Math.sin(targetAngle - st.angle), Math.cos(targetAngle - st.angle));
        st.angle += diff * CONFIG.ROTATION_SPEED;
    }

    st.tail[0] = { x: pos.x, y: pos.y };
    for (let i = 1; i < st.tail.length; i++) {
        const seg = st.tail[i];
        const prev = st.tail[i - 1];
        const d = Math.hypot(prev.x - seg.x, prev.y - seg.y);
        const limit = CONFIG.SEGMENT_GAP * CONFIG.ZOOM * (1 + i * 0.1);

        if (d > limit) {
            const angle = Math.atan2(prev.y - seg.y, prev.x - seg.x);
            st.tail[i] = {
                x: prev.x - Math.cos(angle) * limit,
                y: prev.y - Math.sin(angle) * limit
            };
        }
    }

    // 3. Renderizado Estético
    ctx.save();
    
    // Cuerpo (Efecto Neon)
    st.tail.slice().reverse().forEach((seg, i) => {
        const reverseIdx = st.tail.length - 1 - i;
        const sizeMult = (1 - reverseIdx / st.tail.length);
        const radius = (18 - reverseIdx * 2) * CONFIG.ZOOM;
        
        ctx.shadowBlur = isMe ? 15 : 5;
        ctx.shadowColor = isMe ? "#6df7ff" : "#b28cff";
        
        const alpha = p.alive ? (0.3 + sizeMult * 0.7) : 0.2;
        ctx.fillStyle = isMe ? `rgba(109, 247, 255, ${alpha})` : `rgba(178, 140, 255, ${alpha})`;
        
        ctx.beginPath();
        ctx.arc(seg.x, seg.y, Math.max(2, radius), 0, Math.PI * 2);
        ctx.fill();
    });

    // Pulse Effect
    if (p.pulsing) {
        ctx.strokeStyle = isMe ? "#6df7ff" : "#b28cff";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 60 * CONFIG.ZOOM, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Nombre y UI del jugador
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px Inter";
    ctx.textAlign = "center";
    ctx.fillText(p.username, pos.x, pos.y - 35);

    st.lastX = pos.x;
    st.lastY = pos.y;
    ctx.restore();
}

// --- GESTIÓN DE UI ---
function updateUI(myPlayer) {
    if (!myPlayer) return;
    const now = Date.now();
    
    const dashCd = Math.max(0, myPlayer.dashNext - now);
    const pulseCd = Math.max(0, myPlayer.pulseNext - now);

    touchDash.innerHTML = dashCd > 0 ? `<span>${Math.ceil(dashCd/1000)}s</span>` : "DASH";
    touchPulse.innerHTML = pulseCd > 0 ? `<span>${Math.ceil(pulseCd/1000)}s</span>` : "PULSE";

    cooldownDash.className = `chip cd-chip ${dashCd > 0 ? 'busy' : 'ready'}`;
    cooldownPulse.className = `chip cd-chip ${pulseCd > 0 ? 'busy' : 'ready'}`;

    hpBars.innerHTML = Array(myPlayer.hpBars || 0).fill('<i></i>').join('');
    qs("#gameTopRight").textContent = `Vivos: ${Object.values(roomState.players).filter(p => p.alive).length}`;
}

// --- CONEXIÓN Y EVENTOS ---
function onAuthed() {
    show("lobby");
    welcomeUser.textContent = me.username;
    socket = io();

    socket.on("connect", () => socket.emit("auth", { token }));
    socket.on("rooms_list", (rooms) => renderRooms(rooms));
    socket.on("joined_room", ({ roomId }) => { show("game"); resizeCanvas(); });
    socket.on("room_update", (state) => { roomState = state; });
}

function renderRooms(rooms) {
    const list = qs("#roomsList");
    list.innerHTML = rooms.map(r => `
        <li class="room-item">
            <span>Sala ${r.id} (${r.count}/${r.max}) - ${r.status}</span>
            <button class="btn small" onclick="socket.emit('join_room', { roomId: '${r.id}' })">Unirse</button>
        </li>
    `).join('');
}

// Inputs
window.addEventListener("keydown", (e) => handleKey(e, true));
window.addEventListener("keyup", (e) => handleKey(e, false));

function handleKey(e, isDown) {
    if (e.code === "ArrowUp" || e.code === "KeyW") keys.up = isDown;
    if (e.code === "ArrowDown" || e.code === "KeyS") keys.down = isDown;
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = isDown;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = isDown;
    if (e.code === "ShiftLeft") keys.dash = isDown;
    if (isDown && e.code === "Space") socket.emit("input", { pulse: true });
    sendInput();
}

function sendInput() {
    if (!socket) return;
    socket.emit("input", { ...keys, moveX: joystick.x, moveY: joystick.y });
}

// Inicialización
function show(id) {
    Object.values(screens).forEach(s => s.classList.remove("active"));
    screens[id].classList.add("active");
}

function resizeCanvas() {
    gameCanvas.width = window.innerWidth;
    gameCanvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);
requestAnimationFrame(drawGame);

// Login Logic (Simplificada para el ejemplo)
authForm.onsubmit = async (e) => {
    e.preventDefault();
    // ... misma lógica de fetch que tenías ...
};

if (token) onAuthed(); else show("auth");

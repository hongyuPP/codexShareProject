const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;
const WORLD_W = 2850;
const GRAVITY = 0.82;
const FRICTION = 0.82;
const MAX_FALL = 22;
const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

canvas.width = W * DPR;
canvas.height = H * DPR;
canvas.style.width = "100%";
canvas.style.height = "auto";
ctx.scale(DPR, DPR);

const keys = new Set();
const particles = [];
const projectiles = [];
const floatingTexts = [];

let cameraX = 0;
let lastTime = 0;
let gameWon = false;
let shake = 0;

const colors = {
  ink: "#fff4d5",
  panel: "rgba(22, 17, 16, 0.84)",
  panelDark: "rgba(8, 9, 10, 0.92)",
  gold: "#f6cf57",
  red: "#f45b67",
  blue: "#4fc4ff",
  green: "#67d56d",
  bark: "#5d3a22",
  soil: "#5d3d25",
  moss: "#9fde5f",
  shadow: "rgba(0, 0, 0, 0.24)",
};

const player = {
  x: 95,
  y: 470,
  w: 36,
  h: 54,
  vx: 0,
  vy: 0,
  dir: 1,
  hp: 230,
  maxHp: 230,
  mp: 120,
  maxMp: 120,
  exp: 35,
  level: 1,
  gold: 0,
  onGround: false,
  invuln: 0,
  attackTimer: 0,
  dashTimer: 0,
  dashCooldown: 0,
  fireCooldown: 0,
};

const platforms = [
  { x: 0, y: 590, w: 760, h: 42, type: "ground" },
  { x: 760, y: 600, w: 560, h: 42, type: "ground" },
  { x: 1380, y: 585, w: 530, h: 42, type: "ground" },
  { x: 2030, y: 590, w: 820, h: 42, type: "ground" },
  { x: 520, y: 435, w: 360, h: 24, type: "branch" },
  { x: 1080, y: 365, w: 330, h: 24, type: "branch" },
  { x: 1670, y: 415, w: 360, h: 24, type: "branch" },
  { x: 2200, y: 355, w: 420, h: 24, type: "branch" },
];

const enemies = [
  makeEnemy(650, 540, 580, 840, "叶影史莱姆"),
  makeEnemy(1300, 535, 1180, 1540, "藤甲守卫"),
  makeEnemy(2190, 540, 2060, 2500, "暮色蘑菇"),
];

const coins = [
  { x: 260, y: 525, got: false },
  { x: 590, y: 390, got: false },
  { x: 720, y: 390, got: false },
  { x: 1170, y: 320, got: false },
  { x: 1350, y: 320, got: false },
  { x: 1760, y: 370, got: false },
  { x: 1960, y: 370, got: false },
  { x: 2300, y: 310, got: false },
  { x: 2480, y: 310, got: false },
  { x: 2680, y: 525, got: false },
];

const finishFlag = { x: 2735, y: 478, w: 44, h: 112 };

const skillSlots = [
  { key: "J", name: "斩击", color: "#f7ead0" },
  { key: "K", name: "火球", color: "#ff7a32" },
  { key: "L", name: "冲刺", color: "#50d7ff" },
  { key: "R", name: "重开", color: "#9eea61" },
];

function makeEnemy(x, y, minX, maxX, name) {
  return {
    x,
    y,
    w: 44,
    h: 42,
    vx: 1.25,
    minX,
    maxX,
    hp: 70,
    maxHp: 70,
    alive: true,
    hitTimer: 0,
    name,
  };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resetGame() {
  player.x = 95;
  player.y = 470;
  player.vx = 0;
  player.vy = 0;
  player.dir = 1;
  player.hp = player.maxHp;
  player.mp = player.maxMp;
  player.exp = 35;
  player.gold = 0;
  player.invuln = 0;
  player.attackTimer = 0;
  player.dashTimer = 0;
  player.dashCooldown = 0;
  player.fireCooldown = 0;
  enemies.splice(0, enemies.length, makeEnemy(650, 540, 580, 840, "叶影史莱姆"), makeEnemy(1300, 535, 1180, 1540, "藤甲守卫"), makeEnemy(2190, 540, 2060, 2500, "暮色蘑菇"));
  coins.forEach((coin) => {
    coin.got = false;
  });
  projectiles.length = 0;
  particles.length = 0;
  floatingTexts.length = 0;
  gameWon = false;
  cameraX = 0;
  shake = 0;
}

function addParticles(x, y, color, count = 10, power = 5) {
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * power,
      vy: (Math.random() - 0.9) * power,
      life: 35 + Math.random() * 20,
      maxLife: 55,
      color,
      size: 2 + Math.random() * 4,
    });
  }
}

function addText(text, x, y, color = colors.ink) {
  floatingTexts.push({ text, x, y, vy: -0.8, life: 70, color });
}

function applyPhysics(entity) {
  entity.vy = clamp(entity.vy + GRAVITY, -99, MAX_FALL);
  entity.x += entity.vx;
  resolveHorizontal(entity);
  entity.y += entity.vy;
  entity.onGround = false;
  resolveVertical(entity);
}

function resolveHorizontal(entity) {
  for (const p of platforms) {
    if (!rectsOverlap(entity, p)) continue;
    if (entity.vx > 0) entity.x = p.x - entity.w;
    if (entity.vx < 0) entity.x = p.x + p.w;
    entity.vx = 0;
  }
}

function resolveVertical(entity) {
  for (const p of platforms) {
    if (!rectsOverlap(entity, p)) continue;
    if (entity.vy > 0) {
      entity.y = p.y - entity.h;
      entity.vy = 0;
      entity.onGround = true;
    } else if (entity.vy < 0) {
      entity.y = p.y + p.h;
      entity.vy = 0;
    }
  }
}

function attack() {
  if (player.attackTimer > 0) return;
  player.attackTimer = 18;
  const hitbox = {
    x: player.dir > 0 ? player.x + player.w - 2 : player.x - 44,
    y: player.y + 12,
    w: 48,
    h: 34,
  };
  addParticles(hitbox.x + hitbox.w / 2, hitbox.y + 16, "#fff4cf", 8, 4);
  for (const enemy of enemies) {
    if (!enemy.alive || !rectsOverlap(hitbox, enemy)) continue;
    damageEnemy(enemy, 28, player.dir * 5);
  }
}

function castFireball() {
  if (player.fireCooldown > 0 || player.mp < 22) return;
  player.mp -= 22;
  player.fireCooldown = 42;
  projectiles.push({
    x: player.x + player.w / 2 + player.dir * 20,
    y: player.y + 24,
    w: 24,
    h: 16,
    vx: player.dir * 9,
    life: 90,
  });
  addParticles(player.x + player.w / 2, player.y + 24, "#ff9e3a", 12, 4);
}

function dash() {
  if (player.dashCooldown > 0 || player.mp < 16) return;
  player.mp -= 16;
  player.vx = player.dir * 15;
  player.dashTimer = 12;
  player.dashCooldown = 70;
  player.invuln = Math.max(player.invuln, 18);
  addParticles(player.x + player.w / 2, player.y + player.h / 2, "#6adfff", 18, 7);
}

function damageEnemy(enemy, amount, knockback) {
  enemy.hp -= amount;
  enemy.hitTimer = 14;
  enemy.x += knockback;
  addParticles(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, "#98f06d", 14, 6);
  addText(`-${amount}`, enemy.x + enemy.w / 2, enemy.y - 8, "#fff0a6");
  shake = 5;
  if (enemy.hp <= 0) {
    enemy.alive = false;
    player.gold += 18;
    player.exp += 26;
    addText("+18 金币", enemy.x + 8, enemy.y - 26, colors.gold);
    addParticles(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, colors.gold, 28, 9);
    if (player.exp >= 100) {
      player.level += 1;
      player.exp -= 100;
      player.maxHp += 18;
      player.maxMp += 12;
      player.hp = player.maxHp;
      player.mp = player.maxMp;
      addText("升级!", player.x, player.y - 18, "#aaff8d");
    }
  }
}

function hurtPlayer(amount, sourceX) {
  if (player.invuln > 0 || gameWon) return;
  player.hp = Math.max(0, player.hp - amount);
  player.invuln = 52;
  player.vx = sourceX < player.x ? 8 : -8;
  player.vy = -6;
  shake = 9;
  addText(`-${amount}`, player.x + 8, player.y - 12, "#ffabb4");
  addParticles(player.x + player.w / 2, player.y + 28, "#ff6d74", 18, 7);
  if (player.hp <= 0) {
    addText("按 R 重开", player.x - 10, player.y - 34, "#ffffff");
  }
}

function update(delta) {
  if (keys.has("r")) resetGame();

  if (player.hp > 0 && !gameWon) {
    const movingLeft = keys.has("a") || keys.has("arrowleft");
    const movingRight = keys.has("d") || keys.has("arrowright");
    const jumping = keys.has("w") || keys.has(" ") || keys.has("arrowup");

    if (movingLeft) {
      player.vx -= player.onGround ? 1.35 : 0.85;
      player.dir = -1;
    }
    if (movingRight) {
      player.vx += player.onGround ? 1.35 : 0.85;
      player.dir = 1;
    }
    if (!movingLeft && !movingRight && player.onGround && player.dashTimer <= 0) {
      player.vx *= FRICTION;
    }
    if (jumping && player.onGround) {
      player.vy = -17;
      player.onGround = false;
      addParticles(player.x + player.w / 2, player.y + player.h, "#d7f58b", 10, 5);
    }

    player.vx = clamp(player.vx, -8.4, 8.4);
    if (player.dashTimer > 0) player.vx = player.dir * 15;

    if (keys.has("j")) attack();
    if (keys.has("k")) castFireball();
    if (keys.has("l")) dash();

    player.mp = Math.min(player.maxMp, player.mp + 0.12);
  }

  applyPhysics(player);
  player.x = clamp(player.x, 0, WORLD_W - player.w);
  if (player.y > H + 200) {
    player.x = Math.max(60, player.x - 180);
    player.y = 410;
    player.vx = 0;
    player.vy = 0;
    hurtPlayer(35, player.x + 100);
  }

  player.attackTimer = Math.max(0, player.attackTimer - 1);
  player.fireCooldown = Math.max(0, player.fireCooldown - 1);
  player.dashCooldown = Math.max(0, player.dashCooldown - 1);
  player.dashTimer = Math.max(0, player.dashTimer - 1);
  player.invuln = Math.max(0, player.invuln - 1);

  updateEnemies();
  updateProjectiles();
  updateCoins();
  updateEffects();

  if (!gameWon && rectsOverlap(player, finishFlag)) {
    gameWon = true;
    player.gold += 50;
    addText("通关 +50 金币", player.x - 18, player.y - 24, colors.gold);
    addParticles(finishFlag.x + 12, finishFlag.y + 20, colors.gold, 46, 11);
  }

  const targetCamera = clamp(player.x - W * 0.38, 0, WORLD_W - W);
  cameraX += (targetCamera - cameraX) * 0.12;
  shake = Math.max(0, shake - 0.6);
}

function updateEnemies() {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    enemy.hitTimer = Math.max(0, enemy.hitTimer - 1);
    enemy.x += enemy.vx;
    if (enemy.x < enemy.minX || enemy.x + enemy.w > enemy.maxX) {
      enemy.vx *= -1;
      enemy.x = clamp(enemy.x, enemy.minX, enemy.maxX - enemy.w);
    }
    if (rectsOverlap(player, enemy)) {
      hurtPlayer(18, enemy.x);
    }
  }
}

function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const p = projectiles[i];
    p.x += p.vx;
    p.life -= 1;
    addParticles(p.x, p.y + p.h / 2, "#ffb13d", 2, 1.6);
    let remove = p.life <= 0 || p.x < 0 || p.x > WORLD_W;
    for (const enemy of enemies) {
      if (!enemy.alive || !rectsOverlap(p, enemy)) continue;
      damageEnemy(enemy, 44, Math.sign(p.vx) * 8);
      addParticles(p.x, p.y, "#ff6a2f", 22, 9);
      remove = true;
      break;
    }
    if (remove) projectiles.splice(i, 1);
  }
}

function updateCoins() {
  for (const coin of coins) {
    if (coin.got) continue;
    const box = { x: coin.x - 12, y: coin.y - 12, w: 24, h: 24 };
    if (rectsOverlap(player, box)) {
      coin.got = true;
      player.gold += 5;
      player.exp = Math.min(99, player.exp + 5);
      addText("+5", coin.x - 4, coin.y - 18, colors.gold);
      addParticles(coin.x, coin.y, colors.gold, 16, 7);
    }
  }
}

function updateEffects() {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.18;
    p.life -= 1;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = floatingTexts.length - 1; i >= 0; i -= 1) {
    const t = floatingTexts[i];
    t.y += t.vy;
    t.life -= 1;
    if (t.life <= 0) floatingTexts.splice(i, 1);
  }
}

function draw() {
  ctx.save();
  const sx = shake ? (Math.random() - 0.5) * shake : 0;
  const sy = shake ? (Math.random() - 0.5) * shake : 0;
  ctx.translate(sx, sy);
  drawBackground();
  ctx.save();
  ctx.translate(-Math.floor(cameraX), 0);
  drawWorld();
  ctx.restore();
  drawHud();
  if (gameWon) drawWinPanel();
  if (player.hp <= 0) drawLosePanel();
  ctx.restore();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#80c9ff");
  sky.addColorStop(0.45, "#c4dba3");
  sky.addColorStop(1, "#193628");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  drawSun(180 - cameraX * 0.03, 138);
  drawClouds(cameraX * 0.12);
  drawMountainLayer("#6f9fb4", 0.08, 235, 0.8);
  drawMountainLayer("#416f72", 0.14, 315, 0.95);
  drawTreeLayer("#2b7d57", 0.22, 420, 0.9);
  drawTreeLayer("#166046", 0.42, 505, 1);

  ctx.fillStyle = "rgba(245, 236, 181, 0.4)";
  for (let i = 0; i < 34; i += 1) {
    const x = (i * 113 - cameraX * 0.08) % W;
    const y = 70 + ((i * 47) % 280);
    pixelRect(x, y, 3, 3);
  }
}

function drawSun(x, y) {
  const glow = ctx.createRadialGradient(x, y, 10, x, y, 120);
  glow.addColorStop(0, "rgba(255, 232, 137, 0.72)");
  glow.addColorStop(1, "rgba(255, 232, 137, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 130, y - 130, 260, 260);
  ctx.fillStyle = "#ffe290";
  pixelRect(x - 18, y - 18, 36, 36);
}

function drawClouds(offset) {
  ctx.fillStyle = "rgba(255, 239, 220, 0.55)";
  for (let i = 0; i < 6; i += 1) {
    const x = (160 + i * 300 - offset) % (W + 220) - 100;
    const y = 60 + (i % 3) * 45;
    pixelRect(x, y, 72, 20);
    pixelRect(x + 24, y - 12, 72, 22);
    pixelRect(x + 78, y + 2, 58, 16);
  }
}

function drawMountainLayer(color, speed, baseY, scale) {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  for (let x = -220; x <= W + 260; x += 220) {
    const px = x - ((cameraX * speed) % 220);
    ctx.lineTo(px + 110, baseY - 130 * scale - ((x / 220) % 2) * 32);
    ctx.lineTo(px + 220, baseY);
  }
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawTreeLayer(color, speed, baseY, alpha) {
  ctx.globalAlpha = alpha;
  for (let i = 0; i < 18; i += 1) {
    const x = ((i * 170 - cameraX * speed) % (W + 220)) - 90;
    const trunkH = 82 + (i % 4) * 24;
    ctx.fillStyle = "#5a412c";
    pixelRect(x + 46, baseY - trunkH + 20, 18, trunkH);
    ctx.fillStyle = color;
    pixelRect(x + 10, baseY - trunkH - 24, 90, 52);
    pixelRect(x + 26, baseY - trunkH - 58, 68, 48);
    pixelRect(x - 4, baseY - trunkH + 6, 62, 42);
    ctx.fillStyle = "rgba(173, 219, 96, 0.42)";
    pixelRect(x + 58, baseY - trunkH - 48, 18, 14);
  }
  ctx.globalAlpha = 1;
}

function drawWorld() {
  drawForestFloor();
  platforms.forEach(drawPlatform);
  coins.forEach(drawCoin);
  drawFinishFlag();
  enemies.forEach(drawEnemy);
  projectiles.forEach(drawProjectile);
  drawPlayer();
  particles.forEach(drawParticle);
  floatingTexts.forEach(drawFloatingText);
}

function drawForestFloor() {
  ctx.fillStyle = "rgba(13, 32, 21, 0.32)";
  pixelRect(cameraX - 20, 622, W + 40, 118);
  for (let x = 0; x < WORLD_W; x += 80) {
    ctx.fillStyle = x % 160 === 0 ? "#3e7e39" : "#2f6e36";
    pixelRect(x + 8, 580 + ((x / 80) % 2) * 8, 28, 10);
    ctx.fillStyle = "#e8ce65";
    if (x % 240 === 0) pixelRect(x + 52, 568, 6, 6);
  }
}

function drawPlatform(p) {
  if (p.type === "branch") {
    ctx.fillStyle = "#4f331e";
    pixelRect(p.x, p.y + 8, p.w, 16);
    ctx.fillStyle = "#8ccf4f";
    pixelRect(p.x - 4, p.y, p.w + 8, 8);
    ctx.fillStyle = "#c5ee6e";
    pixelRect(p.x + 10, p.y, p.w - 28, 3);
    return;
  }
  ctx.fillStyle = colors.soil;
  pixelRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = colors.moss;
  pixelRect(p.x, p.y - 10, p.w, 12);
  ctx.fillStyle = "#c8f06a";
  pixelRect(p.x + 12, p.y - 11, p.w - 24, 3);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  for (let x = p.x + 12; x < p.x + p.w; x += 42) {
    pixelRect(x, p.y + 20, 18, 4);
  }
}

function drawCoin(coin) {
  if (coin.got) return;
  const bob = Math.sin(performance.now() / 260 + coin.x) * 4;
  ctx.fillStyle = "#ffef87";
  pixelRect(coin.x - 7, coin.y - 9 + bob, 14, 18);
  ctx.fillStyle = "#d79627";
  pixelRect(coin.x - 3, coin.y - 5 + bob, 6, 10);
  ctx.fillStyle = "rgba(255, 239, 135, 0.36)";
  pixelRect(coin.x - 12, coin.y - 14 + bob, 24, 28);
}

function drawFinishFlag() {
  ctx.fillStyle = "#583622";
  pixelRect(finishFlag.x, finishFlag.y, 8, finishFlag.h);
  ctx.fillStyle = "#f4d253";
  pixelRect(finishFlag.x + 8, finishFlag.y + 8, 54, 28);
  ctx.fillStyle = "#ff8551";
  pixelRect(finishFlag.x + 8, finishFlag.y + 36, 38, 20);
  ctx.fillStyle = "#fff8d7";
  pixelRect(finishFlag.x + 18, finishFlag.y + 15, 18, 8);
}

function drawEnemy(enemy) {
  if (!enemy.alive) return;
  const blink = enemy.hitTimer > 0 && enemy.hitTimer % 4 < 2;
  ctx.fillStyle = "rgba(0,0,0,0.26)";
  pixelRect(enemy.x + 5, enemy.y + enemy.h - 3, enemy.w - 4, 8);
  ctx.fillStyle = blink ? "#ffffff" : "#6bd567";
  pixelRect(enemy.x + 6, enemy.y + 12, enemy.w - 12, enemy.h - 10);
  ctx.fillStyle = blink ? "#fff0a6" : "#2b7043";
  pixelRect(enemy.x + 12, enemy.y + 5, enemy.w - 24, 16);
  ctx.fillStyle = "#1d3829";
  pixelRect(enemy.x + 14, enemy.y + 24, 6, 6);
  pixelRect(enemy.x + enemy.w - 20, enemy.y + 24, 6, 6);
  ctx.fillStyle = "#1f1b1c";
  pixelRect(enemy.x + 8, enemy.y - 14, enemy.w - 16, 5);
  ctx.fillStyle = "#ff6271";
  pixelRect(enemy.x + 8, enemy.y - 14, (enemy.w - 16) * (enemy.hp / enemy.maxHp), 5);
}

function drawProjectile(p) {
  ctx.fillStyle = "rgba(255, 99, 44, 0.34)";
  pixelRect(p.x - 10, p.y - 5, p.w + 20, p.h + 10);
  ctx.fillStyle = "#ffef6f";
  pixelRect(p.x + 5, p.y + 3, 12, 8);
  ctx.fillStyle = "#ff6c30";
  pixelRect(p.x, p.y, p.w, p.h);
}

function drawPlayer() {
  const flicker = player.invuln > 0 && player.invuln % 8 < 4;
  if (flicker) ctx.globalAlpha = 0.58;
  const x = player.x;
  const y = player.y;
  const runLift = player.onGround ? Math.sin(performance.now() / 95) * Math.min(2, Math.abs(player.vx) / 3) : 0;

  ctx.fillStyle = "rgba(0,0,0,0.26)";
  pixelRect(x + 3, y + player.h - 2, player.w + 8, 8);
  ctx.fillStyle = "#2b2833";
  pixelRect(x + 10, y + 17 + runLift, 24, 30);
  ctx.fillStyle = "#f3d3b1";
  pixelRect(x + 11, y + 3 + runLift, 22, 20);
  ctx.fillStyle = "#1b1820";
  pixelRect(x + 6, y, 30, 16);
  pixelRect(x + 4, y + 9, 10, 16);
  ctx.fillStyle = "#f8f0da";
  pixelRect(x + (player.dir > 0 ? 25 : 9), y + 11 + runLift, 4, 4);
  ctx.fillStyle = "#537be6";
  pixelRect(x + 13, y + 28 + runLift, 18, 16);
  ctx.fillStyle = "#23212c";
  pixelRect(x + 11, y + 45 + runLift, 8, 10);
  pixelRect(x + 26, y + 45 - runLift, 8, 10);
  ctx.fillStyle = "#e3d7b9";
  pixelRect(x + (player.dir > 0 ? 30 : 0), y + 27 + runLift, 11, 7);

  if (player.attackTimer > 0) {
    const slashX = player.dir > 0 ? x + 32 : x - 44;
    ctx.fillStyle = "rgba(255, 246, 198, 0.28)";
    pixelRect(slashX, y + 12, 50, 35);
    ctx.fillStyle = "#fff2ad";
    pixelRect(slashX + 8, y + 22, 38, 7);
  }
  ctx.globalAlpha = 1;
}

function drawParticle(p) {
  ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
  ctx.fillStyle = p.color;
  pixelRect(p.x, p.y, p.size, p.size);
  ctx.globalAlpha = 1;
}

function drawFloatingText(t) {
  ctx.globalAlpha = clamp(t.life / 40, 0, 1);
  ctx.fillStyle = t.color;
  ctx.font = "16px Menlo, monospace";
  ctx.fillText(t.text, t.x, t.y);
  ctx.globalAlpha = 1;
}

function drawHud() {
  drawStatusPanel();
  drawMiniMap();
  drawQuestPanel();
  drawSkillBar();
}

function drawStatusPanel() {
  const x = 16;
  const y = 16;
  panel(x, y, 420, 122);
  ctx.fillStyle = "#202026";
  pixelRect(x + 16, y + 18, 78, 86);
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.strokeRect(x + 16, y + 18, 78, 86);
  drawPortrait(x + 35, y + 32);

  ctx.fillStyle = colors.ink;
  ctx.font = "bold 16px Menlo, monospace";
  ctx.fillText(`Level ${player.level}`, x + 112, y + 30);
  ctx.fillText(`Gold ${player.gold}`, x + 326, y + 30);

  drawBar(x + 112, y + 48, 168, 14, player.hp, player.maxHp, colors.red, "HP");
  drawBar(x + 112, y + 72, 168, 14, player.mp, player.maxMp, colors.blue, "MP");
  drawBar(x + 112, y + 96, 168, 14, player.exp, 100, colors.gold, "EXP");

  ctx.fillStyle = colors.ink;
  ctx.font = "13px Menlo, monospace";
  ctx.fillText(`${Math.round(player.hp)} / ${player.maxHp}`, x + 300, y + 60);
  ctx.fillText(`${Math.round(player.mp)} / ${player.maxMp}`, x + 300, y + 84);
  ctx.fillText(`${Math.round(player.exp)}%`, x + 300, y + 108);
}

function drawPortrait(x, y) {
  ctx.fillStyle = "#1b1720";
  pixelRect(x + 8, y, 28, 22);
  ctx.fillStyle = "#eac7a2";
  pixelRect(x + 10, y + 12, 24, 25);
  ctx.fillStyle = "#2c2d37";
  pixelRect(x + 4, y + 34, 36, 36);
  ctx.fillStyle = "#6094ff";
  pixelRect(x + 12, y + 44, 20, 18);
  ctx.fillStyle = "#fff7e2";
  pixelRect(x + 27, y + 22, 4, 4);
}

function drawBar(x, y, w, h, value, max, fill, label) {
  ctx.fillStyle = "#0d0e12";
  pixelRect(x, y, w, h);
  ctx.fillStyle = fill;
  pixelRect(x, y, Math.max(0, (w * value) / max), h);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  pixelRect(x, y, w, 3);
  ctx.fillStyle = colors.ink;
  ctx.font = "12px Menlo, monospace";
  ctx.fillText(label, x - 42, y + 12);
}

function drawMiniMap() {
  const x = W - 318;
  const y = 16;
  const w = 300;
  const h = 126;
  panel(x, y, w, h);
  ctx.fillStyle = colors.ink;
  ctx.font = "bold 15px Menlo, monospace";
  ctx.fillText("Forest Path", x + 18, y + 24);
  ctx.fillStyle = "rgba(74, 175, 142, 0.18)";
  pixelRect(x + 22, y + 38, w - 44, h - 54);
  ctx.strokeStyle = "rgba(223,255,219,0.28)";
  ctx.strokeRect(x + 22, y + 38, w - 44, h - 54);

  for (const p of platforms) {
    const px = x + 22 + (p.x / WORLD_W) * (w - 44);
    const py = y + 38 + (p.y / H) * (h - 54);
    const pw = Math.max(10, (p.w / WORLD_W) * (w - 44));
    ctx.fillStyle = p.type === "branch" ? "#cde86a" : "#79d45f";
    pixelRect(px, py, pw, 3);
  }
  enemies.forEach((enemy) => {
    if (!enemy.alive) return;
    ctx.fillStyle = "#ff6774";
    pixelRect(x + 22 + (enemy.x / WORLD_W) * (w - 44), y + 38 + (enemy.y / H) * (h - 54), 5, 5);
  });
  ctx.fillStyle = "#44f2ff";
  pixelRect(x + 22 + (player.x / WORLD_W) * (w - 44), y + 38 + (player.y / H) * (h - 54), 6, 6);
  ctx.fillStyle = colors.gold;
  pixelRect(x + 22 + (finishFlag.x / WORLD_W) * (w - 44), y + 38 + (finishFlag.y / H) * (h - 54), 6, 8);
}

function drawQuestPanel() {
  panel(16, H - 100, 360, 82);
  ctx.fillStyle = colors.ink;
  ctx.font = "14px Menlo, monospace";
  ctx.fillText("任务：穿过森林小径，到达右侧旗帜", 32, H - 70);
  ctx.fillText("击败守卫并收集金币，可获得经验", 32, H - 45);
}

function drawSkillBar() {
  const size = 58;
  const gap = 14;
  const total = skillSlots.length * size + (skillSlots.length - 1) * gap;
  const start = W / 2 - total / 2;
  const y = H - 78;
  skillSlots.forEach((slot, i) => {
    const x = start + i * (size + gap);
    ctx.fillStyle = "rgba(16,16,17,0.84)";
    pixelRect(x, y, size, size);
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.strokeRect(x, y, size, size);
    ctx.fillStyle = slot.color;
    if (slot.key === "J") {
      pixelRect(x + 18, y + 22, 30, 8);
      pixelRect(x + 36, y + 15, 8, 22);
    } else if (slot.key === "K") {
      pixelRect(x + 16, y + 20, 28, 20);
      ctx.fillStyle = "#ffe872";
      pixelRect(x + 26, y + 25, 10, 8);
    } else if (slot.key === "L") {
      pixelRect(x + 13, y + 20, 34, 9);
      pixelRect(x + 22, y + 32, 25, 9);
    } else {
      pixelRect(x + 18, y + 16, 22, 8);
      pixelRect(x + 18, y + 16, 8, 26);
      pixelRect(x + 30, y + 34, 10, 8);
    }
    ctx.fillStyle = colors.ink;
    ctx.font = "bold 13px Menlo, monospace";
    ctx.fillText(slot.key, x + 6, y + 14);
    ctx.font = "12px Menlo, monospace";
    ctx.fillText(slot.name, x + 8, y + 51);
    if (slot.key === "K" && player.fireCooldown > 0) drawCooldown(x, y, size, player.fireCooldown / 42);
    if (slot.key === "L" && player.dashCooldown > 0) drawCooldown(x, y, size, player.dashCooldown / 70);
  });
}

function drawCooldown(x, y, size, ratio) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
  pixelRect(x, y, size, size * ratio);
}

function drawWinPanel() {
  panel(W / 2 - 230, H / 2 - 110, 460, 220);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff4d5";
  ctx.font = "bold 30px Menlo, monospace";
  ctx.fillText("森林通关!", W / 2, H / 2 - 42);
  ctx.font = "16px Menlo, monospace";
  ctx.fillText(`金币 ${player.gold} · 等级 ${player.level} · 经验 ${Math.round(player.exp)}%`, W / 2, H / 2 + 2);
  ctx.fillText("按 R 重新开始", W / 2, H / 2 + 46);
  ctx.textAlign = "left";
}

function drawLosePanel() {
  panel(W / 2 - 230, H / 2 - 92, 460, 184);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff4d5";
  ctx.font = "bold 28px Menlo, monospace";
  ctx.fillText("勇者倒下了", W / 2, H / 2 - 26);
  ctx.font = "16px Menlo, monospace";
  ctx.fillText("按 R 回到森林入口", W / 2, H / 2 + 30);
  ctx.textAlign = "left";
}

function panel(x, y, w, h) {
  ctx.fillStyle = colors.panelDark;
  pixelRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  pixelRect(x + 4, y + 4, w - 8, 3);
  ctx.strokeStyle = "rgba(255, 244, 213, 0.16)";
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function pixelRect(x, y, w, h) {
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function loop(time) {
  const delta = Math.min(32, time - lastTime || 16);
  lastTime = time;
  update(delta);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if ([" ", "arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) {
    event.preventDefault();
  }
  keys.add(key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

resetGame();
requestAnimationFrame(loop);

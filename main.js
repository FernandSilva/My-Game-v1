import { AlienEnemy, Civilian, Projectile } from "./enemy.js";
import { cloneLevel, LEVELS } from "./levels.js";
import { FIXED_DT, clamp, rectsOverlap } from "./physics.js";
import { Player } from "./player.js";

const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;
const FORCE_TOUCH_MODE = new URLSearchParams(window.location.search).has("touch");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const root = document.documentElement;
const body = document.body;
const shell = document.querySelector(".game-shell");
const frameEl = document.querySelector(".game-frame");
const dock = document.querySelector(".control-dock");
const orientationPrompt = document.querySelector(".orientation-prompt");

const input = {
  left: false,
  right: false,
  run: false,
  jumpPressed: false,
  shootPressed: false,
};

const audio = createAudio();

// Central runtime state for the current run, level, and render timing.
const state = {
  player: null,
  levelIndex: 0,
  level: null,
  enemies: [],
  civilians: [],
  projectiles: [],
  particles: [],
  score: 0,
  lives: 3,
  cameraX: 0,
  time: 0,
  mode: "title",
  messageTimer: 0,
  messageText: "",
  lastTimestamp: 0,
  accumulator: 0,
  clouds: [],
  ui: {
    touchMode: false,
    showRotatePrompt: false,
    frameScale: 1,
    compactHud: false,
  },
};

function boot() {
  canvas.width = BASE_WIDTH;
  canvas.height = BASE_HEIGHT;
  bindInput();
  bindTouchControls();
  bindResponsiveLayout();
  createClouds();
  loadLevel(0, true);
  requestAnimationFrame(frame);
}

function bindResponsiveLayout() {
  const viewport = window.visualViewport;
  window.addEventListener("resize", updateResponsiveLayout);
  window.addEventListener("orientationchange", updateResponsiveLayout);
  if (viewport) {
    viewport.addEventListener("resize", updateResponsiveLayout);
    viewport.addEventListener("scroll", updateResponsiveLayout);
  }
  updateResponsiveLayout();
}

function updateResponsiveLayout() {
  const viewportWidth = Math.max(320, Math.floor(window.visualViewport?.width ?? window.innerWidth));
  const viewportHeight = Math.max(320, Math.floor(window.visualViewport?.height ?? window.innerHeight));
  const touchMode = shouldUseTouchMode();
  const portrait = viewportHeight > viewportWidth;
  const rotatePrompt = touchMode && portrait;
  const shellGap = touchMode ? 8 : 12;
  const desktopControlsHeight = touchMode ? 0 : 64;
  const dockHeight = touchMode && !rotatePrompt ? clamp(Math.round(viewportHeight * 0.2), 112, 158) : 0;
  const availableWidth = Math.max(280, viewportWidth - (touchMode ? 0 : 24));
  const availableHeight = Math.max(
    220,
    viewportHeight - (touchMode ? dockHeight + shellGap : desktopControlsHeight + shellGap + 28)
  );
  const scale = Math.min(availableWidth / BASE_WIDTH, availableHeight / BASE_HEIGHT);
  const frameWidth = Math.floor(BASE_WIDTH * scale);
  const frameHeight = Math.floor(BASE_HEIGHT * scale);

  state.ui.touchMode = touchMode;
  state.ui.showRotatePrompt = rotatePrompt;
  state.ui.frameScale = scale;
  state.ui.compactHud = touchMode && scale < 0.72;

  body.classList.toggle("touch-mode", touchMode);
  body.classList.toggle("show-rotate", rotatePrompt);
  root.style.setProperty("--app-height", `${viewportHeight}px`);
  root.style.setProperty("--shell-width", `${frameWidth}px`);
  root.style.setProperty("--frame-width", `${frameWidth}px`);
  root.style.setProperty("--frame-height", `${frameHeight}px`);
  root.style.setProperty("--dock-height", `${dockHeight}px`);

  shell.dataset.mode = touchMode ? "touch" : "desktop";
  frameEl.style.width = `${frameWidth}px`;
  frameEl.style.height = `${frameHeight}px`;
  dock.hidden = !touchMode || rotatePrompt;
  orientationPrompt.hidden = !rotatePrompt;
}

function shouldUseTouchMode() {
  return (
    FORCE_TOUCH_MODE ||
    window.matchMedia("(pointer: coarse)").matches ||
    navigator.maxTouchPoints > 0
  );
}

function loadLevel(index, freshStart = false) {
  state.levelIndex = index;
  state.level = cloneLevel(index);
  state.enemies = state.level.enemies.map((enemy) => new AlienEnemy(enemy));
  state.civilians = state.level.civilians.map((civilian) => new Civilian(civilian));
  state.projectiles = [];
  state.particles = [];
  state.cameraX = 0;
  if (freshStart || !state.player) {
    state.player = new Player(state.level.spawn.x, state.level.spawn.y);
  }
  state.player.spawn = { ...state.level.spawn };
  state.player.reset(state.level.spawn);
  state.mode = freshStart ? "title" : "playing";
  state.messageTimer = 0;
  state.messageText = "";
}

function restartGame() {
  state.score = 0;
  state.lives = 3;
  loadLevel(0, true);
}

function frame(timestamp) {
  if (!state.lastTimestamp) state.lastTimestamp = timestamp;
  const delta = Math.min(0.05, (timestamp - state.lastTimestamp) / 1000);
  state.lastTimestamp = timestamp;
  state.accumulator += delta;

  while (state.accumulator >= FIXED_DT) {
    update(FIXED_DT);
    state.accumulator -= FIXED_DT;
  }

  render();
  requestAnimationFrame(frame);
}

function update(dt) {
  state.time += dt;
  if (state.mode === "title") {
    audio.update(dt, false);
    if (input.jumpPressed || input.shootPressed) {
      state.mode = "playing";
    }
    resetPressed();
    return;
  }

  if (state.mode === "gameover") {
    audio.update(dt, false);
    if (input.jumpPressed || input.shootPressed) restartGame();
    resetPressed();
    return;
  }

  if (state.mode === "levelComplete") {
    audio.update(dt, true);
    state.messageTimer -= dt;
    if (state.messageTimer <= 0) {
      if (state.levelIndex === LEVELS.length - 1) {
        state.mode = "won";
      } else {
        loadLevel(state.levelIndex + 1);
      }
    }
    resetPressed();
    return;
  }

  if (state.mode === "won") {
    audio.update(dt, true);
    if (input.jumpPressed || input.shootPressed) restartGame();
    resetPressed();
    return;
  }

  // Gameplay updates run on a fixed timestep for stable platforming physics.
  audio.update(dt, true);
  updateMovingPlatforms(dt);
  state.player.update(dt, input, state.level);

  if (state.player.wantsToShoot(input)) {
    state.player.onShoot();
    state.projectiles.push(
      new Projectile(
        state.player.x + state.player.width / 2 + state.player.facing * 20,
        state.player.y + 34,
        state.player.facing
      )
    );
    audio.play("shoot");
  }

  for (const projectile of state.projectiles) {
    projectile.update(dt);
    if (projectile.x < 0 || projectile.x > state.level.width) projectile.dead = true;
    for (const platform of state.level.platforms) {
      if (
        projectile.x + projectile.radius > platform.x &&
        projectile.x - projectile.radius < platform.x + platform.width &&
        projectile.y + projectile.radius > platform.y &&
        projectile.y - projectile.radius < platform.y + platform.height
      ) {
        projectile.dead = true;
      }
    }
  }

  // Enemy resolution handles stomp kills, projectile hits, and contact damage.
  for (const enemy of state.enemies) {
    enemy.update(dt, state.time, state.player);
    if (enemy.stompedBy(state.player)) {
      state.player.vy = -420;
      defeatEnemy(enemy, 150, "#ffffff", "alien");
    } else if (enemy.touches(state.player) && state.player.invulnerable <= 0) {
      damagePlayer();
      break;
    }
    for (const projectile of state.projectiles) {
      if (!projectile.dead && enemy.hitByProjectile(projectile)) {
        projectile.dead = true;
        defeatEnemy(enemy, 100, "#93f5ff", "alien");
      }
    }
  }

  for (const civilian of state.civilians) {
    civilian.update(dt, state.time, state.level.width);
    if (rectsOverlap(civilian.bounds, state.player.bounds)) {
      punishCivilianHit();
      break;
    }
    for (const projectile of state.projectiles) {
      if (!projectile.dead && projectileHitsRect(projectile, civilian.bounds)) {
        projectile.dead = true;
        punishCivilianHit();
        break;
      }
    }
    if (state.mode !== "playing") break;
  }

  for (const coin of state.level.collectibles) {
    if (!coin.taken && rectsOverlap({ x: coin.x - 12, y: coin.y - 12, width: 24, height: 24 }, state.player.bounds)) {
      coin.taken = true;
      state.score += 25;
      burst(coin.x, coin.y, "#ffd84d", 8);
      audio.play("coin");
    }
  }

  state.projectiles = state.projectiles.filter((projectile) => !projectile.dead);
  state.enemies = state.enemies.filter((enemy) => !(enemy.dead && enemy.pop <= 0));

  updateParticles(dt);
  updateCamera();
  checkGoal();
  checkFall();
  resetPressed();
}

function updateMovingPlatforms(dt) {
  for (const platform of state.level.platforms) {
    platform.vx = 0;
    if (!platform.moving) continue;
    const delta = platform.speed * dt * platform.dir;
    if (platform.axis === "x") {
      platform.x += delta;
      platform.vx = delta / dt;
      if (platform.x <= platform.min || platform.x >= platform.max) {
        platform.dir *= -1;
        platform.x = clamp(platform.x, platform.min, platform.max);
      }
    } else {
      platform.y += delta;
      if (platform.y <= platform.min || platform.y >= platform.max) {
        platform.dir *= -1;
        platform.y = clamp(platform.y, platform.min, platform.max);
      }
    }
  }
}

function defeatEnemy(enemy, scoreValue, color, voiceLine = null) {
  enemy.defeat();
  state.score += scoreValue;
  burst(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, color, 18);
  audio.play("pop");
  if (voiceLine) audio.speak(voiceLine);
}

function punishCivilianHit() {
  audio.speak("American");
  damagePlayer();
}

function updateParticles(dt) {
  for (const particle of state.particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 600 * dt;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function burst(x, y, color, count = 14) {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = 70 + Math.random() * 160;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 80,
      color,
      life: 0.5 + Math.random() * 0.25,
    });
  }
}

function damagePlayer() {
  state.lives -= 1;
  audio.play("hit");
  burst(state.player.x + state.player.width / 2, state.player.y + state.player.height / 2, "#ff6b6b", 16);
  if (state.lives <= 0) {
    state.mode = "gameover";
    return;
  }
  state.player.reset(state.player.spawn);
}

function checkGoal() {
  const goal = state.level.goal;
  if (rectsOverlap(state.player.bounds, goal)) {
    state.mode = "levelComplete";
    state.messageTimer = 2.4;
    state.messageText = "Level Complete! Tremendous!";
    state.score += 500;
    audio.play("victory");
    audio.speak("Make America great again");
  }
}

function checkFall() {
  if (state.player.y > canvas.height + 180) {
    damagePlayer();
  }
}

function updateCamera() {
  const target = state.player.x - canvas.width * 0.35;
  state.cameraX = clamp(target, 0, state.level.width - canvas.width);
}

function render() {
  const level = state.level;
  drawBackground(level, state.cameraX, state.time);
  drawPlatforms(level.platforms, state.cameraX);
  drawCollectibles(level.collectibles, state.cameraX, state.time);
  drawGoal(level.goal, state.cameraX, state.mode === "levelComplete" ? state.time : 0);

  for (const enemy of state.enemies) enemy.draw(ctx, state.cameraX, state.time);
  for (const civilian of state.civilians) civilian.draw(ctx, state.cameraX, state.time);
  for (const projectile of state.projectiles) projectile.draw(ctx, state.cameraX, state.time);
  for (const particle of state.particles) drawParticle(particle, state.cameraX);

  if (state.mode === "levelComplete" || state.mode === "won") {
    drawVictoryPose();
  } else {
    state.player.draw(ctx, state.cameraX, state.time);
  }

  drawHud();
  drawOverlay();
}

function drawBackground(level, cameraX, time) {
  // Background layers use simple parallax so each city reads differently in motion.
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, level.sky[0]);
  sky.addColorStop(1, level.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sunX = canvas.width - 180;
  ctx.fillStyle = "rgba(255, 240, 180, 0.85)";
  ctx.beginPath();
  ctx.arc(sunX, 110, 56, 0, Math.PI * 2);
  ctx.fill();

  for (const cloud of state.clouds) {
    drawCloud(cloud, cameraX, time);
  }

  const farOffset = -(cameraX * 0.18) % canvas.width;
  const nearOffset = -(cameraX * 0.35) % 280;
  drawSkyline(level.deco.skyline, farOffset, 0.18, level.palette, time);
  drawStreet(level.deco.skyline, nearOffset, level.palette);

  ctx.fillStyle = "#42464f";
  ctx.fillRect(0, 590, canvas.width, 130);
  ctx.fillStyle = "#f3e37c";
  for (let i = -1; i < 12; i += 1) {
    ctx.fillRect(i * 130 + 40 + (cameraX * 0.4) % 130, 650, 66, 8);
  }
}

function drawSkyline(type, offset, parallax, palette, time) {
  const baseY = 360;
  for (let i = -1; i < 8; i += 1) {
    const x = i * 190 + offset;
    const width = 120 + ((i * 31) % 60);
    const height = 120 + ((i * 47 + 70) % 180);
    ctx.fillStyle = i % 2 === 0 ? "rgba(34,48,90,0.55)" : "rgba(20,33,66,0.48)";
    ctx.fillRect(x, baseY - height, width, height);
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        ctx.fillStyle = (row + col + i) % 2 === 0 ? "rgba(255,225,122,0.5)" : "rgba(255,255,255,0.12)";
        ctx.fillRect(x + 14 + col * 28, baseY - height + 16 + row * 24, 12, 14);
      }
    }
  }

  ctx.save();
  ctx.translate(0, parallax * 20);
  if (type === "brooklyn") {
    ctx.strokeStyle = "rgba(180,120,80,0.7)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-20 + offset, 280);
    ctx.quadraticCurveTo(170 + offset, 160, 360 + offset, 280);
    ctx.quadraticCurveTo(550 + offset, 160, 740 + offset, 280);
    ctx.stroke();
  } else if (type === "hamburg") {
    ctx.fillStyle = "rgba(50,70,90,0.55)";
    ctx.fillRect(80 + offset, 240, 14, 100);
    ctx.fillRect(96 + offset, 240, 80, 8);
    ctx.beginPath();
    ctx.moveTo(176 + offset, 248);
    ctx.lineTo(126 + offset, 310);
    ctx.lineTo(132 + offset, 316);
    ctx.lineTo(182 + offset, 256);
    ctx.fill();
  } else if (type === "tokyo") {
    for (let i = 0; i < 6; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? palette[1] : palette[2];
      ctx.fillRect(70 + i * 110 + offset, 180 + (i % 3) * 20, 60, 26);
    }
  } else if (type === "london") {
    ctx.fillStyle = "rgba(30,30,60,0.62)";
    ctx.fillRect(200 + offset, 170, 42, 190);
    ctx.fillRect(188 + offset, 150, 66, 24);
    ctx.beginPath();
    ctx.arc(221 + offset, 230, 18, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "dubai") {
    ctx.fillStyle = "rgba(50,70,100,0.52)";
    ctx.beginPath();
    ctx.moveTo(260 + offset, 340);
    ctx.lineTo(310 + offset, 140);
    ctx.lineTo(340 + offset, 340);
    ctx.closePath();
    ctx.fill();
  } else if (type === "manhattan") {
    ctx.fillStyle = "rgba(255, 230, 90, 0.5)";
    for (let i = 0; i < 5; i += 1) {
      ctx.fillRect(90 + i * 150 + offset, 170 + Math.sin(time * 2 + i) * 6, 70, 18);
    }
  }
  ctx.restore();
}

function drawStreet(type, offset, palette) {
  ctx.fillStyle = type === "dubai" ? "#dfb574" : "#5c677d";
  ctx.fillRect(0, 520, canvas.width, 80);
  for (let i = -1; i < 6; i += 1) {
    const x = i * 280 + offset;
    if (type === "manhattan") {
      ctx.fillStyle = "#ffd54f";
      ctx.fillRect(x + 30, 548, 70, 24);
      ctx.fillStyle = "#111";
      ctx.fillRect(x + 34, 570, 14, 6);
      ctx.fillRect(x + 82, 570, 14, 6);
      ctx.fillStyle = "#2b2d42";
      ctx.fillRect(x + 42, 552, 18, 10);
      ctx.fillRect(x + 68, 552, 18, 10);
    } else if (type === "brooklyn") {
      ctx.fillStyle = "#a26769";
      ctx.fillRect(x + 20, 480, 90, 60);
      ctx.fillStyle = "#8d99ae";
      ctx.fillRect(x + 122, 500, 64, 40);
      ctx.fillStyle = palette[2];
      ctx.fillRect(x + 130, 508, 48, 12);
    } else if (type === "hamburg") {
      ctx.fillStyle = "#5dade2";
      ctx.fillRect(x + 10, 560, 120, 18);
      ctx.fillStyle = "#c4d7f2";
      ctx.fillRect(x + 42, 528, 50, 18);
    } else if (type === "tokyo") {
      ctx.fillStyle = palette[1];
      ctx.fillRect(x + 30, 462, 84, 42);
      ctx.fillStyle = "#111";
      ctx.fillRect(x + 38, 470, 68, 8);
      ctx.fillStyle = "#f8f7ff";
      ctx.fillRect(x + 44, 484, 52, 12);
    } else if (type === "london") {
      ctx.fillStyle = "#d62828";
      ctx.fillRect(x + 20, 500, 110, 36);
      ctx.fillStyle = "#f1faee";
      ctx.fillRect(x + 36, 510, 22, 10);
      ctx.fillRect(x + 64, 510, 22, 10);
      ctx.fillRect(x + 92, 510, 22, 10);
    } else if (type === "dubai") {
      ctx.fillStyle = "#8ecae6";
      ctx.fillRect(x + 16, 490, 44, 72);
      ctx.fillStyle = "#219ebc";
      ctx.fillRect(x + 66, 470, 34, 92);
    }
  }
}

function drawPlatforms(platforms, cameraX) {
  for (const platform of platforms) {
    const x = platform.x - cameraX;
    if (x + platform.width < -40 || x > canvas.width + 40) continue;
    const top = ctx.createLinearGradient(0, platform.y, 0, platform.y + platform.height);
    top.addColorStop(0, "#6ec1ff");
    top.addColorStop(1, "#3869a8");
    ctx.fillStyle = top;
    ctx.fillRect(x, platform.y, platform.width, platform.height);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(x + 4, platform.y + 4, platform.width - 8, 8);
    ctx.strokeStyle = "rgba(15,25,45,0.35)";
    for (let ix = 16; ix < platform.width - 8; ix += 32) {
      ctx.beginPath();
      ctx.moveTo(x + ix, platform.y + 12);
      ctx.lineTo(x + ix, platform.y + platform.height - 8);
      ctx.stroke();
    }
    for (let iy = 28; iy < platform.height - 6; iy += 26) {
      ctx.beginPath();
      ctx.moveTo(x + 8, platform.y + iy);
      ctx.lineTo(x + platform.width - 8, platform.y + iy);
      ctx.stroke();
    }
    if (platform.moving) {
      ctx.fillStyle = "#ffd84d";
      ctx.fillRect(x + 10, platform.y + platform.height / 2 - 4, platform.width - 20, 8);
    }
  }
}

function drawCollectibles(collectibles, cameraX, time) {
  for (const coin of collectibles) {
    if (coin.taken) continue;
    const x = coin.x - cameraX;
    const bob = Math.sin(time * 5 + coin.x) * 5;
    ctx.fillStyle = "#ffe066";
    ctx.beginPath();
    ctx.arc(x, coin.y + bob, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff6b7";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function drawGoal(goal, cameraX, time) {
  const x = goal.x - cameraX;
  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(x, goal.y - 40, 8, goal.height + 40);
  ctx.fillStyle = "#ff4d6d";
  ctx.beginPath();
  ctx.moveTo(x + 8, goal.y - 34);
  ctx.lineTo(x + 58, goal.y - 20 + Math.sin(time * 10) * 2);
  ctx.lineTo(x + 8, goal.y - 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(x + 2, goal.y - 40, 3, goal.height + 40);
}

function drawParticle(particle, cameraX) {
  ctx.globalAlpha = Math.max(0, particle.life * 1.4);
  ctx.fillStyle = particle.color;
  ctx.beginPath();
  ctx.arc(particle.x - cameraX, particle.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawHud() {
  const hudWidth = state.ui.compactHud ? 290 : 330;
  const hudHeight = state.ui.compactHud ? 76 : 88;
  const titleSize = state.ui.compactHud ? 17 : 20;
  const bodySize = state.ui.compactHud ? 14 : 16;
  ctx.fillStyle = "rgba(12, 18, 34, 0.76)";
  ctx.fillRect(18, 18, hudWidth, hudHeight);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.strokeRect(18, 18, hudWidth, hudHeight);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${titleSize}px Trebuchet MS`;
  ctx.fillText("METRO MAYHEM", 34, state.ui.compactHud ? 44 : 48);
  ctx.font = `${bodySize}px Trebuchet MS`;
  ctx.fillText(`Level ${state.levelIndex + 1}: ${state.level.name}`, 34, state.ui.compactHud ? 66 : 74);
  ctx.fillText(`Score ${state.score}`, 34, state.ui.compactHud ? 86 : 96);
  ctx.fillText(`Lives ${state.lives}`, state.ui.compactHud ? 198 : 220, state.ui.compactHud ? 86 : 96);
}

function drawOverlay() {
  ctx.textAlign = "center";
  if (state.mode === "title") {
    const title = state.ui.touchMode ? "Tap Jump or Fire to start" : "Press Spacebar or X to start";
    const lines = state.ui.touchMode
      ? [
          "Move: Left / Right buttons",
          "Jump: Tap Jump",
          "Double Jump: Tap Jump twice",
          "Fire: Tap Fire",
        ]
      : [
          "Move: Left / Right Arrows",
          "Jump: Spacebar",
          "Double Jump: Spacebar Twice",
          "Fire: X",
        ];
    drawCenteredPanel(title, lines, { width: state.ui.compactHud ? 660 : 760, minHeight: 260 });
  } else if (state.mode === "levelComplete") {
    drawCenteredPanel(state.messageText, `Next stop: ${LEVELS[state.levelIndex + 1]?.name ?? "Victory"}`);
  } else if (state.mode === "gameover") {
    drawCenteredPanel("Game Over", "Press Space or Z to restart");
  } else if (state.mode === "won") {
    drawCenteredPanel("You Conquered Every City", "Press Space or Z to play again");
  }
  ctx.textAlign = "left";
}

function drawCenteredPanel(title, subtitle, options = {}) {
  const maxWidth = options.width ?? (state.ui.compactHud ? 680 : 760);
  const subtitleLines = Array.isArray(subtitle)
    ? subtitle
    : wrapText(subtitle, maxWidth - 110, `${state.ui.compactHud ? 16 : 18}px Trebuchet MS`);
  const panelHeight = Math.max(options.minHeight ?? 170, 112 + subtitleLines.length * (state.ui.compactHud ? 30 : 34));
  const panelY = state.ui.compactHud ? 126 : 150;
  ctx.fillStyle = "rgba(11, 14, 30, 0.78)";
  ctx.fillRect(canvas.width / 2 - maxWidth / 2, panelY, maxWidth, panelHeight);
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.strokeRect(canvas.width / 2 - maxWidth / 2, panelY, maxWidth, panelHeight);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${state.ui.compactHud ? 28 : 34}px Trebuchet MS`;
  ctx.fillText(title, canvas.width / 2, panelY + (state.ui.compactHud ? 48 : 55));
  ctx.font = `${state.ui.compactHud ? 16 : 18}px Trebuchet MS`;
  subtitleLines.forEach((line, index) => {
    ctx.fillText(line, canvas.width / 2, panelY + (state.ui.compactHud ? 90 : 104) + index * (state.ui.compactHud ? 30 : 34));
  });
}

function drawVictoryPose() {
  ctx.save();
  const x = state.player.x - state.cameraX;
  const y = state.player.y;
  ctx.translate(x + state.player.width / 2, y + state.player.height / 2);

  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.beginPath();
  ctx.ellipse(0, 52, 24, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1d2b53";
  ctx.beginPath();
  ctx.roundRect(-22, -4, 44, 36, 8);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-12, -4, 24, 20);
  ctx.fillStyle = "#e7332f";
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(-8, 24);
  ctx.lineTo(8, 24);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#1d2b53";
  ctx.fillRect(-16, 32, 10, 20);
  ctx.fillRect(6, 32, 10, 20);
  ctx.fillStyle = "#111";
  ctx.fillRect(-18, 50, 16, 8);
  ctx.fillRect(2, 50, 16, 8);

  ctx.fillStyle = "#e89a55";
  ctx.beginPath();
  ctx.roundRect(-24, -42, 48, 48, 18);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.ellipse(-8, -26, 10, 15, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f4c318";
  ctx.beginPath();
  ctx.ellipse(0, -46, 24, 15, 0, Math.PI, 2 * Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-22, -38);
  ctx.quadraticCurveTo(6, -58, 20, -30);
  ctx.lineTo(2, -20);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#1d2b53";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-22, 4);
  ctx.lineTo(-34, -18);
  ctx.moveTo(22, 4);
  ctx.lineTo(34, -18);
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(-10, -20, 7, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(10, -20, 7, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(-10, -20, 2.8, 0, Math.PI * 2);
  ctx.arc(10, -20, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d66d4d";
  ctx.fillRect(14, -10, 8, 5);
  ctx.restore();
}

function wrapText(text, maxWidth, font) {
  ctx.save();
  ctx.font = font;
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  ctx.restore();
  return lines;
}

function projectileHitsRect(projectile, rect) {
  return (
    projectile.x + projectile.radius > rect.x &&
    projectile.x - projectile.radius < rect.x + rect.width &&
    projectile.y + projectile.radius > rect.y &&
    projectile.y - projectile.radius < rect.y + rect.height
  );
}

function createClouds() {
  state.clouds = Array.from({ length: 10 }, (_, index) => ({
    x: index * 180 + 40,
    y: 70 + (index % 4) * 35,
    width: 70 + (index % 3) * 24,
  }));
}

function drawCloud(cloud, cameraX, time) {
  const x = (cloud.x - cameraX * 0.08 + time * 6) % (canvas.width + 220);
  const drawX = x < -120 ? x + canvas.width + 220 : x;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.arc(drawX, cloud.y, cloud.width * 0.26, 0, Math.PI * 2);
  ctx.arc(drawX + cloud.width * 0.22, cloud.y - 10, cloud.width * 0.24, 0, Math.PI * 2);
  ctx.arc(drawX + cloud.width * 0.5, cloud.y, cloud.width * 0.3, 0, Math.PI * 2);
  ctx.arc(drawX + cloud.width * 0.76, cloud.y + 4, cloud.width * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function bindInput() {
  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "Space", "KeyX", "ShiftLeft", "ShiftRight"].includes(event.code)) {
      event.preventDefault();
    }
    audio.unlock();
    if (event.code === "ArrowLeft") input.left = true;
    if (event.code === "ArrowRight") input.right = true;
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") input.run = true;
    if (event.code === "Space") input.jumpPressed = true;
    if (event.code === "KeyX") input.shootPressed = true;
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "ArrowLeft") input.left = false;
    if (event.code === "ArrowRight") input.right = false;
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") input.run = false;
  });

  document.addEventListener(
    "touchmove",
    (event) => {
      if (state.ui.touchMode) event.preventDefault();
    },
    { passive: false }
  );
}

function bindTouchControls() {
  const buttons = document.querySelectorAll("[data-touch]");
  const pointerActions = new Map();

  function setActionState(action, active) {
    if (action === "left") input.left = active;
    if (action === "right") input.right = active;
    if (action === "jump") input.jumpPressed = active;
    if (action === "fire") input.shootPressed = active;
  }

  function releasePointer(pointerId) {
    const entry = pointerActions.get(pointerId);
    if (!entry) return;
    pointerActions.delete(pointerId);
    entry.button.classList.remove("is-active");
    setActionState(entry.action, false);
  }

  for (const button of buttons) {
    const action = button.dataset.touch;

    button.addEventListener("pointerdown", (event) => {
      if (!state.ui.touchMode || state.ui.showRotatePrompt) return;
      event.preventDefault();
      audio.unlock();
      pointerActions.set(event.pointerId, { action, button });
      button.classList.add("is-active");
      setActionState(action, true);
      button.setPointerCapture(event.pointerId);
    });

    button.addEventListener("pointerup", (event) => {
      event.preventDefault();
      releasePointer(event.pointerId);
    });

    button.addEventListener("pointercancel", (event) => {
      event.preventDefault();
      releasePointer(event.pointerId);
    });

    button.addEventListener("lostpointercapture", (event) => {
      releasePointer(event.pointerId);
    });
  }

  window.addEventListener("blur", () => {
    for (const pointerId of pointerActions.keys()) releasePointer(pointerId);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      for (const pointerId of pointerActions.keys()) releasePointer(pointerId);
    }
  });
}

function resetPressed() {
  input.jumpPressed = false;
  input.shootPressed = false;
}

function createAudio() {
  // Tiny synth-style sound generator keeps the prototype self-contained.
  const AudioContextRef = window.AudioContext || window.webkitAudioContext;
  const context = AudioContextRef ? new AudioContextRef() : null;
  const soundtrack = {
    step: 0,
    nextNote: 0,
    bassNext: 0,
  };
  const melody = [
    [392.0, 0.18], [523.25, 0.18], [659.25, 0.2], [523.25, 0.16],
    [440.0, 0.16], [523.25, 0.18], [587.33, 0.2], [659.25, 0.26],
    [698.46, 0.18], [659.25, 0.18], [523.25, 0.18], [440.0, 0.18],
    [392.0, 0.18], [523.25, 0.18], [659.25, 0.2], [523.25, 0.24],
  ];
  const bass = [130.81, 146.83, 174.61, 196.0, 164.81, 146.83, 130.81, 196.0];
  let lastSpeechTime = 0;

  function beep(type, frequency, duration, gainValue, slide = 0) {
    if (!context) return;
    if (context.state === "suspended") context.resume();
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, context.currentTime);
    if (slide) {
      osc.frequency.linearRampToValueAtTime(frequency + slide, context.currentTime + duration);
    }
    gain.gain.setValueAtTime(gainValue, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + duration);
  }

  function pad(frequency, duration, gainValue) {
    if (!context) return;
    if (context.state === "suspended") context.resume();
    const osc = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(frequency, context.currentTime);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, context.currentTime);
    gain.gain.setValueAtTime(gainValue, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + duration);
  }

  return {
    play(name) {
      if (name === "shoot") beep("sine", 360, 0.12, 0.04, 120);
      if (name === "pop") beep("triangle", 280, 0.1, 0.05, -160);
      if (name === "coin") beep("square", 760, 0.08, 0.03, 120);
      if (name === "hit") beep("sawtooth", 190, 0.18, 0.06, -120);
      if (name === "victory") {
        beep("square", 523, 0.12, 0.04, 0);
        setTimeout(() => beep("square", 659, 0.12, 0.04, 0), 130);
        setTimeout(() => beep("square", 784, 0.18, 0.05, 0), 260);
      }
    },
    update(dt, active) {
      if (!context || !active) return;
      if (context.state === "suspended") return;
      soundtrack.nextNote -= dt;
      soundtrack.bassNext -= dt;
      if (soundtrack.nextNote <= 0) {
        const [frequency, duration] = melody[soundtrack.step % melody.length];
        if (frequency > 0) {
          beep("square", frequency, duration, 0.012, 4);
        }
        soundtrack.nextNote = duration + 0.04;
        soundtrack.step += 1;
      }
      if (soundtrack.bassNext <= 0) {
        const frequency = bass[soundtrack.step % bass.length];
        pad(frequency, 0.42, 0.008);
        soundtrack.bassNext = 0.42;
      }
    },
    speak(text) {
      const synth = window.speechSynthesis;
      const now = performance.now();
      if (!synth || now - lastSpeechTime < 1200) return;
      lastSpeechTime = now;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 0.78;
      utterance.volume = 0.9;
      synth.speak(utterance);
    },
    unlock() {
      if (context && context.state === "suspended") {
        context.resume();
      }
    },
  };
}

boot();

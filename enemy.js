import { circleRectOverlap, rectsOverlap } from "./physics.js";

export class Projectile {
  constructor(x, y, dir) {
    this.x = x;
    this.y = y;
    this.radius = 10;
    this.vx = dir * 560;
    this.life = 1.5;
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx, cameraX, time) {
    const x = this.x - cameraX;
    const glow = 12 + Math.sin(time * 20) * 3;
    const gradient = ctx.createRadialGradient(x, this.y, 4, x, this.y, glow);
    gradient.addColorStop(0, "rgba(255,255,255,0.95)");
    gradient.addColorStop(0.4, "rgba(120,230,255,0.95)");
    gradient.addColorStop(1, "rgba(120,230,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, this.y, glow, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c8ffff";
    ctx.beginPath();
    ctx.arc(x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class AlienEnemy {
  constructor(config) {
    this.x = config.x;
    this.baseY = config.y;
    this.y = config.y;
    this.width = 58;
    this.height = 62;
    this.speed = config.speed ?? 72;
    this.phase = config.phase ?? 0;
    this.hat = config.hat ?? "top";
    this.dead = false;
    this.pop = 0;
  }

  get bounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  update(dt, time, player) {
    // Ghosts drift toward the player while bobbing vertically to feel floaty.
    if (this.dead) {
      this.pop -= dt;
      return;
    }
    this.y = this.baseY + Math.sin(time * 2.6 + this.phase) * 16;
    const dir = Math.sign(player.x - this.x);
    this.x += dir * this.speed * dt;
  }

  stompedBy(player) {
    return (
      !this.dead &&
      rectsOverlap(this.bounds, player.bounds) &&
      player.vy > 80 &&
      player.y + player.height - 12 < this.y + this.height / 2
    );
  }

  hitByProjectile(projectile) {
    return !this.dead && circleRectOverlap(projectile, this.bounds);
  }

  touches(player) {
    return !this.dead && rectsOverlap(this.bounds, player.bounds);
  }

  defeat() {
    this.dead = true;
    this.pop = 0.35;
  }

  draw(ctx, cameraX, time) {
    const x = this.x - cameraX;
    if (this.dead) {
      const r = 30 * (this.pop / 0.35);
      ctx.fillStyle = `rgba(255,255,255,${this.pop / 0.35})`;
      ctx.beginPath();
      ctx.arc(x + this.width / 2, this.y + this.height / 2, r, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    ctx.save();
    ctx.globalAlpha = 0.92;
    const bodyY = this.y + Math.sin(time * 3 + this.phase) * 2;
    const glow = ctx.createRadialGradient(
      x + this.width / 2,
      bodyY + 24,
      6,
      x + this.width / 2,
      bodyY + 24,
      36
    );
    glow.addColorStop(0, "rgba(174,255,194,0.75)");
    glow.addColorStop(1, "rgba(76,201,91,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x + this.width / 2, bodyY + 30, 36, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(x + 29, bodyY + 18, 24, 21, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#89f06a";
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#63c74d";
    ctx.beginPath();
    ctx.ellipse(x + 29, bodyY + 46, 18, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#4b9b36";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 18, bodyY + 47);
    ctx.lineTo(x + 8, bodyY + 60);
    ctx.moveTo(x + 40, bodyY + 47);
    ctx.lineTo(x + 50, bodyY + 60);
    ctx.moveTo(x + 22, bodyY + 50);
    ctx.lineTo(x + 18, bodyY + 66);
    ctx.moveTo(x + 36, bodyY + 50);
    ctx.lineTo(x + 40, bodyY + 66);
    ctx.stroke();

    ctx.fillStyle = "#101010";
    ctx.beginPath();
    ctx.ellipse(x + 21, bodyY + 18, 6, 11, -0.25, 0, Math.PI * 2);
    ctx.ellipse(x + 37, bodyY + 18, 6, 11, 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#2e5a20";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 29, bodyY + 28, 7, 0.2, Math.PI - 0.2);
    ctx.stroke();

    ctx.strokeStyle = "#89f06a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 22, bodyY - 2);
    ctx.lineTo(x + 14, bodyY - 18);
    ctx.moveTo(x + 36, bodyY - 2);
    ctx.lineTo(x + 44, bodyY - 18);
    ctx.stroke();

    ctx.fillStyle = "#9cff80";
    ctx.beginPath();
    ctx.arc(x + 14, bodyY - 18, 4, 0, Math.PI * 2);
    ctx.arc(x + 44, bodyY - 18, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class Civilian {
  constructor(config) {
    this.x = config.x;
    this.baseY = config.y;
    this.y = config.y;
    this.width = config.child ? 34 : 42;
    this.height = config.child ? 58 : 76;
    this.speed = config.speed ?? 48;
    this.dir = config.dir ?? 1;
    this.phase = config.phase ?? 0;
    this.child = Boolean(config.child);
    this.variant = config.variant ?? "man";
  }

  get bounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  update(dt, time, levelWidth) {
    this.x += this.dir * this.speed * dt;
    this.y = this.baseY + Math.sin(time * 2 + this.phase) * 2;
    if (this.x < 80 || this.x > levelWidth - 120) this.dir *= -1;
  }

  draw(ctx, cameraX, time) {
    const x = this.x - cameraX;
    const y = this.y;
    const sway = Math.sin(time * 8 + this.phase) * 3;
    const skin = this.variant === "woman" ? "#f0bf9a" : this.variant === "child" ? "#efc8a5" : "#dba47e";
    const shirt = this.variant === "woman" ? "#ff6b6b" : this.variant === "child" ? "#ffd166" : "#4ea8de";
    const pants = this.variant === "woman" ? "#5c677d" : this.variant === "child" ? "#4d908e" : "#2d3142";

    ctx.save();
    ctx.translate(x + this.width / 2, y + this.height / 2);
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.beginPath();
    ctx.ellipse(0, this.height / 2 - 2, this.width * 0.4, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, -this.height / 2 + 16, this.child ? 12 : 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.variant === "woman" ? "#6d597a" : this.variant === "child" ? "#7a4f2a" : "#3a2d1f";
    ctx.beginPath();
    ctx.arc(0, -this.height / 2 + 12, this.child ? 12 : 14, Math.PI, 0);
    ctx.fill();

    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.roundRect(-12, -8, 24, this.child ? 24 : 30, 8);
    ctx.fill();

    ctx.strokeStyle = skin;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-10, -2);
    ctx.lineTo(-16, 12 + sway);
    ctx.moveTo(10, -2);
    ctx.lineTo(16, 12 - sway);
    ctx.stroke();

    ctx.fillStyle = pants;
    ctx.fillRect(-10, 18, 8, this.child ? 18 : 22);
    ctx.fillRect(2, 18, 8, this.child ? 18 : 22);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(-12, 36, 10, 6);
    ctx.fillRect(2, 36, 10, 6);
    ctx.restore();
  }
}

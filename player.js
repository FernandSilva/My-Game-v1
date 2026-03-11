import { GRAVITY, FRICTION, clamp, rectsOverlap } from "./physics.js";

const WIDTH = 56;
const HEIGHT = 84;

export class Player {
  constructor(x, y) {
    this.spawn = { x, y };
    this.x = x;
    this.y = y;
    this.width = WIDTH;
    this.height = HEIGHT;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.canShoot = true;
    this.shootCooldown = 0;
    this.invulnerable = 0;
    this.anim = "idle";
    this.animTime = 0;
    this.justLanded = 0;
    this.jumpsRemaining = 2;
  }

  reset(position = this.spawn) {
    this.x = position.x;
    this.y = position.y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.invulnerable = 1.5;
    this.anim = "idle";
    this.animTime = 0;
    this.justLanded = 0;
    this.jumpsRemaining = 2;
  }

  get bounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  update(dt, input, level) {
    // Acceleration and damping are tuned for a bouncy arcade feel.
    const wasOnGround = this.onGround;
    this.animTime += dt;
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.justLanded = Math.max(0, this.justLanded - dt);

    const accel = this.onGround ? 1700 : 1100;
    const maxSpeed = input.run ? 430 : 340;

    if (input.left) {
      this.vx -= accel * dt;
      this.facing = -1;
    }
    if (input.right) {
      this.vx += accel * dt;
      this.facing = 1;
    }
    if (!input.left && !input.right) {
      this.vx *= this.onGround ? FRICTION : 0.97;
      if (Math.abs(this.vx) < 5) this.vx = 0;
    }

    this.vx = clamp(this.vx, -maxSpeed, maxSpeed);

    if (input.jumpPressed && this.jumpsRemaining > 0) {
      this.vy = -760;
      this.onGround = false;
      this.jumpsRemaining -= 1;
    }

    this.vy += GRAVITY * dt;
    this.vy = Math.min(this.vy, 1400);

    this.x += this.vx * dt;
    this.resolveX(level.platforms);
    this.x = clamp(this.x, 0, level.width - this.width);

    this.y += this.vy * dt;
    this.onGround = false;
    this.resolveY(level.platforms);

    if (!wasOnGround && this.onGround) {
      this.justLanded = 0.18;
    }

    this.updateAnimation();
  }

  resolveX(platforms) {
    for (const platform of platforms) {
      if (!rectsOverlap(this.bounds, platform)) continue;
      if (this.vx > 0) {
        this.x = platform.x - this.width;
      } else if (this.vx < 0) {
        this.x = platform.x + platform.width;
      }
      this.vx = 0;
    }
  }

  resolveY(platforms) {
    for (const platform of platforms) {
      if (!rectsOverlap(this.bounds, platform)) continue;
      if (this.vy > 0) {
        this.y = platform.y - this.height;
        this.vy = 0;
        this.onGround = true;
        this.jumpsRemaining = 2;
        if (platform.vx) {
          this.x += platform.vx / 60;
        }
      } else if (this.vy < 0) {
        this.y = platform.y + platform.height;
        this.vy = 0;
      }
    }
  }

  wantsToShoot(input) {
    return input.shootPressed && this.shootCooldown === 0;
  }

  onShoot() {
    this.shootCooldown = 0.35;
    this.anim = "shoot";
    this.animTime = 0;
  }

  updateAnimation() {
    if (this.anim === "shoot" && this.animTime < 0.16) return;
    if (!this.onGround) {
      this.anim = "jump";
    } else if (this.justLanded > 0) {
      this.anim = "land";
    } else if (Math.abs(this.vx) > 40) {
      this.anim = "run";
    } else {
      this.anim = "idle";
    }
  }

  draw(ctx, cameraX, time) {
    const x = this.x - cameraX;
    const y = this.y;
    const bounce = this.anim === "run" ? Math.sin(time * 18) * 3 : 0;
    const flash = this.invulnerable > 0 && Math.floor(time * 20) % 2 === 0;
    if (flash) return;

    ctx.save();
    ctx.translate(x + this.width / 2, y + this.height / 2 + bounce);
    ctx.scale(this.facing, 1);

    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.beginPath();
    ctx.ellipse(0, 52, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1d2b53";
    ctx.fillRect(-18, -4, 36, 34);
    ctx.fillStyle = "#2e4277";
    ctx.fillRect(-18, -4, 36, 8);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-10, -4, 20, 20);
    ctx.fillStyle = "#e7332f";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-7, 20);
    ctx.lineTo(7, 20);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#1d2b53";
    const legOffset = this.anim === "run" ? Math.sin(time * 18) * 5 : 0;
    ctx.fillRect(-15, 26, 10, 24 + Math.max(0, legOffset));
    ctx.fillRect(5, 26, 10, 24 + Math.max(0, -legOffset));
    ctx.fillStyle = "#111";
    ctx.fillRect(-18, 48, 16, 8);
    ctx.fillRect(2, 48, 16, 8);

    ctx.fillStyle = "#e89a55";
    ctx.beginPath();
    ctx.roundRect(-23, -38, 46, 44, 16);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.ellipse(-7, -24, 10, 14, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f4c318";
    ctx.beginPath();
    ctx.ellipse(-2, -42, 24, 16, 0, Math.PI, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-24, -34);
    ctx.quadraticCurveTo(2, -58, 18, -28);
    ctx.lineTo(0, -20);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.fillRect(-15, -22, 10, 8);
    ctx.fillRect(5, -22, 10, 8);
    ctx.fillStyle = "#222";
    ctx.fillRect(-11, -19, 4, 4);
    ctx.fillRect(9, -19, 4, 4);
    ctx.fillStyle = "#d96b42";
    ctx.fillRect(14, -12, 8, 5);
    ctx.fillStyle = "#d66d4d";
    ctx.fillRect(2, -6, 7, 4);

    const armSwing = this.anim === "run" ? Math.sin(time * 18) * 12 : this.anim === "shoot" ? -16 : 0;
    ctx.strokeStyle = "#1d2b53";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-20, 2);
    ctx.lineTo(-28, 14 + armSwing);
    ctx.moveTo(20, 2);
    ctx.lineTo(30, 16 - armSwing);
    ctx.stroke();

    ctx.restore();
  }
}

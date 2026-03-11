export const GRAVITY = 2200;
export const FRICTION = 0.84;
export const FIXED_DT = 1 / 60;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function circleRectOverlap(circle, rect) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

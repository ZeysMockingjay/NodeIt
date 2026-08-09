const ZOOM_MIN = Math.pow(2, -12);
const ZOOM_MAX = Math.pow(2, 12);
const FLOATING_ORIGIN_LIMIT = 1_000_000;

export class Camera2D {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.z = 1;
    this.worldOffsetX = 0;
    this.worldOffsetY = 0;
  }

  pan(deltaX, deltaY) {
    this.x += deltaX / this.z;
    this.y += deltaY / this.z;
    this.#rebaseIfNeeded();
  }

  zoomAt(screenX, screenY, zoomFactor, viewportWidth, viewportHeight) {
    const before = this.screenToWorld(screenX, screenY, viewportWidth, viewportHeight);
    this.z = clamp(this.z * zoomFactor, ZOOM_MIN, ZOOM_MAX);
    const after = this.screenToWorld(screenX, screenY, viewportWidth, viewportHeight);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.#rebaseIfNeeded();
  }

  worldToScreen(worldX, worldY, viewportWidth, viewportHeight) {
    const x = (worldX - this.worldOffsetX - this.x) * this.z + viewportWidth / 2;
    const y = (worldY - this.worldOffsetY - this.y) * this.z + viewportHeight / 2;
    return { x, y };
  }

  screenToWorld(screenX, screenY, viewportWidth, viewportHeight) {
    const x = (screenX - viewportWidth / 2) / this.z + this.x + this.worldOffsetX;
    const y = (screenY - viewportHeight / 2) / this.z + this.y + this.worldOffsetY;
    return { x, y };
  }

  #rebaseIfNeeded() {
    if (Math.abs(this.x) > FLOATING_ORIGIN_LIMIT || Math.abs(this.y) > FLOATING_ORIGIN_LIMIT) {
      this.worldOffsetX += this.x;
      this.worldOffsetY += this.y;
      this.x = 0;
      this.y = 0;
    }
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

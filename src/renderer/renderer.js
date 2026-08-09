import { Camera2D } from "../backend/camera2d.js";
import { createEmptyDocument } from "../backend/documentStore.js";
import { SpatialGridIndex } from "../backend/spatialIndex.js";

const closeBtn = document.getElementById("close-btn");
const aboutBtn = document.getElementById("about-btn");
const aboutDialog = document.getElementById("about-dialog");
const aboutCloseBtn = document.getElementById("about-close-btn");
const versionLabel = document.getElementById("version-label");
const canvas = document.getElementById("main-canvas");
const viewport = document.getElementById("viewport");

const camera = new Camera2D();
const doc = createEmptyDocument();
const index = new SpatialGridIndex();
const context = canvas.getContext("2d", { alpha: false });

let isPanning = false;
let lastX = 0;
let lastY = 0;

aboutBtn.addEventListener("click", async () => {
  const version = await window.desktopAPI.getVersion();
  versionLabel.textContent = `Version ${version}`;
  aboutDialog.showModal();
});

aboutCloseBtn.addEventListener("click", () => {
  aboutDialog.close();
});

closeBtn.addEventListener("click", () => {
  window.desktopAPI.closeWindow();
});

viewport.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) {
    return;
  }
  isPanning = true;
  lastX = event.clientX;
  lastY = event.clientY;
  viewport.setPointerCapture(event.pointerId);
});

viewport.addEventListener("pointermove", (event) => {
  if (!isPanning) {
    return;
  }
  const deltaX = event.clientX - lastX;
  const deltaY = event.clientY - lastY;
  lastX = event.clientX;
  lastY = event.clientY;
  camera.pan(-deltaX, -deltaY);
  syncCameraToDocument();
  render();
});

viewport.addEventListener("pointerup", () => {
  isPanning = false;
});

viewport.addEventListener("wheel", (event) => {
  event.preventDefault();
  const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
  camera.zoomAt(
    event.offsetX,
    event.offsetY,
    zoomFactor,
    viewport.clientWidth,
    viewport.clientHeight
  );
  syncCameraToDocument();
  render();
});

window.addEventListener("resize", () => {
  resizeCanvas();
  render();
});

seedDemoContent();
resizeCanvas();
render();

function syncCameraToDocument() {
  doc.camera = {
    x: camera.x,
    y: camera.y,
    z: camera.z,
    worldOffsetX: camera.worldOffsetX,
    worldOffsetY: camera.worldOffsetY
  };
}

function seedDemoContent() {
  const samples = [
    { id: "sample-node-1", x: -220, y: -120, w: 200, h: 110, color: "#7a5cff" },
    { id: "sample-node-2", x: 60, y: 45, w: 220, h: 120, color: "#4f8dff" },
    { id: "sample-node-3", x: -20, y: 260, w: 250, h: 110, color: "#f7d04a" }
  ];
  for (const item of samples) {
    doc.entities.push(item);
    index.upsert({
      id: item.id,
      bounds: { x: item.x, y: item.y, w: item.w, h: item.h },
      color: item.color
    });
  }
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function render() {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;

  context.fillStyle = "#262626";
  context.fillRect(0, 0, width, height);

  drawGrid(width, height);

  const viewportWorldTopLeft = camera.screenToWorld(0, 0, width, height);
  const viewportWorldBottomRight = camera.screenToWorld(width, height, width, height);
  const queryBounds = {
    x: Math.min(viewportWorldTopLeft.x, viewportWorldBottomRight.x),
    y: Math.min(viewportWorldTopLeft.y, viewportWorldBottomRight.y),
    w: Math.abs(viewportWorldBottomRight.x - viewportWorldTopLeft.x),
    h: Math.abs(viewportWorldBottomRight.y - viewportWorldTopLeft.y)
  };

  const visibleEntities = index.query(queryBounds);

  for (const entry of visibleEntities) {
    const topLeft = camera.worldToScreen(entry.bounds.x, entry.bounds.y, width, height);
    const scale = camera.z;
    context.fillStyle = entry.color;
    context.globalAlpha = 0.22;
    context.fillRect(topLeft.x, topLeft.y, entry.bounds.w * scale, entry.bounds.h * scale);
    context.globalAlpha = 0.95;
    context.strokeStyle = entry.color;
    context.lineWidth = 1;
    context.strokeRect(topLeft.x, topLeft.y, entry.bounds.w * scale, entry.bounds.h * scale);
  }

  context.globalAlpha = 1;
}

function drawGrid(width, height) {
  const worldGridSize = 120;
  const topLeftWorld = camera.screenToWorld(0, 0, width, height);
  const bottomRightWorld = camera.screenToWorld(width, height, width, height);

  const startX = Math.floor(topLeftWorld.x / worldGridSize) * worldGridSize;
  const endX = Math.ceil(bottomRightWorld.x / worldGridSize) * worldGridSize;
  const startY = Math.floor(topLeftWorld.y / worldGridSize) * worldGridSize;
  const endY = Math.ceil(bottomRightWorld.y / worldGridSize) * worldGridSize;

  context.strokeStyle = "#333333";
  context.lineWidth = 1;
  context.beginPath();

  for (let x = startX; x <= endX; x += worldGridSize) {
    const p0 = camera.worldToScreen(x, startY, width, height);
    const p1 = camera.worldToScreen(x, endY, width, height);
    context.moveTo(p0.x, p0.y);
    context.lineTo(p1.x, p1.y);
  }

  for (let y = startY; y <= endY; y += worldGridSize) {
    const p0 = camera.worldToScreen(startX, y, width, height);
    const p1 = camera.worldToScreen(endX, y, width, height);
    context.moveTo(p0.x, p0.y);
    context.lineTo(p1.x, p1.y);
  }

  context.stroke();
}

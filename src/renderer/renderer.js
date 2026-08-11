import { Camera2D } from "../backend/camera2d.js";
import { createEmptyDocument, migrateDocument } from "../backend/documentStore.js";
import { SpatialGridIndex } from "../backend/spatialIndex.js";
import { saveDocumentAs, openDocument, autosaveDocument } from "./saveLoad.js";

const closeBtn = document.getElementById("close-btn");
const aboutBtn = document.getElementById("about-btn");
const aboutDialog = document.getElementById("about-dialog");
const aboutCloseBtn = document.getElementById("about-close-btn");
const versionLabel = document.getElementById("version-label");
const deleteDialog = document.getElementById("delete-dialog");
const deleteCancelBtn = document.getElementById("delete-cancel-btn");
const deleteConfirmBtn = document.getElementById("delete-confirm-btn");
const canvas = document.getElementById("main-canvas");
const viewport = document.getElementById("viewport");
const contextMenu = document.getElementById("context-menu");
const menuCreateNode = document.getElementById("menu-create-node");
const menuAddImage = document.getElementById("menu-add-image");
const menuFrameAll = document.getElementById("menu-frame-all");
const menuOpen = document.getElementById("menu-open");
const menuSave = document.getElementById("menu-save");
const menuSaveAs = document.getElementById("menu-save-as");

const camera = new Camera2D();
const doc = createEmptyDocument();
const nodeIndex = new SpatialGridIndex();
const imageIndex = new SpatialGridIndex();
const imageCache = new Map();
const context = canvas.getContext("2d", { alpha: false });

let selectedEntity = null;
let pendingAnchor = null;
let hoverAnchor = null;
let draggingEntity = null;
let isPanning = false;
let lastPointerX = 0;
let lastPointerY = 0;
let renderQueued = false;
let deleteButtonRect = null;
let contextMenuWorld = { x: 0, y: 0 };

closeBtn.addEventListener("click", () => {
  window.desktopAPI.closeWindow();
});

aboutBtn.addEventListener("click", async () => {
  const version = await window.desktopAPI.getVersion();
  versionLabel.textContent = `Version ${version}`;
  aboutDialog.showModal();
});

aboutCloseBtn.addEventListener("click", () => {
  aboutDialog.close();
});

deleteCancelBtn.addEventListener("click", () => {
  deleteDialog.close();
});

deleteConfirmBtn.addEventListener("click", () => {
  deleteSelectedEntity();
  deleteDialog.close();
});

menuCreateNode.addEventListener("click", () => {
  createNodeAt(contextMenuWorld.x, contextMenuWorld.y);
  hideContextMenu();
});

menuAddImage.addEventListener("click", async () => {
  const entries = await window.desktopAPI.pickImages();
  if (entries.length > 0) {
    addPreparedImages(entries, contextMenuWorld.x, contextMenuWorld.y);
  }
  hideContextMenu();
});

menuFrameAll.addEventListener("click", () => {
  frameAllContent();
  hideContextMenu();
});

menuOpen.addEventListener("click", async () => {
  const res = await openDocument();
  if (res.ok) {
    const migrated = migrateDocument(res.doc);
    Object.assign(doc, migrated);
    reindexAll();
    requestRender();
  } else {
    console.warn("Open failed or cancelled", res);
  }
  hideContextMenu();
});

menuSave.addEventListener("click", async () => {
  const res = await saveDocumentAs(doc, "project.nodeit");
  if (!res.ok) {
    console.warn("Save failed", res.error);
  }
  hideContextMenu();
});

menuSaveAs.addEventListener("click", async () => {
  const res = await saveDocumentAs(doc, "project.nodeit");
  if (!res.ok) {
    console.warn("Save As failed", res.error);
  }
  hideContextMenu();
});

viewport.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  const point = toViewportPoint(event.clientX, event.clientY);
  contextMenuWorld = camera.screenToWorld(
    point.x,
    point.y,
    viewport.clientWidth,
    viewport.clientHeight
  );
  showContextMenu(event.clientX, event.clientY);
});

document.addEventListener("pointerdown", (event) => {
  if (!contextMenu.hidden && !contextMenu.contains(event.target)) {
    hideContextMenu();
  }
});

viewport.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) {
    return;
  }

  const local = toViewportPoint(event.clientX, event.clientY);
  const viewportWidth = viewport.clientWidth;
  const viewportHeight = viewport.clientHeight;
  const world = camera.screenToWorld(local.x, local.y, viewportWidth, viewportHeight);

  if (deleteButtonRect && pointInRect(local, deleteButtonRect)) {
    deleteDialog.showModal();
    return;
  }

  const anchorHit = hitTestAnchors(local.x, local.y, viewportWidth, viewportHeight);
  if (anchorHit) {
    if (pendingAnchor && !sameAnchor(pendingAnchor, anchorHit)) {
      createStrand(pendingAnchor, anchorHit);
      pendingAnchor = null;
    } else {
      pendingAnchor = anchorHit;
      selectEntity({ type: "node", id: anchorHit.nodeId });
    }
    requestRender();
    return;
  }

  const hit = hitTestEntity(world.x, world.y);
  if (hit) {
    selectEntity(hit);
    const entity = getEntity(hit);
    draggingEntity = {
      type: hit.type,
      id: hit.id,
      offsetX: world.x - entity.x,
      offsetY: world.y - entity.y
    };
    requestRender();
  } else {
    selectEntity(null);
    pendingAnchor = null;
    isPanning = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
  }

  viewport.setPointerCapture(event.pointerId);
});

viewport.addEventListener("pointermove", (event) => {
  const local = toViewportPoint(event.clientX, event.clientY);
  const viewportWidth = viewport.clientWidth;
  const viewportHeight = viewport.clientHeight;
  const world = camera.screenToWorld(local.x, local.y, viewportWidth, viewportHeight);

  const nextHoverAnchor = hitTestAnchors(local.x, local.y, viewportWidth, viewportHeight);
  if (!sameAnchor(hoverAnchor, nextHoverAnchor)) {
    hoverAnchor = nextHoverAnchor;
    requestRender();
  }

  if (draggingEntity) {
    const entity = getEntity(draggingEntity);
    entity.x = world.x - draggingEntity.offsetX;
    entity.y = world.y - draggingEntity.offsetY;
    updateEntityIndex(draggingEntity.type, entity);
    requestRender();
    return;
  }

  if (isPanning) {
    const deltaX = event.clientX - lastPointerX;
    const deltaY = event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    camera.pan(-deltaX, -deltaY);
    syncCameraToDocument();
    requestRender();
  }
});

viewport.addEventListener("pointerup", () => {
  draggingEntity = null;
  isPanning = false;
});

viewport.addEventListener("pointercancel", () => {
  draggingEntity = null;
  isPanning = false;
});

viewport.addEventListener("wheel", (event) => {
  event.preventDefault();
  const point = toViewportPoint(event.clientX, event.clientY);
  const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
  camera.zoomAt(point.x, point.y, zoomFactor, viewport.clientWidth, viewport.clientHeight);
  syncCameraToDocument();
  requestRender();
});

viewport.addEventListener("dragover", (event) => {
  event.preventDefault();
});

viewport.addEventListener("drop", async (event) => {
  event.preventDefault();
  const droppedPaths = [...event.dataTransfer.files]
    .map((file) => file.path)
    .filter((filePath) => isImagePath(filePath));

  if (droppedPaths.length === 0) {
    return;
  }

  const point = toViewportPoint(event.clientX, event.clientY);
  const world = camera.screenToWorld(point.x, point.y, viewport.clientWidth, viewport.clientHeight);
  const entries = await window.desktopAPI.prepareImages(droppedPaths);
  if (entries.length > 0) {
    addPreparedImages(entries, world.x, world.y);
  }
});

window.addEventListener("resize", () => {
  resizeCanvas();
  requestRender();
});

initializeTopBarIcons();
seedDemoContent();
reindexAll();
resizeCanvas();
requestRender();

/* Autosave every 10 seconds */
setInterval(async () => {
  try {
    await autosaveDocument(doc);
  } catch (e) {
    console.warn("Autosave failed", e);
  }
}, 10000);

async function initializeTopBarIcons() {
  const icons = await window.desktopAPI.getSystemIcons();
  applySystemIcon(closeBtn, icons.close);
  applySystemIcon(aboutBtn, icons.about);
}

function applySystemIcon(button, iconUrl) {
  if (!iconUrl) {
    return;
  }
  button.style.backgroundImage = `url("${iconUrl}")`;
  button.classList.add("has-system-icon");
}

function seedDemoContent() {
  const samples = [
    { id: createId("node"), x: -220, y: -120, w: 200, h: 110, color: "#7a5cff" },
    { id: createId("node"), x: 60, y: 45, w: 220, h: 120, color: "#4f8dff" },
    { id: createId("node"), x: -20, y: 260, w: 250, h: 110, color: "#f7d04a" }
  ];
  doc.nodes.push(...samples);
}

function reindexAll() {
  nodeIndex.cells.clear();
  nodeIndex.items.clear();
  imageIndex.cells.clear();
  imageIndex.items.clear();
  
  for (const node of doc.nodes) {
    updateEntityIndex("node", node);
  }
  for (const image of doc.images) {
    updateEntityIndex("image", image);
  }
}

function selectEntity(nextEntity) {
  selectedEntity = nextEntity;
  deleteButtonRect = null;
}

function getEntity(ref) {
  if (!ref) {
    return null;
  }
  if (ref.type === "node") {
    return doc.nodes.find((node) => node.id === ref.id) ?? null;
  }
  if (ref.type === "image") {
    return doc.images.find((image) => image.id === ref.id) ?? null;
  }
  return null;
}

function createNodeAt(worldX, worldY) {
  const node = {
    id: createId("node"),
    x: worldX - 110,
    y: worldY - 64,
    w: 220,
    h: 128,
    color: "#4f8dff"
  };
  doc.nodes.push(node);
  updateEntityIndex("node", node);
  selectEntity({ type: "node", id: node.id });
  requestRender();
}

function createStrand(fromAnchor, toAnchor) {
  if (fromAnchor.nodeId === toAnchor.nodeId) {
    return;
  }
  const alreadyExists = doc.strands.some((strand) => {
    return (
      (sameAnchor(strand.from, fromAnchor) && sameAnchor(strand.to, toAnchor)) ||
      (sameAnchor(strand.from, toAnchor) && sameAnchor(strand.to, fromAnchor))
    );
  });
  if (alreadyExists) {
    return;
  }
  doc.strands.push({
    id: createId("strand"),
    from: { nodeId: fromAnchor.nodeId, anchor: fromAnchor.anchor },
    to: { nodeId: toAnchor.nodeId, anchor: toAnchor.anchor }
  });
}

function deleteSelectedEntity() {
  if (!selectedEntity) {
    return;
  }

  if (selectedEntity.type === "node") {
    doc.nodes = doc.nodes.filter((node) => node.id !== selectedEntity.id);
    nodeIndex.remove(`node:${selectedEntity.id}`);
    doc.strands = doc.strands.filter(
      (strand) => strand.from.nodeId !== selectedEntity.id && strand.to.nodeId !== selectedEntity.id
    );
  }

  if (selectedEntity.type === "image") {
    doc.images = doc.images.filter((image) => image.id !== selectedEntity.id);
    imageIndex.remove(`image:${selectedEntity.id}`);
  }

  selectEntity(null);
  pendingAnchor = null;
  requestRender();
}

function addPreparedImages(entries, worldX, worldY) {
  let offset = 0;
  for (const entry of entries) {
    const maxDimension = 420;
    const sourceMax = Math.max(entry.width, entry.height);
    const scale = sourceMax > 0 ? Math.min(1, maxDimension / sourceMax) : 1;
    const width = Math.max(24, Math.round(entry.width * scale));
    const height = Math.max(24, Math.round(entry.height * scale));
    const image = {
      id: createId("image"),
      x: worldX + offset,
      y: worldY + offset,
      w: width,
      h: height,
      path: entry.path,
      url: entry.url,
      sourceWidth: entry.width,
      sourceHeight: entry.height,
      name: entry.name
    };
    doc.images.push(image);
    updateEntityIndex("image", image);
    offset += 26;
  }
  const latest = doc.images.at(-1);
  if (latest) {
    selectEntity({ type: "image", id: latest.id });
  }
  requestRender();
}

function frameAllContent() {
  const bounds = getDocumentBounds();
  if (!bounds) {
    return;
  }

  const padPx = 120;
  const viewW = Math.max(1, viewport.clientWidth - padPx * 2);
  const viewH = Math.max(1, viewport.clientHeight - padPx * 2);
  const zoomX = viewW / Math.max(1, bounds.w);
  const zoomY = viewH / Math.max(1, bounds.h);
  const nextZoom = clamp(Math.min(zoomX, zoomY), Math.pow(2, -12), Math.pow(2, 12));

  camera.worldOffsetX = 0;
  camera.worldOffsetY = 0;
  camera.x = bounds.x + bounds.w / 2;
  camera.y = bounds.y + bounds.h / 2;
  camera.z = nextZoom;
  syncCameraToDocument();
  requestRender();
}

function getDocumentBounds() {
  const all = [...doc.nodes, ...doc.images];
  if (all.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of all) {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.w);
    maxY = Math.max(maxY, item.y + item.h);
  }

  return {
    x: minX,
    y: minY,
    w: Math.max(1, maxX - minX),
    h: Math.max(1, maxY - minY)
  };
}

function updateEntityIndex(type, entity) {
  const index = type === "node" ? nodeIndex : imageIndex;
  index.upsert({
    id: `${type}:${entity.id}`,
    type,
    refId: entity.id,
    bounds: {
      x: entity.x,
      y: entity.y,
      w: entity.w,
      h: entity.h
    }
  });
}

function hitTestEntity(worldX, worldY) {
  const imageCandidates = imageIndex.query({ x: worldX, y: worldY, w: 1, h: 1 });
  for (const candidate of imageCandidates.reverse()) {
    const image = doc.images.find((item) => item.id === candidate.refId);
    if (image && pointInBounds(worldX, worldY, image)) {
      return { type: "image", id: image.id };
    }
  }

  const nodeCandidates = nodeIndex.query({ x: worldX, y: worldY, w: 1, h: 1 });
  for (const candidate of nodeCandidates.reverse()) {
    const node = doc.nodes.find((item) => item.id === candidate.refId);
    if (node && pointInBounds(worldX, worldY, node)) {
      return { type: "node", id: node.id };
    }
  }

  return null;
}

function hitTestAnchors(screenX, screenY, viewportWidth, viewportHeight) {
  const nodesToCheck = selectedEntity?.type === "node" ? [getEntity(selectedEntity)] : doc.nodes;
  for (const node of nodesToCheck) {
    if (!node) {
      continue;
    }
    const anchors = getNodeAnchors(node);
    for (const anchor of anchors) {
      const p = camera.worldToScreen(anchor.x, anchor.y, viewportWidth, viewportHeight);
      const distance = Math.hypot(p.x - screenX, p.y - screenY);
      if (distance <= 8) {
        return {
          nodeId: node.id,
          anchor: anchor.anchor
        };
      }
    }
  }
  return null;
}

function getNodeAnchors(node) {
  return [
    { anchor: "top", x: node.x + node.w / 2, y: node.y },
    { anchor: "right", x: node.x + node.w, y: node.y + node.h / 2 },
    { anchor: "bottom", x: node.x + node.w / 2, y: node.y + node.h },
    { anchor: "left", x: node.x, y: node.y + node.h / 2 }
  ];
}

function requestRender() {
  if (renderQueued) {
    return;
  }
  renderQueued = true;
  requestAnimationFrame((timestamp) => {
    renderQueued = false;
    render(timestamp);
    if (doc.strands.length > 0) {
      requestRender();
    }
  });
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

function render(timestamp) {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  deleteButtonRect = null;

  context.fillStyle = "#262626";
  context.fillRect(0, 0, width, height);

  drawAdaptiveGrid(width, height);
  drawVisibleImages(width, height);
  drawStrands(width, height, timestamp);
  drawVisibleNodes(width, height);
}

function drawAdaptiveGrid(width, height) {
  const targetSpacingPx = 90;
  const baseWorldStep = 120;
  const rawWorldStep = targetSpacingPx / camera.z;
  const level = Math.floor(Math.log2(Math.max(rawWorldStep / baseWorldStep, 1e-6)));
  const lowerStep = baseWorldStep * Math.pow(2, level);
  const upperStep = lowerStep * 2;
  const blend = clamp(Math.log2(rawWorldStep / lowerStep), 0, 1);

  drawGridLayer(width, height, lowerStep, (1 - blend) * 0.2);
  drawGridLayer(width, height, upperStep, blend * 0.24);
}

function drawGridLayer(width, height, worldStep, alpha) {
  if (alpha <= 0.001) {
    return;
  }

  const topLeftWorld = camera.screenToWorld(0, 0, width, height);
  const bottomRightWorld = camera.screenToWorld(width, height, width, height);

  const startX = Math.floor(topLeftWorld.x / worldStep) * worldStep;
  const endX = Math.ceil(bottomRightWorld.x / worldStep) * worldStep;
  const startY = Math.floor(topLeftWorld.y / worldStep) * worldStep;
  const endY = Math.ceil(bottomRightWorld.y / worldStep) * worldStep;

  context.strokeStyle = `rgba(255,255,255,${alpha.toFixed(4)})`;
  context.lineWidth = 1;
  context.beginPath();

  for (let x = startX; x <= endX; x += worldStep) {
    const p0 = camera.worldToScreen(x, startY, width, height);
    const p1 = camera.worldToScreen(x, endY, width, height);
    context.moveTo(p0.x, p0.y);
    context.lineTo(p1.x, p1.y);
  }

  for (let y = startY; y <= endY; y += worldStep) {
    const p0 = camera.worldToScreen(startX, y, width, height);
    const p1 = camera.worldToScreen(endX, y, width, height);
    context.moveTo(p0.x, p0.y);
    context.lineTo(p1.x, p1.y);
  }

  context.stroke();
}

function drawVisibleImages(width, height) {
  const queryBounds = getViewportWorldBounds(width, height);
  const visible = imageIndex.query(queryBounds);
  for (const entry of visible) {
    const image = doc.images.find((item) => item.id === entry.refId);
    if (!image) {
      continue;
    }
    const topLeft = camera.worldToScreen(image.x, image.y, width, height);
    const drawW = image.w * camera.z;
    const drawH = image.h * camera.z;

    const img = getCachedImage(image.url);
    roundedRectPath(context, topLeft.x, topLeft.y, drawW, drawH, 10);
    context.save();
    context.clip();
    if (img.complete) {
      context.drawImage(img, topLeft.x, topLeft.y, drawW, drawH);
    } else {
      context.fillStyle = "#333";
      context.fillRect(topLeft.x, topLeft.y, drawW, drawH);
    }
    context.restore();

    context.strokeStyle = "#4d4d4d";
    context.lineWidth = 1;
    roundedRectPath(context, topLeft.x, topLeft.y, drawW, drawH, 10);
    context.stroke();

    if (selectedEntity?.type === "image" && selectedEntity.id === image.id) {
      context.strokeStyle = "#7a5cff";
      context.lineWidth = 1.2;
      roundedRectPath(context, topLeft.x - 1, topLeft.y - 1, drawW + 2, drawH + 2, 11);
      context.stroke();
      drawDeleteButton(topLeft.x + drawW - 18, topLeft.y + 2);
    }
  }
}

function drawVisibleNodes(width, height) {
  const queryBounds = getViewportWorldBounds(width, height);
  const visible = nodeIndex.query(queryBounds);

  for (const entry of visible) {
    const node = doc.nodes.find((item) => item.id === entry.refId);
    if (!node) {
      continue;
    }
    const topLeft = camera.worldToScreen(node.x, node.y, width, height);
    const drawW = node.w * camera.z;
    const drawH = node.h * camera.z;

    context.fillStyle = "rgba(59,68,105,0.45)";
    roundedRectPath(context, topLeft.x, topLeft.y, drawW, drawH, 14);
    context.fill();

    context.strokeStyle = node.color;
    context.lineWidth = 1.2;
    roundedRectPath(context, topLeft.x, topLeft.y, drawW, drawH, 14);
    context.stroke();

    if (selectedEntity?.type === "node" && selectedEntity.id === node.id) {
      context.strokeStyle = "#f2f2f2";
      context.lineWidth = 1.1;
      roundedRectPath(context, topLeft.x - 1, topLeft.y - 1, drawW + 2, drawH + 2, 15);
      context.stroke();
      drawNodeAnchors(node, width, height);
      drawDeleteButton(topLeft.x + drawW - 18, topLeft.y + 2);
    }
  }
}

function drawNodeAnchors(node, width, height) {
  for (const anchor of getNodeAnchors(node)) {
    const p = camera.worldToScreen(anchor.x, anchor.y, width, height);
    const isPending = pendingAnchor && sameAnchor(pendingAnchor, { nodeId: node.id, anchor: anchor.anchor });
    const isHover =
      hoverAnchor && hoverAnchor.nodeId === node.id && hoverAnchor.anchor === anchor.anchor;
    context.beginPath();
    context.arc(p.x, p.y, isPending || isHover ? 4.8 : 3.8, 0, Math.PI * 2);
    context.fillStyle = isPending ? "#f7d04a" : isHover ? "#8eb2ff" : "#8f8f8f";
    context.fill();
  }
}

function drawStrands(width, height, timestamp) {
  const time = timestamp ?? 0;

  for (const [index, strand] of doc.strands.entries()) {
    const from = resolveAnchorWorldPoint(strand.from);
    const to = resolveAnchorWorldPoint(strand.to);
    if (!from || !to) {
      continue;
    }

    const p0 = camera.worldToScreen(from.x, from.y, width, height);
    const p1 = camera.worldToScreen(to.x, to.y, width, height);
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const length = Math.hypot(dx, dy);
    if (length < 2) {
      continue;
    }

    context.strokeStyle = "rgba(183, 193, 238, 0.26)";
    context.lineWidth = 1.5;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(p0.x, p0.y);
    context.lineTo(p1.x, p1.y);
    context.stroke();

    const segmentLength = Math.max(24, Math.min(80, length * 0.24));
    const phase = ((time * 0.00025 + index * 0.17) % 1 + 1) % 1;
    const startDistance = phase * (length + segmentLength) - segmentLength;
    const endDistance = startDistance + segmentLength;
    const t0 = clamp(startDistance / length, 0, 1);
    const t1 = clamp(endDistance / length, 0, 1);

    if (t1 > t0) {
      const a = lerpPoint(p0, p1, t0);
      const b = lerpPoint(p0, p1, t1);
      context.strokeStyle = "rgba(228, 233, 255, 0.33)";
      context.lineWidth = 2.2;
      context.shadowBlur = 5;
      context.shadowColor = "rgba(190, 206, 255, 0.18)";
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
      context.shadowBlur = 0;
      context.shadowColor = "transparent";
    }
  }
}

function resolveAnchorWorldPoint(anchorRef) {
  const node = doc.nodes.find((item) => item.id === anchorRef.nodeId);
  if (!node) {
    return null;
  }
  const anchor = getNodeAnchors(node).find((item) => item.anchor === anchorRef.anchor);
  return anchor ? { x: anchor.x, y: anchor.y } : null;
}

function drawDeleteButton(screenX, screenY) {
  const size = 16;
  deleteButtonRect = { x: screenX, y: screenY, w: size, h: size };
  context.beginPath();
  context.arc(screenX + size / 2, screenY + size / 2, size / 2, 0, Math.PI * 2);
  context.fillStyle = "#8d3030";
  context.fill();
  context.strokeStyle = "#f0f0f0";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(screenX + 5, screenY + 5);
  context.lineTo(screenX + size - 5, screenY + size - 5);
  context.moveTo(screenX + size - 5, screenY + 5);
  context.lineTo(screenX + 5, screenY + size - 5);
  context.stroke();
}

function showContextMenu(clientX, clientY) {
  contextMenu.hidden = false;
  const maxX = window.innerWidth - contextMenu.offsetWidth - 10;
  const maxY = window.innerHeight - contextMenu.offsetHeight - 10;
  contextMenu.style.left = `${Math.min(clientX, maxX)}px`;
  contextMenu.style.top = `${Math.min(clientY, maxY)}px`;
}

function hideContextMenu() {
  contextMenu.hidden = true;
}

function toViewportPoint(clientX, clientY) {
  const rect = viewport.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function getViewportWorldBounds(width, height) {
  const topLeft = camera.screenToWorld(0, 0, width, height);
  const bottomRight = camera.screenToWorld(width, height, width, height);
  return {
    x: Math.min(topLeft.x, bottomRight.x),
    y: Math.min(topLeft.y, bottomRight.y),
    w: Math.abs(bottomRight.x - topLeft.x),
    h: Math.abs(bottomRight.y - topLeft.y)
  };
}

function roundedRectPath(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function pointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x <= rect.x + rect.w &&
    point.y <= rect.y + rect.h
  );
}

function pointInBounds(x, y, bounds) {
  return x >= bounds.x && y >= bounds.y && x <= bounds.x + bounds.w && y <= bounds.y + bounds.h;
}

function sameAnchor(a, b) {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return a.nodeId === b.nodeId && a.anchor === b.anchor;
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function getCachedImage(url) {
  if (imageCache.has(url)) {
    return imageCache.get(url);
  }
  const img = new Image();
  img.src = url;
  img.addEventListener("load", () => requestRender());
  imageCache.set(url, img);
  return img;
}

function isImagePath(filePath) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(filePath);
}

function lerpPoint(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function syncCameraToDocument() {
  doc.camera = {
    x: camera.x,
    y: camera.y,
    z: camera.z,
    worldOffsetX: camera.worldOffsetX,
    worldOffsetY: camera.worldOffsetY
  };
}

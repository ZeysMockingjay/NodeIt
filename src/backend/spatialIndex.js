export class SpatialGridIndex {
  constructor(cellSize = 2048) {
    this.cellSize = cellSize;
    this.cells = new Map();
    this.items = new Map();
  }

  upsert(item) {
    if (!item?.id || !item?.bounds) {
      throw new Error("Item must include id and bounds");
    }

    this.remove(item.id);
    const keys = this.#cellKeysForBounds(item.bounds);
    this.items.set(item.id, { item, keys });
    for (const key of keys) {
      if (!this.cells.has(key)) {
        this.cells.set(key, new Set());
      }
      this.cells.get(key).add(item.id);
    }
  }

  remove(id) {
    const existing = this.items.get(id);
    if (!existing) {
      return;
    }
    for (const key of existing.keys) {
      const bucket = this.cells.get(key);
      if (!bucket) {
        continue;
      }
      bucket.delete(id);
      if (bucket.size === 0) {
        this.cells.delete(key);
      }
    }
    this.items.delete(id);
  }

  query(bounds) {
    const results = new Set();
    for (const key of this.#cellKeysForBounds(bounds)) {
      const bucket = this.cells.get(key);
      if (!bucket) {
        continue;
      }
      for (const id of bucket) {
        const entry = this.items.get(id)?.item;
        if (entry && intersects(entry.bounds, bounds)) {
          results.add(entry);
        }
      }
    }
    return [...results];
  }

  #cellKeysForBounds(bounds) {
    const xMin = Math.floor(bounds.x / this.cellSize);
    const yMin = Math.floor(bounds.y / this.cellSize);
    const xMax = Math.floor((bounds.x + bounds.w) / this.cellSize);
    const yMax = Math.floor((bounds.y + bounds.h) / this.cellSize);
    const keys = [];
    for (let y = yMin; y <= yMax; y += 1) {
      for (let x = xMin; x <= xMax; x += 1) {
        keys.push(`${x},${y}`);
      }
    }
    return keys;
  }
}

function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

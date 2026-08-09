const CURRENT_SCHEMA_VERSION = 1;

export function createEmptyDocument() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: "V1",
    camera: { x: 0, y: 0, z: 1, worldOffsetX: 0, worldOffsetY: 0 },
    entities: [],
    assets: []
  };
}

export function migrateDocument(doc) {
  if (!doc || typeof doc !== "object") {
    throw new Error("Invalid document data");
  }

  let working = doc;
  while ((working.schemaVersion ?? 0) < CURRENT_SCHEMA_VERSION) {
    const version = working.schemaVersion ?? 0;
    if (version === 0) {
      working = {
        ...working,
        schemaVersion: 1,
        entities: Array.isArray(working.entities) ? working.entities : [],
        assets: Array.isArray(working.assets) ? working.assets : []
      };
      continue;
    }
    throw new Error(`No migration path from schema version ${version}`);
  }
  return working;
}

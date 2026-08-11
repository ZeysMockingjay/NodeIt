/* saveLoad.js - simple JSON-based persistence for NodeIt */
export async function saveDocumentAs(doc, suggestedName = "untitled.nodeit") {
  const filePath = await window.fileAPI.showSaveDialog(suggestedName);
  if (!filePath) return { ok: false, reason: "cancelled" };
  const json = JSON.stringify(doc, null, 2);
  return window.fileAPI.saveFile(filePath, json);
}

export async function openDocument() {
  const res = await window.fileAPI.showOpenDialog();
  if (!res) return { ok: false, reason: "cancelled" };
  if (!res.ok) return res;
  try {
    const parsed = JSON.parse(res.content);
    return { ok: true, doc: parsed, filePath: res.filePath };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function autosaveDocument(doc) {
  const autosavePath = await window.fileAPI.getAutosavePath("nodeit-autosave.nodeit");
  if (!autosavePath) return { ok: false, reason: "no-path" };
  const json = JSON.stringify(doc);
  return window.fileAPI.saveFile(autosavePath, json);
}

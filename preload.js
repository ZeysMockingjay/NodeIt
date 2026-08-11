const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  closeWindow: () => ipcRenderer.send("app:close-window"),
  getVersion: () => ipcRenderer.invoke("app:get-version"),
  getSystemIcons: () => ipcRenderer.invoke("app:get-system-icons"),
  pickImages: () => ipcRenderer.invoke("images:pick"),
  prepareImages: (filePaths) => ipcRenderer.invoke("images:prepare", filePaths)
});

contextBridge.exposeInMainWorld("fileAPI", {
  showSaveDialog: (suggestedName) => ipcRenderer.invoke("file:show-save-dialog", suggestedName),
  saveFile: (filePath, jsonString) => ipcRenderer.invoke("file:save", filePath, jsonString),
  showOpenDialog: () => ipcRenderer.invoke("file:show-open-dialog"),
  getAutosavePath: (baseName) => ipcRenderer.invoke("file:autosave-path", baseName)
});

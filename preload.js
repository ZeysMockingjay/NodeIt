const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  closeWindow: () => ipcRenderer.send("app:close-window"),
  getVersion: () => ipcRenderer.invoke("app:get-version"),
  getSystemIcons: () => ipcRenderer.invoke("app:get-system-icons"),
  pickImages: () => ipcRenderer.invoke("images:pick"),
  prepareImages: (filePaths) => ipcRenderer.invoke("images:prepare", filePaths)
});

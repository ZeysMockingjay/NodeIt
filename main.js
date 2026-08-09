const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 640,
    minHeight: 360,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#2b2b2b",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, "src/renderer/index.html"));
}

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.on("app:close-window", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.close();
  }
});

ipcMain.handle("app:get-version", () => "V1");

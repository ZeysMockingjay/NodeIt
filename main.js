const { app, BrowserWindow, dialog, ipcMain, nativeImage } = require("electron");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

if (process.platform === "linux" && process.env.APPIMAGE) {
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-setuid-sandbox");
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 640,
    minHeight: 360,
    frame: false,
    titleBarStyle: "hidden",
    transparent: true,
    backgroundColor: "#00000000",
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
ipcMain.handle("app:get-system-icons", () => ({
  close: resolveSystemIcon([
    "/usr/share/icons/Yaru/scalable/actions/window-close-symbolic.svg",
    "/usr/share/icons/Yaru/scalable/actions/window-close.svg",
    "/usr/share/icons/Adwaita/scalable/actions/window-close-symbolic.svg",
    "/usr/share/icons/hicolor/scalable/actions/window-close-symbolic.svg"
  ]),
  about: resolveSystemIcon([
    "/usr/share/icons/Yaru/scalable/actions/help-about-symbolic.svg",
    "/usr/share/icons/Yaru/scalable/actions/dialog-information-symbolic.svg",
    "/usr/share/icons/Adwaita/scalable/actions/help-about-symbolic.svg",
    "/usr/share/icons/Adwaita/scalable/status/dialog-information-symbolic.svg",
    "/usr/share/icons/hicolor/scalable/actions/help-about-symbolic.svg"
  ])
}));
ipcMain.handle("images:pick", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"]
      }
    ]
  });
  if (result.canceled) {
    return [];
  }
  return prepareImageEntries(result.filePaths);
});
ipcMain.handle("images:prepare", (_event, filePaths) => prepareImageEntries(filePaths));

function resolveSystemIcon(candidates) {
  for (const iconPath of candidates) {
    if (fs.existsSync(iconPath)) {
      return pathToFileURL(iconPath).href;
    }
  }
  return null;
}

function prepareImageEntries(filePaths) {
  if (!Array.isArray(filePaths)) {
    return [];
  }

  const entries = [];
  for (const filePath of filePaths) {
    if (!filePath || !fs.existsSync(filePath)) {
      continue;
    }
    const image = nativeImage.createFromPath(filePath);
    if (image.isEmpty()) {
      continue;
    }
    const { width, height } = image.getSize();
    if (!width || !height) {
      continue;
    }
    entries.push({
      path: filePath,
      url: pathToFileURL(filePath).href,
      width,
      height,
      name: path.basename(filePath)
    });
  }
  return entries;
}

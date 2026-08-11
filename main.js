const { app, BrowserWindow, dialog, ipcMain, nativeImage } = require("electron");
const fs = require("fs");
const { promises: fsPromises } = require("fs");
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

/* FILE I/O handlers: Save/Open for .nodeit JSON documents */
const userDataDir = app.getPath("userData");

ipcMain.handle("file:show-save-dialog", async (_evt, suggestedName = "untitled.nodeit") => {
  const result = await dialog.showSaveDialog({
    title: "Save NodeIt Document",
    defaultPath: path.join(userDataDir, suggestedName),
    filters: [{ name: "NodeIt Documents", extensions: ["nodeit", "json"] }]
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle("file:save", async (_evt, filePath, jsonString) => {
  try {
    await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
    await fsPromises.writeFile(filePath, jsonString, "utf8");
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle("file:show-open-dialog", async () => {
  const result = await dialog.showOpenDialog({
    title: "Open NodeIt Document",
    properties: ["openFile"],
    filters: [{ name: "NodeIt Documents", extensions: ["nodeit", "json"] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  try {
    const content = await fsPromises.readFile(result.filePaths[0], "utf8");
    return { ok: true, filePath: result.filePaths[0], content };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle("file:autosave-path", async (_evt, baseName = "autosave.nodeit") => {
  const autosaveFolder = path.join(userDataDir, "autosaves");
  await fsPromises.mkdir(autosaveFolder, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(autosaveFolder, `${ts}-${baseName}`);
});

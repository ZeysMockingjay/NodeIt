#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const binaryPath = path.join(repoRoot, "dist", "linux-unpacked", "nodeit");
const iconPath = path.join(repoRoot, "assets", "nodeit-icon.svg");
const desktopDir = path.join(os.homedir(), "Desktop");
const applicationsDir = path.join(os.homedir(), ".local", "share", "applications");
const desktopEntry = `[Desktop Entry]
Version=1.0
Type=Application
Name=NodeIt
Comment=Node-based visual workspace
Exec=${binaryPath} --no-sandbox
Icon=${iconPath}
Terminal=false
Categories=Graphics;
StartupWMClass=NodeIt
`;

if (!fs.existsSync(binaryPath)) {
  console.error("Built executable not found.");
  console.error("Run `npm run pack:linux` first, then run this command again.");
  process.exit(1);
}

if (!fs.existsSync(iconPath)) {
  console.error(`Icon file missing: ${iconPath}`);
  process.exit(1);
}

fs.mkdirSync(applicationsDir, { recursive: true });
const appEntryPath = path.join(applicationsDir, "nodeit.desktop");
fs.writeFileSync(appEntryPath, desktopEntry, "utf8");
fs.chmodSync(appEntryPath, 0o755);

if (fs.existsSync(desktopDir)) {
  const desktopShortcutPath = path.join(desktopDir, "NodeIt.desktop");
  fs.writeFileSync(desktopShortcutPath, desktopEntry, "utf8");
  fs.chmodSync(desktopShortcutPath, 0o755);
  console.log(`Desktop shortcut created: ${desktopShortcutPath}`);
}

console.log(`Application launcher created: ${appEntryPath}`);

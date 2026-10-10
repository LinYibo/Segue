import { join } from "node:path";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { aiSettingsView, resolveAiConfig } from "../src/shared/providers.mjs";
import { streamProviderChat } from "../src/shared/chat.mjs";
import { loadDotEnv } from "./env.mjs";
import { addProvider, readSettings, removeProvider, selectProvider, settingsPath } from "./settings.mjs";

loadDotEnv();

const DEV_URL = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
// dev.mjs sets SEGUE_DEV=1; `npm run app` runs unpackaged but loads the build.
const isDev = process.env.SEGUE_DEV === "1";

// At most one chat request in flight; a new one supersedes the previous.
let activeChat = null;

const settingsFile = () => settingsPath(app.getPath("userData"));

// What the renderer may see about the AI setup — never a key itself. The
// view/resolve logic lives in src/shared (shared with the web demo); the
// main process only contributes where the settings file and env keys live.
function settingsView() {
  return aiSettingsView(readSettings(settingsFile()), process.env);
}

function registerIpc() {
  ipcMain.handle("settings:get", () => settingsView());

  ipcMain.handle("settings:add", (_event, patch) => {
    addProvider(settingsFile(), patch);
    return settingsView();
  });

  ipcMain.handle("settings:select", (_event, id) => {
    selectProvider(settingsFile(), String(id));
    return settingsView();
  });

  ipcMain.handle("settings:remove", (_event, id) => {
    removeProvider(settingsFile(), String(id));
    return settingsView();
  });

  // SumatraPDF opens external links in the system browser, never in-app.
  ipcMain.handle("shell:openExternal", (_event, url) => {
    const target = String(url);
    if (/^(https?:|mailto:)/i.test(target)) void shell.openExternal(target);
  });

  ipcMain.on("ai:chat:abort", () => activeChat?.abort());

  // Streaming is the shared src/shared pipeline; the main process
  // contributes the single-flight controller and the settings/env key store.
  ipcMain.handle("ai:chat", async (event, body) => {
    const sender = event.sender;
    const send = (ev) => {
      if (!sender.isDestroyed()) sender.send("ai:chat:event", ev);
    };

    activeChat?.abort();
    activeChat = new AbortController();
    const ac = activeChat;
    try {
      return await streamProviderChat({
        cfg: resolveAiConfig(readSettings(settingsFile()), process.env),
        body,
        signal: ac.signal,
        send,
      });
    } finally {
      if (activeChat === ac) activeChat = null;
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 980,
    minHeight: 640,
    title: "Segue",
    icon: join(import.meta.dirname, "icon.ico"),
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    // Text-only title bar: the OS icon can't be removed from a standard
    // frame, so the renderer draws its own drag strip and Windows paints
    // only the min/max/close overlay.
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#ffffff",
      symbolColor: "#1c1b18",
      // 1px short of the renderer's 36px header: the overlay paints an opaque
      // caption rect over the page, and at full height it would cover the
      // header's bottom border under the min/max/close buttons.
      height: 35,
    },
    webPreferences: {
      preload: join(import.meta.dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // Renderer console → terminal, so a broken production load is diagnosable.
  win.webContents.on("console-message", (_event, _level, message, line, sourceId) => {
    console.log(`[renderer] ${message} (${sourceId}:${line})`);
  });
  // Any stray target=_blank ends up in the browser too, not a new window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:|mailto:)/i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  // The renderer handles file drops on the shell root and inside the book
  // iframes; any navigation still reaching here is a stray drop, and
  // Chromium's default would replace the app with the dropped file.
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.webContents.on("will-frame-navigate", (event) => event.preventDefault());
  if (isDev) {
    void win.loadURL(DEV_URL);
  } else {
    void win.loadFile(join(import.meta.dirname, "..", "dist", "index.html"));
  }
  return win;
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  console.log(
    `[segue-desktop] window ready (${isDev ? "dev: " + DEV_URL : "dist/index.html via loadFile"})`,
  );
});

app.on("window-all-closed", () => {
  app.quit();
});

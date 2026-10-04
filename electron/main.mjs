import { join } from "node:path";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { buildChatContext } from "./ai-context.mjs";
import { loadDotEnv } from "./env.mjs";
import { adapterFor, activeEntry, PROVIDER_PRESETS, resolveAiConfig, resolveEntry } from "./providers.mjs";
import { addProvider, readSettings, removeProvider, selectProvider, settingsPath } from "./settings.mjs";

loadDotEnv();

const DEV_URL = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
// dev.mjs sets SEGUE_DEV=1; `npm run app` runs unpackaged but loads the build.
const isDev = process.env.SEGUE_DEV === "1";

// At most one chat request in flight; a new one supersedes the previous.
let activeChat = null;

const settingsFile = () => settingsPath(app.getPath("userData"));

// What the renderer may see about the AI setup — never a key itself.
function aiSettingsView() {
  const saved = readSettings(settingsFile());
  return {
    activeId: activeEntry(saved)?.id ?? null,
    providers: (saved?.providers ?? []).map((entry) => {
      const cfg = resolveEntry(entry);
      return {
        id: cfg.id,
        provider: cfg.providerId,
        label: cfg.label,
        baseUrl: cfg.baseUrl,
        model: cfg.model,
        hasKey: Boolean(cfg.apiKey),
        keyFromEnv: cfg.keyFromEnv,
      };
    }),
    presets: PROVIDER_PRESETS.map((p) => ({
      ...p,
      envKeySet: Boolean(p.envKey && process.env[p.envKey]),
    })),
  };
}

function registerIpc() {
  ipcMain.handle("settings:get", () => aiSettingsView());

  ipcMain.handle("settings:add", (_event, patch) => {
    addProvider(settingsFile(), patch);
    return aiSettingsView();
  });

  ipcMain.handle("settings:select", (_event, id) => {
    selectProvider(settingsFile(), String(id));
    return aiSettingsView();
  });

  ipcMain.handle("settings:remove", (_event, id) => {
    removeProvider(settingsFile(), String(id));
    return aiSettingsView();
  });

  // SumatraPDF opens external links in the system browser, never in-app.
  ipcMain.handle("shell:openExternal", (_event, url) => {
    const target = String(url);
    if (/^(https?:|mailto:)/i.test(target)) void shell.openExternal(target);
  });

  ipcMain.on("ai:chat:abort", () => activeChat?.abort());

  ipcMain.handle("ai:chat", async (event, body) => {
    const sender = event.sender;
    const send = (ev) => {
      if (!sender.isDestroyed()) sender.send("ai:chat:event", ev);
    };

    activeChat?.abort();
    activeChat = new AbortController();
    const ac = activeChat;

    const cfg = resolveAiConfig(readSettings(settingsFile()));
    if (!cfg || !cfg.apiKey || !cfg.baseUrl || !cfg.model) {
      send({ type: "error", error: "AI is not configured — add a provider from the model menu." });
      send({ type: "done" });
      return { ok: false };
    }

    const ctx = buildChatContext(body);
    if ("error" in ctx) {
      send({ type: "error", error: ctx.error.message });
      send({ type: "done" });
      return { ok: false };
    }

    try {
      const adapter = adapterFor(cfg.protocol);
      const req = adapter.buildRequest(cfg, ctx);
      const res = await fetch(req.url, {
        method: "POST",
        headers: req.headers,
        body: JSON.stringify(req.body),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        send({
          type: "error",
          error: `${cfg.label} API error ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`,
        });
        send({ type: "done" });
        return { ok: false };
      }
      for await (const ev of adapter.parseStream(res.body)) send(ev);
      return { ok: true };
    } catch (err) {
      if (!ac.signal.aborted) {
        send({
          type: "error",
          error: err instanceof Error ? err.message : "request failed",
        });
        send({ type: "done" });
      }
      return { ok: false };
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

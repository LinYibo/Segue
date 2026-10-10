/**
 * Dev orchestrator: start Vite, then launch the Electron window against it.
 * Fails fast if :5173 is already in use — the window would otherwise silently
 * load whatever else is running there. Closing the Electron window ends the
 * session.
 */
import { spawn, execSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import electronPath from "electron";

// Resolve the Vite CLI from the dependency chain. The bin is not in vite's
// exports map; go through the package directory.
const viteBin = join(
  dirname(createRequire(import.meta.url).resolve("vite/package.json")),
  "bin",
  "vite.js",
);

const DEV_URL = "http://localhost:5173/";

async function serving() {
  try {
    const res = await fetch(DEV_URL);
    return res.status < 500;
  } catch {
    return false;
  }
}

function kill(proc) {
  if (!proc || proc.exitCode !== null || proc.signalCode) return;
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: "ignore" });
    } catch {
      /* already gone */
    }
  } else {
    proc.kill("SIGTERM");
  }
}

let vite = null;
let electronProc = null;
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  kill(electronProc);
  kill(vite);
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

if (await serving()) {
  console.error(`[dev] ${DEV_URL} is already in use — close the other dev session first.`);
  process.exit(1);
}

vite = spawn(process.execPath, [viteBin], {
  stdio: "inherit",
});
const deadline = Date.now() + 30_000;
while (!(await serving())) {
  if (Date.now() > deadline) {
    console.error("[dev] vite did not become ready in 30s");
    shutdown(1);
  }
  if (vite.exitCode !== null || vite.signalCode) {
    console.error("[dev] vite exited during startup");
    shutdown(1);
  }
  await new Promise((r) => setTimeout(r, 250));
}
console.log("[dev] vite ready at " + DEV_URL);

electronProc = spawn(electronPath, ["."], {
  stdio: "inherit",
  env: { ...process.env, SEGUE_DEV: "1" },
});
electronProc.on("exit", (code) => {
  console.log("[dev] electron exited, shutting down");
  shutdown(code ?? 0);
});
vite.on("exit", (code) => {
  if (!shuttingDown) {
    console.log("[dev] vite exited, shutting down");
    shutdown(code ?? 0);
  }
});

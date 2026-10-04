// Generates the app icon set from the book mark (formerly the header logo):
//   public/favicon.svg            hand-matching vector (kept in repo)
//   public/favicon-{16,32,48,64}  rounded-tile PNGs
//   electron/icon.ico             multi-size ICO (Electron window icon)
// Run: npx electron scripts/make-icons.mjs
import { app, BrowserWindow } from "electron";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const BG = "#151513";
const EDGE = "#2c2a26";
const MARK = "#ffffff";

function mark(s) {
  const t = (64 - 24 * s) / 2;
  return `<g transform="translate(${t} ${t}) scale(${s})" fill="none" stroke="${MARK}">
  <rect x="3.5" y="4" width="11" height="15" rx="1.4" stroke-width="1.7"/>
  <path d="M14.5 6.2h4.2c.8 0 1.3.7 1.1 1.4l-2.2 9.2c-.2.7-.9 1.2-1.6 1.2H10" stroke-width="1.7" stroke-linejoin="round"/>
  <path d="M7 9h5.5M7 12h4" stroke-width="1.5" stroke-linecap="round"/>
</g>`;
}

function iconSvg() {
  const bg = `<rect x="1" y="1" width="62" height="62" rx="15" fill="${BG}" stroke="${EDGE}" stroke-width="2"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${bg}
${mark(2.3)}
</svg>`;
}

const JOBS = [
  ...[16, 32, 48, 64].map((size) => ({ file: `public/favicon-${size}.png`, size })),
  ...[16, 24, 32, 48, 64, 128, 256].map((size) => ({ file: `ico:${size}`, size })),
];

function pageScript({ svgs, jobs }) {
  return (async () => {
    const out = {};
    for (const job of jobs) {
      const svg = svgs[job.variant ?? "rounded"];
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      });
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = job.size;
      canvas.getContext("2d").drawImage(img, 0, 0, job.size, job.size);
      out[job.file] = canvas.toDataURL("image/png").split(",")[1];
    }
    return out;
  })();
}

// PNG-compressed ICO: ICONDIR + ICONDIRENTRY per image + PNG blobs.
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  const blobs = [];
  let offset = header.length + dir.length;
  for (const [i, { size, buf }] of images.entries()) {
    dir.writeUInt8(size >= 256 ? 0 : size, i * 16);
    dir.writeUInt8(size >= 256 ? 0 : size, i * 16 + 1);
    dir.writeUInt16LE(1, i * 16 + 4); // color plane
    dir.writeUInt16LE(32, i * 16 + 6); // bits per pixel
    dir.writeUInt32LE(buf.length, i * 16 + 8);
    dir.writeUInt32LE(offset, i * 16 + 12);
    offset += buf.length;
    blobs.push(buf);
  }
  return Buffer.concat([header, dir, ...blobs]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL("about:blank");
  const pngs = await win.webContents.executeJavaScript(
    `(${pageScript.toString()})(${JSON.stringify({
      svgs: { rounded: iconSvg() },
      jobs: JOBS,
    })})`,
  );
  for (const [file, base64] of Object.entries(pngs)) {
    if (file.startsWith("ico:")) continue;
    writeFileSync(join(root, file), Buffer.from(base64, "base64"));
  }
  const icoSizes = JOBS.filter((j) => j.file.startsWith("ico:")).map((j) => j.size);
  const ico = buildIco(
    icoSizes.map((size) => ({ size, buf: Buffer.from(pngs[`ico:${size}`], "base64") })),
  );
  writeFileSync(join(root, "electron", "icon.ico"), ico);
  writeFileSync(join(root, "public", "favicon.svg"), iconSvg());
  console.log(`[make-icons] wrote ${Object.keys(pngs).length} PNGs + favicon.svg + electron/icon.ico`);
  app.quit();
});

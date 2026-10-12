/**
 * Renders the branded DMG installer background.
 *
 * There is no ImageMagick/sharp on this machine, but Electron ships a Chromium,
 * so we render HTML and screenshot it. Produces a @1x and @2x PNG that
 * electron-builder picks up via dmg.background.
 *
 * Layout must stay in sync with the `dmg.contents` coordinates in
 * package.json, which use a bottom-left origin:
 *   app icon   x=195 y=220
 *   Applications x=465 y=220
 * With a 660x440 window, y=220 is the vertical centre, so the arrow and the
 * icon labels are drawn around that same centre line.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'assets');
const tmpDir = path.join(__dirname, '..', '.dmg-bg-tmp');

const W = 660;
const H = 440;

// Matches dmg.contents in package.json (bottom-left origin).
const ICON_X = 195;
const ICON_Y = H - 220; // convert to top-left for rendering
const APPS_X = 465;
const APPS_Y = ICON_Y;

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden;
    font-family: -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif; }
  body {
    background:
      radial-gradient(120% 90% at 18% 8%, rgba(123,91,245,0.20) 0%, rgba(123,91,245,0) 55%),
      radial-gradient(100% 80% at 92% 96%, rgba(123,91,245,0.14) 0%, rgba(123,91,245,0) 50%),
      linear-gradient(160deg, #16132A 0%, #0E0D13 48%, #0A090F 100%);
    position: relative;
    color: #fff;
  }
  /* faint grid for depth */
  .grid { position: absolute; inset: 0; opacity: 0.35;
    background-image:
      linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
    background-size: 44px 44px;
    -webkit-mask-image: radial-gradient(circle at 50% 40%, #000 0%, transparent 78%); }

  .brand { position: absolute; top: 44px; left: 0; right: 0; text-align: center; }
  .brand .name { font-size: 30px; font-weight: 800; letter-spacing: 0.34em;
    background: linear-gradient(92deg, #FFFFFF 8%, #C9BCFF 52%, #7B5BF5 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    padding-left: 0.34em; }
  .brand .tag { margin-top: 9px; font-size: 11.5px; font-weight: 500;
    letter-spacing: 0.2em; color: rgba(255,255,255,0.42); text-transform: uppercase; }

  /* drop-zone card framing the two icons */
  .zone { position: absolute; left: 66px; right: 66px; top: ${ICON_Y - 78}px; height: 156px;
    border-radius: 22px;
    background: linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.015));
    border: 1px solid rgba(255,255,255,0.09);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 44px rgba(0,0,0,0.42); }

  .caption { position: absolute; left: 0; right: 0; top: ${ICON_Y + 74}px;
    text-align: center; font-size: 12.5px; font-weight: 600;
    letter-spacing: 0.13em; color: rgba(255,255,255,0.66); text-transform: uppercase; }

  .foot { position: absolute; left: 0; right: 0; bottom: 26px; text-align: center;
    font-size: 10.5px; letter-spacing: 0.16em; color: rgba(255,255,255,0.26);
    text-transform: uppercase; }

  /* Right-pointing arrow between the icons. Drawn, not an image. */
  .arrow { position: absolute; top: ${ICON_Y - 19}px; left: ${ICON_X + 26}px;
    width: ${APPS_X - ICON_X - 52}px; height: 38px; }
  .arrow .shaft { position: absolute; top: 17px; left: 0; right: 12px; height: 4px;
    border-radius: 3px;
    background: linear-gradient(90deg, rgba(123,91,245,0.25), #7B5BF5 72%, #997FF9);
    box-shadow: 0 0 14px rgba(123,91,245,0.55); }
  .arrow .head { position: absolute; top: 8px; right: 0; width: 20px; height: 22px; }
  .arrow .head::before { content: ""; position: absolute; right: 0; top: 0;
    border-left: 20px solid #997FF9; border-top: 11px solid transparent;
    border-bottom: 11px solid transparent; }
  /* travelling glow dots to imply motion */
  .dot { position: absolute; top: 15px; width: 8px; height: 8px; border-radius: 50%;
    background: #C9BCFF; box-shadow: 0 0 12px 2px rgba(153,127,249,0.85); }
  .dot.a { left: 22%; opacity: 0.55; }
  .dot.b { left: 52%; opacity: 0.85; }
</style></head>
<body>
  <div class="grid"></div>
  <div class="brand">
    <div class="name">KOVIES</div>
    <div class="tag">Cinematic Streaming</div>
  </div>
  <div class="zone"></div>
  <div class="arrow">
    <div class="shaft"></div><div class="dot a"></div><div class="dot b"></div>
    <div class="head"></div>
  </div>
  <div class="caption">Drag to Applications to Install</div>
  <div class="foot">4K Adaptive HLS &nbsp;&bull;&nbsp; Subtitles &nbsp;&bull;&nbsp; Resume Anywhere</div>
</body></html>`;

rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });
const srcHtml = path.join(tmpDir, 'background.html');
writeFileSync(srcHtml, html);

// Electron screenshot: load the file, capture the window, exit.
const shot = path.join(tmpDir, 'shot.png');
const shotJs = path.join(tmpDir, 'shot.cjs');
writeFileSync(
  shotJs,
  `const { app, BrowserWindow } = require('electron');
app.commandLine.appendSwitch('headless');
app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: ${W}, height: ${H}, show: false, frame: false,
    webPreferences: { offscreen: true },
  });
  await win.loadFile(${JSON.stringify(srcHtml)});
  const img = await win.webContents.capturePage();
  require('fs').writeFileSync(${JSON.stringify(shot)}, img.toPNG());
  app.quit();
});`
);

const electronBin = path.join(
  __dirname, '..', 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron'
);
execFileSync(electronBin, [shotJs], { stdio: 'inherit', cwd: tmpDir });

// 2x for Retina: electron-builder uses background@2x.png when present.
execFileSync('sips', ['-z', String(H), String(W), shot, '--out', path.join(outDir, 'dmg-background.png')], { stdio: 'ignore' });
execFileSync('sips', ['-z', String(H * 2), String(W * 2), shot, '--out', path.join(outDir, 'dmg-background@2x.png')], { stdio: 'ignore' });

rmSync(tmpDir, { recursive: true, force: true });
console.log('DMG background written to assets/dmg-background.png (@1x and @2x)');

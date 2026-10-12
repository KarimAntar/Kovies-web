/**
 * Renders the branded DMG installer background.
 *
 * Uses Electron headless capturePage to render an HTML/CSS template to
 * assets/dmg-background.png (@1x 660x440) and @2x (1320x880) for Retina displays.
 *
 * Layout coordinates in package.json:
 *   window: 660 x 440
 *   iconSize: 128
 *   contents:
 *     Kovies.app:   x=195, y=220 (Finder bottom-left origin => top-left center: x=195, y=220)
 *     Applications: x=465, y=220 (Finder bottom-left origin => top-left center: x=465, y=220)
 *
 * Icon bounds (128x128):
 *   Kovies icon:       x in [131, 259], y in [156, 284], label in y in [286, 314]
 *   Applications icon: x in [401, 529], y in [156, 284], label in y in [286, 314]
 *   Gap between icons: x in [259, 401] (width: 142px, center: 330px)
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

// Finder icon centers in top-left coordinates:
const ICON_X = 195;
const ICON_Y = H - 220; // 220px
const APPS_X = 465;

// Arrow spans gap between the two 128px icons with 18px padding on each side
const ARROW_LEFT = 277;
const ARROW_WIDTH = 106;
const ARROW_TOP = ICON_Y - 18; // 202px

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${W}px;
    height: ${H}px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  body {
    background:
      radial-gradient(120% 90% at 20% 8%, rgba(139, 92, 246, 0.22) 0%, rgba(139, 92, 246, 0) 55%),
      radial-gradient(100% 80% at 90% 95%, rgba(123, 91, 245, 0.16) 0%, rgba(123, 91, 245, 0) 50%),
      linear-gradient(160deg, #16132A 0%, #0E0D13 48%, #08070C 100%);
    position: relative;
    color: #fff;
  }

  /* Faint ambient grid for depth */
  .grid {
    position: absolute;
    inset: 0;
    opacity: 0.35;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
    background-size: 44px 44px;
    -webkit-mask-image: radial-gradient(circle at 50% 42%, #000 0%, transparent 80%);
  }

  /* Header brand lockup */
  .brand {
    position: absolute;
    top: 34px;
    left: 0;
    right: 0;
    text-align: center;
  }
  .brand .name {
    font-size: 28px;
    font-weight: 800;
    letter-spacing: 0.34em;
    background: linear-gradient(92deg, #FFFFFF 10%, #DDD6FE 52%, #8B5CF6 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    padding-left: 0.34em;
    text-shadow: 0 2px 16px rgba(139, 92, 246, 0.3);
  }
  .brand .tag {
    margin-top: 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.22em;
    color: rgba(255, 255, 255, 0.55);
    text-transform: uppercase;
  }

  /* Drop-zone card framing the two icons and their text labels cleanly */
  .zone {
    position: absolute;
    left: 60px;
    right: 60px;
    top: 116px;
    height: 206px;
    border-radius: 20px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.015));
    border: 1px solid rgba(255, 255, 255, 0.09);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 20px 48px rgba(0, 0, 0, 0.45);
  }

  /* Animated glowing motion arrow between the icons */
  .arrow {
    position: absolute;
    top: ${ARROW_TOP}px;
    left: ${ARROW_LEFT}px;
    width: ${ARROW_WIDTH}px;
    height: 36px;
  }
  .arrow .shaft {
    position: absolute;
    top: 16px;
    left: 0;
    right: 14px;
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(90deg, rgba(139, 92, 246, 0.25), #8B5CF6 65%, #A78BFA);
    box-shadow: 0 0 16px rgba(139, 92, 246, 0.65);
  }
  .arrow .head {
    position: absolute;
    top: 6px;
    right: 0;
    width: 22px;
    height: 24px;
  }
  .arrow .head::before {
    content: "";
    position: absolute;
    right: 0;
    top: 0;
    border-left: 22px solid #A78BFA;
    border-top: 12px solid transparent;
    border-bottom: 12px solid transparent;
    filter: drop-shadow(0 0 8px rgba(167, 139, 250, 0.75));
  }
  /* Pulse glow dots */
  .dot {
    position: absolute;
    top: 14px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #DDD6FE;
    box-shadow: 0 0 12px 2px rgba(167, 139, 250, 0.9);
  }
  .dot.a { left: 24%; opacity: 0.6; }
  .dot.b { left: 56%; opacity: 0.95; }

  /* Instruction caption clearly below the drop-zone card with high contrast */
  .caption {
    position: absolute;
    left: 0;
    right: 0;
    top: 346px;
    text-align: center;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.16em;
    color: #FFFFFF;
    text-transform: uppercase;
    text-shadow:
      0 1px 3px rgba(0, 0, 0, 0.9),
      0 0 16px rgba(139, 92, 246, 0.5);
  }

  /* Feature bullets at bottom */
  .foot {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 18px;
    text-align: center;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.16em;
    color: rgba(255, 255, 255, 0.45);
    text-transform: uppercase;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  }
</style></head>
<body>
  <div class="grid"></div>
  <div class="brand">
    <div class="name">KOVIES</div>
    <div class="tag">Cinematic Streaming</div>
  </div>
  <div class="zone"></div>
  <div class="arrow">
    <div class="shaft"></div>
    <div class="dot a"></div>
    <div class="dot b"></div>
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

// Generates assets/icon.ico and assets/icon.icns from assets/icon-source.png.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'assets', 'icon-source.png');
const outIco = path.join(root, 'assets', 'icon.ico');
const outIcns = path.join(root, 'assets', 'icon.icns');
const icoSizes = [16, 24, 32, 48, 64, 128, 256];

let icoInput;
if (process.platform === 'darwin') {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'kovies-icon-'));
  try {
    icoInput = icoSizes.map((s) => {
      const p = path.join(tmp, `icon-${s}.png`);
      execFileSync('sips', ['-z', String(s), String(s), src, '--out', p], { stdio: 'ignore' });
      return readFileSync(p);
    });

    // Generate .icns using iconutil
    const iconset = path.join(tmp, 'icon.iconset');
    mkdirSync(iconset);
    const icnsSpecs = [
      { name: 'icon_16x16.png', size: 16 },
      { name: 'icon_16x16@2x.png', size: 32 },
      { name: 'icon_32x32.png', size: 32 },
      { name: 'icon_32x32@2x.png', size: 64 },
      { name: 'icon_128x128.png', size: 128 },
      { name: 'icon_128x128@2x.png', size: 256 },
      { name: 'icon_256x256.png', size: 256 },
      { name: 'icon_256x256@2x.png', size: 512 },
      { name: 'icon_512x512.png', size: 512 },
      { name: 'icon_512x512@2x.png', size: 1024 },
    ];
    for (const spec of icnsSpecs) {
      execFileSync('sips', ['-z', String(spec.size), String(spec.size), src, '--out', path.join(iconset, spec.name)], { stdio: 'ignore' });
    }
    execFileSync('iconutil', ['-c', 'icns', iconset, '-o', outIcns]);
    console.log(`wrote ${outIcns}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
} else {
  icoInput = src;
}

writeFileSync(outIco, await pngToIco(icoInput));
console.log(`wrote ${outIco}`);

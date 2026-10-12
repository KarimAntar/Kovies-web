// Bundles main + preload into build/ with esbuild.
// KOVIES_API_KEY (env, build time) is inlined into build/main.js ONLY.
import { build } from 'esbuild';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outdir = path.join(root, 'build');

// Fallback to reading desktop/.env or ../.env if process.env.KOVIES_API_KEY is not set
let apiKey = process.env.KOVIES_API_KEY ?? '';
if (!apiKey) {
  for (const envPath of [path.join(root, '.env'), path.join(root, '..', '.env')]) {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf8');
      const match = content.match(/^KOVIES_API_KEY\s*=\s*(["']?)([^"'\r\n]+)\1/m);
      if (match && match[2]) {
        apiKey = match[2].trim();
        break;
      }
    }
  }
}

rmSync(outdir, { recursive: true, force: true });

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  sourcemap: false,
  minify: false,
  logLevel: 'warning',
  legalComments: 'none',
};

await build({
  ...common,
  entryPoints: [path.join(root, 'src/main/index.ts')],
  outfile: path.join(outdir, 'main.js'),
  define: { __KOVIES_API_KEY__: JSON.stringify(apiKey) },
});

// Preload runs sandboxed: single file, only `electron` may be required.
await build({
  ...common,
  entryPoints: [path.join(root, 'src/preload/index.ts')],
  outfile: path.join(outdir, 'preload.js'),
  target: 'chrome140',
});

if (apiKey) {
  const preload = readFileSync(path.join(outdir, 'preload.js'), 'utf8');
  if (preload.includes(apiKey)) {
    console.error('API key leaked into preload bundle; aborting.');
    process.exit(1);
  }
}
console.log(`desktop build ok (api key ${apiKey ? 'embedded in main' : 'NOT set - API calls will fail'})`);

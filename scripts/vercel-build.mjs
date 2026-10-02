// Build untuk Vercel (Build Output API v3):
//   frontend/dist      → .vercel/output/static           (SPA)
//   backend/src/vercel → .vercel/output/functions/api.func (Express, semua /api/*)
// Kode backend di-bundle esbuild; dependency npm dipasang terpisah (--omit=dev) karena
// pdfkit memuat font lewat require dinamis yang tidak bisa di-bundle.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, '.vercel', 'output');
const func = path.join(out, 'functions', 'api.func');
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit' });

fs.rmSync(out, { recursive: true, force: true });

console.log('▶ build frontend');
run('npm run build --prefix frontend');
fs.cpSync(path.join(root, 'frontend', 'dist'), path.join(out, 'static'), { recursive: true });

console.log('▶ bundle backend');
const esbuild = createRequire(path.join(root, 'backend', 'package.json'))('esbuild');
fs.mkdirSync(func, { recursive: true });
await esbuild.build({
  entryPoints: [path.join(root, 'backend', 'src', 'vercel.ts')],
  outfile: path.join(func, 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  sourcemap: 'inline',
  logLevel: 'info',
});

console.log('▶ install dependency produksi untuk function');
for (const f of ['package.json', 'package-lock.json']) fs.copyFileSync(path.join(root, 'backend', f), path.join(func, f));
run('npm ci --omit=dev --ignore-scripts --no-audit --no-fund', func);

fs.writeFileSync(path.join(func, '.vc-config.json'), JSON.stringify({
  runtime: 'nodejs22.x',
  handler: 'index.mjs',
  launcherType: 'Nodejs',
  shouldAddHelpers: false, // body di-parse sendiri oleh express.json / multer
  maxDuration: 60,
}, null, 2));

fs.writeFileSync(path.join(out, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    { src: '^/api(?:/.*)?$', dest: '/api' },
    { handle: 'filesystem' },
    { src: '^/.*$', dest: '/index.html' }, // SPA fallback
  ],
}, null, 2));

console.log('✔ .vercel/output siap');

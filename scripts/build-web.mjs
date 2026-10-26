// Builds the web app into dist/, which the server serves.
import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await build({ entryPoints: { app: 'src/web/main.ts' }, bundle: true, format: 'esm', target: 'es2022', minify: true, sourcemap: true, outdir: 'dist', logLevel: 'warning' });
for (const f of ['index.html', 'styles.css', 'icon.svg']) await cp(`src/web/${f}`, `dist/${f}`);
await cp('src/web/sfx', 'dist/sfx', { recursive: true });
await cp('src/web/avatars', 'dist/avatars', { recursive: true });
await cp('src/web/mascot', 'dist/mascot', { recursive: true, filter: (f) => !f.includes('/raw') });
// Artwork: third-party covers from `npm run fetch-art` (art/) and our own demo food photos (demo-art/).
import { existsSync } from 'node:fs';
if (existsSync('art')) await cp('art', 'dist/art', { recursive: true });
if (existsSync('demo-art')) await cp('demo-art', 'dist/art', { recursive: true });
console.log('web: built dist/');

import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const assets = path.join(here, 'composition/assets');
await mkdir(path.join(assets, 'fonts'), { recursive: true });
for (const [source, target] of [
  ['web/public/brand/scalesmiths-forge-atmosphere.webp', 'forge.webp'],
  ['web/public/brand/scalesmiths-wordmark.svg', 'wordmark.svg'],
  ['web/src/app/fonts/Syne.woff2', 'fonts/Syne.woff2'],
]) await copyFile(path.join(repo, source), path.join(assets, target));

const pinned = 'https://raw.githubusercontent.com/latent-spaces/brag/669ab9286aa28b6c3ee30e75f181ee74319d012a/skills/brag/assets/';
for (const [url, target] of [
  [pinned + 'music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3', 'music.mp3'],
  [pinned + 'sfx/impact/impactSoft_medium_001.ogg', 'soft.ogg'],
  [pinned + 'sfx/interface/click_003.ogg', 'click.ogg'],
  ['https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js', 'gsap.min.js'],
]) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Asset download failed: ${target} (${response.status})`);
  await writeFile(path.join(assets, target), Buffer.from(await response.arrayBuffer()));
}
console.log('Brand, font, music, SFX and GSAP assets prepared.');

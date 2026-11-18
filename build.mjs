// Build the single-file Harbor Jelly HTML from readable sources.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const shell = read('src/shell.html');
const core = read('src/core.js');
const parts = [
  'src/00_math.js',
  'src/10_geometry.js',
  'src/20_scene.js',
  'src/30_dynamic.js',
  'src/40_water.js',
  'src/50_shaders_scene.js',
  'src/51_shaders_water.js',
  'src/60_gpu_common.js',
  'src/61_renderer.js',
  'src/70_life.js',
  'src/80_ui.js',
  'src/90_main.js'
];
const app = parts.map((p) => read(p)).join('\n\n');
const safeCore = core.replace(/<\/script>/gi, '<\\/script>');
const safeApp = app.replace(/<\/script>/gi, '<\\/script>');
const html = shell.replace('<!--CORE-->', safeCore).replace('<!--APP-->', safeApp);
fs.writeFileSync(path.join(root, 'index.html'), html);
const stats = {
  indexBytes: Buffer.byteLength(html),
  coreBytes: Buffer.byteLength(safeCore),
  appBytes: Buffer.byteLength(safeApp),
  lines: html.split('\n').length
};
console.log(JSON.stringify(stats));
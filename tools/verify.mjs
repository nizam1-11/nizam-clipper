// tools/verify.mjs — integrity check for the rebuilt SNU Clipper layout.
// Prints PASS/FAIL for every required file and the total size of what is present.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const targets = [
  'SNU-Clipper.exe',
  'resources/app.asar',
  'resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg.exe',
  'resources/app.asar.unpacked/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe',
  'resources/app.asar.unpacked/node_modules/onnxruntime-node/bin/napi-v6/win32/x64/onnxruntime.dll',
  'out/main/index.js',
  'out/main/engine.js',
  'out/preload/index.js',
  'out/renderer/index.html',
  'node_modules/electron-updater',
];

function fmt(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function sizeOf(p) {
  const st = fs.statSync(p);
  if (st.isFile()) return st.size;
  let total = 0;
  for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
    const child = path.join(p, entry.name);
    total += entry.isDirectory() ? sizeOf(child) : fs.statSync(child).size;
  }
  return total;
}

console.log('SNU Clipper rebuild - verification');
console.log('='.repeat(48));

let failed = 0;
let total = 0;
for (const rel of targets) {
  const abs = path.join(root, ...rel.split('/'));
  if (fs.existsSync(abs)) {
    const size = sizeOf(abs);
    total += size;
    console.log(`PASS  ${rel}  (${fmt(size)})`);
  } else {
    failed += 1;
    console.log(`FAIL  ${rel}  (missing)`);
  }
}

console.log('-'.repeat(48));
console.log(`Total size of present items: ${fmt(total)}`);
console.log(`${targets.length - failed}/${targets.length} checks passed.`);

if (failed > 0) {
  console.error(`${failed} check(s) failed.`);
  process.exit(1);
}

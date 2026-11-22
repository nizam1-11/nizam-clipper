// tools/verify-source.mjs — CI-safe integrity check (no heavy binaries needed).
// Checks source files, syntax, docs links, branding and secrets.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const results = [];

function check(label, ok, detail = '') {
  results.push({ label, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
}

function read(rel) {
  const p = path.join(root, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

// --- 1. manifest ----------------------------------------------------------
let pkg = null;
try {
  pkg = JSON.parse(read('package.json'));
  check('package.json parses', true, `${pkg.name} v${pkg.version}`);
} catch (e) {
  check('package.json parses', false, e.message);
}
if (pkg) {
  check('productName is SNU Clipper', pkg.productName === 'SNU Clipper', String(pkg.productName));
  check('main entry declared', pkg.main === './out/main/index.js', String(pkg.main));
  for (const s of ['start', 'build', 'verify', 'verify:source']) {
    check(`script ${s} exists`, Boolean(pkg.scripts && pkg.scripts[s]));
  }
}

// --- 2. required source files ---------------------------------------------
const required = [
  'README.md', 'LICENSE', '.gitignore',
  'out/main/index.js', 'out/main/engine.js', 'out/main/speech.js',
  'out/preload/index.js', 'out/renderer/index.html',
  'resources/app-update.yml', 'resources/app.asar',
  'docs/download-button.png', 'docs/nizam-logo.png', 'docs/snu.ico',
  'docs/screenshots/01-wizard.png', 'docs/screenshots/02-projects.png',
  'docs/screenshots/03-settings.png', 'docs/screenshots/04-shortcuts.png',
  'tools/run.mjs', 'tools/rebuild-asar.mjs', 'tools/verify.mjs',
  'tools/release.ps1', 'tools/verify-source.mjs',
];
for (const rel of required) check(`file ${rel}`, fs.existsSync(path.join(root, rel)));

// --- 3. JS syntax (raw bytes, ESM parser) ---------------------------------
function jsFiles(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== '.git' && !/backup/i.test(e.name)) jsFiles(p, acc);
    } else if (/\.(js|mjs)$/i.test(e.name)) acc.push(p);
  }
  return acc;
}
for (const dir of ['out', 'tools']) {
  for (const file of jsFiles(path.join(root, dir))) {
    const buf = fs.readFileSync(file);
    const r = spawnSync(process.execPath, ['--input-type=module', '--check'], {
      input: buf, encoding: 'utf8', windowsHide: true,
    });
    check(`syntax ${path.relative(root, file)}`, r.status === 0,
      r.status === 0 ? '' : String(r.stderr || '').split('\n')[0]);
  }
}

// --- 4. README links ------------------------------------------------------
const readme = read('README.md') || '';
for (const m of readme.matchAll(/!\[[^\]]*\]\((docs\/[^)]+)\)/g)) {
  check(`README image ${m[1]}`, fs.existsSync(path.join(root, m[1])));
}
const setupName = pkg ? `SNU-Clipper-Setup-v${pkg.version}.exe` : '';
check(`README setup link matches package version (${setupName})`, setupName ? readme.includes(setupName) : false);

// --- 5. update feed -------------------------------------------------------
const yml = read('resources/app-update.yml') || '';
check('update owner = nizam1-11', /owner:\s*nizam1-11/.test(yml));
check('update repo = snu-clipper', /repo:\s*snu-clipper/.test(yml));
check('releaseType = release', /releaseType:\s*release/.test(yml));
const hw = read('out/main/chunks/hardware-BuqFOQez.js') || '';
check('fallback RELEASES_REPO matches', hw.includes('owner: "nizam1-11", repo: "snu-clipper"'));

// --- 6. branding / secret regressions ------------------------------------
const scanFiles = jsFiles(path.join(root, 'out')).concat([
  path.join(root, 'README.md'), path.join(root, 'package.json'),
  path.join(root, 'resources', 'app-update.yml'),
]);
const forbidden = [
  ['old product name (Clipie)', /Clipie/],
  ['old release feed', /Inshal-Amir|Clipie-releases/],
  ['OAuth client secret', /GOCSPX-[A-Za-z0-9_-]+/],
  ['bank account number', /900100671636|021606742/],
  ['payment email', /inshalamir00@gmail\.com/],
  ['USDT address', /0x9a304a3fe4718c108a19a2b5fb2c5a64320c6693/],
];
for (const [label, re] of forbidden) {
  const hits = [];
  for (const f of scanFiles) {
    if (!fs.existsSync(f)) continue;
    const t = fs.readFileSync(f, 'utf8');
    if (re.test(t)) hits.push(path.relative(root, f));
  }
  check(`no ${label}`, hits.length === 0, hits.join(', '));
}

// --- summary --------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
console.log('-'.repeat(56));
console.log(`${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) process.exit(1);

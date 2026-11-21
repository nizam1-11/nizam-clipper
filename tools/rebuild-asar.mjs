// tools/rebuild-asar.mjs
// Rebuilds resources/app.asar (and its app.asar.unpacked sibling) from the
// editable out/ folder, node_modules/ and package.json.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const resources = path.join(root, 'resources');
// NOTE: staging/temp names must NOT start with a dot. With a dot-prefixed source
// directory, @electron/asar's glob-based --unpack matching silently matches
// nothing (verified against v4.3.2), and the native binaries end up packed
// inside the archive instead of app.asar.unpacked.
const staging = path.join(root, `build-staging-${process.pid}`);
// Pack INSIDE resources/ so asar writes the unpacked sibling next to the final
// archive (a temp asar in the project root would strand binaries in the root).
const tempAsar = path.join(resources, `app-${process.pid}.asar`);
const tempUnpacked = `${tempAsar}.unpacked`;
const targetAsar = path.join(resources, 'app.asar');
const targetUnpacked = path.join(resources, 'app.asar.unpacked');
const backupAsar = path.join(resources, 'app.asar.bak');
const backupUnpacked = path.join(resources, 'app.asar.unpacked.bak');

// Native binaries cannot be loaded from inside an asar. These four package
// folders must be written to app.asar.unpacked instead:
//   node_modules/@huggingface/transformers/**
//   node_modules/ffmpeg-static/**
//   node_modules/ffprobe-static/**
//   node_modules/onnxruntime-node/**
// @electron/asar's CLI declares --unpack as a single string (repeated flags
// keep only the last value) and matches it against absolute paths, so the four
// globs are combined into one brace-expansion pattern that matches after any
// leading path.
const UNPACK_PATTERN =
  '**/node_modules/{@huggingface/transformers,ffmpeg-static,ffprobe-static,onnxruntime-node}/**';

const UNPACKED_REQUIRED = [
  'node_modules/ffmpeg-static/ffmpeg.exe',
  'node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe',
  'node_modules/onnxruntime-node/bin/napi-v6/win32/x64/onnxruntime.dll',
  'node_modules/onnxruntime-node/bin/napi-v6/win32/x64/onnxruntime_binding.node',
];

const step = (m) => console.log(`[build] ${m}`);
const fail = (m) => console.error(`[build] ERROR: ${m}`);

function fmt(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function sizeOf(p) {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

function dirSize(p) {
  let total = 0;
  for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
    const child = path.join(p, entry.name);
    total += entry.isDirectory() ? dirSize(child) : fs.statSync(child).size;
  }
  return total;
}

function cleanup() {
  for (const p of [staging, tempAsar, tempUnpacked]) {
    try {
      if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
    } catch (e) {
      fail(`could not remove ${path.basename(p)}: ${e.message}`);
    }
  }
}

// fs.cpSync filter: stage everything except the packer and its dependency
// chain (these were copied into node_modules so npm run build works offline,
// but they are dev-only and must not ship inside the app archive).
const PACKER_ONLY_PACKAGES = new Set([
  '@electron', '@isaacs', 'balanced-match', 'brace-expansion',
  'glob', 'lru-cache', 'minimatch', 'minipass', 'path-scurry',
]);

function copyFilter(src) {
  const rel = path.relative(root, src).split(path.sep).join('/');
  if (!rel.startsWith('node_modules/')) return true;
  const top = rel.slice('node_modules/'.length).split('/')[0];
  return !PACKER_ONLY_PACKAGES.has(top);
}

// Prefer the locally cached @electron/asar package; fall back to npx.
// The cached v4 package ships bin/asar.mjs (older releases used bin/asar.js).
function resolveAsar() {
  const bin = path.join(root, 'node_modules', '@electron', 'asar', 'bin');
  for (const name of ['asar.js', 'asar.mjs']) {
    const candidate = path.join(bin, name);
    if (fs.existsSync(candidate)) return { mode: 'script', target: candidate };
  }
  return { mode: 'npx' };
}

function pack() {
  const asar = resolveAsar();
  const packArgs = ['pack', staging, tempAsar, '--unpack', UNPACK_PATTERN];
  let r;
  if (asar.mode === 'script') {
    step(`Packing with local asar CLI: ${path.relative(root, asar.target)}`);
    r = spawnSync(process.execPath, [asar.target, ...packArgs], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    });
  } else {
    step('Local @electron/asar CLI not found - falling back to: npx --yes @electron/asar');
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    r = spawnSync(npx, ['--yes', '@electron/asar', ...packArgs], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      shell: process.platform === 'win32',
    });
  }
  if (r.error) throw new Error(`failed to start asar: ${r.error.message}`);
  if (r.stdout && r.stdout.trim()) step(r.stdout.trim());
  if (r.status !== 0) {
    throw new Error(`asar exited with code ${r.status}\n${r.stderr || ''}`);
  }
  if (!fs.existsSync(tempAsar)) throw new Error('asar reported success but no archive was produced');
}

function verifyUnpacked() {
  step('Verifying unpacked native binaries in the temporary archive');
  if (!fs.existsSync(tempUnpacked)) {
    throw new Error(`asar did not create the unpacked folder: ${path.relative(root, tempUnpacked)}`);
  }
  for (const rel of UNPACKED_REQUIRED) {
    const abs = path.join(tempUnpacked, ...rel.split('/'));
    if (!fs.existsSync(abs)) throw new Error(`missing unpacked binary: ${rel}`);
    step(`  OK  ${rel}`);
  }
  step('All required unpacked binaries are present.');
}

function main() {
  step('Rebuilding resources/app.asar (with unpack rules)');
  cleanup(); // remove leftovers from any previous interrupted run

  step(`Staging directory: ${path.relative(root, staging)}`);
  fs.mkdirSync(staging, { recursive: true });

  step('Copying package.json');
  fs.copyFileSync(path.join(root, 'package.json'), path.join(staging, 'package.json'));

  step('Copying out/');
  fs.cpSync(path.join(root, 'out'), path.join(staging, 'out'), {
    recursive: true,
    filter: copyFilter,
  });

  step('Copying node_modules/ (excluding @electron/asar)');
  fs.cpSync(path.join(root, 'node_modules'), path.join(staging, 'node_modules'), {
    recursive: true,
    filter: copyFilter,
  });

  step(`Unpack glob: ${UNPACK_PATTERN}`);
  pack();
  verifyUnpacked();

  let asarBackedUp = false;
  let unpackedBackedUp = false;
  let asarInstalled = false;
  let unpackedInstalled = false;

  try {
    fs.mkdirSync(resources, { recursive: true });

    step('Removing any previous .bak artifacts');
    if (fs.existsSync(backupAsar)) fs.rmSync(backupAsar, { recursive: true, force: true });
    if (fs.existsSync(backupUnpacked)) fs.rmSync(backupUnpacked, { recursive: true, force: true });

    const oldAsar = sizeOf(targetAsar);
    const oldUnpacked = fs.existsSync(targetUnpacked) ? dirSize(targetUnpacked) : 0;

    if (fs.existsSync(targetAsar)) {
      step('Backup: app.asar -> app.asar.bak');
      fs.renameSync(targetAsar, backupAsar);
      asarBackedUp = true;
    }
    if (fs.existsSync(targetUnpacked)) {
      step('Backup: app.asar.unpacked -> app.asar.unpacked.bak');
      fs.renameSync(targetUnpacked, backupUnpacked);
      unpackedBackedUp = true;
    }

    step('Installing new app.asar + app.asar.unpacked');
    fs.renameSync(tempAsar, targetAsar);
    asarInstalled = true;
    fs.renameSync(tempUnpacked, targetUnpacked);
    unpackedInstalled = true;

    step(`app.asar size: ${fmt(oldAsar)} -> ${fmt(sizeOf(targetAsar))}`);
    step(`app.asar.unpacked size: ${fmt(oldUnpacked)} -> ${fmt(dirSize(targetUnpacked))}`);

    step('Cleaning up staging and temporary files');
    cleanup();
    step('Done. Native binaries are in app.asar.unpacked.');
  } catch (e) {
    step('Failure detected - rolling back');
    if (asarInstalled) {
      try { fs.rmSync(targetAsar, { force: true }); } catch (r) { fail(`could not remove new app.asar: ${r.message}`); }
    }
    if (unpackedInstalled) {
      try { fs.rmSync(targetUnpacked, { recursive: true, force: true }); } catch (r) { fail(`could not remove new app.asar.unpacked: ${r.message}`); }
    }
    if (asarBackedUp) {
      try { fs.renameSync(backupAsar, targetAsar); step('Restored app.asar from backup'); } catch (r) { fail(`restore of app.asar failed: ${r.message}`); }
    }
    if (unpackedBackedUp) {
      try { fs.renameSync(backupUnpacked, targetUnpacked); step('Restored app.asar.unpacked from backup'); } catch (r) { fail(`restore of app.asar.unpacked failed: ${r.message}`); }
    }
    cleanup();
    throw e;
  }
}

try {
  main();
} catch (e) {
  fail(e && e.message ? e.message : String(e));
  cleanup(); // also clean up if packing/verification failed before any swap
  process.exitCode = 1;
}

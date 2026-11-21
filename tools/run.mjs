// tools/run.mjs — launch the bundled Electron runtime (SNU-Clipper.exe).
// Usage: npm start -- [extra args passed to the app]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const exe = path.join(root, 'SNU-Clipper.exe');

if (!fs.existsSync(exe)) {
  console.error(
    '[run] SNU-Clipper.exe was not found.\n' +
      `      Expected at: ${exe}\n` +
      '      Keep SNU-Clipper.exe in the project root, next to package.json.'
  );
  process.exit(1);
}

const args = process.argv.slice(2);
console.log(`[run] Launching ${path.relative(root, exe)}${args.length ? ' ' + args.join(' ') : ''}`);

const child = spawn(exe, args, {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true,
});

child.on('error', (err) => {
  console.error(`[run] Failed to start SNU-Clipper.exe: ${err.message}`);
  process.exitCode = 1;
});

child.on('spawn', () => {
  console.log('[run] SNU-Clipper.exe started.');
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.log(`[run] SNU-Clipper.exe terminated by signal ${signal}.`);
    process.exitCode = 1;
  } else {
    console.log(`[run] SNU-Clipper.exe exited with code ${code}.`);
    process.exitCode = code ?? 0;
  }
});

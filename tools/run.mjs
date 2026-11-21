// tools/run.mjs — launch the bundled Electron runtime (Nizam.exe).
// Usage: npm start -- [extra args passed to the app]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const exe = path.join(root, 'Nizam.exe');

if (!fs.existsSync(exe)) {
  console.error(
    '[run] Nizam.exe was not found.\n' +
      `      Expected at: ${exe}\n` +
      '      Keep Nizam.exe in the project root, next to package.json.'
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
  console.error(`[run] Failed to start Nizam.exe: ${err.message}`);
  process.exitCode = 1;
});

child.on('spawn', () => {
  console.log('[run] Nizam.exe started.');
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.log(`[run] Nizam.exe terminated by signal ${signal}.`);
    process.exitCode = 1;
  } else {
    console.log(`[run] Nizam.exe exited with code ${code}.`);
    process.exitCode = code ?? 0;
  }
});

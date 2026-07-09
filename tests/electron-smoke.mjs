import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import electronPath from 'electron';

const workspace = fileURLToPath(new URL('..', import.meta.url));
const userDataPath = fileURLToPath(new URL('../.tmp-electron-smoke', import.meta.url));
// Windows may scan a newly downloaded Electron binary on its first launch.
const timeoutMs = 90_000;

const electron = spawn(
  electronPath,
  [
    '--disable-gpu',
    '--disable-gpu-compositing',
    '--disable-gpu-sandbox',
    '--in-process-gpu',
    '--no-sandbox',
    '.',
  ],
  {
    cwd: workspace,
    env: {
      ...process.env,
      JARVIS_SMOKE_TEST: '1',
      JARVIS_USER_DATA_PATH: userDataPath,
      ELECTRON_ENABLE_LOGGING: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

let stdout = '';
let stderr = '';

electron.stdout.on('data', (chunk) => {
  stdout += chunk.toString();
});

electron.stderr.on('data', (chunk) => {
  stderr += chunk.toString();
});

const timeout = setTimeout(() => {
  electron.kill();
  console.error(`Electron smoke test timed out after ${timeoutMs}ms.`);
  process.exitCode = 1;
}, timeoutMs);

electron.once('error', (error) => {
  clearTimeout(timeout);
  console.error(error);
  process.exitCode = 1;
});

electron.once('exit', (code) => {
  clearTimeout(timeout);

  if (code !== 0 || !stdout.includes('JARVIS_ELECTRON_SMOKE_OK')) {
    console.error(`Electron smoke test failed with exit code ${String(code)}.`);
    if (stdout.trim()) console.error(stdout.trim());
    if (stderr.trim()) console.error(stderr.trim());
    process.exitCode = 1;
    return;
  }

  console.log('Electron renderer and preload smoke test passed.');
});

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const electronBinary =
  process.platform === 'win32'
    ? path.join(rootDir, 'node_modules', 'electron', 'dist', 'electron.exe')
    : path.join(rootDir, 'node_modules', 'electron', 'dist', 'electron');

const electron = spawn(electronBinary, ['.'], {
  cwd: rootDir,
  stdio: 'inherit'
});

electron.on('exit', (code) => {
  process.exit(code ?? 0);
});

const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('node:path');
const { mkdir, writeFile } = require('node:fs/promises');

const rootDir = path.resolve(__dirname, '..');
const isDev = !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173';
const appIcon =
  process.platform === 'darwin'
    ? path.join(rootDir, 'public', 'Vector.icns')
    : process.platform === 'win32'
      ? path.join(rootDir, 'public', 'Vector.ico')
      : path.join(rootDir, 'public', 'Vector.png');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#090d18',
    icon: appIcon,
    title: 'TSGen',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    win.loadURL(devServerUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(rootDir, 'dist', 'index.html'));
  }
}

ipcMain.handle('save-generated-file', async (_event, payload) => {
  const suggestedName = payload?.suggestedName || 'parser.ts';
  const code = typeof payload?.code === 'string' ? payload.code : '';
  const result = await dialog.showSaveDialog({
    title: 'Save generated TypeScript',
    defaultPath: suggestedName,
    filters: [{ name: 'TypeScript', extensions: ['ts'] }]
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  await mkdir(path.dirname(result.filePath), { recursive: true });
  await writeFile(result.filePath, code, 'utf8');
  return { canceled: false, filePath: result.filePath };
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

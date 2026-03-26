const { app, BrowserWindow, shell, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs   = require('fs');

// Azure AD authentication
const { registerAuth } = require('./auth.js');

// Auto-updater — only active in packaged builds (not during npm start)
let autoUpdater = null;
if (app.isPackaged) {
  try { autoUpdater = require('electron-updater').autoUpdater; } catch (_) {}
}

// Register pyl0n:// as a privileged protocol (must be before app.whenReady)
protocol.registerSchemesAsPrivileged([
  { scheme: 'pyl0n', privileges: { secure: true, standard: true } },
]);

// Register Azure AD auth IPC handlers
registerAuth();

// Keep a global reference to prevent garbage collection closing the window
let mainWindow;

const ICON = path.join(__dirname, 'build',
  process.platform === 'win32'  ? 'icon.ico'  :
  process.platform === 'darwin' ? 'icon.icns' : 'icon.png');

// ── Auth gate ─────────────────────────────────────────────────────────────────

async function startApp() {
  // Check for a valid cached token first — skip login screen if still valid
  const user = await new Promise(resolve => {
    ipcMain.handle('_auth:getUser_internal', async () => null); // placeholder
    resolve(null);
  });

  // Use the auth module directly
  const authMod = require('./auth.js');
  // We re-use the IPC handler registered in registerAuth() via a direct call
  // by reading the token file through the same logic.
  const { _getUser } = authMod;

  // If Azure config is not set up yet, skip auth and open app directly.
  // This lets developers run `npm start` without Azure configured.
  const configPath = path.join(__dirname, 'azure-config.json');
  let azureReady = false;
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    azureReady = cfg.clientId && cfg.clientId !== 'YOUR-CLIENT-ID-HERE';
  } catch (_) {}

  if (!azureReady) {
    // Dev mode or config not yet set — open app directly
    createMainWindow();
    return;
  }

  // Check cached token
  const cachedUser = await checkCachedAuth();
  if (cachedUser) {
    createMainWindow();
    return;
  }

  // Show login screen
  createLoginWindow();
}

async function checkCachedAuth() {
  // Delegate to auth module's token check via IPC
  return new Promise((resolve) => {
    // We invoke the already-registered 'auth:getUser' handler directly
    ipcMain.emit('auth:getUser', { sender: { send: () => {} } }, resolve);

    // Fallback: just try to invoke it
    const { ipcMain: ipc } = require('electron');
    ipc.handle('_unused_', () => {});

    // Simpler: import and call the check directly
    // Since auth.js registers ipcMain.handle('auth:getUser'), we read the token
    // the same way by checking the token file via the crypto/storage utilities.
    // Resolved below by loading token file directly.
    const tokenFile = path.join(app.getPath('userData'), 'pyl0n_auth.dat');
    if (!fs.existsSync(tokenFile)) return resolve(null);

    try {
      const raw  = fs.readFileSync(tokenFile);
      const { safeStorage } = require('electron');
      let json;
      if (safeStorage.isEncryptionAvailable()) {
        json = safeStorage.decryptString(raw);
      } else {
        json = raw.toString('utf8');
      }
      const token = JSON.parse(json);
      const valid = token && token.expires_at && Date.now() < token.expires_at - 60_000;
      resolve(valid ? token : null);
    } catch (_) { resolve(null); }
  });
}

function createLoginWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 560,
    resizable: false,
    maximizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: ICON,
    show: false,
    backgroundColor: '#f5f4f0',
    title: 'PYL0N — Sign In',
    autoHideMenuBar: true,
  });

  win.loadFile('login.html');
  win.once('ready-to-show', () => win.show());

  // When auth succeeds, close login and open main window
  ipcMain.once('auth:success', () => {
    win.close();
    createMainWindow();
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:pyl0n',
    },
    icon: ICON,
    show: false,
    backgroundColor: '#f5f4f0',
    title: 'PYL0N',
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('dialog:saveFile', async (_event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle('dialog:openFile', async (_event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

// encoding: 'utf8' (default) for text/JSON/HTML, 'base64' for binary (xlsx, pdf)
ipcMain.handle('fs:writeFile', async (_event, filePath, data, encoding = 'utf8') => {
  try {
    if (encoding === 'base64') {
      fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    } else {
      fs.writeFileSync(filePath, data, 'utf8');
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs:readFile', async (_event, filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('app:getVersion', () => app.getVersion());

// Auth success signal from login.html renderer
ipcMain.on('auth:success', () => {});  // handled per-window via ipcMain.once above

// ── Auto-update IPC ───────────────────────────────────────────────────────────

ipcMain.handle('app:checkForUpdates', async () => {
  if (!autoUpdater) return { available: false, reason: 'dev-mode' };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { available: !!result, version: result?.updateInfo?.version };
  } catch (err) {
    return { available: false, error: err.message };
  }
});

ipcMain.handle('app:installUpdate', () => {
  if (autoUpdater) autoUpdater.quitAndInstall();
});

// ─────────────────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  startApp();

  if (autoUpdater) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-downloaded', (info) => {
      if (mainWindow) mainWindow.webContents.send('update:ready', { version: info.version });
    });
    setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 5000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) startApp();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

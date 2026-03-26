const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');

// Keep a global reference to prevent garbage collection closing the window
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Allow localStorage to persist across sessions
      partition: 'persist:pyl0n',
    },
    // Use platform-appropriate icon
    icon: path.join(__dirname, 'build',
      process.platform === 'win32'  ? 'icon.ico'  :
      process.platform === 'darwin' ? 'icon.icns' : 'icon.png'),
    show: false, // show after ready-to-show to avoid flash
    backgroundColor: '#f5f4f0',
    titleBarStyle: 'default',
    title: 'PYL0N',
  });

  mainWindow.loadFile('index.html');

  // Show window once content is ready — avoids white flash on startup
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links (http/https) in the system browser, not inside the app
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
  return result; // { canceled, filePath }
});

ipcMain.handle('dialog:openFile', async (_event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result; // { canceled, filePaths }
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

// ─────────────────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();

  // macOS: re-create window when dock icon is clicked and no windows are open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit on all windows closed (except macOS where apps stay active until Cmd+Q)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

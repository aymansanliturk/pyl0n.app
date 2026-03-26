const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  // ── File dialogs ────────────────────────────────────────────────────────────

  // Save a file via native Save dialog
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),

  // Open a file via native Open dialog
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),

  // Write data to an absolute file path
  // encoding: 'utf8' (default) | 'base64' (for xlsx, pdf)
  writeFile: (filePath, data, encoding) => ipcRenderer.invoke('fs:writeFile', filePath, data, encoding),

  // Read data from an absolute file path
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),

  // ── App info ────────────────────────────────────────────────────────────────

  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // ── Azure AD authentication ─────────────────────────────────────────────────

  // Get signed-in user from cached token: { name, email, oid, tid } or null
  getUser: () => ipcRenderer.invoke('auth:getUser'),

  // Open Microsoft login window and return user object on success
  login: () => ipcRenderer.invoke('auth:login'),

  // Sign out and clear stored token
  logout: () => ipcRenderer.invoke('auth:logout'),

  // Signal main process that login succeeded (used by login.html)
  authSuccess: () => ipcRenderer.send('auth:success'),

  // ── Auto-update ─────────────────────────────────────────────────────────────

  checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
  installUpdate:   () => ipcRenderer.invoke('app:installUpdate'),

  // Listen for update-ready event pushed from main process
  onUpdateReady: (callback) => ipcRenderer.on('update:ready', (_e, info) => callback(info)),
});

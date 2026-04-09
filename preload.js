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

});

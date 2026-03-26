const { contextBridge, ipcRenderer } = require('electron');

// ── Session 2: native file dialog API ────────────────────────────────────────
// Exposes a minimal electronAPI surface to the renderer (HTML pages).
// All Node/Electron APIs remain sandboxed — only these explicit methods
// are accessible from page scripts via window.electronAPI.
contextBridge.exposeInMainWorld('electronAPI', {

  // Save a file via native Save dialog
  // options: { defaultPath, filters: [{ name, extensions }] }
  // Returns: { canceled, filePath } — filePath is undefined if canceled
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),

  // Open a file via native Open dialog
  // options: { filters: [{ name, extensions }], properties: ['openFile'] }
  // Returns: { canceled, filePaths } — filePaths is [] if canceled
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),

  // Write data to an absolute file path (used after saveFile resolves)
  // encoding: 'utf8' (default) for text/JSON/HTML, 'base64' for binary (xlsx, pdf)
  // Returns: { success, error }
  writeFile: (filePath, data, encoding) => ipcRenderer.invoke('fs:writeFile', filePath, data, encoding),

  // Read data from an absolute file path (used after openFile resolves)
  // Returns: { success, data, error }
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),

  // Get the Electron / app version for display
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
});

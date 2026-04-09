/**
 * vendor/pyl0n-native.js
 * Shared file I/O bridge for the PYL0N suite.
 *
 * When running inside Electron, uses native OS file dialogs via window.electronAPI
 * (exposed by preload.js over contextBridge).
 * When running in a plain browser, falls back to Blob-URL downloads and <input type="file">.
 *
 * Included in every tool's <head> — must have no dependencies on tool-specific globals.
 */

/* ── Save helpers ─────────────────────────────────────────────────────────── */

/**
 * Save a plain-text or JSON file.
 * @param {string} filename   - Suggested filename (e.g. "project_timecast.json")
 * @param {string} content    - UTF-8 string content
 * @param {string} filterName - File-type label for Electron dialog (e.g. "JSON Files")
 * @param {string} ext        - Extension without dot (e.g. "json", "html")
 */
async function nativeSaveText(filename, content, filterName, ext) {
  if (window.electronAPI) {
    const { filePath, canceled } = await window.electronAPI.saveFile({
      defaultPath: filename,
      filters: [
        { name: filterName, extensions: [ext] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (canceled || !filePath) return;
    await window.electronAPI.writeFile(filePath, content, 'utf8');
  } else {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    _triggerDownload(blob, filename);
  }
}

/**
 * Save an XLSX workbook.
 * @param {object} wb       - SheetJS workbook object
 * @param {string} filename - Suggested filename (e.g. "project_resourcecast.xlsx")
 */
async function nativeSaveXLSX(wb, filename) {
  if (window.electronAPI) {
    const { filePath, canceled } = await window.electronAPI.saveFile({
      defaultPath: filename,
      filters: [
        { name: 'Excel Workbook', extensions: ['xlsx'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (canceled || !filePath) return;
    const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    await window.electronAPI.writeFile(filePath, base64, 'base64');
  } else {
    XLSX.writeFile(wb, filename);
  }
}

/**
 * Save a PDF rendered from a DOM element via html2pdf.js.
 * @param {HTMLElement} el  - Element to render
 * @param {string} filename - Suggested filename (e.g. "project_timecast.pdf")
 * @param {object} opts     - html2pdf options object (merged with defaults)
 */
async function nativeSavePDF(el, filename, opts) {
  const defaults = {
    margin: 10,
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };
  const mergedOpts = Object.assign({}, defaults, opts, { filename });

  if (window.electronAPI) {
    const { filePath, canceled } = await window.electronAPI.saveFile({
      defaultPath: filename,
      filters: [
        { name: 'PDF Document', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (canceled || !filePath) return;
    const blob = await html2pdf().set(mergedOpts).from(el).outputPdf('blob');
    const base64 = await _blobToBase64(blob);
    await window.electronAPI.writeFile(filePath, base64, 'base64');
  } else {
    await html2pdf().set(mergedOpts).from(el).save();
  }
}

/**
 * Save a self-contained HTML snapshot.
 * @param {string} filename    - Suggested filename (e.g. "project_timecast.html")
 * @param {string} htmlContent - Complete HTML string
 */
async function nativeSaveHTML(filename, htmlContent) {
  await nativeSaveText(filename, htmlContent, 'HTML Files', 'html');
}

/* ── Open helpers ─────────────────────────────────────────────────────────── */

/**
 * Open a text/JSON/HTML file.
 * @param {string[]}   extensions   - Allowed extensions (e.g. ["json"])
 * @param {function}   callback     - Called with the file's UTF-8 string content
 * @param {HTMLElement} fallbackInput - <input type="file"> element used in browser mode
 */
async function nativeOpenText(extensions, callback, fallbackInput) {
  if (window.electronAPI) {
    const { filePaths, canceled } = await window.electronAPI.openFile({
      filters: [
        { name: 'Files', extensions },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    if (canceled || !filePaths || !filePaths.length) return;
    const result = await window.electronAPI.readFile(filePaths[0]);
    if (result.success) callback(result.data);
  } else {
    if (!fallbackInput) return;
    fallbackInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => callback(ev.target.result);
      reader.readAsText(file);
      fallbackInput.value = '';
    };
    fallbackInput.click();
  }
}

/**
 * Open a binary file (e.g. .xlsx for import).
 * @param {string[]}   extensions   - Allowed extensions (e.g. ["xlsx", "xls"])
 * @param {function}   callback     - Called with an ArrayBuffer of the file contents
 * @param {HTMLElement} fallbackInput - <input type="file"> element used in browser mode
 */
async function nativeOpenBinary(extensions, callback, fallbackInput) {
  if (window.electronAPI) {
    const { filePaths, canceled } = await window.electronAPI.openFile({
      filters: [
        { name: 'Files', extensions },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    if (canceled || !filePaths || !filePaths.length) return;
    // readFile returns utf8; for binary we re-read via fetch with file:// protocol
    const response = await fetch('file://' + filePaths[0]);
    const buffer = await response.arrayBuffer();
    callback(buffer);
  } else {
    if (!fallbackInput) return;
    fallbackInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => callback(ev.target.result);
      reader.readAsArrayBuffer(file);
      fallbackInput.value = '';
    };
    fallbackInput.click();
  }
}

/* ── Internal utilities ───────────────────────────────────────────────────── */

function _triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function _blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

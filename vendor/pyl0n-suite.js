/* pyl0n-suite.js — shared SuiteManager for the PYL0N suite
   Central synchronisation utility: manages bidcast_suite_sync (project
   meta, phases, team) and bidcast_logo / bidcast_customer_logo.
   Included in every tool via <script src="vendor/pyl0n-suite.js">.
*/
const SuiteManager = (() => {
  const SYNC_KEY          = 'bidcast_suite_sync';
  const LOGO_KEY          = 'bidcast_logo';
  const CUSTOMER_LOGO_KEY = 'bidcast_customer_logo';
  const BANNER_ID         = 'pyl0n-quota-banner';
  const QUOTA_WARN_BYTES  = 4.5 * 1024 * 1024; // 4.5 MB

  /* ── Storage quota banner ─────────────────────────────────────────────── */

  function checkStorageQuota(error) {
    const isQuotaError = !!error && (
      error.code === 22 ||
      error.code === 1014 ||
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    );

    let total = 0;
    try {
      for (let x in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, x)) {
          total += (localStorage[x].length + x.length) * 2;
        }
      }
    } catch (_e) { /* noop if storage inaccessible */ }

    const nearLimit = total > QUOTA_WARN_BYTES;

    if (!isQuotaError && !nearLimit) return;

    // Don't inject twice
    if (document.getElementById(BANNER_ID)) return;

    const msg = isQuotaError
      ? '⚠️ STORAGE CRITICALLY FULL: Your last change could not be saved! Export your data to JSON immediately to prevent data loss, then clear your browser data.'
      : '⚠️ Storage limit approaching (Over 4.5MB used). Export older projects to JSON and delete them to free up space.';

    const banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'width:100%',
      'background:#c0392b', 'color:#fff', 'text-align:center',
      'padding:10px 44px 10px 12px',
      "font-family:'DM Sans',sans-serif", 'font-size:13px', 'font-weight:600',
      'z-index:9999', 'box-shadow:0 2px 10px rgba(0,0,0,0.2)', 'box-sizing:border-box',
      'line-height:1.4',
    ].join(';');
    banner.textContent = msg;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Dismiss storage warning');
    closeBtn.style.cssText = [
      'position:absolute', 'right:12px', 'top:50%', 'transform:translateY(-50%)',
      'background:none', 'border:none', 'color:#fff', 'font-size:16px',
      'cursor:pointer', 'padding:0 4px', 'line-height:1', 'opacity:0.85',
    ].join(';');
    closeBtn.onmouseover = () => { closeBtn.style.opacity = '1'; };
    closeBtn.onmouseout  = () => { closeBtn.style.opacity = '0.85'; };
    closeBtn.onclick     = () => { banner.remove(); };
    banner.appendChild(closeBtn);

    if (document.body) {
      document.body.insertBefore(banner, document.body.firstChild);
    } else {
      document.addEventListener('DOMContentLoaded', function onReady() {
        document.body.insertBefore(banner, document.body.firstChild);
        document.removeEventListener('DOMContentLoaded', onReady);
      });
    }
  }

  /* ── Suite sync ───────────────────────────────────────────────────────── */

  function read() {
    try { return JSON.parse(localStorage.getItem(SYNC_KEY) || '{}'); }
    catch { return {}; }
  }

  function write(patch, source) {
    try {
      const next = { ...read(), ...patch, _ts: Date.now(), _src: source };
      localStorage.setItem(SYNC_KEY, JSON.stringify(next));
      return next;
    } catch (err) {
      checkStorageQuota(err);
      console.error('SuiteManager.write failed:', err);
      return {};
    }
  }

  /* ── Logo helpers ─────────────────────────────────────────────────────── */

  function getLogo()         { return localStorage.getItem(LOGO_KEY)          || null; }
  function getCustomerLogo() { return localStorage.getItem(CUSTOMER_LOGO_KEY) || null; }

  function setLogo(dataUrl) {
    try {
      localStorage.setItem(LOGO_KEY, dataUrl);
    } catch (err) {
      checkStorageQuota(err);
      console.error('SuiteManager.setLogo failed:', err);
    }
    write({ _logoTs: Date.now() }, 'logo');
  }
  function setCustomerLogo(dataUrl) {
    try {
      localStorage.setItem(CUSTOMER_LOGO_KEY, dataUrl);
    } catch (err) {
      checkStorageQuota(err);
      console.error('SuiteManager.setCustomerLogo failed:', err);
    }
    write({ _logoTs: Date.now() }, 'logo');
  }

  function removeLogo() {
    localStorage.removeItem(LOGO_KEY);
    write({ _logoTs: Date.now() }, 'logo');
  }
  function removeCustomerLogo() {
    localStorage.removeItem(CUSTOMER_LOGO_KEY);
    write({ _logoTs: Date.now() }, 'logo');
  }

  /* ── Cross-tab sync ───────────────────────────────────────────────────── */

  function onUpdate(cb) {
    window.addEventListener('storage', e => {
      if (e.key === SYNC_KEY || e.key === LOGO_KEY || e.key === CUSTOMER_LOGO_KEY) cb(read(), e.key);
    });
  }

  function updateBadge(el) {
    if (!el) return;
    const sync = read();
    if (sync._ts) {
      const s = Math.round((Date.now() - sync._ts) / 1000);
      el.textContent = '↻ Synced ' + (s < 5 ? 'just now' : s < 60 ? s + 's ago' : Math.round(s / 60) + 'm ago');
      el.style.display = 'inline';
    }
  }

  /* ── Cross-tool breadcrumbs ───────────────────────────────────────────── */

  function setReturnPath(url, toolName) {
    write({ returnUrl: url, returnName: toolName }, 'breadcrumb');
  }

  function consumeReturnPath() {
    const sync = read();
    if (!sync.returnUrl) return null;
    const path = { url: sync.returnUrl, name: sync.returnName };
    write({ returnUrl: null, returnName: null }, 'breadcrumb');
    return path;
  }

  /* ── Migration (pyl0n_ → bidcast_) ───────────────────────────────────── */

  function migrate() {
    const toMove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('pyl0n_')) toMove.push(k);
    }
    toMove.forEach(k => {
      const newKey = 'bidcast_' + k.slice('pyl0n_'.length);
      if (!localStorage.getItem(newKey)) localStorage.setItem(newKey, localStorage.getItem(k));
      localStorage.removeItem(k);
    });
  }

  /* ── Proactive quota check on every page load ─────────────────────────── */

  document.addEventListener('DOMContentLoaded', function () {
    checkStorageQuota();
  });

  return {
    read, write,
    getLogo, setLogo, removeLogo,
    getCustomerLogo, setCustomerLogo, removeCustomerLogo,
    onUpdate, updateBadge, migrate,
    checkStorageQuota,
    setReturnPath, consumeReturnPath,
  };
})();

/* ── PWA Service Worker registration + Breadcrumb injection ──────────── */
if ('serviceWorker' in navigator) {
  // When a new SW takes over (skipWaiting → clients.claim), reload once so
  // the page starts fresh under the new SW — eliminates the "refresh twice"
  // problem after a deployment.
  var _swRefreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!_swRefreshing) {
      _swRefreshing = true;
      window.location.reload();
    }
  });

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function (err) {
      console.warn('PYL0N SW registration failed:', err);
    });

    // Inject breadcrumb "Return to …" button if a return path was stored
    const returnPath = SuiteManager.consumeReturnPath();
    if (returnPath && returnPath.url &&
        window.location.pathname.indexOf(returnPath.url) === -1) {
      const tbLeft = document.querySelector('.tb-left');
      if (tbLeft) {
        const btn = document.createElement('button');
        btn.className = 'tb-btn';
        btn.style.color = 'var(--accent)';
        btn.style.borderColor = 'var(--accent)';
        btn.style.fontWeight = '700';
        btn.setAttribute('aria-label', 'Return to ' + returnPath.name);
        btn.innerHTML = '\u2190 Return to ' + returnPath.name;
        btn.onclick = function () { window.location.href = returnPath.url; };
        const sep = tbLeft.querySelector('.tb-sep');
        if (sep && sep.nextSibling) {
          tbLeft.insertBefore(btn, sep.nextSibling);
        } else {
          tbLeft.appendChild(btn);
        }
      }
    }
  });
}

/* ── Global Keyboard Shortcuts Overlay ───────────────────────────────── */
(function () {
  function toggleShortcutModal() {
    var existing = document.getElementById('pyl0n-shortcuts-modal');
    if (existing) { existing.remove(); return; }

    var shortcuts = [
      { keys: ['?'],               desc: 'Toggle this menu' },
      { keys: ['Ctrl', 'S'],       desc: 'Force Snapshot / Save' },
      { keys: ['Ctrl', 'Z'],       desc: 'Undo last action' },
      { keys: ['Ctrl', 'Shift', 'Z'], desc: 'Redo action' },
      { keys: ['Ctrl', 'E'],       desc: 'Export PDF' },
    ];
    if (window.PYL0N_TOOL_SHORTCUTS && Array.isArray(window.PYL0N_TOOL_SHORTCUTS)) {
      shortcuts = shortcuts.concat(window.PYL0N_TOOL_SHORTCUTS);
    }

    var modal = document.createElement('div');
    modal.id = 'pyl0n-shortcuts-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Keyboard Shortcuts');
    modal.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
      'background:rgba(0,0,0,0.6)', 'z-index:10000',
      'display:flex', 'align-items:center', 'justify-content:center',
      'backdrop-filter:blur(3px)',
      "font-family:'DM Sans',sans-serif",
    ].join(';');

    var box = document.createElement('div');
    box.style.cssText = [
      'background:var(--surface,#fff)', 'color:var(--text,#111)',
      'width:400px', 'max-width:90%', 'border-radius:8px',
      'box-shadow:0 10px 30px rgba(0,0,0,0.3)', 'overflow:hidden',
      'border:1px solid var(--border,#ccc)',
    ].join(';');

    var header = document.createElement('div');
    header.style.cssText = [
      'background:var(--accent,#2c4e87)', 'color:#fff',
      'padding:15px 20px', 'font-weight:bold', 'font-size:16px',
      'display:flex', 'justify-content:space-between', 'align-items:center',
    ].join(';');
    var title = document.createElement('span');
    title.textContent = 'Keyboard Shortcuts';
    var closeX = document.createElement('button');
    closeX.textContent = '\u2715';
    closeX.setAttribute('aria-label', 'Close keyboard shortcuts');
    closeX.style.cssText = 'background:none;border:none;color:#fff;font-size:16px;cursor:pointer;opacity:0.8;padding:0;line-height:1;';
    closeX.onmouseover = function () { closeX.style.opacity = '1'; };
    closeX.onmouseout  = function () { closeX.style.opacity = '0.8'; };
    closeX.onclick     = function () { modal.remove(); };
    header.appendChild(title);
    header.appendChild(closeX);

    var body = document.createElement('div');
    body.style.cssText = 'padding:20px;';

    shortcuts.forEach(function (sc, i) {
      var row = document.createElement('div');
      var isLast = i === shortcuts.length - 1;
      row.style.cssText = [
        'display:flex', 'justify-content:space-between', 'align-items:center',
        'padding-bottom:8px',
        isLast ? '' : 'margin-bottom:12px;border-bottom:1px solid var(--border,#eee)',
      ].join(';');

      var descDiv = document.createElement('div');
      descDiv.style.cssText = 'font-size:14px;opacity:0.9;';
      descDiv.textContent = sc.desc;

      var keysDiv = document.createElement('div');
      keysDiv.style.cssText = 'display:flex;gap:4px;flex-shrink:0;margin-left:12px;';
      sc.keys.forEach(function (k) {
        var kbd = document.createElement('kbd');
        kbd.style.cssText = [
          'background:var(--bg,#eee)', 'border:1px solid var(--border,#ccc)',
          'border-radius:4px', 'padding:2px 6px', 'font-size:12px',
          'font-family:monospace', 'box-shadow:0 1px 0 var(--border,#ccc)',
          'color:var(--text,#333)', 'white-space:nowrap',
        ].join(';');
        kbd.textContent = k;
        keysDiv.appendChild(kbd);
      });

      row.appendChild(descDiv);
      row.appendChild(keysDiv);
      body.appendChild(row);
    });

    box.appendChild(header);
    box.appendChild(body);
    modal.appendChild(box);
    modal.onclick = function (e) { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
    closeX.focus();
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
      e.preventDefault();
      toggleShortcutModal();
    }
    if (e.key === 'Escape') {
      var modal = document.getElementById('pyl0n-shortcuts-modal');
      if (modal) modal.remove();
    }
  });
})();

/* ── Global uncaught-error banner ────────────────────────────────────── */
(function () {
  var ERROR_BANNER_ID = 'pyl0n-error-banner';
  var _shown = false;

  function showErrorBanner(msg) {
    if (_shown || document.getElementById(ERROR_BANNER_ID)) return;
    _shown = true;
    var banner = document.createElement('div');
    banner.id = ERROR_BANNER_ID;
    banner.setAttribute('role', 'alert');
    banner.style.cssText = [
      'position:fixed', 'bottom:16px', 'left:50%', 'transform:translateX(-50%)',
      'background:#7f1d1d', 'color:#fef2f2', 'padding:10px 44px 10px 16px',
      "font-family:'DM Sans',sans-serif", 'font-size:12px', 'font-weight:600',
      'z-index:9998', 'border-radius:6px', 'box-shadow:0 4px 12px rgba(0,0,0,0.3)',
      'max-width:540px', 'text-align:left', 'line-height:1.4',
    ].join(';');
    var label = document.createElement('span');
    label.textContent = '\u26a0\ufe0f Script error: ' + (msg || 'Unknown error') + ' \u2014 Try reloading. If it persists, export your data and clear local storage.';
    var closeBtn = document.createElement('button');
    closeBtn.textContent = '\u2715';
    closeBtn.setAttribute('aria-label', 'Dismiss error');
    closeBtn.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:#fef2f2;font-size:14px;cursor:pointer;padding:0;line-height:1;';
    closeBtn.onclick = function () { banner.remove(); _shown = false; };
    banner.appendChild(label);
    banner.appendChild(closeBtn);
    var append = function () { document.body.appendChild(banner); };
    if (document.body) { append(); }
    else { document.addEventListener('DOMContentLoaded', append); }
    setTimeout(function () { if (banner.parentNode) banner.remove(); _shown = false; }, 15000);
  }

  window.addEventListener('error', function (e) {
    // Ignore cross-origin script errors (no useful message)
    if (e.message === 'Script error.' && !e.filename) return;
    showErrorBanner(e.message);
  });
  window.addEventListener('unhandledrejection', function (e) {
    var msg = e.reason && e.reason.message ? e.reason.message : String(e.reason || 'Unhandled promise rejection');
    showErrorBanner(msg);
  });
})();

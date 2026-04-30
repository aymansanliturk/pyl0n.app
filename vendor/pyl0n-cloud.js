/* pyl0n-cloud.js — Microsoft OneDrive cloud sync for the PYL0N suite
   Requires msal-browser.min.js loaded before this script.
   Placeholder credentials: replace YOUR_CLIENT_ID and YOUR_TENANT_ID with real
   Azure app registration details before enabling cloud sync.
*/
const PylonCloud = (() => {
  const CLIENT_ID = 'YOUR_CLIENT_ID';
  const TENANT_ID = 'YOUR_TENANT_ID';

  const GRAPH_FILES = 'https://graph.microsoft.com/v1.0/me/drive/root:/PYL0N/';

  const SCOPES = ['Files.ReadWrite', 'User.Read'];

  let _msalApp = null;
  let _account  = null;

  /* ── Status indicator ──────────────────────────────────────────────────── */

  function _setStatus(text, color) {
    const el = document.getElementById('pyl0n-cloud-btn');
    if (!el) return;
    el.setAttribute('data-status', text);
    el.style.borderColor = color || '';
    el.style.color       = color || '';
  }

  /* ── Credential guard ──────────────────────────────────────────────────── */

  function _credentialsReady() {
    return CLIENT_ID !== 'YOUR_CLIENT_ID' && TENANT_ID !== 'YOUR_TENANT_ID';
  }

  /* ── MSAL initialisation ───────────────────────────────────────────────── */

  function _init() {
    if (_msalApp) return _msalApp;
    if (!window.msal) return null;
    _msalApp = new window.msal.PublicClientApplication({
      auth: {
        clientId:   CLIENT_ID,
        authority:  'https://login.microsoftonline.com/' + TENANT_ID,
        redirectUri: window.location.origin + window.location.pathname,
      },
      cache: { cacheLocation: 'localStorage', storeAuthStateInCookie: false },
    });
    return _msalApp;
  }

  /* ── Token acquisition ─────────────────────────────────────────────────── */

  async function _getToken() {
    const app = _init();
    if (!app) throw new Error('MSAL not loaded');

    await app.handleRedirectPromise().catch(() => {});

    const accounts = app.getAllAccounts();
    if (accounts.length) _account = accounts[0];

    const req = { scopes: SCOPES, account: _account || undefined };

    try {
      const res = await app.acquireTokenSilent(req);
      _account = res.account;
      return res.accessToken;
    } catch (_e) {
      const res = await app.acquireTokenPopup(req);
      _account = res.account;
      return res.accessToken;
    }
  }

  /* ── OneDrive upload ───────────────────────────────────────────────────── */

  async function _upload(filename, content, token) {
    const url = GRAPH_FILES + encodeURIComponent(filename) + ':/content';
    const blob = new Blob([content], { type: 'application/json' });
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: blob,
    });
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error('Upload failed (' + res.status + '): ' + err);
    }
    return res.json();
  }

  /* ── Public API ────────────────────────────────────────────────────────── */

  async function saveToCloud(filename, content) {
    if (!_credentialsReady()) {
      alert(
        'PYL0N Cloud Sync is not yet configured.\n\n' +
        'Azure app registration credentials have not been configured yet.\n' +
        'Contact your administrator to enable OneDrive sync.'
      );
      return;
    }

    _setStatus('Connecting…', 'var(--accent)');
    try {
      const token = await _getToken();
      _setStatus('Uploading…', 'var(--accent)');
      await _upload(filename, content, token);
      _setStatus('Saved ✓', 'var(--green,#107c41)');
      setTimeout(() => _setStatus('Cloud Sync', ''), 3000);
    } catch (err) {
      console.error('PylonCloud.saveToCloud:', err);
      _setStatus('Failed ✗', '#c0392b');
      setTimeout(() => _setStatus('Cloud Sync', ''), 4000);
      alert('Cloud sync failed: ' + err.message);
    }
  }

  return { saveToCloud };
})();

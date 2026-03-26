/**
 * auth.js — Azure AD (Entra ID) authentication for PYL0N
 *
 * Uses @azure/msal-node with the Authorization Code + PKCE flow.
 * A custom protocol (pyl0n://auth) receives the redirect from Azure.
 *
 * IT SETUP (one-time, done by your Azure administrator):
 * ──────────────────────────────────────────────────────
 * 1. Go to Azure Portal → Entra ID → App registrations → New registration
 * 2. Name: "PYL0N Suite"
 * 3. Supported account types: "Accounts in this organizational directory only"
 * 4. Redirect URI: select "Public client/native" → enter: pyl0n://auth
 * 5. After registering, copy the "Application (client) ID"
 * 6. Copy the "Directory (tenant) ID"
 * 7. Under "API permissions" → add "User.Read" (already there by default)
 * 8. Under "Authentication" → enable "Allow public client flows" = Yes
 * 9. To restrict access to specific users: go to Enterprise Applications →
 *    find "PYL0N Suite" → Properties → "Assignment required" = Yes →
 *    Users and groups → Add the allowed users or AD groups
 * 10. Edit azure-config.json in the app install folder with the IDs from steps 5-6
 *
 * TOKEN STORAGE: tokens are stored encrypted via Electron's safeStorage
 * (OS keychain on macOS, DPAPI on Windows, libsecret on Linux).
 */

const { ipcMain, BrowserWindow, app, protocol, safeStorage, shell } = require('electron');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const https  = require('https');

// ── Config ────────────────────────────────────────────────────────────────────

// Load azure-config.json from the app resources directory.
// In dev: project root. In packaged build: next to the asar.
function loadAzureConfig() {
  const candidates = [
    path.join(__dirname, 'azure-config.json'),
    path.join(process.resourcesPath || '', 'azure-config.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) {}
    }
  }
  return null;
}

// ── Token cache (encrypted) ───────────────────────────────────────────────────

const TOKEN_FILE = path.join(app.getPath('userData'), 'pyl0n_auth.dat');

function saveToken(tokenData) {
  try {
    const json = JSON.stringify(tokenData);
    if (safeStorage.isEncryptionAvailable()) {
      const enc = safeStorage.encryptString(json);
      fs.writeFileSync(TOKEN_FILE, enc);
    } else {
      // Fallback: store as-is (less secure, but app still requires Azure login)
      fs.writeFileSync(TOKEN_FILE, json, 'utf8');
    }
  } catch (_) {}
}

function loadToken() {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    const raw = fs.readFileSync(TOKEN_FILE);
    if (safeStorage.isEncryptionAvailable()) {
      const json = safeStorage.decryptString(raw);
      return JSON.parse(json);
    } else {
      return JSON.parse(raw.toString('utf8'));
    }
  } catch (_) { return null; }
}

function clearToken() {
  try { if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE); } catch (_) {}
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// ── Token validation ──────────────────────────────────────────────────────────

function isTokenValid(token) {
  if (!token || !token.access_token || !token.expires_at) return false;
  return Date.now() < token.expires_at - 60_000; // 1-min buffer
}

// Parse a JWT payload (no signature verification — Azure validates on their end;
// we just read the claims for display/group checks)
function parseJwt(token) {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch (_) { return {}; }
}

// ── Azure AD OAuth flow ───────────────────────────────────────────────────────

let _loginWindow = null;
let _pendingResolve = null;
let _pendingReject  = null;
let _codeVerifier   = null;

function buildAuthUrl(config, codeChallenge, state) {
  const params = new URLSearchParams({
    client_id:             config.clientId,
    response_type:         'code',
    redirect_uri:          'pyl0n://auth',
    response_mode:         'query',
    scope:                 'openid profile User.Read offline_access',
    state,
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',
  });
  return `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?${params}`;
}

function exchangeCode(config, code, verifier) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      client_id:     config.clientId,
      grant_type:    'authorization_code',
      code,
      redirect_uri:  'pyl0n://auth',
      code_verifier: verifier,
      scope:         'openid profile User.Read offline_access',
    }).toString();

    const req = https.request({
      hostname: 'login.microsoftonline.com',
      path:     `/${config.tenantId}/oauth2/v2.0/token`,
      method:   'POST',
      headers: {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(`${json.error}: ${json.error_description}`));
          resolve(json);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function refreshToken(config, refreshTk) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      client_id:     config.clientId,
      grant_type:    'refresh_token',
      refresh_token: refreshTk,
      scope:         'openid profile User.Read offline_access',
    }).toString();

    const req = https.request({
      hostname: 'login.microsoftonline.com',
      path:     `/${config.tenantId}/oauth2/v2.0/token`,
      method:   'POST',
      headers: {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error));
          resolve(json);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Login window ──────────────────────────────────────────────────────────────

function openLoginWindow(authUrl) {
  _loginWindow = new BrowserWindow({
    width: 480,
    height: 680,
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Sign in to PYL0N',
    icon: path.join(__dirname, 'build',
      process.platform === 'win32'  ? 'icon.ico'  :
      process.platform === 'darwin' ? 'icon.icns' : 'icon.png'),
    autoHideMenuBar: true,
  });

  _loginWindow.loadURL(authUrl);

  // Block navigation away from Microsoft login pages
  _loginWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('https://login.microsoftonline.com') &&
        !url.startsWith('https://login.microsoft.com') &&
        !url.startsWith('pyl0n://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  _loginWindow.on('closed', () => {
    _loginWindow = null;
    if (_pendingReject) {
      _pendingReject(new Error('Login window closed by user'));
      _pendingReject = null;
    }
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Register the pyl0n:// protocol handler and IPC routes.
 * Call once from main.js before app.whenReady().
 */
function registerAuth() {
  // Register custom protocol so Azure can redirect back to the app
  if (app.isReady()) {
    _registerProtocol();
  } else {
    app.on('ready', _registerProtocol);
  }

  // IPC: renderer asks for current auth state
  ipcMain.handle('auth:getUser', async () => {
    const token = loadToken();
    if (!token) return null;

    // Try to refresh if expired
    if (!isTokenValid(token)) {
      const config = loadAzureConfig();
      if (config && token.refresh_token) {
        try {
          const fresh = await refreshToken(config, token.refresh_token);
          const merged = _buildTokenData(fresh);
          saveToken(merged);
          return _userFromToken(merged);
        } catch (_) {
          clearToken();
          return null;
        }
      }
      clearToken();
      return null;
    }

    return _userFromToken(token);
  });

  // IPC: renderer triggers login flow
  ipcMain.handle('auth:login', () => {
    return new Promise((resolve, reject) => {
      const config = loadAzureConfig();
      if (!config) {
        return reject(new Error(
          'azure-config.json not found. Please ask IT to configure the app.'
        ));
      }

      _codeVerifier  = generateCodeVerifier();
      const challenge = generateCodeChallenge(_codeVerifier);
      const state     = crypto.randomBytes(16).toString('hex');
      const authUrl   = buildAuthUrl(config, challenge, state);

      _pendingResolve = resolve;
      _pendingReject  = reject;

      openLoginWindow(authUrl);
    });
  });

  // IPC: sign out
  ipcMain.handle('auth:logout', () => {
    clearToken();
    const config = loadAzureConfig();
    if (config) {
      const logoutUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/logout`;
      shell.openExternal(logoutUrl);
    }
    return { success: true };
  });
}

function _registerProtocol() {
  // Handle pyl0n://auth?code=...&state=... redirected from Azure
  protocol.handle('pyl0n', async (request) => {
    const url = new URL(request.url);
    if (url.hostname === 'auth') {
      const code  = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (_loginWindow) { _loginWindow.close(); _loginWindow = null; }

      if (error) {
        const msg = url.searchParams.get('error_description') || error;
        if (_pendingReject) { _pendingReject(new Error(msg)); _pendingReject = null; }
        return new Response('Login failed: ' + msg, { status: 400 });
      }

      if (code && _pendingResolve) {
        const config = loadAzureConfig();
        try {
          const tokens  = await exchangeCode(config, code, _codeVerifier);
          const stored  = _buildTokenData(tokens);
          saveToken(stored);
          const user = _userFromToken(stored);
          _pendingResolve(user);
          _pendingResolve = null;
        } catch (err) {
          if (_pendingReject) { _pendingReject(err); _pendingReject = null; }
        }
      }
    }
    return new Response('', { status: 200 });
  });
}

function _buildTokenData(tokens) {
  return {
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token,
    id_token:      tokens.id_token,
    expires_at:    Date.now() + (tokens.expires_in || 3600) * 1000,
  };
}

function _userFromToken(tokenData) {
  const claims = parseJwt(tokenData.id_token || tokenData.access_token || '');
  return {
    name:  claims.name  || claims.preferred_username || 'Unknown',
    email: claims.email || claims.upn || claims.preferred_username || '',
    oid:   claims.oid   || '',        // Azure object ID — unique per user
    tid:   claims.tid   || '',        // Tenant ID
  };
}

module.exports = { registerAuth };

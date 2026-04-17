/* pyl0n-suite.js — shared SuiteManager for the PYL0N suite
   Central synchronisation utility: manages bidcast_suite_sync (project
   meta, phases, team) and bidcast_logo / bidcast_customer_logo.
   Included in every tool via <script src="vendor/pyl0n-suite.js">.
*/
const SuiteManager = (() => {
  const SYNC_KEY          = 'bidcast_suite_sync';
  const LOGO_KEY          = 'bidcast_logo';
  const CUSTOMER_LOGO_KEY = 'bidcast_customer_logo';

  function read() {
    try { return JSON.parse(localStorage.getItem(SYNC_KEY) || '{}'); }
    catch { return {}; }
  }

  function write(patch, source) {
    try {
      const next = { ...read(), ...patch, _ts: Date.now(), _src: source };
      localStorage.setItem(SYNC_KEY, JSON.stringify(next));
      return next;
    } catch { return {}; }
  }

  function getLogo()         { return localStorage.getItem(LOGO_KEY)          || null; }
  function getCustomerLogo() { return localStorage.getItem(CUSTOMER_LOGO_KEY) || null; }

  function setLogo(dataUrl) {
    localStorage.setItem(LOGO_KEY, dataUrl);
    write({ _logoTs: Date.now() }, 'logo');
  }
  function setCustomerLogo(dataUrl) {
    localStorage.setItem(CUSTOMER_LOGO_KEY, dataUrl);
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

  return {
    read, write,
    getLogo, setLogo, removeLogo,
    getCustomerLogo, setCustomerLogo, removeCustomerLogo,
    onUpdate, updateBadge, migrate,
  };
})();

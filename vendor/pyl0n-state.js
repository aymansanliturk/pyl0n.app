/**
 * vendor/pyl0n-state.js
 * Shared state helpers for the PYL0N suite.
 *
 * Each tool currently re-implements:
 *   - an undo/redo stack with debounced snapshots
 *   - a timestamped backup ring buffer kept in localStorage
 *   - ad-hoc localStorage reads/writes without quota handling
 *
 * This module exposes a single `PylonState` global with reusable helpers so
 * tools can adopt them incrementally. No tool is required to use this file;
 * it is loaded via <script src="vendor/pyl0n-state.js"> in each tool's <head>
 * alongside pyl0n-native.js and must not depend on any tool-specific globals.
 *
 * Adoption is opt-in per tool. See pyl0n-native.js for the precedent pattern.
 */

(function (global) {
  'use strict';

  /* ── Safe localStorage ─────────────────────────────────────────────────── */

  /**
   * Write a value to localStorage with quota awareness.
   * Value is JSON.stringify'd unless it is already a string.
   *
   * @param {string} key
   * @param {*} value
   * @returns {{ok: boolean, error?: Error, quotaExceeded?: boolean}}
   */
  function safeWriteLS(key, value) {
    try {
      const payload = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, payload);
      return { ok: true };
    } catch (err) {
      const quotaExceeded = !!err && (
        err.code === 22 ||
        err.code === 1014 ||
        err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      );
      return { ok: false, error: err, quotaExceeded };
    }
  }

  /**
   * Read and JSON.parse a localStorage key, with a fallback on miss or error.
   * Returns the raw string if it is not valid JSON.
   *
   * @param {string} key
   * @param {*} [fallback=null]
   * @returns {*}
   */
  function safeReadLS(key, fallback) {
    if (fallback === undefined) fallback = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      try { return JSON.parse(raw); } catch (_e) { return raw; }
    } catch (_e) {
      return fallback;
    }
  }

  /**
   * Best-effort estimate of current localStorage usage in bytes (UTF-16).
   * Useful for showing the user a warning before they hit the ~5–10 MB quota.
   *
   * @returns {number} Approximate bytes used.
   */
  function estimateLSSize() {
    let total = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const v = localStorage.getItem(k) || '';
        total += ((k && k.length) || 0) * 2 + v.length * 2;
      }
    } catch (_e) { /* noop */ }
    return total;
  }

  /* ── Undo / Redo stack ─────────────────────────────────────────────────── */

  /**
   * Create a debounced undo/redo stack wired to a tool's collect/apply pair.
   *
   * Usage:
   *   const undoStack = PylonState.createUndoStack({
   *     collect:  collectState,
   *     apply:    applyState,
   *     onChange: syncUndoUI,
   *   });
   *   input.addEventListener('input', () => undoStack.scheduleSnap());
   *   btnUndo.onclick = () => undoStack.undo();
   *   btnRedo.onclick = () => undoStack.redo();
   *
   * @param {object}   cfg
   * @param {Function} cfg.collect      Returns the current state object.
   * @param {Function} cfg.apply        Applies a prior state object.
   * @param {number}   [cfg.max=50]     Max entries retained.
   * @param {number}   [cfg.debounceMs=400]
   * @param {Function} [cfg.onChange]   Called after snapshot / undo / redo.
   * @returns {{
   *   snapshot: Function,
   *   scheduleSnap: Function,
   *   undo: Function,
   *   redo: Function,
   *   reset: Function,
   *   canUndo: boolean,
   *   canRedo: boolean,
   *   size: number
   * }}
   */
  function createUndoStack(cfg) {
    cfg = cfg || {};
    const collect    = cfg.collect;
    const apply      = cfg.apply;
    const max        = cfg.max || 50;
    const debounceMs = cfg.debounceMs != null ? cfg.debounceMs : 400;
    const onChange   = cfg.onChange;

    if (typeof collect !== 'function' || typeof apply !== 'function') {
      throw new Error('PylonState.createUndoStack: collect/apply required');
    }

    let history = [];
    let idx     = -1;
    let timer   = null;

    function _fire() { if (typeof onChange === 'function') onChange(); }

    function snapshot() {
      if (timer) { clearTimeout(timer); timer = null; }
      let serialized;
      try { serialized = JSON.stringify(collect()); }
      catch (_e) { return; }
      if (history[idx] === serialized) return;
      history = history.slice(0, idx + 1);
      history.push(serialized);
      while (history.length > max) history.shift();
      idx = history.length - 1;
      _fire();
    }

    function scheduleSnap() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(snapshot, debounceMs);
    }

    function undo() {
      if (idx <= 0) return false;
      idx--;
      try { apply(JSON.parse(history[idx])); } catch (_e) {}
      _fire();
      return true;
    }

    function redo() {
      if (idx >= history.length - 1) return false;
      idx++;
      try { apply(JSON.parse(history[idx])); } catch (_e) {}
      _fire();
      return true;
    }

    function reset() {
      history = [];
      idx = -1;
      if (timer) { clearTimeout(timer); timer = null; }
    }

    return {
      snapshot: snapshot,
      scheduleSnap: scheduleSnap,
      undo: undo,
      redo: redo,
      reset: reset,
      get canUndo() { return idx > 0; },
      get canRedo() { return idx < history.length - 1; },
      get size()    { return history.length; },
    };
  }

  /* ── Timestamped backup ring buffer ────────────────────────────────────── */

  /**
   * Create a backup ring buffer backed by localStorage.
   * Each entry is `{ ts: ISOString, state: <any JSON-serialisable> }`.
   *
   * Usage:
   *   const backups = PylonState.createBackupRing({ key: 'bidcast_backups_cvcast' });
   *   backups.write(collectState());
   *   const entries = backups.list();          // [{ ts, state }, …] newest last
   *   applyState(backups.restore(entries.length - 1).state);
   *
   * @param {object} cfg
   * @param {string} cfg.key         localStorage key for the ring.
   * @param {number} [cfg.max=5]     Max retained snapshots.
   * @returns {{
   *   write: Function,
   *   list:  Function,
   *   restore: Function,
   *   clear: Function
   * }}
   */
  function createBackupRing(cfg) {
    cfg = cfg || {};
    const key = cfg.key;
    const max = cfg.max || 5;
    if (!key) throw new Error('PylonState.createBackupRing: key required');

    function _load() {
      const val = safeReadLS(key, []);
      return Array.isArray(val) ? val : [];
    }

    function write(state) {
      const entries = _load();
      entries.push({ ts: new Date().toISOString(), state: state });
      while (entries.length > max) entries.shift();
      return safeWriteLS(key, entries);
    }

    function list() {
      return _load();
    }

    function restore(idx) {
      const entries = _load();
      return entries[idx] || null;
    }

    function clear() {
      return safeWriteLS(key, []);
    }

    return { write: write, list: list, restore: restore, clear: clear };
  }

  /* ── Export ─────────────────────────────────────────────────────────────── */

  global.PylonState = {
    safeWriteLS: safeWriteLS,
    safeReadLS: safeReadLS,
    estimateLSSize: estimateLSSize,
    createUndoStack: createUndoStack,
    createBackupRing: createBackupRing,
  };
})(typeof window !== 'undefined' ? window : this);

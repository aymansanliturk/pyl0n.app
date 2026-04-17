/**
 * vendor/pyl0n-validate.js
 * Shared input validators for the PYL0N suite.
 *
 * Tools currently accept nonsense input without feedback:
 *   - TimeCast will draw a bar for endDate < startDate
 *   - RiskCast will compute scores outside its 5x5 matrix
 *   - CalcCast will total negative quantities silently
 *
 * This module exposes a `PylonValidate` global with small pure validator
 * functions plus one UI helper for showing/clearing inline field errors.
 * Each validator returns `{ok: boolean, message?: string}`. Tools can
 * compose these at `collectState()` time or bind them to `input`/`blur`.
 *
 * Adoption is opt-in per tool. Load via <script src="vendor/pyl0n-validate.js">
 * before any tool-specific script. No dependencies on tool globals.
 */

(function (global) {
  'use strict';

  /* ── Primitive validators ──────────────────────────────────────────────── */

  /** Not null, not undefined, not empty string (after trim). */
  function required(value, label) {
    label = label || 'Value';
    const empty = value == null || (typeof value === 'string' && value.trim() === '');
    return empty
      ? { ok: false, message: label + ' is required' }
      : { ok: true };
  }

  /** Finite number within [min, max] inclusive. */
  function numRange(value, min, max, label) {
    label = label || 'Value';
    const n = typeof value === 'number' ? value : parseFloat(value);
    if (!isFinite(n)) return { ok: false, message: label + ' must be a number' };
    if (min != null && n < min) return { ok: false, message: label + ' must be ≥ ' + min };
    if (max != null && n > max) return { ok: false, message: label + ' must be ≤ ' + max };
    return { ok: true };
  }

  /** Strictly positive number (> 0). */
  function positive(value, label) {
    label = label || 'Value';
    const n = typeof value === 'number' ? value : parseFloat(value);
    if (!isFinite(n)) return { ok: false, message: label + ' must be a number' };
    if (n <= 0) return { ok: false, message: label + ' must be greater than 0' };
    return { ok: true };
  }

  /** Non-negative number (>= 0). */
  function nonNegative(value, label) {
    label = label || 'Value';
    const n = typeof value === 'number' ? value : parseFloat(value);
    if (!isFinite(n)) return { ok: false, message: label + ' must be a number' };
    if (n < 0) return { ok: false, message: label + ' cannot be negative' };
    return { ok: true };
  }

  /** Integer in [min, max]. */
  function intRange(value, min, max, label) {
    label = label || 'Value';
    const n = typeof value === 'number' ? value : parseInt(value, 10);
    if (!Number.isInteger(n)) return { ok: false, message: label + ' must be a whole number' };
    if (min != null && n < min) return { ok: false, message: label + ' must be ≥ ' + min };
    if (max != null && n > max) return { ok: false, message: label + ' must be ≤ ' + max };
    return { ok: true };
  }

  /**
   * Check that endY/endM is at or after startY/startM.
   * Accepts either (startY, startM, endY, endM) — all numbers, month 0-indexed or 1-indexed,
   * as long as both dates use the same convention.
   */
  function monthRange(startY, startM, endY, endM, label) {
    label = label || 'Date range';
    const s = +startY * 12 + +startM;
    const e = +endY   * 12 + +endM;
    if (!isFinite(s) || !isFinite(e)) return { ok: false, message: label + ' has invalid dates' };
    if (e < s) return { ok: false, message: 'End date must be on or after start date' };
    return { ok: true };
  }

  /**
   * Check that a second ISO-8601 date string (YYYY-MM-DD) is at or after the first.
   * Returns {ok:true} when either input is empty (treat as unfilled, not invalid).
   */
  function dateRange(startStr, endStr, label) {
    label = label || 'Date range';
    if (!startStr || !endStr) return { ok: true };
    const s = Date.parse(startStr);
    const e = Date.parse(endStr);
    if (isNaN(s) || isNaN(e)) return { ok: false, message: label + ' has an invalid date' };
    if (e < s) return { ok: false, message: 'End date must be on or after start date' };
    return { ok: true };
  }

  /** Simple email sanity check (not RFC-strict, just helpful). */
  function email(value, label) {
    label = label || 'Email';
    if (value == null || value === '') return { ok: true };
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(value))
      ? { ok: true }
      : { ok: false, message: label + ' is not a valid email address' };
  }

  /* ── Composition ───────────────────────────────────────────────────────── */

  /**
   * Run many validators; return first failure, or {ok:true} if all pass.
   * Pass an array of pre-bound results, e.g.:
   *   PylonValidate.all([ required(x, 'Name'), numRange(y, 0, 100, 'Pct') ])
   */
  function all(results) {
    for (let i = 0; i < results.length; i++) {
      if (results[i] && results[i].ok === false) return results[i];
    }
    return { ok: true };
  }

  /* ── UI helpers ────────────────────────────────────────────────────────── */

  const ERR_CLASS = 'pyl-invalid';
  const MSG_CLASS = 'pyl-err-msg';

  /**
   * Mark an input (or any element) as invalid with an inline message below it.
   * Calling with `ok=true` removes the invalid state and message.
   *
   * Uses a minimal inline style so no CSS changes are required in the tool.
   * Tools that want custom styling can override `.pyl-invalid` / `.pyl-err-msg`.
   *
   * @param {HTMLElement} el
   * @param {boolean|{ok:boolean,message?:string}} result
   * @param {string} [message]
   */
  function markField(el, result, message) {
    if (!el) return;
    const ok = typeof result === 'boolean' ? result : !!(result && result.ok);
    const msg = typeof result === 'object' && result ? result.message : message;
    _ensureStyle();
    if (ok) {
      el.classList.remove(ERR_CLASS);
      const sib = el.nextElementSibling;
      if (sib && sib.classList && sib.classList.contains(MSG_CLASS)) sib.remove();
    } else {
      el.classList.add(ERR_CLASS);
      let sib = el.nextElementSibling;
      if (!sib || !sib.classList || !sib.classList.contains(MSG_CLASS)) {
        sib = document.createElement('div');
        sib.className = MSG_CLASS;
        el.parentNode && el.parentNode.insertBefore(sib, el.nextSibling);
      }
      sib.textContent = msg || 'Invalid';
    }
  }

  /** Clear all validator error UI inside a container (or whole document). */
  function clearErrors(container) {
    const root = container || document;
    root.querySelectorAll('.' + ERR_CLASS).forEach(function (el) {
      el.classList.remove(ERR_CLASS);
    });
    root.querySelectorAll('.' + MSG_CLASS).forEach(function (el) {
      el.remove();
    });
  }

  let _styleInjected = false;
  function _ensureStyle() {
    if (_styleInjected || typeof document === 'undefined') return;
    _styleInjected = true;
    const s = document.createElement('style');
    s.setAttribute('data-pyl-validate', '');
    s.textContent =
      '.' + ERR_CLASS + '{outline:1.5px solid #c0392b !important;outline-offset:-1px;background:#fff5f5 !important;}' +
      '.' + MSG_CLASS + '{color:#c0392b;font-size:11px;font-family:inherit;margin-top:2px;line-height:1.3;}';
    (document.head || document.documentElement).appendChild(s);
  }

  /* ── Export ─────────────────────────────────────────────────────────────── */

  global.PylonValidate = {
    required:    required,
    numRange:    numRange,
    positive:    positive,
    nonNegative: nonNegative,
    intRange:    intRange,
    monthRange:  monthRange,
    dateRange:   dateRange,
    email:       email,
    all:         all,
    markField:   markField,
    clearErrors: clearErrors,
  };
})(typeof window !== 'undefined' ? window : this);

// storage.js — single persistence adapter behind localStorage.
// Swapping to sessionStorage is a one-line change (BACKEND below).
const BACKEND = window.localStorage;
const KEY = 'stellin.v1';
export const SCHEMA_VERSION = 1;

export function load() {
  try {
    const raw = BACKEND.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      console.warn(`[stellin] schema mismatch (found ${parsed.schemaVersion}, expected ${SCHEMA_VERSION}); wiping.`);
      BACKEND.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch (e) {
    console.warn('[stellin] failed to load state; wiping.', e);
    BACKEND.removeItem(KEY);
    return null;
  }
}

export function save(payload) {
  try {
    BACKEND.setItem(KEY, JSON.stringify({ ...payload, schemaVersion: SCHEMA_VERSION }));
  } catch (e) {
    // QuotaExceeded most likely
    console.warn('[stellin] save failed (storage full?).', e);
    throw e;
  }
}

export function wipe() {
  BACKEND.removeItem(KEY);
}

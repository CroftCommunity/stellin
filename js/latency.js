// latency.js — fake-async wrapper honoring dev-bar latency and fail-next.
// Every action routes through run() so skeletons and optimistic UI render.
import { getDevPrefs, setDevPref } from './store.js';

export function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// run(work) resolves after the configured latency, or rejects once if
// "fail next" is armed (one-shot).
export async function run(work) {
  const prefs = getDevPrefs();
  const ms = prefs.latency || 0;
  if (ms) await delay(ms);
  if (prefs.failNext) {
    setDevPref('failNext', false); // one-shot
    throw new Error('Simulated failure (Fail next action was armed).');
  }
  return typeof work === 'function' ? work() : work;
}

export function currentLatency() { return getDevPrefs().latency || 0; }

// router.js — hash router with scroll restoration, focus management, titles.
const routes = [];
let notFound = null;
let currentCleanup = null;
const scrollPositions = new Map();

export function register(pattern, handler, title) {
  // pattern like '#/in/:slug' -> regex with named groups
  const keys = [];
  const rx = new RegExp('^' + pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/:([A-Za-z]+)/g, (_, k) => { keys.push(k); return '([^/?]+)'; }) + '(?:\\?(.*))?$');
  routes.push({ rx, keys, handler, title });
}
export function setNotFound(handler) { notFound = handler; }

export function navigate(hash) {
  if (location.hash === hash) { render(); }
  else location.hash = hash;
}

export function currentHash() { return location.hash || '#/'; }

function parseQuery(qs) {
  const out = {};
  if (!qs) return out;
  for (const part of qs.split('&')) {
    const [k, v] = part.split('=');
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }
  return out;
}

let outlet = null;
export function mount(el) { outlet = el; }

async function render() {
  const hash = location.hash || '#/';
  // save scroll for previous
  const prev = render._current;
  if (prev) scrollPositions.set(prev, window.scrollY);

  for (const r of routes) {
    const m = hash.match(r.rx);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      const query = parseQuery(m[m.length - 1]);
      if (currentCleanup) { try { currentCleanup(); } catch (e) {} currentCleanup = null; }
      outlet.innerHTML = '';
      const ctx = { params, query, hash };
      const result = await r.handler(outlet, ctx);
      if (typeof result === 'function') currentCleanup = result;
      document.title = (typeof r.title === 'function' ? r.title(ctx) : r.title) || 'Stellin';
      render._current = hash;
      finishNav(hash);
      return;
    }
  }
  if (notFound) { outlet.innerHTML = ''; notFound(outlet); }
}

function finishNav(hash) {
  // restore or reset scroll
  const y = scrollPositions.get(hash);
  window.scrollTo(0, y || 0);
  // move focus to the new screen's h1
  const h1 = outlet.querySelector('h1');
  if (h1) {
    h1.setAttribute('tabindex', '-1');
    h1.focus({ preventScroll: true });
  }
  window.dispatchEvent(new CustomEvent('stellin:navigated', { detail: { hash } }));
}

export function start() {
  window.addEventListener('hashchange', render);
  render();
}
export function rerender() { render(); }

// toast.js — one aria-live region for all transient messages.
let region;
function ensureRegion() {
  if (region) return region;
  region = document.getElementById('toast-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'false');
    document.body.appendChild(region);
  }
  return region;
}

// toast(message, {type, action:{label,onClick}, duration})
export function toast(message, opts = {}) {
  const r = ensureRegion();
  const el = document.createElement('div');
  el.className = 'toast' + (opts.type ? ` toast-${opts.type}` : '');
  el.setAttribute('role', opts.type === 'danger' ? 'alert' : 'status');
  const span = document.createElement('span');
  span.className = 'grow';
  span.textContent = message;
  el.appendChild(span);
  if (opts.action) {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.textContent = opts.action.label;
    btn.addEventListener('click', () => { opts.action.onClick(); dismiss(); });
    el.appendChild(btn);
  }
  r.appendChild(el);
  const dur = opts.duration ?? (opts.action ? 6000 : 3500);
  const timer = setTimeout(dismiss, dur);
  function dismiss() { clearTimeout(timer); el.remove(); }
  return dismiss;
}

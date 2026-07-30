// dom.js — tiny element helpers so screens read declaratively.
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}
export function h1(text) { return el('h1', { tabindex: '-1' }, [text]); }
export function frag(children) { const f = document.createDocumentFragment(); [].concat(children).forEach(c => c && f.appendChild(c)); return f; }
export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

// state blocks
export function emptyState(icon, title, message, action) {
  return el('div', { class: 'state-block' }, [
    el('div', { class: 'state-icon', 'aria-hidden': 'true' }, [icon]),
    el('h3', {}, [title]),
    el('p', {}, [message]),
    action || false,
  ]);
}
export function errorState(retry) {
  return el('div', { class: 'state-block' }, [
    el('div', { class: 'state-icon', 'aria-hidden': 'true' }, ['⚠']),
    el('h3', {}, ['Something went wrong']),
    el('p', {}, ['That action could not be completed. Check your connection and try again.']),
    retry ? el('button', { class: 'btn btn-outline', onclick: retry }, ['Try again']) : false,
  ]);
}

// relative time
export function timeAgo(t, now = Date.now()) {
  const s = Math.max(1, Math.floor((now - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7); if (w < 5) return `${w}w`;
  const mo = Math.floor(d / 30); if (mo < 12) return `${mo}mo`;
  return `${Math.floor(d / 365)}y`;
}

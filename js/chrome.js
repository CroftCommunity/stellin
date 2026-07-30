// chrome.js — top navigation and mobile bottom tab bar.
import { sel, getDevPrefs } from './store.js';
import { me } from './actions.js';
import { unreadCount } from './engines/notify.js';
import { search } from './engines/search.js';
import { avatar } from './ui/avatar.js';
import { navigate, currentHash } from './router.js';

const NAV = [
  { key: 'feed', label: 'Home', hash: '#/feed', icon: iconHome },
  { key: 'network', label: 'Network', hash: '#/network', icon: iconNetwork },
  { key: 'jobs', label: 'Jobs', hash: '#/jobs', icon: iconJobs },
  { key: 'messaging', label: 'Messaging', hash: '#/messaging', icon: iconMessaging },
  { key: 'notifications', label: 'Notifications', hash: '#/notifications', icon: iconBell },
];

export function renderChrome() {
  renderTopNav();
  renderTabBar();
}

function activeKey() {
  const h = currentHash();
  const found = NAV.find(n => h.startsWith(n.hash));
  if (found) return found.key;
  if (h.startsWith('#/in/') || h === '#/me') return 'me';
  return null;
}

function badgeCounts(viewer) {
  if (!viewer) return {};
  return {
    network: sel.pendingReceived(viewer).length,
    messaging: sel.unreadMessageCount(viewer),
    notifications: unreadCount(viewer),
  };
}

function renderTopNav() {
  const host = document.getElementById('topnav');
  host.innerHTML = '';
  const viewer = me();
  const bar = document.createElement('div');
  bar.className = 'topnav-inner container';

  // brand
  const brand = document.createElement('a');
  brand.href = viewer ? '#/feed' : '#/';
  brand.className = 'brand';
  brand.innerHTML = `<span class="brand-mark" aria-hidden="true">◔</span><span class="brand-name">Meridian</span>`;
  brand.setAttribute('aria-label', 'Meridian home');
  bar.appendChild(brand);

  // search
  bar.appendChild(searchBox(viewer));

  // nav actions
  const actions = document.createElement('div');
  actions.className = 'topnav-actions';
  if (!viewer) {
    const join = link('#/join', 'Join now', 'btn btn-primary btn-sm');
    const signin = document.createElement('button');
    signin.className = 'btn btn-ghost btn-sm';
    signin.textContent = 'Sign in';
    signin.addEventListener('click', () => {
      const dd = document.querySelector('#devbar select');
      if (dd) { dd.focus(); dd.classList.add('pulse'); setTimeout(() => dd.classList.remove('pulse'), 1200); }
    });
    actions.append(join, signin);
  } else {
    const counts = badgeCounts(viewer);
    for (const n of NAV) {
      actions.appendChild(navIcon(n, activeKey() === n.key, counts[n.key]));
    }
    // Me
    const meLink = document.createElement('a');
    meLink.href = '#/me';
    meLink.className = 'nav-icon' + (activeKey() === 'me' ? ' is-active' : '');
    meLink.setAttribute('aria-label', 'Your profile');
    const u = sel.user(viewer);
    const av = avatar(u, 'sm', { decorative: true });
    meLink.appendChild(av);
    const lab = document.createElement('span'); lab.className = 'nav-label'; lab.textContent = 'Me';
    meLink.appendChild(lab);
    actions.appendChild(meLink);
  }
  bar.appendChild(actions);
  host.appendChild(bar);
}

function navIcon(n, active, count) {
  const a = document.createElement('a');
  a.href = n.hash;
  a.className = 'nav-icon' + (active ? ' is-active' : '');
  a.setAttribute('aria-label', n.label + (count ? ` (${count} new)` : ''));
  if (active) a.setAttribute('aria-current', 'page');
  const ic = document.createElement('span'); ic.className = 'nav-glyph'; ic.innerHTML = n.icon();
  a.appendChild(ic);
  if (count) { const b = document.createElement('span'); b.className = 'badge nav-badge'; b.textContent = count > 99 ? '99+' : count; a.appendChild(b); }
  const lab = document.createElement('span'); lab.className = 'nav-label'; lab.textContent = n.label;
  a.appendChild(lab);
  return a;
}

function searchBox(viewer) {
  const form = document.createElement('form');
  form.className = 'search-box';
  form.setAttribute('role', 'search');
  const input = document.createElement('input');
  input.className = 'input search-input';
  input.type = 'search';
  input.placeholder = 'Search people, jobs, companies';
  input.setAttribute('aria-label', 'Search');
  const dd = document.createElement('div');
  dd.className = 'search-dropdown';
  dd.hidden = true;
  form.append(input, dd);

  let idx = -1;
  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (!q) { dd.hidden = true; dd.innerHTML = ''; return; }
    renderTypeahead(dd, q, viewer);
    idx = -1;
  });
  input.addEventListener('keydown', (e) => {
    const items = dd.querySelectorAll('[data-nav]');
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx + 1, items.length - 1); highlight(items, idx); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(idx - 1, 0); highlight(items, idx); }
    else if (e.key === 'Escape') { dd.hidden = true; }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const items = dd.querySelectorAll('[data-nav]');
    if (idx >= 0 && items[idx]) { navigate(items[idx].dataset.nav); }
    else navigate('#/search?q=' + encodeURIComponent(input.value.trim()));
    dd.hidden = true; input.blur();
  });
  document.addEventListener('click', (e) => { if (!form.contains(e.target)) dd.hidden = true; });
  return form;
}

function highlight(items, idx) { items.forEach((it, i) => it.classList.toggle('is-active', i === idx)); if (items[idx]) items[idx].scrollIntoView({ block: 'nearest' }); }

function renderTypeahead(dd, q, viewer) {
  const res = search(q, viewer);
  const top = [
    ...res.people.slice(0, 4).map(r => ({ ...r, sub: sel.user(r.id)?.headline, hash: `#/in/${sel.user(r.id)?.slug}` })),
    ...res.companies.slice(0, 2).map(r => ({ ...r, sub: 'Company', hash: `#/company/${(sel.company(r.id)||{}).slug || ''}` })),
    ...res.jobs.slice(0, 2).map(r => ({ ...r, sub: 'Job', hash: `#/jobs?job=${r.id}` })),
  ];
  dd.innerHTML = '';
  if (!top.length) { dd.innerHTML = '<div class="ta-empty muted">No matches</div>'; dd.hidden = false; return; }
  for (const r of top) {
    const a = document.createElement('a');
    a.href = r.hash; a.dataset.nav = r.hash; a.className = 'ta-item';
    a.innerHTML = `<span class="ta-name">${escapeHtml(r.name)}</span><span class="ta-sub muted small">${escapeHtml(r.sub || '')}</span>`;
    dd.appendChild(a);
  }
  const all = document.createElement('a');
  all.href = '#/search?q=' + encodeURIComponent(q); all.dataset.nav = '#/search?q=' + encodeURIComponent(q);
  all.className = 'ta-item ta-all'; all.textContent = `See all results for “${q}”`;
  dd.appendChild(all);
  dd.hidden = false;
}

function renderTabBar() {
  const host = document.getElementById('tabbar');
  host.innerHTML = '';
  const viewer = me();
  if (!viewer) { host.style.display = 'none'; return; }
  host.style.display = '';
  const counts = badgeCounts(viewer);
  const tabs = [
    { key: 'feed', label: 'Home', hash: '#/feed', icon: iconHome },
    { key: 'network', label: 'Network', hash: '#/network', icon: iconNetwork, count: counts.network },
    { key: 'post', label: 'Post', hash: '#/feed?compose=1', icon: iconPlus, isPost: true },
    { key: 'notifications', label: 'Alerts', hash: '#/notifications', icon: iconBell, count: counts.notifications },
    { key: 'jobs', label: 'Jobs', hash: '#/jobs', icon: iconJobs },
  ];
  const ak = activeKey();
  for (const t of tabs) {
    const a = document.createElement('a');
    a.href = t.hash;
    a.className = 'tab-item' + (ak === t.key ? ' is-active' : '') + (t.isPost ? ' tab-post' : '');
    a.setAttribute('aria-label', t.label + (t.count ? ` (${t.count} new)` : ''));
    if (ak === t.key) a.setAttribute('aria-current', 'page');
    a.innerHTML = `<span class="nav-glyph">${t.icon()}</span><span class="nav-label">${t.label}</span>`;
    if (t.count) { const b = document.createElement('span'); b.className = 'badge nav-badge'; b.textContent = t.count > 9 ? '9+' : t.count; a.appendChild(b); }
    host.appendChild(a);
  }
}

/* ---------- inline glyphs (no icon fonts) ---------- */
function svg(path) { return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`; }
function iconHome() { return svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'); }
function iconNetwork() { return svg('<circle cx="8" cy="8" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M2.5 20a5.5 5.5 0 0 1 11 0"/><path d="M15 20a4 4 0 0 1 6.5-3"/>'); }
function iconJobs() { return svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'); }
function iconMessaging() { return svg('<path d="M4 5h16v11H8l-4 4z"/>'); }
function iconBell() { return svg('<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 0 0 4 0"/>'); }
function iconPlus() { return svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'); }

function link(href, text, cls) { const a = document.createElement('a'); a.href = href; a.textContent = text; a.className = cls; return a; }
export function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

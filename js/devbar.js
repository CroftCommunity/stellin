// devbar.js — scaffold strip above the real nav. Striped background so it can
// never be mistaken for product UI.
import { sel, getDevPrefs, setDevPref, replaceEvents, getEvents, invalidate } from './store.js';
import { confirmDialog } from './ui/modal.js';
import { toast } from './ui/toast.js';
import { PERSONAS, buildSeedEvents, buildDeleteAllEvents } from '../data/seed.js';
import { SCHEMA_VERSION } from './storage.js';

let hardRerender = () => {};
export function setHardRerender(fn) { hardRerender = fn; }

// personas for the dropdown: base personas that exist + any created via signup.
function personaOptions() {
  const users = sel.users();
  const known = PERSONAS.map(p => p.id).filter(id => users.some(u => u.id === id));
  const extra = users.filter(u => !PERSONAS.some(p => p.id === u.id)).map(u => u.id);
  return [...known, ...extra].map(id => sel.user(id)).filter(Boolean);
}

function validatePersona() {
  const p = getDevPrefs().persona;
  if (p && !sel.user(p)) setDevPref('persona', null);
}

export function renderDevbar() {
  const host = document.getElementById('devbar');
  const prefs = getDevPrefs();
  host.innerHTML = '';
  const strip = document.createElement('div');
  strip.className = 'devbar-strip';
  strip.setAttribute('role', 'region');
  strip.setAttribute('aria-label', 'Developer controls');

  const inner = document.createElement('div');
  inner.className = 'devbar-inner container';

  const tag = document.createElement('span');
  tag.className = 'devbar-tag'; tag.textContent = 'DEV';
  inner.appendChild(tag);

  // Persona dropdown
  const pWrap = document.createElement('label');
  pWrap.className = 'devbar-field';
  pWrap.innerHTML = '<span class="devbar-lbl">Persona</span>';
  const sel1 = document.createElement('select');
  sel1.className = 'devbar-select';
  const optOut = document.createElement('option'); optOut.value = ''; optOut.textContent = 'Logged out';
  sel1.appendChild(optOut);
  for (const u of personaOptions()) {
    const o = document.createElement('option'); o.value = u.id;
    o.textContent = u.name + (sel.entitlement(u.id).tier === 'premium' ? ' ★' : '');
    sel1.appendChild(o);
  }
  sel1.value = prefs.persona || '';
  sel1.addEventListener('change', () => {
    setDevPref('persona', sel1.value || null);
    invalidate();
    hardRerender();
  });
  pWrap.appendChild(sel1);
  inner.appendChild(pWrap);

  // Seed
  inner.appendChild(btn('Seed', 'devbar-btn', async () => {
    replaceEvents(buildSeedEvents(Date.now()), getDevPrefs());
    validatePersona();
    toast('Seeded a lived-in Stellin.', { type: 'success' });
    hardRerender();
  }));

  // Delete All
  inner.appendChild(btn('Delete All', 'devbar-btn', async () => {
    const ok = await confirmDialog({
      title: 'Delete all content?',
      message: 'This resets Stellin to accounts only — the 9 personas keep their name, headline, and avatar. Everything else is removed.',
      confirmLabel: 'Delete all', danger: true,
    });
    if (!ok) return;
    replaceEvents(buildDeleteAllEvents(Date.now()), getDevPrefs());
    validatePersona();
    toast('Reset to accounts only.');
    hardRerender();
  }));

  // Export
  inner.appendChild(btn('Export', 'devbar-btn', () => {
    const payload = { schemaVersion: SCHEMA_VERSION, events: getEvents(), devPrefs: getDevPrefs() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'stellin-state.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }));

  // Import
  const importInput = document.createElement('input');
  importInput.type = 'file'; importInput.accept = 'application/json'; importInput.hidden = true;
  importInput.addEventListener('change', () => {
    const file = importInput.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed.schemaVersion !== SCHEMA_VERSION) { toast(`Import failed: schema v${parsed.schemaVersion} does not match v${SCHEMA_VERSION}.`, { type: 'danger' }); return; }
        replaceEvents(parsed.events || [], parsed.devPrefs || getDevPrefs());
        validatePersona();
        toast('State imported.', { type: 'success' });
        hardRerender();
      } catch (e) { toast('Import failed: could not read that file.', { type: 'danger' }); }
      importInput.value = '';
    };
    reader.readAsText(file);
  });
  inner.appendChild(btn('Import', 'devbar-btn', () => importInput.click()));
  inner.appendChild(importInput);

  // Latency
  const lWrap = document.createElement('label');
  lWrap.className = 'devbar-field';
  lWrap.innerHTML = '<span class="devbar-lbl">Latency</span>';
  const lsel = document.createElement('select');
  lsel.className = 'devbar-select';
  for (const v of [0, 250, 600]) { const o = document.createElement('option'); o.value = v; o.textContent = v + ' ms'; lsel.appendChild(o); }
  lsel.value = String(prefs.latency || 0);
  lsel.addEventListener('change', () => setDevPref('latency', Number(lsel.value)));
  lWrap.appendChild(lsel);
  inner.appendChild(lWrap);

  // Fail next
  const failWrap = document.createElement('label');
  failWrap.className = 'devbar-check';
  const fchk = document.createElement('input'); fchk.type = 'checkbox'; fchk.checked = !!prefs.failNext;
  fchk.addEventListener('change', () => setDevPref('failNext', fchk.checked));
  failWrap.append(fchk, document.createTextNode('Fail next'));
  inner.appendChild(failWrap);

  // Frontiers toggle
  const frWrap = document.createElement('label');
  frWrap.className = 'devbar-check';
  const frchk = document.createElement('input'); frchk.type = 'checkbox'; frchk.checked = !!prefs.showFrontiers;
  frchk.addEventListener('change', () => {
    setDevPref('showFrontiers', frchk.checked);
    document.body.classList.toggle('frontiers-hidden', !frchk.checked);
  });
  frWrap.append(frchk, document.createTextNode('Frontiers'));
  inner.appendChild(frWrap);

  // Unregister SW
  inner.appendChild(btn('Unregister SW + reload', 'devbar-btn', async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if (window.caches) { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); }
    location.reload();
  }));

  strip.appendChild(inner);
  host.appendChild(strip);

  // apply frontier visibility
  document.body.classList.toggle('frontiers-hidden', !prefs.showFrontiers);
}

function btn(text, cls, onClick) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = cls; b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

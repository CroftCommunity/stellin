// network.js — hub with Received / Sent / Connections / Suggestions tabs.
import { el, h1, timeAgo, emptyState, clear } from '../ui/dom.js';
import { sel } from '../store.js';
import { me, actions } from '../actions.js';
import { avatar } from '../ui/avatar.js';
import { degreeBadge } from '../ui/degreeBadge.js';
import { toast } from '../ui/toast.js';
import { tabsBar } from '../ui/tabs.js';
import { pymkCard } from '../ui/pymkModule.js';
import { pymk } from '../engines/pymk.js';
import { RATE } from '../engines/ratelimit.js';
import { frontierChip } from '../ui/frontierChip.js';

export default function network(outlet, ctx) {
  const viewer = me();
  if (!viewer) { location.hash = '#/'; return; }
  const screen = el('div', { class: 'screen network-screen' });
  screen.appendChild(h1('My network'));

  const received = sel.pendingReceived(viewer);
  const tabs = [
    { id: 'received', label: 'Received', badge: received.length || null },
    { id: 'sent', label: 'Sent' },
    { id: 'connections', label: 'Connections' },
    { id: 'suggestions', label: 'Suggestions' },
  ];
  let active = ctx.query.tab || 'received';
  if (!tabs.some(t => t.id === active)) active = 'received';

  const bar = el('div', {});
  const panel = el('div', { class: 'tab-panel', role: 'tabpanel' });
  const rateNote = el('div', {});

  function draw() {
    clear(bar); bar.appendChild(tabsBar(tabs, active, (id) => { active = id; draw(); }));
    clear(panel);
    panel.setAttribute('aria-labelledby', 'tab-' + active);
    if (active === 'received') renderReceived(panel, viewer);
    else if (active === 'sent') renderSent(panel, viewer);
    else if (active === 'connections') renderConnections(panel, viewer);
    else renderSuggestions(panel, viewer);
    clear(rateNote); rateNote.appendChild(rateStatus(viewer));
  }
  screen.append(el('div', { class: 'card card-pad' }, [bar, panel]));
  screen.appendChild(el('div', { class: 'row', style: { gap: '8px', marginTop: '12px' } }, [frontierChip('groups'), frontierChip('events')]));
  screen.insertBefore(rateNote, screen.firstChild.nextSibling);
  outlet.appendChild(screen);
  draw();
}

function rateStatus(viewer) {
  const st = RATE.status(viewer);
  if (st.level === 'ok') return el('div');
  return el('div', { class: 'card card-pad ' + (st.level === 'hard' ? 'rate-hard' : 'rate-soft') }, [
    st.level === 'hard'
      ? `You’ve reached the weekly limit of ${RATE.HARD} invitations (${st.count} sent). New invitations are paused for a few days.`
      : `You’ve sent ${st.count} invitations this week. You’re approaching the weekly limit of ${RATE.HARD}.`,
  ]);
}

function personRow(viewer, otherId, right, note) {
  const u = sel.user(otherId);
  if (!u) return null;
  const nameRow = el('div', { class: 'row', style: { gap: '6px' } }, [el('a', { href: '#/in/' + u.slug, class: 'strong' }, [u.name])]);
  const b = degreeBadge(viewer, otherId); if (b.textContent !== '') nameRow.append(document.createTextNode('·'), b);
  return el('div', { class: 'person-row' }, [
    el('a', { href: '#/in/' + u.slug, 'aria-label': u.name }, [avatar(u, 'md', { decorative: true })]),
    el('div', { class: 'grow' }, [nameRow, el('div', { class: 'small muted' }, [u.headline]), note ? el('div', { class: 'small subtle invite-note' }, ['“' + note + '”']) : false]),
    right,
  ]);
}

function renderReceived(panel, viewer) {
  const received = sel.pendingReceived(viewer);
  if (!received.length) { panel.appendChild(emptyState('📨', 'No invitations', 'When someone invites you to connect, it’ll show up here.')); return; }
  const list = el('div', { class: 'person-list' });
  received.forEach(c => {
    const actionsRow = el('div', { class: 'row', style: { gap: '8px' } }, [
      el('button', { class: 'btn btn-ghost btn-sm', onclick: async (e) => { e.currentTarget.closest('.person-row').remove(); await actions.ignoreInvite(c.requester); } }, ['Ignore']),
      el('button', { class: 'btn btn-primary btn-sm', onclick: async (e) => {
        const row = e.currentTarget.closest('.person-row');
        try { await actions.accept(c.requester); toast('You’re now connected.', { type: 'success' }); }
        catch (err) { toast('Could not accept.', { type: 'danger' }); }
      } }, ['Accept']),
    ]);
    const row = personRow(viewer, c.requester, actionsRow, c.note);
    if (row) list.appendChild(row);
  });
  panel.appendChild(list);
}

function renderSent(panel, viewer) {
  const sent = sel.pendingSent(viewer).filter(c => sel.user(c.target)); // named targets only
  const hiddenCount = sel.pendingSent(viewer).length - sent.length;
  const withdrawn = sel.withdrawnSent(viewer).filter(c => sel.user(c.target));
  if (!sent.length && !withdrawn.length && !hiddenCount) { panel.appendChild(emptyState('📤', 'No pending invitations', 'Invitations you send will appear here until they’re accepted.')); return; }
  const list = el('div', { class: 'person-list' });
  sent.forEach(c => {
    const right = el('button', { class: 'btn btn-ghost btn-sm', onclick: async (e) => { e.currentTarget.closest('.person-row').remove(); await actions.withdraw(c.target); toast('Invitation withdrawn.'); } }, ['Withdraw']);
    const row = personRow(viewer, c.target, right, c.note); if (row) list.appendChild(row);
  });
  if (hiddenCount > 0) list.appendChild(el('div', { class: 'card-pad small subtle' }, [`+ ${hiddenCount} more invitation${hiddenCount > 1 ? 's' : ''} pending to people outside your network.`]));
  withdrawn.forEach(c => {
    const row = personRow(viewer, c.target, el('span', { class: 'chip' }, ['Withdrawn']));
    if (row) { row.classList.add('is-withdrawn'); list.appendChild(row); }
  });
  panel.appendChild(list);
}

function renderConnections(panel, viewer) {
  const ids = sel.connectionsOf(viewer);
  const controls = el('div', { class: 'row', style: { gap: '8px', marginBottom: '12px' } });
  const searchI = el('input', { class: 'input', placeholder: 'Search connections', 'aria-label': 'Search connections' });
  const sortSel = el('select', { class: 'select', style: { maxWidth: '160px' }, 'aria-label': 'Sort connections' }, [
    el('option', { value: 'name' }, ['Sort by name']), el('option', { value: 'recent' }, ['Recently added']),
  ]);
  controls.append(searchI, sortSel);
  const list = el('div', { class: 'person-list' });
  const draw = () => {
    clear(list);
    let arr = ids.map(id => sel.user(id)).filter(Boolean);
    const q = searchI.value.trim().toLowerCase();
    if (q) arr = arr.filter(u => u.name.toLowerCase().includes(q) || (u.headline || '').toLowerCase().includes(q));
    arr.sort((a, b) => a.name.localeCompare(b.name));
    if (!arr.length) { list.appendChild(el('p', { class: 'muted card-pad' }, ['No connections match.'])); return; }
    arr.forEach(u => {
      const right = el('div', { class: 'row', style: { gap: '8px' } }, [
        el('a', { class: 'btn btn-outline btn-sm', href: '#/messaging?to=' + u.id }, ['Message']),
        el('button', { class: 'btn btn-ghost btn-sm', onclick: async (e) => { if (confirm('Remove ' + u.name + ' from your connections?')) { e.currentTarget.closest('.person-row').remove(); await actions.removeConnection(u.id); toast('Connection removed.'); } } }, ['Remove']),
      ]);
      list.appendChild(personRow(viewer, u.id, right));
    });
  };
  searchI.addEventListener('input', draw);
  if (!ids.length) { panel.appendChild(emptyState('🤝', 'No connections yet', 'Connect with people to build your network.', el('a', { href: '#/network?tab=suggestions', class: 'btn btn-primary' }, ['See suggestions']))); return; }
  panel.append(el('div', { class: 'small muted', style: { marginBottom: '8px' } }, [ids.length + ' connections']), controls, list);
  draw();
}

function renderSuggestions(panel, viewer) {
  const cands = pymk(viewer, 12);
  if (!cands.length) { panel.appendChild(emptyState('✨', 'No suggestions right now', 'As your network grows, we’ll suggest people you may know.')); return; }
  const grid = el('div', { class: 'pymk-grid pymk-grid-lg' });
  cands.forEach(c => grid.appendChild(pymkCard(viewer, c)));
  panel.appendChild(grid);
}

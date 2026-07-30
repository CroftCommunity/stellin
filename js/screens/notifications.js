// notifications.js — aggregated rows, type filters, mark-read on view.
import { el, h1, timeAgo, emptyState, clear } from '../ui/dom.js';
import { sel } from '../store.js';
import { me, actions } from '../actions.js';
import { avatar } from '../ui/avatar.js';
import { notifText, notifLink } from '../engines/notify.js';
import { tabsBar } from '../ui/tabs.js';

export default function notifications(outlet) {
  const viewer = me();
  if (!viewer) { location.hash = '#/'; return; }
  const screen = el('div', { class: 'screen notifications-screen' });
  screen.appendChild(h1('Notifications'));

  const all = sel.notificationsFor(viewer);
  const filters = [
    { id: 'all', label: 'All' },
    { id: 'reaction', label: 'Reactions' },
    { id: 'comment', label: 'Comments' },
    { id: 'invite', label: 'Invitations' },
    { id: 'stage', label: 'Jobs' },
  ];
  let active = 'all';

  const card = el('div', { class: 'card' });
  const bar = el('div', {});
  const list = el('div', { class: 'notif-list' });
  card.append(bar, list);
  screen.appendChild(card);
  outlet.appendChild(screen);

  function draw() {
    clear(bar); bar.appendChild(tabsBar(filters, active, (id) => { active = id; draw(); }));
    clear(list);
    const items = active === 'all' ? all : all.filter(n => n.type === active || (active === 'stage' && n.type === 'stage'));
    if (!items.length) { list.appendChild(emptyState('🔔', 'Nothing new', 'Reactions, comments, and invitations will show up here.')); return; }
    items.forEach(n => list.appendChild(notifRow(n, viewer)));
  }
  draw();

  // mark-read on view (after a beat so the unread styling is visible first)
  setTimeout(() => { actions.markNotifsRead(viewer); }, 900);
}

function notifRow(n, viewer) {
  const lead = sel.user(n.actors[0]);
  const row = el('a', { href: notifLink(n), class: 'notif-row' + (n.read ? '' : ' is-unread') }, [
    lead ? avatar(lead, 'md', { decorative: true }) : el('div', { class: 'notif-icon' }, ['🔔']),
    el('div', { class: 'grow' }, [
      el('div', {}, [notifText(n)]),
      el('div', { class: 'small subtle' }, [timeAgo(n.t)]),
    ]),
    n.read ? false : el('span', { class: 'unread-dot', 'aria-label': 'Unread' }),
  ]);
  return row;
}

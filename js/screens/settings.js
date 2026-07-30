// settings.js — viewing mode, connections visibility, activity broadcast,
// block list, and a "who viewed your profile" list that honors viewing modes.
import { el, h1, timeAgo, clear } from '../ui/dom.js';
import { sel, getState } from '../store.js';
import { me, actions } from '../actions.js';
import { avatar } from '../ui/avatar.js';
import { toast } from '../ui/toast.js';
import { frontierChip } from '../ui/frontierChip.js';

export default function settings(outlet) {
  const viewer = me();
  if (!viewer) { location.hash = '#/'; return; }
  const s = sel.settings(viewer);
  const u = sel.user(viewer);
  const premium = sel.entitlement(viewer).tier === 'premium';
  const screen = el('div', { class: 'screen settings-screen' });
  screen.appendChild(h1('Settings'));

  // Viewing mode
  screen.appendChild(settingCard('Profile viewing mode', 'How you appear to others when you view their profile.', radioGroup('viewingMode', s.viewingMode, [
    ['full', 'Full', 'Your name and headline are shown.'],
    ['semiPrivate', 'Semi-private', 'Shown as a description, e.g. “Someone in Health Care”.'],
    ['anonymous', 'Anonymous', 'Shown as “Anonymous member”.' + (!premium ? ' On a free account this also hides your own viewer list.' : '')],
  ], async (v) => { await actions.changeSettings({ viewingMode: v }); toast('Viewing mode updated.'); })));

  // Connections visibility
  screen.appendChild(settingCard('Who can see your connections', null, radioGroup('connectionsVisibility', s.connectionsVisibility, [
    ['connections', 'Your connections', 'Anyone you’re connected with can see your connection list.'],
    ['onlyMe', 'Only you', 'Your connection list is private.'],
  ], async (v) => { await actions.changeSettings({ connectionsVisibility: v }); toast('Connection visibility updated.'); })));

  // Activity broadcast
  const abToggle = el('label', { class: 'row', style: { gap: '10px' } }, [
    (() => { const c = el('input', { type: 'checkbox' }); c.checked = s.activityBroadcast; c.addEventListener('change', async () => { await actions.changeSettings({ activityBroadcast: c.checked }); toast('Activity broadcast ' + (c.checked ? 'on.' : 'off.')); }); return c; })(),
    el('div', {}, [el('div', { class: 'strong' }, ['Share activity']), el('div', { class: 'small muted' }, ['Let your network see when you post, comment, or react.'])]),
  ]);
  screen.appendChild(settingCard('Activity broadcast', null, abToggle));

  // Who viewed your profile
  screen.appendChild(whoViewedCard(viewer, s, premium));

  // Block list
  screen.appendChild(blockListCard(viewer));

  // Account (stub)
  screen.appendChild(settingCard('Account', 'These fields are stubs in this demo.', el('div', {}, [
    field('Email', el('input', { class: 'input', value: (u.slug || 'member') + '@example.com', disabled: true })),
    field('Password', el('input', { class: 'input', type: 'password', value: '••••••••', disabled: true })),
    el('div', { class: 'row', style: { gap: '8px', marginTop: '8px' } }, [frontierChip('premium-checkout', 'manage subscription')]),
  ])));

  outlet.appendChild(screen);
}

function whoViewedCard(viewer, s, premium) {
  const views = sel.profileViewsOf(viewer);
  const body = el('div', {});
  if (s.viewingMode === 'anonymous' && !premium) {
    body.appendChild(el('div', { class: 'card card-pad muted' }, ['You’re browsing in anonymous mode on a free account, so your own list of viewers is hidden. Switch to full or semi-private mode to see who viewed your profile.']));
  } else if (!views.length) {
    body.appendChild(el('p', { class: 'muted' }, ['No profile views yet.']));
  } else {
    const list = el('div', { class: 'person-list' });
    views.slice(0, 12).forEach(v => {
      const u = sel.user(v.viewerId);
      let display, avatarEl, sub;
      if (v.mode === 'anonymous') { display = 'Anonymous member'; sub = 'Private mode'; avatarEl = el('span', { class: 'avatar avatar-md blurred-avatar', 'aria-hidden': 'true' }); }
      else if (v.mode === 'semiPrivate') { const co = industryOf(v.viewerId); display = 'Someone in ' + (co || 'your network'); sub = 'Semi-private'; avatarEl = el('span', { class: 'avatar avatar-md blurred-avatar', 'aria-hidden': 'true' }); }
      else { display = u?.name || 'Member'; sub = u?.headline || ''; avatarEl = avatar(u, 'md', { decorative: true }); }
      list.appendChild(el('div', { class: 'person-row' }, [
        avatarEl,
        el('div', { class: 'grow' }, [v.mode === 'full' ? el('a', { href: '#/in/' + u?.slug, class: 'strong' }, [display]) : el('span', { class: 'strong' }, [display]), el('div', { class: 'small muted' }, [sub])]),
        el('span', { class: 'subtle small' }, [timeAgo(v.t)]),
      ]));
    });
    body.appendChild(list);
  }
  return settingCard('Who viewed your profile', null, body);
}

function industryOf(id) {
  const p = sel.currentPosition(id);
  return p ? getState().companies[p.companyId]?.industry : null;
}

function blockListCard(viewer) {
  const blocked = sel.blockList(viewer);
  const body = el('div', {});
  if (!blocked.length) body.appendChild(el('p', { class: 'muted' }, ['You haven’t blocked anyone.']));
  else {
    const list = el('div', { class: 'person-list' });
    blocked.forEach(id => {
      const u = sel.user(id);
      list.appendChild(el('div', { class: 'person-row' }, [
        avatar(u, 'md', { decorative: true }),
        el('div', { class: 'grow' }, [el('span', { class: 'strong' }, [u?.name || 'Member']), el('div', { class: 'small muted' }, [u?.headline || ''])]),
        el('button', { class: 'btn btn-outline btn-sm', onclick: async (e) => { e.currentTarget.closest('.person-row').remove(); await actions.unblock(id); toast('Unblocked ' + (u?.name || 'member') + '.'); } }, ['Unblock']),
      ]));
    });
    body.appendChild(list);
  }
  return settingCard('Blocked members', 'Blocked people can’t find you or see your activity, and you can’t see theirs.', body);
}

function settingCard(title, desc, content) {
  return el('section', { class: 'card card-pad setting-card' }, [
    el('h2', {}, [title]),
    desc ? el('p', { class: 'small muted' }, [desc]) : false,
    content,
  ]);
}
function radioGroup(name, current, options, onChange) {
  return el('div', { class: 'radio-group' }, options.map(([v, label, desc]) => el('label', { class: 'radio-row row', style: { gap: '10px' } }, [
    (() => { const r = el('input', { type: 'radio', name }); r.checked = current === v; r.addEventListener('change', () => onChange(v)); return r; })(),
    el('div', {}, [el('div', { class: 'strong' }, [label]), el('div', { class: 'small muted' }, [desc])]),
  ])));
}
function field(label, control) { return el('div', { class: 'field' }, [el('label', {}, [label]), control]); }

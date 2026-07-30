// pymkModule.js — People You May Know grid with shared-connection counts and
// optimistic Connect.
import { el } from './dom.js';
import { sel } from '../store.js';
import { me, actions } from '../actions.js';
import { avatar } from './avatar.js';
import { degreeBadge } from './degreeBadge.js';
import { pymk } from '../engines/pymk.js';
import { toast } from './toast.js';
import { RATE } from '../engines/ratelimit.js';

export function pymkModule(viewer, limit = 4) {
  const cands = pymk(viewer, 20).slice(0, limit);
  const card = el('div', { class: 'card card-pad pymk-module' }, [
    el('div', { class: 'row-between' }, [
      el('h2', { class: 'news-title' }, ['People you may know']),
      el('a', { href: '#/network?tab=suggestions', class: 'small' }, ['See all']),
    ]),
  ]);
  if (!cands.length) { card.appendChild(el('p', { class: 'muted small' }, ['No suggestions right now.'])); return card; }
  const grid = el('div', { class: 'pymk-grid' });
  cands.forEach(c => grid.appendChild(pymkCard(viewer, c)));
  card.appendChild(grid);
  return card;
}

export function pymkCard(viewer, cand) {
  const u = sel.user(cand.id);
  const card = el('div', { class: 'pymk-card' });
  const connectBtn = el('button', { class: 'btn btn-outline btn-sm btn-block' }, ['Connect']);
  connectBtn.addEventListener('click', async () => {
    if (RATE.status(viewer).level === 'hard') {
      toast('You’ve hit the weekly invite limit. Try again in a few days.', { type: 'danger' });
      return;
    }
    connectBtn.disabled = true; connectBtn.textContent = 'Pending';
    try { await actions.invite(cand.id); toast('Invitation sent to ' + u.name + '.', { type: 'success' }); }
    catch (e) {
      connectBtn.disabled = false; connectBtn.textContent = 'Connect';
      toast(e.message === 'cap' ? 'You’ve hit the weekly invite limit.' : 'Could not send invitation.', { type: 'danger' });
    }
  });
  card.append(
    el('a', { href: '#/in/' + u.slug, 'aria-label': u.name }, [avatar(u, 'lg', { decorative: true })]),
    el('a', { href: '#/in/' + u.slug, class: 'strong small pymk-name' }, [u.name]),
    el('div', { class: 'subtle small pymk-head' }, [u.headline]),
    el('div', { class: 'subtle small' }, [cand.shared ? `${cand.shared} shared connection${cand.shared > 1 ? 's' : ''}` : 'Suggested for you']),
    connectBtn,
  );
  return card;
}

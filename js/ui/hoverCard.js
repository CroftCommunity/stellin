// hoverCard.js — delayed popover on names/avatars with a mini profile and
// Connect/Message. On touch, tapping navigates to the profile instead.
import { el } from './dom.js';
import { sel } from '../store.js';
import { me, actions } from '../actions.js';
import { avatar } from './avatar.js';
import { degreeBadge } from './degreeBadge.js';
import { toast } from './toast.js';

let activeCard = null;
let showTimer = null;
let hideTimer = null;

// attachHoverCard(anchorEl, userId) — anchor is a name or avatar link.
export function attachHoverCard(anchor, userId) {
  const isTouch = window.matchMedia('(hover: none)').matches;
  if (isTouch) return; // touch: the link navigation already goes to profile

  anchor.addEventListener('mouseenter', () => {
    clearTimeout(hideTimer);
    showTimer = setTimeout(() => show(anchor, userId), 500);
  });
  anchor.addEventListener('mouseleave', () => {
    clearTimeout(showTimer);
    hideTimer = setTimeout(hide, 300);
  });
}

function hide() { if (activeCard) { activeCard.remove(); activeCard = null; } }

function show(anchor, userId) {
  hide();
  const viewer = me();
  const u = sel.user(userId);
  if (!u) return;
  if (viewer && sel.areBlocked(viewer, userId)) return;
  const card = el('div', { class: 'popover hover-card', role: 'dialog' });
  card.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  card.addEventListener('mouseleave', () => { hideTimer = setTimeout(hide, 250); });

  const nameRow = el('div', { class: 'row', style: { gap: '6px' } }, [
    el('a', { href: '#/in/' + u.slug, class: 'strong' }, [u.name]),
  ]);
  if (viewer) { const b = degreeBadge(viewer, userId); if (b.textContent !== '') nameRow.append(document.createTextNode('·'), b); }

  card.append(
    el('div', { class: 'row', style: { gap: '10px', marginBottom: '8px' } }, [
      avatar(u, 'md', { decorative: true }), el('div', {}, [nameRow, el('div', { class: 'small muted' }, [u.headline])]),
    ]),
  );
  if (viewer && viewer !== userId) {
    const status = sel.connectionStatus(viewer, userId);
    const row = el('div', { class: 'row', style: { gap: '8px', marginTop: '8px' } });
    if (status.status === 'none') {
      row.appendChild(el('button', { class: 'btn btn-outline btn-sm', onclick: async () => {
        try { await actions.invite(userId); toast('Invitation sent.', { type: 'success' }); hide(); }
        catch (e) { toast('Could not send invitation.', { type: 'danger' }); }
      } }, ['Connect']));
    } else if (status.status === 'connected') {
      row.appendChild(el('a', { class: 'btn btn-outline btn-sm', href: '#/messaging?to=' + userId }, ['Message']));
    } else {
      row.appendChild(el('span', { class: 'chip' }, ['Invitation pending']));
    }
    card.appendChild(row);
  }

  document.body.appendChild(card);
  const r = anchor.getBoundingClientRect();
  card.style.top = (window.scrollY + r.bottom + 6) + 'px';
  card.style.left = (window.scrollX + r.left) + 'px';
  const cr = card.getBoundingClientRect();
  if (cr.right > window.innerWidth - 8) card.style.left = (window.scrollX + window.innerWidth - cr.width - 8) + 'px';
  activeCard = card;
}

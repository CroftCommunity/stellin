// profile.js — profile view with owner edit affordances, visitor CTAs,
// completion meter, endorsements, and settings-aware visibility.
import { el, h1, timeAgo } from '../ui/dom.js';
import { sel, getState } from '../store.js';
import { me, actions } from '../actions.js';
import { avatar } from '../ui/avatar.js';
import { degreeBadge } from '../ui/degreeBadge.js';
import { toast } from '../ui/toast.js';
import { openModal, confirmDialog } from '../ui/modal.js';
import { postCard } from '../ui/postCard.js';
import { RATE } from '../engines/ratelimit.js';
import { frontierChip } from '../ui/frontierChip.js';
import { openEditModal, completion } from './profileEdit.js';

export default function profile(outlet, ctx) {
  const viewer = me();
  const u = sel.userBySlug(ctx.params.slug);
  if (!u) { outlet.appendChild(el('div', { class: 'screen' }, [h1('Profile not found'), el('p', { class: 'muted' }, ['That member does not exist.'])])); return; }

  // Blocking: blocked either way -> unavailable
  if (viewer && sel.areBlocked(viewer, u.id)) {
    outlet.appendChild(el('div', { class: 'screen' }, [
      h1('Profile unavailable'),
      el('div', { class: 'card card-pad muted' }, ['This profile is unavailable.']),
    ]));
    return;
  }

  const isOwner = viewer === u.id;
  // log a profile view (visitor only), honoring the visitor's own viewing mode
  if (viewer && !isOwner) actions.logProfileView(u.id, sel.settings(viewer).viewingMode);

  const settings = sel.settings(u.id);
  const screen = el('div', { class: 'screen profile-screen' });
  const main = el('div', { class: 'two-col-main' });
  const col = el('div', { class: 'profile-main' });
  const rail = el('aside', { class: 'rail-right' });

  // ---- hero ----
  col.appendChild(heroCard(u, viewer, isOwner));

  // ---- completion meter (owner) ----
  if (isOwner) col.appendChild(completionCard(u.id));

  // ---- About ----
  if (u.about) col.appendChild(section('About', el('p', { class: 'about-text' }, [u.about]), isOwner ? () => openEditModal('about', u.id) : null));
  else if (isOwner) col.appendChild(section('About', el('p', { class: 'muted' }, ['Add a summary so people know what you do.']), () => openEditModal('about', u.id)));

  // ---- Experience ----
  col.appendChild(experienceSection(u.id, isOwner));
  // ---- Education ----
  col.appendChild(educationSection(u.id, isOwner));
  // ---- Skills ----
  col.appendChild(skillsSection(u.id, viewer, isOwner));
  // ---- Recommendations (light) ----
  col.appendChild(section('Recommendations', el('p', { class: 'muted' }, [isOwner ? 'Recommendations from colleagues will appear here.' : 'No recommendations to show yet.'])));

  // ---- Activity ----
  const acts = Object.values(getState().posts).filter(p => p.authorType === 'user' && p.authorId === u.id).sort((a, b) => b.t - a.t).slice(0, 3);
  if (acts.length) {
    const wrap = el('div', { class: 'stack' }, acts.map(p => postCard(p.id)));
    col.appendChild(section('Activity', wrap));
  }

  // ---- rail ----
  rail.appendChild(railCard(u, viewer));
  main.append(col, rail);
  screen.appendChild(main);
  outlet.appendChild(screen);
}

function heroCard(u, viewer, isOwner) {
  const card = el('div', { class: 'card profile-hero' });
  card.appendChild(el('div', { class: 'profile-cover', style: { background: 'linear-gradient(120deg, var(--c-primary), var(--r-support))' } }));
  const avWrap = el('div', { class: 'profile-avatar-wrap' }, [avatar(u, 'xl', { decorative: true })]);
  const body = el('div', { class: 'profile-hero-body' });
  const nameRow = el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, [h1(u.name)]);
  if (viewer && !isOwner) { const b = degreeBadge(viewer, u.id); if (b.textContent !== '') nameRow.append(document.createTextNode('·'), b); }
  body.append(
    nameRow,
    el('p', { class: 'profile-headline' }, [u.headline]),
    el('div', { class: 'small muted' }, [u.location || '', u.openToWork ? ' · ' : '', u.openToWork ? el('span', { class: 'chip open-chip' }, ['Open to work']) : '']),
    el('div', { class: 'small muted', style: { marginTop: '4px' } }, [sel.connectionCount(u.id) + ' connections']),
  );
  body.appendChild(ctaRow(u, viewer, isOwner));
  card.append(avWrap, body);
  return card;
}

function ctaRow(u, viewer, isOwner) {
  const row = el('div', { class: 'profile-ctas row', style: { gap: '8px', flexWrap: 'wrap', marginTop: '12px' } });
  if (isOwner) {
    row.append(el('button', { class: 'btn btn-outline', onclick: () => openEditModal('intro', u.id) }, ['Edit profile']));
    return row;
  }
  if (!viewer) { row.append(el('a', { href: '#/join', class: 'btn btn-primary' }, ['Join to connect'])); return row; }
  const status = sel.connectionStatus(viewer, u.id);
  if (status.status === 'none') {
    row.append(el('button', { class: 'btn btn-primary', onclick: async (e) => {
      if (RATE.status(viewer).level === 'hard') { toast('You’ve hit the weekly invite limit. Try again in a few days.', { type: 'danger' }); return; }
      e.target.disabled = true;
      try { await actions.invite(u.id); toast('Invitation sent.', { type: 'success' }); }
      catch (err) { e.target.disabled = false; toast(err.message === 'cap' ? 'Weekly invite limit reached.' : 'Could not send invitation.', { type: 'danger' }); }
    } }, ['Connect']));
  } else if (status.status === 'connected') {
    row.append(el('a', { href: '#/messaging?to=' + u.id, class: 'btn btn-primary' }, ['Message']));
  } else if (status.status === 'pending-sent') {
    row.append(el('button', { class: 'btn', disabled: true }, ['Pending']));
  } else {
    row.append(el('button', { class: 'btn btn-primary', onclick: async () => { await actions.accept(u.id); toast('You’re now connected.', { type: 'success' }); } }, ['Accept invitation']));
  }
  // follow
  const following = sel.isFollowing(viewer, u.id);
  row.append(el('button', { class: 'btn btn-outline', onclick: async () => {
    if (following) await actions.unfollow(u.id); else await actions.follow(u.id);
    toast(following ? 'Unfollowed.' : 'Following ' + u.name + '.');
  } }, [following ? 'Following' : 'Follow']));
  // more
  row.append(moreMenu(u, viewer));
  return row;
}

function moreMenu(u, viewer) {
  const btn = el('button', { class: 'btn btn-ghost', 'aria-label': 'More actions' }, ['More ▾']);
  btn.addEventListener('click', () => {
    const body = el('div', { class: 'stack' }, [
      el('button', { class: 'btn btn-ghost btn-block', onclick: async () => {
        const ok = await confirmDialog({ title: 'Block ' + u.name + '?', message: 'They won’t be able to find your profile, posts, or messages, and you won’t see theirs.', confirmLabel: 'Block', danger: true });
        if (ok) { await actions.block(u.id); toast(u.name + ' is blocked.'); h.close(); location.hash = '#/feed'; }
      } }, ['Block ' + u.name]),
      el('button', { class: 'btn btn-ghost btn-block', onclick: () => { toast('Thanks — this is a demo; nothing was reported.'); h.close(); } }, ['Report']),
    ]);
    const h = openModal({ title: 'More actions', body });
  });
  return btn;
}

function completionCard(userId) {
  const c = completion(userId);
  const card = el('div', { class: 'card card-pad completion-card' }, [
    el('div', { class: 'row-between' }, [el('h2', { class: 'news-title' }, ['Profile strength']), el('span', { class: 'strong', style: { color: 'var(--c-primary)' } }, [c.total + '%'])]),
    el('div', { class: 'meter', role: 'progressbar', 'aria-valuenow': String(c.total), 'aria-valuemin': '0', 'aria-valuemax': '100' }, [
      el('div', { class: 'meter-fill', style: { width: c.total + '%' } }),
    ]),
  ]);
  const todo = c.items.filter(i => !i.done);
  if (todo.length) {
    card.appendChild(el('ul', { class: 'completion-todo' }, todo.map(i =>
      el('li', {}, [el('button', { class: 'link-btn', onclick: () => openEditModal(i.edit, userId) }, [i.label + ' (+' + i.weight + ')'])]))));
  }
  return card;
}

function section(title, content, onEdit) {
  return el('section', { class: 'card card-pad profile-section' }, [
    el('div', { class: 'row-between' }, [
      el('h2', {}, [title]),
      onEdit ? el('button', { class: 'btn-icon', 'aria-label': 'Edit ' + title, onclick: onEdit }, ['✎']) : false,
    ]),
    content,
  ]);
}

function experienceSection(userId, isOwner) {
  const positions = sel.positionsOf(userId).sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0));
  const list = el('div', { class: 'stack' });
  if (!positions.length) list.appendChild(el('p', { class: 'muted' }, [isOwner ? 'Add a position to show your experience.' : 'No experience listed.']));
  positions.forEach(p => {
    const company = sel.company(p.companyId);
    list.appendChild(el('div', { class: 'exp-item row' }, [
      el('div', { class: 'exp-logo', 'aria-hidden': 'true' }, [company ? company.name[0] : '•']),
      el('div', {}, [
        el('div', { class: 'strong' }, [p.title]),
        el('div', { class: 'small muted' }, [company ? (company.slug ? el('a', { href: '#/company/' + company.slug }, [company.name]) : company.name) : 'Independent']),
        el('div', { class: 'small subtle' }, [`${p.start || ''}${p.current ? ' – Present' : (p.end ? ' – ' + p.end : '')}`]),
      ]),
    ]));
  });
  return section('Experience', list, isOwner ? () => openEditModal('position', userId) : null);
}

function educationSection(userId, isOwner) {
  const eds = sel.educationsOf(userId);
  const list = el('div', { class: 'stack' });
  if (!eds.length) list.appendChild(el('p', { class: 'muted' }, [isOwner ? 'Add your education.' : 'No education listed.']));
  eds.forEach(e => {
    const school = sel.school(e.schoolId);
    list.appendChild(el('div', { class: 'exp-item row' }, [
      el('div', { class: 'exp-logo', 'aria-hidden': 'true' }, [school ? school.name[0] : '•']),
      el('div', {}, [
        el('div', { class: 'strong' }, [school?.name || 'School']),
        el('div', { class: 'small muted' }, [`${e.degree || ''}${e.field ? ', ' + e.field : ''}`]),
        el('div', { class: 'small subtle' }, [`${e.start || ''}${e.end ? ' – ' + e.end : ''}`]),
      ]),
    ]));
  });
  return section('Education', list, isOwner ? () => openEditModal('education', userId) : null);
}

function skillsSection(userId, viewer, isOwner) {
  const skills = sel.skillsOf(userId);
  const wrap = el('div', { class: 'skills-wrap' });
  if (!skills.length) wrap.appendChild(el('p', { class: 'muted' }, [isOwner ? 'Add skills to get endorsed.' : 'No skills listed.']));
  skills.forEach(s => {
    const chip = el('div', { class: 'skill-chip' }, [
      el('span', { class: 'skill-name' }, [s.name]),
      s.endorsers.length ? el('span', { class: 'skill-count' }, [String(s.endorsers.length)]) : false,
    ]);
    if (viewer && !isOwner && !sel.areBlocked(viewer, userId)) {
      const endorsed = s.endorsers.includes(viewer);
      const b = el('button', { class: 'skill-endorse' + (endorsed ? ' is-on' : ''), 'aria-pressed': endorsed ? 'true' : 'false', 'aria-label': (endorsed ? 'Endorsed for ' : 'Endorse for ') + s.name, onclick: async () => {
        if (endorsed) return;
        try { await actions.endorse(userId, s.skillId); toast('Endorsed for ' + s.name + '.'); } catch (e) { toast('Could not endorse.', { type: 'danger' }); }
      } }, ['+']);
      chip.appendChild(b);
    }
    wrap.appendChild(chip);
  });
  return section('Skills', wrap, isOwner ? () => openEditModal('skill', userId) : null);
}

function railCard(u, viewer) {
  return el('div', { class: 'card card-pad' }, [
    el('h2', { class: 'news-title' }, ['Profile insights']),
    el('div', { class: 'small muted', style: { marginBottom: '8px' } }, ['Signals like analytics are a frontier for now.']),
    frontierChip('analytics-dashboard'),
  ]);
}

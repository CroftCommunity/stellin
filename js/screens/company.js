// company.js — company page with Follow, About, Posts, Jobs, People, and an
// admin view (compose-as-company, edit About).
import { el, h1, emptyState, clear } from '../ui/dom.js';
import { sel, getState } from '../store.js';
import { me, actions } from '../actions.js';
import { companyAvatar, avatar } from '../ui/avatar.js';
import { toast } from '../ui/toast.js';
import { openModal } from '../ui/modal.js';
import { tabsBar } from '../ui/tabs.js';
import { postCard } from '../ui/postCard.js';
import { frontierChip } from '../ui/frontierChip.js';

export default function company(outlet, ctx) {
  const viewer = me();
  const co = sel.companyBySlug(ctx.params.slug);
  if (!co) { outlet.appendChild(el('div', { class: 'screen' }, [h1('Company not found')])); return; }
  const isAdmin = viewer && co.adminId === viewer;

  const screen = el('div', { class: 'screen company-screen' });
  // hero
  screen.appendChild(el('div', { class: 'card company-hero' }, [
    el('div', { class: 'company-cover', style: { background: 'linear-gradient(120deg, var(--c-primary), var(--r-support))' } }),
    el('div', { class: 'company-hero-body' }, [
      companyAvatar(co, 'xl', { decorative: true }),
      el('div', { class: 'grow' }, [
        h1(co.name),
        el('div', { class: 'muted' }, [co.industry, ' · ', String(sel.followCount(co.id)) + ' followers']),
        el('p', { class: 'small' }, [co.tagline || '']),
        ctaRow(co, viewer, isAdmin),
      ]),
    ]),
  ]));

  const tabs = [{ id: 'about', label: 'About' }, { id: 'posts', label: 'Posts' }, { id: 'jobs', label: 'Jobs' }, { id: 'people', label: 'People' }];
  let active = ctx.query.tab || 'about';
  const bar = el('div', { class: 'card card-pad' });
  const panel = el('div', { class: 'company-panel' });
  screen.append(bar, panel);
  outlet.appendChild(screen);

  function draw() {
    clear(bar); bar.appendChild(tabsBar(tabs, active, (id) => { active = id; draw(); }));
    clear(panel);
    if (active === 'about') renderAbout(panel, co, isAdmin);
    else if (active === 'posts') renderPosts(panel, co, isAdmin, viewer);
    else if (active === 'jobs') renderJobs(panel, co);
    else renderPeople(panel, co, viewer);
  }
  draw();
}

function ctaRow(co, viewer, isAdmin) {
  const row = el('div', { class: 'row', style: { gap: '8px', marginTop: '10px' } });
  if (viewer && !isAdmin) {
    const following = sel.isFollowing(viewer, co.id);
    row.appendChild(el('button', { class: 'btn ' + (following ? 'btn-outline' : 'btn-primary'), onclick: async (e) => {
      if (following) await actions.unfollow(co.id); else await actions.follow(co.id, 'company');
      toast(following ? 'Unfollowed ' + co.name + '.' : 'Following ' + co.name + '.');
    } }, [following ? 'Following' : 'Follow']));
  }
  if (isAdmin) row.appendChild(el('button', { class: 'btn btn-primary', onclick: () => composeAsCompany(co) }, ['Post as ' + co.name]));
  if (!viewer) row.appendChild(el('a', { href: '#/join', class: 'btn btn-primary' }, ['Join to follow']));
  return row;
}

function renderAbout(panel, co, isAdmin) {
  panel.appendChild(el('div', { class: 'card card-pad' }, [
    el('div', { class: 'row-between' }, [el('h2', {}, ['Overview']), isAdmin ? el('button', { class: 'btn-icon', 'aria-label': 'Edit about', onclick: () => editAbout(co) }, ['✎']) : false]),
    el('p', {}, [co.about || (isAdmin ? 'Add a description of your company.' : 'No description yet.')]),
    el('div', { class: 'divider' }),
    el('div', { class: 'small muted' }, ['Industry: ' + (co.industry || '—')]),
  ]));
}

function renderPosts(panel, co, isAdmin, viewer) {
  const posts = Object.values(getState().posts).filter(p => p.authorType === 'company' && p.authorId === co.id).sort((a, b) => b.t - a.t);
  if (isAdmin) panel.appendChild(el('div', { class: 'card card-pad', style: { marginBottom: '12px' } }, [el('button', { class: 'btn btn-outline btn-block', onclick: () => composeAsCompany(co) }, ['Post as ' + co.name])]));
  if (!posts.length) { panel.appendChild(emptyState('📣', 'No posts yet', isAdmin ? 'Share an update as your company.' : 'This company hasn’t posted yet.')); return; }
  const list = el('div', { class: 'stack' });
  posts.forEach(p => list.appendChild(postCard(p.id)));
  panel.appendChild(list);
}

function renderJobs(panel, co) {
  const jobs = sel.jobs().filter(j => j.companyId === co.id);
  if (!jobs.length) { panel.appendChild(emptyState('💼', 'No open roles', 'This company has no open jobs right now.')); return; }
  const list = el('div', { class: 'card' });
  jobs.forEach(j => list.appendChild(el('a', { href: '#/jobs?job=' + j.id, class: 'person-row' }, [
    el('div', { class: 'job-item-logo', 'aria-hidden': 'true' }, [co.name[0]]),
    el('div', { class: 'grow' }, [el('div', { class: 'strong' }, [j.title]), el('div', { class: 'small muted' }, [`${j.location} · ${j.workMode}`])]),
  ])));
  panel.appendChild(list);
}

function renderPeople(panel, co, viewer) {
  // members = users with a position at this company
  const members = sel.users().filter(u => sel.positionsOf(u.id).some(p => p.companyId === co.id));
  const visible = members.filter(u => !(viewer && sel.areBlocked(viewer, u.id)));
  if (!visible.length) { panel.appendChild(emptyState('👥', 'No members listed', 'No members list this company on their profile.')); return; }
  const list = el('div', { class: 'card' });
  visible.forEach(u => {
    const pos = sel.positionsOf(u.id).find(p => p.companyId === co.id);
    list.appendChild(el('a', { href: '#/in/' + u.slug, class: 'person-row' }, [
      avatar(u, 'md', { decorative: true }),
      el('div', { class: 'grow' }, [el('div', { class: 'strong' }, [u.name]), el('div', { class: 'small muted' }, [pos?.title || u.headline])]),
    ]));
  });
  panel.appendChild(list);
}

function composeAsCompany(co) {
  const ta = el('textarea', { class: 'textarea', rows: '5', placeholder: 'Share an update as ' + co.name, 'aria-label': 'Company post text' });
  const post = el('button', { class: 'btn btn-primary', disabled: true, onclick: async () => {
    post.disabled = true;
    try {
      const hashtags = [...new Set((ta.value.match(/#(\w+)/g) || []).map(h => h.slice(1)))];
      await actions.createPost({ text: ta.value.trim(), authorType: 'company', hashtags }, co.id);
      toast('Posted as ' + co.name + '.', { type: 'success' }); h.close();
    } catch (e) { post.disabled = false; toast('Could not post.', { type: 'danger' }); }
  } }, ['Post']);
  ta.addEventListener('input', () => { post.disabled = !ta.value.trim(); });
  const h = openModal({ title: 'Post as ' + co.name, body: ta, footer: post });
}

function editAbout(co) {
  const ta = el('textarea', { class: 'textarea', rows: '6' }); ta.value = co.about || '';
  const save = el('button', { class: 'btn btn-primary', onclick: async () => {
    try { await actions.updateCompany(co.id, { about: ta.value.trim() }); h.close(); toast('About updated.'); }
    catch (e) { toast('Could not save.', { type: 'danger' }); }
  } }, ['Save']);
  const h = openModal({ title: 'Edit about', body: ta, footer: save });
}

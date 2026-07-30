// search.js — results page with vertical tabs and per-vertical facets.
// Free tier sees 3rd-degree names blurred with an upsell; premium sees them.
import { el, h1, emptyState, clear } from '../ui/dom.js';
import { sel, getState } from '../store.js';
import { me } from '../actions.js';
import { avatar, companyAvatar } from '../ui/avatar.js';
import { degreeBadge } from '../ui/degreeBadge.js';
import { degree } from '../engines/degrees.js';
import { search as runSearch } from '../engines/search.js';
import { tabsBar } from '../ui/tabs.js';
import { frontierChip } from '../ui/frontierChip.js';
import { timeAgo } from '../ui/dom.js';

export default function searchScreen(outlet, ctx) {
  const viewer = me();
  const premium = viewer && sel.entitlement(viewer).tier === 'premium';
  const rawQ = decodeURIComponent((ctx.query.q || '').replace(/\+/g, ' '));
  const q = rawQ.startsWith('%23') ? '#' + rawQ.slice(3) : rawQ;

  const screen = el('div', { class: 'screen search-screen' });
  screen.appendChild(h1(q ? `Results for “${q}”` : 'Search'));
  if (!q) { screen.appendChild(el('p', { class: 'muted' }, ['Type in the search bar above to find people, jobs, companies, and posts.'])); outlet.appendChild(screen); return; }

  const res = runSearch(q.replace(/^#/, ''), viewer);
  const counts = { people: res.people.length, jobs: res.jobs.length, companies: res.companies.length, posts: res.posts.length };
  const verticals = [
    { id: 'people', label: `People (${counts.people})` },
    { id: 'jobs', label: `Jobs (${counts.jobs})` },
    { id: 'companies', label: `Companies (${counts.companies})` },
    { id: 'posts', label: `Posts (${counts.posts})` },
  ];
  let active = ctx.query.v || (counts.people ? 'people' : counts.jobs ? 'jobs' : counts.companies ? 'companies' : 'posts');

  const layout = el('div', { class: 'search-layout' });
  const nav = el('aside', { class: 'card card-pad search-nav' });
  const panel = el('div', { class: 'search-results' });
  layout.append(nav, panel);
  screen.appendChild(layout);
  outlet.appendChild(screen);

  function draw() {
    clear(nav); nav.appendChild(tabsBar(verticals, active, (id) => { active = id; draw(); }, { vertical: true }));
    if (premium) nav.appendChild(el('div', { class: 'small muted', style: { marginTop: '12px' } }, ['★ Premium: advanced filters enabled']));
    else nav.appendChild(el('div', { style: { marginTop: '12px' } }, [el('div', { class: 'small muted', style: { marginBottom: '6px' } }, ['More filters with Premium']), frontierChip('premium-checkout', 'advanced filters')]));
    clear(panel);
    if (active === 'people') renderPeople(panel, res.people, viewer, premium);
    else if (active === 'jobs') renderJobs(panel, res.jobs);
    else if (active === 'companies') renderCompanies(panel, res.companies);
    else renderPosts(panel, res.posts, viewer);
  }
  draw();
}

function renderPeople(panel, people, viewer, premium) {
  if (!people.length) { panel.appendChild(emptyState('🔍', 'No people found', 'Try a different name or keyword.')); return; }
  const list = el('div', { class: 'card' });
  people.forEach(p => {
    const u = sel.user(p.id);
    const d = viewer ? degree(viewer, p.id) : 4;
    const blur = !premium && d >= 4; // 3rd+/out-of-network blurred for free tier
    const nameEl = blur
      ? el('span', { class: 'blurred-name' }, ['Stellin member'])
      : el('a', { href: '#/in/' + u.slug, class: 'strong' }, [u.name]);
    const nameRow = el('div', { class: 'row', style: { gap: '6px' } }, [nameEl]);
    if (viewer && !blur) { const b = degreeBadge(viewer, p.id); if (b.textContent !== '') nameRow.append(document.createTextNode('·'), b); }
    const right = blur
      ? el('div', {}, [frontierChip('premium-checkout', 'unlock name')])
      : el('a', { class: 'btn btn-outline btn-sm', href: '#/in/' + u.slug }, ['View']);
    list.appendChild(el('div', { class: 'person-row' }, [
      blur ? el('span', { class: 'avatar avatar-md blurred-avatar', 'aria-hidden': 'true' }) : avatar(u, 'md', { decorative: true }),
      el('div', { class: 'grow' }, [nameRow, el('div', { class: 'small muted' + (blur ? ' blurred' : '') }, [blur ? 'Headline hidden' : u.headline])]),
      right,
    ]));
  });
  panel.appendChild(list);
}

function renderJobs(panel, jobs) {
  if (!jobs.length) { panel.appendChild(emptyState('💼', 'No jobs found', 'Try a broader keyword.')); return; }
  const list = el('div', { class: 'card' });
  jobs.forEach(j => {
    const job = sel.job(j.id); const company = sel.company(job.companyId);
    list.appendChild(el('a', { href: '#/jobs?job=' + j.id, class: 'person-row' }, [
      el('div', { class: 'job-item-logo', 'aria-hidden': 'true' }, [company ? company.name[0] : '•']),
      el('div', { class: 'grow' }, [el('div', { class: 'strong' }, [job.title]), el('div', { class: 'small muted' }, [`${company?.name || ''} · ${job.location} · ${job.workMode}`])]),
    ]));
  });
  panel.appendChild(list);
}

function renderCompanies(panel, companies) {
  if (!companies.length) { panel.appendChild(emptyState('🏢', 'No companies found', 'Try a different name.')); return; }
  const list = el('div', { class: 'card' });
  companies.forEach(c => {
    const co = sel.company(c.id);
    if (!co) return; // schools indexed as companies but no page
    list.appendChild(el('a', { href: '#/company/' + co.slug, class: 'person-row' }, [
      companyAvatar(co, 'md', { decorative: true }),
      el('div', { class: 'grow' }, [el('div', { class: 'strong' }, [co.name]), el('div', { class: 'small muted' }, [co.industry || ''])]),
    ]));
  });
  panel.appendChild(list);
}

function renderPosts(panel, posts, viewer) {
  if (!posts.length) { panel.appendChild(emptyState('📝', 'No posts found', 'Try a different keyword or hashtag.')); return; }
  const list = el('div', { class: 'stack' });
  posts.forEach(p => {
    const post = sel.post(p.id);
    const author = post.authorType === 'company' ? sel.company(post.authorId) : sel.user(post.authorId);
    list.appendChild(el('a', { href: post.authorType === 'company' ? '#/company/' + author?.slug : '#/in/' + author?.slug, class: 'card card-pad search-post' }, [
      el('div', { class: 'row', style: { gap: '8px', marginBottom: '6px' } }, [
        (post.authorType === 'company' ? companyAvatar : avatar)(author, 'sm', { decorative: true }),
        el('span', { class: 'strong small' }, [author?.name || 'Member']), el('span', { class: 'subtle small' }, [timeAgo(post.t)]),
      ]),
      el('div', { class: 'clamp-3' }, [post.text || '']),
    ]));
  });
  panel.appendChild(list);
}

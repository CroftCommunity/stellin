// search.js — in-memory prefix index over people, companies, schools, skills,
// jobs, posts. Rebuilt lazily when the event log changes. People get a
// closeness boost (3 − degree).
import { sel, getState } from '../store.js';
import { degree } from './degrees.js';

let _index = null;
let _key = -1;

function buildIndex() {
  const st = getState();
  const items = [];
  for (const u of Object.values(st.users)) items.push({ kind: 'people', id: u.id, text: `${u.name} ${u.headline}`, name: u.name });
  for (const c of Object.values(st.companies)) items.push({ kind: 'companies', id: c.id, text: `${c.name} ${c.industry}`, name: c.name });
  for (const s of Object.values(st.schools)) items.push({ kind: 'companies', id: s.id, text: s.name, name: s.name, school: true });
  for (const j of Object.values(st.jobs)) items.push({ kind: 'jobs', id: j.id, text: `${j.title} ${j.location}`, name: j.title });
  for (const p of Object.values(st.posts)) items.push({ kind: 'posts', id: p.id, text: p.text, name: (p.text || '').slice(0, 60) });
  _index = items;
  _key = st.order.events;
}

function ensure() {
  const st = getState();
  if (!_index || _key !== st.order.events) buildIndex();
  return _index;
}

// query(q, viewerId) -> {people, companies, jobs, posts} arrays, blocking-filtered.
export function search(q, viewerId, kind = null) {
  const items = ensure();
  const needle = (q || '').trim().toLowerCase();
  if (!needle) return { people: [], companies: [], jobs: [], posts: [] };
  const st = getState();
  const matches = items.filter(it => {
    if (kind && it.kind !== kind) return false;
    if (!prefixMatch(it.text, needle)) return false;
    if (it.kind === 'people') {
      if (viewerId && sel.areBlocked(viewerId, it.id)) return false;
    }
    if (it.kind === 'posts') {
      const post = st.posts[it.id];
      if (post?.authorType === 'user' && viewerId && sel.areBlocked(viewerId, post.authorId)) return false;
    }
    return true;
  });

  // score people by closeness
  const scoredPeople = matches.filter(m => m.kind === 'people').map(m => ({
    ...m, boost: 3 - Math.min(degree(viewerId, m.id), 3),
  })).sort((a, b) => b.boost - a.boost || a.name.localeCompare(b.name));

  return {
    people: scoredPeople,
    companies: matches.filter(m => m.kind === 'companies'),
    jobs: matches.filter(m => m.kind === 'jobs'),
    posts: matches.filter(m => m.kind === 'posts'),
  };
}

function prefixMatch(text, needle) {
  const words = (text || '').toLowerCase().split(/\s+/);
  return words.some(w => w.startsWith(needle)) || (text || '').toLowerCase().includes(needle);
}

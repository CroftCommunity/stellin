// feedrank.js — rank feed candidates for a viewer.
// Candidates = posts within 14 days by 1st-degree connections, followed
// people, followed companies, and self. Score combines affinity, engagement,
// and recency. Stable sort, cursor-paginate 10.
import { sel, getState } from '../store.js';
import { firstDegree } from './degrees.js';

const DAY = 24 * 60 * 60 * 1000;

export function rankedFeed(viewerId, now = Date.now()) {
  if (!viewerId) return [];
  const st = getState();
  const first = firstDegree(viewerId);
  const follows = st.follows[viewerId] || {};
  const affinity = affinityMap(viewerId);

  const candidates = Object.values(st.posts).filter(p => {
    if ((now - p.t) > 14 * DAY) return false;
    const author = p.authorId;
    if (author === viewerId) return true;
    if (p.authorType === 'company') {
      if (follows[author]) return true;
      // A company post also surfaces when its admin is a 1st-degree connection,
      // so an admin's company voice reaches their network without a follow.
      const admin = st.companies[author]?.adminId;
      if (admin && first.has(admin)) return true;
      return false;
    }
    // user posts
    if (sel.areBlocked(viewerId, author)) return false;
    if (first.has(author)) return true;
    if (follows[author]) return true;
    return false;
  });

  const scored = candidates.map((p, i) => {
    const reactions = Object.keys(st.reactions[`post:${p.id}`] || {}).length;
    const comments = Object.values(st.comments).filter(c => c.postId === p.id).length;
    const ageHours = (now - p.t) / (60 * 60 * 1000);
    const score =
      3 * (affinity[p.authorId] || 0) +
      2 * Math.log(1 + reactions) +
      2 * Math.log(1 + comments) +
      4 * Math.exp(-ageHours / 24);
    return { id: p.id, score, i };
  });
  // stable sort: score desc, tie-break by original index (newest-first array order preserved)
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored.map(x => x.id);
}

// affinity = count of viewer's prior interactions with an author
function affinityMap(viewerId) {
  const st = getState();
  const map = {};
  const bump = (authorId) => { if (authorId) map[authorId] = (map[authorId] || 0) + 1; };
  // reactions by viewer
  for (const [tk, byUser] of Object.entries(st.reactions)) {
    if (byUser[viewerId] && tk.startsWith('post:')) bump(st.posts[tk.slice(5)]?.authorId);
  }
  // comments by viewer
  for (const c of Object.values(st.comments)) {
    if (c.authorId === viewerId) bump(st.posts[c.postId]?.authorId);
  }
  return map;
}

export function paginate(ids, cursor = 0, size = 10) {
  return { page: ids.slice(cursor, cursor + size), nextCursor: cursor + size < ids.length ? cursor + size : null };
}

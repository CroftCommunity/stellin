// degrees.js — BFS over the connection graph, capped at depth 3.
// Beyond depth 3 is "3rd+". The viewer's 1st/2nd sets are cached and
// invalidated on any connection.* event (via store's memoized state).
import { sel, getState } from '../store.js';

let _cache = { viewer: null, key: -1, first: null, second: null, dist: null };

function build(viewer) {
  const st = getState();
  const key = st.order.events;
  if (_cache.viewer === viewer && _cache.key === key) return _cache;

  const adj = {};
  for (const c of Object.values(st.connections)) {
    if (c.status !== 'accepted') continue;
    (adj[c.a] = adj[c.a] || []).push(c.b);
    (adj[c.b] = adj[c.b] || []).push(c.a);
  }
  const dist = { [viewer]: 0 };
  const queue = [viewer];
  while (queue.length) {
    const cur = queue.shift();
    if (dist[cur] >= 3) continue;
    for (const nb of (adj[cur] || [])) {
      if (dist[nb] === undefined) { dist[nb] = dist[cur] + 1; queue.push(nb); }
    }
  }
  const first = new Set(), second = new Set();
  for (const [id, d] of Object.entries(dist)) {
    if (d === 1) first.add(id);
    else if (d === 2) second.add(id);
  }
  _cache = { viewer, key, first, second, dist };
  return _cache;
}

// degree(viewer, other) -> 0 (self) | 1 | 2 | 3 | 4 (out of network / 3rd+)
export function degree(viewer, other) {
  if (!viewer || viewer === other) return 0;
  const c = build(viewer);
  const d = c.dist[other];
  if (d === undefined) return 4; // out of network
  return d;
}

// Human label used in badges.
export function degreeLabel(d) {
  switch (d) {
    case 0: return 'You';
    case 1: return '1st';
    case 2: return '2nd';
    case 3: return '3rd';
    default: return '3rd+';
  }
}

export function firstDegree(viewer) { return build(viewer).first; }
export function secondDegree(viewer) { return build(viewer).second; }

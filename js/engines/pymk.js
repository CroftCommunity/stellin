// pymk.js — People You May Know. Friends-of-friends candidates scored by
// shared connections, same company, same school, same industry. Excludes
// connected, pending, blocked, and self. Top 8.
import { sel, getState, pairKey } from '../store.js';

export function pymk(viewerId, limit = 8) {
  if (!viewerId) return [];
  const st = getState();
  const myConns = new Set(sel.connectionsOf(viewerId));
  const myCompany = companyOf(viewerId);
  const mySchool = schoolOf(viewerId);
  const myIndustry = industryOf(viewerId);

  const candidates = {};
  for (const conn of myConns) {
    for (const fof of sel.connectionsOf(conn)) {
      if (fof === viewerId || myConns.has(fof)) continue;
      candidates[fof] = candidates[fof] || { id: fof, shared: 0 };
      candidates[fof].shared += 1;
    }
  }
  // also include out-of-network users who share company/school even w/o FoF
  for (const u of Object.values(st.users)) {
    if (u.id === viewerId || myConns.has(u.id)) continue;
    if (!candidates[u.id] && (companyOf(u.id) === myCompany && myCompany || schoolOf(u.id) === mySchool && mySchool))
      candidates[u.id] = { id: u.id, shared: 0 };
  }

  const scored = [];
  for (const c of Object.values(candidates)) {
    const other = c.id;
    // exclusions
    const status = sel.connectionStatus(viewerId, other).status;
    if (status !== 'none') continue;
    if (sel.areBlocked(viewerId, other)) continue;
    let score = 3 * c.shared;
    if (myCompany && companyOf(other) === myCompany) score += 2;
    if (mySchool && schoolOf(other) === mySchool) score += 2;
    if (myIndustry && industryOf(other) === myIndustry) score += 1;
    scored.push({ id: other, score, shared: c.shared });
  }
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return scored.slice(0, limit);
}

function companyOf(id) { const p = sel.currentPosition(id); return p?.companyId || null; }
function schoolOf(id) { const e = sel.educationsOf(id)[0]; return e?.schoolId || null; }
function industryOf(id) {
  const p = sel.currentPosition(id);
  if (!p) return null;
  return getState().companies[p.companyId]?.industry || null;
}

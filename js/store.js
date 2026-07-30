// store.js — event log, reducers, derived-state selectors, persistence.
// State = reduce(events). Seeded and live data are indistinguishable because
// both flow through these reducers.
import * as storage from './storage.js';

/* ---------- helpers ---------- */
export function pairKey(a, b) { return [a, b].sort().join('~'); }
export function uid(prefix = 'e') {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}
export function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const listeners = new Set();
let _events = [];
let _devPrefs = defaultDevPrefs();
let _cache = null;      // memoized derived state
let _cacheKey = -1;     // events.length as a cheap dirty check
let _saveTimer = null;

function defaultDevPrefs() {
  return { persona: null, latency: 0, failNext: false, showFrontiers: true, swBypass: false };
}

/* ---------- persistence ---------- */
function persist() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try { storage.save({ events: _events, devPrefs: _devPrefs }); }
    catch (e) { window.dispatchEvent(new CustomEvent('meridian:storage-full')); }
  }, 250);
}

export function init() {
  const loaded = storage.load();
  if (loaded) {
    _events = loaded.events || [];
    _devPrefs = { ...defaultDevPrefs(), ...(loaded.devPrefs || {}) };
  }
  invalidate();
}

export function invalidate() { _cacheKey = -1; }

/* ---------- dispatch ---------- */
// Append an already-formed event object to the log.
export function append(event) {
  _events.push(event);
  invalidate();
  persist();
  emit();
  return event;
}
export function getEvents() { return _events; }
export function replaceEvents(events, devPrefs) {
  _events = events || [];
  if (devPrefs) _devPrefs = { ...defaultDevPrefs(), ...devPrefs };
  invalidate();
  persist();
  emit();
}
export function clearAll() { replaceEvents([], _devPrefs); }

/* ---------- dev prefs ---------- */
export function getDevPrefs() { return _devPrefs; }
export function setDevPref(key, value) {
  _devPrefs[key] = value;
  persist();
  emit();
}

/* ---------- subscription ---------- */
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }

/* ---------- the reducer ---------- */
export function getState() {
  if (_cacheKey === _events.length && _cache) return _cache;
  _cache = reduce(_events);
  _cacheKey = _events.length;
  return _cache;
}

function blank() {
  return {
    users: {}, companies: {}, schools: {}, skills: {},
    positions: {}, educations: {}, userSkills: {}, // userSkills[userId] = [{skillId, endorsers:[]}]
    connections: {}, // pairKey -> {a,b,status,requester,t,note}
    follows: {},     // followerId -> { userId|companyId : {type,t} }
    posts: {}, comments: {}, reactions: {}, // reactions[targetKey] = {userId:type}
    jobs: {}, applications: {},
    conversations: {}, messages: {},
    notifications: {}, // aggKey -> {id,userId,type,targetKey,actors:[],count,t,read,meta}
    entitlements: {}, // userId -> {tier, credits}
    settings: {},     // userId -> {viewingMode, connectionsVisibility, activityBroadcast}
    blocks: {},       // userId -> Set of blockedIds (stored as array-backed set)
    profileViews: {}, // userId -> [{viewerId,t,mode}]
    hashtags: {},     // tag -> count
    inviteLog: [],    // {requester, t, withdrawn} for rate limiting
    order: { posts: [], events: _events.length },
  };
}

function skillByName(s, name) {
  const key = slugify(name);
  if (!s.skills[key]) s.skills[key] = { id: key, name };
  return s.skills[key];
}

function ensureNotif(s, aggKey, base) {
  if (!s.notifications[aggKey]) {
    s.notifications[aggKey] = { id: aggKey, actors: [], count: 0, read: false, ...base };
  }
  return s.notifications[aggKey];
}
function addActor(n, actor, t) {
  if (actor && actor !== 'system' && !n.actors.includes(actor)) n.actors.push(actor);
  n.count = Math.max(n.count, n.actors.length);
  if (t > (n.t || 0)) n.t = t;
}

function reduce(events) {
  const s = blank();
  for (const ev of events) {
    const p = ev.payload || {};
    switch (ev.type) {
      case 'user.created': {
        s.users[p.id] = {
          id: p.id, name: p.name, slug: p.slug || slugify(p.name),
          headline: p.headline || '', location: p.location || '',
          about: p.about || '', avatarColor: p.avatarColor,
          cover: p.cover || null, openToWork: p.openToWork || false,
          createdAt: ev.t, unverified: false,
        };
        s.entitlements[p.id] = { tier: p.tier || 'free', credits: p.credits ?? 0 };
        s.settings[p.id] = {
          viewingMode: 'full', connectionsVisibility: 'connections',
          activityBroadcast: true, ...(p.settings || {}),
        };
        s.blocks[p.id] = s.blocks[p.id] || [];
        s.follows[p.id] = s.follows[p.id] || {};
        s.userSkills[p.id] = s.userSkills[p.id] || [];
        s.profileViews[p.id] = s.profileViews[p.id] || [];
        break;
      }
      case 'profile.updated': {
        const u = s.users[ev.actor]; if (!u) break;
        Object.assign(u, p);
        break;
      }
      case 'company.created': {
        s.companies[p.id] = {
          id: p.id, name: p.name, slug: p.slug || slugify(p.name),
          about: p.about || '', industry: p.industry || '', tagline: p.tagline || '',
          adminId: p.adminId || null, avatarColor: p.avatarColor,
        };
        s.follows[p.id] = s.follows[p.id] || {};
        break;
      }
      case 'company.updated': {
        const c = s.companies[p.id || ev.actor]; if (c) Object.assign(c, p);
        break;
      }
      case 'school.created':
        s.schools[p.id] = { id: p.id, name: p.name, slug: p.slug || slugify(p.name) };
        break;
      case 'position.added':
        s.positions[p.id] = { ...p, userId: p.userId || ev.actor };
        break;
      case 'education.added':
        s.educations[p.id] = { ...p, userId: p.userId || ev.actor };
        break;
      case 'skill.added': {
        const uidx = p.userId || ev.actor;
        const sk = skillByName(s, p.name);
        s.userSkills[uidx] = s.userSkills[uidx] || [];
        if (!s.userSkills[uidx].some(x => x.skillId === sk.id))
          s.userSkills[uidx].push({ skillId: sk.id, endorsers: [] });
        break;
      }
      case 'endorsement.added': {
        const list = s.userSkills[p.userId] || [];
        const entry = list.find(x => x.skillId === (p.skillId || slugify(p.skill || '')));
        if (entry && !entry.endorsers.includes(ev.actor)) {
          entry.endorsers.push(ev.actor);
          const n = ensureNotif(s, `endorse:${p.skillId}:${p.userId}`, {
            userId: p.userId, type: 'endorsement', targetKey: p.skillId, meta: { skillId: p.skillId },
          });
          addActor(n, ev.actor, ev.t);
        }
        break;
      }
      case 'connection.invited': {
        const k = pairKey(ev.actor, p.target);
        s.connections[k] = { a: [ev.actor, p.target].sort()[0], b: [ev.actor, p.target].sort()[1],
          status: 'pending', requester: ev.actor, target: p.target, t: ev.t, note: p.note || '' };
        s.inviteLog.push({ requester: ev.actor, t: ev.t, withdrawn: false });
        const n = ensureNotif(s, `invite:${ev.actor}:${p.target}`, {
          userId: p.target, type: 'invite', targetKey: ev.actor, meta: { from: ev.actor, note: p.note || '' },
        });
        addActor(n, ev.actor, ev.t);
        break;
      }
      case 'connection.accepted': {
        const k = pairKey(ev.actor, p.target);
        if (s.connections[k]) { s.connections[k].status = 'accepted'; s.connections[k].acceptedAt = ev.t; }
        const requester = s.connections[k]?.requester || p.target;
        const n = ensureNotif(s, `accept:${k}`, {
          userId: requester, type: 'accept', targetKey: ev.actor, meta: { by: ev.actor },
        });
        addActor(n, ev.actor, ev.t);
        break;
      }
      case 'connection.removed':
        delete s.connections[pairKey(ev.actor, p.target)];
        break;
      case 'invite.withdrawn': {
        const k = pairKey(ev.actor, p.target);
        // Keep the record (marked withdrawn) so the Sent tab can show it and
        // the rolling window still counts it; connection.removed is what deletes.
        if (s.connections[k]) s.connections[k].status = 'withdrawn';
        const li = s.inviteLog.find(x => x.requester === ev.actor && !x.withdrawn);
        if (li) li.withdrawn = true; // still counts toward window
        break;
      }
      case 'follow.added':
        s.follows[ev.actor] = s.follows[ev.actor] || {};
        s.follows[ev.actor][p.target] = { type: p.targetType || 'user', t: ev.t };
        break;
      case 'follow.removed':
        if (s.follows[ev.actor]) delete s.follows[ev.actor][p.target];
        break;
      case 'post.created': {
        s.posts[p.id] = {
          id: p.id, authorId: ev.actor, authorType: p.authorType || 'user',
          text: p.text || '', media: p.media || null, visibility: p.visibility || 'anyone',
          t: ev.t, repostOf: null, quote: null, mentions: p.mentions || [], hashtags: p.hashtags || [],
        };
        (p.hashtags || []).forEach(h => { s.hashtags[h] = (s.hashtags[h] || 0) + 1; });
        break;
      }
      case 'post.reposted': {
        s.posts[p.id] = {
          id: p.id, authorId: ev.actor, authorType: p.authorType || 'user',
          text: p.quote || '', media: null, visibility: 'anyone', t: ev.t,
          repostOf: p.original, quote: p.quote || null, mentions: [], hashtags: [],
        };
        break;
      }
      case 'comment.added': {
        s.comments[p.id] = {
          id: p.id, postId: p.postId, parentId: p.parentId || null,
          authorId: ev.actor, text: p.text || '', t: ev.t, mentions: p.mentions || [],
        };
        const post = s.posts[p.postId];
        if (post && post.authorType === 'user' && post.authorId !== ev.actor) {
          const n = ensureNotif(s, `comment:${p.postId}`, {
            userId: post.authorId, type: 'comment', targetKey: p.postId, meta: { postId: p.postId },
          });
          addActor(n, ev.actor, ev.t);
        }
        break;
      }
      case 'reaction.added': {
        const tk = p.targetKey || `post:${p.postId}`;
        s.reactions[tk] = s.reactions[tk] || {};
        s.reactions[tk][ev.actor] = p.reaction || 'like';
        // Notification to post author
        if (tk.startsWith('post:')) {
          const post = s.posts[tk.slice(5)];
          if (post && post.authorType === 'user' && post.authorId !== ev.actor) {
            const n = ensureNotif(s, `react:${post.id}`, {
              userId: post.authorId, type: 'reaction', targetKey: post.id, meta: { postId: post.id },
            });
            addActor(n, ev.actor, ev.t);
          }
        }
        break;
      }
      case 'reaction.removed': {
        const tk = p.targetKey || `post:${p.postId}`;
        if (s.reactions[tk]) delete s.reactions[tk][ev.actor];
        break;
      }
      case 'job.created':
        s.jobs[p.id] = {
          id: p.id, title: p.title, companyId: p.companyId, posterId: ev.actor,
          workMode: p.workMode, seniority: p.seniority, location: p.location || '',
          salaryBand: p.salaryBand || null, description: p.description || '', t: ev.t,
        };
        break;
      case 'job.applied': {
        s.applications[p.id] = {
          id: p.id, jobId: p.jobId, applicantId: ev.actor, stage: 'Applied', t: ev.t,
          profileSnapshot: p.profileSnapshot, history: [{ stage: 'Applied', t: ev.t }],
        };
        break;
      }
      case 'application.stageChanged': {
        const app = s.applications[p.applicationId];
        if (app) {
          app.stage = p.stage;
          app.history.push({ stage: p.stage, t: ev.t, by: ev.actor });
          const n = ensureNotif(s, `stage:${p.applicationId}:${p.stage}`, {
            userId: app.applicantId, type: 'stage', targetKey: p.applicationId,
            meta: { stage: p.stage, jobId: app.jobId },
          });
          addActor(n, ev.actor, ev.t);
        }
        break;
      }
      case 'message.sent': {
        const conv = s.conversations[p.convId];
        if (!conv) {
          s.conversations[p.convId] = {
            id: p.convId, participants: p.participants || [ev.actor, p.to],
            request: p.request || false, t: ev.t, creditSpent: p.creditSpent || false,
          };
        }
        s.messages[p.id] = {
          id: p.id, convId: p.convId, senderId: ev.actor, text: p.text || '',
          t: ev.t, readBy: [ev.actor], embedPost: p.embedPost || null,
        };
        const c = s.conversations[p.convId];
        c.t = ev.t;
        // A reply from the request recipient refunds the requester's credit.
        if (c.request && c.creditSpent && ev.actor !== c.requester && c.requester) {
          const ent = s.entitlements[c.requester];
          if (ent && !c.creditRefunded) { ent.credits += 1; c.creditRefunded = true; c.request = false; }
        }
        if (p.creditSpent) { c.requester = ev.actor;
          const ent = s.entitlements[ev.actor]; if (ent) ent.credits = Math.max(0, ent.credits - 1); }
        break;
      }
      case 'message.read': {
        Object.values(s.messages).forEach(m => {
          if (m.convId === p.convId && m.t <= p.upTo && !m.readBy.includes(ev.actor)) m.readBy.push(ev.actor);
        });
        break;
      }
      case 'user.blocked':
        s.blocks[ev.actor] = s.blocks[ev.actor] || [];
        if (!s.blocks[ev.actor].includes(p.target)) s.blocks[ev.actor].push(p.target);
        // blocking severs any connection
        delete s.connections[pairKey(ev.actor, p.target)];
        break;
      case 'user.unblocked':
        if (s.blocks[ev.actor]) s.blocks[ev.actor] = s.blocks[ev.actor].filter(x => x !== p.target);
        break;
      case 'settings.changed':
        s.settings[ev.actor] = { ...(s.settings[ev.actor] || {}), ...p };
        break;
      case 'profile.viewed':
        if (ev.actor !== p.target) {
          s.profileViews[p.target] = s.profileViews[p.target] || [];
          s.profileViews[p.target].unshift({ viewerId: ev.actor, t: ev.t, mode: p.mode || 'full' });
        }
        break;
      case 'notification.read': {
        if (p.all && p.userId) {
          Object.values(s.notifications).forEach(n => { if (n.userId === p.userId) n.read = true; });
        } else if (p.aggKey && s.notifications[p.aggKey]) {
          s.notifications[p.aggKey].read = true;
        }
        break;
      }
      default: break;
    }
  }
  // sorted post order (newest first) for cursoring convenience
  s.order.posts = Object.values(s.posts).sort((a, b) => b.t - a.t).map(p => p.id);
  return s;
}

/* ---------- selectors ---------- */
export const sel = {
  users: () => Object.values(getState().users),
  user: (id) => getState().users[id],
  userBySlug: (slug) => Object.values(getState().users).find(u => u.slug === slug),
  company: (id) => getState().companies[id],
  companyBySlug: (slug) => Object.values(getState().companies).find(c => c.slug === slug),
  companies: () => Object.values(getState().companies),
  school: (id) => getState().schools[id],
  actor: (id) => getState().users[id] || getState().companies[id],

  entitlement: (id) => getState().entitlements[id] || { tier: 'free', credits: 0 },
  settings: (id) => getState().settings[id] || { viewingMode: 'full', connectionsVisibility: 'connections', activityBroadcast: true },

  // accepted connection partner ids for a user
  connectionsOf(id) {
    const st = getState();
    const out = [];
    for (const c of Object.values(st.connections)) {
      if (c.status !== 'accepted') continue;
      if (c.a === id) out.push(c.b);
      else if (c.b === id) out.push(c.a);
    }
    return out;
  },
  connectionCount(id) { return this.connectionsOf(id).length; },
  connectionStatus(viewer, other) {
    const c = getState().connections[pairKey(viewer, other)];
    if (!c) return { status: 'none' };
    if (c.status === 'accepted') return { status: 'connected' };
    return { status: c.requester === viewer ? 'pending-sent' : 'pending-received', note: c.note };
  },
  pendingReceived(id) {
    return Object.values(getState().connections)
      .filter(c => c.status === 'pending' && c.target === id)
      .sort((a, b) => b.t - a.t);
  },
  pendingSent(id) {
    return Object.values(getState().connections)
      .filter(c => c.status === 'pending' && c.requester === id)
      .sort((a, b) => b.t - a.t);
  },
  withdrawnSent(id) {
    return Object.values(getState().connections)
      .filter(c => c.status === 'withdrawn' && c.requester === id)
      .sort((a, b) => b.t - a.t);
  },
  isFollowing(follower, target) { return !!(getState().follows[follower] || {})[target]; },
  followersOf(targetId) {
    const st = getState();
    return Object.keys(st.follows).filter(f => st.follows[f] && st.follows[f][targetId]);
  },
  followCount(targetId) { return this.followersOf(targetId).length; },

  // Blocking: invisible both ways.
  areBlocked(a, b) {
    const st = getState();
    return (st.blocks[a] || []).includes(b) || (st.blocks[b] || []).includes(a);
  },
  blockList(id) { return getState().blocks[id] || []; },

  post: (id) => getState().posts[id],
  reactionsFor(targetKey) { return getState().reactions[targetKey] || {}; },
  myReaction(targetKey, userId) { return (getState().reactions[targetKey] || {})[userId] || null; },
  commentsFor(postId) {
    return Object.values(getState().comments).filter(c => c.postId === postId).sort((a, b) => a.t - b.t);
  },

  positionsOf(id) { return Object.values(getState().positions).filter(p => p.userId === id); },
  currentPosition(id) { return this.positionsOf(id).find(p => p.current) || this.positionsOf(id)[0]; },
  educationsOf(id) { return Object.values(getState().educations).filter(e => e.userId === id); },
  skillsOf(id) {
    const st = getState();
    return (st.userSkills[id] || []).map(x => ({ ...x, name: st.skills[x.skillId]?.name || x.skillId }));
  },

  jobs: () => Object.values(getState().jobs),
  job: (id) => getState().jobs[id],
  jobsByPoster(id) { return this.jobs().filter(j => j.posterId === id); },
  applicationsForJob(jobId) { return Object.values(getState().applications).filter(a => a.jobId === jobId); },
  applicationsByUser(id) { return Object.values(getState().applications).filter(a => a.applicantId === id); },
  hasApplied(userId, jobId) { return this.applicationsByUser(userId).some(a => a.jobId === jobId); },

  conversationsOf(id) {
    return Object.values(getState().conversations)
      .filter(c => c.participants.includes(id))
      .sort((a, b) => b.t - a.t);
  },
  messagesIn(convId) {
    return Object.values(getState().messages).filter(m => m.convId === convId).sort((a, b) => a.t - b.t);
  },
  unreadMessageCount(id) {
    const st = getState();
    let n = 0;
    for (const c of this.conversationsOf(id)) {
      for (const m of this.messagesIn(c.id)) {
        if (m.senderId !== id && !m.readBy.includes(id)) { n++; }
      }
    }
    return n;
  },

  notificationsFor(id) {
    return Object.values(getState().notifications)
      .filter(n => n.userId === id && n.actors.length)
      .sort((a, b) => b.t - a.t);
  },
  unreadNotifications(id) { return this.notificationsFor(id).filter(n => !n.read).length; },

  profileViewsOf(id) { return getState().profileViews[id] || []; },
};

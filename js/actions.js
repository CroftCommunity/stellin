// actions.js — every user-visible mutation dispatches through here.
// Each action forms an event and appends it via run() so the dev-bar latency
// and fail-next one-shot exercise optimistic UI and error paths.
import { append, uid, getDevPrefs, sel, getState } from './store.js';
import { run } from './latency.js';
import { RATE } from './engines/ratelimit.js';

export function me() { return getDevPrefs().persona; }

function ev(type, payload, actor) {
  return { id: uid(), t: Date.now(), actor: actor ?? me(), type, payload };
}

// Generic: commit an event honoring latency/fail-next.
async function commit(event) { await run(() => append(event)); return event; }

export const actions = {
  // ---- posts / social ----
  createPost({ text, media = null, visibility = 'anyone', mentions = [], hashtags = [], authorType = 'user' }, authorId) {
    return commit(ev('post.created', { id: uid('post'), text, media, visibility, mentions, hashtags, authorType }, authorId ?? me()));
  },
  repost(originalId, quote = null) {
    return commit(ev('post.reposted', { id: uid('post'), original: originalId, quote }));
  },
  comment(postId, text, parentId = null, mentions = []) {
    return commit(ev('comment.added', { id: uid('c'), postId, parentId, text, mentions }));
  },
  react(targetKey, reaction) {
    return commit(ev('reaction.added', { targetKey, reaction }));
  },
  unreact(targetKey) {
    return commit(ev('reaction.removed', { targetKey }));
  },

  // ---- connections ----
  invite(target, note = '') {
    // rate limit is enforced by the caller (network screen) via ratelimit engine;
    // here we still block hard at cap as a safety net.
    const count = RATE.windowCount(me());
    if (count >= RATE.HARD) return Promise.reject(new Error('cap'));
    return commit(ev('connection.invited', { target, note }));
  },
  accept(requester) {
    // actor accepts an invite FROM requester -> target is requester
    return commit(ev('connection.accepted', { target: requester }));
  },
  ignoreInvite(requester) {
    // remove the pending pair (actor is the target ignoring)
    return commit(ev('connection.removed', { target: requester }));
  },
  withdraw(target) {
    return commit(ev('invite.withdrawn', { target }));
  },
  removeConnection(target) {
    return commit(ev('connection.removed', { target }));
  },
  follow(target, targetType = 'user') {
    return commit(ev('follow.added', { target, targetType }));
  },
  unfollow(target) {
    return commit(ev('follow.removed', { target }));
  },

  // ---- entities (typeahead "add new" fallback creates an unverified entity) ----
  addCompany(name) {
    const id = 'co_' + uid();
    append(ev('company.created', { id, name, industry: '', unverified: true }, 'system'));
    return id;
  },
  addSchool(name) {
    const id = 'sch_' + uid();
    append(ev('school.created', { id, name, unverified: true }, 'system'));
    return id;
  },
  updateCompany(companyId, patch) {
    return commit(ev('company.updated', { id: companyId, ...patch }, companyId));
  },

  // ---- signup ----
  createPersona({ id, name, headline, tier = 'free', location = '', about = '' }) {
    append(ev('user.created', { id, name, headline, tier, location, about }, 'system'));
    return id;
  },

  // ---- profile ----
  updateProfile(patch, userId) {
    return commit(ev('profile.updated', patch, userId ?? me()));
  },
  addPosition(pos) {
    return commit(ev('position.added', { id: uid('pos'), current: false, ...pos, userId: me() }));
  },
  addEducation(edu) {
    return commit(ev('education.added', { id: uid('edu'), ...edu, userId: me() }));
  },
  addSkill(name) {
    return commit(ev('skill.added', { name, userId: me() }));
  },
  endorse(userId, skillId) {
    return commit(ev('endorsement.added', { userId, skillId }));
  },

  // ---- jobs ----
  createJob(job) {
    return commit(ev('job.created', { id: uid('job'), ...job }));
  },
  apply(jobId, profileSnapshot) {
    return commit(ev('job.applied', { id: uid('app'), jobId, profileSnapshot }));
  },
  changeStage(applicationId, stage) {
    return commit(ev('application.stageChanged', { applicationId, stage }));
  },

  // ---- messaging ----
  sendMessage({ convId, to, text, request = false, creditSpent = false, embedPost = null, participants }) {
    return commit(ev('message.sent', {
      id: uid('m'), convId, to, text, request, creditSpent, embedPost,
      participants: participants || (to ? [me(), to] : undefined),
    }));
  },
  markRead(convId, upTo = Date.now()) {
    return commit(ev('message.read', { convId, upTo }));
  },

  // ---- privacy ----
  block(target) { return commit(ev('user.blocked', { target })); },
  unblock(target) { return commit(ev('user.unblocked', { target })); },
  changeSettings(patch) { return commit(ev('settings.changed', patch)); },
  logProfileView(target, mode) {
    // fire-and-forget, no latency gating
    append(ev('profile.viewed', { target, mode }));
  },

  // ---- notifications ----
  markNotifsRead(userId) {
    append(ev('notification.read', { all: true, userId }, 'system'));
  },
  markNotifRead(aggKey) {
    append(ev('notification.read', { aggKey }, 'system'));
  },
};

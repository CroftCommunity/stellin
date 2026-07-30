// notify.js — notification presentation. Aggregation happens in the reducer
// (one row per (type, target) folding actors + count). Here we render human
// text and expose the unread selector for the nav badge.
import { sel, getState } from '../store.js';

export function unreadCount(userId) { return sel.unreadNotifications(userId); }

export function notifText(n) {
  const st = getState();
  // Aggregated rows read best with first names, matching the product's voice
  // ("Elena and 2 others reacted to your post").
  const firstName = (a) => (st.users[a]?.name || 'Someone').split(' ')[0];
  const lead = firstName(n.actors[0]);
  const others = n.actors.length - 1;
  const who = others > 0 ? `${lead} and ${others} other${others > 1 ? 's' : ''}` : lead;
  switch (n.type) {
    case 'reaction': return `${who} reacted to your post`;
    case 'comment': return `${who} commented on your post`;
    case 'invite': return `${lead} wants to connect`;
    case 'accept': return `${lead} accepted your invitation`;
    case 'endorsement': return `${who} endorsed you for ${st.skills[n.meta?.skillId]?.name || 'a skill'}`;
    case 'stage': return `Your application moved to ${n.meta?.stage}`;
    default: return `${who} interacted with you`;
  }
}

export function notifLink(n) {
  switch (n.type) {
    case 'reaction':
    case 'comment': return '#/feed';
    case 'invite': return '#/network';
    case 'accept': return '#/network?tab=connections';
    case 'stage': return '#/jobs';
    case 'endorsement': return '#/me';
    default: return '#/notifications';
  }
}

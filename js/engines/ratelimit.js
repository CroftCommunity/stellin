// ratelimit.js — invites in a rolling 7-day window. Soft warning at 80,
// hard block at 100. Withdrawn invites still count toward the window.
import { getState } from '../store.js';

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const RATE = {
  SOFT: 80,
  HARD: 100,
  windowCount(userId, now = Date.now()) {
    const log = getState().inviteLog || [];
    return log.filter(x => x.requester === userId && (now - x.t) < WINDOW_MS).length;
  },
  status(userId) {
    const n = this.windowCount(userId);
    if (n >= this.HARD) return { level: 'hard', count: n };
    if (n >= this.SOFT) return { level: 'soft', count: n };
    return { level: 'ok', count: n };
  },
};

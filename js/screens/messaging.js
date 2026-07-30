// messaging.js — inbox with Focused and Requests tabs, optimistic send,
// read-on-view, and cold-outreach credit gating.
import { el, h1, timeAgo, emptyState, clear } from '../ui/dom.js';
import { sel, getState } from '../store.js';
import { me, actions } from '../actions.js';
import { avatar } from '../ui/avatar.js';
import { degreeBadge } from '../ui/degreeBadge.js';
import { toast } from '../ui/toast.js';
import { tabsBar } from '../ui/tabs.js';
import { openModal } from '../ui/modal.js';
import { frontierChip } from '../ui/frontierChip.js';
import { postCard } from '../ui/postCard.js';
import { navigate } from '../router.js';

export default function messaging(outlet, ctx) {
  const viewer = me();
  if (!viewer) { location.hash = '#/'; return; }

  // ?to=<id> opens/creates a conversation
  let activeConv = ctx.query.c || null;
  if (ctx.query.to) {
    const other = ctx.query.to;
    const convId = 'conv_' + [viewer, other].sort().join('_');
    activeConv = convId;
  }
  let tab = ctx.query.tab || 'focused';

  const screen = el('div', { class: 'screen messaging-screen' });
  screen.appendChild(el('h1', { class: 'sr-only', tabindex: '-1' }, ['Messaging']));

  const layout = el('div', { class: 'msg-layout' + (activeConv ? ' has-active' : '') });
  const listPane = el('aside', { class: 'msg-list-pane card' });
  const threadPane = el('section', { class: 'msg-thread-pane card' });
  layout.append(listPane, threadPane);
  screen.appendChild(layout);
  outlet.appendChild(screen);

  function drawList() {
    clear(listPane);
    const convs = sel.conversationsOf(viewer);
    const focused = convs.filter(c => !(c.request && c.requester !== viewer));
    const requests = convs.filter(c => c.request && c.requester !== viewer);
    const tabs = [
      { id: 'focused', label: 'Focused' },
      { id: 'requests', label: 'Requests', badge: requests.length || null },
    ];
    listPane.appendChild(el('div', { class: 'msg-list-head' }, [
      el('strong', {}, ['Messaging']),
      el('button', { class: 'btn btn-outline btn-sm', onclick: () => openNewMessage(viewer, (cid) => { activeConv = cid; drawAll(); }) }, ['New']),
    ]));
    listPane.appendChild(tabsBar(tabs, tab, (id) => { tab = id; drawList(); }));
    const items = tab === 'focused' ? focused : requests;
    const box = el('div', { class: 'msg-conv-list' });
    if (!items.length) box.appendChild(emptyState('💬', tab === 'requests' ? 'No requests' : 'No conversations', tab === 'requests' ? 'Message requests from people outside your network land here.' : 'Start a conversation from a connection’s profile.'));
    items.forEach(c => box.appendChild(convRow(c, viewer, activeConv, (cid) => { activeConv = cid; drawAll(); })));
    listPane.appendChild(box);
  }

  function drawThread() {
    clear(threadPane);
    if (!activeConv) { threadPane.appendChild(el('div', { class: 'msg-empty state-block' }, [el('div', { class: 'state-icon' }, ['✉']), el('p', {}, ['Select a conversation to read and reply.'])])); return; }
    threadPane.appendChild(threadView(activeConv, viewer, () => { activeConv = null; drawAll(); }));
    // mark read on view
    actions.markRead(activeConv);
  }

  function drawAll() {
    layout.classList.toggle('has-active', !!activeConv);
    // reflect in URL without full nav
    drawList(); drawThread();
  }
  drawAll();
}

function otherParticipant(conv, viewer) { return conv.participants.find(p => p !== viewer) || conv.participants[0]; }

function convRow(conv, viewer, activeConv, onOpen) {
  const otherId = otherParticipant(conv, viewer);
  const u = sel.user(otherId);
  const msgs = sel.messagesIn(conv.id);
  const last = msgs[msgs.length - 1];
  const unread = msgs.some(m => m.senderId !== viewer && !m.readBy.includes(viewer));
  const row = el('button', { class: 'conv-row' + (conv.id === activeConv ? ' is-active' : '') + (unread ? ' is-unread' : ''), onclick: () => onOpen(conv.id) }, [
    avatar(u, 'md', { decorative: true }),
    el('div', { class: 'grow conv-row-body' }, [
      el('div', { class: 'row-between' }, [el('span', { class: 'strong' }, [u?.name || 'Unknown']), el('span', { class: 'subtle small' }, [last ? timeAgo(last.t) : ''])]),
      el('div', { class: 'small muted truncate' }, [last ? (last.senderId === viewer ? 'You: ' : '') + (last.embedPost ? 'Shared a post' : last.text) : 'No messages yet']),
    ]),
    unread ? el('span', { class: 'unread-dot', 'aria-label': 'Unread' }) : false,
  ]);
  return row;
}

function threadView(convId, viewer, onBack) {
  const conv = getState().conversations[convId];
  let otherId;
  if (conv) otherId = otherParticipant(conv, viewer);
  else if (convId.startsWith('conv_')) otherId = convId.replace('conv_', '').split('_').find(p => p !== viewer);
  const other = sel.user(otherId);
  const wrap = el('div', { class: 'thread' });

  const nameRow = el('div', { class: 'row', style: { gap: '6px' } }, [el('a', { href: '#/in/' + other?.slug, class: 'strong' }, [other?.name || 'Unknown'])]);
  const b = degreeBadge(viewer, other?.id); if (b.textContent !== '') nameRow.append(document.createTextNode('·'), b);
  wrap.appendChild(el('div', { class: 'thread-head' }, [
    el('button', { class: 'btn-icon thread-back', 'aria-label': 'Back to conversations', onclick: onBack }, ['‹']),
    avatar(other, 'sm', { decorative: true }),
    el('div', { class: 'grow' }, [nameRow, el('div', { class: 'small muted' }, [other?.headline || ''])]),
    frontierChip('typing-indicator'),
  ]));

  const msgs = conv ? sel.messagesIn(convId) : [];
  const body = el('div', { class: 'thread-body' });
  if (conv && conv.request && conv.requester !== viewer) {
    body.appendChild(el('div', { class: 'request-banner small' }, [`${other?.name} is not in your network. Replying will move this to Focused.`]));
  }
  msgs.forEach(m => body.appendChild(bubble(m, viewer)));
  wrap.appendChild(body);
  requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });

  // composer with cold-outreach gating
  wrap.appendChild(threadComposer(convId, viewer, other, conv, body));
  return wrap;
}

function bubble(m, viewer) {
  const mine = m.senderId === viewer;
  const inner = el('div', { class: 'bubble' + (mine ? ' mine' : '') });
  if (m.text) inner.appendChild(el('div', {}, [m.text]));
  if (m.embedPost) inner.appendChild(el('div', { class: 'bubble-embed' }, [postCard(m.embedPost)]));
  inner.appendChild(el('div', { class: 'bubble-time subtle' }, [timeAgo(m.t) + (mine && m.readBy.length > 1 ? ' · Read' : '')]));
  return el('div', { class: 'bubble-row' + (mine ? ' mine' : '') }, [inner]);
}

function threadComposer(convId, viewer, other, conv, body) {
  const otherId = other?.id;
  const connected = otherId && sel.connectionStatus(viewer, otherId).status === 'connected';
  const isNewToNonConnection = !conv && !connected;
  const credits = sel.entitlement(viewer).credits;

  // zero credits + cold outreach -> gate with upsell
  if (isNewToNonConnection && credits <= 0) {
    return el('div', { class: 'thread-composer gated' }, [
      el('div', { class: 'card card-pad upsell' }, [
        el('strong', {}, ['Out of outreach credits']),
        el('p', { class: 'small muted' }, [`Messaging people outside your network needs an outreach credit. You have ${credits}.`]),
        frontierChip('premium-checkout', 'get more credits'),
      ]),
    ]);
  }

  const ta = el('textarea', { class: 'textarea', rows: '1', placeholder: 'Write a message…', 'aria-label': 'Message text' });
  const send = el('button', { class: 'btn btn-primary', disabled: true }, ['Send']);
  ta.addEventListener('input', () => { send.disabled = !ta.value.trim(); ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!send.disabled) send.click(); } });

  send.addEventListener('click', async () => {
    const text = ta.value.trim(); if (!text) return;
    const willSpend = isNewToNonConnection && credits > 0;
    // optimistic bubble
    const optimistic = el('div', { class: 'bubble-row mine' }, [el('div', { class: 'bubble mine sending' }, [el('div', {}, [text]), el('div', { class: 'bubble-time subtle' }, ['Sending…'])])]);
    body.appendChild(optimistic); body.scrollTop = body.scrollHeight;
    ta.value = ''; ta.style.height = 'auto'; send.disabled = true;
    try {
      await actions.sendMessage({ convId, to: otherId, text, request: willSpend, creditSpent: willSpend, participants: [viewer, otherId] });
      if (willSpend) toast('Message sent. 1 outreach credit used.', { type: 'success' });
    } catch (e) {
      optimistic.querySelector('.bubble').classList.add('failed');
      optimistic.querySelector('.bubble-time').textContent = 'Failed';
      const retry = el('button', { class: 'link-btn', onclick: () => { ta.value = text; optimistic.remove(); ta.focus(); } }, ['Retry']);
      optimistic.querySelector('.bubble').appendChild(retry);
      toast('Message failed to send.', { type: 'danger' });
    }
  });

  return el('div', { class: 'thread-composer' }, [ta, send]);
}

function openNewMessage(viewer, onOpen) {
  const conns = sel.connectionsOf(viewer);
  const body = el('div', { class: 'stack' });
  if (!conns.length) body.appendChild(el('p', { class: 'muted' }, ['Connect with people to message them.']));
  conns.forEach(id => {
    const u = sel.user(id);
    body.appendChild(el('button', { class: 'btn btn-ghost btn-block', style: { justifyContent: 'flex-start' }, onclick: () => { h.close(); onOpen('conv_' + [viewer, id].sort().join('_')); } }, [avatar(u, 'sm', { decorative: true }), ' ' + u.name]));
  });
  const h = openModal({ title: 'New message', body });
}

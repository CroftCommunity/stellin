// postCard.js — renders a post: author block + degree badge, clamped text
// with "…see more", media, social-proof line, action bar, and comments.
import { el, timeAgo } from './dom.js';
import { sel, getState } from '../store.js';
import { me, actions } from '../actions.js';
import { avatar, companyAvatar } from './avatar.js';
import { degreeBadge } from './degreeBadge.js';
import { attachHoverCard } from './hoverCard.js';
import { attachReactionPicker, reactionByKey, REACTIONS } from './reactionPicker.js';
import { toast } from './toast.js';
import { openModal } from './modal.js';
import { renderMedia } from './media.js';

export function postCard(postId, opts = {}) {
  const post = sel.post(postId);
  const viewer = me();
  if (!post) return el('div');
  const isCompany = post.authorType === 'company';
  const author = isCompany ? sel.company(post.authorId) : sel.user(post.authorId);
  if (!author) return el('div');
  // blocking: never render blocked authors' posts
  if (!isCompany && viewer && sel.areBlocked(viewer, post.authorId)) return el('div');

  const card = el('article', { class: 'card post-card', 'data-post': postId });

  // ---- header ----
  const av = isCompany ? companyAvatar(author, 'md', { decorative: true }) : avatar(author, 'md', { decorative: true });
  const avLink = el('a', { href: authorHref(author, isCompany), 'aria-label': author.name }, [av]);

  const nameLink = el('a', { href: authorHref(author, isCompany), class: 'post-author-name' }, [author.name]);
  if (!isCompany) attachHoverCard(nameLink, post.authorId);
  const nameRow = el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, [nameLink]);
  if (!isCompany && viewer) { const b = degreeBadge(viewer, post.authorId); if (b.textContent !== '') nameRow.append(dot(), b); }

  const sub = isCompany ? (author.tagline || author.industry) : author.headline;
  const header = el('div', { class: 'post-head' }, [
    avLink,
    el('div', { class: 'grow' }, [
      nameRow,
      el('div', { class: 'small muted' }, [sub || '']),
      el('div', { class: 'small subtle' }, [timeAgo(post.t) + ' · ' + (post.visibility === 'connections' ? 'Connections' : 'Anyone')]),
    ]),
    postMenu(post, viewer),
  ]);
  card.appendChild(header);

  // ---- quote-repost embed ----
  if (post.repostOf) {
    if (post.quote) card.appendChild(el('div', { class: 'post-body' }, [clampText(post.quote)]));
    const orig = sel.post(post.repostOf);
    if (orig) card.appendChild(el('div', { class: 'quote-embed' }, [postCardMini(post.repostOf)]));
  } else {
    // ---- text ----
    if (post.text) card.appendChild(el('div', { class: 'post-body' }, [clampText(post.text)]));
    // ---- media ----
    const media = renderMedia(post.media, post);
    if (media) card.appendChild(media);
  }

  // ---- social proof ----
  card.appendChild(socialProof(postId, viewer));

  // ---- action bar ----
  card.appendChild(actionBar(postId, viewer, card));

  // ---- comments ----
  if (opts.expandComments) card.appendChild(commentsSection(postId, viewer));
  else {
    const cCount = sel.commentsFor(postId).length;
    const holder = el('div', { class: 'comments-holder' });
    card.appendChild(holder);
    // lazily render comments on demand via action bar comment button (see actionBar)
    card._openComments = () => { if (!holder.firstChild) holder.appendChild(commentsSection(postId, viewer)); holder.querySelector('textarea')?.focus(); };
  }
  return card;
}

function postCardMini(postId) {
  const post = sel.post(postId);
  if (!post) return el('div', { class: 'muted' }, ['Original post unavailable']);
  const isCompany = post.authorType === 'company';
  const author = isCompany ? sel.company(post.authorId) : sel.user(post.authorId);
  return el('div', {}, [
    el('div', { class: 'row', style: { gap: '8px', marginBottom: '6px' } }, [
      (isCompany ? companyAvatar : avatar)(author, 'sm', { decorative: true }),
      el('a', { href: authorHref(author, isCompany), class: 'strong small' }, [author?.name || 'Unknown']),
    ]),
    post.text ? el('div', { class: 'small' }, [clampText(post.text, 2)]) : false,
    renderMedia(post.media, post, true) || false,
  ]);
}

function authorHref(author, isCompany) { return isCompany ? '#/company/' + author.slug : '#/in/' + author.slug; }
function dot() { const s = el('span', { class: 'subtle', 'aria-hidden': 'true' }, ['·']); return s; }

// clamp with see-more toggle
function clampText(text, lines = 3) {
  const wrap = el('div', {});
  const body = el('div', { class: 'post-text clamp-' + lines });
  body.innerHTML = linkify(text);
  wrap.appendChild(body);
  // detect overflow after mount
  requestAnimationFrame(() => {
    if (body.scrollHeight - body.clientHeight > 4) {
      const more = el('button', { class: 'see-more', onclick: () => {
        body.classList.remove('clamp-' + lines); more.remove();
      } }, ['…see more']);
      wrap.appendChild(more);
    }
  });
  return wrap;
}

function linkify(text) {
  const esc = String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return esc
    .replace(/#(\w+)/g, '<a href="#/search?q=%23$1">#$1</a>')
    .replace(/@\[([^\]]+)\]\(([^)]+)\)/g, '<a href="#/in/$2">@$1</a>')
    .replace(/\n/g, '<br>');
}

function socialProof(postId, viewer) {
  const reacts = sel.reactionsFor(`post:${postId}`);
  const keys = Object.keys(reacts);
  const commentCount = sel.commentsFor(postId).length;
  const row = el('div', { class: 'social-proof small subtle' });
  if (keys.length) {
    const kinds = [...new Set(Object.values(reacts))].slice(0, 3).map(k => reactionByKey(k)?.emoji || '👍');
    const mineIn = viewer && reacts[viewer];
    let label;
    if (mineIn) {
      const others = keys.length - 1;
      label = others > 0 ? `You and ${others} other${others > 1 ? 's' : ''}` : 'You';
    } else {
      const first = sel.user(keys[0])?.name || 'Someone';
      const others = keys.length - 1;
      label = others > 0 ? `${first} and ${others} other${others > 1 ? 's' : ''}` : first;
    }
    row.append(el('span', { class: 'proof-emojis', 'aria-hidden': 'true' }, [kinds.join('')]), document.createTextNode(' ' + label));
  }
  const right = el('span', { class: 'grow', style: { textAlign: 'right' } }, [
    commentCount ? `${commentCount} comment${commentCount > 1 ? 's' : ''}` : '',
  ]);
  const wrap = el('div', { class: 'social-proof-row' }, [row, right]);
  return wrap;
}

function actionBar(postId, viewer, card) {
  const bar = el('div', { class: 'action-bar' });
  const targetKey = `post:${postId}`;
  const mine = viewer ? sel.myReaction(targetKey, viewer) : null;

  // React button
  const reactBtn = el('button', { class: 'action-btn' + (mine ? ' reacted' : ''), 'aria-haspopup': 'true' });
  const rObj = mine ? reactionByKey(mine) : null;
  reactBtn.innerHTML = `<span class="act-ic">${rObj ? rObj.emoji : '👍'}</span><span>${rObj ? rObj.label : 'Like'}</span>`;
  if (rObj) reactBtn.style.color = rObj.color;
  reactBtn.disabled = !viewer;
  // plain tap toggles like
  reactBtn.addEventListener('click', () => {
    if (!viewer) return;
    const current = sel.myReaction(targetKey, viewer);
    if (current) applyReaction(targetKey, null, viewer, card);
    else applyReaction(targetKey, 'like', viewer, card);
  });
  if (viewer) attachReactionPicker(reactBtn, (key) => applyReaction(targetKey, key, viewer, card));

  const commentBtn = el('button', { class: 'action-btn' }, [span('💬'), 'Comment']);
  commentBtn.disabled = !viewer;
  commentBtn.addEventListener('click', () => { card._openComments ? card._openComments() : null; });

  const repostBtn = el('button', { class: 'action-btn' }, [span('🔁'), 'Repost']);
  repostBtn.disabled = !viewer;
  repostBtn.addEventListener('click', () => openRepost(postId, viewer));

  const sendBtn = el('button', { class: 'action-btn' }, [span('✉'), 'Send']);
  sendBtn.disabled = !viewer;
  sendBtn.addEventListener('click', () => openSendPost(postId, viewer));

  bar.append(reactBtn, commentBtn, repostBtn, sendBtn);
  return bar;
}
function span(t) { return el('span', { class: 'act-ic', 'aria-hidden': 'true' }, [t]); }

async function applyReaction(targetKey, key, viewer, card) {
  // optimistic: paint immediately, revert on failure
  const bar = card.querySelector('.action-bar');
  const btn = bar.querySelector('.action-btn');
  const prev = btn.innerHTML; const prevColor = btn.style.color; const prevClass = btn.className;
  const proof = card.querySelector('.social-proof-row');
  if (key) {
    const r = reactionByKey(key);
    btn.innerHTML = `<span class="act-ic">${r.emoji}</span><span>${r.label}</span>`;
    btn.style.color = r.color; btn.classList.add('reacted');
  } else { btn.innerHTML = `<span class="act-ic">👍</span><span>Like</span>`; btn.style.color = ''; btn.classList.remove('reacted'); }
  try {
    if (key) await actions.react(targetKey, key);
    else await actions.unreact(targetKey);
    // success — global re-render will refresh; but refresh proof locally too
    const fresh = socialProof(targetKey.slice(5), viewer);
    if (proof) proof.replaceWith(fresh);
  } catch (e) {
    btn.innerHTML = prev; btn.style.color = prevColor; btn.className = prevClass;
    toast('Your reaction could not be saved.', { type: 'danger' });
  }
}

function commentsSection(postId, viewer) {
  const wrap = el('div', { class: 'comments' });
  const all = sel.commentsFor(postId).filter(c => !c.parentId);
  const box = el('div', { class: 'comment-list' });

  const render = (limit) => {
    box.innerHTML = '';
    const shown = all.slice(0, limit);
    shown.forEach(c => box.appendChild(commentRow(c, viewer, postId)));
    if (all.length > limit) {
      box.appendChild(el('button', { class: 'see-more', onclick: () => render(all.length) }, [`Load ${all.length - limit} more comment${all.length - limit > 1 ? 's' : ''}`]));
    }
  };
  render(2);

  if (viewer) {
    const composer = commentComposer(postId, null, viewer, () => render(all.length + 1));
    wrap.appendChild(composer);
  }
  wrap.appendChild(box);
  return wrap;
}

function commentRow(c, viewer, postId) {
  const author = sel.user(c.authorId);
  if (viewer && author && sel.areBlocked(viewer, c.authorId)) return el('div');
  const replies = sel.commentsFor(postId).filter(x => x.parentId === c.id);
  const row = el('div', { class: 'comment' }, [
    el('a', { href: '#/in/' + author?.slug, 'aria-label': author?.name }, [avatar(author, 'sm', { decorative: true })]),
    el('div', { class: 'grow' }, [
      el('div', { class: 'comment-bubble' }, [
        el('div', { class: 'row', style: { gap: '6px' } }, [
          el('a', { href: '#/in/' + author?.slug, class: 'strong small' }, [author?.name || 'Unknown']),
          viewer ? degreeBadge(viewer, c.authorId) : false,
        ]),
        el('div', { class: 'small muted comment-head' }, [author?.headline || '']),
        el('div', { html: linkify(c.text) }),
      ]),
      el('div', { class: 'comment-actions small subtle' }, [
        viewer ? el('button', { class: 'link-btn', onclick: () => {
          const holder = row.querySelector('.reply-holder');
          if (!holder.firstChild) holder.appendChild(commentComposer(postId, c.id, viewer));
          holder.querySelector('textarea')?.focus();
        } }, ['Reply']) : false,
        `${timeAgo(c.t)}`,
      ]),
      el('div', { class: 'reply-holder' }),
      ...replies.map(r => el('div', { class: 'comment reply' }, [
        el('a', { href: '#/in/' + sel.user(r.authorId)?.slug }, [avatar(sel.user(r.authorId), 'sm', { decorative: true })]),
        el('div', { class: 'comment-bubble grow' }, [
          el('a', { href: '#/in/' + sel.user(r.authorId)?.slug, class: 'strong small' }, [sel.user(r.authorId)?.name || 'Unknown']),
          el('div', { html: linkify(r.text) }),
        ]),
      ])),
    ]),
  ]);
  return row;
}

function commentComposer(postId, parentId, viewer, onDone) {
  const ta = el('textarea', { class: 'textarea comment-input', rows: '1', 'aria-label': 'Write a comment', placeholder: parentId ? 'Write a reply' : 'Add a comment' });
  const btn = el('button', { class: 'btn btn-primary btn-sm', disabled: true }, [parentId ? 'Reply' : 'Comment']);
  ta.addEventListener('input', () => { btn.disabled = !ta.value.trim(); });
  btn.addEventListener('click', async () => {
    const text = ta.value.trim(); if (!text) return;
    btn.disabled = true;
    try { await actions.comment(postId, text, parentId); ta.value = ''; if (onDone) onDone(); }
    catch (e) { toast('Your comment could not be posted.', { type: 'danger' }); btn.disabled = false; }
  });
  return el('div', { class: 'comment-composer row' }, [
    avatar(sel.user(viewer), 'sm', { decorative: true }),
    el('div', { class: 'grow' }, [ta, el('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '6px' } }, [btn])]),
  ]);
}

function postMenu(post, viewer) {
  const btn = el('button', { class: 'btn-icon', 'aria-label': 'Post options' }, ['⋯']);
  btn.addEventListener('click', () => {
    const body = el('div', { class: 'stack' });
    if (viewer) {
      const isFollowing = post.authorType === 'user' && sel.isFollowing(viewer, post.authorId);
      if (post.authorType === 'user' && post.authorId !== viewer) {
        body.appendChild(el('button', { class: 'btn btn-ghost btn-block', onclick: async () => {
          if (isFollowing) await actions.unfollow(post.authorId); else await actions.follow(post.authorId);
          toast(isFollowing ? 'Unfollowed.' : 'Following.'); h.close();
        } }, [isFollowing ? 'Unfollow author' : 'Follow author']));
      }
    }
    body.appendChild(el('button', { class: 'btn btn-ghost btn-block', onclick: () => { toast('Thanks — this is a demo; nothing was reported.'); h.close(); } }, ['Report post']));
    const h = openModal({ title: 'Post options', body });
  });
  return btn;
}

function openRepost(postId, viewer) {
  const body = el('div', { class: 'stack' });
  const ta = el('textarea', { class: 'textarea', placeholder: 'Add your thoughts (optional)', 'aria-label': 'Quote' });
  body.append(
    el('button', { class: 'btn btn-outline btn-block', onclick: async () => {
      try { await actions.repost(postId); toast('Reposted.', { type: 'success' }); h.close(); }
      catch (e) { toast('Could not repost.', { type: 'danger' }); }
    } }, ['Repost now']),
    el('div', { class: 'divider' }),
    el('label', { class: 'field-hint' }, ['Repost with your thoughts']), ta,
  );
  const foot = el('button', { class: 'btn btn-primary', onclick: async () => {
    try { await actions.repost(postId, ta.value.trim() || null); toast('Reposted with your thoughts.', { type: 'success' }); h.close(); }
    catch (e) { toast('Could not repost.', { type: 'danger' }); }
  } }, ['Post']);
  const h = openModal({ title: 'Repost', body, footer: foot });
}

function openSendPost(postId, viewer) {
  const conns = sel.connectionsOf(viewer);
  const body = el('div', { class: 'stack' });
  if (!conns.length) { body.appendChild(el('p', { class: 'muted' }, ['Connect with people to send them posts.'])); }
  else {
    body.appendChild(el('p', { class: 'field-hint' }, ['Send this post as a message to a connection:']));
    conns.forEach(id => {
      const u = sel.user(id);
      body.appendChild(el('button', { class: 'btn btn-ghost btn-block', style: { justifyContent: 'flex-start' }, onclick: async () => {
        const conv = [viewer, id].sort().join('_');
        try {
          await actions.sendMessage({ convId: 'conv_' + conv, to: id, text: '', embedPost: postId });
          toast('Post sent to ' + u.name + '.', { type: 'success' }); h.close();
        } catch (e) { toast('Could not send.', { type: 'danger' }); }
      } }, [avatar(u, 'sm', { decorative: true }), ' ' + u.name]));
    });
  }
  const h = openModal({ title: 'Send post', body });
}

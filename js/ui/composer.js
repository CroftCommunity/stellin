// composer.js — post composer. Text, @mention typeahead (entity-bound tokens),
// #hashtags (auto-linked), image attach through the downscale pipeline, and a
// visibility selector. Document carousels are seeded; creating one is a frontier.
import { el } from './dom.js';
import { sel } from '../store.js';
import { me, actions } from '../actions.js';
import { avatar } from './avatar.js';
import { toast } from './toast.js';
import { openModal } from './modal.js';
import { frontierChip } from './frontierChip.js';
import { downscaleImage } from './imagePipeline.js';

// Inline trigger card shown atop the feed.
export function composerTrigger(onOpen) {
  const viewer = me();
  const u = sel.user(viewer);
  return el('div', { class: 'card card-pad composer-trigger' }, [
    el('div', { class: 'row', style: { gap: '10px' } }, [
      avatar(u, 'md', { decorative: true }),
      el('button', { class: 'composer-open', onclick: () => onOpen(), 'aria-label': 'Start a post' }, ['Start a post']),
    ]),
    el('div', { class: 'row composer-quick', style: { marginTop: '8px', justifyContent: 'space-around' } }, [
      el('button', { class: 'btn btn-ghost btn-sm', onclick: () => onOpen('image') }, ['🖼 Photo']),
      frontierChip('create-document-post', 'document'),
    ]),
  ]);
}

// Open the full composer as a modal (also used as the mobile full-screen sheet).
export function openComposer(opts = {}) {
  const viewer = me();
  const u = sel.user(viewer);
  let media = null;
  let visibility = 'anyone';

  const ta = el('textarea', { class: 'composer-textarea', rows: '6', 'aria-label': 'Post text',
    placeholder: 'Share an update, a lesson, or a question…' });

  const mentionBox = el('div', { class: 'mention-dropdown', hidden: true });
  const mediaPreview = el('div', { class: 'composer-media' });

  // mention typeahead
  ta.addEventListener('input', () => onType());
  ta.addEventListener('keydown', (e) => {
    if (!mentionBox.hidden) {
      const items = mentionBox.querySelectorAll('button');
      if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(items, 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(items, -1); }
      else if (e.key === 'Enter' && selIdx >= 0) { e.preventDefault(); items[selIdx].click(); }
      else if (e.key === 'Escape') { mentionBox.hidden = true; }
    }
  });
  let selIdx = -1;
  function moveSel(items, d) { selIdx = Math.max(0, Math.min(items.length - 1, selIdx + d)); items.forEach((it, i) => it.classList.toggle('is-active', i === selIdx)); }

  function onType() {
    const val = ta.value; const pos = ta.selectionStart;
    const before = val.slice(0, pos);
    const m = before.match(/@(\w*)$/);
    if (!m) { mentionBox.hidden = true; return; }
    const q = m[1].toLowerCase();
    const cands = sel.users().filter(x => x.id !== viewer && x.name.toLowerCase().includes(q) && !sel.areBlocked(viewer, x.id)).slice(0, 5);
    mentionBox.innerHTML = ''; selIdx = -1;
    if (!cands.length) { mentionBox.hidden = true; return; }
    cands.forEach(c => {
      const b = el('button', { type: 'button', class: 'mention-item', onclick: () => insertMention(c, m.index, pos) },
        [avatar(c, 'sm', { decorative: true }), el('span', {}, [c.name])]);
      mentionBox.appendChild(b);
    });
    mentionBox.hidden = false;
  }
  function insertMention(c, at, pos) {
    const val = ta.value;
    const token = `@[${c.name}](${c.slug}) `;
    ta.value = val.slice(0, at) + token + val.slice(pos);
    mentionBox.hidden = true; ta.focus();
  }

  // image attach
  const fileInput = el('input', { type: 'file', accept: 'image/*', hidden: true });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0]; if (!file) return;
    try {
      const { dataUrl, bytes } = await downscaleImage(file, 1024, 0.82);
      if (bytes > 500 * 1024) { toast('That image is still over 500KB after compression. Try a smaller one.', { type: 'danger' }); return; }
      media = { type: 'image', kind: 'data', src: dataUrl, alt: file.name };
      renderMediaPreview();
    } catch (e) { toast('Could not process that image.', { type: 'danger' }); }
    fileInput.value = '';
  });
  function renderMediaPreview() {
    mediaPreview.innerHTML = '';
    if (media) mediaPreview.appendChild(el('div', { class: 'composer-media-item' }, [
      el('img', { src: media.src, alt: media.alt }),
      el('button', { class: 'btn-icon', 'aria-label': 'Remove image', onclick: () => { media = null; renderMediaPreview(); } }, ['✕']),
    ]));
  }

  // visibility
  const visSel = el('select', { class: 'select composer-vis', 'aria-label': 'Who can see this' }, [
    el('option', { value: 'anyone' }, ['Anyone']),
    el('option', { value: 'connections' }, ['Connections only']),
  ]);
  visSel.addEventListener('change', () => { visibility = visSel.value; });

  const postBtn = el('button', { class: 'btn btn-primary', disabled: true }, ['Post']);
  ta.addEventListener('input', () => { postBtn.disabled = !ta.value.trim() && !media; });

  const body = el('div', { class: 'composer-body' }, [
    el('div', { class: 'row', style: { gap: '10px', marginBottom: '8px' } }, [
      avatar(u, 'md', { decorative: true }),
      el('div', {}, [el('div', { class: 'strong' }, [u.name]), visSel]),
    ]),
    el('div', { class: 'composer-input-wrap' }, [ta, mentionBox]),
    mediaPreview,
    el('div', { class: 'composer-tools row' }, [
      el('button', { class: 'btn-icon', 'aria-label': 'Add a photo', onclick: () => fileInput.click() }, ['🖼']),
      frontierChip('create-document-post', 'document'),
      fileInput,
    ]),
  ]);

  postBtn.addEventListener('click', async () => {
    const raw = ta.value;
    const hashtags = [...new Set((raw.match(/#(\w+)/g) || []).map(h => h.slice(1)))];
    const mentions = [...(raw.matchAll(/@\[[^\]]+\]\(([^)]+)\)/g))].map(m => m[1]);
    postBtn.disabled = true;
    try {
      await actions.createPost({ text: raw.trim(), media, visibility, hashtags, mentions });
      toast('Your post is live.', { type: 'success' });
      h.close();
      if (opts.onPosted) opts.onPosted();
    } catch (e) { toast('Your post could not be published. Try again.', { type: 'danger' }); postBtn.disabled = false; }
  });

  if (opts.startImage) setTimeout(() => fileInput.click(), 100);
  const h = openModal({ title: 'Create a post', body, footer: postBtn, size: 'lg' });
  setTimeout(() => ta.focus(), 50);
  return h;
}

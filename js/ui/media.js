// media.js — post media. Carousels are authored as styled SVG/text slides
// (no PDFs). Images may be inline SVG variants or uploaded data: URLs.
import { el } from './dom.js';
import { sel } from '../store.js';
import { colorFor } from './avatar.js';

export function renderMedia(media, post, mini = false) {
  if (!media) return null;
  if (media.type === 'carousel') return carousel(media.slides, post, mini);
  if (media.type === 'image') return image(media, post, mini);
  if (media.type === 'jobref') return jobRef(media.jobId);
  return null;
}

function carousel(slides, post, mini) {
  let idx = 0;
  const wrap = el('div', { class: 'carousel' + (mini ? ' carousel-mini' : '') });
  const stage = el('div', { class: 'carousel-stage', role: 'group', 'aria-roledescription': 'carousel' });
  const seed = post?.id || 'x';

  const draw = () => {
    stage.innerHTML = '';
    const s = slides[idx];
    const bg = colorFor(seed + idx);
    const slide = el('div', { class: 'carousel-slide', style: { background: `linear-gradient(150deg, ${bg}, ${shade(bg)})` } }, [
      el('div', { class: 'carousel-index' }, [`${idx + 1} / ${slides.length}`]),
      el('div', { class: 'carousel-title display' }, [s.title]),
      el('div', { class: 'carousel-text' }, [s.body]),
    ]);
    slide.setAttribute('aria-label', `Slide ${idx + 1} of ${slides.length}: ${s.title}`);
    stage.appendChild(slide);
    dotsRow.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-current', i === idx ? 'true' : 'false'));
  };

  const prev = el('button', { class: 'carousel-nav prev', 'aria-label': 'Previous slide', onclick: () => { idx = (idx - 1 + slides.length) % slides.length; draw(); } }, ['‹']);
  const next = el('button', { class: 'carousel-nav next', 'aria-label': 'Next slide', onclick: () => { idx = (idx + 1) % slides.length; draw(); } }, ['›']);
  const dotsRow = el('div', { class: 'carousel-dots' }, slides.map((_, i) =>
    el('button', { 'aria-label': `Go to slide ${i + 1}`, onclick: () => { idx = i; draw(); } })));

  wrap.append(el('div', { class: 'carousel-frame' }, [prev, stage, next]), dotsRow);
  if (!mini) wrap.appendChild(el('div', { class: 'small subtle carousel-cap' }, ['Document · ' + slides.length + ' pages']));
  draw();
  return wrap;
}

function image(media, post, mini) {
  if (media.kind === 'data' && media.src) {
    return el('div', { class: 'post-media' }, [el('img', { src: media.src, alt: media.alt || 'Attached image', loading: 'lazy' })]);
  }
  // inline SVG "photo" variants — deterministic, no external assets
  const seed = post?.id || 'img';
  const c1 = colorFor(seed), c2 = shade(c1);
  const svg = media.variant === 'whiteboard'
    ? `<svg viewBox="0 0 600 340" role="img" aria-label="Whiteboard sketch">
        <rect width="600" height="340" fill="#f7f5f0"/><rect x="8" y="8" width="584" height="324" fill="none" stroke="#d7d3ca"/>
        <g stroke="${c1}" stroke-width="3" fill="none" stroke-linecap="round">
          <rect x="60" y="60" width="120" height="70" rx="6"/><rect x="240" y="60" width="120" height="70" rx="6"/>
          <rect x="420" y="60" width="120" height="70" rx="6"/><path d="M180 95h60M360 95h60"/>
          <path d="M120 130v60M300 130v60M480 130v60"/><rect x="240" y="190" width="120" height="70" rx="6"/>
          <path d="M120 190q0 70 180 70M480 190q0 70-180 70"/>
        </g></svg>`
    : `<svg viewBox="0 0 600 340" role="img" aria-label="Abstract image">
        <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
        <rect width="600" height="340" fill="url(#g)"/></svg>`;
  return el('div', { class: 'post-media post-media-svg' + (mini ? ' mini' : ''), html: svg });
}

function jobRef(jobId) {
  const job = sel.job(jobId);
  if (!job) return null;
  const company = sel.company(job.companyId);
  return el('a', { class: 'job-ref card', href: '#/jobs?job=' + jobId }, [
    el('div', { class: 'job-ref-badge', 'aria-hidden': 'true' }, ['💼']),
    el('div', {}, [
      el('div', { class: 'strong' }, [job.title]),
      el('div', { class: 'small muted' }, [`${company?.name || ''} · ${job.workMode} · ${job.location}`]),
    ]),
  ]);
}

function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (n >> 16) - 30), g = Math.max(0, ((n >> 8) & 255) - 30), b = Math.max(0, (n & 255) - 30);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

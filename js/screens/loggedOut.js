// loggedOut.js — default state. Read-only public feed teaser with Join CTAs.
import { el, h1, timeAgo } from '../ui/dom.js';
import { sel, getState } from '../store.js';
import { avatar, companyAvatar } from '../ui/avatar.js';

export default function loggedOut(outlet) {
  const screen = el('div', { class: 'screen logged-out' });

  const hero = el('section', { class: 'lo-hero' }, [
    el('div', { class: 'lo-hero-inner container' }, [
      el('div', { class: 'lo-hero-copy' }, [
        h1('Where careers find their bearings.'),
        el('p', { class: 'lo-lead' }, ['Meridian is a professional network for sharing work, finding roles, and staying close to the people who vouch for you. This is a self-contained demo — everything lives in your browser.']),
        el('div', { class: 'row', style: { gap: '12px', marginTop: '16px' } }, [
          el('a', { href: '#/join', class: 'btn btn-primary' }, ['Join now']),
          el('a', { href: '#/jobs', class: 'btn btn-outline' }, ['Browse jobs']),
        ]),
        el('p', { class: 'small subtle', style: { marginTop: '12px' } }, ['Already exploring? Use the DEV persona menu above to sign in as a sample member.']),
      ]),
      el('div', { class: 'lo-hero-art', 'aria-hidden': 'true', html: heroArt() }),
    ]),
  ]);
  screen.appendChild(hero);

  const teaser = el('section', { class: 'container lo-teaser' });
  teaser.appendChild(el('h2', { class: 'display' }, ['What people are sharing']));

  const list = teaserPosts();
  if (!list.length) {
    teaser.appendChild(el('div', { class: 'card card-pad muted' }, [
      'Nothing to preview yet. Use the DEV bar to ', el('strong', {}, ['Seed']), ' a lived-in Meridian, then explore.',
    ]));
  } else {
    const grid = el('div', { class: 'lo-teaser-grid' });
    list.slice(0, 4).forEach(p => grid.appendChild(teaserCard(p)));
    teaser.appendChild(grid);
    teaser.appendChild(el('div', { class: 'lo-gate card card-pad' }, [
      el('div', {}, [el('strong', {}, ['See the full conversation']), el('div', { class: 'muted small' }, ['Join to react, comment, and connect.'])]),
      el('a', { href: '#/join', class: 'btn btn-primary' }, ['Join now']),
    ]));
  }
  screen.appendChild(teaser);
  outlet.appendChild(screen);
}

function teaserPosts() {
  // Public "Anyone" posts, newest first — a read-only teaser for logged-out visitors.
  const st = getState();
  return Object.values(st.posts)
    .filter(p => p.visibility !== 'connections' && p.text)
    .sort((a, b) => b.t - a.t);
}

function teaserCard(post) {
  const author = post.authorType === 'company' ? sel.company(post.authorId) : sel.user(post.authorId);
  return el('article', { class: 'card card-pad lo-teaser-card' }, [
    el('div', { class: 'row', style: { gap: '10px', marginBottom: '8px' } }, [
      (post.authorType === 'company' ? companyAvatar : avatar)(author, 'sm', { decorative: true }),
      el('div', {}, [el('div', { class: 'strong small' }, [author?.name || 'Member']), el('div', { class: 'subtle small' }, [timeAgo(post.t)])]),
    ]),
    el('p', { class: 'clamp-3' }, [post.text || '']),
  ]);
}

function heroArt() {
  return `<svg viewBox="0 0 320 260" width="100%" height="100%">
    <defs><linearGradient id="lh" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#2f5d8a"/><stop offset="1" stop-color="#7a5cc0"/></linearGradient></defs>
    <rect width="320" height="260" rx="16" fill="#eaf1f8"/>
    <circle cx="90" cy="80" r="26" fill="url(#lh)"/><circle cx="220" cy="70" r="20" fill="#2f7a4d"/>
    <circle cx="160" cy="150" r="30" fill="#b5750c"/><circle cx="250" cy="170" r="18" fill="#1f9b9b"/>
    <g stroke="#2f5d8a" stroke-width="2" opacity="0.6"><path d="M90 80l70 70M220 70l-60 80M160 150l90 20"/></g>
    <g fill="#2f5d8a"><circle cx="90" cy="80" r="4"/><circle cx="160" cy="150" r="4"/></g>
  </svg>`;
}

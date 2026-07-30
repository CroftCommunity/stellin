// feed.js — three columns. Left identity card, center composer + ranked
// infinite feed (IntersectionObserver sentinel), right PYMK + news modules.
import { el, h1, emptyState, clear } from '../ui/dom.js';
import { sel, getState } from '../store.js';
import { me } from '../actions.js';
import { rankedFeed, paginate } from '../engines/feedrank.js';
import { postCard } from '../ui/postCard.js';
import { composerTrigger, openComposer } from '../ui/composer.js';
import { feedSkeleton } from '../ui/skeleton.js';
import { pymkModule } from '../ui/pymkModule.js';
import { avatar } from '../ui/avatar.js';
import { currentLatency } from '../latency.js';

export default function feed(outlet, ctx) {
  const viewer = me();
  if (!viewer) { location.hash = '#/'; return; }

  const grid = el('div', { class: 'three-col screen' });
  const left = el('aside', { class: 'rail-left' }, [identityCard(viewer)]);
  const center = el('div', { class: 'feed-center' });
  const right = el('aside', { class: 'rail-right' }, [pymkModule(viewer), newsModule()]);

  // h1 for a11y / focus (visually part of the feed)
  center.appendChild(el('h1', { class: 'sr-only', tabindex: '-1' }, ['Home feed']));
  center.appendChild(composerTrigger((mode) => openComposer({ startImage: mode === 'image', onPosted: () => refresh() })));

  const feedHolder = el('div', { class: 'feed-list stack' });
  center.appendChild(feedHolder);

  grid.append(left, center, right);
  outlet.appendChild(grid);

  // open composer if requested (mobile Post tab)
  if (ctx.query.compose === '1') setTimeout(() => openComposer({ onPosted: () => refresh() }), 60);

  let cursor = 0;
  let ranked = [];
  let observer = null;

  function refresh() {
    clear(feedHolder);
    cursor = 0;
    // loading skeleton
    const sk = feedSkeleton(3);
    feedHolder.appendChild(sk);
    const lat = currentLatency();
    setTimeout(() => {
      ranked = rankedFeed(viewer);
      clear(feedHolder);
      if (!ranked.length) {
        feedHolder.appendChild(emptyState('📝', 'Your feed is quiet',
          'Follow people, connect, or share the first post to fill this space.',
          el('button', { class: 'btn btn-primary', onclick: () => openComposer({ onPosted: refresh }) }, ['Start a post'])));
        return;
      }
      loadMore();
    }, lat || 120);
  }

  function loadMore() {
    const { page, nextCursor } = paginate(ranked, cursor, 10);
    page.forEach(id => feedHolder.appendChild(postCard(id)));
    cursor = nextCursor;
    setupSentinel();
  }

  function setupSentinel() {
    if (observer) observer.disconnect();
    const old = feedHolder.querySelector('.feed-sentinel'); if (old) old.remove();
    if (cursor == null) {
      feedHolder.appendChild(el('div', { class: 'feed-end small subtle' }, ['You’re all caught up.']));
      return;
    }
    const sentinel = el('div', { class: 'feed-sentinel', 'aria-hidden': 'true' });
    feedHolder.appendChild(sentinel);
    observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { sentinel.remove(); loadMore(); }
    }, { rootMargin: '200px' });
    observer.observe(sentinel);
  }

  refresh();
  return () => { if (observer) observer.disconnect(); };
}

function identityCard(viewer) {
  const u = sel.user(viewer);
  const views = sel.profileViewsOf(viewer).length;
  const conns = sel.connectionCount(viewer);
  return el('div', { class: 'card identity-card' }, [
    el('div', { class: 'identity-cover', style: { background: coverGradient(u.id) } }),
    el('a', { href: '#/in/' + u.slug, class: 'identity-avatar' }, [avatar(u, 'lg', { decorative: true })]),
    el('div', { class: 'identity-body' }, [
      el('a', { href: '#/in/' + u.slug, class: 'identity-name display' }, [u.name]),
      el('div', { class: 'small muted' }, [u.headline]),
      el('div', { class: 'divider' }),
      statRow('Profile viewers', views, '#/settings'),
      statRow('Connections', conns, '#/network?tab=connections'),
    ]),
  ]);
}
function statRow(label, value, href) {
  return el('a', { href, class: 'identity-stat' }, [
    el('span', { class: 'small muted' }, [label]),
    el('span', { class: 'strong', style: { color: 'var(--c-primary)' } }, [String(value)]),
  ]);
}
function coverGradient(id) {
  return `linear-gradient(120deg, var(--c-primary), var(--r-support))`;
}

function newsModule() {
  const items = [
    ['Remote roles tick up', 'Postings tagged remote are trending this week.'],
    ['Design hiring warms', 'Product design openings are up across health tech.'],
    ['Referrals still win', 'Members with referrals hear back sooner.'],
  ];
  return el('div', { class: 'card card-pad news-module' }, [
    el('h2', { class: 'news-title' }, ['Meridian news']),
    el('ul', { class: 'news-list' }, items.map(([t, s]) => el('li', {}, [
      el('div', { class: 'strong small' }, [t]), el('div', { class: 'subtle small' }, [s]),
    ]))),
  ]);
}

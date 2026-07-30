// skeleton.js — loading placeholders shaped like the final layout.
import { el } from './dom.js';

export function skLine(cls = '') { return el('div', { class: 'skeleton sk-line ' + cls }); }
export function skCircle(size = 48) { return el('div', { class: 'skeleton sk-circle', style: { width: size + 'px', height: size + 'px' } }); }

export function postSkeleton() {
  return el('div', { class: 'card card-pad', 'aria-hidden': 'true' }, [
    el('div', { class: 'row', style: { marginBottom: '12px' } }, [
      skCircle(48),
      el('div', { class: 'grow' }, [skLine('w-40'), skLine('w-60')]),
    ]),
    skLine(), skLine(), skLine('w-60'),
    el('div', { class: 'skeleton', style: { height: '180px', marginTop: '12px', borderRadius: '8px' } }),
  ]);
}

export function feedSkeleton(n = 3) {
  return el('div', { class: 'stack', 'aria-busy': 'true', 'aria-label': 'Loading feed' },
    Array.from({ length: n }, () => postSkeleton()));
}

export function listSkeleton(n = 5) {
  return el('div', { class: 'card', 'aria-busy': 'true' },
    Array.from({ length: n }, () => el('div', { class: 'card-pad row', style: { borderBottom: '1px solid var(--border)' } }, [
      skCircle(40), el('div', { class: 'grow' }, [skLine('w-40'), skLine('w-60')]),
    ])));
}

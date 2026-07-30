// frontiers.js — auto-generated listing from the registry.
import { el, h1 } from '../ui/dom.js';
import { FRONTIERS } from '../frontier.js';
import { frontierChip } from '../ui/frontierChip.js';

export default function frontiers(outlet) {
  const screen = el('div', { class: 'screen frontiers-screen' });
  screen.appendChild(h1('Frontiers'));
  screen.appendChild(el('p', { class: 'muted' }, ['A frontier is a real affordance whose path is intentionally unbuilt. Each one is registered here and appears in-context as a dashed chip. Toggle “Frontiers” in the dev bar to hide them all.']));
  const list = el('div', { class: 'stack', style: { marginTop: '16px' } });
  FRONTIERS.forEach(f => {
    list.appendChild(el('div', { class: 'card card-pad' }, [
      el('div', { class: 'row-between', style: { flexWrap: 'wrap', gap: '8px' } }, [
        el('div', {}, [el('h2', {}, [f.label]), el('div', { class: 'small subtle' }, ['key: ' + f.key + ' · screens: ' + (f.screens || []).join(', ')])]),
        frontierChip(f.key),
      ]),
      el('p', { class: 'muted', style: { marginTop: '8px' } }, [f.description]),
    ]));
  });
  screen.appendChild(list);
  outlet.appendChild(screen);
}

// tabs.js — accessible tablist. tabs([{id,label,badge,render}], activeId, onChange)
import { el } from './dom.js';

export function tabsBar(items, activeId, onChange, opts = {}) {
  const list = el('div', { class: opts.vertical ? 'vtabs' : 'tabs', role: 'tablist' });
  items.forEach(t => {
    const btn = el('button', {
      class: 'tab', role: 'tab', id: 'tab-' + t.id,
      'aria-selected': t.id === activeId ? 'true' : 'false',
      tabindex: t.id === activeId ? '0' : '-1',
      onclick: () => onChange(t.id),
      onkeydown: (e) => {
        const idx = items.findIndex(x => x.id === activeId);
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); onChange(items[(idx + 1) % items.length].id); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); onChange(items[(idx - 1 + items.length) % items.length].id); }
      },
    }, [t.label, t.badge ? el('span', { class: 'badge', style: { marginLeft: '6px' } }, [String(t.badge)]) : false]);
    list.appendChild(btn);
  });
  return list;
}

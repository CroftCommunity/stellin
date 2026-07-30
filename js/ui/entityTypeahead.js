// entityTypeahead.js — typeahead against an entity table with an "add new"
// fallback that creates an unverified entity. Returns {el, getValue}.
import { el } from './dom.js';

// options: { items:[{id,name}], placeholder, onCreate:(name)=>id, initialId }
export function entityTypeahead(options) {
  let selectedId = options.initialId || null;
  const input = el('input', { class: 'input', placeholder: options.placeholder || 'Start typing…', autocomplete: 'off', role: 'combobox', 'aria-expanded': 'false', 'aria-autocomplete': 'list' });
  if (selectedId) { const it = options.items.find(i => i.id === selectedId); if (it) input.value = it.name; }
  const dd = el('div', { class: 'entity-dropdown', hidden: true, role: 'listbox' });
  const wrap = el('div', { class: 'entity-typeahead' }, [input, dd]);

  function refresh() {
    const q = input.value.trim().toLowerCase();
    selectedId = null;
    dd.innerHTML = '';
    if (!q) { dd.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
    const matches = options.items.filter(i => i.name.toLowerCase().includes(q)).slice(0, 6);
    matches.forEach(m => {
      dd.appendChild(el('button', { type: 'button', class: 'entity-option', role: 'option', onclick: () => { selectedId = m.id; input.value = m.name; dd.hidden = true; } }, [m.name]));
    });
    const exact = options.items.find(i => i.name.toLowerCase() === q);
    if (!exact && options.onCreate) {
      dd.appendChild(el('button', { type: 'button', class: 'entity-option entity-create', role: 'option', onclick: () => {
        selectedId = options.onCreate(input.value.trim());
        dd.hidden = true;
      } }, [`Add “${input.value.trim()}” `, el('span', { class: 'chip small' }, ['unverified'])]));
    }
    dd.hidden = dd.children.length === 0;
    input.setAttribute('aria-expanded', dd.hidden ? 'false' : 'true');
  }
  input.addEventListener('input', refresh);
  input.addEventListener('focus', refresh);
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) { dd.hidden = true; } });

  return {
    el: wrap,
    getValue() {
      // if the user typed an exact existing name without clicking, resolve it
      if (!selectedId) {
        const exact = options.items.find(i => i.name.toLowerCase() === input.value.trim().toLowerCase());
        if (exact) selectedId = exact.id;
        else if (input.value.trim() && options.onCreate) selectedId = options.onCreate(input.value.trim());
      }
      return { id: selectedId, name: input.value.trim() };
    },
  };
}

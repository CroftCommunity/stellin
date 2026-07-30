// frontierChip.js — dashed chip placed exactly where a deferred control would
// live. Clicking opens a popover with the description. The dev-bar toggle
// hides all chips (and thus the affordance — never a dead button).
import { getFrontier } from '../frontier.js';
import { openModal } from './modal.js';

export function frontierChip(key, labelOverride) {
  const f = getFrontier(key) || { key, label: key, description: 'Not yet built.' };
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'frontier-chip';
  btn.textContent = `frontier: ${labelOverride || f.key}`;
  btn.setAttribute('aria-label', `Frontier: ${f.label}. Not yet built. Activate for details.`);
  btn.addEventListener('click', () => {
    const body = document.createElement('div');
    body.className = 'stack';
    body.innerHTML = `<p class="muted">This is a real affordance whose path is intentionally unbuilt.</p>
      <p>${f.description}</p>
      <p class="small subtle">Registry key: <code>${f.key}</code> · Screens: ${(f.screens || []).join(', ') || '—'}</p>`;
    openModal({ title: f.label, body });
  });
  return btn;
}

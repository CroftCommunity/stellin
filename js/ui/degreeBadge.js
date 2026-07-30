// degreeBadge.js — the signature concentric-dot glyph plus text label.
// One dot for 1st, two for 2nd, three for 3rd. Rendered identically
// everywhere a name appears.
import { degree, degreeLabel } from '../engines/degrees.js';

export function degreeBadge(viewerId, otherId) {
  const d = degree(viewerId, otherId);
  const span = document.createElement('span');
  if (d === 0) return document.createTextNode(''); // no badge on self
  const dots = Math.min(d, 3);
  span.className = `degree degree-${dots}`;
  const label = degreeLabel(d);
  const glyph = document.createElement('span');
  glyph.className = 'degree-glyph';
  glyph.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < dots; i++) glyph.appendChild(document.createElement('i'));
  const lab = document.createElement('span');
  lab.className = 'degree-label';
  lab.textContent = label;
  span.append(glyph, lab);
  span.setAttribute('aria-label', `${label} degree connection`);
  return span;
}

// Convenience: append " · <badge>" after a name node.
export function withDegree(nameEl, viewerId, otherId) {
  const wrap = document.createElement('span');
  wrap.className = 'row';
  wrap.style.gap = '6px';
  wrap.appendChild(nameEl);
  const b = degreeBadge(viewerId, otherId);
  if (b.textContent !== '') {
    const sep = document.createElement('span');
    sep.className = 'subtle'; sep.textContent = '·'; sep.setAttribute('aria-hidden', 'true');
    wrap.append(sep, b);
  }
  return wrap;
}

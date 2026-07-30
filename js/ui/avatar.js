// avatar.js — generated inline SVG avatars: initials on a deterministic
// per-user color. No network, no image files.
const PALETTE = [
  '#2f5d8a', '#7a5cc0', '#2f7a4d', '#b5750c', '#1f9b9b',
  '#b23b3b', '#4a6fa5', '#8a5a2b', '#5c7a2f', '#a03b6b',
];

export function colorFor(id) {
  let h = 0;
  const str = String(id);
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Returns an <img>-less <span class="avatar"> element containing an SVG.
// entity: {id, name, avatarColor?, avatarData?} — avatarData is a data: URL
// (from an uploaded, downscaled image).
export function avatar(entity, size = 'md', opts = {}) {
  const el = document.createElement('span');
  el.className = `avatar avatar-${size}`;
  const name = entity?.name || 'Unknown';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', opts.decorative ? '' : name);
  if (opts.decorative) { el.setAttribute('aria-hidden', 'true'); el.removeAttribute('aria-label'); }

  if (entity?.avatarData) {
    const img = document.createElement('img');
    img.src = entity.avatarData;
    img.alt = opts.decorative ? '' : name;
    img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'cover';
    el.appendChild(img);
    return el;
  }
  const bg = entity?.avatarColor || colorFor(entity?.id || name);
  const ini = initials(name);
  el.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <rect width="100" height="100" fill="${bg}"/>
    <text x="50" y="50" dy="0.35em" text-anchor="middle"
      font-family="system-ui, sans-serif" font-size="42" font-weight="600" fill="#fff">${ini}</text>
  </svg>`;
  return el;
}

// For companies: rounded-square rendered via CSS class override.
export function companyAvatar(company, size = 'md', opts = {}) {
  const el = avatar(company, size, opts);
  el.style.borderRadius = '8px';
  return el;
}

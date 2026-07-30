// reactionPicker.js — hover (desktop) / long-press (touch) picker with five
// reactions. Keyboard: Enter opens, arrows navigate, Escape closes.
export const REACTIONS = [
  { key: 'like', label: 'Like', emoji: '👍', color: 'var(--r-like)' },
  { key: 'celebrate', label: 'Celebrate', emoji: '🎉', color: 'var(--r-celebrate)' },
  { key: 'support', label: 'Support', emoji: '🤝', color: 'var(--r-support)' },
  { key: 'insightful', label: 'Insightful', emoji: '💡', color: 'var(--r-insightful)' },
  { key: 'funny', label: 'Funny', emoji: '😄', color: 'var(--r-funny)' },
];
export function reactionByKey(k) { return REACTIONS.find(r => r.key === k); }

// attachReactionPicker(button, onPick) — wires hover/long-press/keyboard.
// onPick(reactionKey) is called when a reaction is chosen.
export function attachReactionPicker(button, onPick) {
  let picker = null;
  let hoverTimer = null;
  let pressTimer = null;

  function open() {
    if (picker) return;
    picker = buildPicker(button, onPick, close);
    document.body.appendChild(picker);
    position(picker, button);
    picker.querySelector('.reaction-btn')?.focus();
    document.addEventListener('click', onDocClick, true);
  }
  function close() {
    if (!picker) return;
    document.removeEventListener('click', onDocClick, true);
    picker.remove(); picker = null;
    button.focus();
  }
  function onDocClick(e) { if (picker && !picker.contains(e.target) && e.target !== button) close(); }

  // desktop hover
  button.addEventListener('mouseenter', () => { hoverTimer = setTimeout(open, 350); });
  button.addEventListener('mouseleave', () => {
    clearTimeout(hoverTimer);
    setTimeout(() => { if (picker && !picker.matches(':hover')) close(); }, 250);
  });
  // touch long-press
  button.addEventListener('touchstart', (e) => { pressTimer = setTimeout(() => { open(); }, 500); }, { passive: true });
  button.addEventListener('touchend', () => clearTimeout(pressTimer));
  button.addEventListener('touchmove', () => clearTimeout(pressTimer));
  // keyboard
  button.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !picker) { e.preventDefault(); open(); }
    else if (e.key === 'Escape' && picker) { e.preventDefault(); close(); }
  });

  return { open, close };
}

function buildPicker(button, onPick, close) {
  const wrap = document.createElement('div');
  wrap.className = 'reaction-picker';
  wrap.setAttribute('role', 'menu');
  wrap.setAttribute('aria-label', 'Choose a reaction');
  REACTIONS.forEach((r, i) => {
    const b = document.createElement('button');
    b.className = 'reaction-btn';
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.setAttribute('aria-label', r.label);
    b.textContent = r.emoji;
    b.title = r.label;
    b.addEventListener('click', () => { onPick(r.key); close(); });
    b.addEventListener('keydown', (e) => {
      const btns = Array.from(wrap.querySelectorAll('.reaction-btn'));
      const idx = btns.indexOf(b);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); btns[(idx + 1) % btns.length].focus(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); btns[(idx - 1 + btns.length) % btns.length].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(r.key); close(); }
    });
    wrap.appendChild(b);
  });
  wrap.addEventListener('mouseleave', () => setTimeout(() => { if (!wrap.matches(':hover')) close(); }, 200));
  return wrap;
}

function position(picker, button) {
  const r = button.getBoundingClientRect();
  picker.style.top = (window.scrollY + r.top - 52) + 'px';
  picker.style.left = (window.scrollX + r.left) + 'px';
  // keep on-screen
  const pr = picker.getBoundingClientRect();
  if (pr.right > window.innerWidth - 8) picker.style.left = (window.scrollX + window.innerWidth - pr.width - 8) + 'px';
  if (pr.top < window.scrollY + 8) picker.style.top = (window.scrollY + r.bottom + 8) + 'px';
}

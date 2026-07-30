// modal.js — accessible modal dialog with focus trap and Escape handling.
let openCount = 0;

// openModal({title, body, footer, size, onClose}) -> {close, el}
// body/footer may be a Node or a string (HTML). Returns a handle.
export function openModal({ title, body, footer, size, onClose, labelledBy } = {}) {
  const prevFocus = document.activeElement;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal' + (size === 'lg' ? ' modal-lg' : '');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const titleId = 'modal-title-' + (++openCount);
  if (title) {
    const head = document.createElement('div');
    head.className = 'modal-head';
    const h = document.createElement('h2');
    h.id = titleId; h.textContent = title;
    modal.setAttribute('aria-labelledby', titleId);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn-icon'; closeBtn.setAttribute('aria-label', 'Close dialog');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => close());
    head.append(h, closeBtn);
    modal.appendChild(head);
  } else if (labelledBy) {
    modal.setAttribute('aria-labelledby', labelledBy);
  }

  const bodyEl = document.createElement('div');
  bodyEl.className = 'modal-body';
  append(bodyEl, body);
  modal.appendChild(bodyEl);

  if (footer) {
    const foot = document.createElement('div');
    foot.className = 'modal-foot';
    append(foot, footer);
    modal.appendChild(foot);
  }

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', onKey, true);

  // focus first focusable
  const focusables = () => modal.querySelectorAll(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
  const first = focusables()[0];
  (first || modal).focus?.();

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      const f = Array.from(focusables());
      if (!f.length) return;
      const idx = f.indexOf(document.activeElement);
      if (e.shiftKey && (idx <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && idx === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  }

  function close() {
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    document.body.style.overflow = '';
    if (prevFocus && prevFocus.focus) prevFocus.focus();
    if (onClose) onClose();
  }

  return { close, el: modal, body: bodyEl };
}

function append(parent, content) {
  if (!content) return;
  if (content instanceof Node) parent.appendChild(content);
  else parent.innerHTML = content;
}

// confirmDialog({title, message, confirmLabel, danger}) -> Promise<boolean>
export function confirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger } = {}) {
  return new Promise((resolve) => {
    const body = document.createElement('p');
    body.textContent = message;
    const foot = document.createElement('div');
    foot.className = 'row';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-ghost'; cancel.textContent = cancelLabel;
    const ok = document.createElement('button');
    ok.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary'); ok.textContent = confirmLabel;
    foot.append(cancel, ok);
    const h = openModal({ title, body, footer: foot, onClose: () => resolve(false) });
    cancel.addEventListener('click', () => { h.close(); });
    ok.addEventListener('click', () => { resolve(true); h.close(); });
  });
}

// onboarding.js — the real signup flow. Identity -> role branch -> position/
// education (entity typeahead + add-new) -> simulated contact import ->
// first-connection grid -> completion. Completing creates a persona, logs in
// as them, and lists them in the dev dropdown. Sam stays untouched.
import { el, h1, clear } from '../ui/dom.js';
import { sel, getState, slugify, uid, setDevPref, invalidate } from '../store.js';
import { me, actions } from '../actions.js';
import { avatar } from '../ui/avatar.js';
import { toast } from '../ui/toast.js';
import { openModal } from '../ui/modal.js';
import { entityTypeahead } from '../ui/entityTypeahead.js';
import { frontierChip } from '../ui/frontierChip.js';
import { completion } from './profileEdit.js';
import { navigate, rerender } from '../router.js';

export default function onboarding(outlet) {
  const screen = el('div', { class: 'screen onboarding-screen' });
  const card = el('div', { class: 'card card-pad onboarding-card' });
  screen.appendChild(card);
  outlet.appendChild(screen);

  const state = { step: 0, newId: null, role: null };
  const steps = ['Identity', 'Role', 'Details', 'Connect', 'Done'];

  function progress() {
    return el('div', { class: 'onboarding-progress' }, steps.map((s, i) =>
      el('div', { class: 'ob-step' + (i <= state.step ? ' done' : '') }, [el('span', { class: 'ob-dot' }, [String(i + 1)]), el('span', { class: 'ob-label small' }, [s])])));
  }

  function render() {
    clear(card);
    card.appendChild(progress());
    if (state.step === 0) renderIdentity();
    else if (state.step === 1) renderRole();
    else if (state.step === 2) renderDetails();
    else if (state.step === 3) renderConnect();
    else renderDone();
  }

  function renderIdentity() {
    card.appendChild(h1('Join Meridian'));
    card.appendChild(el('p', { class: 'muted' }, ['This creates a brand-new sample persona and signs you in as them.']));
    const name = el('input', { class: 'input', placeholder: 'Full name', 'aria-label': 'Full name' });
    const headline = el('input', { class: 'input', placeholder: 'Headline (e.g. Software Engineer)', 'aria-label': 'Headline' });
    const location = el('input', { class: 'input', placeholder: 'Location', 'aria-label': 'Location' });
    card.append(field('Name', name), field('Headline', headline), field('Location', location));
    const next = el('button', { class: 'btn btn-primary', onclick: () => {
      if (!name.value.trim()) { toast('Enter your name to continue.', { type: 'danger' }); name.focus(); return; }
      const id = 'user_' + slugify(name.value.trim()) + '_' + uid().slice(-4);
      actions.createPersona({ id, name: name.value.trim(), headline: headline.value.trim() || 'New to Meridian', location: location.value.trim() });
      state.newId = id;
      setDevPref('persona', id); invalidate();
      state.step = 1; render();
    } }, ['Continue']);
    card.appendChild(el('div', { class: 'ob-actions' }, [next]));
  }

  function renderRole() {
    card.appendChild(h1('What brings you here?'));
    const branches = [
      ['student', 'I’m a student', 'Add your school.'],
      ['employed', 'I’m employed', 'Add your current role.'],
      ['seeking', 'I’m job seeking', 'We’ll turn on “Open to work”.'],
    ];
    const grid = el('div', { class: 'role-grid' }, branches.map(([key, label, desc]) =>
      el('button', { class: 'role-card' + (state.role === key ? ' is-active' : ''), onclick: () => { state.role = key; state.step = 2; render(); } }, [
        el('div', { class: 'strong' }, [label]), el('div', { class: 'small muted' }, [desc]),
      ])));
    card.appendChild(grid);
    card.appendChild(el('div', { class: 'ob-actions' }, [el('button', { class: 'btn btn-ghost', onclick: () => { state.step = 3; render(); } }, ['Skip'])]));
  }

  function renderDetails() {
    const isStudent = state.role === 'student';
    card.appendChild(h1(isStudent ? 'Your education' : 'Your current role'));
    let ctl;
    if (isStudent) {
      const schoolItems = Object.values(getState().schools).map(s => ({ id: s.id, name: s.name }));
      const ta = entityTypeahead({ items: schoolItems, placeholder: 'School', onCreate: (n) => actions.addSchool(n) });
      const degree = el('input', { class: 'input', placeholder: 'Degree (e.g. B.S.)' });
      const fieldI = el('input', { class: 'input', placeholder: 'Field of study' });
      card.append(field('School', ta.el), field('Degree', degree), field('Field', fieldI));
      ctl = { save: async () => { const s = ta.getValue(); if (s.id) await actions.addEducation({ schoolId: s.id, degree: degree.value.trim(), field: fieldI.value.trim() }); } };
    } else {
      const companies = sel.companies().map(c => ({ id: c.id, name: c.name }));
      const ta = entityTypeahead({ items: companies, placeholder: 'Company', onCreate: (n) => actions.addCompany(n) });
      const title = el('input', { class: 'input', placeholder: 'Title' });
      card.append(field('Title', title), field('Company', ta.el));
      ctl = { save: async () => {
        const co = ta.getValue();
        if (title.value.trim()) await actions.addPosition({ title: title.value.trim(), companyId: co.id, current: true });
        if (state.role === 'seeking') await actions.updateProfile({ openToWork: true }, state.newId);
      } };
    }
    const next = el('button', { class: 'btn btn-primary', onclick: async () => { await ctl.save(); state.step = 3; render(); } }, ['Continue']);
    card.appendChild(el('div', { class: 'ob-actions' }, [el('button', { class: 'btn btn-ghost', onclick: () => { state.step = 3; render(); } }, ['Skip']), next]));
  }

  function renderConnect() {
    card.appendChild(h1('Grow your network'));
    card.appendChild(el('div', { class: 'row', style: { gap: '8px', marginBottom: '12px', flexWrap: 'wrap' } }, [
      el('button', { class: 'btn btn-outline', onclick: () => importModal() }, ['Import your contacts']),
      frontierChip('contact-import-real'),
    ]));
    const suggestions = sel.users().filter(u => u.id !== state.newId && u.id !== 'sam').slice(0, 8);
    card.appendChild(el('p', { class: 'small muted' }, ['People already on Meridian:']));
    const grid = el('div', { class: 'pymk-grid pymk-grid-lg' });
    suggestions.forEach(u => grid.appendChild(connectCard(u)));
    card.appendChild(grid);
    card.appendChild(el('div', { class: 'ob-actions' }, [el('button', { class: 'btn btn-primary', onclick: () => { state.step = 4; render(); } }, ['Done'])]));
  }

  function connectCard(u) {
    const btn = el('button', { class: 'btn btn-outline btn-sm btn-block' }, ['Connect']);
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.textContent = 'Pending';
      try { await actions.invite(u.id); } catch (e) { btn.disabled = false; btn.textContent = 'Connect'; toast('Could not send invitation.', { type: 'danger' }); }
    });
    return el('div', { class: 'pymk-card' }, [
      avatar(u, 'lg', { decorative: true }),
      el('div', { class: 'strong small pymk-name' }, [u.name]),
      el('div', { class: 'subtle small pymk-head' }, [u.headline]),
      btn,
    ]);
  }

  function importModal() {
    const body = el('div', { class: 'stack' }, [
      el('p', {}, ['Meridian would like to access your contacts to find people you know.']),
      el('p', { class: 'small subtle' }, ['This is a simulated permission prompt — no real contacts are read.']),
    ]);
    const allow = el('button', { class: 'btn btn-primary', onclick: () => { h.close(); toast('Found people you may know below.', { type: 'success' }); } }, ['Allow']);
    const deny = el('button', { class: 'btn btn-ghost', onclick: () => h.close() }, ['Not now']);
    const h = openModal({ title: 'Allow contact access?', body, footer: el('div', { class: 'row', style: { gap: '8px' } }, [deny, allow]) });
  }

  function renderDone() {
    const c = completion(state.newId);
    card.appendChild(h1('You’re all set'));
    card.appendChild(el('p', { class: 'muted' }, ['Your profile is ' + c.total + '% complete. Fill in more later from your profile.']));
    card.appendChild(el('div', { class: 'meter', role: 'progressbar', 'aria-valuenow': String(c.total), 'aria-valuemin': '0', 'aria-valuemax': '100' }, [el('div', { class: 'meter-fill', style: { width: c.total + '%' } })]));
    card.appendChild(el('div', { class: 'ob-actions' }, [el('button', { class: 'btn btn-primary', onclick: () => navigate('#/feed') }, ['Go to your feed'])]));
  }

  render();
}

function field(label, control) { return el('div', { class: 'field' }, [el('label', {}, [label]), control]); }

// profileEdit.js — per-section edit modals with entity typeahead + add-new,
// plus the profile completion meter weights.
import { el } from '../ui/dom.js';
import { sel, getState } from '../store.js';
import { actions } from '../actions.js';
import { openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { entityTypeahead } from '../ui/entityTypeahead.js';

// Completion weights: photo 20, headline 15, one position 25, three skills 20, About 20.
export function completion(userId) {
  const u = sel.user(userId);
  const items = [
    { key: 'photo', label: 'Add a profile photo', weight: 20, edit: 'photo', done: !!u.avatarData },
    { key: 'headline', label: 'Write a headline', weight: 15, edit: 'intro', done: !!(u.headline && u.headline.length > 4) },
    { key: 'position', label: 'Add a position', weight: 25, edit: 'position', done: sel.positionsOf(userId).length > 0 },
    { key: 'skills', label: 'Add three skills', weight: 20, edit: 'skill', done: sel.skillsOf(userId).length >= 3 },
    { key: 'about', label: 'Write your About', weight: 20, edit: 'about', done: !!(u.about && u.about.length > 10) },
  ];
  const total = items.filter(i => i.done).reduce((a, i) => a + i.weight, 0);
  return { total, items };
}

export function openEditModal(kind, userId) {
  const u = sel.user(userId);
  if (kind === 'intro') return introModal(u);
  if (kind === 'about') return aboutModal(u);
  if (kind === 'position') return positionModal(userId);
  if (kind === 'education') return educationModal(userId);
  if (kind === 'skill') return skillModal(userId);
  if (kind === 'photo') return photoModal(userId);
}

function introModal(u) {
  const name = el('input', { class: 'input', value: u.name });
  const headline = el('input', { class: 'input', value: u.headline, maxlength: '160' });
  const location = el('input', { class: 'input', value: u.location || '' });
  const otw = el('input', { type: 'checkbox' }); otw.checked = !!u.openToWork;
  const body = el('div', {}, [
    field('Name', name), field('Headline', headline), field('Location', location),
    el('label', { class: 'row', style: { gap: '8px' } }, [otw, 'Show “Open to work”']),
  ]);
  const save = el('button', { class: 'btn btn-primary', onclick: async () => {
    await actions.updateProfile({ name: name.value.trim(), headline: headline.value.trim(), location: location.value.trim(), openToWork: otw.checked }, u.id);
    toast('Profile updated.'); h.close();
  } }, ['Save changes']);
  const h = openModal({ title: 'Edit intro', body, footer: save });
}

function aboutModal(u) {
  const about = el('textarea', { class: 'textarea', rows: '6' }); about.value = u.about || '';
  const save = el('button', { class: 'btn btn-primary', onclick: async () => { await actions.updateProfile({ about: about.value.trim() }, u.id); toast('About updated.'); h.close(); } }, ['Save changes']);
  const h = openModal({ title: 'Edit about', body: field('About', about), footer: save });
}

function positionModal(userId) {
  const title = el('input', { class: 'input' });
  const companies = sel.companies().map(c => ({ id: c.id, name: c.name }));
  const ta = entityTypeahead({ items: companies, placeholder: 'Company', onCreate: (name) => actions.addCompany(name) });
  const start = el('input', { class: 'input', placeholder: 'e.g. 2023' });
  const end = el('input', { class: 'input', placeholder: 'e.g. 2025 (or leave blank)' });
  const current = el('input', { type: 'checkbox' });
  const body = el('div', {}, [field('Title', title), field('Company', ta.el), field('Start', start), field('End', end),
    el('label', { class: 'row', style: { gap: '8px' } }, [current, 'I currently work here'])]);
  const save = el('button', { class: 'btn btn-primary', onclick: async () => {
    if (!title.value.trim()) { toast('Add a title.', { type: 'danger' }); return; }
    const co = ta.getValue();
    await actions.addPosition({ title: title.value.trim(), companyId: co.id, start: start.value.trim(), end: end.value.trim(), current: current.checked });
    toast('Position added.'); h.close();
  } }, ['Add position']);
  const h = openModal({ title: 'Add position', body, footer: save });
}

function educationModal(userId) {
  const schools = getState().schools; const items = Object.values(schools).map(s => ({ id: s.id, name: s.name }));
  const ta = entityTypeahead({ items, placeholder: 'School', onCreate: (name) => actions.addSchool(name) });
  const degree = el('input', { class: 'input', placeholder: 'e.g. B.S.' });
  const fieldI = el('input', { class: 'input', placeholder: 'e.g. Computer Science' });
  const start = el('input', { class: 'input', placeholder: 'Start year' });
  const end = el('input', { class: 'input', placeholder: 'End year' });
  const body = el('div', {}, [field('School', ta.el), field('Degree', degree), field('Field', fieldI), field('Start', start), field('End', end)]);
  const save = el('button', { class: 'btn btn-primary', onclick: async () => {
    const s = ta.getValue(); if (!s.id) { toast('Choose a school.', { type: 'danger' }); return; }
    await actions.addEducation({ schoolId: s.id, degree: degree.value.trim(), field: fieldI.value.trim(), start: start.value.trim(), end: end.value.trim() });
    toast('Education added.'); h.close();
  } }, ['Add education']);
  const h = openModal({ title: 'Add education', body, footer: save });
}

function skillModal(userId) {
  const existing = sel.skillsOf(userId).map(s => s.name);
  const input = el('input', { class: 'input', placeholder: 'e.g. Product Management' });
  const list = el('div', { class: 'skills-wrap', style: { marginTop: '12px' } });
  const renderList = () => { list.innerHTML = ''; sel.skillsOf(userId).forEach(s => list.appendChild(el('span', { class: 'skill-chip' }, [s.name]))); };
  renderList();
  const add = el('button', { class: 'btn btn-primary', onclick: async () => {
    const name = input.value.trim(); if (!name) return;
    await actions.addSkill(name); input.value = ''; renderList(); toast('Skill added.');
  } }, ['Add']);
  const body = el('div', {}, [field('Skill', el('div', { class: 'row', style: { gap: '8px' } }, [input, add])), list]);
  const h = openModal({ title: 'Add skills', body, footer: el('button', { class: 'btn btn-primary', onclick: () => h.close() }, ['Done']) });
}

function photoModal(userId) {
  const fileInput = el('input', { type: 'file', accept: 'image/*' });
  const preview = el('div', { class: 'photo-preview' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0]; if (!file) return;
    const { downscaleImage } = await import('../ui/imagePipeline.js');
    try {
      const { dataUrl, bytes } = await downscaleImage(file, 512, 0.85);
      if (bytes > 500 * 1024) { toast('Image too large after compression.', { type: 'danger' }); return; }
      preview.innerHTML = ''; preview.appendChild(el('img', { src: dataUrl, alt: 'Preview', style: { width: '120px', borderRadius: '50%' } }));
      preview.dataset.src = dataUrl;
    } catch (e) { toast('Could not process image.', { type: 'danger' }); }
  });
  const save = el('button', { class: 'btn btn-primary', onclick: async () => {
    if (preview.dataset.src) { await actions.updateProfile({ avatarData: preview.dataset.src }, userId); toast('Photo updated.'); }
    h.close();
  } }, ['Save photo']);
  const h = openModal({ title: 'Profile photo', body: el('div', {}, [field('Choose an image', fileInput), preview]), footer: save });
}

function field(label, control) {
  return el('div', { class: 'field' }, [el('label', {}, [label]), control]);
}

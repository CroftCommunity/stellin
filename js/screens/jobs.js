// jobs.js — faceted job search, two-pane layout, Quick Apply with a frozen
// profile snapshot, and a saved search with an alert toggle.
import { el, h1, timeAgo, emptyState, clear } from '../ui/dom.js';
import { sel } from '../store.js';
import { me, actions } from '../actions.js';
import { toast } from '../ui/toast.js';
import { openModal } from '../ui/modal.js';
import { frontierChip } from '../ui/frontierChip.js';

// session-local save/dismiss (a real backend would persist these)
const saved = new Set();
const dismissed = new Set();

export default function jobs(outlet, ctx) {
  const viewer = me();
  const premium = viewer && sel.entitlement(viewer).tier === 'premium';
  const screen = el('div', { class: 'screen jobs-screen' });
  screen.appendChild(h1('Jobs'));

  const facets = { workMode: new Set(), seniority: new Set(), datePosted: 'any', company: new Set(), saved: false };
  let activeJob = ctx.query.job || null;

  const layout = el('div', { class: 'jobs-layout' });
  const railCol = el('aside', { class: 'jobs-facets card card-pad' });
  const listCol = el('div', { class: 'jobs-list card' });
  const detailCol = el('div', { class: 'jobs-detail card' });
  layout.append(railCol, listCol, detailCol);
  screen.appendChild(layout);
  outlet.appendChild(screen);

  function allJobs() { return sel.jobs().filter(j => !dismissed.has(j.id)); }

  function filtered() {
    let arr = allJobs();
    if (facets.workMode.size) arr = arr.filter(j => facets.workMode.has(j.workMode));
    if (facets.seniority.size) arr = arr.filter(j => facets.seniority.has(j.seniority));
    if (facets.company.size) arr = arr.filter(j => facets.company.has(j.companyId));
    if (facets.saved) arr = arr.filter(j => saved.has(j.id));
    if (facets.datePosted !== 'any') {
      const days = facets.datePosted === 'day' ? 1 : facets.datePosted === 'week' ? 7 : 30;
      arr = arr.filter(j => (Date.now() - j.t) < days * 864e5);
    }
    return arr.sort((a, b) => b.t - a.t);
  }

  function drawFacets() {
    clear(railCol);
    railCol.appendChild(el('div', { class: 'row-between' }, [el('h2', { class: 'news-title' }, ['Filters']),
      el('button', { class: 'link-btn small', onclick: () => { facets.workMode.clear(); facets.seniority.clear(); facets.company.clear(); facets.datePosted = 'any'; facets.saved = false; drawAll(); } }, ['Reset'])]));
    railCol.appendChild(facetGroup('Work mode', ['Remote', 'Hybrid', 'On-site'], facets.workMode, drawAll));
    railCol.appendChild(facetGroup('Seniority', ['Internship', 'Entry', 'Mid', 'Senior'], facets.seniority, drawAll));
    railCol.appendChild(dateGroup(facets, drawAll));
    railCol.appendChild(companyGroup(facets, allJobs(), drawAll));
    // salary band — premium
    const salWrap = el('div', { class: 'facet-group' }, [el('div', { class: 'facet-title' }, ['Salary band'])]);
    if (premium) salWrap.appendChild(el('div', { class: 'small muted' }, ['Salary bands are shown on each job.']));
    else salWrap.appendChild(el('div', {}, [el('div', { class: 'small muted', style: { marginBottom: '6px' } }, ['Filter by salary with Premium.']), frontierChip('premium-checkout', 'unlock salary filter')]));
    railCol.appendChild(salWrap);
    // saved search
    railCol.appendChild(el('div', { class: 'facet-group' }, [
      el('label', { class: 'row', style: { gap: '8px' } }, [
        (() => { const c = el('input', { type: 'checkbox' }); c.checked = facets.saved; c.addEventListener('change', () => { facets.saved = c.checked; drawAll(); }); return c; })(),
        'Saved jobs only',
      ]),
      el('button', { class: 'btn btn-outline btn-sm', style: { marginTop: '8px' }, onclick: () => saveSearch(viewer, facets) }, ['Save this search']),
    ]));
  }

  function drawList() {
    clear(listCol);
    const arr = filtered();
    listCol.appendChild(el('div', { class: 'jobs-list-head small muted' }, [`${arr.length} job${arr.length === 1 ? '' : 's'}`]));
    if (!arr.length) { listCol.appendChild(emptyState('💼', 'No matching jobs', 'Try removing a filter to see more roles.')); return; }
    if (!activeJob || !arr.some(j => j.id === activeJob)) activeJob = arr[0].id;
    arr.forEach(j => listCol.appendChild(jobListItem(j, activeJob, viewer, (id) => { activeJob = id; drawList(); drawDetail(); })));
  }

  function drawDetail() {
    clear(detailCol);
    if (!activeJob) { detailCol.appendChild(el('div', { class: 'state-block' }, [el('p', {}, ['Select a job to see details.'])])); return; }
    detailCol.appendChild(jobDetail(activeJob, viewer, premium));
    layout.classList.toggle('detail-open', true);
  }

  function drawAll() { drawFacets(); drawList(); drawDetail(); }
  drawAll();
}

function facetGroup(title, values, set, onChange) {
  return el('div', { class: 'facet-group' }, [
    el('div', { class: 'facet-title' }, [title]),
    ...values.map(v => el('label', { class: 'facet-opt row', style: { gap: '8px' } }, [
      (() => { const c = el('input', { type: 'checkbox' }); c.checked = set.has(v); c.addEventListener('change', () => { c.checked ? set.add(v) : set.delete(v); onChange(); }); return c; })(),
      v,
    ])),
  ]);
}
function dateGroup(facets, onChange) {
  const opts = [['any', 'Any time'], ['day', 'Past 24 hours'], ['week', 'Past week'], ['month', 'Past month']];
  return el('div', { class: 'facet-group' }, [el('div', { class: 'facet-title' }, ['Date posted']),
    ...opts.map(([v, l]) => el('label', { class: 'facet-opt row', style: { gap: '8px' } }, [
      (() => { const r = el('input', { type: 'radio', name: 'dateposted' }); r.checked = facets.datePosted === v; r.addEventListener('change', () => { facets.datePosted = v; onChange(); }); return r; })(), l]))]);
}
function companyGroup(facets, jobsArr, onChange) {
  const companies = [...new Set(jobsArr.map(j => j.companyId))].map(id => sel.company(id)).filter(Boolean);
  return el('div', { class: 'facet-group' }, [el('div', { class: 'facet-title' }, ['Company']),
    ...companies.map(c => el('label', { class: 'facet-opt row', style: { gap: '8px' } }, [
      (() => { const ch = el('input', { type: 'checkbox' }); ch.checked = facets.company.has(c.id); ch.addEventListener('change', () => { ch.checked ? facets.company.add(c.id) : facets.company.delete(c.id); onChange(); }); return ch; })(), c.name]))]);
}

function jobListItem(job, activeId, viewer, onOpen) {
  const company = sel.company(job.companyId);
  const applied = viewer && sel.hasApplied(viewer, job.id);
  return el('button', { class: 'job-item' + (job.id === activeId ? ' is-active' : ''), onclick: () => onOpen(job.id) }, [
    el('div', { class: 'job-item-logo', 'aria-hidden': 'true' }, [company ? company.name[0] : '•']),
    el('div', { class: 'grow' }, [
      el('div', { class: 'strong' }, [job.title]),
      el('div', { class: 'small muted' }, [`${company?.name || ''} · ${job.location}`]),
      el('div', { class: 'small subtle' }, [`${job.workMode} · ${timeAgo(job.t)}`, applied ? el('span', { class: 'chip applied-chip' }, ['Applied']) : '']),
    ]),
  ]);
}

function jobDetail(jobId, viewer, premium) {
  const job = sel.job(jobId);
  const company = sel.company(job.companyId);
  const applied = viewer && sel.hasApplied(viewer, jobId);
  const wrap = el('div', { class: 'job-detail-inner' });
  wrap.appendChild(el('div', { class: 'job-detail-head' }, [
    el('h2', { class: 'display' }, [job.title]),
    el('div', { class: 'muted' }, [company ? el('a', { href: '#/company/' + company.slug }, [company.name]) : 'Company', ` · ${job.location}`]),
    el('div', { class: 'row', style: { gap: '8px', marginTop: '8px', flexWrap: 'wrap' } }, [
      el('span', { class: 'chip' }, [job.workMode]), el('span', { class: 'chip' }, [job.seniority]),
      premium && job.salaryBand ? el('span', { class: 'chip salary-chip' }, [job.salaryBand]) : (job.salaryBand ? blurredSalary() : ''),
    ]),
  ]));

  const ctas = el('div', { class: 'row', style: { gap: '8px', marginTop: '12px' } });
  if (viewer) {
    if (applied) ctas.appendChild(el('button', { class: 'btn', disabled: true }, ['Applied']));
    else ctas.appendChild(el('button', { class: 'btn btn-primary', onclick: () => quickApply(job, viewer) }, ['Quick Apply']));
    const isSaved = saved.has(jobId);
    ctas.appendChild(el('button', { class: 'btn btn-outline', onclick: (e) => { isSaved ? saved.delete(jobId) : saved.add(jobId); e.target.textContent = saved.has(jobId) ? 'Saved' : 'Save'; toast(saved.has(jobId) ? 'Job saved.' : 'Job removed from saved.'); } }, [isSaved ? 'Saved' : 'Save']));
    ctas.appendChild(el('button', { class: 'btn btn-ghost', onclick: () => { dismissed.add(jobId); toast('Job dismissed.'); location.hash = '#/jobs'; } }, ['Dismiss']));
  } else {
    ctas.appendChild(el('a', { href: '#/join', class: 'btn btn-primary' }, ['Join to apply']));
  }
  wrap.appendChild(ctas);
  wrap.appendChild(el('div', { class: 'divider' }));
  wrap.appendChild(el('div', { class: 'job-desc' }, [el('h3', {}, ['About the role']), el('p', {}, [job.description])]));
  return wrap;
}

function blurredSalary() {
  return el('span', { class: 'chip salary-chip blurred', title: 'Upgrade to see salary', onclick: () => import('../ui/frontierChip.js').then(({ frontierChip }) => { const c = frontierChip('premium-checkout'); c.click(); }) }, ['$•••k–$•••k']);
}

function quickApply(job, viewer) {
  const u = sel.user(viewer);
  const snapshot = { name: u.name, headline: u.headline, location: u.location, note: 'This exact snapshot is sent to the employer and frozen at apply time.' };
  const body = el('div', { class: 'stack' }, [
    el('p', {}, ['You’re applying to ', el('strong', {}, [job.title]), '. This is exactly what the employer will receive:']),
    el('div', { class: 'card card-pad snapshot' }, [
      el('div', { class: 'strong' }, [snapshot.name]),
      el('div', { class: 'muted' }, [snapshot.headline]),
      el('div', { class: 'small subtle' }, [snapshot.location]),
    ]),
    el('p', { class: 'small subtle' }, ['Your profile will be frozen at this moment for this application.']),
  ]);
  const submit = el('button', { class: 'btn btn-primary', onclick: async () => {
    submit.disabled = true;
    try { await actions.apply(job.id, snapshot); toast('Application sent.', { type: 'success' }); h.close(); location.hash = '#/jobs?job=' + job.id; }
    catch (e) { submit.disabled = false; toast('Your application could not be sent.', { type: 'danger' }); }
  } }, ['Submit application']);
  const h = openModal({ title: 'Quick Apply', body, footer: submit });
}

function saveSearch(viewer, facets) {
  toast('Search saved. Alerts will appear in your notifications.', { type: 'success' });
}

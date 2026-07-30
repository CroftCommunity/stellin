// employer.js — hiring console for anyone who posted a job. Job list ->
// applicants table with a stage dropdown and per-applicant history. Stage
// changes notify the applicant.
import { el, h1, timeAgo, emptyState, clear } from '../ui/dom.js';
import { sel } from '../store.js';
import { me, actions } from '../actions.js';
import { avatar } from '../ui/avatar.js';
import { toast } from '../ui/toast.js';
import { frontierChip } from '../ui/frontierChip.js';

const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Rejected'];

export default function employer(outlet, ctx) {
  const viewer = me();
  if (!viewer) { location.hash = '#/'; return; }
  const myJobs = sel.jobsByPoster(viewer);
  const screen = el('div', { class: 'screen employer-screen' });
  screen.appendChild(h1('Hiring'));

  if (!myJobs.length) {
    screen.appendChild(emptyState('📋', 'You have no job posts', 'The hiring console appears once you post a job. Post one to review applicants here.'));
    outlet.appendChild(screen); return;
  }

  let activeJob = ctx.query.job && myJobs.some(j => j.id === ctx.query.job) ? ctx.query.job : myJobs[0].id;
  const layout = el('div', { class: 'employer-layout' });
  const jobsCol = el('aside', { class: 'card employer-jobs' });
  const pipeCol = el('div', { class: 'card employer-pipe' });
  layout.append(jobsCol, pipeCol);
  screen.appendChild(layout);
  screen.appendChild(el('div', { class: 'row', style: { gap: '8px', marginTop: '12px', flexWrap: 'wrap' } }, [
    frontierChip('pipeline-bulk-actions'), frontierChip('schedule-interview'),
  ]));
  outlet.appendChild(screen);

  function drawJobs() {
    clear(jobsCol);
    jobsCol.appendChild(el('div', { class: 'card-pad strong' }, ['Your jobs']));
    myJobs.forEach(j => {
      const count = sel.applicationsForJob(j.id).length;
      jobsCol.appendChild(el('button', { class: 'employer-job-item' + (j.id === activeJob ? ' is-active' : ''), onclick: () => { activeJob = j.id; drawAll(); } }, [
        el('div', { class: 'grow' }, [el('div', { class: 'strong small' }, [j.title]), el('div', { class: 'subtle small' }, [`${count} applicant${count === 1 ? '' : 's'}`])]),
      ]));
    });
  }

  function drawPipe() {
    clear(pipeCol);
    const job = sel.job(activeJob);
    const apps = sel.applicationsForJob(activeJob).sort((a, b) => b.t - a.t);
    pipeCol.appendChild(el('div', { class: 'card-pad row-between' }, [el('h2', {}, [job.title]), el('span', { class: 'small muted' }, [`${apps.length} applicant${apps.length === 1 ? '' : 's'}`])]));
    if (!apps.length) { pipeCol.appendChild(emptyState('🗂', 'No applicants yet', 'When people apply, they’ll appear here to review and move through stages.')); return; }
    const table = el('div', { class: 'applicants' });
    table.appendChild(el('div', { class: 'applicant-row applicant-head small muted' }, [
      el('div', {}, ['Applicant']), el('div', {}, ['Applied']), el('div', {}, ['Stage']), el('div', {}, ['']),
    ]));
    apps.forEach(app => table.appendChild(applicantRow(app)));
    pipeCol.appendChild(table);
  }

  function applicantRow(app) {
    const u = sel.user(app.applicantId);
    const snap = app.profileSnapshot || {};
    const stageSel = el('select', { class: 'select stage-select', 'aria-label': 'Application stage for ' + (u?.name || 'applicant') },
      STAGES.map(s => el('option', { value: s, selected: s === app.stage }, [s])));
    stageSel.value = app.stage;
    stageSel.addEventListener('change', async () => {
      const newStage = stageSel.value;
      try { await actions.changeStage(app.id, newStage); toast(`${u?.name || 'Applicant'} moved to ${newStage}. They’ve been notified.`, { type: 'success' }); }
      catch (e) { stageSel.value = app.stage; toast('Could not update stage.', { type: 'danger' }); }
    });
    const history = app.history.map(h => `${h.stage}`).join(' → ');
    return el('div', { class: 'applicant-row' }, [
      el('div', { class: 'row', style: { gap: '8px' } }, [
        avatar(u, 'sm', { decorative: true }),
        el('div', {}, [el('a', { href: '#/in/' + u?.slug, class: 'strong small' }, [snap.name || u?.name || 'Applicant']), el('div', { class: 'subtle small' }, [snap.headline || u?.headline || ''])]),
      ]),
      el('div', { class: 'small muted' }, [timeAgo(app.t)]),
      el('div', {}, [stageSel, el('div', { class: 'small subtle stage-history' }, [history])]),
      el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, [frontierChip('message-from-pipeline', 'message'), frontierChip('interview-notes', 'notes')]),
    ]);
  }

  function drawAll() { drawJobs(); drawPipe(); }
  drawAll();
}

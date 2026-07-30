// seed.js — personas, entities, and the seed event log.
// Seeding replays this scripted log through the SAME reducers the live UI
// uses, so seeded and hand-added data are indistinguishable.
import { uid } from '../js/store.js';

/* ---------- persona registry (also drives the dev-bar dropdown) ---------- */
export const PERSONAS = [
  { id: 'maya',   name: 'Maya Chen',       headline: 'Senior Product Manager at Northwind Labs', tier: 'free',    credits: 0, location: 'Seattle, WA' },
  { id: 'marcus', name: 'Marcus Webb',     headline: 'Technical Recruiter at TalentBridge',       tier: 'premium', credits: 5, location: 'Austin, TX' },
  { id: 'jordan', name: 'Jordan Ellis',    headline: 'Software Engineer · Open to work',          tier: 'free',    credits: 0, location: 'Denver, CO', openToWork: true },
  { id: 'sam',    name: 'Sam Okafor',      headline: 'New to Stellin',                           tier: 'free',    credits: 0, location: 'Chicago, IL' },
  { id: 'priya',  name: 'Priya Sharma',    headline: 'CS Senior at Lakeview University',          tier: 'free',    credits: 0, location: 'Boston, MA' },
  { id: 'david',  name: 'David Park',      headline: 'Independent Analyst · Market & strategy',   tier: 'free',    credits: 0, location: 'New York, NY' },
  { id: 'elena',  name: 'Elena Rodriguez', headline: 'Founder at Brightpath Health',              tier: 'free',    credits: 0, location: 'San Francisco, CA' },
  { id: 'alex',   name: 'Alex Kim',        headline: 'Security Engineer at Cobalt Systems',       tier: 'free',    credits: 0, location: 'Portland, OR' },
  { id: 'tony',   name: 'Tony Russo',      headline: 'Sales Development Rep at Apex Outreach',    tier: 'free',    credits: 0, location: 'Miami, FL' },
];

export const COMPANIES = [
  { id: 'northwind',   name: 'Northwind Labs',      industry: 'Software', tagline: 'Tools for focused teams.', adminId: null },
  { id: 'talentbridge',name: 'TalentBridge',        industry: 'Staffing & Recruiting', tagline: 'People, matched.', adminId: null },
  { id: 'brightpath',  name: 'Brightpath Health',   industry: 'Health Care', tagline: 'Care that reaches further.', adminId: 'elena' },
  { id: 'cobalt',      name: 'Cobalt Systems',      industry: 'Cybersecurity', tagline: 'Secure by default.', adminId: null },
  { id: 'apex',        name: 'Apex Outreach',       industry: 'Sales', tagline: 'Pipeline, delivered.', adminId: null },
];
export const SCHOOLS = [{ id: 'lakeview', name: 'Lakeview University' }];

export const SKILLS = [
  'Product Management','Roadmapping','User Research','A/B Testing','SQL','Data Analysis',
  'JavaScript','TypeScript','React','Node.js','System Design','Accessibility',
  'Recruiting','Sourcing','Interviewing','Employer Branding','Python','Machine Learning',
  'Figma','UX Design','Prototyping','Public Speaking','Go-to-Market','Fundraising',
  'Cybersecurity','Threat Modeling','Cloud Security','Cold Outreach','CRM','Negotiation',
];

/* ---------- offset resolver ----------
   Accepts a number (ms delta) or a string like "-3d 14:20", "-2h", "-30m". */
export function resolveT(now, spec) {
  if (typeof spec === 'number') return now + spec;
  if (!spec || spec === 'now' || spec === '0') return now;
  const dayM = spec.match(/-(\d+)d/);
  const hourM = spec.match(/-(\d+)h/);
  const minM = spec.match(/-(\d+)m(?!s)/);
  const clock = spec.match(/\b(\d{1,2}):(\d{2})\b/);
  let t = now;
  if (dayM || clock) {
    const dt = new Date(now);
    if (dayM) dt.setDate(dt.getDate() - Number(dayM[1]));
    if (clock) dt.setHours(Number(clock[1]), Number(clock[2]), 0, 0);
    t = dt.getTime();
  }
  if (hourM) t -= Number(hourM[1]) * 3600000;
  if (minM) t -= Number(minM[1]) * 60000;
  return t;
}

/* ---------- Delete All: accounts only ----------
   A user.created (name/headline/avatar) for each of the 9 personas. Nothing else. */
export function buildDeleteAllEvents(now = Date.now()) {
  return PERSONAS.map((p, i) => ({
    id: uid('seed'), t: now - (PERSONAS.length - i) * 1000, actor: 'system', type: 'user.created',
    payload: {
      id: p.id, name: p.name, headline: p.headline, tier: p.tier, credits: p.credits,
      location: p.location, openToWork: !!p.openToWork,
    },
  }));
}

/* ---------- Seed: a lived-in site ---------- */
export function buildSeedEvents(now = Date.now()) {
  const ev = [];
  let seq = 0;
  const E = (off, actor, type, payload = {}) =>
    ev.push({ id: 'seed_' + (seq++).toString(36), t: resolveT(now, off), actor, type, payload });

  // --- accounts (long ago) ---
  for (const p of PERSONAS) {
    E('-400d 09:00', 'system', 'user.created', {
      id: p.id, name: p.name, headline: p.headline, tier: p.tier, credits: p.credits,
      location: p.location, openToWork: !!p.openToWork,
      about: ABOUT[p.id] || '',
    });
  }
  for (const c of COMPANIES) E('-399d 09:00', 'system', 'company.created', { ...c });
  for (const s of SCHOOLS) E('-399d 09:00', 'system', 'school.created', { ...s });

  // --- positions & education ---
  E('-380d', 'maya',   'position.added', { id: 'p_maya', userId: 'maya', title: 'Senior Product Manager', companyId: 'northwind', current: true, start: '2021' });
  E('-380d', 'marcus', 'position.added', { id: 'p_marcus', userId: 'marcus', title: 'Technical Recruiter', companyId: 'talentbridge', current: true, start: '2020' });
  E('-380d', 'jordan', 'position.added', { id: 'p_jordan', userId: 'jordan', title: 'Software Engineer', companyId: 'cobalt', current: false, start: '2019', end: '2024' });
  E('-380d', 'elena',  'position.added', { id: 'p_elena', userId: 'elena', title: 'Founder', companyId: 'brightpath', current: true, start: '2022' });
  E('-380d', 'alex',   'position.added', { id: 'p_alex', userId: 'alex', title: 'Security Engineer', companyId: 'cobalt', current: true, start: '2021' });
  E('-380d', 'tony',   'position.added', { id: 'p_tony', userId: 'tony', title: 'Sales Development Rep', companyId: 'apex', current: true, start: '2023' });
  E('-380d', 'david',  'position.added', { id: 'p_david', userId: 'david', title: 'Independent Analyst', companyId: null, current: true, start: '2018' });
  E('-380d', 'priya',  'education.added', { id: 'e_priya', userId: 'priya', schoolId: 'lakeview', degree: 'B.S.', field: 'Computer Science', start: '2022', end: '2026' });
  E('-380d', 'maya',   'education.added', { id: 'e_maya', userId: 'maya', schoolId: 'lakeview', degree: 'B.A.', field: 'Cognitive Science', start: '2012', end: '2016' });

  // --- skills & endorsements (a few) ---
  const skillMap = {
    maya: ['Product Management','Roadmapping','User Research','SQL'],
    marcus: ['Recruiting','Sourcing','Interviewing','Employer Branding'],
    jordan: ['JavaScript','TypeScript','React','Node.js','System Design'],
    priya: ['Python','Data Analysis','Machine Learning'],
    david: ['Data Analysis','Go-to-Market','Public Speaking'],
    elena: ['Fundraising','Go-to-Market','Product Management'],
    alex: ['Cybersecurity','Threat Modeling','Cloud Security'],
    tony: ['Cold Outreach','CRM','Negotiation'],
  };
  for (const [uidx, list] of Object.entries(skillMap))
    for (const name of list) E('-370d', uidx, 'skill.added', { userId: uidx, name });
  E('-60d', 'jordan', 'endorsement.added', { userId: 'maya', skillId: 'product-management' });
  E('-58d', 'david',  'endorsement.added', { userId: 'maya', skillId: 'product-management' });
  E('-55d', 'elena',  'endorsement.added', { userId: 'jordan', skillId: 'react' });
  E('-54d', 'priya',  'endorsement.added', { userId: 'jordan', skillId: 'react' });
  E('-54d', 'maya',   'endorsement.added', { userId: 'jordan', skillId: 'system-design' });

  // --- connections (invited + accepted, long ago so out of the rate window) ---
  const edge = (a, b, off = '-300d') => { E(off, a, 'connection.invited', { target: b }); E(off, b, 'connection.accepted', { target: a }); };
  edge('maya', 'jordan');
  edge('maya', 'david');
  edge('maya', 'elena');
  edge('jordan', 'priya');
  edge('jordan', 'alex');
  edge('elena', 'marcus');
  edge('elena', 'david');
  edge('marcus', 'tony');

  // --- follows (asymmetric) ---
  for (const f of ['maya','jordan','priya','elena','marcus']) E('-200d', f, 'follow.added', { target: 'david', targetType: 'user' });
  E('-200d', 'priya', 'follow.added', { target: 'brightpath', targetType: 'company' });

  // --- jobs ---
  E('-12d 10:00', 'marcus', 'job.created', { id: 'job_fe', title: 'Senior Frontend Engineer', companyId: 'talentbridge', workMode: 'Remote', seniority: 'Senior', location: 'Remote (US)', salaryBand: '$150k–$185k', description: 'Build accessible, performant web apps in React/TypeScript for a growth-stage client. You will own features end to end and mentor two engineers.' });
  E('-11d 10:00', 'marcus', 'job.created', { id: 'job_da', title: 'Data Analyst', companyId: 'talentbridge', workMode: 'On-site', seniority: 'Entry', location: 'Austin, TX', salaryBand: '$70k–$90k', description: 'Turn product and sales data into decisions. SQL required; Python a plus.' });
  E('-10d 10:00', 'elena',  'job.created', { id: 'job_pd', title: 'Product Designer', companyId: 'brightpath', workMode: 'Hybrid', seniority: 'Mid', location: 'San Francisco, CA', salaryBand: '$120k–$150k', description: 'Design patient-facing experiences that lower the barrier to care.' });
  E('-9d 10:00',  'marcus', 'job.created', { id: 'job_pmi', title: 'Product Management Intern', companyId: 'northwind', workMode: 'Hybrid', seniority: 'Internship', location: 'Seattle, WA', salaryBand: '$35/hr', description: 'A summer internship for students exploring product management. Mentorship included.' });

  // --- posts ---
  // David: carousel, long text, image. Heavy reactions.
  E('-6d 08:30', 'david', 'post.created', {
    id: 'post_carousel', text: 'Five slides on why most market maps mislead you — and a cleaner way to read them.',
    media: { type: 'carousel', slides: [
      { title: 'Market maps mislead', body: 'Boxes imply boundaries that customers do not feel.' },
      { title: 'Start with jobs', body: 'Group by the job to be done, not the category label.' },
      { title: 'Follow the switch', body: 'The real competitor is whatever they do today instead.' },
      { title: 'Size the trigger', body: 'Demand shows up at a moment, not a demographic.' },
      { title: 'Redraw quarterly', body: 'A map is a snapshot. Date it and redraw it.' },
    ] }, hashtags: ['strategy','markets'],
  });
  E('-5d 09:00', 'david', 'post.created', {
    id: 'post_long', text: LONG_TEXT, hashtags: ['careers'],
  });
  E('-4d 12:00', 'david', 'post.created', {
    id: 'post_img', text: 'Whiteboard from this morning’s strategy session. Sometimes the messy version is the honest one.',
    media: { type: 'image', kind: 'svg', variant: 'whiteboard' },
  });

  // Maya: launch-lessons post + quote-repost of David's carousel
  E('-3d 14:20', 'maya', 'post.created', {
    id: 'post_launch', text: 'We shipped a big launch last week. Three lessons: scope the demo before the feature, write the changelog first, and let support draft the FAQ. What would you add?',
    hashtags: ['productmanagement','launch'],
  });
  E('-2d 16:00', 'maya', 'post.reposted', { id: 'post_maya_quote', original: 'post_carousel', quote: 'This reframing of market maps is the clearest I have seen. Slide 3 especially.' });

  // Jordan: open-to-work
  E('-3d 10:00', 'jordan', 'post.created', {
    id: 'post_otw', text: 'Making it official: I am open to work as a frontend/full-stack engineer (React, TypeScript, Node). Referrals and leads hugely appreciated — reposts even more so.',
    hashtags: ['opentowork'],
  });

  // Marcus: we're hiring + comment on Jordan's post (comment authored below)
  E('-11d 11:00', 'marcus', 'post.created', {
    id: 'post_hiring', text: 'We’re hiring a Senior Frontend Engineer (remote, US). Accessible React at scale, real mentorship, no on-call. Link in the job below.',
    hashtags: ['hiring'], media: { type: 'jobref', jobId: 'job_fe' },
  });

  // Priya: internship announcement (high reactions)
  E('-7d 15:00', 'priya', 'post.created', {
    id: 'post_intern', text: 'Thrilled to share I’ll be interning this summer! Grateful to everyone who reviewed my resume and did mock interviews with me. To other students: keep going.',
    hashtags: ['internship','students'],
  });

  // Elena: as herself + as Brightpath (company authored)
  E('-5d 13:00', 'elena', 'post.created', { id: 'post_elena', text: 'Reflecting on year two at Brightpath. The hard part was never the product — it was earning trust one clinic at a time.' });
  E('-4d 09:30', 'brightpath', 'post.created', { id: 'post_company', authorType: 'company', text: 'Brightpath Health is growing. We’re hiring a Product Designer to shape patient-facing care. If you want your design work to reach people who need it, come build with us.', media: { type: 'jobref', jobId: 'job_pd' } });

  // Alex: one old low-engagement post
  E('-40d 11:00', 'alex', 'post.created', { id: 'post_alex', text: 'PSA: rotate your long-lived credentials. Yes, that one you’ve been meaning to get to.' });

  // Tony: promotional, zero engagement
  E('-8d 12:00', 'tony', 'post.created', { id: 'post_tony', text: 'Is your pipeline stalling? Apex Outreach books qualified meetings on autopilot. DM me for a free teardown of your current sequence.' });

  // --- comments ---
  // David carousel: Priya asks, David replies (nested)
  E('-6d 09:15', 'priya', 'comment.added', { id: 'c_q', postId: 'post_carousel', text: 'Slide 3 — how do you find the "switch" competitor when customers don’t name it?' });
  E('-6d 09:40', 'david', 'comment.added', { id: 'c_a', postId: 'post_carousel', parentId: 'c_q', text: 'Ask what they did the last time the problem came up. The answer is rarely a competitor’s logo — it’s a spreadsheet or "nothing."' });
  // Maya launch: Jordan + Elena
  E('-3d 15:00', 'jordan', 'comment.added', { id: 'c_j', postId: 'post_launch', text: 'Writing the changelog first is underrated. Forces you to name the value early.' });
  E('-3d 15:30', 'elena',  'comment.added', { id: 'c_e', postId: 'post_launch', text: 'I’d add: pre-brief support the day before, not the morning of.' });
  // Jordan open-to-work: encouraging + marcus
  E('-3d 10:30', 'priya',  'comment.added', { id: 'c_p2', postId: 'post_otw', text: 'You’ll land somewhere great, Jordan. Rooting for you!' });
  E('-3d 11:00', 'marcus', 'comment.added', { id: 'c_m', postId: 'post_otw', text: 'Sent you a note — we have a couple of roles that could fit.' });

  // --- reactions ---
  // Maya's launch post: Elena FIRST, then David, then Jordan -> "Elena and 2 others"
  E('-3d 14:40', 'elena',  'reaction.added', { postId: 'post_launch', reaction: 'insightful' });
  E('-3d 14:50', 'david',  'reaction.added', { postId: 'post_launch', reaction: 'like' });
  E('-3d 15:10', 'jordan', 'reaction.added', { postId: 'post_launch', reaction: 'celebrate' });
  // David carousel heavy reactions
  for (const [i, u] of ['maya','jordan','priya','elena','marcus'].entries())
    E(`-6d 1${i}:00`, u, 'reaction.added', { postId: 'post_carousel', reaction: i % 2 ? 'insightful' : 'like' });
  // Jordan open-to-work: Support reactions
  for (const u of ['maya','priya','elena','david']) E('-3d 10:20', u, 'reaction.added', { postId: 'post_otw', reaction: 'support' });
  // Priya internship: high reaction count
  for (const u of ['maya','jordan','david','elena']) E('-7d 15:30', u, 'reaction.added', { postId: 'post_intern', reaction: 'celebrate' });

  // --- messaging ---
  // Baseline connected thread Maya <-> Jordan (read)
  E('-9d 10:00', 'maya',   'message.sent', { id: 'm1', convId: 'conv_mj', to: 'jordan', text: 'Hey Jordan — saw you might be looking. Want an intro to Elena’s network?' });
  E('-9d 10:30', 'jordan', 'message.sent', { id: 'm2', convId: 'conv_mj', to: 'maya', text: 'That would be amazing, thank you!' });
  E('-9d 10:31', 'maya',   'message.read', { convId: 'conv_mj', upTo: resolveT(now, '-9d 10:30') });
  E('-9d 10:31', 'jordan', 'message.read', { convId: 'conv_mj', upTo: resolveT(now, '-9d 10:30') });
  // Cold outreach Marcus -> Jordan (Requests), one credit spent
  E('-2d 09:00', 'marcus', 'message.sent', { id: 'm_cold', convId: 'conv_req', to: 'jordan', text: 'Hi Jordan — I recruit for frontend roles and your open-to-work post caught my eye. Open to a quick chat about a remote Senior role?', request: true, creditSpent: true, participants: ['marcus','jordan'] });

  // --- applications: Jordan applied to 2 jobs (Applied, Interview) ---
  E('-6d 11:00', 'jordan', 'job.applied', { id: 'app_fe', jobId: 'job_fe', profileSnapshot: snapshot('jordan') });
  E('-5d 11:00', 'jordan', 'job.applied', { id: 'app_da', jobId: 'job_da', profileSnapshot: snapshot('jordan') });
  E('-4d 09:00', 'marcus', 'application.stageChanged', { applicationId: 'app_da', stage: 'Interview' });

  // --- privacy: Alex blocked Tony ---
  E('-20d', 'alex', 'user.blocked', { target: 'tony' });
  // Alex privacy settings: anonymous viewing, hidden connections
  E('-20d', 'alex', 'settings.changed', { viewingMode: 'anonymous', connectionsVisibility: 'onlyMe' });

  // --- Tony at the invite cap (rolling 7-day window) ---
  // Named pending invites + one withdrawn, then padded with prospects to reach the hard cap.
  E('-2d', 'tony', 'connection.invited', { target: 'sam', note: 'Let’s connect!' });
  E('-2d', 'tony', 'connection.invited', { target: 'priya', note: 'Saw your internship post — congrats!' });
  E('-3d', 'tony', 'connection.invited', { target: 'david' });
  E('-1d', 'tony', 'invite.withdrawn',  { target: 'david' });
  // 97 prospect invites (target ids have no user record -> summarized, not listed by name)
  for (let i = 1; i <= 97; i++) E(`-${(i % 6) + 1}d`, 'tony', 'connection.invited', { target: `prospect_${i}` });

  // --- Priya -> Maya invitation pending (authored near the end so it stays pending) ---
  E('-45m', 'priya', 'connection.invited', { target: 'maya', note: 'Hi Maya! Jordan spoke highly of you. Would love to connect.' });

  // --- some profile views for Maya's "who viewed" ---
  E('-1d', 'david', 'profile.viewed', { target: 'maya', mode: 'full' });
  E('-2d', 'marcus', 'profile.viewed', { target: 'maya', mode: 'full' });
  E('-3d', 'alex', 'profile.viewed', { target: 'maya', mode: 'anonymous' });

  return ev;
}

/* ---------- helpers / content ---------- */
function snapshot(id) {
  const p = PERSONAS.find(x => x.id === id);
  return { name: p.name, headline: p.headline, location: p.location, note: 'Snapshot frozen at apply time.' };
}

const ABOUT = {
  maya: 'Product manager focused on developer tools and honest changelogs. I like small teams, clear docs, and shipping the boring 20% that makes the exciting 80% usable.',
  marcus: 'Technical recruiter who actually reads the job description. I place frontend and data folks and try to make the process less of a black box.',
  jordan: 'Frontend/full-stack engineer (React, TypeScript, Node). I care about accessibility and fast feedback loops. Currently open to work.',
  priya: 'CS senior at Lakeview, interested in applied ML and data. Looking for a summer internship and learning in public.',
  david: 'Independent analyst. I write about markets, strategy, and the gap between the slide and the reality.',
  elena: 'Founder at Brightpath Health. Building care that reaches the people usually left out of it.',
  alex: 'Security engineer. Threat modeling, cloud security, and the occasional reminder to rotate your credentials.',
  tony: 'SDR at Apex Outreach. I help teams book more qualified meetings.',
  sam: '',
};

const LONG_TEXT = 'A thing I keep relearning about careers: the compounding is real but invisible for a long time. ' +
  'You do the unglamorous work — the doc nobody asked for, the follow-up nobody remembered, the small fix that prevents a big outage — and for months it looks like nothing. ' +
  'Then one quarter someone says "you’re the person who always closes the loop," and suddenly every door is a little less heavy. ' +
  'The trap is measuring the daily slope instead of the area under the curve. The daily slope is noisy and often flat. The area under the curve only ever goes up if you keep showing up. ' +
  'So if you’re early and it feels like nothing is happening: that’s not evidence you’re doing it wrong. That’s just what the flat part of an exponential feels like from the inside.';

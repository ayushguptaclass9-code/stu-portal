// Student portal: dashboard, profile, skill assessment + gap analysis,
// internships/jobs browsers, applications, learning, portfolio, shared pages.
import {
  initDashboardShell, icon, toast, openModal, confirmDialog, btnLoading, emptyState,
  escapeHTML, formatDate, timeAgo, daysUntil, isClosed, avatarHTML, debounce,
  chipRow, statusBadge, matchBadge, statCard, pageHeader, skeletonBlocks,
  tagInput, donutSVG, progressRow, barList, renderNotificationsPage, renderSettingsPage, APP_BASE
} from './common.js';
import {
  getStudentProfile, saveStudentProfile, setDocument, getInternships, getJobs,
  applyForOpportunity, getStudentApplications, withdrawApplication,
  getLearningPrograms, enrollInProgram, getStudentEnrollments, updateEnrollmentProgress,
  saveSkillAssessment, getLatestAssessment, getPortfolio, savePortfolio,
  getNotifications, markAllNotificationsRead, matchPercent
} from './database.js';
import { setupImageUpload } from './storage.js';
import { QUESTIONS, TARGET_SKILL_LEVELS, computeScores } from './questions.js';
import { ensureDemoOpportunities } from './demo-data.js';
import { fetchExternalITJobs } from './external-jobs.js';

const ctx = await initDashboardShell();
if (!ctx) throw new Error('unauthenticated');
const uid = ctx.user.uid;
const content = document.getElementById('pageContent');
let SP = (await getStudentProfile(uid)) || { userId: uid, name: ctx.profile.name, email: ctx.profile.email, technicalSkills: [], softSkills: [], languages: [], savedInternships: [], savedJobs: [] };
const params = new URLSearchParams(location.search);

const TECH_SUGGESTIONS = ['JavaScript', 'Python', 'Java', 'C++', 'SQL', 'HTML', 'CSS', 'React', 'Node.js',
  'MongoDB', 'AWS', 'Docker', 'AI/ML', 'Data Analysis', 'Cybersecurity', 'Android', 'Flutter', 'Git'];
const SOFT_SUGGESTIONS = ['Communication', 'Leadership', 'Teamwork', 'Problem Solving', 'Time Management', 'Adaptability', 'Presentation'];
const LANGS = ['English', 'Hindi', 'Tamil', 'Telugu', 'Bengali', 'Marathi', 'Kannada', 'Malayalam', 'Gujarati', 'Punjabi'];

/* ==================== ROUTER ==================== */
const pages = {
  'student-dashboard': renderDashboard,
  'student-profile': renderProfile,
  'student-skills': renderSkills,
  'student-internships': () => renderOpportunities('internship'),
  'student-jobs': () => renderOpportunities('job'),
  'student-learning': renderLearning,
  'student-applications': renderApplications,
  'student-portfolio': renderPortfolio,
  'student-notifications': () => renderNotificationsPage(content, uid),
  'student-settings': () => renderSettingsPage(content, ctx.user)
};
await (pages[document.body.dataset.page] || renderDashboard)();

/* ==================== DASHBOARD ==================== */
async function renderDashboard() {
  content.innerHTML = pageHeader(`Hello, ${SP.name?.split(' ')[0] || 'there'}! 👋`, new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) +
    `<div class="stat-grid">${'<div class="sk" style="height:84px"></div>'.repeat(6)}</div><div class="panel-grid mt-2"><div class="sk" style="height:300px"></div><div class="sk" style="height:300px"></div></div>`;

  const [internships, jobs, apps, portfolio] = await Promise.all([
    getInternships(), getJobs(), getStudentApplications(uid), getPortfolio(uid)
  ]);
  const mySkills = SP.technicalSkills || [];
  const open = list => list.filter(o => !isClosed(o));
  const ranked = list => open(list)
    .filter(o => !apps.some(a => a.opportunityId === o.id))
    .map(o => ({ o, m: matchPercent(mySkills, o.skills) }))
    .sort((a, b) => b.m - a.m);
  const gaps = SP.skillScores
    ? TARGET_SKILL_LEVELS.filter(t => (SP.skillScores[t.skill] ?? 0) < t.required)
    : [];

  const noAssessment = !SP.skillScore;
  content.innerHTML = pageHeader(`Hello, ${SP.name?.split(' ')[0] || 'there'}! 👋`, 'Here is your progress at a glance') + `
    ${noAssessment || !SP.college ? `<div class="alert alert-info">${icon('rocket', 18)}<span>
      ${!SP.college ? 'Complete your <a href="profile.html">profile</a>' : 'Take the <a href="skills.html?tab=assessment">skill assessment</a>'}
      to unlock personalized recommendations.</span></div>` : ''}
    <div class="stat-grid">
      ${statCard({ ico: 'target', color: 'indigo', value: (SP.skillScore ?? 0) + '%', label: 'Skill Score', sub: noAssessment ? 'Not assessed' : 'Keep improving!' })}
      ${statCard({ ico: 'chart', color: 'amber', value: gaps.length, label: 'Skill Gaps', sub: gaps.length ? 'See recommendations' : 'All good' })}
      ${statCard({ ico: 'briefcase', color: 'teal', value: ranked(internships).length, label: 'Recommended Internships' })}
      ${statCard({ ico: 'building', color: 'blue', value: ranked(jobs).length, label: 'Recommended Jobs' })}
      ${statCard({ ico: 'file', color: 'indigo', value: apps.length, label: 'Applications', sub: `${apps.filter(a => ['Shortlisted', 'Interview'].includes(a.status)).length} in progress` })}
      ${statCard({ ico: 'cert', color: 'green', value: (portfolio?.certifications || []).length, label: 'Certifications' })}
    </div>
    <div class="panel-grid">
      <div class="card card-pad">
        <h3 class="card-title">Recommended internships <a class="btn btn-ghost btn-sm" href="internships.html">View all →</a></h3>
        ${miniList(ranked(internships).slice(0, 4), 'briefcase', 'No open internships match yet. <a href="internships.html">Browse all</a>')}
        <h3 class="card-title mt-3">Recommended jobs <a class="btn btn-ghost btn-sm" href="jobs.html">View all →</a></h3>
        ${miniList(ranked(jobs).slice(0, 4), 'building', 'No open jobs match yet. <a href="jobs.html">Browse all</a>')}
      </div>
      <div>
        <div class="card card-pad" style="margin-bottom:20px">
          <h3 class="card-title">Skill snapshot</h3>
          ${noAssessment
            ? `<div class="empty-state" style="padding:26px 10px"><div class="es-icon">${icon('target', 26)}</div><h4>No assessment yet</h4><p>Take the assessment to unlock your skill profile and gap analysis.</p><a class="btn btn-primary btn-sm" href="skills.html?tab=assessment">Start assessment</a></div>`
            : donutSVG(SP.skillScore, { label: 'Overall skill score' }) +
              `<div class="mt-2">${Object.entries(SP.skillScores || {}).slice(0, 5).map(([s, v]) => progressRow(s, v)).join('')}</div>
               <a class="btn btn-soft btn-sm btn-block mt-2" href="skills.html?tab=profile">View full skill profile</a>`}
        </div>
        <div class="card card-pad">
          <h3 class="card-title">Recent applications <a class="btn btn-ghost btn-sm" href="applications.html">All →</a></h3>
          ${apps.slice(0, 5).map(a => `<div class="list-item">
            <span class="stat-icon" style="background:var(--primary-light);color:var(--primary)">${icon(a.type === 'job' ? 'building' : 'briefcase', 17)}</span>
            <div style="flex:1;min-width:0"><div class="li-title">${escapeHTML(a.opportunityTitle)}</div>
            <div class="li-sub">${escapeHTML(a.companyName)} · ${timeAgo(a.createdAt)}</div></div>${statusBadge(a.status)}
          </div>`).join('') || '<p class="text-muted" style="font-size:13.5px">No applications yet. <a href="internships.html">Browse internships</a></p>'}
        </div>
      </div>
    </div>`;

  function miniList(items, ico, noneMsg) {
    if (!items.length) return `<p class="text-muted" style="font-size:13.5px">${noneMsg}</p>`;
    return items.map(({ o, m }) => `<div class="list-item">
      <span class="stat-icon" style="background:var(--bg);color:var(--text-2)">${icon(ico, 17)}</span>
      <div style="flex:1;min-width:0"><div class="li-title">${escapeHTML(o.title)}</div>
      <div class="li-sub">${escapeHTML(o.companyName)} · ${escapeHTML(o.location)}</div></div>
      ${matchBadge(m)}</div>`).join('');
  }
}

/* ==================== PROFILE ==================== */
function renderProfile() {
  const imgId = 'pfUpload';
  content.innerHTML = pageHeader('My Profile', 'Recruiters see this — keep it complete and accurate') + `
    <div class="grid-2">
      <div class="card card-pad">
        <h3 class="card-title">Personal details</h3>
        <div class="profile-upload">
          <span class="avatar avatar-xl avatar-hover" id="${imgId}Preview" data-existing="${escapeHTML(ctx.profile.profileImage || '')}"
            style="position:relative;cursor:pointer">${ctx.profile.profileImage ? `<img src="${escapeHTML(ctx.profile.profileImage)}" alt="">` : escapeHTML((SP.name || '?').slice(0, 2).toUpperCase())}</span>
          <div><strong style="font-size:14.5px">Profile picture</strong>
            <p class="text-muted" style="font-size:12.5px">JPG/PNG, max 5MB. Uploaded via ImgBB.</p>
            <input type="file" id="${imgId}" accept="image/*" class="hidden"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Full name</label><input class="input" id="pfName" value="${escapeHTML(SP.name || '')}"></div>
          <div class="form-group"><label>Email</label><input class="input" value="${escapeHTML(SP.email || ctx.profile.email)}" disabled></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Phone</label><input class="input" id="pfPhone" value="${escapeHTML(SP.phone || '')}" placeholder="+91…"></div>
          <div class="form-group"><label>Location</label><input class="input" id="pfLocation" value="${escapeHTML(SP.location || '')}" placeholder="City, State"></div>
        </div>
        <div class="form-row-3">
          <div class="form-group"><label>College</label><input class="input" id="pfCollege" value="${escapeHTML(SP.college || '')}"></div>
          <div class="form-group"><label>Degree</label><input class="input" id="pfDegree" value="${escapeHTML(SP.degree || '')}" placeholder="B.Tech"></div>
          <div class="form-group"><label>Graduation year</label><input class="input" id="pfGrad" type="number" min="2020" max="2035" value="${escapeHTML(SP.graduationYear || '')}"></div>
        </div>
        <div class="form-group"><label>Branch</label><input class="input" id="pfBranch" value="${escapeHTML(SP.branch || '')}" placeholder="Computer Science"></div>
        <div class="form-group"><label>About me</label>
          <textarea class="textarea" id="pfAbout" placeholder="A short introduction…">${escapeHTML(SP.about || '')}</textarea></div>
        <button class="btn btn-primary" id="pfSave">${icon('check', 16)} Save profile</button>
      </div>
      <div>
        <div class="card card-pad" style="margin-bottom:20px">
          <h3 class="card-title">Technical skills</h3>
          <div id="tagsTech"></div>
          <h3 class="card-title mt-3">Soft skills</h3>
          <div id="tagsSoft"></div>
          <h3 class="card-title mt-3">Languages</h3>
          <div id="tagsLang"></div>
        </div>
        <div class="card card-pad">
          <h3 class="card-title">Career interests</h3>
          <div id="tagsCareer"></div>
          <p class="form-hint">Used by the recommendation engine to match opportunities.</p>
        </div>
      </div>
    </div>`;

  const tTech = tagInput(content.querySelector('#tagsTech'), { placeholder: 'Add a skill…', suggestions: TECH_SUGGESTIONS });
  const tSoft = tagInput(content.querySelector('#tagsSoft'), { placeholder: 'Add a soft skill…', suggestions: SOFT_SUGGESTIONS });
  const tLang = tagInput(content.querySelector('#tagsLang'), { placeholder: 'Add a language…', suggestions: LANGS });
  const tCareer = tagInput(content.querySelector('#tagsCareer'), { placeholder: 'e.g. Web Development, Data Science…', suggestions: ['Web Development', 'Data Science', 'Cloud', 'Mobile Development', 'Cybersecurity', 'AI/ML'] });
  tTech.set(SP.technicalSkills); tSoft.set(SP.softSkills); tLang.set(SP.languages); tCareer.set(SP.careerInterests);

  setupImageUpload({
    inputEl: content.querySelector(`#${imgId}`),
    previewEl: content.querySelector(`#${imgId}Preview`),
    onUploaded: () => {}
  });

  content.querySelector('#pfSave').addEventListener('click', async e => {
    const btn = e.currentTarget;
    btnLoading(btn, true, 'Saving…');
    try {
      const imageUrl = content.querySelector(`#${imgId}Preview img`)?.src || '';
      const data = {
        userId: uid, email: SP.email || ctx.profile.email,
        name: val('pfName'), phone: val('pfPhone'), location: val('pfLocation'),
        college: val('pfCollege'), degree: val('pfDegree'), branch: val('pfBranch'),
        graduationYear: val('pfGrad'), about: val('pfAbout'),
        technicalSkills: tTech.get(), softSkills: tSoft.get(),
        languages: tLang.get(), careerInterests: tCareer.get(),
        profileImage: imageUrl
      };
      if (!data.name) throw new Error('Name is required.');
      await saveStudentProfile(uid, data);
      await setDocument('users', uid, { name: data.name, profileImage: imageUrl }, { timestamps: false });
      SP = { ...SP, ...data };
      toast('Profile saved successfully!');
    } catch (err) { toast(err.message, 'error'); }
    finally { btnLoading(btn, false); }
  });
  function val(id) { return content.querySelector(`#${id}`).value.trim(); }
}

/* ==================== SKILL ASSESSMENT + GAP ANALYSIS ==================== */
async function renderSkills() {
  const tab = params.get('tab') === 'profile' ? 'profile' : 'assessment';
  content.innerHTML = pageHeader('Skill Assessment', 'Evaluate your skills and discover exactly what to improve') + `
    <div class="tabs">
      <button class="tab-btn" data-tab="assessment">Take Assessment</button>
      <button class="tab-btn" data-tab="profile">My Skill Profile</button>
    </div><div id="skillBody"></div>`;
  const body = content.querySelector('#skillBody');
  const setActive = t => content.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === t));
  const show = async t => { setActive(t); history.replaceState(null, '', `skills.html?tab=${t}`); t === 'assessment' ? renderAssessment(body) : renderSkillProfile(body); };
  content.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
  await show(tab);
}

async function renderAssessment(body) {
  const existing = await getLatestAssessment(uid);
  if (existing && !body.dataset.retake) {
    body.innerHTML = `<div class="card card-pad" style="max-width:640px;margin:0 auto;text-align:center">
      ${donutSVG(existing.overall, { label: 'Your current skill score' })}
      <div class="grid-3 mt-3" style="max-width:420px;margin:20px auto">
        <div>${donutSVG(existing.technicalScore, { color: 'var(--secondary)', label: 'Technical' })}</div>
        <div>${donutSVG(existing.softScore, { color: 'var(--purple)', label: 'Soft skills' })}</div>
        <div>${donutSVG(100, { color: 'var(--border)', label: 'Completed ✓' })}</div>
      </div>
      <p class="text-muted" style="font-size:13.5px">Last assessed ${formatDate(existing.createdAt)}. Retake anytime to refresh your skill profile.</p>
      <div class="flex mt-2" style="justify-content:center">
        <a class="btn btn-soft" href="skills.html?tab=profile">View skill profile &amp; gaps</a>
        <button class="btn btn-primary" id="retakeBtn">${icon('edit', 16)} Retake assessment</button>
      </div></div>`;
    body.querySelector('#retakeBtn').addEventListener('click', () => { body.dataset.retake = '1'; renderAssessment(body); });
    return;
  }

  const state = { i: 0, answers: Array(QUESTIONS.length).fill(null) };
  body.innerHTML = `<div class="card card-pad" style="max-width:680px;margin:0 auto">
    <div class="flex-between" style="margin-bottom:12px">
      <span class="badge badge-indigo" id="qCat"></span>
      <span class="text-muted" style="font-size:13px" id="qCount"></span></div>
    <div class="assess-progress"><i id="qBar" style="width:0%"></i></div>
    <h3 id="qText" style="font-size:18px;margin-bottom:20px;min-height:48px"></h3>
    <div id="qOptions"></div>
    <div class="flex-between mt-3">
      <button class="btn btn-outline" id="qPrev">← Previous</button>
      <button class="btn btn-primary" id="qNext">Next →</button>
    </div></div>`;

  const els = {
    cat: body.querySelector('#qCat'), count: body.querySelector('#qCount'), bar: body.querySelector('#qBar'),
    text: body.querySelector('#qText'), opts: body.querySelector('#qOptions'),
    prev: body.querySelector('#qPrev'), next: body.querySelector('#qNext')
  };
  function paint() {
    const q = QUESTIONS[state.i];
    els.cat.textContent = `${q.category === 'technical' ? 'Technical' : 'Soft Skill'} · ${q.skill}`;
    els.count.textContent = `Question ${state.i + 1} of ${QUESTIONS.length}`;
    els.bar.style.width = `${((state.i + 1) / QUESTIONS.length) * 100}%`;
    els.text.textContent = q.q;
    els.opts.innerHTML = q.options.map((o, j) => `
      <div class="q-option ${state.answers[state.i] === o.s ? 'selected' : ''}" data-j="${j}">
        <span class="q-key">${'ABCD'[j]}</span><span>${escapeHTML(o.t)}</span></div>`).join('');
    els.prev.disabled = state.i === 0;
    els.next.textContent = state.i === QUESTIONS.length - 1 ? 'Submit ✓' : 'Next →';
    els.next.classList.toggle('btn-primary', true);
  }
  els.opts.addEventListener('click', e => {
    const card = e.target.closest('.q-option'); if (!card) return;
    state.answers[state.i] = QUESTIONS[state.i].options[+card.dataset.j].s;
    paint();
  });
  els.prev.addEventListener('click', () => { if (state.i > 0) { state.i--; paint(); } });
  els.next.addEventListener('click', async () => {
    if (state.answers[state.i] == null) return toast('Please select an answer first.', 'info');
    if (state.i < QUESTIONS.length - 1) { state.i++; paint(); return; }
    const unanswered = state.answers.filter(a => a == null).length;
    if (unanswered) return toast(`${unanswered} question(s) unanswered. Use Previous to complete them.`, 'info');
    els.next.disabled = true;
    btnLoading(els.next, true, 'Calculating results…');
    try {
      const { scores, technicalScore, softScore, overall } = computeScores(state.answers);
      await saveSkillAssessment({ studentId: uid, scores, technicalScore, softScore, overall });
      SP = { ...SP, skillScores: scores, skillScore: overall, technicalScore, softScore };
      toast(`Assessment complete! Your skill score: ${overall}%`);
      content.querySelectorAll('.tab-btn')[1].click();
    } catch (err) { toast(err.message, 'error'); btnLoading(els.next, false); }
  });
  paint();
}

async function renderSkillProfile(body) {
  const assessment = await getLatestAssessment(uid);
  if (!assessment) {
    body.innerHTML = `<div class="card">${emptyState({ ico: 'target', title: 'No skill assessment completed', text: 'Take the quick assessment to generate your skill profile, strengths and personalized gap analysis.', actionLabel: 'Start assessment now', actionId: 'goAssess' })}</div>`;
    body.querySelector('#goAssess')?.addEventListener('click', () => content.querySelectorAll('.tab-btn')[0].click());
    return;
  }
  const scores = assessment.scores || {};
  const gaps = TARGET_SKILL_LEVELS
    .map(t => ({ ...t, current: scores[t.skill] ?? 0 }))
    .filter(t => t.current < t.required)
    .map(t => ({ ...t, gap: t.required - t.current }))
    .sort((a, b) => b.gap - a.gap);
  const strengths = TARGET_SKILL_LEVELS.filter(t => (scores[t.skill] ?? 0) >= t.required);

  body.innerHTML = `
    <div class="stat-grid">
      ${statCard({ ico: 'target', color: 'indigo', value: assessment.overall + '%', label: 'Overall Score' })}
      ${statCard({ ico: 'chart', color: 'teal', value: assessment.technicalScore + '%', label: 'Technical Skills' })}
      ${statCard({ ico: 'users', color: 'purple', value: assessment.softScore + '%', label: 'Soft Skills' })}
      ${statCard({ ico: 'star', color: 'green', value: strengths.length, label: 'Strengths' })}
    </div>
    <div class="grid-2">
      <div class="card card-pad">
        <h3 class="card-title">Your skill profile</h3>
        ${Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([s, v]) =>
          progressRow(s, v, v >= 75 ? 'green' : v >= 50 ? '' : 'amber')).join('')}
      </div>
      <div>
        <div class="card card-pad" style="margin-bottom:20px">
          <h3 class="card-title">💪 Strengths</h3>
          ${strengths.length ? chipRow(strengths.map(s => s.skill)) : '<p class="text-muted" style="font-size:13.5px">Keep learning — strengths appear as your scores improve.</p>'}
        </div>
        <div class="card card-pad">
          <h3 class="card-title">⚠️ Top focus areas</h3>
          ${gaps.length ? gaps.slice(0, 4).map(g => progressRow(g.skill, g.current, 'amber')).join('')
            : '<p class="text-muted" style="font-size:13.5px">Amazing — no major gaps detected! 🎉</p>'}
        </div>
      </div>
    </div>
    <div class="card mt-2">
      <div class="card-pad" style="padding-bottom:6px"><h3 class="card-title" style="margin:0">Skill Gap Analysis</h3>
        <p class="text-muted" style="font-size:13px">Current level vs. industry-required level. Close the gap with recommended programs.</p></div>
      <div class="table-wrap" style="border:none">
        <table><thead><tr><th>Skill</th><th>Current</th><th>Required</th><th>Gap</th><th>Recommended learning</th></tr></thead>
        <tbody>${gaps.map(g => `<tr>
          <td><strong>${escapeHTML(g.skill)}</strong></td>
          <td style="min-width:130px">${progressRow('', g.current)}</td>
          <td>${g.required}%</td>
          <td><span class="badge badge-amber">-${g.gap}%</span></td>
          <td><a class="btn btn-soft btn-sm" href="learning.html?skill=${encodeURIComponent(g.skill)}">${icon('book', 14)} Browse programs</a></td>
        </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-2)">No skill gaps — you meet all target levels! 🎉</td></tr>'}</tbody></table>
      </div>
    </div>`;
}

/* ==================== Live external listings (real IT jobs, no partner sign-up needed) ==================== */
async function renderExternalListings(kind) {
  const box = content.querySelector('#extSection');
  if (!box) return;
  const isInt = kind === 'internship';
  const sourceLabel = isInt ? 'Simplify / Pitt CSC internship tracker' : 'Arbeitnow job board';
  box.innerHTML = `<h3 class="card-title">Live ${isInt ? 'internship' : 'IT job'} openings from the web
      <span class="badge badge-blue" style="margin-left:6px;font-weight:600">Live feed</span></h3>
    <p class="text-muted" style="font-size:13px;margin-bottom:12px">Real, currently-open ${isInt ? 'internships' : 'jobs'} pulled from the public ${escapeHTML(sourceLabel)} — not posted by a partner on this platform. Applying takes you to the original listing.${isInt ? ' Skews toward US/Canada/UK roles, many offering remote work.' : ''}</p>
    <div class="opp-grid">${skeletonBlocks(3)}</div>`;
  const grid = box.querySelector('.opp-grid');
  const rows = await fetchExternalITJobs({ max: 9, kind });
  if (!rows.length) {
    grid.innerHTML = `<p class="text-muted" style="font-size:13.5px">Could not load live listings right now — check your internet connection, or try again shortly.</p>`;
    return;
  }
  grid.innerHTML = rows.map(o => `<div class="opp-card">
      <div class="opp-head">
        <span class="opp-logo">${escapeHTML((o.companyName || 'C')[0])}</span>
        <div style="flex:1;min-width:0">
          <div class="opp-title">${escapeHTML(o.title)}</div>
          <div class="opp-company">${escapeHTML(o.companyName)}</div>
        </div>
      </div>
      <div class="opp-meta">
        <span>${icon('pin', 14)}${escapeHTML(o.location)}</span>
        <span>${icon('briefcase', 14)}${escapeHTML(o.employmentType)}</span>
      </div>
      <div class="opp-skills">${(o.skills || []).map(s => `<span class="chip chip-gray">${escapeHTML(s)}</span>`).join('') || '<span class="text-muted" style="font-size:13px">—</span>'}</div>
      <div class="opp-foot"><span class="badge badge-blue">${escapeHTML(o.sourceName || 'External')}</span>
        <span class="text-muted" style="font-size:12px">${o.postedAt ? timeAgo(o.postedAt) : ''}</span></div>
      <a class="btn btn-outline btn-sm btn-block" href="${escapeHTML(o.applyUrl)}" target="_blank" rel="noopener">${icon('link', 14)} View & apply on source site</a>
    </div>`).join('');
}

/* ==================== OPPORTUNITIES (Internships + Jobs) ==================== */
async function renderOpportunities(kind) {
  const isInt = kind === 'internship';
  content.innerHTML = pageHeader(isInt ? 'Internships' : 'Jobs & Placements', isInt ? 'Skill-matched internships from partner companies' : 'Full-time roles matched to your skill profile') + `
    <div class="filter-bar no-print">
      <span class="search-wrap">${icon('search', 16)}<input class="input" id="fSearch" placeholder="Search title, company, skill…"></span>
      <input class="input" id="fSkill" placeholder="Filter by skill" value="${escapeHTML(params.get('skill') || '')}">
      <select class="select" id="fLoc"><option value="">All locations</option></select>
      ${isInt ? `<select class="select" id="fDur"><option value="">Any duration</option></select>` : `<select class="select" id="fType"><option value="">Any type</option><option>Full-time</option><option>Internship</option><option>Part-time</option><option>Contract</option></select>`}
      <select class="select" id="fSort"><option value="match">Sort: Best match</option><option value="new">Newest</option><option value="deadline">Deadline</option></select>
    </div>
    <div id="oppList">${skeletonBlocks(6)}</div>
    <div id="extSection" style="margin-top:28px"></div>`;

  renderExternalListings(kind);

  let opps = [];
  try { opps = isInt ? await getInternships() : await getJobs(); }
  catch (err) { content.querySelector('#oppList').innerHTML = emptyState({ ico: 'bell', title: 'Could not load', text: err.message }); return; }

  if (!opps.length) {
    content.querySelector('#oppList').innerHTML = emptyState({
      ico: 'briefcase', title: isInt ? 'No internships found' : 'No jobs found',
      text: 'Opportunities published by partner industries will appear here. Load a sample dataset to explore the platform instantly.',
      actionLabel: 'Load sample opportunities', actionId: 'loadDemo'
    });
    content.querySelector('#loadDemo')?.addEventListener('click', async e => {
    const btn = e.currentTarget;
      btnLoading(btn, true, 'Preparing demo data…');
      try { await ensureDemoOpportunities(); toast('Sample opportunities loaded!'); renderOpportunities(kind); }
      catch (err) { toast(err.message, 'error'); btnLoading(btn, false); }
    });
    return;
  }

  // populate selects
  const locSel = content.querySelector('#fLoc');
  [...new Set(opps.map(o => o.location).filter(Boolean))].forEach(l =>
    locSel.insertAdjacentHTML('beforeend', `<option>${escapeHTML(l)}</option>`));
  if (isInt) {
    const dSel = content.querySelector('#fDur');
    [...new Set(opps.map(o => o.duration).filter(Boolean))].forEach(d =>
      dSel.insertAdjacentHTML('beforeend', `<option>${escapeHTML(d)}</option>`));
  }

  const [apps, myApps] = [SP, await getStudentApplications(uid)];
  const appliedIds = new Set(myApps.map(a => a.opportunityId));
  const saved = () => new Set(isInt ? (SP.savedInternships || []) : (SP.savedJobs || []));

  const cardHTML = (o, m) => {
    const dl = daysUntil(o.deadline);
    const closed = isClosed(o);
    return `<div class="opp-card">
      <div class="opp-head">
        <span class="opp-logo">${o.companyLogo ? `<img src="${escapeHTML(o.companyLogo)}" alt="" referrerpolicy="no-referrer">` : escapeHTML((o.companyName || 'C')[0])}</span>
        <div style="flex:1;min-width:0">
          <div class="opp-title">${escapeHTML(o.title)}</div>
          <div class="opp-company">${escapeHTML(o.companyName)}</div>
        </div>
        <button class="icon-btn bm-btn" data-id="${o.id}" title="Save" style="color:${saved().has(o.id) ? 'var(--primary)' : 'var(--border-strong)'}">${icon('bookmark', 18)}</button>
      </div>
      <div class="opp-meta">
        <span>${icon('pin', 14)}${escapeHTML(o.location || '—')}</span>
        ${isInt ? `<span>${icon('clock', 14)}${escapeHTML(o.duration || '—')}</span><span>${icon('coins', 14)}${escapeHTML(o.stipend || 'Unpaid')}</span>`
          : `<span>${icon('briefcase', 14)}${escapeHTML(o.employmentType || 'Full-time')}</span><span>${icon('coins', 14)}${escapeHTML(o.salary || '—')}</span>`}
      </div>
      <div class="opp-skills">${(o.skills || []).slice(0, 4).map(s => `<span class="chip chip-gray">${escapeHTML(s)}</span>`).join('')}
        ${(o.skills || []).length > 4 ? `<span class="chip chip-gray">+${o.skills.length - 4}</span>` : ''}</div>
      <div class="opp-foot">
        ${matchBadge(m)}
        <span class="text-muted" style="font-size:12px ${dl <= 7 && !closed ? 'color:var(--danger);font-weight:600' : ''}">
          ${closed ? '⚠ Closed' : `Deadline: ${o.deadline || '—'}`}</span>
      </div>
      <div class="flex" style="gap:8px">
        <button class="btn btn-outline btn-sm" style="flex:1" data-details="${o.id}">Details</button>
        ${appliedIds.has(o.id)
          ? `<button class="btn btn-soft btn-sm" style="flex:1" disabled>✓ Applied</button>`
          : `<button class="btn btn-primary btn-sm" style="flex:1" data-apply="${o.id}" ${closed ? 'disabled' : ''}>Apply now</button>`}
      </div>
    </div>`;
  };

  function renderList() {
    const q = content.querySelector('#fSearch').value.toLowerCase();
    const skill = content.querySelector('#fSkill').value.toLowerCase();
    const loc = locSel.value, sort = content.querySelector('#fSort').value;
    const extraSel = content.querySelector(isInt ? '#fDur' : '#fType');
    const extra = extraSel.value;

    let rows = opps.filter(o => {
      const hay = `${o.title} ${o.companyName} ${(o.skills || []).join(' ')}`.toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (skill && !(o.skills || []).some(s => s.toLowerCase().includes(skill))) return false;
      if (loc && o.location !== loc) return false;
      if (extra && (isInt ? o.duration !== extra : o.employmentType !== extra)) return false;
      return true;
    }).map(o => ({ o, m: matchPercent(SP.technicalSkills || [], o.skills) }));

    rows.sort((a, b) => sort === 'match' ? b.m - a.m : sort === 'deadline'
      ? new Date(a.o.deadline || 0) - new Date(b.o.deadline || 0)
      : (b.o.createdAt?.seconds || 0) - (a.o.createdAt?.seconds || 0));

    content.querySelector('#oppList').innerHTML = rows.length
      ? `<div class="opp-grid">${rows.map(({ o, m }) => cardHTML(o, m)).join('')}</div>
         <p class="text-muted mt-2" style="font-size:13px">${rows.length} opportunit${rows.length === 1 ? 'y' : 'ies'} found</p>`
      : emptyState({ ico: 'search', title: 'No opportunities match your filters', text: 'Try removing some filters or searching with different keywords.' });

    bindCardEvents(rows.map(r => r.o));
  }

  function bindCardEvents(rows) {
    const byId = id => rows.find(o => o.id === id);
    content.querySelectorAll('[data-details]').forEach(b => b.addEventListener('click', () => openDetails(byId(b.dataset.details))));
    content.querySelectorAll('[data-apply]').forEach(b => b.addEventListener('click', () => openApply(byId(b.dataset.apply))));
    content.querySelectorAll('.bm-btn').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.id, key = isInt ? 'savedInternships' : 'savedJobs';
      const list = new Set(SP[key] || []);
      list.has(id) ? list.delete(id) : list.add(id);
      try {
        await setDocument('students', uid, { [key]: [...list] }, { timestamps: false });
        SP[key] = [...list];
        b.style.color = list.has(id) ? 'var(--primary)' : 'var(--border-strong)';
        toast(list.has(id) ? 'Saved to bookmarks' : 'Removed from bookmarks');
      } catch (err) { toast(err.message, 'error'); }
    }));
  }

  function openDetails(o) {
    const m = matchPercent(SP.technicalSkills || [], o.skills);
    const { el, close } = openModal({
      title: o.title, size: 'modal-lg',
      body: `<div class="flex" style="gap:12px;margin-bottom:16px">
          <span class="opp-logo">${o.companyLogo ? `<img src="${escapeHTML(o.companyLogo)}" referrerpolicy="no-referrer">` : escapeHTML((o.companyName || 'C')[0])}</span>
          <div><strong>${escapeHTML(o.companyName)}</strong><div class="text-muted" style="font-size:13px">${escapeHTML(o.location || '')}</div></div>
          <div style="margin-left:auto">${matchBadge(m)}</div></div>
        <div class="opp-meta" style="margin-bottom:14px">
          ${isInt ? `<span>${icon('clock', 14)} ${escapeHTML(o.duration || '—')}</span><span>${icon('coins', 14)} ${escapeHTML(o.stipend || 'Unpaid')}</span><span>${icon('users', 14)} ${o.positions || '—'} positions</span>`
            : `<span>${icon('briefcase', 14)} ${escapeHTML(o.employmentType || '—')}</span><span>${icon('coins', 14)} ${escapeHTML(o.salary || '—')}</span><span>${icon('chart', 14)} ${escapeHTML(o.experience || '0-1 yrs')}</span>`}
          <span>${icon('calendar', 14)} Apply by ${escapeHTML(o.deadline || '—')}</span>
          <span>${icon('grad', 14)} ${escapeHTML(o.qualification || 'Any degree')}</span></div>
        <p style="font-size:14px;color:var(--text-2);white-space:pre-line">${escapeHTML(o.description || '')}</p>
        <h4 class="mt-2" style="font-size:14px;margin-bottom:6px">Required skills</h4>
        <div class="opp-skills">${(o.skills || []).map(s => `<span class="chip">${escapeHTML(s)}</span>`).join('')}</div>`,
      footer: `<button class="btn btn-outline" data-x>Close</button>
        <button class="btn btn-primary" data-apply="${o.id}" ${isClosed(o) ? 'disabled' : ''}>${isClosed(o) ? 'Closed' : 'Apply now'}</button>`
    });
    el.querySelector('[data-x]').onclick = close;
    el.querySelector('[data-apply]')?.addEventListener('click', () => { close(); openApply(o); });
  }

  function openApply(o) {
    if (!SP.college) {
      toast('Please complete your profile (college, degree) before applying.', 'info');
      setTimeout(() => location.href = 'profile.html', 1200);
      return;
    }
    const { el, close } = openModal({
      title: 'Confirm application',
      body: `<p style="font-size:14px;margin-bottom:12px">Apply for <strong>${escapeHTML(o.title)}</strong> at <strong>${escapeHTML(o.companyName)}</strong>?</p>
        <div class="alert alert-info" style="margin:0">${icon('file', 16)}<span>
          ${SP.resumeUrl ? 'Your uploaded resume will be shared with the recruiter.' : '⚠ You haven\'t uploaded a resume yet — upload one from <a href="portfolio.html">My Portfolio</a> for better chances.'}
        </span></div>`,
      footer: `<button class="btn btn-outline" data-x>Cancel</button><button class="btn btn-primary" data-go>Submit application</button>`
    });
    el.querySelector('[data-x]').onclick = close;
    el.querySelector('[data-go]').addEventListener('click', async ev => {
    const btn = ev.currentTarget;
      btnLoading(btn, true, 'Submitting…');
      try {
        await applyForOpportunity({ student: SP, opp: o, type: kind, resumeUrl: SP.resumeUrl || '' });
        appliedIds.add(o.id); close();
        toast('Application submitted successfully! 🎉');
        renderList();
      } catch (err) { toast(err.message, 'error'); btnLoading(btn, false); }
    });
  }

  const deb = debounce(renderList, 200);
  content.querySelector('#fSearch').addEventListener('input', deb);
  content.querySelector('#fSkill').addEventListener('input', deb);
  locSel.addEventListener('change', renderList);
  content.querySelector('#fSort').addEventListener('change', renderList);
  content.querySelector(isInt ? '#fDur' : '#fType').addEventListener('change', renderList);
  renderList();
}

/* ==================== APPLICATIONS ==================== */
async function renderApplications() {
  content.innerHTML = pageHeader('My Applications', 'Track every application in one place') +
    `<div class="filter-bar no-print">
      <select class="select" id="aType"><option value="">All types</option><option value="internship">Internships</option><option value="job">Jobs</option></select>
      <select class="select" id="aStatus"><option value="">All statuses</option>${['Applied', 'Under Review', 'Shortlisted', 'Interview', 'Selected', 'Rejected', 'Completed'].map(s => `<option>${s}</option>`).join('')}</select>
    </div><div id="appList">${'<div class="sk" style="height:60px;margin-bottom:10px"></div>'.repeat(4)}</div>`;

  const apps = await getStudentApplications(uid);
  const FLOW = ['Applied', 'Under Review', 'Shortlisted', 'Interview', 'Selected', 'Completed'];

  function render() {
    const t = content.querySelector('#aType').value, s = content.querySelector('#aStatus').value;
    const rows = apps.filter(a => (!t || a.type === t) && (!s || a.status === s));
    content.querySelector('#appList').innerHTML = rows.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Opportunity</th><th>Company</th><th>Type</th><th>Match</th><th>Applied</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows.map(a => `<tr>
          <td><strong>${escapeHTML(a.opportunityTitle)}</strong></td>
          <td>${escapeHTML(a.companyName)}</td>
          <td><span class="badge ${a.type === 'job' ? 'badge-blue' : 'badge-teal'}">${a.type === 'job' ? 'Job' : 'Internship'}</span></td>
          <td>${matchBadge(a.matchPercent ?? 0)}</td>
          <td>${formatDate(a.createdAt)}</td>
          <td>${statusBadge(a.status)}</td>
          <td class="no-print" style="white-space:nowrap">
            <button class="icon-btn" title="Details" data-view="${a.id}">${icon('eye', 17)}</button>
            ${a.status === 'Applied' ? `<button class="icon-btn" title="Withdraw" data-wd="${a.id}" style="color:var(--danger)">${icon('trash', 17)}</button>` : ''}
          </td></tr>`).join('')}</tbody></table></div>`
      : emptyState({ ico: 'file', title: 'No applications yet', text: 'Browse skill-matched internships and jobs and start applying — your applications will be tracked here.', actionLabel: 'Browse internships', actionId: 'goBrowse' });
    content.querySelector('#goBrowse')?.addEventListener('click', () => location.href = 'internships.html');
    content.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
      const a = apps.find(x => x.id === b.dataset.view);
      const idx = a.status === 'Rejected' ? -1 : FLOW.indexOf(a.status);
      openModal({
        title: a.opportunityTitle,
        body: `<p class="text-muted" style="margin-bottom:16px">${escapeHTML(a.companyName)} · Applied ${formatDate(a.createdAt)} · ${matchBadge(a.matchPercent ?? 0)}</p>
          <div class="timeline">${FLOW.map((st, i) => `
            <div class="tl-step ${a.status === 'Rejected' ? '' : i < idx ? 'done' : i === idx ? (['Selected', 'Completed'].includes(a.status) ? 'done' : 'current') : ''}">
              <span class="tl-dot">${i <= idx ? icon('check', 13) : ''}</span>
              <div><div class="tl-title">${st}</div></div></div>`).join('')}
            ${a.status === 'Rejected' ? `<div class="tl-step rejected"><span class="tl-dot">${icon('x', 13)}</span><div><div class="tl-title">Rejected</div></div></div>` : ''}</div>`,
        footer: `<button class="btn btn-outline" data-x>Close</button>`
      }).el.querySelector('[data-x]').onclick = function () { this.closest('.modal-overlay').parentElement.innerHTML = ''; };
    }));
    content.querySelectorAll('[data-wd]').forEach(b => b.addEventListener('click', async () => {
      if (!await confirmDialog('Withdraw this application? This cannot be undone.', { okText: 'Withdraw' })) return;
      try { await withdrawApplication(b.dataset.wd); toast('Application withdrawn'); renderApplications(); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }
  content.querySelector('#aType').addEventListener('change', render);
  content.querySelector('#aStatus').addEventListener('change', render);
  render();
}

/* ==================== LEARNING ==================== */
async function renderLearning() {
  const tab = params.get('tab') === 'my' ? 'my' : 'browse';
  const TYPES = [['', 'All'], ['training', 'Training'], ['certification', 'Certification'], ['workshop', 'Workshops'], ['mentorship', 'Mentorship'], ['project', 'Live Projects']];
  const TYPE_BADGE = { training: 'badge-indigo', certification: 'badge-purple', workshop: 'badge-blue', mentorship: 'badge-teal', project: 'badge-amber' };
  const skillFilter = params.get('skill') || '';

  content.innerHTML = pageHeader('Learning Programs', 'Industry training, certifications, workshops and mentorship') + `
    <div class="tabs no-print">
      <button class="tab-btn" data-t="browse">Browse programs</button>
      <button class="tab-btn" data-t="my">My Learning</button>
    </div>
    <div class="filter-bar no-print" id="lpFilters">
      ${TYPES.map(([v, l]) => `<button class="tab-btn" data-type="${v}" style="background:var(--bg);color:var(--text-2)">${l}</button>`).join('')}
    </div>
    <div id="lpBody">${skeletonBlocks(6)}</div>`;

  const body = content.querySelector('#lpBody');
  let programs = [], enrollments = [], type = '', activeTab = tab;

  content.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', async () => {
    content.querySelectorAll('[data-t]').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); activeTab = b.dataset.t;
    history.replaceState(null, '', `learning.html${activeTab === 'my' ? '?tab=my' : ''}`);
    activeTab === 'my' ? renderMine() : renderBrowse();
  }));
  content.querySelectorAll('[data-type]').forEach(b => b.addEventListener('click', () => {
    content.querySelectorAll('[data-type]').forEach(x => { x.classList.remove('active'); x.style.background = 'var(--bg)'; x.style.color = 'var(--text-2)'; });
    b.classList.add('active'); b.style.background = 'var(--primary)'; b.style.color = '#fff';
    type = b.dataset.type; renderBrowse();
  }));

  try { [programs, enrollments] = await Promise.all([getLearningPrograms(), getStudentEnrollments(uid)]); }
  catch (err) { body.innerHTML = emptyState({ ico: 'bell', title: 'Could not load programs', text: err.message }); return; }

  if (!programs.length) {
    body.innerHTML = emptyState({ ico: 'book', title: 'No learning programs yet', text: 'Programs published by industries will appear here. Load a sample dataset to explore.', actionLabel: 'Load sample programs', actionId: 'loadDemo' });
    body.querySelector('#loadDemo')?.addEventListener('click', async e => {
    const btn = e.currentTarget;
      btnLoading(btn, true, 'Loading…');
      try { await ensureDemoOpportunities(); toast('Sample programs loaded!'); renderLearning(); }
      catch (err) { toast(err.message, 'error'); btnLoading(btn, false); }
    });
    return;
  }

  function renderBrowse() {
    content.querySelector('#lpFilters').classList.remove('hidden');
    const skillQ = skillFilter.toLowerCase();
    const rows = programs.filter(p =>
      (!type || p.type === type) &&
      (!skillQ || (p.skills || []).some(s => s.toLowerCase().includes(skillQ))));
    body.innerHTML = skillFilter ? `<div class="alert alert-info">${icon('target', 16)}<span>Showing programs recommended for <strong>${escapeHTML(skillFilter)}</strong> — <a href="learning.html">clear filter</a></span></div>` : '';
    if (!rows.length) return void (body.innerHTML += emptyState({ ico: 'search', title: 'No programs found', text: 'Try a different category or clear the skill filter.' }));
    body.insertAdjacentHTML('beforeend', `<div class="opp-grid">${rows.map(p => {
      const enr = enrollments.find(x => x.programId === p.id);
      return `<div class="opp-card">
        <div class="flex-between"><span class="badge ${TYPE_BADGE[p.type] || 'badge-gray'}">${escapeHTML(p.type || 'program')}</span>
          <span style="font-weight:800;color:var(--success);font-size:13.5px">${escapeHTML(p.fee || 'Free')}</span></div>
        <div><div class="opp-title">${escapeHTML(p.title)}</div><div class="opp-company">${escapeHTML(p.companyName)}</div></div>
        <p class="text-muted" style="font-size:13px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escapeHTML(p.description || '')}</p>
        <div class="opp-meta"><span>${icon('clock', 14)}${escapeHTML(p.duration || '—')}</span><span>${icon('globe', 14)}${escapeHTML(p.mode || 'Online')}</span></div>
        <div class="opp-skills">${(p.skills || []).slice(0, 3).map(s => `<span class="chip chip-gray">${escapeHTML(s)}</span>`).join('')}</div>
        <div class="opp-foot" style="border:none;padding:0">
          ${enr ? `<button class="btn btn-soft btn-sm btn-block" disabled>✓ Enrolled · ${enr.progress}%</button>`
            : `<button class="btn btn-primary btn-sm btn-block" data-enroll="${p.id}">Enroll now</button>`}
        </div></div>`;
    }).join('')}</div>`);
    body.querySelectorAll('[data-enroll]').forEach(b => b.addEventListener('click', async () => {
      btnLoading(b, true, 'Enrolling…');
      try {
        const p = programs.find(x => x.id === b.dataset.enroll);
        await enrollInProgram(SP, p);
        enrollments = await getStudentEnrollments(uid);
        toast(`Enrolled in "${p.title}"! Find it under My Learning.`);
        renderBrowse();
      } catch (err) { toast(err.message, 'error'); btnLoading(b, false); }
    }));
  }

  function renderMine() {
    content.querySelector('#lpFilters').classList.add('hidden');
    if (!enrollments.length) {
      body.innerHTML = emptyState({ ico: 'book', title: 'No enrollments yet', text: 'Browse programs and enroll to start building job-ready skills.', actionLabel: 'Browse programs', actionId: 'goBrowse2' });
      body.querySelector('#goBrowse2').addEventListener('click', () => content.querySelectorAll('[data-t]')[0].click());
      return;
    }
    body.innerHTML = `<div class="card"><div class="card-pad">
      ${enrollments.map(e => `<div class="list-item" style="align-items:flex-start;flex-wrap:wrap">
        <span class="stat-icon" style="background:var(--primary-light);color:var(--primary)">${icon('book', 18)}</span>
        <div style="flex:1;min-width:220px">
          <div class="li-title">${escapeHTML(e.programTitle)} ${statusBadge(e.status)}</div>
          <div class="li-sub">${escapeHTML(e.companyName)} · ${escapeHTML(e.duration || 'Self-paced')}</div>
          <div class="mt-1">${progressRow('Progress', e.progress || 0, e.progress >= 100 ? 'green' : '')}</div></div>
        ${e.progress < 100 ? `<button class="btn btn-outline btn-sm" data-prog="${e.id}" data-cur="${e.progress || 0}">+25% progress</button>` : ''}
      </div>`).join('')}</div></div>`;
    body.querySelectorAll('[data-prog]').forEach(b => b.addEventListener('click', async () => {
      const np = Math.min(+b.dataset.cur + 25, 100);
      try { await updateEnrollmentProgress(b.dataset.prog, np); toast(np >= 100 ? 'Program completed! 🎉' : `Progress updated to ${np}%`); renderMine(); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }

  content.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('active', x.dataset.t === activeTab));
  // default-active category chip
  const firstChip = content.querySelector('[data-type=""]');
  firstChip?.classList.add('active'); if (firstChip) { firstChip.style.background = 'var(--primary)'; firstChip.style.color = '#fff'; }
  activeTab === 'my' ? renderMine() : renderBrowse();
}

/* ==================== PORTFOLIO ==================== */
async function renderPortfolio() {
  const tab = params.get('tab') || 'overview';
  let PF = (await getPortfolio(uid)) || {};
  PF.projects = PF.projects || []; PF.certifications = PF.certifications || []; PF.achievements = PF.achievements || [];
  const apps = await getStudentApplications(uid);
  const completed = apps.filter(a => ['Selected', 'Completed'].includes(a.status));

  const TABS = [['overview', 'Overview'], ['projects', 'Projects'], ['certifications', 'Certifications'], ['achievements', 'Achievements']];
  content.innerHTML = `
    <div class="portfolio-hero">
      ${avatarHTML(SP.name, SP.profileImage, 'avatar avatar-xl')}
      <div style="flex:1;min-width:240px">
        <h2 style="font-size:24px">${escapeHTML(SP.name || 'Your Name')}</h2>
        <p style="opacity:.9;font-size:14px">${escapeHTML([SP.degree, SP.branch, SP.college].filter(Boolean).join(' · ') || 'Complete your profile to build your portfolio')}</p>
        <div class="ph-meta">
          <span>✉ ${escapeHTML(SP.email || ctx.profile.email)}</span>
          ${SP.phone ? `<span>☎ ${escapeHTML(SP.phone)}</span>` : ''}${SP.location ? `<span>📍 ${escapeHTML(SP.location)}</span>` : ''}
          ${SP.graduationYear ? `<span>🎓 Class of ${escapeHTML(SP.graduationYear)}</span>` : ''}
        </div>
        <div class="ph-meta">${chipRow(SP.technicalSkills || []).slice(0, 400)}</div>
      </div>
    </div>
    <div class="flex-between mt-2 no-print" style="margin-bottom:18px">
      <div class="tabs" style="margin:0">${TABS.map(([v, l]) => `<button class="tab-btn" data-pt="${v}">${l}</button>`).join('')}</div>
      <div class="flex">
        <button class="btn btn-outline btn-sm" id="pfPrint">${icon('download', 15)} Print / PDF</button>
      </div>
    </div>
    <div id="pfBody"></div>`;

  content.querySelectorAll('[data-pt]').forEach(b => b.addEventListener('click', () => {
    content.querySelectorAll('[data-pt]').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); history.replaceState(null, '', `portfolio.html?tab=${b.dataset.pt}`);
    paint(b.dataset.pt);
  }));

  const body = content.querySelector('#pfBody');
  content.querySelector('#pfPrint').addEventListener('click', () => window.print());

  function paint(t) {
    if (t === 'overview') {
      const uploadInput = `<input type="file" id="resUp" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" class="hidden">`;
      const resumeSection = SP.resumeUrl
        ? `<div class="alert alert-success" style="margin-bottom:12px">${icon('check', 15)}<span>Uploaded${SP.resumeFileName ? ': ' + escapeHTML(SP.resumeFileName) : ''}${SP.resumeUpdatedAt ? ' · ' + timeAgo(SP.resumeUpdatedAt) : ''}</span></div>
           <div class="flex" style="gap:8px;flex-wrap:wrap">
             <a class="btn btn-soft btn-sm" href="${escapeHTML(SP.resumeUrl)}" target="_blank" rel="noopener">${icon('eye', 14)} View</a>
             <label class="btn btn-outline btn-sm" style="cursor:pointer">${icon('upload', 14)} Replace ${uploadInput}</label>
             <button class="btn btn-outline btn-sm" id="resRemove" style="color:var(--danger)">${icon('trash', 14)} Remove</button>
           </div>`
        : `<label class="btn btn-outline btn-sm" style="cursor:pointer">${icon('upload', 14)} Upload resume (PDF/DOCX) ${uploadInput}</label>`;
      body.innerHTML = `
        <div class="grid-2">
          <div class="card card-pad"><h3 class="card-title">About</h3>
            <p style="font-size:14px;color:var(--text-2);white-space:pre-line">${escapeHTML(SP.about || 'Add an "About me" in your profile to introduce yourself.')}</p></div>
          <div class="card card-pad"><h3 class="card-title">Resume</h3>
            <p class="text-muted" style="font-size:13px;margin-bottom:10px">${SP.resumeUrl ? 'Your resume is attached to every application.' : 'Upload your resume as a PDF or Word document — the file is stored securely and shared when you apply.'}</p>${resumeSection}</div>
        </div>
        <div class="grid-2 mt-2">
          <div class="card card-pad"><h3 class="card-title">Technical skills</h3><div>${chipRow(SP.technicalSkills || [])}</div>
            <h3 class="card-title mt-2">Soft skills</h3><div>${chipRow(SP.softSkills || [], 'chip-gray')}</div>
            <h3 class="card-title mt-2">Languages</h3><div>${chipRow(SP.languages || [], 'chip-gray')}</div></div>
          <div class="card card-pad"><h3 class="card-title">Experience &amp; education</h3>
            <div class="list-item"><span class="stat-icon" style="background:var(--primary-light);color:var(--primary)">${icon('grad', 17)}</span>
              <div><div class="li-title">${escapeHTML([SP.degree, SP.branch].filter(Boolean).join(', ') || 'Degree')}</div>
              <div class="li-sub">${escapeHTML(SP.college || 'College')} ${SP.graduationYear ? '· ' + escapeHTML(SP.graduationYear) : ''}</div></div></div>
            ${completed.map(a => `<div class="list-item"><span class="stat-icon" style="background:var(--secondary-light);color:var(--secondary)">${icon('briefcase', 17)}</span>
              <div><div class="li-title">${escapeHTML(a.opportunityTitle)}</div><div class="li-sub">${escapeHTML(a.companyName)} · ${statusBadge(a.status)}</div></div></div>`).join('')
        || '<p class="text-muted" style="font-size:13.5px">Completed internships will appear here automatically.</p>'}</div>
        </div>
        <div class="stat-grid mt-2">
          ${statCard({ ico: 'layers', color: 'indigo', value: PF.projects.length, label: 'Projects' })}
          ${statCard({ ico: 'cert', color: 'purple', value: PF.certifications.length, label: 'Certifications' })}
          ${statCard({ ico: 'star', color: 'amber', value: PF.achievements.length, label: 'Achievements' })}
          ${statCard({ ico: 'target', color: 'green', value: (SP.skillScore ?? 0) + '%', label: 'Skill Score' })}
        </div>`;
      content.querySelector('#resUp')?.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const { uploadResumeFile } = await import('./storage.js');
          toast('Uploading resume…', 'info');
          const res = await uploadResumeFile(file, uid);
          const updates = { resumeUrl: res.url, resumePublicId: res.publicId, resumeFileName: res.name, resumeUpdatedAt: Date.now() };
          await saveStudentProfile(uid, updates);
          Object.assign(SP, updates);
          toast('Resume uploaded!'); renderPortfolio();
        } catch (err) { toast(err.message, 'error'); }
      });
      content.querySelector('#resRemove')?.addEventListener('click', async e => {
        const btn = e.currentTarget;
        const ok = await confirmDialog('This will remove your resume. You can upload a new one anytime.', { okText: 'Remove', title: 'Remove resume?' });
        if (!ok) return;
        btnLoading(btn, true, 'Removing…');
        try {
          const cleared = { resumeUrl: '', resumePublicId: '', resumeFileName: '', resumeUpdatedAt: null };
          await saveStudentProfile(uid, cleared);
          Object.assign(SP, cleared);
          toast('Resume removed.'); renderPortfolio();
        } catch (err) { toast(err.message, 'error'); btnLoading(btn, false); }
      });
    }

    if (t === 'projects' || t === 'certifications' || t === 'achievements') {
      const conf = {
        projects: { ico: 'layers', items: PF.projects, add: 'Add project', render: p => `<div class="opp-card">
            ${p.image ? `<img src="${escapeHTML(p.image)}" alt="" style="border-radius:10px;max-height:150px;object-fit:cover" referrerpolicy="no-referrer">` : ''}
            <div class="opp-title">${escapeHTML(p.title)}</div>
            <p class="text-muted" style="font-size:13px">${escapeHTML(p.description || '')}</p>
            <div class="opp-skills">${(p.tech || []).map(x => `<span class="chip chip-gray">${escapeHTML(x)}</span>`).join('')}</div>
            ${p.link ? `<a href="${escapeHTML(p.link)}" target="_blank" rel="noopener" style="font-size:13px;font-weight:600">${icon('link', 13)} Live link</a>` : ''}</div>` },
        certifications: { ico: 'cert', items: PF.certifications, add: 'Add certification', render: c => `<div class="opp-card">
            <div class="opp-title">${escapeHTML(c.title)}</div>
            <div class="opp-company">${escapeHTML(c.issuer || '')} ${c.date ? '· ' + escapeHTML(c.date) : ''}</div>
            ${c.fileUrl ? `<a href="${escapeHTML(c.fileUrl)}" target="_blank" rel="noopener" style="font-size:13px;font-weight:600">${icon('eye', 13)} View certificate</a>` : ''}</div>` },
        achievements: { ico: 'star', items: PF.achievements, add: 'Add achievement', render: a => `<div class="opp-card">
            <div class="opp-title">${escapeHTML(a.title)}</div>
            <p class="text-muted" style="font-size:13px">${escapeHTML(a.description || '')}</p>
            <div class="opp-company">${escapeHTML(a.date || '')}</div>
            ${a.fileUrl ? `<a href="${escapeHTML(a.fileUrl)}" target="_blank" rel="noopener" style="font-size:13px;font-weight:600">${icon('eye', 13)} View proof</a>` : ''}</div>` }
      }[t];

      body.innerHTML = `<div class="flex-between" style="margin-bottom:16px">
          <p class="text-muted" style="font-size:13.5px">${conf.items.length} item${conf.items.length === 1 ? '' : 's'}</p>
          <button class="btn btn-primary btn-sm no-print" id="pfAdd">${icon('plus', 15)} ${conf.add}</button></div>
        ${conf.items.length ? `<div class="opp-grid">${conf.items.map(conf.render).join('')}</div>`
          : emptyState({ ico: conf.ico, title: `No ${t} yet`, text: `Showcase your best work — items added here appear on your digital portfolio.`, actionLabel: conf.add, actionId: 'pfAddEmpty' })}`;

      const openAdd = () => openItemModal(t, conf);
      content.querySelector('#pfAdd')?.addEventListener('click', openAdd);
      content.querySelector('#pfAddEmpty')?.addEventListener('click', openAdd);
    }
  }

  function openItemModal(t, conf) {
    const fields = {
      projects: `<div class="form-group"><label>Project title *</label><input class="input" id="mTitle"></div>
        <div class="form-group"><label>Description</label><textarea class="textarea" id="mDesc" style="min-height:80px"></textarea></div>
        <div class="form-row"><div class="form-group"><label>Technologies (comma separated)</label><input class="input" id="mTech" placeholder="React, Node.js"></div>
        <div class="form-group"><label>Live link</label><input class="input" id="mLink" placeholder="https://"></div></div>
        <div class="form-group"><label>Project image (optional)</label><input type="file" class="input" id="mFile" accept="image/*"></div>`,
      certifications: `<div class="form-group"><label>Certification title *</label><input class="input" id="mTitle"></div>
        <div class="form-row"><div class="form-group"><label>Issuer</label><input class="input" id="mIssuer" placeholder="e.g. Google, AWS"></div>
        <div class="form-group"><label>Date</label><input class="input" id="mDate" type="date"></div></div>
        <div class="form-group"><label>Certificate image</label><input type="file" class="input" id="mFile" accept="image/*"></div>`,
      achievements: `<div class="form-group"><label>Achievement title *</label><input class="input" id="mTitle"></div>
        <div class="form-row"><div class="form-group"><label>Description</label><input class="input" id="mDesc"></div>
        <div class="form-group"><label>Date</label><input class="input" id="mDate" type="date"></div></div>
        <div class="form-group"><label>Proof document/image</label><input type="file" class="input" id="mFile" accept="image/*"></div>`
    }[t];

    const { el, close } = openModal({ title: conf.add, body: fields,
      footer: `<button class="btn btn-outline" data-x>Cancel</button><button class="btn btn-primary" data-save>Save</button>` });
    el.querySelector('[data-x]').onclick = close;
    el.querySelector('[data-save]').addEventListener('click', async ev => {
    const btn = ev.currentTarget;
      const title = el.querySelector('#mTitle').value.trim();
      if (!title) return toast('Title is required', 'error');
      btnLoading(btn, true, 'Saving…');
      try {
        let fileUrl = '';
        const file = el.querySelector('#mFile')?.files[0];
        if (file) {
          const { uploadImageToImgBB } = await import('./storage.js');
          toast('Uploading image…', 'info');
          fileUrl = (await uploadImageToImgBB(file)).url;
        }
        const item = { title, description: el.querySelector('#mDesc')?.value.trim() || '' };
        if (t === 'projects') { item.tech = el.querySelector('#mTech').value.split(',').map(s => s.trim()).filter(Boolean); item.link = el.querySelector('#mLink').value.trim(); item.image = fileUrl; }
        else { item.issuer = el.querySelector('#mIssuer')?.value.trim() || ''; item.date = el.querySelector('#mDate')?.value || ''; item.fileUrl = fileUrl; }
        PF[t === 'projects' ? 'projects' : t] = [...(PF[t === 'projects' ? 'projects' : t] || []), item];
        await savePortfolio(uid, { userId: uid, projects: PF.projects, certifications: PF.certifications, achievements: PF.achievements });
        toast('Added to portfolio!');
        close(); renderPortfolio();
      } catch (err) { toast(err.message, 'error'); btnLoading(btn, false); }
    });
  }

  content.querySelectorAll('[data-pt]').forEach(b => b.classList.toggle('active', b.dataset.pt === tab));
  paint(tab);
}
// Industry portal: company profile, posting internships/jobs/programs,
// applicant management, academy collaborations, analytics.
import {
  initDashboardShell, icon, toast, openModal, confirmDialog, btnLoading, emptyState,
  escapeHTML, formatDate, avatarHTML, chipRow, statusBadge, matchBadge, statCard, pageHeader,
  skeletonBlocks, tagInput, donutSVG, barChartSVG, barList, debounce,
  renderNotificationsPage, renderSettingsPage
} from './common.js';
import {
  getCompanyProfile, saveCompanyProfile, createInternship, createJob, createLearningProgram,
  getInternships, getJobs, getLearningPrograms, getCompanyApplications, updateApplicationStatus,
  createAcademyOpportunity, getAcademyOpportunities, getCompanyAcademyApplications,
  updateAcademyApplicationStatus, deleteDocument, notifyUser, getAllStudents, matchPercent,
  getIncomingCollabRequests, updateCollaborationRequest
} from './database.js';
import { setupImageUpload } from './storage.js';

const ctx = await initDashboardShell();
if (!ctx) throw new Error('unauthenticated');
const uid = ctx.user.uid;
const content = document.getElementById('pageContent');
let CP = (await getCompanyProfile(uid)) || { userId: uid, companyName: ctx.profile.name, email: ctx.profile.email };
const params = new URLSearchParams(location.search);
const STATUSES = ['Applied', 'Under Review', 'Shortlisted', 'Interview', 'Selected', 'Rejected', 'Completed'];
const AO_TYPES = { 'fdp': 'FDP Program', 'faculty-internship': 'Faculty Internship', 'training': 'Industrial Training', consultancy: 'Consultancy', research: 'Research Project', workshop: 'Workshop', 'guest-lecture': 'Guest Lecture', mentorship: 'Mentorship' };

const pages = {
  'industry-dashboard': renderDashboard,
  'industry-company-profile': renderCompanyProfile,
  'industry-post-internship': () => renderPostingForm('internship'),
  'industry-post-job': () => renderPostingForm('job'),
  'industry-training': renderTraining,
  'industry-applicants': renderApplicants,
  'industry-collaborations': renderCollaborations,
  'industry-analytics': renderAnalytics,
  'industry-notifications': () => renderNotificationsPage(content, uid),
  'industry-settings': () => renderSettingsPage(content, ctx.user)
};
await (pages[document.body.dataset.page] || renderDashboard)();

/* ==================== DASHBOARD ==================== */
async function renderDashboard() {
  content.innerHTML = pageHeader(CP.companyName || 'Your Company', 'Hiring & collaboration command center') + skeletonBlocks(3);
  const [internships, jobs, apps, academyApps] = await Promise.all([
    getInternships(), getJobs(), getCompanyApplications(uid), getCompanyAcademyApplications(uid)
  ]);
  const myInt = internships.filter(i => i.companyId === uid);
  const myJobs = jobs.filter(j => j.companyId === uid);
  const myOpps = apps; // applications to my postings
  const skillCount = {};
  [...myInt, ...myJobs].forEach(o => (o.skills || []).forEach(s => { skillCount[s] = (skillCount[s] || 0) + 1; }));
  const topSkills = Object.entries(skillCount).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([label, value]) => ({ label, value }));

  content.innerHTML = pageHeader(CP.companyName || 'Your Company', 'Post opportunities, screen talent and collaborate with academia') + `
    ${!CP.industry ? `<div class="alert alert-info">${icon('building', 18)}<span>Complete your <a href="company-profile.html">company profile</a> to build trust with candidates.</span></div>` : ''}
    <div class="stat-grid">
      ${statCard({ ico: 'briefcase', color: 'indigo', value: myInt.length, label: 'Active Internships' })}
      ${statCard({ ico: 'building', color: 'teal', value: myJobs.length, label: 'Active Jobs' })}
      ${statCard({ ico: 'users', color: 'blue', value: myOpps.length, label: 'Total Applicants' })}
      ${statCard({ ico: 'star', color: 'green', value: myOpps.filter(a => a.status === 'Shortlisted').length, label: 'Shortlisted' })}
      ${statCard({ ico: 'check', color: 'amber', value: myOpps.filter(a => a.status === 'Selected').length, label: 'Selected' })}
      ${statCard({ ico: 'network', color: 'purple', value: academyApps.length, label: 'Academia Requests' })}
    </div>
    <div class="flex mt-2 no-print" style="margin-bottom:20px">
      <a class="btn btn-primary" href="post-internship.html">${icon('plus', 16)} Post Internship</a>
      <a class="btn btn-outline" href="post-job.html">${icon('plus', 16)} Post Job</a>
      <a class="btn btn-outline" href="training.html">${icon('book', 16)} Add Training</a>
      <a class="btn btn-outline" href="collaborations.html">${icon('network', 16)} Collaborate</a>
    </div>
    <div class="panel-grid">
      <div class="card card-pad">
        <h3 class="card-title">Recent applicants <a class="btn btn-ghost btn-sm" href="applicants.html">Manage all →</a></h3>
        ${myOpps.slice(0, 6).map(a => `<div class="list-item">
          ${avatarHTML(a.studentName, '', 'avatar avatar-sm')}
          <div style="flex:1;min-width:0"><div class="li-title">${escapeHTML(a.studentName)}</div>
          <div class="li-sub">${escapeHTML(a.opportunityTitle)}</div></div>${matchBadge(a.matchPercent ?? 0)}${statusBadge(a.status)}
        </div>`).join('') || '<p class="text-muted" style="font-size:13.5px">No applicants yet — post your first opportunity!</p>'}
      </div>
      <div class="card card-pad">
        <h3 class="card-title">Most requested skills</h3>
        ${topSkills.length ? barList(topSkills) : '<p class="text-muted" style="font-size:13.5px">Post opportunities to see skill demand.</p>'}
      </div>
    </div>`;
}

/* ==================== COMPANY PROFILE ==================== */
function renderCompanyProfile() {
  content.innerHTML = pageHeader('Company Profile', 'This is what candidates see on your postings') + `
    <div class="card card-pad" style="max-width:760px">
      <div class="profile-upload">
        <span class="opp-logo" id="cpLogoPrev" data-existing="${escapeHTML(CP.logoUrl || '')}" style="position:relative;width:84px;height:84px;border-radius:20px;font-size:30px;cursor:pointer">
          ${CP.logoUrl ? `<img src="${escapeHTML(CP.logoUrl)}" referrerpolicy="no-referrer">` : escapeHTML((CP.companyName || 'C')[0])}</span>
        <div><strong style="font-size:14.5px">Company logo</strong><p class="text-muted" style="font-size:12.5px">Square image recommended (ImgBB)</p>
          <input type="file" id="cpLogo" accept="image/*" class="hidden"></div></div>
      <div class="form-row">
        <div class="form-group"><label>Company name *</label><input class="input" id="cpName" value="${escapeHTML(CP.companyName || '')}"></div>
        <div class="form-group"><label>Industry</label><input class="input" id="cpIndustry" value="${escapeHTML(CP.industry || '')}" placeholder="IT Services, FinTech…"></div></div>
      <div class="form-row">
        <div class="form-group"><label>Website</label><input class="input" id="cpWeb" value="${escapeHTML(CP.website || '')}" placeholder="https://"></div>
        <div class="form-group"><label>Company size</label><select class="select" id="cpSize">
          ${['1-50', '50-100', '100-200', '200-500', '500-1000', '1000+'].map(s => `<option ${CP.size === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
      <div class="form-group"><label>Headquarters location</label><input class="input" id="cpLoc" value="${escapeHTML(CP.location || '')}"></div>
      <div class="form-group"><label>About the company</label><textarea class="textarea" id="cpAbout">${escapeHTML(CP.about || '')}</textarea></div>
      <button class="btn btn-primary" id="cpSave">${icon('check', 16)} Save company profile</button>
    </div>`;
  setupImageUpload({ inputEl: content.querySelector('#cpLogo'), previewEl: content.querySelector('#cpLogoPrev') });
  content.querySelector('#cpSave').addEventListener('click', async e => {
    const btn = e.currentTarget;
    btnLoading(btn, true, 'Saving…');
    try {
      const g = id => content.querySelector('#' + id).value.trim();
      const data = { userId: uid, companyName: g('cpName'), industry: g('cpIndustry'), website: g('cpWeb'), size: g('cpSize'), location: g('cpLoc'), about: g('cpAbout'), logoUrl: content.querySelector('#cpLogoPrev img')?.src || '' };
      if (!data.companyName) throw new Error('Company name is required.');
      await saveCompanyProfile(uid, data);
      await (await import('./database.js')).setDocument('users', uid, { name: data.companyName, profileImage: data.logoUrl }, { timestamps: false });
      CP = { ...CP, ...data };
      toast('Company profile saved!');
    } catch (err) { toast(err.message, 'error'); }
    finally { btnLoading(btn, false); }
  });
}

/* ==================== POST INTERNSHIP / JOB ==================== */
function renderPostingForm(kind) {
  const isInt = kind === 'internship';
  const skills = tagInput(document.createElement('div'), {});
  content.innerHTML = pageHeader(isInt ? 'Post an Internship' : 'Post a Job', 'Your posting is instantly matched against student skill profiles') + `
    <div class="card card-pad" style="max-width:820px">
      <div class="form-group"><label>${isInt ? 'Internship' : 'Job'} title *</label>
        <input class="input" id="ptTitle" placeholder="${isInt ? 'e.g. Frontend Development Intern' : 'e.g. Junior Software Engineer'}"></div>
      <div class="form-group"><label>Description *</label>
        <textarea class="textarea" id="ptDesc" placeholder="What will the candidate work on? What will they learn?"></textarea></div>
      <div class="form-group"><label>Skills required * <span class="text-muted" style="font-weight:400">(press Enter after each)</span></label>
        <div id="ptSkills"></div></div>
      <div class="form-row-3">
        <div class="form-group"><label>Qualification</label><input class="input" id="ptQual" placeholder="B.E/B.Tech"></div>
        <div class="form-group"><label>Location</label><input class="input" id="ptLoc" placeholder="City / Remote"></div>
        ${isInt ? `<div class="form-group"><label>Duration</label><input class="input" id="ptDur" placeholder="3 Months"></div>`
          : `<div class="form-group"><label>Experience</label><input class="input" id="ptExp" placeholder="0-2 years"></div>`}</div>
      <div class="form-row-3">
        <div class="form-group"><label>${isInt ? 'Stipend' : 'Salary'}</label><input class="input" id="ptPay" placeholder="${isInt ? '₹15,000/month' : '₹4.5 - 6 LPA'}"></div>
        ${isInt ? `<div class="form-group"><label>Number of positions</label><input class="input" id="ptPos" type="number" min="1" value="1"></div>`
          : `<div class="form-group"><label>Employment type</label><select class="select" id="ptEmp"><option>Full-time</option><option>Internship</option><option>Part-time</option><option>Contract</option></select></div>`}
        <div class="form-group"><label>Application deadline *</label><input class="input" id="ptDl" type="date"></div></div>
      <button class="btn btn-primary btn-lg" id="ptSubmit">${icon('send', 16)} Publish ${isInt ? 'internship' : 'job'}</button>
    </div>`;
  const tSkills = tagInput(content.querySelector('#ptSkills'), { placeholder: 'e.g. JavaScript', suggestions: ['JavaScript', 'Python', 'Java', 'SQL', 'React', 'Node.js', 'AWS', 'Docker', 'HTML', 'CSS', 'AI/ML', 'Data Analysis', 'Cybersecurity'] });

  content.querySelector('#ptSubmit').addEventListener('click', async e => {
    const btn = e.currentTarget;
    const g = id => content.querySelector('#' + id).value.trim();
    const deadline = g('ptDl');
    if (!g('ptTitle') || !g('ptDesc')) return toast('Title and description are required.', 'error');
    if (!tSkills.get().length) return toast('Add at least one required skill.', 'error');
    if (!deadline || new Date(deadline) < new Date(new Date().toDateString())) return toast('Deadline must be a future date.', 'error');
    btnLoading(btn, true, 'Publishing…');
    try {
      const base = {
        title: g('ptTitle'), description: g('ptDesc'), skills: tSkills.get(), qualification: g('ptQual'),
        location: g('ptLoc'), deadline, companyName: CP.companyName || ctx.profile.name,
        companyLogo: CP.logoUrl || ''
      };
      let id;
      if (isInt) id = await createInternship({ ...base, duration: g('ptDur'), stipend: g('ptPay'), positions: +g('ptPos') || 1 }, uid);
      else id = await createJob({ ...base, experience: g('ptExp'), salary: g('ptPay'), employmentType: g('ptEmp') }, uid);

      // Notify best-matching students (rule-based recommender).
      try {
        const students = (await getAllStudents()).slice(0, 200);
        const matches = students.map(s => ({ s, m: matchPercent(s.technicalSkills || [], base.skills) }))
          .filter(x => x.m >= 50).sort((a, b) => b.m - a.m).slice(0, 10);
        await Promise.all(matches.map(({ s, m }) => notifyUser(s.userId, {
          title: `New ${isInt ? 'internship' : 'job'} matching your skills`,
          message: `${base.title} at ${base.companyName} — ${m}% skill match. Apply before ${deadline}!`,
          type: 'opportunity'
        })));
      } catch (_) { /* notifications are best-effort */ }

      toast('Published! Matching students have been notified. 🎉');
      content.querySelector('#ptTitle').value = ''; content.querySelector('#ptDesc').value = ''; tSkills.set([]);
      content.insertAdjacentHTML('beforeend', `<div class="alert alert-success mt-2">${icon('check', 16)}<span>Posted successfully. Manage applicants <a href="applicants.html">here</a>.</span></div>`);
      void id;
    } catch (err) { toast(err.message, 'error'); }
    finally { btnLoading(btn, false); }
  });
  void skills;
}

/* ==================== TRAINING PROGRAMS ==================== */
async function renderTraining() {
  const type = params.get('type') || 'training';
  const TABS = [['training', 'Training'], ['certification', 'Certification'], ['workshop', 'Workshop'], ['mentorship', 'Mentorship'], ['project', 'Live Project']];
  content.innerHTML = pageHeader('Learning Programs', 'Publish programs to upskill students and build your talent pipeline') + `
    <div class="flex-between no-print" style="margin-bottom:18px">
      <div class="tabs" style="margin:0">${TABS.map(([v, l]) => `<button class="tab-btn" data-tp="${v}">${l}</button>`).join('')}</div>
      <button class="btn btn-primary" id="tpAdd">${icon('plus', 16)} New program</button>
    </div><div id="tpBody">${skeletonBlocks(3)}</div>`;

  const body = content.querySelector('#tpBody');
  const programs = (await getLearningPrograms()).filter(p => p.companyId === uid);
  const current = programs.filter(p => p.type === type);

  content.querySelectorAll('[data-tp]').forEach(b => {
    b.classList.toggle('active', b.dataset.tp === type);
    b.addEventListener('click', () => location.href = `training.html?type=${b.dataset.tp}`);
  });

  function paint() {
    body.innerHTML = current.length ? `<div class="opp-grid">${current.map(p => `<div class="opp-card">
      <div class="flex-between"><span class="badge badge-indigo">${escapeHTML(p.type)}</span>
        <span style="font-weight:800;color:var(--success);font-size:13.5px">${escapeHTML(p.fee || 'Free')}</span></div>
      <div><div class="opp-title">${escapeHTML(p.title)}</div>
      <p class="text-muted" style="font-size:13px">${escapeHTML((p.description || '').slice(0, 110))}…</p></div>
      <div class="opp-meta"><span>${icon('clock', 14)}${escapeHTML(p.duration || '—')}</span><span>${icon('globe', 14)}${escapeHTML(p.mode || 'Online')}</span></div>
      <div class="opp-foot" style="border-top:1px solid var(--border);padding-top:10px">
        <span class="text-muted" style="font-size:12.5px">${(p.skills || []).slice(0, 3).map(escapeHTML).join(' · ')}</span>
        <button class="icon-btn" data-del="${p.id}" style="color:var(--danger)" title="Delete">${icon('trash', 16)}</button></div>
    </div>`).join('')}</div>`
      : emptyState({ ico: 'book', title: 'No programs in this category', text: 'Create a training, certification, workshop, mentorship or live project program.', actionLabel: 'Create program', actionId: 'tpAdd2' });
    body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!await confirmDialog('Delete this program permanently?', { okText: 'Delete' })) return;
      try { await deleteDocument('learningPrograms', b.dataset.del); toast('Program deleted'); renderTraining(); }
      catch (err) { toast(err.message, 'error'); }
    }));
    (body.querySelector('#tpAdd2') || content.querySelector('#tpAdd'))?.addEventListener('click', openCreate);
  }

  function openCreate() {
    const { el, close } = openModal({
      title: 'New learning program',
      body: `<div class="form-group"><label>Program type</label><select class="select" id="mType">
          ${TABS.map(([v, l]) => `<option value="${v}" ${v === type ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="form-group"><label>Title *</label><input class="input" id="mTitle"></div>
        <div class="form-group"><label>Description</label><textarea class="textarea" id="mDesc" style="min-height:80px"></textarea></div>
        <div class="form-group"><label>Skills covered</label><div id="mSkills"></div></div>
        <div class="form-row-3"><div class="form-group"><label>Duration</label><input class="input" id="mDur" placeholder="6 Weeks"></div>
        <div class="form-group"><label>Mode</label><select class="select" id="mMode"><option>Online (Live)</option><option>Online (Self-paced)</option><option>On-site</option><option>Hybrid</option></select></div>
        <div class="form-group"><label>Fee</label><input class="input" id="mFee" placeholder="Free / ₹2,999"></div></div>`,
      footer: `<button class="btn btn-outline" data-x>Cancel</button><button class="btn btn-primary" data-go>Publish program</button>`
    });
    const tS = tagInput(el.querySelector('#mSkills'), { placeholder: 'Add skills…', suggestions: ['Python', 'SQL', 'AWS', 'Communication', 'AI/ML', 'React', 'Cybersecurity'] });
    el.querySelector('[data-x]').onclick = close;
    el.querySelector('[data-go]').addEventListener('click', async ev => {
    const btn = ev.currentTarget;
      const title = el.querySelector('#mTitle').value.trim();
      if (!title) return toast('Title is required', 'error');
      btnLoading(btn, true, 'Publishing…');
      try {
        await createLearningProgram({
          type: el.querySelector('#mType').value, title,
          description: el.querySelector('#mDesc').value.trim(), skills: tS.get(),
          duration: el.querySelector('#mDur').value.trim(), mode: el.querySelector('#mMode').value,
          fee: el.querySelector('#mFee').value.trim(), companyName: CP.companyName || ctx.profile.name
        }, uid);
        toast('Program published!'); close(); renderTraining();
      } catch (err) { toast(err.message, 'error'); btnLoading(btn, false); }
    });
  }
  content.querySelector('#tpAdd').addEventListener('click', openCreate);
  paint();
}

/* ==================== APPLICANT MANAGEMENT ==================== */
async function renderApplicants() {
  content.innerHTML = pageHeader('Applicants', 'Screen candidates and manage application statuses') + `
    <div class="filter-bar no-print">
      <span class="search-wrap">${icon('search', 16)}<input class="input" id="apSearch" placeholder="Search candidate or role…"></span>
      <select class="select" id="apType"><option value="">All types</option><option value="internship">Internships</option><option value="job">Jobs</option></select>
      <select class="select" id="apStatus"><option value="">All statuses</option>${STATUSES.map(s => `<option>${s}</option>`).join('')}</select>
    </div><div id="apBody">${'<div class="sk" style="height:60px;margin-bottom:10px"></div>'.repeat(4)}</div>`;

  const apps = await getCompanyApplications(uid);
  const studentCache = {};

  function paint() {
    const q = content.querySelector('#apSearch').value.toLowerCase();
    const t = content.querySelector('#apType').value, s = content.querySelector('#apStatus').value;
    const rows = apps.filter(a =>
      (!q || `${a.studentName} ${a.opportunityTitle}`.toLowerCase().includes(q)) &&
      (!t || a.type === t) && (!s || a.status === s));
    const body = content.querySelector('#apBody');
    body.innerHTML = rows.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Candidate</th><th>Skills</th><th>Qualification</th><th>Match</th><th>Applied</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${rows.map(a => `<tr>
        <td><div class="flex">${avatarHTML(a.studentName, '')}<div><div style="font-weight:700;font-size:13.5px">${escapeHTML(a.studentName)}</div>
          <div class="text-muted" style="font-size:12px">${escapeHTML(a.studentEmail)}</div>
          <div class="text-muted" style="font-size:12px">${escapeHTML(a.opportunityTitle)}</div></div></div></td>
        <td>${(a.skills || []).slice(0, 3).map(sk => `<span class="chip chip-gray">${escapeHTML(sk)}</span>`).join('')}</td>
        <td class="qual-cell" data-sid="${a.studentId}"><span class="text-muted">…</span></td>
        <td>${matchBadge(a.matchPercent ?? 0)}</td>
        <td>${formatDate(a.createdAt)}</td>
        <td><select class="select" style="min-width:130px;padding:6px 10px" data-status="${a.id}">
          ${STATUSES.map(st => `<option ${st === a.status ? 'selected' : ''}>${st}</option>`).join('')}</select></td>
        <td style="white-space:nowrap">
          ${a.resumeUrl ? `<a class="btn btn-outline btn-sm" href="${escapeHTML(a.resumeUrl)}" target="_blank" rel="noopener">${icon('file', 13)} Resume</a>` : '<span class="text-muted" style="font-size:12px">No resume</span>'}
          <button class="icon-btn" title="View profile" data-view="${a.studentId}">${icon('eye', 16)}</button>
        </td></tr>`).join('')}</tbody></table></div>`
      : emptyState({ ico: 'users', title: 'No applicants found', text: 'Applications to your internships and jobs will appear here for screening.' });

    // fill qualification cells lazily
    rows.forEach(a => {
      if (studentCache[a.studentId]) { fillQual(a.studentId, studentCache[a.studentId]); return; }
      import('./database.js').then(({ getStudentProfile }) =>
        getStudentProfile(a.studentId).then(sp => { studentCache[a.studentId] = sp; fillQual(a.studentId, sp); }));
    });
    function fillQual(sid, sp) {
      body.querySelectorAll(`[data-sid="${sid}"]`).forEach(c => {
        if (c && c.classList.contains('qual-cell'))
          c.innerHTML = sp ? `<div style="font-size:12.5px"><strong>${escapeHTML(sp.degree || '—')}</strong><br><span class="text-muted">${escapeHTML(sp.college || '')}</span></div>` : '—';
      });
    }

    body.querySelectorAll('[data-status]').forEach(sel => sel.addEventListener('change', async () => {
      try { await updateApplicationStatus(sel.dataset.status, sel.value); toast(`Status updated to "${sel.value}" — candidate notified.`); }
      catch (err) { toast(err.message, 'error'); }
    }));
    body.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
      const sp = studentCache[b.dataset.view];
      if (!sp) return toast('Loading profile… try again in a second.', 'info');
      openModal({
        title: sp.name || 'Candidate',
        body: `<div class="flex" style="gap:12px;margin-bottom:14px">${avatarHTML(sp.name, sp.profileImage, 'avatar avatar-lg')}
          <div><strong>${escapeHTML(sp.name || '')}</strong><div class="text-muted" style="font-size:13px">${escapeHTML(sp.email || '')}</div></div></div>
          <p style="font-size:13.5px;color:var(--text-2)">${escapeHTML(sp.about || 'No bio provided.')}</p>
          <div class="mt-2"><strong style="font-size:13.5px">Education</strong>
          <p class="text-muted" style="font-size:13px">${escapeHTML([sp.degree, sp.branch, sp.college, sp.graduationYear && 'Class of ' + sp.graduationYear].filter(Boolean).join(' · ') || '—')}</p></div>
          <div class="mt-2"><strong style="font-size:13.5px">Technical skills</strong><div class="mt-1">${chipRow(sp.technicalSkills || [])}</div></div>
          <div class="mt-2"><strong style="font-size:13.5px">Soft skills</strong><div class="mt-1">${chipRow(sp.softSkills || [], 'chip-gray')}</div></div>
          ${sp.skillScore ? `<div class="mt-2">${barList(Object.entries(sp.skillScores || {}).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, v]) => ({ label, value: v, display: v + '%' })))}</div>` : ''}`,
        footer: `<button class="btn btn-outline" onclick="document.getElementById('modal-root').innerHTML=''">Close</button>`
      });
    }));
  }
  content.querySelector('#apSearch').addEventListener('input', debounce(paint, 200));
  content.querySelector('#apType').addEventListener('change', paint);
  content.querySelector('#apStatus').addEventListener('change', paint);
  paint();
}

/* ==================== COLLABORATIONS ==================== */
async function renderCollaborations() {
  content.innerHTML = pageHeader('Industry–Academia Collaboration', 'Post faculty programs and manage incoming collaboration requests') + `
    <div class="tabs">
      <button class="tab-btn active" data-ct="post">Post Opportunity</button>
      <button class="tab-btn" data-ct="mine">My Opportunities</button>
      <button class="tab-btn" data-ct="reqs">Incoming Requests</button>
    </div><div id="coBody"></div>`;

  const body = content.querySelector('#coBody');
  const [opps, reqs, collabs] = await Promise.all([
    getAcademyOpportunities(), getCompanyAcademyApplications(uid), getIncomingCollabRequests(uid)
  ]);
  const mine = opps.filter(o => o.companyId === uid);

  content.querySelectorAll('[data-ct]').forEach(b => b.addEventListener('click', () => {
    content.querySelectorAll('[data-ct]').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    ({ post: paintPost, mine: paintMine, reqs: paintReqs })[b.dataset.ct]();
  }));

  function paintPost() {
    body.innerHTML = `<div class="card card-pad" style="max-width:760px">
      <p class="text-muted" style="font-size:13.5px;margin-bottom:16px">Publish FDPs, faculty internships, consultancy projects, research collaborations, workshops and guest lectures to academicians.</p>
      <div class="form-row">
        <div class="form-group"><label>Type *</label><select class="select" id="cType">
          ${Object.entries(AO_TYPES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
        <div class="form-group"><label>Field / domain</label><input class="input" id="cField" placeholder="AI / Data Science"></div></div>
      <div class="form-group"><label>Title *</label><input class="input" id="cTitle"></div>
      <div class="form-group"><label>Description *</label><textarea class="textarea" id="cDesc" style="min-height:90px"></textarea></div>
      <div class="form-row-3">
        <div class="form-group"><label>Duration</label><input class="input" id="cDur" placeholder="1 Week"></div>
        <div class="form-group"><label>Mode</label><select class="select" id="cMode"><option>Online</option><option>On-site</option><option>Hybrid</option></select></div>
        <div class="form-group"><label>Honorarium / fee</label><input class="input" id="cHon" placeholder="₹15,000 honorarium"></div></div>
      <div class="form-group"><label>Application deadline</label><input class="input" id="cDl" type="date"></div>
      <button class="btn btn-primary" id="cSubmit">${icon('send', 16)} Publish collaboration opportunity</button></div>`;
    body.querySelector('#cSubmit').addEventListener('click', async e => {
    const btn = e.currentTarget;
      const g = id => body.querySelector('#' + id).value.trim();
      if (!g('cTitle') || !g('cDesc')) return toast('Title and description are required.', 'error');
      btnLoading(btn, true, 'Publishing…');
      try {
        await createAcademyOpportunity({
          type: g('cType'), field: g('cField'), title: g('cTitle'), description: g('cDesc'),
          duration: g('cDur'), mode: g('cMode'), honorarium: g('cHon'), deadline: g('cDl'),
          companyName: CP.companyName || ctx.profile.name
        }, uid);
        toast('Opportunity published for academicians! 🎉');
        content.querySelectorAll('[data-ct]')[1].click();
      } catch (err) { toast(err.message, 'error'); btnLoading(btn, false); }
    });
  }

  function paintMine() {
    body.innerHTML = mine.length ? `<div class="opp-grid">${mine.map(o => `<div class="opp-card">
      <div class="flex-between"><span class="badge badge-indigo">${AO_TYPES[o.type] || o.type}</span>
        <span class="text-muted" style="font-size:12px">${reqs.filter(r => r.opportunityId === o.id).length} request(s)</span></div>
      <div class="opp-title">${escapeHTML(o.title)}</div>
      <div class="opp-meta mt-1"><span>${icon('clock', 14)}${escapeHTML(o.duration || '—')}</span><span>${icon('globe', 14)}${escapeHTML(o.mode || '')}</span></div>
      <div class="opp-foot" style="border-top:1px solid var(--border);padding-top:10px">
        <span class="text-muted" style="font-size:12.5px">${escapeHTML(o.field || '')}</span>
        <button class="icon-btn" data-del="${o.id}" style="color:var(--danger)">${icon('trash', 16)}</button></div>
    </div>`).join('')}</div>` : emptyState({ ico: 'network', title: 'No opportunities posted', text: 'Publish your first faculty collaboration opportunity.', actionLabel: 'Post opportunity', actionId: 'goPost' });
    body.querySelector('#goPost')?.addEventListener('click', () => content.querySelectorAll('[data-ct]')[0].click());
    body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!await confirmDialog('Delete this opportunity?', { okText: 'Delete' })) return;
      try { await deleteDocument('academyOpportunities', b.dataset.del); toast('Deleted'); renderCollaborations(); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }

  async function paintReqs() {
    const rows = [...reqs];
    const acadCache = {};
    await Promise.all(rows.map(async r => {
      if (!acadCache[r.academicianId]) {
        const { getAcademicianProfile } = await import('./database.js');
        acadCache[r.academicianId] = await getAcademicianProfile(r.academicianId).catch(() => null);
      }
    }));
    body.innerHTML = (rows.length || collabs.length) ? `
      ${rows.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Academician</th><th>Opportunity</th><th>Message</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${rows.map(r => { const ap = acadCache[r.academicianId]; return `<tr>
          <td><div style="font-weight:700;font-size:13.5px">${escapeHTML(r.name)}</div>
            <div class="text-muted" style="font-size:12px">${escapeHTML(ap?.designation || '')} · ${escapeHTML(r.college || ap?.college || '')}</div></td>
          <td>${escapeHTML(r.opportunityTitle)}<br><span class="badge badge-gray">${AO_TYPES[r.type] || r.type}</span></td>
          <td style="max-width:220px"><span class="text-muted" style="font-size:12.5px">${escapeHTML(r.message || '—')}</span></td>
          <td>${statusBadge(r.status)}</td>
          <td style="white-space:nowrap">${r.status === 'Applied' ? `
            <button class="btn btn-soft btn-sm" data-acc="${r.id}">Accept</button>
            <button class="btn btn-outline btn-sm" data-rej="${r.id}">Decline</button>`
            : `<span class="text-muted" style="font-size:12px">Responded</span>`}</td></tr>`; }).join('')}</tbody></table></div>` : ''}
      ${collabs.length ? `<h3 class="card-title mt-3">Partnership requests from institutions</h3>
        <div class="table-wrap"><table><thead><tr><th>Institution</th><th>Type</th><th>Message</th><th>Status</th></tr></thead>
        <tbody>${collabs.map(c => `<tr><td><strong>${escapeHTML(c.fromName)}</strong></td>
          <td>${escapeHTML(c.type || 'Partnership')}</td><td class="text-muted" style="font-size:12.5px">${escapeHTML(c.message || '—')}</td>
          <td>${statusBadge(c.status || 'Pending')}</td></tr>`).join('')}</tbody></table></div>` : ''}`
      : emptyState({ ico: 'mail', title: 'No collaboration requests yet', text: 'Requests from academicians and institutions will appear here.' });

    body.querySelectorAll('[data-acc]').forEach(b => b.addEventListener('click', () => respond(b.dataset.acc, 'Accepted')));
    body.querySelectorAll('[data-rej]').forEach(b => b.addEventListener('click', () => respond(b.dataset.rej, 'Rejected')));
    async function respond(id, status) {
      try { await updateAcademyApplicationStatus(id, status); toast(`Request ${status.toLowerCase()} — academician notified.`); renderCollaborations(); }
      catch (err) { toast(err.message, 'error'); }
    }
  }

  paintPost();
}

/* ==================== ANALYTICS ==================== */
async function renderAnalytics() {
  content.innerHTML = pageHeader('Hiring Analytics', 'Insights across your postings and applicants') + skeletonBlocks(2);
  const [apps, internships, jobs] = await Promise.all([getCompanyApplications(uid), getInternships(), getJobs()]);
  const mine = apps;
  const byStatus = STATUSES.map(s => ({ label: s.split(' ')[0], value: mine.filter(a => a.status === s).length }));
  const skillDemand = {};
  [...internships.filter(i => i.companyId === uid), ...jobs.filter(j => j.companyId === uid)]
    .forEach(o => (o.skills || []).forEach(s => { skillDemand[s] = (skillDemand[s] || 0) + 1; }));
  const topSkills = Object.entries(skillDemand).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }));
  const avgMatch = mine.length ? Math.round(mine.reduce((a, b) => a + (b.matchPercent || 0), 0) / mine.length) : 0;
  const selRate = mine.length ? Math.round(mine.filter(a => a.status === 'Selected').length / mine.length * 100) : 0;

  content.innerHTML = pageHeader('Hiring Analytics', 'Insights across your postings and applicants') + `
    <div class="stat-grid">
      ${statCard({ ico: 'file', color: 'indigo', value: mine.length, label: 'Total Applications' })}
      ${statCard({ ico: 'target', color: 'teal', value: avgMatch + '%', label: 'Avg. Skill Match' })}
      ${statCard({ ico: 'star', color: 'green', value: selRate + '%', label: 'Selection Rate' })}
      ${statCard({ ico: 'briefcase', color: 'amber', value: internships.filter(i => i.companyId === uid).length + jobs.filter(j => j.companyId === uid).length, label: 'Open Postings' })}
    </div>
    <div class="grid-2">
      <div class="card card-pad"><h3 class="card-title">Applications by status</h3>${barChartSVG(byStatus, { suffix: '' })}</div>
      <div class="card card-pad"><h3 class="card-title">Most requested skills</h3>${topSkills.length ? barList(topSkills) : '<p class="text-muted" style="font-size:13.5px">Post opportunities to see demand.</p>'}</div>
    </div>
    <div class="grid-2 mt-2">
      <div class="card card-pad flex" style="justify-content:space-around">${donutSVG(selRate, { color: 'var(--success)', label: 'Selection rate' })}${donutSVG(avgMatch, { color: 'var(--primary)', label: 'Avg. skill match' })}</div>
      <div class="card card-pad"><h3 class="card-title">Top candidates by match</h3>
        ${mine.slice().sort((a, b) => (b.matchPercent || 0) - (a.matchPercent || 0)).slice(0, 5).map(a => `<div class="list-item">
          ${avatarHTML(a.studentName, '')}<div style="flex:1"><div class="li-title">${escapeHTML(a.studentName)}</div>
          <div class="li-sub">${escapeHTML(a.opportunityTitle)}</div></div>${matchBadge(a.matchPercent || 0)}</div>`).join('') || '<p class="text-muted" style="font-size:13.5px">No applicants yet.</p>'}</div>
    </div>`;
}
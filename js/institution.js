// Institution portal: student overview, skill/placement analytics, printable reports.
import {
  initDashboardShell, icon, toast, openModal, btnLoading, emptyState, escapeHTML,
  avatarHTML, chipRow, statusBadge, matchBadge, statCard, pageHeader, skeletonBlocks,
  donutSVG, barChartSVG, barList, progressRow, debounce, renderNotificationsPage, renderSettingsPage
} from './common.js';
import { getStudentsByCollege, getInternships, getJobs, saveInstitutionProfile } from './database.js';

const ctx = await initDashboardShell();
if (!ctx) throw new Error('unauthenticated');
const uid = ctx.user.uid;
const content = document.getElementById('pageContent');
const INST_NAME = ctx.profile.name; // institution display name = filter key
const params = new URLSearchParams(location.search);

const pages = {
  'inst-dashboard': renderDashboard,
  'inst-students': renderStudents,
  'inst-analytics': renderAnalytics,
  'inst-reports': renderReports,
  'inst-notifications': () => renderNotificationsPage(content, uid),
  'inst-settings': () => renderSettingsPage(content, ctx.user)
};
await (pages[document.body.dataset.page] || renderDashboard)();

async function loadStudents() {
  const students = await getStudentsByCollege(INST_NAME);
  return students;
}

/* ==================== DASHBOARD ==================== */
async function renderDashboard() {
  content.innerHTML = pageHeader(INST_NAME, 'Institution performance overview') + skeletonBlocks(3);
  const [students, internships, jobs] = await Promise.all([loadStudents(), getInternships(), getJobs()]);
  const withScore = students.filter(s => s.skillScore);
  const avgScore = withScore.length ? Math.round(withScore.reduce((a, s) => a + s.skillScore, 0) / withScore.length) : 0;
  const participated = students.filter(s => (s.applicationsCount || 0) > 0).length;
  const placed = students.filter(s => ['Placed', 'Intern Selected'].includes(s.placementStatus)).length;
  const skillCount = {};
  students.forEach(s => (s.technicalSkills || []).forEach(k => { skillCount[k] = (skillCount[k] || 0) + 1; }));
  const topSkills = Object.entries(skillCount).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([label, value]) => ({ label, value }));
  const industryIds = new Set(internships.map(i => i.companyId).concat(jobs.map(j => j.companyId)));

  content.innerHTML = pageHeader(INST_NAME, 'Skill development, internships and placement progress at a glance') + `
    <div class="stat-grid">
      ${statCard({ ico: 'users', color: 'indigo', value: students.length, label: 'Registered Students' })}
      ${statCard({ ico: 'target', color: 'teal', value: avgScore + '%', label: 'Average Skill Score' })}
      ${statCard({ ico: 'briefcase', color: 'blue', value: students.length ? Math.round(participated / students.length * 100) + '%' : '0%', label: 'Internship Participation', sub: `${participated} students applied` })}
      ${statCard({ ico: 'star', color: 'green', value: students.length ? Math.round(placed / students.length * 100) + '%' : '0%', label: 'Placement Rate', sub: `${placed} placed/selected` })}
      ${statCard({ ico: 'building', color: 'amber', value: industryIds.size, label: 'Industry Connections' })}
    </div>
    <div class="panel-grid">
      <div class="card card-pad"><h3 class="card-title">Top skills on campus</h3>
        ${topSkills.length ? barList(topSkills) : '<p class="text-muted" style="font-size:13.5px">No student skill data yet.</p>'}</div>
      <div class="card card-pad"><h3 class="card-title">Placement progress</h3>
        <div class="flex" style="justify-content:space-around">${donutSVG(students.length ? placed / students.length * 100 : 0, { color: 'var(--success)', label: 'Placed' })}
        ${donutSVG(students.length ? participated / students.length * 100 : 0, { color: 'var(--info)', label: 'Participating' })}</div>
        <a class="btn btn-soft btn-sm btn-block mt-2" href="analytics.html">Full analytics →</a></div>
    </div>`;
}

/* ==================== STUDENTS ==================== */
async function renderStudents() {
  content.innerHTML = pageHeader('Students', 'Registered students and their skill/placement progress') +
    `<div class="filter-bar no-print"><span class="search-wrap">${icon('search', 16)}<input class="input" id="stSearch" placeholder="Search name, branch, skill…"></span></div>
     <div id="stBody">${'<div class="sk" style="height:60px;margin-bottom:10px"></div>'.repeat(4)}</div>`;
  const students = await loadStudents();
  const filteredByCollege = (await (await import('./database.js')).getStudentsByCollege(INST_NAME)).length > 0;

  function paint() {
    const q = content.querySelector('#stSearch').value.toLowerCase();
    const rows = students.filter(s => !q || `${s.name} ${s.branch} ${s.degree} ${(s.technicalSkills || []).join(' ')}`.toLowerCase().includes(q));
    const body = content.querySelector('#stBody');
    body.innerHTML =
      (!filteredByCollege ? `<div class="alert alert-info">${icon('globe', 16)}<span>No students match "<strong>${escapeHTML(INST_NAME)}</strong>" as college — showing all registered students (demo mode).</span></div>` : '') +
      (rows.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Student</th><th>Degree / Branch</th><th>Grad Year</th><th>Skill Score</th><th>Applications</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows.map(s => `<tr>
          <td><div class="flex">${avatarHTML(s.name, s.profileImage)}<strong style="font-size:13.5px">${escapeHTML(s.name || '—')}</strong></div></td>
          <td>${escapeHTML([s.degree, s.branch].filter(Boolean).join(', ') || '—')}</td>
          <td>${escapeHTML(s.graduationYear || '—')}</td>
          <td style="min-width:130px">${s.skillScore ? progressRow('', s.skillScore, s.skillScore >= 70 ? 'green' : '') : '<span class="text-muted">Not assessed</span>'}</td>
          <td>${s.applicationsCount || 0}</td>
          <td>${s.placementStatus && s.placementStatus !== 'Searching' ? statusBadge(s.placementStatus) : '<span class="badge badge-gray">Searching</span>'}</td>
          <td><button class="icon-btn" data-view="${s.userId || s.id}">${icon('eye', 16)}</button></td>
        </tr>`).join('')}</tbody></table></div>`
        : emptyState({ ico: 'users', title: 'No students found', text: 'Students from your institution appear here once they register on the portal.' }));
    body.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
      const s = students.find(x => (x.userId || x.id) === b.dataset.view);
      openModal({
        title: s.name, body: `<div class="flex" style="gap:12px;margin-bottom:14px">${avatarHTML(s.name, s.profileImage, 'avatar avatar-lg')}
          <div><strong>${escapeHTML(s.name || '')}</strong><div class="text-muted" style="font-size:13px">${escapeHTML(s.email || '')}</div></div></div>
          <p class="text-muted" style="font-size:13.5px">${escapeHTML([s.degree, s.branch, s.college].filter(Boolean).join(' · ') || '')}</p>
          <div class="mt-2"><strong style="font-size:13.5px">Skills</strong><div class="mt-1">${chipRow(s.technicalSkills || [])}</div></div>
          <div class="mt-2 flex-between">${s.skillScore ? donutSVG(s.skillScore, { label: 'Skill score' }) : ''}
            <div><p style="font-size:13px"><strong>${s.applicationsCount || 0}</strong> applications</p>
            <p style="font-size:13px"><strong>${s.internshipCount || 0}</strong> internships</p>
            <p style="font-size:13px">Status: ${s.placementStatus || 'Searching'}</p></div></div>`,
        footer: `<button class="btn btn-outline" onclick="document.getElementById('modal-root').innerHTML=''">Close</button>`
      });
    }));
  }
  content.querySelector('#stSearch').addEventListener('input', debounce(paint, 200));
  paint();
}

/* ==================== ANALYTICS ==================== */
async function renderAnalytics() {
  content.innerHTML = pageHeader('Analytics', 'Skill gaps, industry demand and placement funnel') + skeletonBlocks(2);
  const [students, internships, jobs] = await Promise.all([loadStudents(), getInternships(), getJobs()]);

  // Avg self/assessed skill scores per skill + campus skill supply vs industry demand
  const scoreAgg = {};
  students.forEach(s => Object.entries(s.skillScores || {}).forEach(([k, v]) => {
    (scoreAgg[k] = scoreAgg[k] || []).push(v);
  }));
  const avgBySkill = Object.entries(scoreAgg).map(([k, arr]) => ({ label: k, value: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length), display: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) + '%' }))
    .sort((a, b) => b.value - a.value).slice(0, 8);

  const demand = {};
  internships.concat(jobs).forEach(o => (o.skills || []).forEach(s => { demand[s] = (demand[s] || 0) + 1; }));
  const supply = {};
  students.forEach(s => (s.technicalSkills || []).forEach(s2 => { supply[s2.toLowerCase()] = (supply[s2.toLowerCase()] || 0) + 1; }));
  const gaps = Object.entries(demand).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([skill, n]) => ({ skill, n, have: supply[skill.toLowerCase()] || 0 }))
    .filter(g => g.have < g.n).sort((a, b) => (b.n - b.have) - (a.n - a.have));

  const funnel = ['Applied', 'Under Review', 'Shortlisted', 'Interview', 'Selected'].map(st => ({
    label: st.split(' ')[0],
    value: students.reduce((acc, s) => acc + (s.placementStatus === 'Placed' && st === 'Selected' ? 1 : 0), 0) || funnelPlaceholder(st)
  }));
  function funnelPlaceholder() { return 0; }
  // Simple aggregation from students' counters (prototype scope)
  const totals = {
    Applied: students.reduce((a, s) => a + (s.applicationsCount || 0), 0),
    Internships: students.reduce((a, s) => a + (s.internshipCount || 0), 0),
    Placed: students.filter(s => ['Placed', 'Intern Selected'].includes(s.placementStatus)).length
  };
  const gradYears = {};
  students.forEach(s => { if (s.graduationYear) gradYears[s.graduationYear] = (gradYears[s.graduationYear] || 0) + 1; });
  const gradData = Object.entries(gradYears).sort().map(([label, value]) => ({ label, value }));

  content.innerHTML = pageHeader('Analytics', 'Skill gaps, industry demand and placement funnel') + `
    <div class="grid-2">
      <div class="card card-pad"><h3 class="card-title">Average skill score by skill</h3>
        ${avgBySkill.length ? barList(avgBySkill) : '<p class="text-muted" style="font-size:13.5px">Awaiting student assessments.</p>'}</div>
      <div class="card card-pad"><h3 class="card-title">Industry demand vs. campus supply (top gaps)</h3>
        ${gaps.length ? `<div class="table-wrap"><table><thead><tr><th>Skill</th><th>Industry demand</th><th>Students with skill</th><th>Gap</th></tr></thead>
          <tbody>${gaps.map(g => `<tr><td><strong>${escapeHTML(g.skill)}</strong></td><td>${g.n} openings</td><td>${g.have}</td>
          <td><span class="badge badge-amber">-${g.n - g.have}</span></td></tr>`).join('')}</tbody></table></div>`
        : '<p class="text-muted" style="font-size:13.5px">No significant gaps detected.</p>'}</div>
    </div>
    <div class="grid-2 mt-2">
      <div class="card card-pad"><h3 class="card-title">Journey funnel</h3>${barChartSVG([
        { label: 'Applications', value: totals.Applied },
        { label: 'Internships', value: totals.Internships },
        { label: 'Placed', value: totals.Placed }
      ])}</div>
      <div class="card card-pad"><h3 class="card-title">Students by graduation year</h3>
        ${gradData.length ? barChartSVG(gradData) : '<p class="text-muted" style="font-size:13.5px">No data yet.</p>'}</div>
    </div>`;
  void funnel;
}

/* ==================== REPORTS ==================== */
async function renderReports() {
  const students = await loadStudents();
  const withScore = students.filter(s => s.skillScore);
  const avgScore = withScore.length ? Math.round(withScore.reduce((a, s) => a + s.skillScore, 0) / withScore.length) : 0;
  const placed = students.filter(s => ['Placed', 'Intern Selected', 'Internship Completed'].includes(s.placementStatus));
  const skillCount = {};
  students.forEach(s => (s.technicalSkills || []).forEach(k => { skillCount[k] = (skillCount[k] || 0) + 1; }));
  const topSkills = Object.entries(skillCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));
  const noAssess = students.length - withScore.length;

  content.innerHTML = pageHeader('Reports', 'Generate and export institutional reports') + `
    <div class="grid-2">
      <div class="card card-pad">
        <h3 class="card-title">Institution summary</h3>
        <div class="mt-1">
          ${progressRow('Student registration coverage', Math.min(100, students.length * 10))}
          ${progressRow('Assessment completion', students.length ? Math.round(withScore.length / students.length * 100) : 0, 'teal')}
          ${progressRow('Placement rate', students.length ? Math.round(placed.length / students.length * 100) : 0, 'green')}
        </div>
        <div class="flex mt-2 no-print">
          <button class="btn btn-primary" id="genReport">${icon('file', 16)} Generate printable report</button>
          <button class="btn btn-outline" id="csvBtn">${icon('download', 16)} Export students CSV</button>
        </div>
        ${noAssess > 0 ? `<div class="alert alert-warning mt-2 no-print" style="margin-bottom:0">${icon('bell', 16)}<span>${noAssess} student(s) haven't completed skill assessment — encourage them from the <a href="#" onclick="return false">mentor dashboard</a>.</span></div>` : ''}
      </div>
      <div class="card card-pad" id="reportCard" style="display:none">
        <div id="reportInner"></div>
      </div>
    </div>`;

  content.querySelector('#genReport').addEventListener('click', () => {
    const card = content.querySelector('#reportCard');
    card.style.display = 'block';
    content.querySelector('#reportInner').innerHTML = `
      <h2 style="font-size:20px">${escapeHTML(INST_NAME)} — Skill &amp; Placement Report</h2>
      <p class="text-muted" style="font-size:13px">Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · AcademiaConnect</p>
      <div class="table-wrap mt-2" style="border:none"><table style="min-width:0">
        <tbody>
          <tr><td>Total registered students</td><td><strong>${students.length}</strong></td></tr>
          <tr><td>Average skill score</td><td><strong>${avgScore}%</strong></td></tr>
          <tr><td>Assessments completed</td><td><strong>${withScore.length}</strong></td></tr>
          <tr><td>Placed / selected students</td><td><strong>${placed.length}</strong></td></tr>
          <tr><td>Placement rate</td><td><strong>${students.length ? Math.round(placed.length / students.length * 100) : 0}%</strong></td></tr>
          <tr><td>Top campus skills</td><td>${topSkills.map(([s, n]) => `${escapeHTML(s)} (${n})`).join(', ') || '—'}</td></tr>
        </tbody></table></div>
      <p class="text-muted mt-2" style="font-size:12px">Use your browser's print dialog (Ctrl/Cmd + P) to save as PDF.</p>`;
    card.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => window.print(), 350);
  });

  content.querySelector('#csvBtn').addEventListener('click', e => {
    btnLoading(e.currentTarget, true, 'Exporting…');
    try {
      const header = 'Name,Email,College,Degree,Branch,Graduation Year,Skill Score,Applications,Internships,Placement Status,Skills\n';
      const csv = students.map(s => [
        s.name, s.email, s.college, s.degree, s.branch, s.graduationYear, s.skillScore ?? '',
        s.applicationsCount ?? 0, s.internshipCount ?? 0, s.placementStatus ?? 'Searching',
        `"${(s.technicalSkills || []).join('; ')}"`
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([header + csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${INST_NAME.replace(/\s+/g, '-')}-students.csv`;
      a.click(); URL.revokeObjectURL(a.href);
      toast('CSV exported!');
    } catch (err) { toast('Export failed. Please try again.', 'error'); }
    finally { btnLoading(e.currentTarget, false); }
  });
}
void saveInstitutionProfile; void params; void icon; void matchBadge; void statusBadge;
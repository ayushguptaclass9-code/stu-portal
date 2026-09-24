// Academician portal: dashboard, faculty profile, industry opportunities
// (faculty internships, FDPs, consultancy, research, workshops, guest lectures, mentorship).
import {
  initDashboardShell, icon, toast, openModal, btnLoading, emptyState, escapeHTML,
  formatDate, avatarHTML, chipRow, statusBadge, statCard, pageHeader, skeletonBlocks,
  tagInput, donutSVG, renderNotificationsPage, renderSettingsPage
} from './common.js';
import {
  getAcademicianProfile, saveAcademicianProfile, getAcademyOpportunities,
  applyToAcademyOpportunity, getAcademicianApplications
} from './database.js';
import { setupImageUpload } from './storage.js';
import { ensureDemoOpportunities } from './demo-data.js';

const ctx = await initDashboardShell();
if (!ctx) throw new Error('unauthenticated');
const uid = ctx.user.uid;
const content = document.getElementById('pageContent');
let AP = (await getAcademicianProfile(uid)) || { userId: uid, name: ctx.profile.name, email: ctx.profile.email, expertise: [] };
const params = new URLSearchParams(location.search);
const TYPE_LABEL = {
  'faculty-internship': 'Faculty Internship', 'fdp': 'FDP', 'training': 'Industrial Training',
  'consultancy': 'Consultancy', 'research': 'Research Project', 'workshop': 'Workshop',
  'guest-lecture': 'Guest Lecture', 'mentorship': 'Mentorship'
};
const TYPE_BADGE = { 'faculty-internship': 'badge-indigo', fdp: 'badge-purple', training: 'badge-blue', consultancy: 'badge-teal', research: 'badge-amber', workshop: 'badge-green', 'guest-lecture': 'badge-gray', mentorship: 'badge-red' };

const pages = {
  'academy-dashboard': renderDashboard,
  'academy-profile': renderProfile,
  'academy-opportunities': renderOpportunities,
  'academy-notifications': () => renderNotificationsPage(content, uid),
  'academy-settings': () => renderSettingsPage(content, ctx.user)
};
await (pages[document.body.dataset.page] || renderDashboard)();

/* ==================== DASHBOARD ==================== */
async function renderDashboard() {
  content.innerHTML = pageHeader(`Welcome, ${AP.name?.split(' ')[0] || 'Professor'} 👋`, 'Your academia–industry collaboration hub') + skeletonBlocks(3);
  const [opps, myApps] = await Promise.all([getAcademyOpportunities(), getAcademicianApplications(uid)]);
  const expertise = (AP.expertise || []).map(e => e.toLowerCase());
  const recommended = opps.filter(o => !['Applied', 'Shortlisted', 'Selected'].includes(myApps.find(a => a.opportunityId === o.id)?.status || ''))
    .map(o => ({ o, m: expertise.length ? Math.round(((o.field || '').toLowerCase().split(/[\/,&]\s*/).filter(w => expertise.some(e => w.trim().includes(e) || e.includes(w.trim()))).length / Math.max(1, (o.field || '').split(/[\/,&]\s*/).length)) * 100) : 50 }))
    .sort((a, b) => b.m - a.m).slice(0, 5);
  const shortlisted = myApps.filter(a => a.status === 'Shortlisted').length;

  content.innerHTML = pageHeader(`Welcome, ${AP.name?.split(' ')[0] || 'Professor'} 👋`, 'Discover faculty internships, FDPs, consultancy and research from partner industries') + `
    ${!AP.college ? `<div class="alert alert-info">${icon('user', 18)}<span>Complete your <a href="faculty-profile.html">faculty profile</a> for better-matched opportunities.</span></div>` : ''}
    <div class="stat-grid">
      ${statCard({ ico: 'rocket', color: 'indigo', value: opps.length, label: 'Open Opportunities' })}
      ${statCard({ ico: 'file', color: 'teal', value: myApps.length, label: 'My Requests' })}
      ${statCard({ ico: 'star', color: 'green', value: shortlisted, label: 'Shortlisted' })}
      ${statCard({ ico: 'network', color: 'amber', value: new Set(opps.map(o => o.companyId)).size, label: 'Partner Companies' })}
    </div>
    <div class="panel-grid">
      <div class="card card-pad">
        <h3 class="card-title">Recommended for your expertise ${chipRow(AP.expertise || []).slice(0, 200)}</h3>
        ${recommended.length ? recommended.map(({ o, m }) => `<div class="list-item">
          <span class="stat-icon" style="background:var(--purple-light);color:var(--purple)">${icon('rocket', 17)}</span>
          <div style="flex:1;min-width:0"><div class="li-title">${escapeHTML(o.title)}</div>
          <div class="li-sub"><span class="badge ${TYPE_BADGE[o.type] || 'badge-gray'}" style="margin-right:6px">${TYPE_LABEL[o.type] || o.type}</span>${escapeHTML(o.companyName)} · ${escapeHTML(o.duration || '')}</div></div>
          <span class="badge badge-gray">${m}% fit</span></div>`).join('')
      : '<p class="text-muted" style="font-size:13.5px">No recommendations yet — browse the opportunity pages in the sidebar.</p>'}
      </div>
      <div class="card card-pad">
        <h3 class="card-title">My recent requests</h3>
        ${myApps.slice(0, 5).map(a => `<div class="list-item">
          <div style="flex:1;min-width:0"><div class="li-title">${escapeHTML(a.opportunityTitle)}</div>
          <div class="li-sub">${escapeHTML(a.companyName)} · ${timeAgoShort(a.createdAt)}</div></div>${statusBadge(a.status)}</div>`).join('')
      || `<p class="text-muted" style="font-size:13.5px">No requests yet.</p>
          <a class="btn btn-soft btn-sm btn-block mt-1" href="fdp.html">Browse FDP programs</a>`}
      </div>
    </div>`;

  function timeAgoShort(ts) {
    const d = ts?.toDate?.() || (ts?.seconds ? new Date(ts.seconds * 1000) : null);
    return d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
  }
}

/* ==================== FACULTY PROFILE ==================== */
function renderProfile() {
  content.innerHTML = pageHeader('Faculty Profile', 'Shown to industries when you request collaboration') + `
    <div class="grid-2"><div class="card card-pad">
      <div class="profile-upload">
        <span class="avatar avatar-xl avatar-hover" id="apImgPrev" data-existing="${escapeHTML(ctx.profile.profileImage || '')}" style="position:relative;cursor:pointer">
          ${ctx.profile.profileImage ? `<img src="${escapeHTML(ctx.profile.profileImage)}">` : escapeHTML((AP.name || '?').slice(0, 2).toUpperCase())}</span>
        <div><strong style="font-size:14.5px">Profile photo</strong><p class="text-muted" style="font-size:12.5px">JPG/PNG, max 5MB (ImgBB)</p>
          <input type="file" id="apImg" accept="image/*" class="hidden"></div></div>
      <div class="form-row">
        <div class="form-group"><label>Full name</label><input class="input" id="apName" value="${escapeHTML(AP.name || '')}"></div>
        <div class="form-group"><label>Designation</label><input class="input" id="apDesig" value="${escapeHTML(AP.designation || '')}" placeholder="Associate Professor"></div></div>
      <div class="form-row">
        <div class="form-group"><label>Department</label><input class="input" id="apDept" value="${escapeHTML(AP.department || '')}" placeholder="Computer Science"></div>
        <div class="form-group"><label>Experience (years)</label><input class="input" id="apExp" type="number" min="0" value="${escapeHTML(AP.experience || '')}"></div></div>
      <div class="form-row">
        <div class="form-group"><label>College / University</label><input class="input" id="apCollege" value="${escapeHTML(AP.college || '')}"></div>
        <div class="form-group"><label>Phone</label><input class="input" id="apPhone" value="${escapeHTML(AP.phone || '')}"></div></div>
      <div class="form-group"><label>Email</label><input class="input" value="${escapeHTML(AP.email || ctx.profile.email)}" disabled></div>
      <div class="form-group"><label>About</label><textarea class="textarea" id="apAbout">${escapeHTML(AP.about || '')}</textarea></div>
      <button class="btn btn-primary" id="apSave">${icon('check', 16)} Save profile</button>
    </div>
    <div class="card card-pad"><h3 class="card-title">Areas of expertise</h3><div id="tagsExp"></div>
      <p class="form-hint">Used to recommend FDPs, consultancy and research projects.</p></div></div>`;

  const tExp = tagInput(content.querySelector('#tagsExp'), { placeholder: 'e.g. Machine Learning', suggestions: ['Machine Learning', 'Data Science', 'Cloud Computing', 'IoT', 'Cybersecurity', 'VLSI', 'Robotics', 'Blockchain', 'Software Engineering'] });
  tExp.set(AP.expertise);
  setupImageUpload({ inputEl: content.querySelector('#apImg'), previewEl: content.querySelector('#apImgPrev') });

  content.querySelector('#apSave').addEventListener('click', async e => {
    const btn = e.currentTarget;
    btnLoading(btn, true, 'Saving…');
    try {
      const g = id => content.querySelector('#' + id).value.trim();
      const data = { userId: uid, email: AP.email || ctx.profile.email, name: g('apName'), designation: g('apDesig'), department: g('apDept'), experience: g('apExp'), college: g('apCollege'), phone: g('apPhone'), about: g('apAbout'), expertise: tExp.get(), profileImage: content.querySelector('#apImgPrev img')?.src || '' };
      if (!data.name) throw new Error('Name is required.');
      await saveAcademicianProfile(uid, data);
      await (await import('./database.js')).setDocument('users', uid, { name: data.name, profileImage: data.profileImage }, { timestamps: false });
      AP = { ...AP, ...data };
      toast('Faculty profile saved!');
    } catch (err) { toast(err.message, 'error'); }
    finally { btnLoading(btn, false); }
  });
}

/* ==================== OPPORTUNITY BROWSER (shared) ==================== */
async function renderOpportunities() {
  const optype = document.body.dataset.optype || params.get('type') || '';
  const label = optype ? TYPE_LABEL[optype] || 'Opportunities' : 'Industry Opportunities';
  const covered = optype ? null : ['faculty-internship', 'training', 'workshop', 'guest-lecture', 'mentorship'];

  content.innerHTML = pageHeader(label, 'Opportunities posted by partner industries for faculty') + `
    <div class="tabs">
      <button class="tab-btn active" data-t="browse">Available</button>
      <button class="tab-btn" data-t="mine">My Requests</button>
    </div><div id="aoBody">${skeletonBlocks(4)}</div>`;

  const body = content.querySelector('#aoBody');
  const [opps, myApps] = await Promise.all([getAcademyOpportunities(), getAcademicianApplications(uid)]);
  const appliedIds = new Set(myApps.map(a => a.opportunityId));

  content.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => {
    content.querySelectorAll('[data-t]').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); b.dataset.t === 'mine' ? paintMine() : paintBrowse();
  }));

  if (!opps.length) {
    body.innerHTML = emptyState({ ico: 'rocket', title: 'No opportunities posted yet', text: 'Industries publish faculty programs here. Load a sample dataset to explore.', actionLabel: 'Load sample opportunities', actionId: 'loadDemo' });
    body.querySelector('#loadDemo')?.addEventListener('click', async e => {
    const btn = e.currentTarget;
      btnLoading(btn, true, 'Loading…');
      try { await ensureDemoOpportunities(); toast('Sample data loaded!'); renderOpportunities(); }
      catch (err) { toast(err.message, 'error'); btnLoading(btn, false); }
    });
    return;
  }

  const rows = opps.filter(o => optype ? o.type === optype : covered.includes(o.type));

  function paintBrowse() {
    body.innerHTML = rows.length ? `<div class="opp-grid">${rows.map(o => `<div class="opp-card">
      <div class="flex-between"><span class="badge ${TYPE_BADGE[o.type] || 'badge-gray'}">${TYPE_LABEL[o.type] || o.type}</span>
        <span class="text-muted" style="font-size:12px">${o.deadline ? 'by ' + escapeHTML(o.deadline) : ''}</span></div>
      <div><div class="opp-title">${escapeHTML(o.title)}</div><div class="opp-company">${escapeHTML(o.companyName)}</div></div>
      <p class="text-muted" style="font-size:13px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escapeHTML(o.description || '')}</p>
      <div class="opp-meta"><span>${icon('clock', 14)}${escapeHTML(o.duration || '—')}</span><span>${icon('globe', 14)}${escapeHTML(o.mode || '—')}</span><span>${icon('coins', 14)}${escapeHTML(o.honorarium || '—')}</span></div>
      <div class="opp-foot" style="border-top:1px solid var(--border);padding-top:10px">
        ${appliedIds.has(o.id) ? `<button class="btn btn-soft btn-sm btn-block" disabled>✓ Request sent</button>`
        : `<button class="btn btn-primary btn-sm btn-block" data-req="${o.id}">Request participation</button>`}
      </div></div>`).join('')}</div>` : emptyState({ ico: 'search', title: 'Nothing here yet', text: 'Check the other opportunity categories in the sidebar.' });

    body.querySelectorAll('[data-req]').forEach(b => b.addEventListener('click', () => {
      const o = opps.find(x => x.id === b.dataset.req);
      const { el, close } = openModal({
        title: 'Request participation',
        body: `<p style="font-size:14px;margin-bottom:14px"><strong>${escapeHTML(o.title)}</strong> — ${escapeHTML(o.companyName)}</p>
          <div class="form-group"><label>Your designation</label><input class="input" id="rDesig" value="${escapeHTML(AP.designation || '')}"></div>
          <div class="form-group"><label>College</label><input class="input" id="rCollege" value="${escapeHTML(AP.college || '')}"></div>
          <div class="form-group"><label>Message to the company</label><textarea class="textarea" id="rMsg" style="min-height:80px" placeholder="Briefly describe your interest and relevant background…"></textarea></div>`,
        footer: `<button class="btn btn-outline" data-x>Cancel</button><button class="btn btn-primary" data-go>Send request</button>`
      });
      el.querySelector('[data-x]').onclick = close;
      el.querySelector('[data-go]').addEventListener('click', async ev => {
    const btn = ev.currentTarget;
        btnLoading(btn, true, 'Sending…');
        try {
          AP.designation = el.querySelector('#rDesig').value.trim();
          AP.college = el.querySelector('#rCollege').value.trim();
          await applyToAcademyOpportunity({ academician: AP, opp: o, message: el.querySelector('#rMsg').value.trim() });
          appliedIds.add(o.id); close(); toast('Request sent! The company will respond soon.'); paintBrowse();
        } catch (err) { toast(err.message, 'error'); btnLoading(btn, false); }
      });
    }));
  }

  function paintMine() {
    const mine = myApps.filter(a => !optype || a.type === optype || (covered && covered.includes(a.type)));
    body.innerHTML = mine.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Opportunity</th><th>Company</th><th>Type</th><th>Requested</th><th>Status</th></tr></thead>
      <tbody>${mine.map(a => `<tr><td><strong>${escapeHTML(a.opportunityTitle)}</strong></td><td>${escapeHTML(a.companyName)}</td>
        <td>${TYPE_LABEL[a.type] || a.type}</td><td>${formatDate(a.createdAt)}</td><td>${statusBadge(a.status)}</td></tr>`).join('')}</tbody></table></div>`
      : emptyState({ ico: 'file', title: 'No requests yet', text: 'Browse available opportunities and request participation.', actionLabel: 'Browse opportunities', actionId: 'goB' });
    body.querySelector('#goB')?.addEventListener('click', () => content.querySelectorAll('[data-t]')[0].click());
  }

  paintBrowse();
}
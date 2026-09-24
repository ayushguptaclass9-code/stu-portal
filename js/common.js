// Shared dashboard shell (sidebar/topbar/notifications), UI utilities and charts.
// Every dashboard page boots through initDashboardShell().
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  logoutUser, deleteCurrentUser, resetPassword, ROLE_HOME
} from './auth.js';
import * as api from './database.js';

export const APP_BASE = document.body.dataset.base || '';

/* ============ Icons (inline SVG — no icon library needed) ============ */
const P = (d, extra = '') => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const ICONS = {
  home: P('<path d="M3 11.5 12 4l9 7.5"/><path d="M6 10v10h12V10"/>'),
  user: P('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5"/>'),
  target: P('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>'),
  chart: P('<path d="M4 19h16"/><path d="M7 16v-5M12 16V6M17 16v-8"/>'),
  briefcase: P('<rect x="4" y="8" width="16" height="11" rx="2"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/><path d="M4 13h16"/>'),
  building: P('<rect x="5" y="4" width="14" height="16" rx="1"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10 20v-4h4v4"/>'),
  book: P('<path d="M5 5a2 2 0 0 1 2-2h12v16H7a2 2 0 0 0-2 2z"/><path d="M5 19a2 2 0 0 1 2-2h12"/>'),
  file: P('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/>'),
  award: P('<circle cx="12" cy="9" r="5"/><path d="M9 13.5 7.5 21l4.5-2.5L16.5 21 15 13.5"/>'),
  star: P('<path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8z"/>'),
  bell: P('<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10.5 19a1.8 1.8 0 0 0 3 0"/>'),
  gear: P('<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M4.6 5.6l1.8 1.8M17.6 16.6l1.8 1.8M3 12h2.5M18.5 12H21M4.6 18.4l1.8-1.8M17.6 7.4l1.8-1.8"/>'),
  logout: P('<path d="M9 4H5v16h4"/><path d="m14 8 4 4-4 4M18 12H9"/>'),
  x: P('<path d="M6 6l12 12M18 6 6 18"/>'),
  check: P('<path d="m5 13 4 4L19 7"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>'),
  upload: P('<path d="M12 16V5M7 9l5-5 5 5"/><path d="M5 19h14"/>'),
  download: P('<path d="M12 5v11M7 12l5 5 5-5"/><path d="M5 19h14"/>'),
  search: P('<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>'),
  mail: P('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  pin: P('<path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>'),
  clock: P('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>'),
  calendar: P('<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>'),
  users: P('<circle cx="9" cy="9" r="3"/><path d="M3.5 19c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5"/><circle cx="17" cy="8" r="2.5"/><path d="M15.8 14.7c1.9.5 3.3 1.9 4.2 4.3"/>'),
  eye: P('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
  edit: P('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>'),
  trash: P('<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>'),
  link: P('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"/>'),
  chevron: P('<path d="m6 9 6 6 6-6"/>'),
  menu: P('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  globe: P('<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c-5 5.3-5 10.7 0 16 5-5.3 5-10.7 0-16z"/>'),
  cert: P('<circle cx="12" cy="10" r="5"/><path d="M10 14.5 9 21l3-1.7L15 21l-1-6.5"/>'),
  rocket: P('<path d="M12 3c3.5 1.5 5.5 4.5 5.5 8.5L14 15h-4l-3.5-3.5C6.5 7.5 8.5 4.5 12 3z"/><circle cx="12" cy="9" r="1.6"/><path d="m8 15-2 4 3.5-1M16 15l2 4-3.5-1"/>'),
  grad: P('<path d="m2 9 10-4 10 4-10 4z"/><path d="M6 11.2V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.8"/>'),
  network: P('<circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="6" r="2.2"/><circle cx="12" cy="18" r="2.2"/><path d="M7.5 7.8 10.9 16M16.5 7.8 13.1 16M8.2 6h7.6"/>'),
  coins: P('<circle cx="12" cy="12" r="8"/><path d="M12 7v10M14.8 8.8c-.9-1-5.3-1.3-5.3.8 0 2.3 5.3 1.2 5.3 3.5 0 1.9-3.9 2-5.4.7"/>'),
  layers: P('<path d="m12 3 9 5-9 5-9-5z"/><path d="m5.5 11.5-2.5 1.5 9 5 9-5-2.5-1.5"/>'),
  send: P('<path d="M21 3 3 10.5l7 2.5 2.5 7z"/><path d="M21 3 10 13"/>'),
  box: P('<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>'),
  bookmark: P('<path d="M7 4h10v17l-5-3.5L7 21z"/>'),
  dollar: P('<path d="M12 3v18M16.5 7.5c-1-1.5-8-2-8 1.5s8 1.5 8 5c0 3.5-7 3-8 1.5"/>')
};
export const icon = (name, size = 18) => ICONS[name] || ICONS.box;

export const LOGO_SVG = `<svg viewBox="0 0 32 32" class="logo-mark" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#4f46e5"/><path d="M8 13l8-4 8 4-8 4z" fill="#fff"/><path d="M12 16v4c0 1.6 2 2.8 4 2.8s4-1.2 4-2.8v-4" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`;

/* ============ Utilities ============ */
export function escapeHTML(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function toDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  const d = new Date(ts);
  return isNaN(d) ? null : d;
}
export function formatDate(ts) {
  const d = toDate(ts);
  return d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}
export function timeAgo(ts) {
  const d = toDate(ts); if (!d) return '';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24); if (dd < 30) return `${dd}d ago`;
  return formatDate(ts);
}
export function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}
export function initials(name = '?') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';
}
export function avatarHTML(name, url, cls = 'avatar avatar-sm') {
  return url
    ? `<span class="${cls}"><img src="${escapeHTML(url)}" alt="" referrerpolicy="no-referrer"></span>`
    : `<span class="${cls}">${escapeHTML(initials(name))}</span>`;
}
export function debounce(fn, ms = 200) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
export function isClosed(opp) { return opp.status === 'Closed' || daysUntil(opp.deadline) < 0; }

export function toast(message, type = 'success') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span class="toast-icon">${icon(type === 'success' ? 'check' : type === 'error' ? 'x' : 'bell', 17)}</span><span>${escapeHTML(message)}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 4000);
}

export function openModal({ title, body, footer = '', size = '' }) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-overlay">
      <div class="modal ${size}" role="dialog" aria-modal="true">
        <div class="modal-header"><h3>${escapeHTML(title)}</h3>
          <button class="modal-close" aria-label="Close">${icon('x', 17)}</button></div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    </div>`;
  const close = () => { root.innerHTML = ''; };
  root.querySelector('.modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) close(); });
  root.querySelector('.modal-close').addEventListener('click', close);
  return { close, el: root };
}
export function confirmDialog(message, { title = 'Are you sure?', okText = 'Confirm', danger = true } = {}) {
  return new Promise(resolve => {
    const { close, el } = openModal({
      title,
      body: `<p style="font-size:14px;color:var(--text-2)">${escapeHTML(message)}</p>`,
      footer: `<button class="btn btn-outline" data-act="no">Cancel</button>
               <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="yes">${escapeHTML(okText)}</button>`
    });
    el.querySelector('[data-act="no"]').onclick = () => { close(); resolve(false); };
    el.querySelector('[data-act="yes"]').onclick = () => { close(); resolve(true); };
  });
}
export function btnLoading(btn, on, loadingText = 'Please wait…') {
  if (on) {
    btn.dataset.orig = btn.innerHTML; btn.disabled = true;
    btn.innerHTML = `<span class="spinner spinner-sm"></span> ${escapeHTML(loadingText)}`;
  } else { btn.disabled = false; if (btn.dataset.orig) btn.innerHTML = btn.dataset.orig; }
}

/* ============ Small HTML builders ============ */
export const chipRow = (arr, cls = '') => (arr || []).map(s => `<span class="chip ${cls}">${escapeHTML(s)}</span>`).join('') || '<span class="text-muted" style="font-size:13px">—</span>';
export function statusBadge(status) {
  const map = {
    'Applied': 'badge-gray', 'Under Review': 'badge-amber', 'Shortlisted': 'badge-blue',
    'Interview': 'badge-purple', 'Selected': 'badge-green', 'Rejected': 'badge-red',
    'Completed': 'badge-teal', 'Open': 'badge-green', 'Closed': 'badge-red',
    'In Progress': 'badge-amber', 'Pending': 'badge-amber', 'Accepted': 'badge-green', 'Declined': 'badge-red'
  };
  return `<span class="badge ${map[status] || 'badge-gray'}">${escapeHTML(status)}</span>`;
}
export function matchBadge(pct) {
  const cls = pct >= 70 ? '' : pct >= 40 ? 'mid' : 'low';
  return `<span class="badge match-badge ${cls}">${pct}% match</span>`;
}
export function statCard({ ico, color = 'indigo', value, label, sub = '' }) {
  const bg = { indigo: 'var(--primary-light);color:var(--primary)', green: 'var(--success-light);color:var(--success)', amber: 'var(--warning-light);color:var(--warning)', teal: 'var(--secondary-light);color:var(--secondary)', red: 'var(--danger-light);color:var(--danger)', blue: 'var(--info-light);color:var(--info)' }[color];
  return `<div class="stat-card">
    <span class="stat-icon" style="background:${bg}">${icon(ico, 20)}</span>
    <div><div class="v">${escapeHTML(String(value))}</div><div class="l">${escapeHTML(label)}</div>${sub ? `<div class="s">${escapeHTML(sub)}</div>` : ''}</div>
  </div>`;
}
export function pageHeader(title, subtitle, actionsHTML = '') {
  return `<div class="page-header flex-between"><div><h2>${escapeHTML(title)}</h2><p>${escapeHTML(subtitle || '')}</p></div><div class="flex">${actionsHTML}</div></div>`;
}
export function emptyState({ ico = 'box', title, text, actionLabel = '', actionId = '' }) {
  return `<div class="empty-state">
    <div class="es-icon">${icon(ico, 28)}</div>
    <h4>${escapeHTML(title)}</h4><p>${escapeHTML(text)}</p>
    ${actionLabel ? `<button class="btn btn-primary" id="${actionId}">${escapeHTML(actionLabel)}</button>` : ''}
  </div>`;
}
export function skeletonBlocks(n = 3) {
  return `<div class="opp-grid">${Array(n).fill('<div class="sk" style="height:210px"></div>').join('')}</div>`;
}

/* ============ Charts (pure SVG/CSS — no libraries) ============ */
export function barChartSVG(items, { height = 200, color = 'var(--primary)', suffix = '' } = {}) {
  const max = Math.max(...items.map(i => i.value), 1);
  const bw = 44, gap = 28, padL = 10, padB = 32, padT = 24;
  const width = Math.max(items.length * (bw + gap) + padL * 2, 280);
  let bars = '';
  items.forEach((it, i) => {
    const h = Math.max(5, Math.round((it.value / max) * (height - padT - padB)));
    const x = padL + i * (bw + gap), y = height - padB - h;
    bars += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="6" fill="${it.color || color}" opacity=".9"/>` +
      `<text x="${x + bw / 2}" y="${y - 7}" text-anchor="middle" class="chart-val">${it.value}${suffix}</text>` +
      `<text x="${x + bw / 2}" y="${height - 10}" text-anchor="middle" class="chart-lbl">${escapeHTML(it.label)}</text>`;
  });
  return `<div style="overflow-x:auto"><svg viewBox="0 0 ${width} ${height}" class="chart-svg" style="min-width:${Math.min(width, 560)}px">${bars}</svg></div>`;
}
export function donutSVG(percent, { color = 'var(--primary)', label = '' } = {}) {
  const size = 110, stroke = 11, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(Math.max(percent, 0), 100) / 100);
  return `<div class="donut-wrap"><svg viewBox="0 0 ${size} ${size}" class="donut-svg">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" class="donut-text">${Math.round(percent)}%</text>
  </svg>${label ? `<span class="donut-label">${escapeHTML(label)}</span>` : ''}</div>`;
}
export function barList(items, { color = 'var(--primary)' } = {}) {
  const max = Math.max(...items.map(i => i.value), 1);
  return `<div class="bar-list">${items.map(it => `
    <div class="bar-row"><span class="bar-label" title="${escapeHTML(it.label)}">${escapeHTML(it.label)}</span>
    <span class="bar-track"><span class="bar-fill" style="width:${Math.round((it.value / max) * 100)}%;background:${it.color || color}"></span></span>
    <span class="bar-value">${escapeHTML(String(it.display ?? it.value))}</span></div>`).join('')}</div>`;
}
export function progressRow(label, percent, cls = '') {
  return `<div style="margin-bottom:13px">
    <div class="flex-between" style="margin-bottom:5px"><span style="font-size:13px;font-weight:600">${escapeHTML(label)}</span><span style="font-size:12.5px;color:var(--text-2);font-weight:700">${Math.round(percent)}%</span></div>
    <div class="progress-track"><span class="progress-fill ${cls}" style="width:${Math.min(percent, 100)}%"></span></div></div>`;
}

/* ============ Tag input ============ */
export function tagInput(container, { placeholder = 'Type and press Enter', suggestions = [] } = {}) {
  container.classList.add('tag-input');
  container.innerHTML = `<div class="tag-list"></div><input type="text" placeholder="${escapeHTML(placeholder)}">`;
  const list = container.querySelector('.tag-list'), input = container.querySelector('input');
  let tags = [];
  const render = () => {
    list.innerHTML = tags.map((t, i) =>
      `<span class="tag">${escapeHTML(t)}<button type="button" class="tag-x" data-i="${i}" aria-label="Remove">&times;</button></span>`).join('');
  };
  list.addEventListener('click', e => {
    const b = e.target.closest('.tag-x');
    if (b) { tags.splice(+b.dataset.i, 1); render(); }
  });
  const add = v => {
    v = (v || '').trim().replace(/,+$/, '');
    if (v && !tags.some(t => t.toLowerCase() === v.toLowerCase())) { tags.push(v); render(); }
    input.value = '';
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input.value); }
    if (e.key === 'Backspace' && !input.value && tags.length) { tags.pop(); render(); }
  });
  input.addEventListener('blur', () => add(input.value));
  container.addEventListener('click', e => { if (e.target === container) input.focus(); });
  if (suggestions.length) {
    const sug = document.createElement('div');
    sug.className = 'tag-suggestions no-print';
    sug.innerHTML = suggestions.map(s => `<button type="button" class="tag-sugg">+ ${escapeHTML(s)}</button>`).join('');
    sug.addEventListener('click', e => {
      const b = e.target.closest('.tag-sugg');
      if (b) add(b.textContent.slice(2));
    });
    container.after(sug);
  }
  return { get: () => [...tags], set: arr => { tags = [...(arr || [])]; render(); } };
}

/* ============ Sidebar configs ============ */
const NAV = {
  student: [
    ['Main', [
      ['Dashboard', 'home', 'dashboard.html', 'student-dashboard'],
      ['My Profile', 'user', 'profile.html', 'student-profile'],
      ['Skill Assessment', 'target', 'skills.html?tab=assessment', 'student-skills'],
      ['Skill Profile', 'chart', 'skills.html?tab=profile', 'student-skills'],
    ]],
    ['Opportunities', [
      ['Internships', 'briefcase', 'internships.html', 'student-internships'],
      ['Jobs', 'building', 'jobs.html', 'student-jobs'],
      ['Learning Programs', 'book', 'learning.html', 'student-learning'],
      ['Applications', 'file', 'applications.html', 'student-applications'],
    ]],
    ['Growth', [
      ['My Portfolio', 'award', 'portfolio.html', 'student-portfolio'],
      ['Notifications', 'bell', 'notifications.html', 'student-notifications'],
      ['Settings', 'gear', 'settings.html', 'student-settings'],
    ]]
  ],
  academician: [
    ['Main', [
      ['Dashboard', 'home', 'dashboard.html', 'academy-dashboard'],
      ['My Profile', 'user', 'faculty-profile.html', 'academy-profile'],
    ]],
    ['Opportunities', [
      ['Faculty Internships', 'briefcase', 'internships.html?type=faculty-internship', 'academy-opportunities'],
      ['Industrial Training', 'layers', 'internships.html?type=training', 'academy-opportunities'],
      ['FDP Programs', 'grad', 'fdp.html', 'academy-opportunities'],
      ['Consultancy', 'coins', 'consultancy.html', 'academy-opportunities'],
      ['Research Projects', 'rocket', 'research.html', 'academy-opportunities'],
      ['Workshops', 'users', 'internships.html?type=workshop', 'academy-opportunities'],
      ['Guest Lectures', 'mail', 'internships.html?type=guest-lecture', 'academy-opportunities'],
      ['Mentorship', 'network', 'internships.html?type=mentorship', 'academy-opportunities'],
    ]],
    ['Account', [
      ['Notifications', 'bell', 'notifications.html', 'academy-notifications'],
      ['Settings', 'gear', 'settings.html', 'academy-settings'],
    ]]
  ],
  industry: [
    ['Main', [
      ['Dashboard', 'home', 'dashboard.html', 'industry-dashboard'],
      ['Company Profile', 'building', 'company-profile.html', 'industry-company-profile'],
    ]],
    ['Hiring', [
      ['Post Internship', 'plus', 'post-internship.html', 'industry-post-internship'],
      ['Post Job', 'plus', 'post-job.html', 'industry-post-job'],
      ['Applicants', 'users', 'applicants.html', 'industry-applicants'],
    ]],
    ['Programs', [
      ['Training Programs', 'book', 'training.html?type=training', 'industry-training'],
      ['Certifications', 'cert', 'training.html?type=certification', 'industry-training'],
      ['Workshops', 'users', 'training.html?type=workshop', 'industry-training'],
      ['Mentorship', 'network', 'training.html?type=mentorship', 'industry-training'],
      ['Live Projects', 'layers', 'training.html?type=project', 'industry-training'],
    ]],
    ['Collaboration', [
      ['Collaborations', 'network', 'collaborations.html', 'industry-collaborations'],
      ['Analytics', 'chart', 'analytics.html', 'industry-analytics'],
      ['Notifications', 'bell', 'notifications.html', 'industry-notifications'],
      ['Settings', 'gear', 'settings.html', 'industry-settings'],
    ]]
  ],
  institution: [
    ['Main', [
      ['Dashboard', 'home', 'dashboard.html', 'inst-dashboard'],
      ['Students', 'users', 'students.html', 'inst-students'],
      ['Analytics', 'chart', 'analytics.html', 'inst-analytics'],
      ['Reports', 'file', 'reports.html', 'inst-reports'],
      ['Notifications', 'bell', 'notifications.html', 'inst-notifications'],
      ['Settings', 'gear', 'settings.html', 'inst-settings'],
    ]]
  ]
};
const PROFILE_PAGE = { student: 'profile.html', academician: 'faculty-profile.html', industry: 'company-profile.html', institution: '' };

/* ============ Dashboard shell ============ */
function shellErrorScreen(title, detail) {
  const loader = document.getElementById('app-loader');
  if (!loader) return;
  loader.innerHTML = `
    <div class="card card-pad" style="max-width:480px;text-align:center">
      <div style="font-size:34px">⚠️</div>
      <h3 style="margin:10px 0 6px;font-size:18px">${escapeHTML(title)}</h3>
      <p class="text-muted" style="font-size:13.5px;margin-bottom:16px">${escapeHTML(detail)}</p>
      <div class="flex" style="justify-content:center">
        <button class="btn btn-primary" onclick="location.reload()">Retry</button>
        <button class="btn btn-outline" id="errLogout">Logout</button>
      </div>
    </div>`;
  loader.querySelector('#errLogout').addEventListener('click', async () => {
    try { await logoutUser(); } catch (_) {}
    location.href = APP_BASE + 'login.html';
  });
}

export async function initDashboardShell() {
  const role = document.body.dataset.role;
  const page = document.body.dataset.page;

  const user = await new Promise(res => { const u = onAuthStateChanged(auth, x => { u(); res(x); }); });
  if (!user) { location.href = APP_BASE + 'login.html'; return null; }

  let profile;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) { await logoutUser(); location.href = APP_BASE + 'login.html'; return null; }
    profile = snap.data();
  } catch (err) {
    console.error('[initDashboardShell] users/{uid} read failed:', err);
    const denied = String(err?.code || '').includes('permission-denied');
    shellErrorScreen(
      'Could not load your dashboard',
      denied
        ? 'Firestore security rules are blocking access. Open Firebase Console → Firestore Database → Rules, publish the rules from firestore.rules, then press Retry.'
        : 'We could not reach the database. Check your internet connection, confirm Firestore is created in the Firebase Console, then press Retry.'
    );
    return null;
  }

  if (profile.role !== role) { location.href = APP_BASE + (ROLE_HOME[profile.role] || 'login.html'); return null; }

  buildSidebar(role);
  buildTopbar(profile, role);
  document.getElementById('app-loader').remove();
  document.getElementById('dashboard-shell').hidden = false;
  void page;
  return { user, profile, role, page };
}

function buildSidebar(role) {
  const sb = document.getElementById('sidebar');
  sb.innerHTML = `
    <div class="sidebar-head"><a href="${APP_BASE}index.html" class="logo">${LOGO_SVG}<span>AcademiaConnect</span></a></div>
    <nav class="sidebar-nav">${NAV[role].map(([label, items]) => `
      <div class="side-label">${label}</div>
      ${items.map(([text, ico, href]) => `
        <a class="side-link" data-href="${href}" href="${href}">${icon(ico, 17)}<span>${text}</span></a>`).join('')}
    `).join('')}</nav>
    <div class="sidebar-foot"><button class="btn btn-outline btn-block" id="sidebarLogout">${icon('logout', 16)} Logout</button></div>`;

  // Active state: exact file+query match first, then file-only fallback.
  const file = location.pathname.split('/').pop();
  const here = file + location.search;
  const links = [...sb.querySelectorAll('.side-link')];
  let active = links.find(a => a.dataset.href === here)
    || links.find(a => a.dataset.href.split('?')[0] === file && !a.dataset.href.includes('?'));
  if (!active && !location.search) active = links.find(a => a.dataset.href === file);
  active?.classList.add('active');

  sb.querySelector('#sidebarLogout').addEventListener('click', doLogout);

  const backdrop = document.getElementById('sidebarBackdrop');
  const open = v => {
    sb.classList.toggle('open', v);
    backdrop.classList.toggle('show', v);
  };
  document.getElementById('hamburgerBtn')?.addEventListener('click', () => open(!sb.classList.contains('open')));
  backdrop.addEventListener('click', () => open(false));
  sb.addEventListener('click', e => { if (e.target.closest('.side-link')) open(false); });
}

async function doLogout() {
  try { await logoutUser(); location.href = APP_BASE + 'index.html'; }
  catch { toast('Could not log out. Please try again.', 'error'); }
}

function buildTopbar(profile, role) {
  const file = location.pathname.split('/').pop() + location.search;
  let title = 'Dashboard';
  for (const [, items] of NAV[role]) {
    const hit = items.find(([,, href]) => href === file) || items.find(([, , href]) => href.split('?')[0] === location.pathname.split('/').pop());
    if (hit) { title = hit[0]; break; }
  }
  const tb = document.getElementById('topbar');
  tb.innerHTML = `
    <div class="flex">
      <button class="icon-btn hamburger-btn" id="hamburgerBtn" aria-label="Menu">${icon('menu', 20)}</button>
      <span class="topbar-title">${escapeHTML(title)}</span>
    </div>
    <div class="topbar-right">
      <div class="dd-wrap">
        <button class="icon-btn" id="notifBtn" aria-label="Notifications">${icon('bell', 19)}<span class="notif-badge" id="notifCount" hidden></span></button>
        <div class="dropdown notif-dropdown" id="notifDropdown" hidden>
          <div class="dropdown-head">Notifications <button id="markAllRead">Mark all read</button></div>
          <div class="dropdown-list" id="notifList"><div class="dd-empty">Loading…</div></div>
          <a class="dropdown-foot" href="notifications.html">View all notifications</a>
        </div>
      </div>
      <div class="dd-wrap">
        <button class="user-chip" id="userBtn">
          ${avatarHTML(profile.name, profile.profileImage)}
          <span class="user-name">${escapeHTML(profile.name)}</span>${icon('chevron', 15)}
        </button>
        <div class="dropdown" id="userDropdown" hidden>
          <div style="padding:13px 16px;border-bottom:1px solid var(--border)">
            <div style="font-weight:700;font-size:14px">${escapeHTML(profile.name)}</div>
            <div class="text-muted" style="font-size:12.5px">${escapeHTML(profile.email)}</div>
            <span class="badge badge-indigo mt-1" style="text-transform:capitalize">${escapeHTML(profile.role)}</span>
          </div>
          ${PROFILE_PAGE[role] ? `<a class="dd-item" href="${PROFILE_PAGE[role]}"><span class="dd-ico">${icon('user', 15)}</span>My Profile</a>` : ''}
          <a class="dd-item" href="settings.html"><span class="dd-ico">${icon('gear', 15)}</span>Settings</a>
          <div class="dd-item" id="topLogout" style="color:var(--danger)"><span class="dd-ico" style="color:var(--danger)">${icon('logout', 15)}</span>Logout</div>
        </div>
      </div>
    </div>`;

  const notifDD = tb.querySelector('#notifDropdown'), userDD = tb.querySelector('#userDropdown');
  tb.querySelector('#notifBtn').addEventListener('click', async e => {
    e.stopPropagation();
    userDD.hidden = true;
    notifDD.hidden = !notifDD.hidden;
    if (!notifDD.hidden) await loadNotifDropdown(profile);
  });
  tb.querySelector('#userBtn').addEventListener('click', e => { e.stopPropagation(); notifDD.hidden = true; userDD.hidden = !userDD.hidden; });
  document.addEventListener('click', () => { notifDD.hidden = true; userDD.hidden = true; });
  tb.querySelector('#topLogout').addEventListener('click', doLogout);
  tb.querySelector('#markAllRead').addEventListener('click', async () => {
    await api.markAllNotificationsRead(profile.uid || auth.currentUser.uid);
    await loadNotifDropdown(profile);
  });
}

async function loadNotifDropdown(profile) {
  const uid = profile.uid || auth.currentUser.uid;
  const list = document.getElementById('notifList');
  const count = document.getElementById('notifCount');
  try {
    const rows = (await api.getNotifications(uid)).slice(0, 7);
    const unread = rows.filter(n => !n.read).length;
    count.hidden = unread === 0;
    count.textContent = unread > 9 ? '9+' : unread;
    list.innerHTML = rows.length
      ? rows.map(n => `<div class="dd-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
          <span class="dd-ico">${icon(n.type === 'application' ? 'file' : n.type === 'collab' ? 'network' : n.type === 'success' ? 'check' : n.type === 'warning' ? 'bell' : 'bell', 15)}</span>
          <div><p>${escapeHTML(n.title)}</p><span>${escapeHTML(n.message)}</span><br><span class="text-muted" style="font-size:11px">${timeAgo(n.createdAt)}</span></div>
        </div>`).join('')
      : '<div class="dd-empty">No notifications yet</div>';
    list.querySelectorAll('.dd-item').forEach(item => item.addEventListener('click', async () => {
      await api.markNotificationRead(item.dataset.id);
      await loadNotifDropdown(profile);
    }));
  } catch { list.innerHTML = '<div class="dd-empty">Could not load notifications</div>'; }
}

/* ============ Shared pages: Notifications & Settings (all roles) ============ */
export async function renderNotificationsPage(container, uid) {
  container.innerHTML = pageHeader('Notifications', 'Updates about your applications, opportunities and collaboration requests') +
    `<div class="card" id="notifBox"><div class="card-pad">${'<div class="sk" style="height:52px;margin-bottom:10px"></div>'.repeat(4)}</div></div>`;
  const rows = await api.getNotifications(uid);
  const box = container.querySelector('#notifBox');
  if (!rows.length) {
    box.innerHTML = emptyState({ ico: 'bell', title: 'No notifications', text: 'You are all caught up! Notifications about applications and opportunities will appear here.' });
    return;
  }
  const icoFor = t => t === 'application' ? 'file' : t === 'collab' ? 'network' : t === 'success' ? 'check' : t === 'warning' ? 'bell' : 'bell';
  box.innerHTML = `<div class="flex-between card-title" style="padding:18px 20px 0">All notifications
      <button class="btn btn-ghost btn-sm" id="pgMarkAll">Mark all as read</button></div>` +
    rows.map(n => `<div class="notif-row ${n.read ? '' : 'unread'}" data-id="${n.id}">
      <span class="notif-ico">${icon(icoFor(n.type), 17)}</span>
      <div style="flex:1"><strong style="font-size:14px">${escapeHTML(n.title)}</strong>
        <div class="text-muted" style="font-size:13px">${escapeHTML(n.message)}</div>
        <span class="text-muted" style="font-size:11.5px">${timeAgo(n.createdAt)}</span></div>
      ${!n.read ? '<span class="badge badge-indigo">New</span>' : ''}
    </div>`).join('');
  box.querySelector('#pgMarkAll').addEventListener('click', async () => {
    await api.markAllNotificationsRead(uid); renderNotificationsPage(container, uid); toast('All notifications marked as read');
  });
  box.querySelectorAll('.notif-row.unread').forEach(r => r.addEventListener('click', async () => {
    await api.markNotificationRead(r.dataset.id); r.classList.remove('unread');
  }));
}

export async function renderSettingsPage(container, user) {
  container.innerHTML = pageHeader('Settings', 'Manage your account preferences') + `
  <div class="grid-2">
    <div class="card card-pad">
      <h3 class="card-title">Account</h3>
      <div class="form-group"><label>Display name</label><input class="input" id="setName" value="${escapeHTML(user.displayName || '')}"></div>
      <div class="form-group"><label>Email</label><input class="input" value="${escapeHTML(user.email)}" disabled></div>
      <button class="btn btn-primary" id="saveName">Save changes</button>
    </div>
    <div class="card card-pad">
      <h3 class="card-title">Security</h3>
      <p class="text-muted" style="font-size:13.5px;margin-bottom:14px">We'll email you a secure link to change your password.</p>
      <button class="btn btn-outline" id="sendReset">${icon('mail', 16)} Send password reset email</button>
      <hr style="border:none;border-top:1px solid var(--border);margin:20px 0">
      <h3 class="card-title">Session</h3>
      <p class="text-muted" style="font-size:13.5px;margin-bottom:14px">Sign out of your account on this device.</p>
      <button class="btn btn-outline" id="settingsLogout">${icon('logout', 16)} Logout</button>
      <hr style="border:none;border-top:1px solid var(--border);margin:20px 0">
      <h3 class="card-title" style="color:var(--danger)">Delete Permanently</h3>
      <p class="text-muted" style="font-size:13.5px;margin-bottom:14px">Permanently delete your account and profile data. This cannot be undone.</p>
      <button class="btn btn-danger" id="delAcc">${icon('trash', 16)} Delete account</button>
    </div>
  </div>`;
  container.querySelector('#saveName').addEventListener('click', async e => {
    const btn = e.currentTarget;
    const name = container.querySelector('#setName').value.trim();
    if (!name) return toast('Name cannot be empty', 'error');
    btnLoading(btn, true, 'Saving…');
    try { await api.setDocument('users', user.uid, { name }, { timestamps: false }); toast('Profile updated'); }
    catch (err) { toast(err.message, 'error'); }
    finally { btnLoading(btn, false); }
  });
  container.querySelector('#sendReset').addEventListener('click', async e => {
    const btn = e.currentTarget;
    btnLoading(btn, true, 'Sending…');
    try { await resetPassword(user.email); toast('Password reset email sent. Check your inbox.'); }
    catch (err) { toast(err.message, 'error'); }
    finally { btnLoading(btn, false); }
  });
  container.querySelector('#settingsLogout').addEventListener('click', async () => {
    const ok = await confirmDialog('You will need to log in again to access your dashboard.', { okText: 'Logout', title: 'Logout?', danger: false });
    if (!ok) return;
    try { await logoutUser(); location.href = APP_BASE + 'index.html'; }
    catch (err) { toast(err.message, 'error'); }
  });
  container.querySelector('#delAcc').addEventListener('click', async () => {
    const ok = await confirmDialog('This will permanently delete your account and all associated data.', { okText: 'Delete forever', title: 'Delete account?' });
    if (!ok) return;
    try { await deleteCurrentUser(); location.href = APP_BASE + 'index.html'; }
    catch (err) { toast(err.message, 'error'); }
  });
}

export { api };
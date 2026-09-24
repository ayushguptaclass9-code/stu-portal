#!/usr/bin/env node
/* make-pages.cjs — generates all dashboard HTML shells for AcademiaConnect.
 * Run from the project root:   node make-pages.cjs
 */
const fs = require("fs");
const path = require("path");

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%234f46e5'/%3E%3Cpath d='M8 13l8-4 8 4-8 4z' fill='white'/%3E%3C/svg%3E";

/* [file, title, role, data-page, script, extraAttrs] */
const PAGES = [
  // ---------- STUDENT ----------
  ["student/dashboard.html",       "Student Dashboard — AcademiaConnect",    "student",     "student-dashboard",       "student.js", ""],
  ["student/profile.html",         "My Profile — AcademiaConnect",           "student",     "student-profile",         "student.js", ""],
  ["student/skills.html",          "Skill Assessment — AcademiaConnect",     "student",     "student-skills",          "student.js", ""],
  ["student/internships.html",     "Internships — AcademiaConnect",          "student",     "student-internships",     "student.js", ""],
  ["student/jobs.html",            "Jobs &amp; Placements — AcademiaConnect","student",     "student-jobs",            "student.js", ""],
  ["student/learning.html",        "Learning Programs — AcademiaConnect",    "student",     "student-learning",        "student.js", ""],
  ["student/applications.html",    "My Applications — AcademiaConnect",      "student",     "student-applications",    "student.js", ""],
  ["student/portfolio.html",       "My Portfolio — AcademiaConnect",         "student",     "student-portfolio",       "student.js", ""],
  ["student/notifications.html",   "Notifications — AcademiaConnect",        "student",     "student-notifications",   "student.js", ""],
  ["student/settings.html",        "Settings — AcademiaConnect",             "student",     "student-settings",        "student.js", ""],

  // ---------- ACADEMICIAN ----------
  ["academy/dashboard.html",       "Faculty Dashboard — AcademiaConnect",    "academician", "academy-dashboard",       "academy.js", ""],
  ["academy/faculty-profile.html", "Faculty Profile — AcademiaConnect",      "academician", "academy-profile",         "academy.js", ""],
  ["academy/internships.html",     "Faculty Opportunities — AcademiaConnect","academician", "academy-opportunities",   "academy.js", ""],
  ["academy/fdp.html",             "FDP Programs — AcademiaConnect",         "academician", "academy-opportunities",   "academy.js", 'data-optype="fdp"'],
  ["academy/consultancy.html",     "Consultancy — AcademiaConnect",          "academician", "academy-opportunities",   "academy.js", 'data-optype="consultancy"'],
  ["academy/research.html",        "Research Projects — AcademiaConnect",    "academician", "academy-opportunities",   "academy.js", 'data-optype="research"'],
  ["academy/notifications.html",   "Notifications — AcademiaConnect",        "academician", "academy-notifications",   "academy.js", ""],
  ["academy/settings.html",        "Settings — AcademiaConnect",             "academician", "academy-settings",        "academy.js", ""],

  // ---------- INDUSTRY ----------
  ["industry/dashboard.html",       "Company Dashboard — AcademiaConnect",   "industry",    "industry-dashboard",        "industry.js", ""],
  ["industry/company-profile.html", "Company Profile — AcademiaConnect",     "industry",    "industry-company-profile",  "industry.js", ""],
  ["industry/post-internship.html", "Post Internship — AcademiaConnect",     "industry",    "industry-post-internship",  "industry.js", ""],
  ["industry/post-job.html",        "Post Job — AcademiaConnect",            "industry",    "industry-post-job",         "industry.js", ""],
  ["industry/training.html",        "Training Programs — AcademiaConnect",   "industry",    "industry-training",         "industry.js", ""],
  ["industry/applicants.html",      "Applicants — AcademiaConnect",          "industry",    "industry-applicants",       "industry.js", ""],
  ["industry/collaborations.html",  "Collaborations — AcademiaConnect",      "industry",    "industry-collaborations",   "industry.js", ""],
  ["industry/analytics.html",       "Analytics — AcademiaConnect",           "industry",    "industry-analytics",        "industry.js", ""],
  ["industry/notifications.html",   "Notifications — AcademiaConnect",       "industry",    "industry-notifications",    "industry.js", ""],
  ["industry/settings.html",        "Settings — AcademiaConnect",            "industry",    "industry-settings",         "industry.js", ""],

  // ---------- INSTITUTION ----------
  ["institution/dashboard.html",     "Institution Dashboard — AcademiaConnect", "institution", "inst-dashboard",     "institution.js", ""],
  ["institution/students.html",      "Students — AcademiaConnect",              "institution", "inst-students",      "institution.js", ""],
  ["institution/analytics.html",     "Analytics — AcademiaConnect",             "institution", "inst-analytics",     "institution.js", ""],
  ["institution/reports.html",       "Reports — AcademiaConnect",               "institution", "inst-reports",       "institution.js", ""],
  ["institution/notifications.html", "Notifications — AcademiaConnect",         "institution", "inst-notifications", "institution.js", ""],
  ["institution/settings.html",      "Settings — AcademiaConnect",              "institution", "inst-settings",      "institution.js", ""],
];

function shell([file, title, role, page, script, extra]) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${title}</title>
<link rel="icon" href="${FAVICON}"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="../css/style.css"/>
<link rel="stylesheet" href="../css/dashboard.css"/>
<link rel="stylesheet" href="../css/responsive.css"/>
</head>
<body data-base="../" data-role="${role}" data-page="${page}"${extra ? " " + extra : ""}>
<div id="app-loader" class="app-loader"><div class="spinner"></div><p>Loading your dashboard…</p></div>
<div id="dashboard-shell" class="dashboard-layout" hidden>
  <aside class="sidebar" id="sidebar"></aside>
  <div class="sidebar-backdrop" id="sidebarBackdrop"></div>
  <div class="dashboard-main">
    <header class="topbar" id="topbar"></header>
    <main class="page-content" id="pageContent"></main>
  </div>
</div>
<div id="toast-container" class="toast-container"></div>
<div id="modal-root"></div>
<script type="module" src="../js/${script}"></script>
</body>
</html>
`;
}

let created = 0, skipped = 0;
for (const spec of PAGES) {
  const dest = path.join(__dirname, spec[0]);
  if (fs.existsSync(dest)) { skipped++; continue; }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, shell(spec));
  created++;
}

console.log(`\n✔ Created ${created} page(s), skipped ${skipped} existing file(s).`);
PAGES.forEach(([f]) => console.log("  " + f));
console.log("\nNext:  npx serve .   →  open the printed URL 🚀\n");
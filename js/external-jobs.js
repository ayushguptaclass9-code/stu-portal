// Live external job/internship listings — supplements the platform's own
// industry-posted opportunities with real, current openings pulled from the
// public internet, so the site has real data even with zero industry partners
// signed up yet.
//
// Jobs source: Arbeitnow Job Board API — https://www.arbeitnow.com/api/job-board-api
//   Free, no API key, no signup, CORS-enabled. Docs: https://documenter.getpostman.com/view/18545278/UVJbJdKh
//
// Internships source: SimplifyJobs' community-maintained internship tracker —
//   https://github.com/SimplifyJobs/Summer2026-Internships (maintained by Pitt CSC
//   & Simplify). Its listings.json is updated multiple times a day and is served
//   straight off GitHub's raw content CDN, which sends CORS headers, so it's
//   fetchable directly from the browser with no key and no backend proxy.
//   Skews US/Canada/UK, but is far denser and fresher for internships specifically
//   than filtering a general job board's sparse "internship" tag.
//
// NOTE: both are free, public, third-party feeds with no SLA. They make the
// "Internships" / "Jobs" pages feel alive out of the box — they are not a
// replacement for your own industry-partner postings, which still go through
// the normal Firestore flow in database.js.

const ARBEITNOW_ENDPOINT = 'https://www.arbeitnow.com/api/job-board-api';
const SIMPLIFY_INTERNSHIPS_ENDPOINT = 'https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/.github/scripts/listings.json';

// Loose keyword match against title + tags to keep the jobs feed IT/software focused.
const IT_KEYWORDS = [
  'javascript', 'typescript', 'python', 'java', 'react', 'angular', 'vue', 'node',
  'frontend', 'front-end', 'backend', 'back-end', 'full stack', 'fullstack', 'full-stack',
  'devops', 'cloud', 'aws', 'azure', 'gcp', 'android', 'ios', 'flutter', 'kotlin', 'swift',
  'data engineer', 'data scientist', 'machine learning', 'ai ', ' ml ', 'sql', 'database',
  'php', 'ruby', 'golang', ' go ', 'c++', 'c#', '.net', 'dotnet', 'software', 'developer',
  'engineer', 'programmer', 'it ', 'tech ', 'web developer', 'mobile', 'qa', 'sdet',
  'testing', 'cybersecurity', 'security engineer', 'blockchain', 'embedded'
];

// Same idea, scoped to the tech-relevant categories inside the internship tracker
// (it also lists finance, product, etc. — keep only software/data/hardware roles).
const INTERNSHIP_KEYWORDS = [
  'software', 'developer', 'swe', 'engineer', 'programming', 'frontend', 'front end',
  'backend', 'back end', 'full stack', 'fullstack', 'data', 'machine learning', 'ai',
  'ml ', 'devops', 'cloud', 'android', 'ios', 'mobile', 'security', 'cyber', 'qa',
  'test', 'hardware', 'firmware', 'embedded', 'network', 'it ', 'tech', 'web', 'it intern'
];

let jobCache = null; // { ts, rows }
let internshipCache = null; // { ts, rows }
const CACHE_MS = 10 * 60 * 1000; // 10 minutes — be a good citizen of free public feeds

function isITRole(job) {
  const hay = ` ${job.title || ''} ${(job.tags || []).join(' ')} `.toLowerCase();
  return IT_KEYWORDS.some(k => hay.includes(k));
}

function isTechInternship(item) {
  const hay = ` ${item.title || ''} `.toLowerCase();
  return INTERNSHIP_KEYWORDS.some(k => hay.includes(k));
}

function normalizeJob(job) {
  return {
    id: 'ext-job-' + job.slug,
    title: job.title,
    companyName: job.company_name || 'Company not listed',
    location: job.remote ? 'Remote' : (job.location || 'Remote'),
    skills: (job.tags || []).slice(0, 6),
    employmentType: (job.job_types && job.job_types[0]) || 'Full-time',
    applyUrl: job.url,
    remote: !!job.remote,
    postedAt: job.created_at ? new Date(job.created_at * 1000) : null,
    external: true,
    sourceName: 'Arbeitnow'
  };
}

function normalizeInternship(item) {
  const locations = item.locations && item.locations.length ? item.locations : ['Multiple locations'];
  return {
    id: 'ext-int-' + (item.id || item.url),
    title: item.title,
    companyName: item.company_name || 'Company not listed',
    location: locations[0],
    skills: (item.terms || []).slice(0, 6),
    employmentType: 'Internship',
    applyUrl: item.url,
    remote: locations.some(l => /remote/i.test(l)),
    postedAt: item.date_posted ? new Date(item.date_posted * 1000) : null,
    external: true,
    sourceName: 'Simplify / Pitt CSC'
  };
}

async function loadJobs(max) {
  if (!jobCache || Date.now() - jobCache.ts > CACHE_MS) {
    const res = await fetch(ARBEITNOW_ENDPOINT);
    if (!res.ok) throw new Error('bad response');
    const json = await res.json();
    jobCache = { ts: Date.now(), rows: (json.data || []).filter(isITRole).map(normalizeJob) };
  }
  return jobCache.rows.slice(0, max);
}

async function loadInternships(max) {
  if (!internshipCache || Date.now() - internshipCache.ts > CACHE_MS) {
    const res = await fetch(SIMPLIFY_INTERNSHIPS_ENDPOINT);
    if (!res.ok) throw new Error('bad response');
    const json = await res.json();
    const rows = (Array.isArray(json) ? json : [])
      .filter(item => item.active !== false && item.is_visible !== false && isTechInternship(item))
      .sort((a, b) => (b.date_posted || 0) - (a.date_posted || 0))
      .map(normalizeInternship);
    internshipCache = { ts: Date.now(), rows };
  }
  return internshipCache.rows.slice(0, max);
}

/**
 * Fetches live IT-sector roles from free, public, key-less feeds.
 * @param {{ max?: number, kind?: 'internship'|'job' }} opts
 * @returns {Promise<Array>} normalized listings — never throws; returns [] on any failure.
 */
export async function fetchExternalITJobs({ max = 12, kind = 'job' } = {}) {
  try {
    return kind === 'internship' ? await loadInternships(max) : await loadJobs(max);
  } catch (e) {
    console.warn('[external-jobs] could not load live listings:', e.message);
    return [];
  }
}


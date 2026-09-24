// Firestore data layer. All application data access goes through this module.
import { db } from './firebase-config.js';
import {
  collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const COL = {
  USERS: 'users', STUDENTS: 'students', ACADEMICIANS: 'academicianProfiles',
  COMPANIES: 'companies', INSTITUTIONS: 'institutionProfiles',
  INTERNSHIPS: 'internships', JOBS: 'jobs', APPLICATIONS: 'applications',
  PROGRAMS: 'learningPrograms', ENROLLMENTS: 'enrollments',
  ACADEMY_OPPS: 'academyOpportunities', ACADEMY_APPS: 'academyApplications',
  ASSESSMENTS: 'skillAssessments', PORTFOLIOS: 'portfolios',
  NOTIFICATIONS: 'notifications', COLLAB: 'collaborationRequests'
};

/* ---------- Friendly error mapping ---------- */
const DB_ERRORS = {
  'permission-denied': 'You do not have permission to perform this action.',
  'unavailable': 'Service is temporarily unavailable. Please try again.',
  'failed-precondition': 'Operation failed. Please refresh and try again.',
  'unauthenticated': 'Your session has expired. Please log in again.'
};
export function dbErrorMessage(error) {
  const code = error?.code?.replace('firestore/', '') || '';
  return DB_ERRORS[code] || 'Something went wrong. Please try again.';
}

/* ---------- Generic CRUD ---------- */
export async function createDocument(colName, data) {
  try {
    const ref = await addDoc(collection(db, colName), { ...data, createdAt: serverTimestamp() });
    return ref.id;
  } catch (e) { throw new Error(dbErrorMessage(e)); }
}
export async function setDocument(colName, id, data, { timestamps = true } = {}) {
  try {
    const payload = { ...data };
    if (timestamps && !payload.createdAt) payload.createdAt = serverTimestamp();
    await setDoc(doc(db, colName, id), payload, { merge: true });
    return id;
  } catch (e) { throw new Error(dbErrorMessage(e)); }
}
export async function getDocument(colName, id) {
  try {
    const snap = await getDoc(doc(db, colName, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (e) { throw new Error(dbErrorMessage(e)); }
}
// filters: array of [field, op, value]. Sorting done client-side to avoid index requirements.
export async function getDocuments(colName, filters = [], max = 0) {
  try {
    const base = collection(db, colName);
    const q = filters.length ? query(base, ...filters.map(f => where(...f))) : base;
    let snap = await getDocs(max ? query(q, ...[]) : q);
    let rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    return max ? rows.slice(0, max) : rows;
  } catch (e) { throw new Error(dbErrorMessage(e)); }
}
export async function updateDocument(colName, id, data) {
  try { await updateDoc(doc(db, colName, id), { ...data, updatedAt: serverTimestamp() }); }
  catch (e) { throw new Error(dbErrorMessage(e)); }
}
export async function deleteDocument(colName, id) {
  try { await deleteDoc(doc(db, colName, id)); }
  catch (e) { throw new Error(dbErrorMessage(e)); }
}

/* ---------- Profiles ---------- */
export function getStudentProfile(uid) { return getDocument(COL.STUDENTS, uid); }
export function saveStudentProfile(uid, data) { return setDocument(COL.STUDENTS, uid, data); }
export function getCompanyProfile(uid) { return getDocument(COL.COMPANIES, uid); }
export function saveCompanyProfile(uid, data) { return setDocument(COL.COMPANIES, uid, data); }
export function getAcademicianProfile(uid) { return getDocument(COL.ACADEMICIANS, uid); }
export function saveAcademicianProfile(uid, data) { return setDocument(COL.ACADEMICIANS, uid, data); }
export function saveInstitutionProfile(uid, data) { return setDocument(COL.INSTITUTIONS, uid, data); }
export function getInstitutionProfile(uid) { return getDocument(COL.INSTITUTIONS, uid); }

export async function ensureRoleProfileDoc(role, user, { name, orgName } = {}) {
  const base = { userId: user.uid, email: user.email, createdAt: serverTimestamp() };
  if (role === 'student')
    await setDocument(COL.STUDENTS, user.uid, { ...base, name, college: '', degree: '', branch: '', technicalSkills: [], softSkills: [], languages: [], savedInternships: [], savedJobs: [], applicationsCount: 0, internshipCount: 0, placementStatus: 'Searching' });
  else if (role === 'academician')
    await setDocument(COL.ACADEMICIANS, user.uid, { ...base, name, designation: '', college: '', expertise: [] });
  else if (role === 'industry')
    await setDocument(COL.COMPANIES, user.uid, { ...base, companyName: orgName || name, industry: '', location: '' });
  else if (role === 'institution')
    await setDocument(COL.INSTITUTIONS, user.uid, { ...base, institutionName: orgName || name, location: '' });
}

/* ---------- Opportunities ---------- */
export async function createInternship(data, companyId) {
  return createDocument(COL.INTERNSHIPS, { ...data, companyId, status: 'Open' });
}
export const getInternships = () => getDocuments(COL.INTERNSHIPS);
export async function createJob(data, companyId) { return createDocument(COL.JOBS, { ...data, companyId, status: 'Open' }); }
export const getJobs = () => getDocuments(COL.JOBS);
export async function createLearningProgram(data, companyId) { return createDocument(COL.PROGRAMS, { ...data, companyId }); }
export const getLearningPrograms = () => getDocuments(COL.PROGRAMS);
export async function createAcademyOpportunity(data, companyId) { return createDocument(COL.ACADEMY_OPPS, { ...data, companyId, status: 'Open' }); }
export const getAcademyOpportunities = () => getDocuments(COL.ACADEMY_OPPS);

/* ---------- Applications (internships & jobs) ---------- */
export async function applyForOpportunity({ student, opp, type, resumeUrl }) {
  const existing = await getDocuments(COL.APPLICATIONS, [
    ['studentId', '==', student.userId], ['opportunityId', '==', opp.id]
  ]);
  if (existing.length) throw new Error('You have already applied to this opportunity.');
  const match = Math.round(matchPercent(student.technicalSkills || [], opp.skills || []));
  const id = await createDocument(COL.APPLICATIONS, {
    studentId: student.userId, studentName: student.name, studentEmail: student.email,
    opportunityId: opp.id, opportunityTitle: opp.title, type,
    companyId: opp.companyId, companyName: opp.companyName,
    skills: opp.skills || [], matchPercent: match, resumeUrl: resumeUrl || '',
    status: 'Applied', statusHistory: [{ status: 'Applied', at: Date.now() }]
  });
  const updates = { applicationsCount: (student.applicationsCount || 0) + 1 };
  if (type === 'internship') updates.internshipCount = (student.internshipCount || 0) + 1;
  await setDocument(COL.STUDENTS, student.userId, updates, { timestamps: false });
  await notifyUser(opp.companyId, {
    title: 'New application received',
    message: `${student.name} applied for ${opp.title} (${match}% skill match).`,
    type: 'application'
  });
  return id;
}
export const getStudentApplications = uid =>
  getDocuments(COL.APPLICATIONS, [['studentId', '==', uid]]);
export const getCompanyApplications = cid =>
  getDocuments(COL.APPLICATIONS, [['companyId', '==', cid]]);

export async function updateApplicationStatus(appId, status) {
  const app = await getDocument(COL.APPLICATIONS, appId);
  if (!app) throw new Error('Application not found.');
  const history = [...(app.statusHistory || []), { status, at: Date.now() }];
  await updateDocument(COL.APPLICATIONS, appId, { status, statusHistory: history });
  // Denormalized counters onto student doc so institution analytics stay server-readable.
  try {
    const stu = { ref: doc(db, COL.STUDENTS, app.studentId) };
    const patch = {};
    if (status === 'Selected') patch.placementStatus = app.type === 'job' ? 'Placed' : 'Intern Selected';
    else if (status === 'Completed') patch.placementStatus = 'Internship Completed';
    if (Object.keys(patch).length) await setDocument(COL.STUDENTS, app.studentId, patch, { timestamps: false });
  } catch (_) { /* non-critical */ }
  await notifyUser(app.studentId, {
    title: `Application ${status}`,
    message: `Your application for "${app.opportunityTitle}" at ${app.companyName} is now: ${status}.`,
    type: status === 'Rejected' ? 'warning' : 'success'
  });
}
export async function withdrawApplication(appId) {
  const app = await getDocument(COL.APPLICATIONS, appId);
  await deleteDocument(COL.APPLICATIONS, appId);
  if (app) {
    const stu = await getStudentProfile(app.studentId);
    if (stu) {
      const patch = { applicationsCount: Math.max(0, (stu.applicationsCount || 1) - 1) };
      if (app.type === 'internship') patch.internshipCount = Math.max(0, (stu.internshipCount || 1) - 1);
      await setDocument(COL.STUDENTS, app.studentId, patch, { timestamps: false });
    }
  }
}

/* ---------- Learning ---------- */
export async function enrollInProgram(student, program) {
  const existing = await getDocuments(COL.ENROLLMENTS, [
    ['studentId', '==', student.userId], ['programId', '==', program.id]
  ]);
  if (existing.length) throw new Error('You are already enrolled in this program.');
  return createDocument(COL.ENROLLMENTS, {
    studentId: student.userId, programId: program.id, programTitle: program.title,
    programType: program.type, companyId: program.companyId, companyName: program.companyName,
    duration: program.duration || '', progress: 0, status: 'In Progress'
  });
}
export const getStudentEnrollments = uid => getDocuments(COL.ENROLLMENTS, [['studentId', '==', uid]]);
export async function updateEnrollmentProgress(id, progress) {
  const done = progress >= 100;
  await updateDocument(COL.ENROLLMENTS, id, { progress: Math.min(progress, 100), status: done ? 'Completed' : 'In Progress' });
  if (done) {
    const enr = await getDocument(COL.ENROLLMENTS, id);
    if (enr) await notifyUser(enr.studentId, { title: 'Program completed 🎉', message: `You completed "${enr.programTitle}". Add it to your portfolio certifications!`, type: 'success' });
  }
}

/* ---------- Academy applications ---------- */
export async function applyToAcademyOpportunity({ academician, opp, message }) {
  const existing = await getDocuments(COL.ACADEMY_APPS, [
    ['academicianId', '==', academician.userId], ['opportunityId', '==', opp.id]
  ]);
  if (existing.length) throw new Error('You have already requested this opportunity.');
  const id = await createDocument(COL.ACADEMY_APPS, {
    academicianId: academician.userId, name: academician.name, email: academician.email,
    designation: academician.designation || '', college: academician.college || '',
    opportunityId: opp.id, opportunityTitle: opp.title, type: opp.type,
    companyId: opp.companyId, companyName: opp.companyName,
    message: message || '', status: 'Applied'
  });
  await notifyUser(opp.companyId, {
    title: 'New collaboration request',
    message: `${academician.name} (${academician.college || 'Faculty'}) requested "${opp.title}".`,
    type: 'collab'
  });
  return id;
}
export const getAcademicianApplications = uid => getDocuments(COL.ACADEMY_APPS, [['academicianId', '==', uid]]);
export const getCompanyAcademyApplications = cid => getDocuments(COL.ACADEMY_APPS, [['companyId', '==', cid]]);
export async function updateAcademyApplicationStatus(id, status) {
  const app = await getDocument(COL.ACADEMY_APPS, id);
  await updateDocument(COL.ACADEMY_APPS, id, { status });
  if (app) await notifyUser(app.academicianId, {
    title: `Request ${status}`,
    message: `Your request for "${app.opportunityTitle}" at ${app.companyName} is now: ${status}.`,
    type: status === 'Rejected' ? 'warning' : 'success'
  });
}

/* ---------- Skill assessments ---------- */
export async function saveSkillAssessment({ studentId, scores, technicalScore, softScore, overall }) {
  await createDocument(COL.ASSESSMENTS, { studentId, scores, technicalScore, softScore, overall });
  await setDocument(COL.STUDENTS, studentId, {
    skillScores: scores, skillScore: overall, technicalScore, softScore, assessmentDate: Date.now()
  }, { timestamps: false });
}
export async function getLatestAssessment(studentId) {
  const rows = await getDocuments(COL.ASSESSMENTS, [['studentId', '==', studentId]]);
  return rows[0] || null;
}

/* ---------- Portfolio ---------- */
export const getPortfolio = uid => getDocument(COL.PORTFOLIOS, uid);
export const savePortfolio = (uid, data) => setDocument(COL.PORTFOLIOS, uid, data);

/* ---------- Notifications ---------- */
export async function notifyUser(userId, { title, message, type = 'info' }) {
  try {
    await createDocument(COL.NOTIFICATIONS, { userId, title, message, type, read: false });
  } catch (_) { /* notifications must never break the main flow */ }
}
export const getNotifications = uid => getDocuments(COL.NOTIFICATIONS, [['userId', '==', uid]]);
export const markNotificationRead = id => updateDocument(COL.NOTIFICATIONS, id, { read: true });
export async function markAllNotificationsRead(uid) {
  const rows = await getNotifications(uid);
  await Promise.all(rows.filter(n => !n.read).map(n => updateDocument(COL.NOTIFICATIONS, n.id, { read: true })));
}

/* ---------- Collaboration requests (institution ↔ industry) ---------- */
export async function createCollaborationRequest(data) { return createDocument(COL.COLLAB, data); }
export const getIncomingCollabRequests = uid => getDocuments(COL.COLLAB, [['toUserId', '==', uid]]);
export const updateCollaborationRequest = (id, status) => updateDocument(COL.COLLAB, id, { status });

/* ---------- Institution helpers ---------- */
export async function getStudentsByCollege(college) {
  if (!college) return getDocuments(COL.STUDENTS);
  const rows = await getDocuments(COL.STUDENTS, [['college', '==', college]]);
  return rows.length ? rows : getDocuments(COL.STUDENTS);
}
export const getAllStudents = () => getDocuments(COL.STUDENTS);

/* ---------- Matching engine (modular — swap with ML later) ---------- */
const norm = s => (s || '').trim().toLowerCase();
export function matchPercent(studentSkills = [], required = []) {
  if (!required || !required.length) return 50;
  const set = new Set(studentSkills.map(norm));
  const hits = required.filter(r => set.has(norm(r))).length;
  return Math.round((hits / required.length) * 100);
}
// Optional demo data. Called from empty-state buttons or browser console:
//   import('./js/demo-data.js').then(m => m.ensureDemoOpportunities())
// Writes only public/opportunity collections with fixed IDs (idempotent).
// Sample student profiles can be added via seedDemoStudents() during development
// (temporarily relax the students write rule — see README).
import { db } from './firebase-config.js';
import { doc, setDoc, getDocs, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const inDays = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const COMPANIES = [
  ['demo-co-1', { companyName: 'TechNova Solutions', industry: 'IT Services', location: 'Bengaluru', size: '500-1000', about: 'Product engineering company building scalable web platforms.' }],
  ['demo-co-2', { companyName: 'DataForge Analytics', industry: 'Data & AI', location: 'Hyderabad', size: '200-500', about: 'AI-first analytics company serving enterprise clients.' }],
  ['demo-co-3', { companyName: 'CloudSpark Systems', industry: 'Cloud & DevOps', location: 'Pune', size: '100-200', about: 'Cloud migration and DevOps automation specialists.' }],
  ['demo-co-4', { companyName: 'SecureLine Technologies', industry: 'Cybersecurity', location: 'Chennai', size: '50-100', about: 'Security auditing and SOC services for enterprises.' }],
  ['demo-co-5', { companyName: 'FinEdge Labs', industry: 'FinTech', location: 'Mumbai', size: '1000+', about: 'Digital payments and banking infrastructure.' }]
];

const INTERNSHIPS = [
  ['demo-int-1', 'demo-co-1', 'TechNova Solutions', 'Frontend Development Intern', ['JavaScript', 'HTML', 'CSS', 'React'], 'B.E/B.Tech', 'Bengaluru (Hybrid)', '3 Months', '₹15,000/month', 5, 30, 'Build responsive UI features for client dashboards using React. Mentorship from senior engineers included.'],
  ['demo-int-2', 'demo-co-2', 'DataForge Analytics', 'Data Science Intern', ['Python', 'SQL', 'Machine Learning', 'Data Analysis'], 'B.E/B.Tech/MCA', 'Remote', '6 Months', '₹20,000/month', 3, 21, 'Work on real client datasets — cleaning, modeling and dashboarding with our AI team.'],
  ['demo-int-3', 'demo-co-3', 'CloudSpark Systems', 'Cloud DevOps Intern', ['AWS', 'Linux', 'Docker', 'CI/CD'], 'B.E/B.Tech', 'Pune', '3 Months', '₹12,000/month', 4, 45, 'Assist in automating deployments and managing cloud infrastructure on AWS.'],
  ['demo-int-4', 'demo-co-4', 'SecureLine Technologies', 'Cybersecurity Analyst Intern', ['Networking', 'Cybersecurity', 'Linux', 'Python'], 'B.E/B.Tech', 'Chennai (On-site)', '6 Months', '₹18,000/month', 2, 15, 'Join our SOC team — monitor threats, run vulnerability scans and write reports.'],
  ['demo-int-5', 'demo-co-5', 'FinEdge Labs', 'Full Stack Developer Intern', ['JavaScript', 'Node.js', 'MongoDB', 'React'], 'B.E/B.Tech', 'Mumbai (Hybrid)', '6 Months', '₹25,000/month', 6, 40, 'Ship features end-to-end on our payments platform with a dedicated mentor.'],
  ['demo-int-6', 'demo-co-1', 'TechNova Solutions', 'Backend Development Intern', ['Java', 'Spring Boot', 'SQL', 'REST APIs'], 'B.E/B.Tech', 'Remote', '3 Months', '₹14,000/month', 4, 25, 'Design and build RESTful services powering our logistics products.'],
  ['demo-int-7', 'demo-co-2', 'DataForge Analytics', 'Business Intelligence Intern', ['SQL', 'Excel', 'Power BI', 'Data Analysis'], 'Any degree', 'Hyderabad', '2 Months', '₹10,000/month', 8, 18, 'Create executive dashboards and reports used by leadership every week.'],
  ['demo-int-8', 'demo-co-3', 'CloudSpark Systems', 'AI Engineering Intern', ['Python', 'TensorFlow', 'AI/ML', 'Data Analysis'], 'B.E/B.Tech/M.Tech', 'Remote', '6 Months', '₹22,000/month', 2, 35, 'Train and evaluate ML models for anomaly detection in cloud workloads.']
];

const JOBS = [
  ['demo-job-1', 'demo-co-1', 'TechNova Solutions', 'Junior Software Engineer', ['JavaScript', 'React', 'Node.js', 'SQL'], 'B.E/B.Tech (CS/IT)', '0-1 years', 'Bengaluru', '₹4.5 - 6 LPA', 'Full-time', 30, 'Join our product engineering team building web platforms used by millions.'],
  ['demo-job-2', 'demo-co-2', 'DataForge Analytics', 'Data Analyst', ['SQL', 'Python', 'Power BI', 'Data Analysis'], 'Any graduate', '0-2 years', 'Hyderabad', '₹3.6 - 5 LPA', 'Full-time', 25, 'Turn raw data into insights for enterprise clients across retail and finance.'],
  ['demo-job-3', 'demo-co-5', 'FinEdge Labs', 'Backend Engineer — Payments', ['Java', 'Spring Boot', 'SQL', 'Microservices'], 'B.E/B.Tech', '1-3 years', 'Mumbai', '₹8 - 12 LPA', 'Full-time', 45, 'Own services that process millions of transactions daily with 99.99% uptime.'],
  ['demo-job-4', 'demo-co-4', 'SecureLine Technologies', 'Security Analyst', ['Cybersecurity', 'Networking', 'Linux', 'SIEM'], 'B.E/B.Tech', '0-2 years', 'Chennai', '₹4 - 6.5 LPA', 'Full-time', 20, 'L1/L2 SOC analyst role — monitor, triage and escalate security incidents.'],
  ['demo-job-5', 'demo-co-3', 'CloudSpark Systems', 'Associate Cloud Engineer', ['AWS', 'Linux', 'Docker', 'Terraform'], 'B.E/B.Tech', '0-1 years', 'Pune', '₹5 - 7 LPA', 'Full-time', 35, 'Deploy and operate client workloads on AWS with IaC best practices.'],
  ['demo-job-6', 'demo-co-1', 'TechNova Solutions', 'Frontend Developer', ['HTML', 'CSS', 'JavaScript', 'React'], 'B.E/B.Tech', '1-2 years', 'Remote', '₹5 - 8 LPA', 'Full-time', 28, 'Craft pixel-perfect, accessible UI components in a design-system driven team.']
];

const PROGRAMS = [
  ['demo-lp-1', 'demo-co-3', 'CloudSpark Systems', 'AWS Cloud Practitioner Bootcamp', 'training', ['AWS', 'Cloud Computing', 'Linux'], '6 Weeks', 'Online (Live)', '₹2,999', 'Hands-on AWS bootcamp with labs, practice exams and a completion certificate.'],
  ['demo-lp-2', 'demo-co-2', 'DataForge Analytics', 'Certified Data Analyst Program', 'certification', ['SQL', 'Python', 'Data Analysis', 'Power BI'], '8 Weeks', 'Online (Self-paced)', '₹4,999', 'Industry-recognized certification with 6 real-world projects and career support.'],
  ['demo-lp-3', 'demo-co-1', 'TechNova Solutions', 'Modern React Workshop', 'workshop', ['JavaScript', 'React', 'HTML', 'CSS'], '2 Days', 'Online (Live)', 'Free', 'Intensive weekend workshop covering hooks, state management and testing.'],
  ['demo-lp-4', 'demo-co-5', 'FinEdge Labs', 'FinTech Engineering Mentorship', 'mentorship', ['Java', 'System Design', 'SQL'], '3 Months', 'Online', 'Free', '1:1 mentorship from senior FinTech engineers — code reviews and career guidance.'],
  ['demo-lp-5', 'demo-co-2', 'DataForge Analytics', 'AI/ML Foundations Training', 'training', ['Python', 'AI/ML', 'Data Analysis'], '10 Weeks', 'Online (Live)', '₹5,499', 'From regression to neural networks with weekly evaluated assignments.'],
  ['demo-lp-6', 'demo-co-3', 'CloudSpark Systems', 'Live Project: Cloud Migration', 'project', ['AWS', 'Docker', 'CI/CD', 'Linux'], '4 Weeks', 'Remote', 'Free', 'Work on a real client migration project under a senior architect. Stipend on completion.'],
  ['demo-lp-7', 'demo-co-4', 'SecureLine Technologies', 'Ethical Hacking Certification', 'certification', ['Cybersecurity', 'Networking', 'Linux'], '6 Weeks', 'Online (Live)', '₹3,499', 'Practical offensive-security certification with a virtual lab environment.'],
  ['demo-lp-8', 'demo-co-1', 'TechNova Solutions', 'Campus to Corporate — Soft Skills', 'training', ['Communication', 'Teamwork', 'Time Management'], '3 Weeks', 'Online (Live)', 'Free', 'Communication, aptitude and interview skills training by industry trainers.']
];

const ACADEMY_OPPS = [
  ['demo-ao-1', 'demo-co-3', 'CloudSpark Systems', '2-Week Faculty Industrial Training: Cloud & DevOps', 'training', 'Computer Science / IT', 'Hands-on cloud training for faculty with certification.', '2 Weeks', 'Online', '₹15,000 honorarium', 40],
  ['demo-ao-2', 'demo-co-1', 'TechNova Solutions', 'Summer Faculty Internship — Product Engineering', 'faculty-internship', 'Computer Engineering', 'Faculty embed with our product teams for 8 weeks.', '8 Weeks', 'Bengaluru (On-site)', '₹50,000 stipend', 50],
  ['demo-ao-3', 'demo-co-2', 'DataForge Analytics', 'FDP: Teaching AI & Data Science in 2025', 'fdp', 'AI / Data Science', 'AICTE-style FDP with sessions by practicing data scientists.', '1 Week', 'Online', '₹1,500 registration', 20],
  ['demo-ao-4', 'demo-co-5', 'FinEdge Labs', 'Consultancy: Curriculum Design for FinTech Elective', 'consultancy', 'Finance + CS', 'Partner with us to design an industry-aligned FinTech elective.', '6 Weeks', 'Remote', '₹75,000 project fee', 60],
  ['demo-ao-5', 'demo-co-2', 'DataForge Analytics', 'Joint Research: Applied NLP for Regional Languages', 'research', 'NLP / AI', 'Co-publish research with our AI lab; datasets and funding provided.', '6 Months', 'Hybrid', 'Funded', 90],
  ['demo-ao-6', 'demo-co-4', 'SecureLine Technologies', 'Guest Lecture: Careers in Cybersecurity', 'guest-lecture', 'Cybersecurity', '90-minute session for final-year students by our CISO.', '1 Day', 'On-site / Online', '₹5,000 honorarium', 14],
  ['demo-ao-7', 'demo-co-3', 'CloudSpark Systems', 'Hands-on Workshop: Docker & Kubernetes for Faculty', 'workshop', 'Cloud Computing', 'Weekend practical workshop with cloud lab access.', '2 Days', 'Pune', '₹2,000 registration', 18],
  ['demo-ao-8', 'demo-co-1', 'TechNova Solutions', 'Industry Mentorship for Final-Year Projects', 'mentorship', 'Software Engineering', 'Our engineers mentor student capstone projects at your college.', '1 Semester', 'Online', 'Free', 75],
  ['demo-ao-9', 'demo-co-2', 'DataForge Analytics', 'Consultancy: Placement Analytics Dashboard Setup', 'consultancy', 'Analytics', 'We help your T&P cell build a skill-mapping analytics dashboard.', '4 Weeks', 'Remote', '₹40,000 project fee', 30],
  ['demo-ao-10', 'demo-co-5', 'FinEdge Labs', 'FDP: Building Industry-Aligned Coding Curriculum', 'fdp', 'Software Engineering', 'Curriculum-first FDP aligning course outcomes with industry needs.', '5 Days', 'Mumbai / Online', '₹2,500 registration', 26]
];

async function isEmpty(colName) {
  const snap = await getDocs(collection(db, colName));
  return snap.empty;
}

export async function ensureDemoOpportunities() {
  if (!await isEmpty('internships')) return false; // already seeded
  const now = serverTimestamp();
  // Best-effort only: firestore.rules restricts companies/{uid} writes to isSelf(uid),
  // so these fixed demo IDs will be rejected for any real signed-in user — that's fine,
  // internship/job/program cards read companyName/companyLogo denormalized on their own
  // documents below, so a missing company profile doc doesn't affect what's displayed.
  await Promise.allSettled(COMPANIES.map(([id, data]) => setDoc(doc(db, 'companies', id), { ...data, createdAt: now }, { merge: true })));
  const row = (arr, extra) => arr.map(([id, coId, coName, ...rest]) => setDoc(doc(db, extra.col, id),
    { id, companyId: coId, companyName: coName, ...extra.map(rest), createdAt: now }, { merge: true })).flat();

  await Promise.all([
    ...row(INTERNSHIPS, { col: 'internships', map: ([title, skills, qualification, location, duration, stipend, positions, ddl, description]) =>
      ({ title, skills, qualification, location, duration, stipend, positions: +positions, deadline: inDays(ddl), description }) }),
    ...row(JOBS, { col: 'jobs', map: ([title, skills, qualification, experience, location, salary, employmentType, ddl, description]) =>
      ({ title, skills, qualification, experience, location, salary, employmentType, deadline: inDays(ddl), description }) }),
    ...row(PROGRAMS, { col: 'learningPrograms', map: ([title, type, skills, duration, mode, fee, description]) =>
      ({ title, type, skills, duration, mode, fee, description }) }),
    ...row(ACADEMY_OPPS, { col: 'academyOpportunities', map: ([title, type, field, description, duration, mode, honorarium, ddl]) =>
      ({ title, type, field, description, duration, mode, honorarium, deadline: inDays(ddl) }) })
  ]);
  return true;
}

export async function seedDemoStudents() {
  // DEV ONLY: requires temporarily relaxed Firestore rules (see README §5).
  const students = [
    ['demo-stu-1', { name: 'Aarav Sharma', college: 'Delhi Institute of Technology', degree: 'B.Tech', branch: 'CSE', graduationYear: '2026', technicalSkills: ['JavaScript', 'React', 'HTML', 'CSS', 'SQL'], skillScore: 78, applicationsCount: 4, internshipCount: 3, placementStatus: 'Intern Selected' }],
    ['demo-stu-2', { name: 'Priya Nair', college: 'Delhi Institute of Technology', degree: 'B.Tech', branch: 'IT', graduationYear: '2026', technicalSkills: ['Python', 'SQL', 'Data Analysis', 'Power BI'], skillScore: 82, applicationsCount: 6, internshipCount: 5, placementStatus: 'Placed' }],
    ['demo-stu-3', { name: 'Rohan Gupta', college: 'Delhi Institute of Technology', degree: 'B.Tech', branch: 'ECE', graduationYear: '2027', technicalSkills: ['Python', 'AI/ML', 'Data Analysis'], skillScore: 66, applicationsCount: 2, internshipCount: 1, placementStatus: 'Searching' }],
    ['demo-stu-4', { name: 'Sneha Iyer', college: 'Delhi Institute of Technology', degree: 'MCA', branch: 'Computer Applications', graduationYear: '2026', technicalSkills: ['Java', 'Spring Boot', 'SQL', 'AWS'], skillScore: 74, applicationsCount: 5, internshipCount: 4, placementStatus: 'Placed' }],
    ['demo-stu-5', { name: 'Vikram Singh', college: 'Delhi Institute of Technology', degree: 'B.Tech', branch: 'CSE', graduationYear: '2027', technicalSkills: ['Cybersecurity', 'Networking', 'Linux'], skillScore: 69, applicationsCount: 3, internshipCount: 2, placementStatus: 'Internship Completed' }]
  ];
  await Promise.all(students.map(([id, d]) => setDoc(doc(db, 'students', id), { userId: id, email: `${id}@demo.ac.in`, ...d }, { merge: true })));
  return students.length;
}
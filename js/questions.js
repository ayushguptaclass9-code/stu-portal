// Question bank for the skill assessment. Scores: 0–100 per question.
const SCALE = [
  { t: 'Not confident yet', s: 25 }, { t: 'Somewhat confident', s: 50 },
  { t: 'Confident', s: 75 }, { t: 'Very confident', s: 100 }
];
const conf = stem => ({ t: stem, options: SCALE });

export const QUESTIONS = [
  // ---- Technical ----
  { skill: 'Programming', category: 'technical', q: 'Which snippet correctly swaps two variables?', options: [
    { t: 'a = b; b = a;', s: 0 }, { t: 'temp = a; a = b; b = temp;', s: 100 },
    { t: 'a == b; b == a;', s: 25 }, { t: 'swap is built into JavaScript', s: 50 }] },
  { skill: 'Programming', category: 'technical', q: 'Time complexity of accessing an array element by index?', options: [
    { t: 'O(n)', s: 0 }, { t: 'O(log n)', s: 25 }, { t: 'O(1)', s: 100 }, { t: 'O(n log n)', s: 50 }] },
  { skill: 'Data Structures', category: 'technical', q: 'Which structure works on First-In-First-Out (FIFO)?', options: [
    { t: 'Stack', s: 0 }, { t: 'Queue', s: 100 }, { t: 'Tree', s: 25 }, { t: 'Graph', s: 50 }] },
  { skill: 'Data Structures', category: 'technical', q: 'Average search time in a balanced Binary Search Tree?', options: [
    { t: 'O(1)', s: 25 }, { t: 'O(n)', s: 0 }, { t: 'O(log n)', s: 100 }, { t: 'O(n²)', s: 50 }] },
  { skill: 'Databases', category: 'technical', q: 'Which SQL clause filters rows BEFORE grouping?', options: [
    { t: 'HAVING', s: 25 }, { t: 'WHERE', s: 100 }, { t: 'GROUP BY', s: 0 }, { t: 'ORDER BY', s: 50 }] },
  { skill: 'Databases', category: 'technical', q: 'Normalization primarily reduces…', options: [
    { t: 'Data redundancy', s: 100 }, { t: 'Query speed', s: 0 }, { t: 'Number of tables', s: 25 }, { t: 'Indexes', s: 50 }] },
  { skill: 'Web Development', category: 'technical', q: 'Which HTTP status code means "Not Found"?', options: [
    { t: '200', s: 0 }, { t: '301', s: 25 }, { t: '404', s: 100 }, { t: '500', s: 50 }] },
  { skill: 'Web Development', category: 'technical', q: 'Which REST method fully replaces a resource (idempotent)?', options: [
    { t: 'POST', s: 0 }, { t: 'PATCH', s: 50 }, { t: 'PUT', s: 100 }, { t: 'GET', s: 25 }] },
  { skill: 'Cloud Computing', category: 'technical', q: 'IaaS provides…', options: [
    { t: 'Ready-made applications', s: 50 }, { t: 'Virtualized compute & storage infrastructure', s: 100 },
    { t: 'Only managed databases', s: 25 }, { t: 'Only monitoring tools', s: 0 }] },
  { skill: 'Cloud Computing', category: 'technical', q: 'Auto-scaling primarily helps to…', options: [
    { t: 'Increase billing', s: 0 }, { t: 'Handle varying load by adjusting instances', s: 100 },
    { t: 'Deploy databases', s: 25 }, { t: 'Write code faster', s: 50 }] },
  { skill: 'AI / ML', category: 'technical', q: 'Supervised learning requires…', options: [
    { t: 'Unlabeled data', s: 0 }, { t: 'Labeled training data', s: 100 }, { t: 'No data', s: 25 }, { t: 'Only images', s: 50 }] },
  { skill: 'AI / ML', category: 'technical', q: 'Overfitting means the model…', options: [
    { t: 'Performs poorly even on training data', s: 0 }, { t: 'Memorizes training data and fails to generalize', s: 100 },
    { t: 'Is too simple', s: 25 }, { t: 'Trains too fast', s: 50 }] },
  { skill: 'Cybersecurity', category: 'technical', q: 'Best defense against SQL injection?', options: [
    { t: 'String concatenation in queries', s: 0 }, { t: 'Parameterized queries / prepared statements', s: 100 },
    { t: 'Hiding the DB name', s: 25 }, { t: 'Client-side validation only', s: 50 }] },
  { skill: 'Mobile Development', category: 'technical', q: 'Which is a cross-platform mobile framework?', options: [
    { t: 'Flutter', s: 100 }, { t: 'Django', s: 0 }, { t: 'Laravel', s: 25 }, { t: 'Rails', s: 50 }] },
  // ---- Soft ----
  { skill: 'Communication', category: 'soft', ...conf('How confident are you presenting ideas to a new audience?') },
  { skill: 'Communication', category: 'soft', ...conf('How often do you write clear, structured emails and reports?') },
  { skill: 'Teamwork', category: 'soft', ...conf('How comfortable are you collaborating with diverse teams?') },
  { skill: 'Teamwork', category: 'soft', ...conf('How well do you handle disagreements within a team?') },
  { skill: 'Problem Solving', category: 'soft', ...conf('How effectively do you break complex problems into steps?') },
  { skill: 'Problem Solving', category: 'soft', ...conf('How often do you propose solutions rather than just flagging issues?') },
  { skill: 'Leadership', category: 'soft', ...conf('How comfortable are you leading a team or initiative?') },
  { skill: 'Time Management', category: 'soft', ...conf('How consistently do you meet deadlines under pressure?') },
  { skill: 'Adaptability', category: 'soft', ...conf('How quickly do you adapt to new tools or changes?') }
];

// Target levels used by the Skill Gap analysis.
export const TARGET_SKILL_LEVELS = [
  { skill: 'Programming', required: 75 }, { skill: 'Data Structures', required: 70 },
  { skill: 'Databases', required: 75 }, { skill: 'Web Development', required: 80 },
  { skill: 'Cloud Computing', required: 70 }, { skill: 'AI / ML', required: 65 },
  { skill: 'Cybersecurity', required: 60 }, { skill: 'Mobile Development', required: 60 },
  { skill: 'Communication', required: 80 }, { skill: 'Teamwork', required: 75 },
  { skill: 'Problem Solving', required: 80 }, { skill: 'Leadership', required: 70 },
  { skill: 'Time Management', required: 75 }, { skill: 'Adaptability', required: 70 }
];

export function computeScores(answers) {
  // answers: array of selected option-score per question (null allowed → 0)
  const bySkill = {};
  QUESTIONS.forEach((q, i) => {
    (bySkill[q.skill] = bySkill[q.skill] || []).push(answers[i] ?? 0);
  });
  const scores = {};
  for (const [skill, vals] of Object.entries(bySkill))
    scores[skill] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const tech = Object.entries(scores).filter(([s]) => bySkill[s] && QUESTIONS.some(q => q.skill === s && q.category === 'technical'));
  const soft = Object.entries(scores).filter(([s]) => QUESTIONS.some(q => q.skill === s && q.category === 'soft'));
  const avg = arr => arr.length ? Math.round(arr.reduce((a, [, v]) => a + v, 0) / arr.length) : 0;
  const technicalScore = avg(tech), softScore = avg(soft);
  return { scores, technicalScore, softScore, overall: Math.round(technicalScore * 0.6 + softScore * 0.4) };
}
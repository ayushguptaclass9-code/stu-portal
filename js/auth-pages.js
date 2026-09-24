// Page controller for login.html and register.html.
import {
  registerUser, loginUser, loginWithGoogle, completeGoogleRegistration,
  watchAuth, getUserProfile, resetPassword, authErrorMessage, ROLE_HOME
} from './auth.js';
import { toast, btnLoading, openModal, escapeHTML, icon } from './common.js';

const body = document.body;
const $ = sel => document.querySelector(sel);

/* Redirect if already signed in with a completed profile */
watchAuth(async user => {
  if (!user || body.dataset.busy === '1') return;
  const p = await getUserProfile(user.uid).catch(() => null);
  if (p?.role) location.href = ROLE_HOME[p.role];
});

/* ---------- Error box helper ---------- */
function showError(msg) {
  const box = $('#authError');
  box.innerHTML = `<div class="alert alert-error">${icon('x', 16)}<span>${escapeHTML(msg)}</span></div>`;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
const clearError = () => { $('#authError').innerHTML = ''; };

/* ================= LOGIN ================= */
if (body.dataset.authpage === 'login') {
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault(); clearError();
    const btn = $('#loginBtn');
    const email = $('#email').value.trim(), password = $('#password').value;
    if (!email || !password) return showError('Please enter your email and password.');
    btnLoading(btn, true, 'Signing in…'); body.dataset.busy = '1';
    try {
      const user = await loginUser(email, password);
      const p = await getUserProfile(user.uid).catch(err => { throw new Error(authErrorMessage(err)); });
      if (p?.role) {
        location.href = ROLE_HOME[p.role];
      } else {
        // Auth account exists but profile is missing (e.g. a failed earlier
        // registration). Finish the setup now by picking a role.
        btnLoading(btn, false);
        openRoleModal(user, () => { body.dataset.busy = ''; });
      }
    } catch (err) {
      body.dataset.busy = ''; btnLoading(btn, false); showError(err.message);
    }
  });

  $('#googleBtn').addEventListener('click', async () => {
    clearError(); body.dataset.busy = '1';
    try {
      const { user, isNew } = await loginWithGoogle();
      if (!isNew) {
        const p = await getUserProfile(user.uid).catch(() => null);
        if (p?.role) { location.href = ROLE_HOME[p.role]; return; }
        openRoleModal(user, () => { body.dataset.busy = ''; });
        return;
      }
      openRoleModal(user, () => { body.dataset.busy = ''; });
    } catch (err) { body.dataset.busy = ''; showError(authErrorMessage(err)); }
  });

  $('#forgotLink').addEventListener('click', e => {
    e.preventDefault();
    const { close, el } = openModal({
      title: 'Reset password',
      body: `<div class="form-group"><label>Email</label><input class="input" id="resetEmail" type="email" placeholder="you@example.com"></div>`,
      footer: `<button class="btn btn-outline" data-x>Cancel</button><button class="btn btn-primary" data-go>Send reset link</button>`
    });
    el.querySelector('[data-x]').onclick = close;
    el.querySelector('[data-go]').onclick = async ev => {
      const email = el.querySelector('#resetEmail').value.trim();
      if (!email) return toast('Please enter your email', 'error');
      btnLoading(ev.currentTarget, true, 'Sending…');
      try { await resetPassword(email); toast('Password reset email sent!'); close(); }
      catch (err) { toast(authErrorMessage(err), 'error'); }
      finally { btnLoading(ev.currentTarget, false); }
    };
  });
}

/* ---------- Role modal (new OR incomplete accounts) ---------- */
function openRoleModal(user, onClose = () => {}) {
  const roles = [
    ['student', 'Student', 'grad'], ['academician', 'Academician', 'user'],
    ['industry', 'Industry', 'building'], ['institution', 'Institution', 'layers']
  ];
  const { close, el } = openModal({
    title: 'Complete your registration',
    body: `<p class="text-muted" style="font-size:13.5px;margin-bottom:14px">Welcome, ${escapeHTML(user.displayName || user.email)}! Choose how you want to use AcademiaConnect.</p>
      <div class="role-cards">${roles.map(([v, t, ic]) => `
        <label class="role-card-opt"><input type="radio" name="gRole" value="${v}">
        <span class="r-icon">${icon(ic, 18)}</span><span>${t}</span></label>`).join('')}</div>
      <div class="form-group mt-2 hidden" id="gOrgWrap"><label id="gOrgLabel">Organization name</label>
        <input class="input" id="gOrg" placeholder="Organization name"></div>`,
    footer: `<button class="btn btn-primary btn-block" id="gRoleGo" disabled>Continue</button>`
  });
  let role = '';
  el.querySelectorAll('.role-card-opt').forEach(c => c.addEventListener('click', () => {
    el.querySelectorAll('.role-card-opt').forEach(x => x.classList.remove('selected'));
    c.classList.add('selected'); c.querySelector('input').checked = true;
    role = c.querySelector('input').value;
    el.querySelector('#gRoleGo').disabled = false;
    const orgWrap = el.querySelector('#gOrgWrap');
    orgWrap.classList.toggle('hidden', !(role === 'industry' || role === 'institution'));
    el.querySelector('#gOrgLabel').textContent = role === 'industry' ? 'Company name' : 'Institution name';
  }));
  el.querySelector('#gRoleGo').addEventListener('click', async ev => {
    const orgName = el.querySelector('#gOrg').value.trim();
    if ((role === 'industry' || role === 'institution') && !orgName)
      return toast('Please enter your organization name', 'error');
    btnLoading(ev.currentTarget, true, 'Creating profile…');
    try {
      await completeGoogleRegistration(user, role, orgName);
      close(); onClose();
      location.href = ROLE_HOME[role];
    } catch (err) { toast(authErrorMessage(err), 'error'); btnLoading(ev.currentTarget, false); }
  });
  void close;
}

/* ================= REGISTER ================= */
if (body.dataset.authpage === 'register') {
  const orgWrap = $('#orgWrap'), orgLabel = $('#orgLabel');
  document.querySelectorAll('.role-card-opt').forEach(c => c.addEventListener('click', () => {
    document.querySelectorAll('.role-card-opt').forEach(x => x.classList.remove('selected'));
    c.classList.add('selected'); c.querySelector('input').checked = true;
    const role = c.querySelector('input').value;
    orgWrap.classList.toggle('hidden', !(role === 'industry' || role === 'institution'));
    orgLabel.textContent = role === 'industry' ? 'Company name' : 'Institution name';
  }));

  $('#registerForm').addEventListener('submit', async e => {
    e.preventDefault(); clearError();
    const name = $('#name').value.trim(), email = $('#email').value.trim();
    const pw = $('#password').value, pw2 = $('#confirmPassword').value;
    const role = document.querySelector('input[name="role"]:checked')?.value;
    const orgName = $('#orgName').value.trim();
    const displayName = (role === 'industry' || role === 'institution') ? orgName : name;

    if (!displayName) return showError('Please enter your name' + (role === 'industry' || role === 'institution' ? ' and organization name.' : '.'));
    if (!role) return showError('Please select your role.');
    if (pw.length < 6) return showError('Password should be at least 6 characters.');
    if (pw !== pw2) return showError('Passwords do not match.');

    const btn = $('#registerBtn');
    btnLoading(btn, true, 'Creating account…'); body.dataset.busy = '1';
    try {
      await registerUser({ name: displayName, email, password: pw, role, orgName });
      toast('Account created successfully! Welcome aboard 🎉');
      location.href = ROLE_HOME[role];
    } catch (err) {
      body.dataset.busy = ''; btnLoading(btn, false);
      showError(err.message + ' (If this mentions permissions: publish firestore.rules — README §5 — then simply LOG IN with these credentials to finish setup.)');
    }
  });
}
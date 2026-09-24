// Landing page interactions: mobile menu, scroll reveal, animated counters.
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ROLE_HOME } from './auth.js';

/* If already signed in with a completed profile, skip the marketing page and
   go straight to the dashboard — same behavior login.html/register.html already
   have, so a returning user never has to click through Login manually. */
onAuthStateChanged(auth, async user => {
  if (!user) return;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    const role = snap.exists() ? snap.data().role : null;
    if (role && ROLE_HOME[role]) location.href = ROLE_HOME[role];
  } catch (_) { /* not fully signed in yet, or profile not readable — stay on landing page */ }
});

document.addEventListener('DOMContentLoaded', () => {
  const burger = document.getElementById('navBurger');
  const menu = document.getElementById('mobileMenu');
  burger?.addEventListener('click', () => menu.classList.toggle('open'));
  menu?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => menu.classList.remove('open')));

  // Reveal on scroll
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // Count-up statistics
  const counters = document.querySelectorAll('[data-count]');
  const cio = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    cio.unobserve(en.target);
    const el = en.target, target = +el.dataset.count, suffix = el.dataset.suffix || '+';
    const t0 = performance.now(), dur = 1400;
    (function tick(t) {
      const p = Math.min((t - t0) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }), { threshold: 0.4 });
  counters.forEach(c => cio.observe(c));
});
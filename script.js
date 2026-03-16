/* ============================================================
   NAVBAR — active link on scroll + mobile toggle
   ============================================================ */
const hamburger = document.getElementById('hamburger');
const navLinks  = document.querySelector('.nav-links');

hamburger?.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  const spans = hamburger.querySelectorAll('span');
  spans[0].style.transform = navLinks.classList.contains('open') ? 'rotate(45deg) translate(5px, 5px)' : '';
  spans[1].style.opacity   = navLinks.classList.contains('open') ? '0' : '';
  spans[2].style.transform = navLinks.classList.contains('open') ? 'rotate(-45deg) translate(5px, -5px)' : '';
});

// Close nav when a link is clicked (mobile)
navLinks?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
  });
});

// Highlight active section in navbar
const sections = document.querySelectorAll('section[id]');
const navItems = document.querySelectorAll('.nav-links a[href^="#"]');

function setActiveNav() {
  const scrollY = window.scrollY + 100;
  sections.forEach(section => {
    const top    = section.offsetTop;
    const height = section.offsetHeight;
    const id     = section.getAttribute('id');
    if (scrollY >= top && scrollY < top + height) {
      navItems.forEach(a => a.classList.remove('active'));
      const match = document.querySelector(`.nav-links a[href="#${id}"]`);
      if (match) match.classList.add('active');
    }
  });
}
window.addEventListener('scroll', setActiveNav, { passive: true });

/* ============================================================
   SCROLL REVEAL
   ============================================================ */
const revealEls = document.querySelectorAll(
  '.service-card, .work-card, .pillar, .about-grid, .stat, .contact-grid'
);

revealEls.forEach(el => el.setAttribute('data-reveal', ''));

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      // Stagger sibling cards
      const delay = [...(entry.target.parentElement?.children ?? [])].indexOf(entry.target) * 80;
      setTimeout(() => entry.target.classList.add('revealed'), delay);
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

revealEls.forEach(el => observer.observe(el));

/* ============================================================
   CONTACT FORM — basic feedback (replace with real handler)
   ============================================================ */
const form = document.getElementById('contact-form');
form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const btn = form.querySelector('button[type="submit"]');
  const original = btn.textContent;
  btn.textContent = 'Message envoyé ✓';
  btn.style.background = '#27ae60';
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = original;
    btn.style.background = '';
    btn.disabled = false;
    form.reset();
  }, 3000);
});

/* ============================================================
   NAVBAR shrink on scroll
   ============================================================ */
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
  navbar.style.borderBottomColor = window.scrollY > 50
    ? 'rgba(78,205,196,0.15)'
    : 'rgba(255,255,255,0.05)';
}, { passive: true });

/* ============================================================
   AUTH SYSTEM — Supabase
   ============================================================ */

// ── Configuration ─────────────────────────────────────────────
// TODO: Remplacez ces deux valeurs (Project Settings > API dans Supabase)
const SUPABASE_URL = 'https://xerilhfrgzesorantrzp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_QfhTJnfpOPFWYOzj1QxvsQ_aZS2hIEa';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Session locale (synchronisée via onAuthStateChange) ───────
let currentSession = null;

supabase.auth.onAuthStateChange((_event, session) => {
  currentSession = session;
  updateNavUI();
});

// ── Traduction des messages d'erreur Supabase ─────────────────
function translateError(msg) {
  const map = {
    'Invalid login credentials':                               'Email ou mot de passe incorrect.',
    'User already registered':                                 'Un compte existe déjà avec cet email.',
    'Email not confirmed':                                     'Veuillez confirmer votre email avant de vous connecter.',
    'Password should be at least 6 characters':               'Le mot de passe doit comporter au moins 6 caractères.',
    'New password should be different from the old password':  'Le nouveau mot de passe doit être différent de l\'ancien.',
    'Unable to validate email address: invalid format':        'Format d\'email invalide.',
    'Signup requires a valid password':                        'Mot de passe invalide.',
    'Email rate limit exceeded':                               'Trop de tentatives, réessayez dans quelques minutes.',
  };
  return map[msg] || msg;
}

// ── Auth functions ────────────────────────────────────────────
async function authRegister(name, email, password) {
  if (password.length < 6)
    throw new Error('Le mot de passe doit comporter au moins 6 caractères.');
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: name.trim() } },
  });
  if (error) throw new Error(translateError(error.message));
  if (!data.user) throw new Error('Erreur lors de la création du compte.');
  return { id: data.user.id, name: name.trim(), email: data.user.email };
}

async function authLogin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw new Error(translateError(error.message));
  const name = data.user.user_metadata?.full_name || '';
  return { id: data.user.id, name, email: data.user.email };
}

async function authLogout() {
  await supabase.auth.signOut();
  updateNavUI();
  showToast('Vous êtes déconnecté.', 'success');
}

async function authUpdateInfo(_userId, newName, newEmail) {
  const { data, error } = await supabase.auth.updateUser({
    email: newEmail.trim(),
    data: { full_name: newName.trim() },
  });
  if (error) throw new Error(translateError(error.message));
  const name = data.user.user_metadata?.full_name || newName;
  return { id: data.user.id, name, email: data.user.email };
}

async function authUpdatePassword(_userId, currentPw, newPw) {
  if (newPw.length < 6)
    throw new Error('Le nouveau mot de passe doit comporter au moins 6 caractères.');
  // Vérifie l'ancien mot de passe en re-signant
  const { error: verifyErr } = await supabase.auth.signInWithPassword({
    email: currentSession?.user?.email,
    password: currentPw,
  });
  if (verifyErr) throw new Error('Mot de passe actuel incorrect.');
  const { error } = await supabase.auth.updateUser({ password: newPw });
  if (error) throw new Error(translateError(error.message));
}

async function authDeleteAccount() {
  // Nécessite la fonction SQL delete_user() dans Supabase (voir instructions)
  const { error } = await supabase.rpc('delete_user');
  if (error) throw new Error('Impossible de supprimer le compte : ' + error.message);
  await supabase.auth.signOut();
}

// ── UI helpers ────────────────────────────────────────────────
function openModal(id) {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  document.getElementById(id)?.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
  document.body.style.overflow = '';
}
function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  document.body.style.overflow = '';
}

function showToast(msg, type = 'success') {
  let toast = document.getElementById('cu-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cu-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
  toast.innerHTML = `<i class="fas ${icon}"></i><span>${msg}</span>`;
  toast.className = `toast ${type} show`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 3500);
}

function setMsg(id, msg, type = '') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `form-msg ${type}`;
}

function updateNavUI() {
  const user      = currentSession?.user;
  const loggedOut = document.getElementById('btn-open-login');
  const loggedIn  = document.getElementById('nav-user-menu');
  if (!loggedOut || !loggedIn) return;
  if (user) {
    loggedOut.classList.add('hidden');
    loggedIn.classList.remove('hidden');
    const name    = user.user_metadata?.full_name || user.email || '?';
    const initial = name[0].toUpperCase();
    document.getElementById('nav-avatar-initial').textContent = initial;
    document.getElementById('nav-avatar-name').textContent    = name;
  } else {
    loggedOut.classList.remove('hidden');
    loggedIn.classList.add('hidden');
  }
}

// ── Password toggle visibility ────────────────────────────────
document.querySelectorAll('.btn-toggle-pw').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.querySelector('i').className = show ? 'fas fa-eye-slash' : 'fas fa-eye';
  });
});

// ── Modal open / close wiring ─────────────────────────────────
document.getElementById('btn-open-login')
  ?.addEventListener('click', () => openModal('modal-login'));

document.getElementById('switch-to-register')
  ?.addEventListener('click', () => { closeModal('modal-login'); openModal('modal-register'); });

document.getElementById('switch-to-login')
  ?.addEventListener('click', () => { closeModal('modal-register'); openModal('modal-login'); });

document.querySelectorAll('.modal-close').forEach(btn =>
  btn.addEventListener('click', () => closeModal(btn.dataset.modal)));

document.querySelectorAll('.modal-overlay').forEach(overlay =>
  overlay.addEventListener('click', e => { if (e.target === overlay) closeAllModals(); }));

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllModals(); });

// ── Nav avatar dropdown ───────────────────────────────────────
document.getElementById('nav-avatar-toggle')?.addEventListener('click', e => {
  e.stopPropagation();
  const dd      = document.getElementById('nav-user-dropdown');
  const chevron = document.getElementById('nav-chevron');
  const isOpen  = !dd.classList.contains('hidden');
  dd.classList.toggle('hidden', isOpen);
  chevron.classList.toggle('open', !isOpen);
});

document.addEventListener('click', () => {
  document.getElementById('nav-user-dropdown')?.classList.add('hidden');
  document.getElementById('nav-chevron')?.classList.remove('open');
});

document.getElementById('btn-open-settings')?.addEventListener('click', () => {
  document.getElementById('nav-user-dropdown')?.classList.add('hidden');
  document.getElementById('nav-chevron')?.classList.remove('open');
  const user = currentSession?.user;
  if (user) {
    document.getElementById('settings-name').value                = user.user_metadata?.full_name || '';
    document.getElementById('settings-email').value               = user.email || '';
    document.getElementById('settings-email-display').textContent = user.email || '';
  }
  openModal('modal-settings');
});

document.getElementById('btn-logout')?.addEventListener('click', async () => {
  document.getElementById('nav-user-dropdown')?.classList.add('hidden');
  await authLogout();
});

// ── Login form ────────────────────────────────────────────────
document.getElementById('form-login')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Connexion…';
  setMsg('login-msg', '', '');
  try {
    await authLogin(
      document.getElementById('login-email').value,
      document.getElementById('login-password').value
    );
    updateNavUI();
    closeAllModals();
    showToast('Connexion réussie ! Bienvenue.', 'success');
    e.target.reset();
  } catch (err) {
    setMsg('login-msg', err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Se connecter';
  }
});

// ── Register form ─────────────────────────────────────────────
document.getElementById('form-register')?.addEventListener('submit', async e => {
  e.preventDefault();
  const pw  = document.getElementById('reg-password').value;
  const pw2 = document.getElementById('reg-password2').value;
  if (pw !== pw2) { setMsg('register-msg', 'Les mots de passe ne correspondent pas.', 'error'); return; }
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Création…';
  setMsg('register-msg', '', '');
  try {
    await authRegister(
      document.getElementById('reg-name').value,
      document.getElementById('reg-email').value,
      pw
    );
    updateNavUI();
    closeAllModals();
    showToast('Compte créé avec succès ! Bienvenue.', 'success');
    e.target.reset();
  } catch (err) {
    setMsg('register-msg', err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Créer mon compte';
  }
});

// ── Settings — update info ────────────────────────────────────
document.getElementById('form-settings-info')?.addEventListener('submit', async e => {
  e.preventDefault();
  const user = currentSession?.user;
  if (!user) return;
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  setMsg('settings-info-msg', '', '');
  try {
    const updated = await authUpdateInfo(
      user.id,
      document.getElementById('settings-name').value,
      document.getElementById('settings-email').value
    );
    updateNavUI();
    document.getElementById('settings-email-display').textContent = updated.email;
    setMsg('settings-info-msg', 'Informations mises à jour.', 'success');
    showToast('Informations mises à jour.', 'success');
  } catch (err) {
    setMsg('settings-info-msg', err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

// ── Settings — update password ────────────────────────────────
document.getElementById('form-settings-pw')?.addEventListener('submit', async e => {
  e.preventDefault();
  const user = currentSession?.user;
  if (!user) return;
  const newPw  = document.getElementById('settings-pw-new').value;
  const newPw2 = document.getElementById('settings-pw-new2').value;
  if (newPw !== newPw2) { setMsg('settings-pw-msg', 'Les nouveaux mots de passe ne correspondent pas.', 'error'); return; }
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  setMsg('settings-pw-msg', '', '');
  try {
    await authUpdatePassword(
      user.id,
      document.getElementById('settings-pw-current').value,
      newPw
    );
    setMsg('settings-pw-msg', 'Mot de passe mis à jour avec succès.', 'success');
    showToast('Mot de passe mis à jour.', 'success');
    e.target.reset();
  } catch (err) {
    setMsg('settings-pw-msg', err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

// ── Delete account ────────────────────────────────────────────
document.getElementById('btn-delete-account')?.addEventListener('click', async () => {
  const user = currentSession?.user;
  if (!user) return;
  if (!confirm('Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.')) return;
  try {
    await authDeleteAccount();
    closeAllModals();
    updateNavUI();
    showToast('Compte supprimé avec succès.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ── Init — restaure la session au chargement ──────────────────
supabase.auth.getSession().then(({ data }) => {
  currentSession = data.session;
  updateNavUI();
});

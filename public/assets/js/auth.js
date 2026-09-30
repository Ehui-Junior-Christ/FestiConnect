const nextTarget = safeNext(queryParam('next'));

function destinationFor(user) {
  // Un organisateur renvoyé vers une page client irait droit dans un refus : on l'envoie dans son espace.
  if (nextTarget && !(user.role === 'organisateur' && /^\/(client|panier)\.html/.test(nextTarget))) return nextTarget;
  return spaceFor(user);
}

// Conserve la destination de retour quand on bascule entre connexion et inscription.
if (nextTarget) {
  const suffix = `?next=${encodeURIComponent(nextTarget)}`;
  const registerLink = document.querySelector('#register-link');
  const loginLink = document.querySelector('#login-link');
  if (registerLink) registerLink.href = `/inscription.html${suffix}`;
  if (loginLink) loginLink.href = `/connexion.html${suffix}`;
}

/* Connexion
   ------------------------------------------------------------------------ */
const loginForm = document.querySelector('#login-form');
if (loginForm) {
  const current = API.user();
  const info = document.querySelector('#session-info');
  if (current && info) {
    info.innerHTML = `
      <div class="alert alert-info" role="status">${icon('info')}
        <div><strong>Tu es déjà connecté(e) en tant que ${escapeHtml(current.name)}.</strong>
        <span><a href="${spaceFor(current)}">Aller à mon espace</a> ou connecte-toi avec un autre compte.</span></div>
      </div>`;
    info.hidden = false;
  } else if (nextTarget) {
    info.innerHTML = alertBox('info', 'Connecte-toi pour continuer. Tu reviendras directement à ta page.');
    info.hidden = false;
  }

  enhanceForm(loginForm);
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormNotice(loginForm);
    if (!validateForm(loginForm)) return;
    const button = loginForm.querySelector('button[type="submit"]');
    if (button.disabled) return;
    const data = Object.fromEntries(new FormData(loginForm));
    setBusy(button, true);
    try {
      const { token, user } = await API.post('/api/auth/login', data);
      API.setSession(token, user);
      await Favorites.sync();
      location.href = destinationFor(user);
    } catch (error) {
      setBusy(button, false);
      formNotice(loginForm, error.code === 'BAD_CREDENTIALS'
        ? 'Email ou mot de passe incorrect. Vérifie les majuscules et réessaie.'
        : error.message);
      loginForm.elements.password.select();
    }
  });
}

/* Inscription
   ------------------------------------------------------------------------ */
const registerForm = document.querySelector('#register-form');
if (registerForm) {
  const orgHint = registerForm.querySelector('[data-org-hint]');
  const syncRole = () => {
    orgHint.hidden = registerForm.elements.role.value !== 'organisateur';
  };
  if (queryParam('role') === 'organisateur') {
    registerForm.querySelector('input[name="role"][value="organisateur"]').checked = true;
  }
  syncRole();
  registerForm.addEventListener('change', (event) => {
    if (event.target.name === 'role') syncRole();
  });

  enhanceForm(registerForm);
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormNotice(registerForm);
    if (!validateForm(registerForm)) return;
    const button = registerForm.querySelector('button[type="submit"]');
    if (button.disabled) return;
    const data = Object.fromEntries(new FormData(registerForm));
    setBusy(button, true);
    try {
      await API.post('/api/auth/register', data);
      const { token, user } = await API.post('/api/auth/login', { email: data.email, password: data.password });
      API.setSession(token, user);
      await Favorites.sync();
      formNotice(registerForm, 'Compte créé. Redirection vers ton espace…', 'success');
      setTimeout(() => { location.href = destinationFor(user); }, 500);
    } catch (error) {
      setBusy(button, false);
      if (error.code === 'EMAIL_ALREADY_EXISTS') {
        formNotice(registerForm, 'Un compte existe déjà avec cet email.');
        const notice = registerForm.querySelector('[data-form-notice] .alert span');
        const link = document.createElement('a');
        link.href = `/connexion.html${nextTarget ? `?next=${encodeURIComponent(nextTarget)}` : ''}`;
        link.textContent = 'Se connecter avec cet email';
        notice?.append(' ', link);
        setFieldError(registerForm.elements.email, 'Cet email est déjà utilisé.');
      } else if (error.code === 'WEAK_PASSWORD') {
        clearFormNotice(registerForm);
        setFieldError(registerForm.elements.password, error.message);
        registerForm.elements.password.focus();
      } else {
        formNotice(registerForm, error.message);
      }
    }
  });
}

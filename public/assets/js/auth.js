mountLayout();

function setFormNotice(form, message, type = 'error') {
  let notice = form.querySelector('[data-form-notice]');
  if (!notice) {
    notice = document.createElement('div');
    notice.dataset.formNotice = 'true';
    form.prepend(notice);
  }
  notice.className = `notice ${type}`;
  notice.textContent = message;
}

async function withSubmitting(form, label, action) {
  const button = form.querySelector('button[type="submit"]');
  const original = button?.innerHTML;
  if (button?.disabled) return;
  if (button) {
    button.disabled = true;
    button.innerHTML = label;
  }
  try {
    return await action();
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = original;
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

document.querySelector('#login-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(event.currentTarget));
  await withSubmitting(form, 'Connexion...', async () => {
    try {
      const { token, user } = await API.post('/api/auth/login', data);
      API.setSession(token, user);
      const target = user.role === 'admin' ? '/admin.html' : user.role === 'organisateur' ? '/organisateur.html' : '/client.html';
      location.href = target;
    } catch (error) {
      setFormNotice(form, error.message);
      toast(error.message);
    }
  });
});

document.querySelector('#register-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  await withSubmitting(form, 'Creation...', async () => {
    try {
      await API.post('/api/auth/register', data);
      const { token, user } = await API.post('/api/auth/login', {
        email: data.email,
        password: data.password
      });
      API.setSession(token, user);
      setFormNotice(form, 'Compte cree. Redirection vers ton espace...', 'success');
      const target = user.role === 'organisateur' ? '/organisateur.html' : '/client.html';
      setTimeout(() => location.href = target, 450);
    } catch (error) {
      const message = error.message.includes('existe deja')
        ? 'Ce compte existe deja. Utilise la page connexion avec cet email.'
        : error.message;
      setFormNotice(form, message);
      toast(message);
    }
  });
});

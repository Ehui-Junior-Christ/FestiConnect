mountLayout();

document.querySelector('#login-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const { token, user } = await API.post('/api/auth/login', data);
    API.setSession(token, user);
    const target = user.role === 'admin' ? '/admin.html' : user.role === 'organisateur' ? '/organisateur.html' : '/client.html';
    location.href = target;
  } catch (error) {
    toast(error.message);
  }
});

document.querySelector('#register-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    await API.post('/api/auth/register', data);
    toast('Compte cree. Connecte-toi pour continuer.');
    setTimeout(() => location.href = '/connexion.html', 900);
  } catch (error) {
    toast(error.message);
  }
});


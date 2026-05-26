const API = {
  tokenKey: 'festiconnect_token',
  userKey: 'festiconnect_user',

  token() {
    return localStorage.getItem(this.tokenKey);
  },

  user() {
    const raw = localStorage.getItem(this.userKey);
    return raw ? JSON.parse(raw) : null;
  },

  setSession(token, user) {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userKey, JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  },

  async request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = this.token();
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(path, { ...options, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error?.message || 'Une erreur est survenue.');
    }
    return body;
  },

  get(path) {
    return this.request(path);
  },

  post(path, data) {
    return this.request(path, { method: 'POST', body: JSON.stringify(data) });
  },

  patch(path, data) {
    return this.request(path, { method: 'PATCH', body: JSON.stringify(data) });
  }
};

function formatMoney(value) {
  return new Intl.NumberFormat('fr-CI', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function toast(message) {
  const node = document.querySelector('#toast') || document.createElement('div');
  node.id = 'toast';
  node.className = 'toast';
  node.textContent = message;
  document.body.appendChild(node);
  requestAnimationFrame(() => node.classList.add('show'));
  setTimeout(() => node.classList.remove('show'), 2800);
}

function requireRole(roles) {
  const user = API.user();
  if (!user || !roles.includes(user.role)) {
    location.href = '/connexion.html';
  }
  return user;
}


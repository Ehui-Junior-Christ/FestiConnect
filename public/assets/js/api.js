/*
 * Client HTTP de FestiConnect.
 * Endpoints, méthodes et formats de requête/réponse : ceux du serveur.
 * L'authentification repose sur le cookie de session HttpOnly (SameSite=Strict)
 * envoyé automatiquement par fetch en same-origin. Seul le profil public de
 * l'utilisateur est gardé en localStorage, pour afficher l'interface.
 */
const API = {
  tokenKey: 'festiconnect_token', // ancienne clé : le jeton n'est plus stocké côté client
  userKey: 'festiconnect_user',

  user() {
    try {
      const raw = localStorage.getItem(this.userKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  // La signature reste (token, user) : le jeton renvoyé par /api/auth/login est ignoré,
  // le cookie de session posé par le serveur suffit.
  setSession(_token, user) {
    try {
      localStorage.removeItem(this.tokenKey);
      localStorage.setItem(this.userKey, JSON.stringify(user));
    } catch {
      /* stockage indisponible (navigation privée) : l'interface reste utilisable */
    }
  },

  clearSession() {
    try {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.userKey);
    } catch {
      /* rien à nettoyer */
    }
  },

  // Messages affichés, par code d'erreur renvoyé par l'API.
  messages: {
    AUTH_REQUIRED: 'Ta session a expiré. Reconnecte-toi pour continuer.',
    FORBIDDEN: "Ton compte n'a pas accès à cette action.",
    BAD_CREDENTIALS: 'Email ou mot de passe incorrect.',
    EMAIL_ALREADY_EXISTS: 'Un compte existe déjà avec cet email.',
    EVENT_NOT_FOUND: "Cet événement n'est plus disponible à la réservation.",
    PRODUCT_NOT_FOUND: "Un article de ton panier n'est plus disponible.",
    SOLD_OUT: "Il ne reste plus assez de places pour ce nombre de billets. Réduis la quantité ou choisis une autre date.",
    CSRF_REJECTED: "Ta demande n'a pas pu être vérifiée. Recharge la page puis réessaie.",
    NOT_FOUND: 'Ce contenu est introuvable. Il a peut-être été retiré.',
    INTERNAL_ERROR: 'Le service rencontre un souci. Réessaie dans un instant.',
    NETWORK: 'Impossible de joindre FestiConnect. Vérifie ta connexion internet et réessaie.'
  },

  // Les messages du serveur sont rédigés en français correct : on les affiche tels quels
  // (hors erreurs 5xx, remplacées par un message générique).
  errorMessage(code, serverMessage, response) {
    if (code === 'RATE_LIMITED') {
      const seconds = Number(response.headers.get('Retry-After'));
      if (!seconds) return 'Trop de tentatives. Patiente un peu avant de réessayer.';
      const minutes = Math.ceil(seconds / 60);
      return `Trop de tentatives. Réessaie dans ${minutes > 1 ? `${minutes} minutes` : 'une minute'}.`;
    }
    if (code === 'OUT_OF_STOCK') {
      return `${serverMessage || 'Stock insuffisant.'} Réduis la quantité dans ton panier.`;
    }
    if (this.messages[code]) return this.messages[code];
    if (serverMessage && response.status < 500) return serverMessage;
    return response.status >= 500 ? this.messages.INTERNAL_ERROR : 'Une erreur est survenue. Réessaie.';
  },

  async request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json', ...(options.headers || {}) };

    let response;
    try {
      response = await fetch(path, { credentials: 'same-origin', ...options, headers });
    } catch {
      const error = new Error(this.messages.NETWORK);
      error.code = 'NETWORK';
      error.status = 0;
      throw error;
    }

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = body.error?.code || '';
      const error = new Error(this.errorMessage(code, body.error?.message, response));
      error.code = code;
      error.status = response.status;
      error.serverMessage = body.error?.message || '';
      // Session expirée ou révoquée : on oublie le profil affiché.
      if (response.status === 401 && code !== 'BAD_CREDENTIALS') this.clearSession();
      throw error;
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

/*
 * Briques d'interface partagées par toutes les pages.
 * Règle d'or : toute donnée venant de l'API, de l'URL ou de l'utilisateur
 * passe par escapeHtml() (ou textContent) avant d'entrer dans le DOM.
 * Aucun style inline, aucun handler inline : compatible CSP stricte.
 */

/* Échappement et URL sûres
   ------------------------------------------------------------------------ */
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// N'autorise que les chemins locaux ("/...") et les URL http(s).
function safeUrl(value, fallback = '') {
  const url = String(value ?? '').trim();
  if (/^\/(?![/\\])/.test(url)) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return fallback;
}

// Destination de retour après connexion : chemin local uniquement.
function safeNext(value) {
  const next = String(value ?? '');
  return /^\/(?![/\\])/.test(next) ? next : '';
}

function queryParam(name) {
  return new URLSearchParams(location.search).get(name);
}

/* Icônes (tracé fin, 24x24, dessinées pour FestiConnect)
   ------------------------------------------------------------------------ */
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  ticket: '<path d="M2.5 9a3 3 0 0 0 0 6v2.5a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2V15a3 3 0 0 1 0-6V6.5a2 2 0 0 0-2-2h-15a2 2 0 0 0-2 2Z"/><path d="M14 4.5v2M14 11v2M14 17.5v2"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.2a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.8" r="2.6"/>',
  bag: '<path d="M5 8h14l-1.1 11.6a1.6 1.6 0 0 1-1.6 1.4H7.7a1.6 1.6 0 0 1-1.6-1.4Z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/>',
  cart: '<circle cx="9" cy="20" r="1.3"/><circle cx="17.5" cy="20" r="1.3"/><path d="M2.5 3.5h2.4l2.3 11a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.2L20.8 7.5H5.7"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5M15 12H3"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6.5H9V21H4a1 1 0 0 1-1-1Z"/>',
  store: '<path d="M3.5 9 5 4h14l1.5 5"/><path d="M3.5 9a2.8 2.8 0 0 0 5.5 0 2.8 2.8 0 0 0 6 0 2.8 2.8 0 0 0 5.5 0"/><path d="M5 11.5V20h14v-8.5M10 20v-5h4v5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12.4 2.8 2.8L16.4 9.6"/>',
  'x-circle': '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.01"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'arrow-left': '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
  phone: '<path d="M5 3.5h3.3l1.6 4.6-2.2 1.4a11.5 11.5 0 0 0 6.8 6.8l1.4-2.2 4.6 1.6V19a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3 5.5a2 2 0 0 1 2-2Z"/>',
  mobile: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18h2"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
  copy: '<rect x="8" y="8" width="12.5" height="12.5" rx="2"/><path d="M16 8V5.5a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2H8"/>',
  wallet: '<path d="M19 7.5V5.5a1.5 1.5 0 0 0-1.5-1.5H5a2 2 0 0 0 0 4h14.5A1.5 1.5 0 0 1 21 9.5v9a1.5 1.5 0 0 1-1.5 1.5H5a2 2 0 0 1-2-2V6"/><path d="M16.5 14h.01"/>',
  scan: '<path d="M3 7.5V5a2 2 0 0 1 2-2h2.5M16.5 3H19a2 2 0 0 1 2 2v2.5M21 16.5V19a2 2 0 0 1-2 2h-2.5M7.5 21H5a2 2 0 0 1-2-2v-2.5M7 12h10"/>',
  dashboard: '<rect x="3" y="3" width="7.5" height="9" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="5" rx="1.5"/><rect x="13.5" y="11" width="7.5" height="10" rx="1.5"/><rect x="3" y="15" width="7.5" height="6" rx="1.5"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6Z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  send: '<path d="M21 3 10.5 13.5"/><path d="m21 3-6.5 18-4-7.5-7.5-4Z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4h6v3"/>',
  chart: '<path d="M3 20.5h18M6.5 16.5v-5M11.5 16.5V6M16.5 16.5V9.5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>',
  eye: '<path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="m3 3 18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.9 3.8M6.6 6.6A16.8 16.8 0 0 0 2.5 12S6 19 12 19a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/>',
  truck: '<path d="M2.5 6h11.5v10.5H2.5zM14 9.5h4l3.5 3.5v3.5H14"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
  lock: '<rect x="4" y="10.5" width="16" height="10.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  music: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  file: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  'plus-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1-4.5-4.2 6.1-.8Z"/>'
};

function icon(name, className = '') {
  const paths = ICONS[name];
  if (!paths) return '';
  return `<span class="icon ${className}" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${paths}</svg></span>`;
}

// Remplace les <span data-icon="nom"></span> du HTML statique.
function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((node) => {
    if (node.dataset.hydrated) return;
    const paths = ICONS[node.dataset.icon];
    if (!paths) return;
    node.classList.add('icon');
    node.setAttribute('aria-hidden', 'true');
    node.innerHTML = `<svg viewBox="0 0 24 24" focusable="false">${paths}</svg>`;
    node.dataset.hydrated = 'true';
  });
}

const BRAND_MARK = '<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path class="mark-bg" d="M6 3h20a3 3 0 0 1 3 3v6.2a3.8 3.8 0 0 0 0 7.6V26a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-6.2a3.8 3.8 0 0 0 0-7.6V6a3 3 0 0 1 3-3Z"/><path class="mark-f" d="M12 22.5V9.5h8.5M12 16h6" fill="none" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* Formats : FCFA, dates en français
   ------------------------------------------------------------------------ */
const NUMBER_FR = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

// Espace insécable classique : l'espace fine (U+202F) d'Intl n'existe pas dans toutes les polices.
function formatNumber(value) {
  return NUMBER_FR.format(Number(value || 0)).replace(/\s/g, '\u00a0');
}

function formatMoney(value) {
  return `${formatNumber(value)} FCFA`;
}

function formatPrice(value) {
  return Number(value || 0) === 0 ? 'Gratuit' : formatMoney(value);
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTime(value) {
  const date = parseDate(value);
  if (!date) return '';
  return `${String(date.getHours()).padStart(2, '0')}h${String(date.getMinutes()).padStart(2, '0')}`;
}

// « sam. 14 août 2026 à 18h00 »
function formatDate(value) {
  const date = parseDate(value);
  if (!date) return 'Date à confirmer';
  const day = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  return `${day} à ${formatTime(date)}`;
}

// « samedi 14 août 2026 »
function formatDay(value) {
  const date = parseDate(value);
  if (!date) return 'Date à confirmer';
  const text = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// « sam. 14 août · 18h00 »
function formatDateShort(value) {
  const date = parseDate(value);
  if (!date) return 'Date à confirmer';
  const day = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
  return `${day} · ${formatTime(date)}`;
}

function formatTimeRange(start, end) {
  const from = parseDate(start);
  const to = parseDate(end);
  if (!from) return '';
  if (!to || to <= from) return `À partir de ${formatTime(from)}`;
  const nextDay = to.toDateString() !== from.toDateString();
  return `De ${formatTime(from)} à ${formatTime(to)}${nextDay ? ' (le lendemain)' : ''}`;
}

function dateParts(value) {
  const date = parseDate(value);
  if (!date) return { day: '--', month: 'date' };
  return {
    day: String(date.getDate()),
    month: new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(date).replace('.', '')
  };
}

function plural(count, singular, pluralForm) {
  return `${formatNumber(count)} ${Number(count) > 1 ? pluralForm : singular}`;
}

function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';
}

/* Session, rôles
   ------------------------------------------------------------------------ */
const ROLE_LABELS = { client: 'Client', organisateur: 'Organisateur', admin: 'Administration' };

function spaceFor(user) {
  if (!user) return '/connexion.html';
  if (user.role === 'admin') return '/admin.html';
  if (user.role === 'organisateur') return '/organisateur.html';
  return '/client.html';
}

function loginUrl(next = location.pathname + location.search + location.hash) {
  const target = safeNext(next);
  return target ? `/connexion.html?next=${encodeURIComponent(target)}` : '/connexion.html';
}

// Protège une page : renvoie l'utilisateur, ou redirige et renvoie null.
function requireRole(roles) {
  const user = API.user();
  if (!user) {
    location.replace(loginUrl());
    return null;
  }
  if (!roles.includes(user.role)) {
    location.replace(spaceFor(user));
    return null;
  }
  return user;
}

async function logout() {
  await API.post('/api/auth/logout', {}).catch(() => null);
  API.clearSession();
  location.href = '/';
}

/* Panier (localStorage, même clé et même format qu'avant)
   ------------------------------------------------------------------------ */
const Cart = {
  key: 'festiconnect_cart',

  items() {
    try {
      const items = JSON.parse(localStorage.getItem(this.key) || '[]');
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  },

  save(items) {
    localStorage.setItem(this.key, JSON.stringify(items));
    document.dispatchEvent(new CustomEvent('cart:change'));
  },

  count() {
    return this.items().reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  },

  total() {
    return this.items().reduce((sum, item) => sum + Number(item.price_xof || 0) * Number(item.quantity || 0), 0);
  },

  add(product, quantity) {
    const items = this.items();
    const found = items.find((item) => item.product_id === product.id);
    if (found) found.quantity = Number(found.quantity) + quantity;
    else items.push({ product_id: product.id, quantity, name: product.name, price_xof: product.price_xof, image_url: product.image_url });
    this.save(items);
  },

  setQuantity(productId, quantity) {
    const items = this.items();
    const found = items.find((item) => item.product_id === productId);
    if (found) found.quantity = quantity;
    this.save(items);
  },

  remove(productId) {
    this.save(this.items().filter((item) => item.product_id !== productId));
  },

  clear() {
    localStorage.removeItem(this.key);
    document.dispatchEvent(new CustomEvent('cart:change'));
  }
};

function updateCartBadges() {
  const count = Cart.count();
  document.querySelectorAll('[data-cart-count]').forEach((node) => {
    node.textContent = count > 99 ? '99+' : String(count);
    node.hidden = count === 0;
  });
  document.querySelectorAll('[data-cart-link]').forEach((node) => {
    node.setAttribute('aria-label', count ? `Panier, ${plural(count, 'article', 'articles')}` : 'Panier, vide');
  });
}

/* Structure commune : en-tête, barre d'onglets mobile, pied de page
   ------------------------------------------------------------------------ */
function mountLayout(active = document.body.dataset.nav || '') {
  const user = API.user();
  const current = (key) => (active === key ? ' aria-current="page"' : '');
  const firstName = user ? String(user.name || '').split(/\s+/)[0] : '';

  const header = document.querySelector('[data-header]');
  if (header) {
    header.innerHTML = `
      <div class="container header-inner">
        <a class="brand" href="/" aria-label="FestiConnect, retour à l'accueil">${BRAND_MARK}<span>FestiConnect<span class="brand-dot">.</span></span></a>
        <nav class="nav-links" aria-label="Navigation principale">
          <a href="/evenements.html"${current('events')}>Événements</a>
          <a href="/boutique.html"${current('shop')}>Boutique</a>
          <a href="/aide.html"${current('support')}>Aide</a>
        </nav>
        <div class="header-actions">
          <a class="icon-link hide-mobile" href="/panier.html" data-cart-link>${icon('cart')}<span class="count-badge" data-cart-count hidden></span></a>
          ${user
            ? `<a class="user-chip" href="${spaceFor(user)}" title="Mon espace"><span class="avatar">${escapeHtml(initials(user.name))}</span><span>${escapeHtml(firstName)}</span></a>
               <button class="btn btn-ghost btn-icon hide-mobile" type="button" data-logout aria-label="Se déconnecter" title="Se déconnecter">${icon('logout')}</button>`
            : `<a class="btn btn-ghost btn-sm" href="${loginUrl()}">Connexion</a>
               <a class="btn btn-primary btn-sm hide-mobile" href="/inscription.html">Créer un compte</a>`}
        </div>
      </div>`;
  }

  const tabbar = document.querySelector('[data-tabbar]');
  if (tabbar) {
    tabbar.setAttribute('aria-label', 'Navigation rapide');
    tabbar.innerHTML = `
      <a href="/"${current('home')}>${icon('home')}<span>Accueil</span></a>
      <a href="/evenements.html"${current('events')}>${icon('ticket')}<span>Sorties</span></a>
      <a href="/boutique.html"${current('shop')}>${icon('store')}<span>Boutique</span></a>
      <a href="/panier.html"${current('cart')} data-cart-link>${icon('cart')}<span>Panier</span><span class="count-badge" data-cart-count hidden></span></a>
      <a href="${user ? spaceFor(user) : loginUrl()}"${current('account')}>${icon('user')}<span>${user ? 'Mon espace' : 'Compte'}</span></a>`;
  }

  const footer = document.querySelector('[data-footer]');
  if (footer) {
    footer.innerHTML = `
      <div class="container footer-grid">
        <div>
          <a class="brand" href="/">${BRAND_MARK}<span>FestiConnect<span class="brand-dot">.</span></span></a>
          <p class="footer-about">Billetterie et boutique culturelle pour les concerts, festivals et défilés de Côte d'Ivoire. Paiement Mobile Money, billet dans ton espace.</p>
        </div>
        <nav aria-label="Sortir">
          <p class="footer-title">Sortir</p>
          <ul class="footer-links">
            <li><a href="/evenements.html">Tous les événements</a></li>
            <li><a href="/evenements.html?city=Abidjan">À Abidjan</a></li>
            <li><a href="/boutique.html">Boutique</a></li>
            <li><a href="/panier.html">Panier</a></li>
          </ul>
        </nav>
        <nav aria-label="Comptes">
          <p class="footer-title">Comptes</p>
          <ul class="footer-links">
            <li><a href="/client.html">Espace client</a></li>
            <li><a href="/organisateur.html">Espace organisateur</a></li>
            <li><a href="/inscription.html?role=organisateur">Vendre des billets</a></li>
          </ul>
        </nav>
        <nav aria-label="Aide et informations légales">
          <p class="footer-title">Aide</p>
          <ul class="footer-links">
            <li><a href="/aide.html">Centre d'aide</a></li>
            <li><a href="/contact.html">Contact</a></li>
            <li><a href="/conditions.html">Conditions d'utilisation</a></li>
            <li><a href="/confidentialite.html">Confidentialité</a></li>
            <li><a href="/mentions-legales.html">Mentions légales</a></li>
          </ul>
        </nav>
      </div>
      <div class="container footer-bottom">
        <span>© ${new Date().getFullYear()} FestiConnect · Abidjan, Côte d'Ivoire</span>
        <ul class="payment-list" aria-label="Moyens de paiement acceptés"><li>Wave</li><li>Orange Money</li><li>Moov Money</li></ul>
      </div>`;
  }

  updateCartBadges();
}

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-logout]')) {
    event.preventDefault();
    logout();
  }
});
document.addEventListener('cart:change', updateCartBadges);
window.addEventListener('storage', (event) => {
  if (event.key === Cart.key) updateCartBadges();
});

/* Retours utilisateur : toasts, alertes, dialogue
   ------------------------------------------------------------------------ */
function toastRegion() {
  let region = document.querySelector('.toast-region');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  return region;
}

// toast('Texte') ou toast('Texte', { type: 'success' | 'error' | 'info', action: { label, href } })
function toast(message, options = {}) {
  const type = options.type || 'info';
  const node = document.createElement('div');
  node.className = `toast toast-${type}`;
  const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert' : 'info';
  node.innerHTML = `${icon(iconName)}<span class="toast-msg"></span>`;
  node.querySelector('.toast-msg').textContent = message;
  if (options.action?.href) {
    const link = document.createElement('a');
    link.href = safeUrl(options.action.href, '/');
    link.textContent = options.action.label;
    node.appendChild(link);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toast-close';
  close.setAttribute('aria-label', 'Fermer le message');
  close.innerHTML = icon('x');
  node.appendChild(close);

  const region = toastRegion();
  region.querySelectorAll('.toast').forEach((old, index, all) => {
    if (all.length - index > 2) old.remove();
  });
  region.appendChild(node);
  requestAnimationFrame(() => node.classList.add('show'));

  const dismiss = () => {
    node.classList.remove('show');
    setTimeout(() => node.remove(), 250);
  };
  close.addEventListener('click', dismiss);
  setTimeout(dismiss, options.duration || (type === 'error' ? 6000 : 4000));
}

function alertBox(type, message, title = '') {
  const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert' : type === 'warning' ? 'alert' : 'info';
  return `<div class="alert alert-${type}" role="${type === 'error' ? 'alert' : 'status'}">${icon(iconName)}<div>${title ? `<strong>${escapeHtml(title)}</strong>` : ''}<span>${escapeHtml(message)}</span></div></div>`;
}

function confirmDialog({ title, message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', danger = false }) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'dialog';
    dialog.setAttribute('aria-labelledby', 'dialog-title');
    dialog.innerHTML = `
      <form method="dialog">
        <h2 id="dialog-title" class="h3"></h2>
        <p class="muted"></p>
        <div class="cluster">
          <button class="btn btn-ghost" value="cancel" type="submit"></button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" value="confirm" type="submit"></button>
        </div>
      </form>`;
    dialog.querySelector('h2').textContent = title;
    dialog.querySelector('p').textContent = message;
    dialog.querySelector('[value="cancel"]').textContent = cancelLabel;
    dialog.querySelector('[value="confirm"]').textContent = confirmLabel;
    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'confirm');
      dialog.remove();
    });
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else resolve(window.confirm(`${title}\n\n${message}`));
  });
}

/* États : vide, erreur, chargement
   ------------------------------------------------------------------------ */
function actionLink({ label, href, variant = 'secondary', icon: iconName }) {
  return `<a class="btn btn-${variant}" href="${escapeHtml(safeUrl(href, '/'))}">${iconName ? icon(iconName) : ''}<span>${escapeHtml(label)}</span></a>`;
}

function emptyState({ title, message = '', actions = [], art = '/assets/img/empty-ticket.svg' }) {
  return `
    <div class="empty">
      ${art ? `<img class="empty-art" src="${escapeHtml(art)}" alt="" width="120" height="96">` : ''}
      <h3>${escapeHtml(title)}</h3>
      ${message ? `<p>${escapeHtml(message)}</p>` : ''}
      ${actions.length ? `<div class="cluster">${actions.map(actionLink).join('')}</div>` : ''}
    </div>`;
}

// Affiche une erreur avec un bouton « Réessayer » qui relance le chargement.
function renderError(container, error, retry) {
  if (!container) return;
  container.innerHTML = `
    <div class="empty empty-error" role="alert">
      <h3>Chargement impossible</h3>
      <p>${escapeHtml(error?.message || 'Une erreur est survenue.')}</p>
      ${retry ? `<div class="cluster"><button class="btn btn-secondary" type="button" data-retry>${icon('refresh')}<span>Réessayer</span></button></div>` : ''}
    </div>`;
  container.querySelector('[data-retry]')?.addEventListener('click', retry);
}

function skeletonCards(count = 3, kind = 'event') {
  const media = kind === 'product' ? 'sk-media-square' : 'sk-media';
  return Array.from({ length: count }, () => `
    <div class="card card-skeleton" aria-hidden="true">
      <div class="skeleton ${media}"></div>
      <div class="body">
        <div class="skeleton sk-title"></div>
        <div class="skeleton sk-line sk-w80"></div>
        <div class="skeleton sk-line sk-w60"></div>
        <div class="skeleton sk-line sk-w40 mt-4"></div>
      </div>
    </div>`).join('');
}

function skeletonStats(count = 4) {
  return Array.from({ length: count }, () => '<div class="skeleton sk-block" aria-hidden="true"></div>').join('');
}

function skeletonRows(rows = 3, cols = 5) {
  return Array.from({ length: rows }, () => `<tr aria-hidden="true">${Array.from({ length: cols }, () => '<td><div class="skeleton sk-line"></div></td>').join('')}</tr>`).join('');
}

function setLoading(container, busy) {
  if (container) container.setAttribute('aria-busy', busy ? 'true' : 'false');
}

/* Cartes
   ------------------------------------------------------------------------ */
function eventUrl(event) {
  return `/evenement.html?id=${encodeURIComponent(event.id)}`;
}

function productUrl(product) {
  return `/produit.html?id=${encodeURIComponent(product.id)}`;
}

function seatsLeft(event) {
  const capacity = Number(event.capacity || 0);
  if (!capacity) return null;
  return Math.max(0, capacity - Number(event.tickets_sold || 0));
}

function eventCard(event) {
  const parts = dateParts(event.starts_at);
  const left = seatsLeft(event);
  const scarce = left !== null && left > 0 && left <= Math.max(20, Number(event.capacity) * 0.15);
  const place = [event.location, event.city].filter(Boolean).filter((v, i, all) => all.indexOf(v) === i).join(', ');
  return `
    <article class="card card-link event-card">
      <div class="media">
        <img src="${escapeHtml(safeUrl(event.cover_url, '/assets/img/event-default.svg'))}" alt="" loading="lazy" width="960" height="600">
        ${event.category ? `<span class="badge badge-solid">${escapeHtml(event.category)}</span>` : ''}
        <div class="date-stub" aria-hidden="true"><span class="day">${escapeHtml(parts.day)}</span><span class="month">${escapeHtml(parts.month)}</span></div>
      </div>
      <div class="body">
        <h3><a class="stretched" href="${eventUrl(event)}">${escapeHtml(event.title)}</a></h3>
        <ul class="meta">
          <li>${icon('calendar')}<span>${escapeHtml(formatDateShort(event.starts_at))}</span></li>
          ${place ? `<li>${icon('pin')}<span>${escapeHtml(place)}</span></li>` : ''}
        </ul>
        ${left === 0 ? '<span class="badge badge-danger">Complet</span>' : scarce ? `<span class="badge badge-warning badge-dot">Plus que ${formatNumber(left)} places</span>` : ''}
        <div class="card-foot">
          <span class="price${Number(event.price_xof) === 0 ? ' price-free' : ''}">${escapeHtml(formatPrice(event.price_xof))}</span>
          <span class="card-cta" aria-hidden="true">Réserver${icon('arrow-right')}</span>
        </div>
      </div>
    </article>`;
}

function productCard(product) {
  return `
    <article class="card card-link product-card">
      <div class="media">
        <img src="${escapeHtml(safeUrl(product.image_url, '/assets/img/product-default.svg'))}" alt="" loading="lazy" width="800" height="800">
      </div>
      <div class="body">
        ${product.category ? `<span class="category">${escapeHtml(product.category)}</span>` : ''}
        <h3><a class="stretched" href="${productUrl(product)}">${escapeHtml(product.name)}</a></h3>
        ${product.description ? `<p class="desc">${escapeHtml(product.description)}</p>` : ''}
        <div class="card-foot">
          <span class="price">${escapeHtml(formatMoney(product.price_xof))}</span>
          <span class="card-cta" aria-hidden="true">Voir${icon('arrow-right')}</span>
        </div>
      </div>
    </article>`;
}

const STATUS = {
  approved: ['Validé', 'success'],
  pending: ['En attente', 'warning'],
  rejected: ['Refusé', 'danger'],
  paid: ['Payé', 'success']
};

function statusBadge(status) {
  const [label, tone] = STATUS[status] || [status || 'Inconnu', 'neutral'];
  return `<span class="badge badge-${tone} badge-dot">${escapeHtml(label)}</span>`;
}

/* Formulaires : validation inline, états d'envoi
   ------------------------------------------------------------------------ */
function fieldMessage(field) {
  const v = field.validity;
  const d = field.dataset;
  if (v.valueMissing) return d.msgRequired || (field.type === 'radio' ? 'Choisis une option.' : 'Ce champ est obligatoire.');
  if (v.typeMismatch && field.type === 'email') return 'Saisis une adresse email valide, par exemple nom@exemple.com.';
  if (v.typeMismatch) return 'Format invalide.';
  if (v.tooShort) return `Au moins ${field.minLength} caractères (${field.value.length} pour l'instant).`;
  if (v.rangeUnderflow) return d.msgMin || `La valeur minimale est ${field.min}.`;
  if (v.rangeOverflow) return d.msgMax || `La valeur maximale est ${field.max}.`;
  if (v.stepMismatch) return 'Saisis un nombre entier.';
  if (v.badInput) return 'Saisis un nombre valide.';
  if (v.patternMismatch) return d.msgPattern || 'Format invalide.';
  if (v.customError) return field.validationMessage;
  return '';
}

function setFieldError(field, message) {
  const container = field.closest('.field') || field.parentElement;
  const id = `${field.id || field.name}-error`;
  let node = container.querySelector(`#${CSS.escape(id)}`);
  const describedBy = (field.getAttribute('aria-describedby') || '').split(' ').filter((token) => token && token !== id);
  if (message) {
    if (!node) {
      node = document.createElement('p');
      node.className = 'field-error';
      node.id = id;
      container.appendChild(node);
    }
    node.innerHTML = icon('alert');
    node.append(message);
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', [...describedBy, id].join(' '));
  } else {
    node?.remove();
    field.removeAttribute('aria-invalid');
    if (describedBy.length) field.setAttribute('aria-describedby', describedBy.join(' '));
    else field.removeAttribute('aria-describedby');
  }
}

function validateField(field) {
  if (!field.willValidate) return true;
  const message = fieldMessage(field);
  setFieldError(field, message);
  return !message;
}

// Valide tout le formulaire, affiche les erreurs et place le focus sur la première.
function validateForm(form) {
  const fields = [...form.elements].filter((field) => field.willValidate && field.type !== 'radio');
  let first = null;
  fields.forEach((field) => {
    if (!validateField(field) && !first) first = field;
  });
  if (first) first.focus();
  return !first;
}

// Validation « douce » : au blur une fois le champ touché, puis à chaque saisie.
function enhanceForm(form) {
  if (!form || form.dataset.enhanced) return;
  form.dataset.enhanced = 'true';
  form.noValidate = true;
  form.addEventListener('blur', (event) => {
    const field = event.target;
    if (!field.willValidate || field.type === 'radio') return;
    if (field.value !== '' || field.dataset.touched) {
      field.dataset.touched = 'true';
      validateField(field);
    }
  }, true);
  form.addEventListener('input', (event) => {
    const field = event.target;
    if (field.getAttribute('aria-invalid') === 'true') validateField(field);
  });
}

function formNotice(form, message, type = 'error') {
  let notice = form.querySelector('[data-form-notice]');
  if (!notice) {
    notice = document.createElement('div');
    notice.dataset.formNotice = 'true';
    form.prepend(notice);
  }
  notice.innerHTML = alertBox(type, message);
  notice.hidden = false;
  if (type === 'error') notice.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function clearFormNotice(form) {
  const notice = form.querySelector('[data-form-notice]');
  if (notice) notice.hidden = true;
}

function setBusy(button, busy) {
  if (!button) return;
  button.disabled = busy;
  button.classList.toggle('is-loading', busy);
  button.setAttribute('aria-busy', busy ? 'true' : 'false');
}

/* Petits composants interactifs
   ------------------------------------------------------------------------ */
function stepper({ name, value = 1, min = 1, max = 99, label, small = false, id }) {
  const inputId = id || `qty-${name}-${Math.random().toString(36).slice(2, 7)}`;
  return `
    <div class="stepper${small ? ' stepper-sm' : ''}" data-stepper>
      <button type="button" data-step="-1" aria-label="Retirer un">${icon('minus')}</button>
      <input id="${escapeHtml(inputId)}" name="${escapeHtml(name)}" type="number" inputmode="numeric" value="${Number(value)}" min="${Number(min)}" max="${Number(max)}" step="1" aria-label="${escapeHtml(label)}">
      <button type="button" data-step="1" aria-label="Ajouter un">${icon('plus')}</button>
    </div>`;
}

function syncStepper(wrapper) {
  const input = wrapper.querySelector('input');
  const value = Number(input.value);
  wrapper.querySelector('[data-step="-1"]').disabled = value <= Number(input.min || 1);
  wrapper.querySelector('[data-step="1"]').disabled = input.max !== '' && value >= Number(input.max);
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-stepper] [data-step]');
  if (!button) return;
  const wrapper = button.closest('[data-stepper]');
  const input = wrapper.querySelector('input');
  const min = Number(input.min || 1);
  const max = input.max === '' ? Infinity : Number(input.max);
  const next = Math.min(max, Math.max(min, (Number(input.value) || min) + Number(button.dataset.step)));
  input.value = String(next);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
});

document.addEventListener('input', (event) => {
  const wrapper = event.target.closest?.('[data-stepper]');
  if (wrapper) syncStepper(wrapper);
});

document.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-toggle-password]');
  if (!toggle) return;
  const input = document.getElementById(toggle.getAttribute('aria-controls'));
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  toggle.setAttribute('aria-pressed', String(show));
  toggle.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  toggle.innerHTML = icon(show ? 'eye-off' : 'eye');
});

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.className = 'sr-only';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

async function shareLink({ title, url = location.href }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  const ok = await copyText(url);
  toast(ok ? 'Lien copié. Tu peux le coller dans WhatsApp ou ailleurs.' : 'Copie impossible, sélectionne l\'adresse dans la barre du navigateur.', { type: ok ? 'success' : 'error' });
}

// Menu des espaces connectés : met en évidence la section visible.
function initDashNav() {
  const links = [...document.querySelectorAll('.dash-nav a[href^="#"]')];
  if (!links.length || !('IntersectionObserver' in window)) return;
  const setCurrent = (id) => links.forEach((link) => {
    if (link.getAttribute('href') === `#${id}`) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  });
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (visible[0]) setCurrent(visible[0].target.id);
  }, { rootMargin: '-20% 0px -60% 0px' });
  links.forEach((link) => {
    const section = document.getElementById(link.getAttribute('href').slice(1));
    if (section) observer.observe(section);
  });
}

function fillUserIdentity(user) {
  document.querySelectorAll('[data-user-name]').forEach((node) => { node.textContent = user.name; });
  document.querySelectorAll('[data-user-initials]').forEach((node) => { node.textContent = initials(user.name); });
  document.querySelectorAll('[data-user-first]').forEach((node) => { node.textContent = String(user.name || '').split(/\s+/)[0]; });
}

/* Démarrage commun
   ------------------------------------------------------------------------ */
mountLayout();
hydrateIcons();
document.querySelectorAll('[data-stepper]').forEach(syncStepper);
initDashNav();

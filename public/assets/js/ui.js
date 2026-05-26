function mountLayout(active = '') {
  const user = API.user();
  const nav = document.querySelector('[data-nav]');
  if (nav) {
    nav.innerHTML = `
      <div class="container nav-inner">
        <a class="brand" href="/"><span class="brand-mark">FC</span><span>FestiConnect</span></a>
        <div class="nav-links">
          <a href="/evenements.html" class="${active === 'events' ? 'active' : ''}">Événements</a>
          <a href="/boutique.html" class="${active === 'shop' ? 'active' : ''}">Boutique</a>
          <a href="/client.html" class="${active === 'client' ? 'active' : ''}">Client</a>
          <a href="/organisateur.html" class="${active === 'organizer' ? 'active' : ''}">Organisateur</a>
          <a href="/admin.html" class="${active === 'admin' ? 'active' : ''}">Admin</a>
          <a href="/contact.html" class="${active === 'support' ? 'active' : ''}">Support</a>
        </div>
        <div class="nav-actions">
          ${user ? `<span class="nav-user">${user.name}</span><button class="btn btn-secondary" data-logout><i data-lucide="log-out"></i>Sortir</button>` : `<a class="btn btn-ghost" href="/connexion.html">Connexion</a><a class="btn btn-primary" href="/inscription.html">Créer un compte</a>`}
        </div>
        <button class="btn btn-secondary mobile-toggle" data-menu aria-label="Menu"><i data-lucide="menu"></i></button>
      </div>`;
  }

  const footer = document.querySelector('[data-footer]');
  if (footer) {
    footer.innerHTML = `
      <div class="container footer-grid">
        <div>
          <a class="brand" href="/"><span class="brand-mark">FC</span><span>FestiConnect</span></a>
          <p class="muted footer-copy">Plateforme culturelle et événementielle conçue pour connecter publics, organisateurs et marques africaines.</p>
        </div>
        <div>
          <strong>Plateforme</strong>
          <div class="footer-links">
            <a href="/evenements.html">Événements</a>
            <a href="/boutique.html">Boutique</a>
            <a href="/client.html">Espace client</a>
          </div>
        </div>
        <div>
          <strong>Support</strong>
          <div class="footer-links">
            <a href="/contact.html">Contact</a>
            <a href="/aide.html">Aide</a>
            <a href="/confirmation.html">Confirmation</a>
          </div>
        </div>
        <div>
          <strong>Cadre légal</strong>
          <div class="footer-links">
            <a href="/mentions-legales.html">Mentions légales</a>
            <a href="/confidentialite.html">Confidentialité</a>
            <a href="/conditions.html">Conditions</a>
          </div>
        </div>
      </div>`;
  }

  document.addEventListener('click', async (event) => {
    const menu = event.target.closest('[data-menu]');
    if (menu) document.querySelector('.nav')?.classList.toggle('open');
    const logout = event.target.closest('[data-logout]');
    if (logout) {
      await API.post('/api/auth/logout', {}).catch(() => null);
      API.clearSession();
      location.href = '/';
    }
  });

  if (window.lucide) window.lucide.createIcons();
}

function pageHeader({ eyebrow, title, lead, actions = '' }) {
  return `
    <div class="page-header">
      <div class="stack">
        ${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ''}
        <h1>${title}</h1>
        ${lead ? `<p class="lead">${lead}</p>` : ''}
      </div>
      ${actions ? `<div class="header-actions">${actions}</div>` : ''}
    </div>`;
}

function emptyState(title, message, action = '') {
  return `
    <div class="empty-state glass">
      <div class="stack">
        <h3>${title}</h3>
        <p class="muted">${message}</p>
      </div>
      ${action ? `<div class="header-actions">${action}</div>` : ''}
    </div>`;
}

function eventCard(event) {
  return `
    <article class="event-card glass">
      <img class="thumb" src="${event.cover_url}" alt="${event.title}">
      <div class="card-body">
        <span class="tag">${event.category}</span>
        <h3 class="mt-4">${event.title}</h3>
        <p class="muted mt-3">${event.city} - ${formatDate(event.starts_at)}</p>
        <div class="flex items-center justify-between gap-3 mt-5">
          <strong>${formatMoney(event.price_xof)}</strong>
          <a class="btn btn-primary" href="/evenement.html?id=${event.id}"><i data-lucide="ticket"></i>Reserver</a>
        </div>
      </div>
    </article>`;
}

function productCard(product) {
  return `
    <article class="product-card glass">
      <img class="thumb" src="${product.image_url}" alt="${product.name}">
      <div class="card-body">
        <span class="tag">${product.category}</span>
        <h3 class="mt-4">${product.name}</h3>
        <p class="muted mt-3">${product.description}</p>
        <div class="flex items-center justify-between gap-3 mt-5">
          <strong>${formatMoney(product.price_xof)}</strong>
          <a class="btn btn-secondary" href="/produit.html?id=${product.id}"><i data-lucide="shopping-bag"></i>Voir</a>
        </div>
      </div>
    </article>`;
}

function statusBadge(status) {
  const labels = { approved: 'Valide', pending: 'En attente', rejected: 'Refuse', paid: 'Paye' };
  return `<span class="status ${status}">${labels[status] || status}</span>`;
}

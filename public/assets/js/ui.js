function mountLayout(active = '') {
  const user = API.user();
  const nav = document.querySelector('[data-nav]');
  if (nav) {
    nav.innerHTML = `
      <div class="container nav-inner">
        <a class="brand" href="/"><span class="brand-mark">FC</span><span>FestiConnect</span></a>
        <div class="nav-links">
          <a href="/evenements.html" class="${active === 'events' ? 'text-white' : ''}">Evenements</a>
          <a href="/boutique.html" class="${active === 'shop' ? 'text-white' : ''}">Boutique</a>
          <a href="/client.html">Client</a>
          <a href="/organisateur.html">Organisateur</a>
          <a href="/admin.html">Admin</a>
        </div>
        <div class="nav-actions">
          ${user ? `<span class="muted">${user.name}</span><button class="btn btn-secondary" data-logout><i data-lucide="log-out"></i>Sortir</button>` : `<a class="btn btn-ghost" href="/connexion.html">Connexion</a><a class="btn btn-primary" href="/inscription.html">Creer un compte</a>`}
        </div>
        <button class="btn btn-secondary mobile-toggle" data-menu aria-label="Menu"><i data-lucide="menu"></i></button>
      </div>`;
  }

  const footer = document.querySelector('[data-footer]');
  if (footer) {
    footer.innerHTML = `
      <div class="container grid grid-3">
        <div>
          <a class="brand" href="/"><span class="brand-mark">FC</span><span>FestiConnect</span></a>
          <p class="muted mt-4">Plateforme culturelle et evenementielle concue pour connecter publics, organisateurs et marques africaines.</p>
        </div>
        <div><strong>Plateforme</strong><p class="muted mt-3">Billetterie, boutique, analytics, validation et paiements mobiles.</p></div>
        <div><strong>Paiements</strong><p class="muted mt-3">Wave, Orange Money et Moov Money integres au tunnel d'achat.</p></div>
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


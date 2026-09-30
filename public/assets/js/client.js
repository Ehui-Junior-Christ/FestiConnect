const clientUser = requireRole(['client', 'admin']);
const clientMetrics = document.querySelector('#client-metrics');
const ticketsList = document.querySelector('#tickets-list');

function stat(label, value, iconName, hint = '', accent = false) {
  return `
    <div class="stat${accent ? ' stat-accent' : ''}">
      <span class="stat-label">${icon(iconName)}${escapeHtml(label)}</span>
      <span class="stat-value">${escapeHtml(value)}</span>
      ${hint ? `<span class="stat-hint">${escapeHtml(hint)}</span>` : ''}
    </div>`;
}

function ticketCard(ticket) {
  return `
    <article class="ticket" aria-labelledby="t-${escapeHtml(ticket.id)}">
      <div class="ticket-main">
        <div class="cluster">${statusBadge(ticket.status)}${ticket.city ? `<span class="badge">${escapeHtml(ticket.city)}</span>` : ''}</div>
        <h3 id="t-${escapeHtml(ticket.id)}">${escapeHtml(ticket.title)}</h3>
        <ul class="meta">
          <li>${icon('calendar')}<span>${escapeHtml(formatDate(ticket.starts_at))}</span></li>
          ${ticket.location ? `<li>${icon('pin')}<span>${escapeHtml(ticket.location)}</span></li>` : ''}
          <li>${icon('ticket')}<span>${escapeHtml(plural(ticket.quantity, 'billet', 'billets'))} · ${escapeHtml(formatPrice(ticket.amount_xof))}${ticket.payment_method ? ` · ${escapeHtml(ticket.payment_method)}` : ''}</span></li>
        </ul>
      </div>
      <div class="ticket-stub">
        <span class="ticket-label">Code d'entrée</span>
        <span class="ticket-code">${escapeHtml(ticket.code)}</span>
        <button class="btn btn-sm" type="button" data-copy="${escapeHtml(ticket.code)}">${icon('copy')}<span>Copier le code</span></button>
      </div>
    </article>`;
}

function renderProfile(user) {
  const rows = [
    ['Nom', user.name],
    ['Email', user.email],
    ['Téléphone', user.phone || 'Non renseigné'],
    ['Ville', user.city || 'Non renseignée'],
    ['Type de compte', ROLE_LABELS[user.role] || user.role]
  ];
  document.querySelector('#profile-list').innerHTML = rows
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join('');
}

async function loadClient() {
  clientMetrics.innerHTML = skeletonStats(4);
  ticketsList.innerHTML = '<div class="skeleton sk-block"></div><div class="skeleton sk-block"></div>';
  setLoading(clientMetrics, true);
  setLoading(ticketsList, true);
  try {
    const [{ summary }, { tickets }] = await Promise.all([
      API.get('/api/client/summary'),
      API.get('/api/client/tickets')
    ]);
    clientMetrics.innerHTML = [
      stat('Billets', formatNumber(summary.tickets), 'ticket', 'réservations', true),
      stat('Dépensé en billets', formatMoney(summary.spent), 'wallet'),
      stat('Commandes boutique', formatNumber(summary.orders), 'bag'),
      stat('Points fidélité', formatNumber(summary.points), 'star', '120 points par réservation')
    ].join('');
    ticketsList.innerHTML = tickets.length
      ? tickets.map(ticketCard).join('')
      : emptyState({
          title: 'Pas encore de billet',
          message: 'Quand tu réserves, ton billet et son code d\'entrée apparaissent ici.',
          actions: [{ label: 'Trouver un événement', href: '/evenements.html', variant: 'primary', icon: 'search' }]
        });
  } catch (error) {
    if (error.status === 401) {
      location.replace(loginUrl());
      return;
    }
    renderError(clientMetrics, error, loadClient);
    ticketsList.innerHTML = '';
  } finally {
    setLoading(clientMetrics, false);
    setLoading(ticketsList, false);
  }
}

ticketsList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-copy]');
  if (!button) return;
  const ok = await copyText(button.dataset.copy);
  toast(ok ? 'Code copié.' : 'Copie impossible : note le code affiché.', { type: ok ? 'success' : 'error' });
});

document.querySelector('#logout-all')?.addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const confirmed = await confirmDialog({
    title: 'Te déconnecter partout ?',
    message: 'Toutes tes sessions ouvertes (téléphones, ordinateurs) seront fermées, y compris celle-ci. Tu devras te reconnecter.',
    confirmLabel: 'Tout déconnecter',
    danger: true
  });
  if (!confirmed) return;
  setBusy(button, true);
  try {
    await API.post('/api/auth/logout-all', {});
    API.clearSession();
    location.href = '/connexion.html';
  } catch (error) {
    setBusy(button, false);
    toast(error.status === 404 ? 'Cette option n\'est pas encore disponible.' : error.message, { type: 'error' });
  }
});

if (clientUser) {
  fillUserIdentity(clientUser);
  renderProfile(clientUser);
  loadClient();
}

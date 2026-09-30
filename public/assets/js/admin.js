const adminUser = requireRole(['admin']);
const adminMetrics = document.querySelector('#admin-metrics');
const adminEvents = document.querySelector('#admin-events');
const statusFilter = document.querySelector('#status-filter');
const FILTERS = [
  ['', 'Tous'],
  ['pending', 'En attente'],
  ['approved', 'Validés'],
  ['rejected', 'Refusés']
];
let allEvents = [];
let activeStatus = null;

function adminStat(label, value, iconName, hint = '', accent = false) {
  return `
    <div class="stat${accent ? ' stat-accent' : ''}">
      <span class="stat-label">${icon(iconName)}${escapeHtml(label)}</span>
      <span class="stat-value">${escapeHtml(value)}</span>
      ${hint ? `<span class="stat-hint">${escapeHtml(hint)}</span>` : ''}
    </div>`;
}

function renderFilter() {
  statusFilter.innerHTML = FILTERS.map(([value, label]) => {
    const count = value ? allEvents.filter((event) => event.status === value).length : allEvents.length;
    return `<button type="button" data-filter="${value}" aria-pressed="${value === activeStatus}">${escapeHtml(label)} <span class="count">${count}</span></button>`;
  }).join('');
}

function adminRow(event) {
  const id = escapeHtml(event.id);
  const title = escapeHtml(event.title);
  return `
    <tr>
      <td class="cell-main" data-label="Événement">
        <div class="cell-title"><a href="${eventUrl(event)}">${title}</a></div>
        <div class="cell-sub small">${escapeHtml(event.organizer_name)} · ${escapeHtml(event.category)} · ${escapeHtml(formatPrice(event.price_xof))}</div>
      </td>
      <td data-label="Ville">${escapeHtml(event.city)}</td>
      <td data-label="Date">${escapeHtml(formatDateShort(event.starts_at))}</td>
      <td data-label="Statut">${statusBadge(event.status)}</td>
      <td class="actions-cell">
        <div class="actions">
          ${event.status !== 'approved' ? `<button class="btn btn-success btn-sm" type="button" data-status="${id}" data-value="approved" data-title="${title}">${icon('check')}<span>Valider</span></button>` : ''}
          ${event.status !== 'rejected' ? `<button class="btn btn-danger btn-sm" type="button" data-status="${id}" data-value="rejected" data-title="${title}">${icon('x')}<span>${event.status === 'approved' ? 'Dépublier' : 'Refuser'}</span></button>` : ''}
        </div>
      </td>
    </tr>`;
}

function renderEvents() {
  const visible = activeStatus ? allEvents.filter((event) => event.status === activeStatus) : allEvents;
  const empty = activeStatus === 'pending'
    ? 'Rien à relire : tous les événements soumis ont été traités.'
    : 'Aucun événement dans cette catégorie.';
  adminEvents.innerHTML = visible.length
    ? visible.map(adminRow).join('')
    : `<tr><td colspan="5" class="cell-main"><div class="empty"><p>${escapeHtml(empty)}</p></div></td></tr>`;
  renderFilter();
}

async function loadAdmin() {
  adminMetrics.innerHTML = skeletonStats(4);
  adminEvents.innerHTML = skeletonRows(4, 5);
  setLoading(adminMetrics, true);
  setLoading(adminEvents, true);
  try {
    const [{ summary }, { events }] = await Promise.all([
      API.get('/api/admin/summary'),
      API.get('/api/admin/events')
    ]);
    allEvents = events;
    if (activeStatus === null) activeStatus = events.some((event) => event.status === 'pending') ? 'pending' : '';
    adminMetrics.innerHTML = [
      adminStat('À valider', formatNumber(summary.pending), 'shield', summary.pending ? 'en attente de relecture' : 'tout est à jour', true),
      adminStat('Événements', formatNumber(summary.events), 'calendar'),
      adminStat('Utilisateurs', formatNumber(summary.users), 'users'),
      adminStat('Volume billets', formatMoney(summary.volume), 'wallet')
    ].join('');
    renderEvents();
  } catch (error) {
    if (error.status === 401) {
      location.replace(loginUrl());
      return;
    }
    renderError(adminMetrics, error, loadAdmin);
    adminEvents.innerHTML = '';
  } finally {
    setLoading(adminMetrics, false);
    setLoading(adminEvents, false);
  }
}

statusFilter.addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  activeStatus = button.dataset.filter;
  renderEvents();
});

adminEvents.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-status]');
  if (!button || button.disabled) return;
  const approve = button.dataset.value === 'approved';
  const title = button.dataset.title;
  if (!approve) {
    const confirmed = await confirmDialog({
      title: 'Retirer cet événement ?',
      message: `« ${title} » ne sera plus visible dans le catalogue et ne pourra plus être réservé. Tu pourras le valider à nouveau plus tard.`,
      confirmLabel: 'Oui, refuser',
      danger: true
    });
    if (!confirmed) return;
  }
  setBusy(button, true);
  try {
    await API.patch(`/api/events/${encodeURIComponent(button.dataset.status)}/status`, { status: button.dataset.value });
    toast(approve ? `« ${title} » est publié.` : `« ${title} » a été refusé.`, { type: 'success' });
    loadAdmin();
  } catch (error) {
    setBusy(button, false);
    toast(error.message, { type: 'error' });
  }
});

if (adminUser) {
  fillUserIdentity(adminUser);
  loadAdmin();
}

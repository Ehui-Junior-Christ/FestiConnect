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
      adminStat('Retraits à traiter', formatNumber(summary.withdrawals_pending), 'wallet', Number(summary.withdrawals_pending) ? formatMoney(summary.withdrawals_amount) : 'aucune demande'),
      adminStat('Événements', formatNumber(summary.events), 'calendar', plural(summary.users, 'compte', 'comptes')),
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

/* Retraits Mobile Money des organisateurs */
const adminWithdrawals = document.querySelector('#admin-withdrawals');
const WITHDRAWAL_LABELS = { pending: ['À traiter', 'warning'], approved: ['Envoyé', 'success'], rejected: ['Refusé', 'danger'] };

function withdrawalAdminRow(item) {
  const [label, tone] = WITHDRAWAL_LABELS[item.status] || [item.status, 'neutral'];
  const id = escapeHtml(item.id);
  return `
    <tr>
      <td class="cell-main" data-label="Organisateur">
        <div class="cell-title">${escapeHtml(item.organizer_name)}</div>
        <div class="cell-sub small">${escapeHtml(item.organizer_email)} · demandé le ${escapeHtml(formatDateShort(item.created_at))}</div>
      </td>
      <td class="num" data-label="Montant"><strong>${escapeHtml(formatMoney(item.amount_xof))}</strong></td>
      <td data-label="Moyen">${escapeHtml(item.method)}</td>
      <td data-label="Numéro"><span class="nowrap mono">${escapeHtml(item.phone)}</span></td>
      <td data-label="Statut"><span class="badge badge-${tone} badge-dot">${escapeHtml(label)}</span>${item.admin_note ? `<div class="small muted mt-2">${escapeHtml(item.admin_note)}</div>` : ''}</td>
      <td class="actions-cell">
        <div class="actions">
          ${item.status === 'pending' ? `
            <button class="btn btn-success btn-sm" type="button" data-withdrawal="${id}" data-decision="approved">${icon('check')}<span>Marquer envoyé</span></button>
            <button class="btn btn-danger btn-sm" type="button" data-withdrawal="${id}" data-decision="rejected">${icon('x')}<span>Refuser</span></button>` : ''}
        </div>
      </td>
    </tr>`;
}

let withdrawalItems = [];

async function loadWithdrawals() {
  adminWithdrawals.innerHTML = skeletonRows(2, 6);
  setLoading(adminWithdrawals, true);
  try {
    ({ withdrawals: withdrawalItems } = await API.get('/api/admin/withdrawals'));
    adminWithdrawals.innerHTML = withdrawalItems.length
      ? withdrawalItems.map(withdrawalAdminRow).join('')
      : '<tr><td colspan="6" class="cell-main"><div class="empty"><p>Aucune demande de retrait.</p></div></td></tr>';
  } catch (error) {
    adminWithdrawals.innerHTML = `<tr><td colspan="6">${alertBox('error', error.message)}</td></tr>`;
  } finally {
    setLoading(adminWithdrawals, false);
  }
}

// Motif de refus : petit dialogue avec zone de texte (motif transmis à l'organisateur).
function askRefusalReason(item) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'dialog';
    dialog.setAttribute('aria-labelledby', 'refuse-title');
    dialog.innerHTML = `
      <form method="dialog" novalidate>
        <h2 id="refuse-title" class="h3">Refuser ce retrait ?</h2>
        <p class="muted small" data-refuse-summary></p>
        <div class="field">
          <label class="field-label" for="refuse-note">Motif transmis à l'organisateur</label>
          <textarea class="textarea" id="refuse-note" name="note" required minlength="5" maxlength="300" placeholder="Ex. Le numéro Wave n'est pas au nom de l'organisateur."></textarea>
        </div>
        <div class="cluster">
          <button class="btn btn-ghost" value="cancel" type="submit">Annuler</button>
          <button class="btn btn-danger" value="confirm" type="submit">Refuser le retrait</button>
        </div>
      </form>`;
    dialog.querySelector('[data-refuse-summary]').textContent = `${formatMoney(item.amount_xof)} par ${item.method} au ${item.phone}, pour ${item.organizer_name}.`;
    const note = dialog.querySelector('textarea');
    dialog.querySelector('form').addEventListener('submit', (event) => {
      if (event.submitter?.value === 'confirm' && note.value.trim().length < 5) {
        event.preventDefault();
        setFieldError(note, 'Explique le refus en quelques mots (5 caractères au moins).');
        note.focus();
      }
    });
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'confirm' ? note.value.trim() : null);
      dialog.remove();
    });
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

adminWithdrawals.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-withdrawal]');
  if (!button || button.disabled) return;
  const item = withdrawalItems.find((entry) => entry.id === button.dataset.withdrawal);
  if (!item) return;
  let note = '';
  if (button.dataset.decision === 'approved') {
    const confirmed = await confirmDialog({
      title: 'Transfert effectué ?',
      message: `Confirme que ${formatMoney(item.amount_xof)} ont bien été envoyés par ${item.method} au ${item.phone}. L'organisateur sera notifié.`,
      confirmLabel: 'Oui, c\'est envoyé'
    });
    if (!confirmed) return;
  } else {
    note = await askRefusalReason(item);
    if (note === null) return;
  }
  setBusy(button, true);
  try {
    await API.patch(`/api/admin/withdrawals/${encodeURIComponent(item.id)}`, { status: button.dataset.decision, note });
    toast(button.dataset.decision === 'approved' ? 'Retrait marqué comme envoyé.' : 'Retrait refusé, l\'organisateur est prévenu.', { type: 'success' });
    loadWithdrawals();
    loadAdmin();
  } catch (error) {
    setBusy(button, false);
    toast(error.message, { type: 'error' });
  }
});

if (adminUser) {
  fillUserIdentity(adminUser);
  loadAdmin();
  loadWithdrawals();
}

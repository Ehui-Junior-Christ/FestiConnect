const organizerUser = requireRole(['organisateur', 'admin']);
const organizerMetrics = document.querySelector('#organizer-metrics');
const organizerEvents = document.querySelector('#organizer-events');
const organizerTickets = document.querySelector('#organizer-tickets');
const revenueList = document.querySelector('#revenue-list');

function metric(label, value, iconName, hint = '', accent = false) {
  return `
    <div class="stat${accent ? ' stat-accent' : ''}">
      <span class="stat-label">${icon(iconName)}${escapeHtml(label)}</span>
      <span class="stat-value">${escapeHtml(value)}</span>
      ${hint ? `<span class="stat-hint">${escapeHtml(hint)}</span>` : ''}
    </div>`;
}

function emptyRow(cols, message, action = '') {
  return `<tr><td colspan="${cols}" class="cell-main"><div class="empty"><p>${escapeHtml(message)}</p>${action}</div></td></tr>`;
}

function eventRow(event) {
  const capacity = Number(event.capacity || 0);
  const sold = Number(event.tickets_sold || 0);
  return `
    <tr>
      <td class="cell-main" data-label="Événement">
        <div class="cell-title">${event.status === 'approved' ? `<a href="${eventUrl(event)}">${escapeHtml(event.title)}</a>` : escapeHtml(event.title)}</div>
        <div class="cell-sub small">${escapeHtml(event.category)}</div>
      </td>
      <td data-label="Ville">${escapeHtml(event.city)}</td>
      <td data-label="Date">${escapeHtml(formatDateShort(event.starts_at))}</td>
      <td class="num" data-label="Prix">${escapeHtml(formatPrice(event.price_xof))}</td>
      <td class="num" data-label="Ventes">${escapeHtml(formatNumber(sold))}${capacity ? ` / ${escapeHtml(formatNumber(capacity))}` : ''}${Number(event.waitlist_count) ? `<div class="small waitlist-hint">${escapeHtml(plural(event.waitlist_count, 'personne en attente', 'personnes en attente'))}</div>` : ''}</td>
      <td data-label="Statut">${statusBadge(event.status)}</td>
      <td class="actions-cell">
        <div class="actions">
          <button class="btn btn-sm" type="button" data-edit-event="${escapeHtml(event.id)}">${icon('edit')}<span>Modifier</span></button>
        </div>
      </td>
    </tr>`;
}

function ticketRow(ticket) {
  return `
    <tr>
      <td class="cell-main" data-label="Client"><div class="cell-title">${escapeHtml(ticket.client_name)}</div></td>
      <td data-label="Événement">${escapeHtml(ticket.title)}</td>
      <td data-label="Code"><span class="mono">${escapeHtml(ticket.code)}</span></td>
      <td class="num" data-label="Quantité">${escapeHtml(formatNumber(ticket.quantity))}</td>
      <td class="num" data-label="Montant">${escapeHtml(formatPrice(ticket.amount_xof))}</td>
      <td data-label="Statut">${ticket.checked_in_at && ticket.status === 'paid' ? '<span class="badge badge-info badge-dot">Entré</span>' : statusBadge(ticket.status)}</td>
      <td class="actions-cell">
        <div class="actions">
          ${ticket.status === 'paid' && !ticket.checked_in_at ? `<button class="btn btn-sm btn-danger" type="button" data-cancel-ticket="${escapeHtml(ticket.id)}" data-client="${escapeHtml(ticket.client_name)}" data-title="${escapeHtml(ticket.title)}">Annuler</button>` : ''}
        </div>
      </td>
    </tr>`;
}

function renderRevenue(tickets) {
  const byEvent = new Map();
  tickets.filter((ticket) => ticket.status === 'paid').forEach((ticket) => {
    const entry = byEvent.get(ticket.title) || { amount: 0, count: 0 };
    entry.amount += Number(ticket.amount_xof || 0);
    entry.count += Number(ticket.quantity || 0);
    byEvent.set(ticket.title, entry);
  });
  const rows = [...byEvent.entries()].sort((a, b) => b[1].amount - a[1].amount);
  if (!rows.length) {
    revenueList.innerHTML = '<li class="muted">Aucune vente pour le moment. Tes revenus apparaîtront ici dès le premier billet vendu.</li>';
    return;
  }
  const max = rows[0][1].amount || 1;
  revenueList.innerHTML = rows.map(([title, entry]) => `
    <li>
      <div class="row"><span>${escapeHtml(title)} <span class="muted">· ${escapeHtml(plural(entry.count, 'billet', 'billets'))}</span></span><strong>${escapeHtml(formatMoney(entry.amount))}</strong></div>
      <div class="meter"><span data-meter="${Math.max(2, Math.round((entry.amount / max) * 100))}"></span></div>
    </li>`).join('');
  revenueList.querySelectorAll('[data-meter]').forEach((bar) => { bar.style.width = `${bar.dataset.meter}%`; });
}

async function loadOrganizer() {
  organizerMetrics.innerHTML = skeletonStats(4);
  organizerEvents.innerHTML = skeletonRows(3, 7);
  organizerTickets.innerHTML = skeletonRows(3, 7);
  [organizerMetrics, organizerEvents, organizerTickets].forEach((node) => setLoading(node, true));
  try {
    const [{ summary }, { events }, { tickets }] = await Promise.all([
      API.get('/api/organizer/summary'),
      API.get('/api/organizer/events'),
      API.get('/api/organizer/tickets')
    ]);
    const pending = events.filter((event) => event.status === 'pending').length;
    organizerMetrics.innerHTML = [
      metric('Revenus', formatMoney(summary.revenue), 'wallet', 'billets payés', true),
      metric('Billets vendus', formatNumber(summary.sold), 'ticket'),
      metric('Événements', formatNumber(summary.events), 'calendar', pending ? `${pending} en attente de validation` : ''),
      metric('Conversion', `${formatNumber(summary.conversion)} %`, 'chart')
    ].join('');
    organizerEvents.innerHTML = events.length
      ? events.map(eventRow).join('')
      : emptyRow(7, 'Tu n\'as encore publié aucun événement.', '<a class="btn btn-primary btn-sm" href="#creation">Créer mon premier événement</a>');
    organizerTickets.innerHTML = tickets.length
      ? tickets.map(ticketRow).join('')
      : emptyRow(7, 'Aucun billet vendu pour le moment.');
    renderRevenue(tickets);
  } catch (error) {
    if (error.status === 401) {
      location.replace(loginUrl());
      return;
    }
    renderError(organizerMetrics, error, loadOrganizer);
    organizerEvents.innerHTML = '';
    organizerTickets.innerHTML = '';
  } finally {
    [organizerMetrics, organizerEvents, organizerTickets].forEach((node) => setLoading(node, false));
  }
}

organizerTickets.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-cancel-ticket]');
  if (!button) return;
  const confirmed = await confirmDialog({
    title: 'Annuler ce billet ?',
    message: `La réservation de ${button.dataset.client} pour « ${button.dataset.title} » sera annulée : le QR code ne passera plus à l'entrée et les places seront remises en vente (la liste d'attente est prévenue). Le remboursement Mobile Money reste à ta charge.`,
    confirmLabel: 'Annuler le billet',
    cancelLabel: 'Garder',
    danger: true
  });
  if (!confirmed) return;
  setBusy(button, true);
  try {
    await API.post(`/api/organizer/tickets/${encodeURIComponent(button.dataset.cancelTicket)}/cancel`, {});
    toast('Billet annulé, places remises en vente.', { type: 'success' });
    loadOrganizer();
  } catch (error) {
    setBusy(button, false);
    toast(error.message, { type: 'error' });
  }
});

organizerEvents.addEventListener('click', (event) => {
  const edit = event.target.closest('[data-edit-event]');
  if (edit) startEditEvent(edit.dataset.editEvent);
});

if (organizerUser) {
  fillUserIdentity(organizerUser);
  loadOrganizer();
}

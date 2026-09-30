const organizerUser = requireRole(['organisateur', 'admin']);
const organizerMetrics = document.querySelector('#organizer-metrics');
const organizerEvents = document.querySelector('#organizer-events');
const organizerTickets = document.querySelector('#organizer-tickets');
const revenueList = document.querySelector('#revenue-list');
const createForm = document.querySelector('#event-create-form');
const scanForm = document.querySelector('#scan-form');
const scanResult = document.querySelector('#scan-result');
let soldTickets = [];

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
      <td class="num" data-label="Ventes">${escapeHtml(formatNumber(sold))}${capacity ? ` / ${escapeHtml(formatNumber(capacity))}` : ''}</td>
      <td data-label="Statut">${statusBadge(event.status)}</td>
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
      <td data-label="Statut">${statusBadge(ticket.status)}</td>
    </tr>`;
}

function renderRevenue(tickets) {
  const byEvent = new Map();
  tickets.forEach((ticket) => {
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
  organizerEvents.innerHTML = skeletonRows(3, 6);
  organizerTickets.innerHTML = skeletonRows(3, 6);
  [organizerMetrics, organizerEvents, organizerTickets].forEach((node) => setLoading(node, true));
  try {
    const [{ summary }, { events }, { tickets }] = await Promise.all([
      API.get('/api/organizer/summary'),
      API.get('/api/organizer/events'),
      API.get('/api/organizer/tickets')
    ]);
    soldTickets = tickets;
    const pending = events.filter((event) => event.status === 'pending').length;
    organizerMetrics.innerHTML = [
      metric('Revenus', formatMoney(summary.revenue), 'wallet', 'billets payés', true),
      metric('Billets vendus', formatNumber(summary.sold), 'ticket'),
      metric('Événements', formatNumber(summary.events), 'calendar', pending ? `${pending} en attente de validation` : ''),
      metric('Conversion', `${formatNumber(summary.conversion)} %`, 'chart')
    ].join('');
    organizerEvents.innerHTML = events.length
      ? events.map(eventRow).join('')
      : emptyRow(6, 'Tu n\'as encore publié aucun événement.', '<a class="btn btn-primary btn-sm" href="#creation">Créer mon premier événement</a>');
    organizerTickets.innerHTML = tickets.length
      ? tickets.map(ticketRow).join('')
      : emptyRow(6, 'Aucun billet vendu pour le moment.');
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

/* Création d'événement */
enhanceForm(createForm);
createForm.elements.ends_at.addEventListener('change', () => {
  const start = createForm.elements.starts_at.value;
  const end = createForm.elements.ends_at.value;
  createForm.elements.ends_at.setCustomValidity(start && end && end < start ? 'La fin doit être après le début.' : '');
});

createForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFormNotice(createForm);
  createForm.elements.ends_at.dispatchEvent(new Event('change'));
  if (!validateForm(createForm)) return;
  const button = createForm.querySelector('button[type="submit"]');
  const data = Object.fromEntries(new FormData(createForm));
  setBusy(button, true);
  try {
    await API.post('/api/events', data);
    createForm.reset();
    createForm.querySelectorAll('[data-touched]').forEach((field) => delete field.dataset.touched);
    const message = organizerUser.role === 'admin'
      ? `« ${data.title} » est publié.`
      : `« ${data.title} » est envoyé à l'équipe. Il apparaîtra dans le catalogue une fois validé.`;
    formNotice(createForm, message, 'success');
    toast('Événement enregistré.', { type: 'success' });
    loadOrganizer();
  } catch (error) {
    formNotice(createForm, error.message);
  } finally {
    setBusy(button, false);
  }
});

/* Contrôle d'entrée : recherche du code parmi les billets de l'organisateur */
enhanceForm(scanForm);
scanForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!validateForm(scanForm)) return;
  const code = scanForm.elements.code.value.trim().toUpperCase();
  const ticket = soldTickets.find((item) => String(item.code).toUpperCase() === code);
  scanResult.innerHTML = ticket
    ? alertBox('success', `${ticket.client_name} · ${ticket.title} · ${plural(ticket.quantity, 'place', 'places')}`, 'Billet valide')
    : alertBox('error', `Aucun billet ${code} sur tes événements. Vérifie la saisie (lettres et chiffres) ou demande la confirmation au client.`, 'Code inconnu');
  scanForm.elements.code.select();
});

if (organizerUser) {
  fillUserIdentity(organizerUser);
  loadOrganizer();
}

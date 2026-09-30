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

/* QR code du billet : SVG dessiné à partir de la matrice calculée par
   qrcode-generator (vendor, MIT). Aucun style inline : compatible CSP. */
function qrSvg(text, label) {
  if (typeof qrcode !== 'function') return '';
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const margin = 4;
  const size = count + margin * 2;
  let path = '';
  for (let row = 0; row < count; row += 1) {
    let col = 0;
    while (col < count) {
      if (!qr.isDark(row, col)) {
        col += 1;
        continue;
      }
      const start = col;
      while (col < count && qr.isDark(row, col)) col += 1;
      path += `M${start + margin} ${row + margin}h${col - start}v1h-${col - start}z`;
    }
  }
  return `<svg class="qr" viewBox="0 0 ${size} ${size}" role="img" aria-label="${escapeHtml(label)}" shape-rendering="crispEdges" focusable="false"><rect class="qr-bg" width="${size}" height="${size}"/><path class="qr-fg" d="${path}"/></svg>`;
}

function ticketState(ticket) {
  if (ticket.status === 'cancelled') return { label: 'Annulé', tone: 'danger', usable: false };
  if (ticket.checked_in_at) return { label: `Utilisé le ${formatDateShort(ticket.checked_in_at)}`, tone: 'neutral', usable: false };
  if (eventPhase({ starts_at: ticket.starts_at, ends_at: ticket.ends_at }) === 'past') return { label: 'Événement passé', tone: 'neutral', usable: false };
  return { label: 'Valable', tone: 'success', usable: true };
}

function ticketCard(ticket) {
  const state = ticketState(ticket);
  const people = plural(ticket.quantity, 'personne', 'personnes');
  return `
    <article class="ticket${state.usable ? '' : ' ticket-used'}" aria-labelledby="t-${escapeHtml(ticket.id)}">
      <div class="ticket-main">
        <div class="cluster"><span class="badge badge-${state.tone} badge-dot">${escapeHtml(state.label)}</span>${ticket.city ? `<span class="badge">${escapeHtml(ticket.city)}</span>` : ''}</div>
        <h3 id="t-${escapeHtml(ticket.id)}"><a class="ticket-link" href="${eventUrl({ id: ticket.event_id })}">${escapeHtml(ticket.title)}</a></h3>
        <ul class="meta">
          <li>${icon('calendar')}<span>${escapeHtml(formatDate(ticket.starts_at))}</span></li>
          ${ticket.location ? `<li>${icon('pin')}<span>${escapeHtml(ticket.location)}</span></li>` : ''}
          <li>${icon('ticket')}<span>${escapeHtml(plural(ticket.quantity, 'billet', 'billets'))}${ticket.category_name ? ` ${escapeHtml(ticket.category_name)}` : ''} · ${escapeHtml(formatPrice(ticket.amount_xof))}${ticket.payment_method ? ` · ${escapeHtml(ticket.payment_method)}` : ''}</span></li>
        </ul>
      </div>
      <div class="ticket-stub">
        <div class="qr-frame">${qrSvg(ticket.code, `QR code du billet ${ticket.code}, entrée pour ${people}`)}</div>
        <div class="ticket-stub-text">
          <span class="ticket-label">Entrée pour ${escapeHtml(people)}</span>
          <span class="ticket-code">${escapeHtml(ticket.code)}</span>
          <div class="cluster">
            ${state.usable ? `<button class="btn btn-sm btn-dark" type="button" data-qr-open="${escapeHtml(ticket.id)}">${icon('qr')}<span>Plein écran</span></button>` : ''}
            <button class="btn btn-sm" type="button" data-copy="${escapeHtml(ticket.code)}">${icon('copy')}<span>Copier</span></button>
          </div>
        </div>
      </div>
    </article>`;
}

// QR en grand pour le contrôle à l'entrée (luminosité, lecture de nuit).
function openQrDialog(ticket) {
  const dialog = document.createElement('dialog');
  dialog.className = 'dialog qr-dialog';
  dialog.setAttribute('aria-labelledby', 'qr-dialog-title');
  dialog.innerHTML = `
    <form method="dialog">
      <h2 id="qr-dialog-title" class="h3">${escapeHtml(ticket.title)}</h2>
      <p class="muted small">${escapeHtml(formatDate(ticket.starts_at))} · entrée pour ${escapeHtml(plural(ticket.quantity, 'personne', 'personnes'))}</p>
      <div class="qr-frame qr-frame-lg">${qrSvg(ticket.code, `QR code du billet ${ticket.code}`)}</div>
      <p class="ticket-code">${escapeHtml(ticket.code)}</p>
      <p class="small muted">Monte la luminosité de ton écran et présente ce code au contrôle. Il ne sert qu'une fois.</p>
      <div class="cluster"><button class="btn btn-primary btn-block" value="close" type="submit">Fermer</button></div>
    </form>`;
  document.body.appendChild(dialog);
  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal();
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
    clientTickets = tickets;
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

let clientTickets = [];

ticketsList.addEventListener('click', (event) => {
  const open = event.target.closest('[data-qr-open]');
  if (!open) return;
  const ticket = clientTickets.find((item) => item.id === open.dataset.qrOpen);
  if (ticket) openQrDialog(ticket);
});

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

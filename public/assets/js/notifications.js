const notifUser = requireRole(['client', 'organisateur', 'admin']);
const notifList = document.querySelector('#notif-list');
const readAllButton = document.querySelector('#notif-read-all');
const notifSummary = document.querySelector('#notif-summary');

const NOTIF_ICONS = {
  event_status: 'shield',
  event_changed: 'calendar',
  withdrawal: 'wallet',
  waitlist: 'hourglass',
  reminder: 'clock',
  ticket_cancelled: 'x-circle'
};

// « à l'instant », « il y a 12 min », « il y a 3 h », « hier », puis la date.
function timeAgo(value) {
  const date = parseDate(value);
  if (!date) return '';
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'à l\'instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  if (hours < 48) return 'hier';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(date);
}

function notifItem(item) {
  const unread = !item.read_at;
  const link = safeUrl(item.link, '');
  const inner = `
    <span class="notif-icon notif-${escapeHtml(item.type)}">${icon(NOTIF_ICONS[item.type] || 'bell')}</span>
    <span class="notif-text">
      <strong>${escapeHtml(item.title)}</strong>
      ${item.body ? `<span>${escapeHtml(item.body)}</span>` : ''}
      <time datetime="${escapeHtml(item.created_at)}">${escapeHtml(timeAgo(item.created_at))}</time>
    </span>
    ${unread ? '<span class="notif-dot"><span class="sr-only">Non lue</span></span>' : ''}`;
  return `
    <li class="notif-item${unread ? ' is-unread' : ''}">
      ${link
        ? `<a class="notif-body" href="${escapeHtml(link)}" data-id="${escapeHtml(item.id)}" data-unread="${unread}">${inner}</a>`
        : `<div class="notif-body">${inner}</div>`}
    </li>`;
}

function render(notifications, unread) {
  setNotificationCount(unread);
  readAllButton.hidden = unread === 0;
  notifSummary.textContent = unread
    ? `${plural(unread, 'notification non lue', 'notifications non lues')}.`
    : 'Tout est lu. Validation de tes événements, retraits, places libérées et rappels de la veille arrivent ici.';
  notifList.innerHTML = notifications.length
    ? notifications.map(notifItem).join('')
    : `<li>${emptyState({
        title: 'Aucune notification',
        message: 'Tu seras prévenu ici quand une place se libère, la veille d\'un événement, ou quand l\'équipe traite une de tes demandes.',
        actions: [{ label: 'Voir les événements', href: '/evenements.html', variant: 'primary' }]
      })}</li>`;
}

async function loadNotifications() {
  notifList.innerHTML = '<li><div class="skeleton sk-block"></div></li><li><div class="skeleton sk-block"></div></li>';
  setLoading(notifList, true);
  try {
    const { notifications, unread } = await API.get('/api/notifications');
    render(notifications, unread);
  } catch (error) {
    if (error.status === 401) {
      location.replace(loginUrl());
      return;
    }
    renderError(notifList, error, loadNotifications);
  } finally {
    setLoading(notifList, false);
  }
}

// Ouvrir une notification la marque comme lue, puis suit son lien.
notifList.addEventListener('click', async (event) => {
  const link = event.target.closest('a[data-id]');
  if (!link || link.dataset.unread !== 'true') return;
  event.preventDefault();
  try {
    const { unread } = await API.post('/api/notifications/read', { ids: [link.dataset.id] });
    setNotificationCount(unread);
  } catch {
    /* la navigation prime : la notification restera simplement non lue */
  }
  location.href = link.getAttribute('href');
});

readAllButton.addEventListener('click', async () => {
  setBusy(readAllButton, true);
  try {
    await API.post('/api/notifications/read', { all: true });
    toast('Toutes les notifications sont marquées comme lues.', { type: 'success' });
    await loadNotifications();
  } catch (error) {
    toast(error.message, { type: 'error' });
  } finally {
    setBusy(readAllButton, false);
  }
});

if (notifUser) loadNotifications();

mountLayout();
requireRole(['admin']);

async function loadAdmin() {
  const [{ summary }, { events }] = await Promise.all([
    API.get('/api/admin/summary'),
    API.get('/api/admin/events')
  ]);
  document.querySelector('#admin-metrics').innerHTML = `
    <div class="metric glass"><strong>${summary.users}</strong><span>Utilisateurs</span></div>
    <div class="metric glass"><strong>${summary.events}</strong><span>Evenements</span></div>
    <div class="metric glass"><strong>${summary.pending}</strong><span>A valider</span></div>
    <div class="metric glass"><strong>${formatMoney(summary.volume)}</strong><span>Volume billets</span></div>`;
  document.querySelector('#admin-events').innerHTML = events.map((event) => `
    <tr>
      <td>${event.title}<br><span class="muted">${event.organizer_name}</span></td>
      <td>${event.city}</td>
      <td>${formatDate(event.starts_at)}</td>
      <td>${statusBadge(event.status)}</td>
      <td class="flex gap-2">
        <button class="btn btn-primary" data-status="${event.id}" data-value="approved">Valider</button>
        <button class="btn btn-secondary" data-status="${event.id}" data-value="rejected">Refuser</button>
      </td>
    </tr>`).join('');
  if (window.lucide) window.lucide.createIcons();
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-status]');
  if (!button) return;
  await API.patch(`/api/events/${button.dataset.status}/status`, { status: button.dataset.value });
  toast('Statut mis a jour.');
  loadAdmin();
});

loadAdmin().catch((error) => toast(error.message));


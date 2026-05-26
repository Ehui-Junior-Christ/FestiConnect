mountLayout('organizer');
const organizerUser = requireRole(['organisateur', 'admin']);
document.querySelector('#organizer-name').textContent = organizerUser.name;

async function loadOrganizer() {
  const [{ summary }, { events }, { tickets }] = await Promise.all([
    API.get('/api/organizer/summary'),
    API.get('/api/organizer/events'),
    API.get('/api/organizer/tickets')
  ]);
  document.querySelector('#organizer-metrics').innerHTML = `
    <div class="metric glass"><strong>${summary.events}</strong><span>Evenements</span></div>
    <div class="metric glass"><strong>${summary.sold}</strong><span>Billets vendus</span></div>
    <div class="metric glass"><strong>${formatMoney(summary.revenue)}</strong><span>Revenus</span></div>
    <div class="metric glass"><strong>${summary.conversion}%</strong><span>Conversion</span></div>`;
  document.querySelector('#organizer-events').innerHTML = events.map((event) => `
    <tr><td>${event.title}</td><td>${event.city}</td><td>${formatDate(event.starts_at)}</td><td>${formatMoney(event.price_xof)}</td><td>${statusBadge(event.status)}</td></tr>
  `).join('');
  document.querySelector('#organizer-tickets').innerHTML = tickets.map((ticket) => `
    <tr><td>${ticket.client_name}</td><td>${ticket.title}</td><td>${ticket.code}</td><td>${formatMoney(ticket.amount_xof)}</td><td>${statusBadge(ticket.status)}</td></tr>
  `).join('');
  if (window.lucide) window.lucide.createIcons();
}

document.querySelector('#event-create-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    await API.post('/api/events', data);
    toast('Evenement soumis a validation.');
    event.currentTarget.reset();
    loadOrganizer();
  } catch (error) {
    toast(error.message);
  }
});

loadOrganizer().catch((error) => toast(error.message));

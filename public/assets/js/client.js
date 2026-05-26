mountLayout();
const clientUser = requireRole(['client', 'admin']);
document.querySelector('#client-name').textContent = clientUser.name;

async function loadClient() {
  const [{ summary }, { tickets }] = await Promise.all([
    API.get('/api/client/summary'),
    API.get('/api/client/tickets')
  ]);
  document.querySelector('#client-metrics').innerHTML = `
    <div class="metric glass"><strong>${summary.tickets}</strong><span>Billets actifs</span></div>
    <div class="metric glass"><strong>${formatMoney(summary.spent)}</strong><span>Depenses culturelles</span></div>
    <div class="metric glass"><strong>${summary.orders}</strong><span>Commandes boutique</span></div>
    <div class="metric glass"><strong>${summary.points}</strong><span>Points fidelite</span></div>`;
  document.querySelector('#tickets-list').innerHTML = tickets.map((ticket) => `
    <article class="panel glass grid grid-2">
      <div>
        <span class="tag">${ticket.city}</span>
        <h3 class="mt-4">${ticket.title}</h3>
        <p class="muted mt-2">${formatDate(ticket.starts_at)} - ${ticket.location}</p>
        <p class="mt-3">${ticket.quantity} billet(s) - ${formatMoney(ticket.amount_xof)}</p>
      </div>
      <div class="justify-self-end text-center">
        <div class="qr">${ticket.code.slice(-4)}</div>
        <p class="muted mt-2">${ticket.code}</p>
      </div>
    </article>`).join('') || '<div class="panel glass">Aucun billet pour le moment.</div>';
  if (window.lucide) window.lucide.createIcons();
}

loadClient().catch((error) => toast(error.message));


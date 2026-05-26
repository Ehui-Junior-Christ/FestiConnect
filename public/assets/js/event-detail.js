mountLayout('events');

async function loadEvent() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) throw new Error('Evenement introuvable.');
  const { event } = await API.get(`/api/events/${id}`);
  document.querySelector('#event-detail').innerHTML = `
    <div class="hero-grid">
      <div>
        <span class="eyebrow">${event.category} - ${event.city}</span>
        <h1>${event.title}</h1>
        <p class="lead">${event.description}</p>
        <div class="metric-strip">
          <div class="metric glass"><strong>${formatMoney(event.price_xof)}</strong><span>Prix billet</span></div>
          <div class="metric glass"><strong>${event.tickets_sold}</strong><span>Billets vendus</span></div>
          <div class="metric glass"><strong>${event.capacity}</strong><span>Capacite</span></div>
          <div class="metric glass"><strong>${event.city}</strong><span>Ville</span></div>
        </div>
      </div>
      <div class="glass event-card">
        <img class="thumb" src="${event.cover_url}" alt="${event.title}">
        <div class="card-body">
          <p><strong>Date:</strong> ${formatDate(event.starts_at)}</p>
          <p class="muted mt-2"><strong>Lieu:</strong> ${event.location}</p>
          <form id="ticket-form" class="grid mt-5">
            <label class="label">Nombre de billets<input class="input" name="quantity" type="number" min="1" value="1"></label>
            <label class="label">Paiement<select class="select" name="payment_method"><option>Wave</option><option>Orange Money</option><option>Moov Money</option></select></label>
            <button class="btn btn-primary" type="submit"><i data-lucide="ticket-check"></i>Reserver maintenant</button>
          </form>
        </div>
      </div>
    </div>`;

  document.querySelector('#ticket-form').addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    if (!API.user()) return location.href = '/connexion.html';
    const data = Object.fromEntries(new FormData(submitEvent.currentTarget));
    const ticket = await API.post('/api/tickets', { ...data, event_id: id });
    toast(`Reservation confirmee: ${formatMoney(ticket.amount_xof)}`);
  });

  if (window.lucide) window.lucide.createIcons();
}

loadEvent().catch((error) => toast(error.message));


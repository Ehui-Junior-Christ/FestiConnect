mountLayout('events');

async function loadEvent() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) throw new Error('Evenement introuvable.');
  const { event } = await API.get(`/api/events/${id}`);
  document.querySelector('#event-detail').innerHTML = `
    <div class="page-grid">
      <div class="breadcrumb">
        <a href="/">Accueil</a>
        <span>/</span>
        <a href="/evenements.html">Événements</a>
        <span>/</span>
        <span>${event.title}</span>
      </div>
      <div class="detail-layout">
        <section class="stack">
          <span class="eyebrow">${event.category} - ${event.city}</span>
          <h1>${event.title}</h1>
          <p class="lead">${event.description}</p>
          <div class="metric-strip">
            <div class="metric glass"><strong>${formatMoney(event.price_xof)}</strong><span>Prix billet</span></div>
            <div class="metric glass"><strong>${event.tickets_sold}</strong><span>Billets vendus</span></div>
            <div class="metric glass"><strong>${event.capacity}</strong><span>Capacité</span></div>
            <div class="metric glass"><strong>${event.city}</strong><span>Ville</span></div>
          </div>
          <div class="section-soft">
            <h3>Détails pratiques</h3>
            <ul class="info-list mt-5">
              <li><strong>Date</strong><span>${formatDate(event.starts_at)}</span></li>
              <li><strong>Lieu</strong><span>${event.location}</span></li>
              <li><strong>Statut</strong><span>${event.status}</span></li>
            </ul>
          </div>
        </section>
        <aside class="detail-panel glass event-card">
          <img class="thumb" src="${event.cover_url}" alt="${event.title}">
          <div class="card-body">
            <div class="stack">
              <strong>${formatMoney(event.price_xof)}</strong>
              <p class="muted">Réservation rapide avec validation immédiate côté client.</p>
            </div>
            <form id="ticket-form" class="grid mt-5">
              <label class="label">Nombre de billets<input class="input" name="quantity" type="number" min="1" value="1"></label>
              <label class="label">Paiement<select class="select" name="payment_method"><option>Wave</option><option>Orange Money</option><option>Moov Money</option></select></label>
              <button class="btn btn-primary" type="submit"><i data-lucide="ticket-check"></i>Réserver maintenant</button>
            </form>
          </div>
        </aside>
      </div>
    </div>`;

  document.querySelector('#ticket-form').addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    if (!API.user()) return location.href = '/connexion.html';
    const data = Object.fromEntries(new FormData(submitEvent.currentTarget));
    const ticket = await API.post('/api/tickets', { ...data, event_id: id });
    location.href = `/confirmation.html?kind=ticket&id=${encodeURIComponent(ticket.id)}&amount=${encodeURIComponent(ticket.amount_xof)}&event=${encodeURIComponent(event.title)}`;
  });

  if (window.lucide) window.lucide.createIcons();
}

loadEvent().catch((error) => toast(error.message));

// Les paramètres viennent de l'URL : ils sont tous échappés avant affichage.
const confirmationView = document.querySelector('#confirmation-view');
const params = new URLSearchParams(location.search);
const kind = params.get('kind');
const reference = params.get('id');
const amount = params.get('amount');
const eventTitle = params.get('event');
const payment = params.get('payment');
const quantity = params.get('qty');
const categoryName = params.get('category');

if (!reference) {
  confirmationView.innerHTML = emptyState({
    title: 'Aucune opération à afficher',
    message: 'Cette page affiche le récapitulatif juste après une réservation ou une commande. Tes billets restent disponibles dans ton espace client.',
    actions: [
      { label: 'Mon espace client', href: '/client.html', variant: 'primary' },
      { label: 'Voir les événements', href: '/evenements.html' }
    ]
  });
} else {
  const isTicket = kind === 'ticket';
  document.title = `${isTicket ? 'Réservation confirmée' : 'Commande confirmée'} · FestiConnect`;
  const lines = [
    ['Référence', `<span class="mono">${escapeHtml(reference)}</span>`],
    isTicket && eventTitle ? ['Événement', escapeHtml(eventTitle)] : null,
    isTicket && quantity ? ['Billets', escapeHtml(plural(Number(quantity) || 1, 'billet', 'billets'))] : null,
    isTicket && categoryName ? ['Catégorie', escapeHtml(categoryName)] : null,
    amount !== null ? ['Montant payé', escapeHtml(formatPrice(amount))] : null,
    payment ? ['Paiement', escapeHtml(payment)] : null
  ].filter(Boolean);

  confirmationView.innerHTML = `
    <div class="stack stack-lg">
      <div class="stack">
        <span class="success-mark">${icon('check')}</span>
        <h1>${isTicket ? 'C\'est réservé !' : 'Commande confirmée'}</h1>
        <p class="lead">${isTicket
          ? `Ton billet pour <strong>${escapeHtml(eventTitle || 'l\'événement')}</strong> est prêt. Présente son code à l'entrée : il est dans ton espace client.`
          : 'Merci pour ta commande. Garde la référence ci-dessous : elle te sera demandée pour toute question sur la livraison.'}</p>
      </div>
      <div class="receipt">
        <h2 class="h4">${isTicket ? 'Récapitulatif de la réservation' : 'Récapitulatif de la commande'}</h2>
        <dl class="receipt-lines">
          ${lines.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}
        </dl>
      </div>
      <div class="cluster">
        ${isTicket
          ? `<a class="btn btn-primary btn-lg" href="/client.html#tickets">${icon('ticket')}<span>Voir mon billet</span></a>
             <a class="btn btn-lg" href="/evenements.html">Autres événements</a>`
          : `<a class="btn btn-primary btn-lg" href="/client.html">${icon('dashboard')}<span>Mon espace</span></a>
             <a class="btn btn-lg" href="/boutique.html">Retour à la boutique</a>`}
      </div>
      <p class="small muted">Une question ? <a href="/contact.html">Contacte le support</a> en indiquant ta référence.</p>
    </div>`;
  document.querySelector('#main').focus();
}

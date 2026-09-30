const featuredEvents = document.querySelector('#featured-events');
const featuredProducts = document.querySelector('#featured-products');

function renderNextUp(event) {
  const box = document.querySelector('#next-up');
  if (!box || !event) return;
  const parts = dateParts(event.starts_at);
  box.innerHTML = `
    <div class="date-stub" aria-hidden="true"><span class="day">${escapeHtml(parts.day)}</span><span class="month">${escapeHtml(parts.month)}</span></div>
    <div>
      <span class="next-label">Prochaine date</span><br>
      <a href="${eventUrl(event)}">${escapeHtml(event.title)}</a>
      <p class="small">${escapeHtml(event.city)} · ${escapeHtml(formatPrice(event.price_xof))}</p>
    </div>`;
  box.hidden = false;
}

async function loadEvents() {
  featuredEvents.innerHTML = skeletonCards(3, 'event');
  setLoading(featuredEvents, true);
  try {
    const { events } = await API.get('/api/events');
    featuredEvents.innerHTML = events.length
      ? events.slice(0, 6).map(eventCard).join('')
      : emptyState({
          title: 'Aucune date pour le moment',
          message: 'Les organisateurs publient régulièrement. Reviens bientôt ou jette un œil à la boutique.',
          actions: [{ label: 'Voir la boutique', href: '/boutique.html' }]
        });
    renderNextUp(events[0]);
  } catch (error) {
    renderError(featuredEvents, error, loadEvents);
  } finally {
    setLoading(featuredEvents, false);
  }
}

async function loadProducts() {
  featuredProducts.innerHTML = skeletonCards(3, 'product');
  setLoading(featuredProducts, true);
  try {
    const { products } = await API.get('/api/products');
    featuredProducts.innerHTML = products.length
      ? products.slice(0, 3).map(productCard).join('')
      : emptyState({ title: 'La boutique se prépare', message: 'Les premiers articles arrivent bientôt.', art: '/assets/img/empty-bag.svg' });
  } catch (error) {
    renderError(featuredProducts, error, loadProducts);
  } finally {
    setLoading(featuredProducts, false);
  }
}

loadEvents();
loadProducts();

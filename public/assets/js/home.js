mountLayout('home');

async function loadHome() {
  const [{ events }, { products }] = await Promise.all([
    API.get('/api/events'),
    API.get('/api/products')
  ]);
  document.querySelector('#featured-events').innerHTML = events.length
    ? events.slice(0, 3).map(eventCard).join('')
    : emptyState('Aucun événement pour le moment', 'Les prochaines publications apparaîtront ici.');
  document.querySelector('#featured-products').innerHTML = products.length
    ? products.slice(0, 3).map(productCard).join('')
    : emptyState('Aucun produit pour le moment', 'La boutique sera alimentée dès qu’un article sera publié.');
  if (window.lucide) window.lucide.createIcons();
}

document.querySelector('#home-search')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const query = new URLSearchParams(data).toString();
  location.href = `/evenements.html?${query}`;
});

loadHome().catch((error) => toast(error.message));

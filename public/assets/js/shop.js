mountLayout('shop');

async function loadShop() {
  const { products } = await API.get('/api/products');
  document.querySelector('#products-list').innerHTML = products.length
    ? products.map(productCard).join('')
    : emptyState('Boutique vide', 'Les produits officiels apparaîtront ici dès leur publication.');
  if (window.lucide) window.lucide.createIcons();
}

loadShop().catch((error) => toast(error.message));

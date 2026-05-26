mountLayout('shop');

async function loadShop() {
  const { products } = await API.get('/api/products');
  document.querySelector('#products-list').innerHTML = products.map(productCard).join('');
  if (window.lucide) window.lucide.createIcons();
}

loadShop().catch((error) => toast(error.message));


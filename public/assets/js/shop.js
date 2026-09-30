const productsList = document.querySelector('#products-list');
const categoryChips = document.querySelector('#category-chips');
let allProducts = [];
let activeCategory = '';

function renderProducts() {
  const visible = activeCategory ? allProducts.filter((product) => product.category === activeCategory) : allProducts;
  productsList.innerHTML = visible.length
    ? visible.map(productCard).join('')
    : emptyState({
        title: 'La boutique se prépare',
        message: 'Les articles officiels apparaîtront ici dès leur mise en vente.',
        art: '/assets/img/empty-bag.svg',
        actions: [{ label: 'Voir les événements', href: '/evenements.html' }]
      });
}

function renderChips() {
  const categories = [...new Set(allProducts.map((product) => product.category).filter(Boolean))];
  if (categories.length < 2) {
    categoryChips.hidden = true;
    return;
  }
  categoryChips.innerHTML = ['', ...categories].map((category) => `
    <button class="chip" type="button" data-category="${escapeHtml(category)}" aria-pressed="${category === activeCategory}">
      ${escapeHtml(category || 'Tout')}
    </button>`).join('');
}

categoryChips.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-category]');
  if (!chip) return;
  activeCategory = chip.dataset.category;
  renderChips();
  renderProducts();
});

async function loadShop() {
  productsList.innerHTML = skeletonCards(4, 'product');
  setLoading(productsList, true);
  try {
    const { products } = await API.get('/api/products');
    allProducts = products;
    renderChips();
    renderProducts();
  } catch (error) {
    renderError(productsList, error, loadShop);
  } finally {
    setLoading(productsList, false);
  }
}

loadShop();

mountLayout('shop');

async function loadProduct() {
  const id = new URLSearchParams(location.search).get('id');
  const { product } = await API.get(`/api/products/${id}`);
  document.querySelector('#product-detail').innerHTML = `
    <div class="hero-grid">
      <img class="thumb glass" style="border-radius:36px; aspect-ratio: 1 / 1;" src="${product.image_url}" alt="${product.name}">
      <div>
        <span class="eyebrow">${product.category}</span>
        <h1>${product.name}</h1>
        <p class="lead">${product.description}</p>
        <p class="mt-6 text-3xl font-extrabold">${formatMoney(product.price_xof)}</p>
        <form id="cart-form" class="grid grid-2 mt-6">
          <label class="label">Quantite<input class="input" type="number" name="quantity" min="1" value="1"></label>
          <button class="btn btn-primary self-end" type="submit"><i data-lucide="shopping-cart"></i>Ajouter au panier</button>
        </form>
      </div>
    </div>`;

  document.querySelector('#cart-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const quantity = Number(new FormData(event.currentTarget).get('quantity') || 1);
    const cart = JSON.parse(localStorage.getItem('festiconnect_cart') || '[]');
    const found = cart.find((item) => item.product_id === product.id);
    if (found) found.quantity += quantity;
    else cart.push({ product_id: product.id, quantity, name: product.name, price_xof: product.price_xof });
    localStorage.setItem('festiconnect_cart', JSON.stringify(cart));
    toast('Produit ajoute au panier.');
  });

  if (window.lucide) window.lucide.createIcons();
}

loadProduct().catch((error) => toast(error.message));


mountLayout('shop');

async function loadProduct() {
  const id = new URLSearchParams(location.search).get('id');
  const { product } = await API.get(`/api/products/${id}`);
  document.querySelector('#product-detail').innerHTML = `
    <div class="page-grid">
      <div class="breadcrumb">
        <a href="/">Accueil</a>
        <span>/</span>
        <a href="/boutique.html">Boutique</a>
        <span>/</span>
        <span>${product.name}</span>
      </div>
      <div class="detail-layout">
        <img class="thumb glass" style="border-radius:36px; aspect-ratio: 1 / 1;" src="${product.image_url}" alt="${product.name}">
        <section class="stack">
          <span class="eyebrow">${product.category}</span>
          <h1>${product.name}</h1>
          <p class="lead">${product.description}</p>
          <div class="section-soft">
            <h3>${formatMoney(product.price_xof)}</h3>
            <p class="muted mt-3">Produit officiel à ajouter au panier avant paiement.</p>
          </div>
          <form id="cart-form" class="grid grid-2 mt-2">
            <label class="label">Quantité<input class="input" type="number" name="quantity" min="1" value="1"></label>
            <button class="btn btn-primary self-end" type="submit"><i data-lucide="shopping-cart"></i>Ajouter au panier</button>
          </form>
        </section>
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

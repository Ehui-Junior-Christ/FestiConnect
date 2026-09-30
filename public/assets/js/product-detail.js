const productRoot = document.querySelector('#product-detail');

function productNotFound() {
  document.title = 'Produit introuvable · FestiConnect';
  productRoot.innerHTML = `
    <div class="section-tight">
      ${emptyState({
        title: 'Produit introuvable',
        message: 'Cet article n\'est plus en vente ou le lien est incomplet.',
        art: '/assets/img/empty-bag.svg',
        actions: [{ label: 'Retour à la boutique', href: '/boutique.html', variant: 'primary' }]
      })}
    </div>`;
}

function stockBadge(stock) {
  if (stock === null) return '';
  if (stock <= 0) return '<span class="badge badge-danger badge-dot">Rupture de stock</span>';
  if (stock <= 10) return `<span class="badge badge-warning badge-dot">Plus que ${formatNumber(stock)} en stock</span>`;
  return '<span class="badge badge-success badge-dot">En stock</span>';
}

function renderProduct(product) {
  document.title = `${product.name} · FestiConnect`;
  const stock = product.stock === undefined || product.stock === null ? null : Number(product.stock);
  const inCart = Cart.items().find((item) => item.product_id === product.id);
  const alreadyInCart = inCart ? Number(inCart.quantity) : 0;
  const maxQty = stock === null ? 20 : Math.max(1, Math.min(20, stock - alreadyInCart));
  const available = stock === null || stock - alreadyInCart > 0;

  productRoot.innerHTML = `
    <nav class="breadcrumb" aria-label="Fil d'Ariane">
      <ol>
        <li><a href="/">Accueil</a></li>
        <li><a href="/boutique.html">Boutique</a></li>
        <li><span aria-current="page">${escapeHtml(product.name)}</span></li>
      </ol>
    </nav>
    <div class="product-layout">
      <div class="cover">
        <img src="${escapeHtml(safeUrl(product.image_url, '/assets/img/product-default.svg'))}" alt="${escapeHtml(product.name)}" width="800" height="800">
      </div>
      <section class="stack" aria-labelledby="product-title">
        ${product.category ? `<span class="kicker">${escapeHtml(product.category)}</span>` : ''}
        <h1 id="product-title">${escapeHtml(product.name)}</h1>
        <div class="cluster">
          <span class="price price-lg">${escapeHtml(formatMoney(product.price_xof))}</span>
          ${stockBadge(stock)}
        </div>
        ${product.description ? `<p class="lead">${escapeHtml(product.description)}</p>` : ''}

        <form id="cart-form" class="buy-card mt-2" novalidate>
          ${available ? `
            <div class="buy-row">
              <label class="field-label" for="quantity">Quantité</label>
              ${stepper({ name: 'quantity', value: 1, min: 1, max: maxQty, label: 'Quantité', id: 'quantity' })}
            </div>
            <button class="btn btn-primary btn-lg btn-block" type="submit">${icon('cart')}<span>Ajouter au panier</span></button>
          ` : alertBox('warning', alreadyInCart ? 'Tu as déjà tout le stock disponible dans ton panier.' : 'Cet article est épuisé pour le moment.')}
          ${alreadyInCart ? `<p class="small muted" data-in-cart>Déjà ${escapeHtml(plural(alreadyInCart, 'exemplaire', 'exemplaires'))} dans ton <a href="/panier.html">panier</a>.</p>` : '<p class="small muted" data-in-cart hidden></p>'}
          <ul class="reassure">
            <li>${icon('mobile')}<span>Paiement Wave, Orange Money ou Moov Money</span></li>
            <li>${icon('truck')}<span>Livraison à l'adresse indiquée lors du paiement</span></li>
          </ul>
        </form>
      </section>
    </div>`;

  const form = productRoot.querySelector('#cart-form');
  document.querySelectorAll('[data-stepper]').forEach(syncStepper);
  enhanceForm(form);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.elements.quantity || !validateForm(form)) return;
    const quantity = Number(new FormData(form).get('quantity') || 1);
    Cart.add(product, quantity);
    const total = Cart.items().find((item) => item.product_id === product.id)?.quantity || quantity;
    const note = form.querySelector('[data-in-cart]');
    note.innerHTML = `Déjà ${escapeHtml(plural(total, 'exemplaire', 'exemplaires'))} dans ton <a href="/panier.html">panier</a>.`;
    note.hidden = false;
    if (stock !== null) {
      const remaining = stock - total;
      if (remaining <= 0) {
        renderProduct(product);
      } else {
        form.elements.quantity.max = String(Math.min(20, remaining));
        form.elements.quantity.value = '1';
        syncStepper(form.querySelector('[data-stepper]'));
      }
    }
    toast(`${product.name} ajouté au panier.`, { type: 'success', action: { label: 'Voir le panier', href: '/panier.html' } });
  });
}

async function loadProduct() {
  const id = queryParam('id');
  if (!id) {
    productNotFound();
    return;
  }
  productRoot.setAttribute('aria-busy', 'true');
  try {
    const { product } = await API.get(`/api/products/${encodeURIComponent(id)}`);
    renderProduct(product);
  } catch (error) {
    if (error.status === 404) productNotFound();
    else renderError(productRoot, error, loadProduct);
  } finally {
    productRoot.setAttribute('aria-busy', 'false');
  }
}

loadProduct();

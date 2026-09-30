const cartList = document.querySelector('#cart-items');
const checkoutForm = document.querySelector('#checkout-form');
const checkoutPanel = document.querySelector('#checkout-panel');
const submitButton = checkoutForm.querySelector('[data-submit]');
const submitLabel = checkoutForm.querySelector('[data-submit-label]');

function cartItemRow(item) {
  const image = safeUrl(item.image_url, '/assets/img/product-default.svg');
  const lineTotal = Number(item.price_xof) * Number(item.quantity);
  return `
    <li class="cart-item" data-id="${escapeHtml(item.product_id)}">
      <img src="${escapeHtml(image)}" alt="" width="88" height="88" loading="lazy">
      <div>
        <h3><a href="/produit.html?id=${encodeURIComponent(item.product_id)}">${escapeHtml(item.name)}</a></h3>
        <p class="small muted">${escapeHtml(formatMoney(item.price_xof))} l'unité</p>
      </div>
      <div class="cart-item-foot">
        ${stepper({ name: `qty-${item.product_id}`, value: item.quantity, min: 1, max: 50, label: `Quantité pour ${item.name}`, small: true })}
        <div class="cluster">
          <strong class="price">${escapeHtml(formatMoney(lineTotal))}</strong>
          <button class="btn btn-ghost btn-icon btn-sm" type="button" data-remove aria-label="Retirer ${escapeHtml(item.name)} du panier">${icon('trash')}</button>
        </div>
      </div>
    </li>`;
}

function renderCart() {
  const items = Cart.items();
  const total = Cart.total();
  const count = Cart.count();

  if (!items.length) {
    cartList.innerHTML = `<li>${emptyState({
      title: 'Ton panier est vide',
      message: 'Casquettes, sacs, affiches collector : fais un tour à la boutique.',
      art: '/assets/img/empty-bag.svg',
      actions: [{ label: 'Voir la boutique', href: '/boutique.html', variant: 'primary', icon: 'store' }]
    })}</li>`;
    checkoutPanel.hidden = true;
  } else {
    cartList.innerHTML = items.map(cartItemRow).join('');
    checkoutPanel.hidden = false;
    document.querySelectorAll('[data-stepper]').forEach(syncStepper);
  }

  document.querySelector('#cart-total').textContent = formatMoney(total);
  checkoutForm.querySelector('[data-subtotal]').textContent = formatMoney(total);
  checkoutForm.querySelector('[data-items-label]').textContent = `Articles (${formatNumber(count)})`;
  submitLabel.textContent = API.user() ? `Payer ${formatMoney(total)}` : 'Continuer vers le paiement';
  checkoutForm.querySelector('[data-guest-note]').hidden = Boolean(API.user());
}

cartList.addEventListener('change', (event) => {
  const input = event.target.closest('[data-stepper] input');
  if (!input) return;
  const id = input.closest('[data-id]').dataset.id;
  const quantity = Math.max(1, Math.min(50, Math.round(Number(input.value) || 1)));
  Cart.setQuantity(id, quantity);
  const focusedName = input.name;
  renderCart();
  document.querySelector(`input[name="${CSS.escape(focusedName)}"]`)?.focus();
});

cartList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove]');
  if (!button) return;
  const row = button.closest('[data-id]');
  const removed = Cart.items().find((item) => item.product_id === row.dataset.id);
  Cart.remove(row.dataset.id);
  renderCart();
  if (removed) toast(`${removed.name} retiré du panier.`, { type: 'info' });
});

document.addEventListener('cart:change', () => {
  document.querySelector('#cart-total').textContent = formatMoney(Cart.total());
});

// Les paniers enregistrés avant l'ajout des vignettes n'ont pas d'image : on les complète.
if (Cart.items().some((item) => !item.image_url)) {
  API.get('/api/products').then(({ products }) => {
    const images = new Map(products.map((product) => [product.id, product.image_url]));
    Cart.save(Cart.items().map((item) => ({ ...item, image_url: item.image_url || images.get(item.product_id) })));
    renderCart();
  }).catch(() => { /* vignettes par défaut */ });
}

// Pré-remplissage avec la ville du compte, si l'utilisateur est connecté.
const cartUser = API.user();
if (cartUser?.city && !checkoutForm.elements.delivery_city.value) {
  checkoutForm.elements.delivery_city.value = cartUser.city;
}

enhanceForm(checkoutForm);
checkoutForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFormNotice(checkoutForm);
  const cart = Cart.items();
  if (!cart.length) return;
  if (!validateForm(checkoutForm)) return;

  if (!API.user()) {
    location.href = loginUrl('/panier.html');
    return;
  }

  const data = Object.fromEntries(new FormData(checkoutForm));
  // Même format qu'avant : seuls les champs d'origine des articles sont envoyés.
  const items = cart.map(({ product_id, quantity, name, price_xof }) => ({ product_id, quantity, name, price_xof }));
  setBusy(submitButton, true);
  try {
    const order = await API.post('/api/orders', { ...data, items });
    Cart.clear();
    const params = new URLSearchParams({ kind: 'order', id: order.id, amount: order.total_xof, payment: data.payment_method || '' });
    location.href = `/confirmation.html?${params}`;
  } catch (error) {
    setBusy(submitButton, false);
    if (error.status === 401) {
      formNotice(checkoutForm, 'Ta session a expiré. Reconnecte-toi : ton panier est conservé.');
      setTimeout(() => { location.href = loginUrl('/panier.html'); }, 1200);
    } else if (error.status === 403) {
      formNotice(checkoutForm, 'Les commandes se passent avec un compte client. Connecte-toi avec ton compte client pour payer.');
    } else {
      formNotice(checkoutForm, error.message);
    }
  }
});

renderCart();

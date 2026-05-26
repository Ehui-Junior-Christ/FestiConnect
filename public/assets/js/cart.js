mountLayout('shop');

function renderCart() {
  const cart = JSON.parse(localStorage.getItem('festiconnect_cart') || '[]');
  const total = cart.reduce((sum, item) => sum + Number(item.price_xof) * Number(item.quantity), 0);
  document.querySelector('#cart-items').innerHTML = cart.length
    ? cart.map((item) => `<div class="panel glass flex items-center justify-between gap-4"><div><h3>${item.name}</h3><p class="muted">${item.quantity} x ${formatMoney(item.price_xof)}</p></div><strong>${formatMoney(item.quantity * item.price_xof)}</strong></div>`).join('')
    : '<div class="panel glass"><h3>Panier vide</h3><p class="muted mt-3">Ajoute des articles depuis la boutique culturelle.</p><a class="btn btn-primary mt-5" href="/boutique.html"><i data-lucide="shopping-bag"></i>Voir la boutique</a></div>';
  document.querySelector('#cart-total').textContent = formatMoney(total);
}

document.querySelector('#checkout-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!API.user()) return location.href = '/connexion.html';
  const cart = JSON.parse(localStorage.getItem('festiconnect_cart') || '[]');
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const order = await API.post('/api/orders', { ...data, items: cart });
  localStorage.removeItem('festiconnect_cart');
  renderCart();
  location.href = `/confirmation.html?kind=order&id=${encodeURIComponent(order.id)}&amount=${encodeURIComponent(order.total_xof)}&payment=${encodeURIComponent(data.payment_method || '')}`;
});

renderCart();
if (window.lucide) window.lucide.createIcons();

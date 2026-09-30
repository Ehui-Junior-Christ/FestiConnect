const detailRoot = document.querySelector('#event-detail');
const buyBar = document.querySelector('#buy-bar');
const MAX_TICKETS = 10; // plafond par achat imposé par le serveur
const PAYMENT_METHODS = [
  { value: 'Wave', dot: 'pay-wave' },
  { value: 'Orange Money', dot: 'pay-orange' },
  { value: 'Moov Money', dot: 'pay-moov' }
];

function paymentChoices(selected = 'Wave') {
  return `
    <fieldset class="choices choices-3">
      <legend class="field-label">Moyen de paiement</legend>
      ${PAYMENT_METHODS.map((method) => `
        <label class="choice">
          <input type="radio" name="payment_method" value="${escapeHtml(method.value)}"${method.value === selected ? ' checked' : ''}>
          <span class="pay-dot ${method.dot}" aria-hidden="true"></span>
          ${escapeHtml(method.value)}
        </label>`).join('')}
    </fieldset>`;
}

function notFoundView() {
  document.title = 'Événement introuvable · FestiConnect';
  detailRoot.innerHTML = `
    <div class="section-tight">
      ${emptyState({
        title: 'Événement introuvable',
        message: 'Le lien est peut-être incomplet, ou l\'événement a été retiré par son organisateur.',
        actions: [{ label: 'Voir les événements', href: '/evenements.html', variant: 'primary' }]
      })}
    </div>`;
}

function categoryLeft(category) {
  return Math.max(0, Number(category.capacity || 0) - Number(category.sold || 0));
}

// Prix d'appel : le moins cher des tarifs encore disponibles.
function startingPrice(event) {
  const open = (event.categories || []).filter((category) => categoryLeft(category) > 0);
  if (!open.length) return Number(event.price_xof || 0);
  return Math.min(...open.map((category) => Number(category.price_xof || 0)));
}

function categoryChoices(event, selectedId) {
  return `
    <fieldset class="choices cat-choices">
      <legend class="field-label">Catégorie de billet</legend>
      ${event.categories.map((category) => {
        const left = categoryLeft(category);
        const scarce = left > 0 && left <= Math.max(10, category.capacity * 0.15);
        const state = left === 0 ? '<span class="badge badge-danger">Complet</span>'
          : scarce ? `<span class="badge badge-warning badge-dot">Plus que ${formatNumber(left)}</span>` : '';
        return `
          <label class="choice cat-choice${left === 0 ? ' is-disabled' : ''}">
            <input type="radio" name="category_id" value="${escapeHtml(category.id)}" data-price="${Number(category.price_xof)}" data-left="${left}"${category.id === selectedId ? ' checked' : ''}${left === 0 ? ' disabled' : ''}>
            <span class="cat-name">${escapeHtml(category.name)}</span>
            <span class="cat-price">${escapeHtml(formatPrice(category.price_xof))}</span>
            ${state}
          </label>`;
      }).join('')}
    </fieldset>`;
}

function bookingBlock(event, user) {
  const hasCategories = Boolean(event.categories?.length);
  const firstOpen = hasCategories ? event.categories.find((category) => categoryLeft(category) > 0) : null;
  const left = hasCategories ? (firstOpen ? categoryLeft(firstOpen) : 0) : seatsLeft(event);
  const soldOut = hasCategories ? !firstOpen : left === 0;
  const approved = event.status === 'approved';
  const maxQty = left === null ? MAX_TICKETS : Math.max(1, Math.min(MAX_TICKETS, left));
  const unitPrice = hasCategories && firstOpen ? Number(firstOpen.price_xof) : Number(event.price_xof || 0);
  const phase = eventPhase(event);
  let blocker = '';
  if (!approved) blocker = alertBox('warning', 'Cet événement n\'est pas encore ouvert à la réservation : il est en cours de validation.');
  else if (phase === 'live') blocker = alertBox('info', `L'événement a commencé à ${formatTime(event.starts_at)} : la réservation en ligne est fermée. Renseigne-toi sur place pour la vente au guichet.`, 'Billetterie fermée');
  else if (phase === 'past') blocker = alertBox('info', 'La billetterie est fermée. Merci à celles et ceux qui sont venus.', 'Événement terminé');
  else if (soldOut) blocker = alertBox('warning', 'Tous les billets ont été vendus pour cet événement.', 'Complet');
  else if (user && user.role === 'organisateur') blocker = alertBox('info', 'Les billets se réservent avec un compte client. Déconnecte-toi puis connecte-toi avec ton compte client.');

  const capacity = Number(event.capacity || 0);
  const eventLeft = seatsLeft(event);
  const price = hasCategories ? startingPrice(event) : Number(event.price_xof || 0);
  return `
    <form class="buy-card" id="ticket-form" novalidate aria-labelledby="buy-title">
      <div class="buy-row">
        <div>
          <h2 id="buy-title" class="small muted">${hasCategories && event.categories.length > 1 ? 'À partir de' : 'Prix par billet'}</h2>
          <span class="price${price === 0 ? ' price-free' : ''}">${escapeHtml(formatPrice(price))}</span>
        </div>
        ${eventLeft !== null && eventLeft > 0 && phase === 'upcoming' ? `<span class="badge ${eventLeft <= capacity * 0.15 ? 'badge-warning' : 'badge-success'} badge-dot">${escapeHtml(plural(eventLeft, 'place restante', 'places restantes'))}</span>` : ''}
      </div>
      ${capacity && phase === 'upcoming' ? `<div><div class="meter" role="img" aria-label="${escapeHtml(`${formatNumber(event.tickets_sold)} billets vendus sur ${formatNumber(capacity)}`)}"><span data-meter="${Math.min(100, Math.round((Number(event.tickets_sold || 0) / capacity) * 100))}"></span></div>
        <p class="small muted mt-2">${escapeHtml(formatNumber(event.tickets_sold))} billets déjà vendus</p></div>` : ''}
      ${blocker || `
        ${hasCategories ? categoryChoices(event, firstOpen?.id) : ''}
        <div class="field">
          <label class="field-label" for="quantity">Nombre de billets</label>
          ${stepper({ name: 'quantity', value: 1, min: 1, max: maxQty, label: 'Nombre de billets', id: 'quantity' })}
          <p class="field-hint" data-qty-hint></p>
        </div>
        ${paymentChoices()}
        <div class="promo-box">
          <button class="link-button" type="button" data-promo-toggle aria-expanded="false" aria-controls="promo-field">${icon('tag')}<span>J'ai un code promo</span></button>
          <div class="field" id="promo-field" hidden>
            <label class="field-label" for="promo-code">Code promo</label>
            <div class="promo-row">
              <input class="input mono" id="promo-code" name="promo_code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="20" placeholder="Ex. BASSAM10">
              <button class="btn" type="button" data-promo-apply>Appliquer</button>
            </div>
            <p class="field-hint" data-promo-status aria-live="polite"></p>
          </div>
        </div>
        <div class="total-lines">
          <div class="total-line" data-discount-row hidden><span data-discount-label>Remise</span><strong data-discount></strong></div>
          <div class="total-row"><span>Total à payer</span><strong data-total>${escapeHtml(formatMoney(unitPrice))}</strong></div>
        </div>
        <button class="btn btn-primary btn-lg btn-block" type="submit" data-submit><span data-submit-label>${user ? 'Confirmer et payer' : 'Continuer'}</span></button>
        ${user ? '' : '<p class="small muted">Tu te connecteras (ou créeras ton compte) à l\'étape suivante. Ta sélection est conservée.</p>'}
        <ul class="reassure">
          <li>${icon('check')}<span>Billet et QR code d'entrée disponibles tout de suite dans ton espace client</span></li>
          <li>${icon('mobile')}<span>Paiement Wave, Orange Money ou Moov Money</span></li>
        </ul>`}
    </form>`;
}

function render(event) {
  const user = API.user();
  const place = event.location && event.location !== event.city ? event.location : event.city;
  document.title = `${event.title} · FestiConnect`;

  detailRoot.innerHTML = `
    <nav class="breadcrumb" aria-label="Fil d'Ariane">
      <ol>
        <li><a href="/">Accueil</a></li>
        <li><a href="/evenements.html">Événements</a></li>
        <li><span aria-current="page">${escapeHtml(event.title)}</span></li>
      </ol>
    </nav>
    <div class="cover">
      <img src="${escapeHtml(safeUrl(event.cover_url, '/assets/img/event-default.svg'))}" alt="Visuel de ${escapeHtml(event.title)}" width="960" height="600">
    </div>
    <div class="detail">
      <div class="detail-info">
        <div class="cluster">
          ${event.category ? `<span class="badge badge-brand">${escapeHtml(event.category)}</span>` : ''}
          ${event.status !== 'approved' ? statusBadge(event.status) : ''}
        </div>
        <h1>${escapeHtml(event.title)}</h1>
        <ul class="fact-list">
          <li><span class="fact-icon">${icon('calendar')}</span><div><strong>${escapeHtml(formatDay(event.starts_at))}</strong><span>${escapeHtml(formatTimeRange(event.starts_at, event.ends_at))}</span></div></li>
          <li><span class="fact-icon">${icon('pin')}</span><div><strong>${escapeHtml(place)}</strong><span>${escapeHtml(event.city)}</span></div></li>
          ${event.organizer_name ? `<li><span class="fact-icon">${icon('users')}</span><div><strong>${escapeHtml(event.organizer_name)}</strong><span>Organisateur</span></div></li>` : ''}
        </ul>
        <div class="cluster mt-6">
          ${event.status === 'approved' ? favButton(event, { withLabel: true }) : ''}
          <button class="btn btn-sm" type="button" data-share>${icon('share')}<span>Partager</span></button>
          <a class="btn btn-sm btn-ghost" href="/evenements.html?city=${encodeURIComponent(event.city || '')}">${icon('pin')}<span>Autres dates à ${escapeHtml(event.city)}</span></a>
        </div>
      </div>

      <aside class="detail-buy" id="reserver">
        ${bookingBlock(event, user)}
      </aside>

      <section class="detail-about" aria-labelledby="about-title">
        <h2 id="about-title">À propos</h2>
        <div class="prose mt-4"><p>${escapeHtml(event.description || 'L\'organisateur n\'a pas encore ajouté de description.')}</p></div>
        <h2 class="mt-8">Infos pratiques</h2>
        <dl class="profile-list mt-4">
          <div><dt>Date</dt><dd>${escapeHtml(formatDay(event.starts_at))}</dd></div>
          <div><dt>Horaires</dt><dd>${escapeHtml(formatTimeRange(event.starts_at, event.ends_at))}</dd></div>
          <div><dt>Lieu</dt><dd>${escapeHtml([event.location, event.city].filter(Boolean).join(', '))}</dd></div>
          ${event.capacity ? `<div><dt>Jauge</dt><dd>${escapeHtml(plural(event.capacity, 'personne', 'personnes'))}</dd></div>` : ''}
          <div><dt>Billet</dt><dd>Rattaché à ton compte, un code d'entrée par réservation</dd></div>
        </dl>
      </section>
    </div>`;

  detailRoot.querySelectorAll('[data-meter]').forEach((bar) => {
    bar.style.width = `${bar.dataset.meter}%`;
  });
  detailRoot.querySelector('[data-share]')?.addEventListener('click', () => shareLink({ title: event.title }));

  const form = detailRoot.querySelector('#ticket-form');
  if (form.querySelector('[data-submit]')) wireBooking(form, event, user);
  setupBuyBar(event, Boolean(form.querySelector('[data-submit]')));
}

function selectedCategory(form) {
  return form.querySelector('input[name="category_id"]:checked');
}

function wireBooking(form, event, user) {
  const quantityInput = form.elements.quantity;
  const totalNode = form.querySelector('[data-total]');
  const label = form.querySelector('[data-submit-label]');
  const button = form.querySelector('[data-submit]');
  const hint = form.querySelector('[data-qty-hint]');
  document.querySelectorAll('[data-stepper]').forEach(syncStepper);

  // Plafond de quantité : places restantes de la catégorie choisie (ou de l'événement).
  const syncLimits = () => {
    const chosen = selectedCategory(form);
    const left = chosen ? Number(chosen.dataset.left) : seatsLeft(event);
    const max = left === null ? MAX_TICKETS : Math.max(1, Math.min(MAX_TICKETS, left));
    quantityInput.max = String(max);
    if (Number(quantityInput.value) > max) quantityInput.value = String(max);
    syncStepper(quantityInput.closest('[data-stepper]'));
    hint.textContent = max < MAX_TICKETS
      ? `${plural(max, 'place disponible', 'places disponibles')} au maximum${chosen ? ' dans cette catégorie' : ''}.`
      : `Jusqu'à ${MAX_TICKETS} billets par réservation.`;
  };

  const unitPrice = () => {
    const chosen = selectedCategory(form);
    return chosen ? Number(chosen.dataset.price) : Number(event.price_xof || 0);
  };

  // Code promo : vérifié par le serveur, remise recalculée ici pour l'aperçu
  // (le serveur la recalcule de toute façon au paiement).
  const promoInput = form.elements.promo_code;
  const promoStatus = form.querySelector('[data-promo-status]');
  const promoField = form.querySelector('#promo-field');
  const promoToggle = form.querySelector('[data-promo-toggle]');
  const promoApply = form.querySelector('[data-promo-apply]');
  const discountRow = form.querySelector('[data-discount-row]');
  let appliedPromo = null;

  const discountFor = (subtotal) => {
    if (!appliedPromo) return 0;
    return appliedPromo.kind === 'percent'
      ? Math.min(subtotal, Math.floor((subtotal * appliedPromo.value) / 100))
      : Math.min(subtotal, appliedPromo.value);
  };

  const setPromoStatus = (message, tone = '') => {
    promoStatus.textContent = message;
    promoStatus.className = `field-hint${tone ? ` hint-${tone}` : ''}`;
  };

  const refresh = () => {
    const qty = Math.max(1, Number(quantityInput.value) || 1);
    const subtotal = qty * unitPrice();
    const discount = discountFor(subtotal);
    const total = subtotal - discount;
    discountRow.hidden = !discount;
    if (discount) {
      form.querySelector('[data-discount-label]').textContent = `Code ${appliedPromo.code} (${appliedPromo.label})`;
      form.querySelector('[data-discount]').textContent = `-${formatMoney(discount)}`;
    }
    totalNode.textContent = formatMoney(total);
    if (user) label.textContent = total > 0 ? `Payer ${formatMoney(total)}` : 'Confirmer la réservation';
  };

  const openPromo = () => {
    promoField.hidden = false;
    promoToggle.setAttribute('aria-expanded', 'true');
  };

  promoToggle.addEventListener('click', () => {
    openPromo();
    promoInput.focus();
  });

  promoInput.addEventListener('input', () => {
    if (appliedPromo) {
      appliedPromo = null;
      setPromoStatus('');
      refresh();
    }
  });

  promoInput.addEventListener('keydown', (keyEvent) => {
    if (keyEvent.key === 'Enter') {
      keyEvent.preventDefault();
      promoApply.click();
    }
  });

  promoApply.addEventListener('click', async () => {
    const code = promoInput.value.trim().toUpperCase();
    promoInput.value = code;
    if (!code) {
      setPromoStatus('Saisis ton code avant de l\'appliquer.', 'error');
      return;
    }
    if (!API.user()) {
      setPromoStatus('Connecte-toi pour vérifier ce code : il sera appliqué au paiement.', 'info');
      return;
    }
    setBusy(promoApply, true);
    try {
      const chosen = selectedCategory(form);
      const result = await API.post('/api/promos/check', {
        event_id: event.id,
        code,
        quantity: quantityInput.value,
        category_id: chosen ? chosen.value : undefined
      });
      if (result.valid) {
        appliedPromo = result.promo;
        setPromoStatus(`Code ${result.promo.code} appliqué : ${result.promo.label}.`, 'success');
      } else {
        appliedPromo = null;
        setPromoStatus(result.error.message, 'error');
      }
    } catch (error) {
      appliedPromo = null;
      setPromoStatus(error.message, 'error');
    } finally {
      setBusy(promoApply, false);
      refresh();
    }
  });
  quantityInput.addEventListener('input', refresh);
  form.addEventListener('change', (changeEvent) => {
    if (changeEvent.target.name === 'category_id') {
      syncLimits();
      refresh();
    }
  });
  syncLimits();
  refresh();

  // Si l'utilisateur revient de la connexion, on restaure sa sélection.
  const saved = sessionStorage.getItem('festiconnect_pending_ticket');
  if (saved) {
    try {
      const pending = JSON.parse(saved);
      if (pending.event_id === event.id) {
        quantityInput.value = pending.quantity;
        const radio = [...form.elements.payment_method].find((item) => item.value === pending.payment_method);
        if (radio) radio.checked = true;
        const category = [...form.querySelectorAll('input[name="category_id"]')].find((item) => item.value === pending.category_id && !item.disabled);
        if (category) category.checked = true;
        if (pending.promo_code) {
          promoInput.value = pending.promo_code;
          openPromo();
          promoApply.click();
        }
        syncLimits();
        refresh();
      }
    } catch { /* sélection illisible : on l'ignore */ }
    sessionStorage.removeItem('festiconnect_pending_ticket');
  }

  enhanceForm(form);
  form.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    clearFormNotice(form);
    if (!validateForm(form)) return;
    const data = Object.fromEntries(new FormData(form));

    if (!API.user()) {
      sessionStorage.setItem('festiconnect_pending_ticket', JSON.stringify({ ...data, event_id: event.id }));
      location.href = loginUrl(`${location.pathname}${location.search}#reserver`);
      return;
    }

    setBusy(button, true);
    try {
      const ticket = await API.post('/api/tickets', { ...data, event_id: event.id });
      const params = new URLSearchParams({
        kind: 'ticket',
        id: ticket.id,
        amount: ticket.amount_xof,
        event: event.title,
        category: ticket.category_name || '',
        discount: ticket.discount_xof || 0,
        payment: data.payment_method || '',
        qty: data.quantity || '1'
      });
      location.href = `/confirmation.html?${params}`;
    } catch (error) {
      setBusy(button, false);
      if (error.status === 401) {
        formNotice(form, 'Ta session a expiré. Reconnecte-toi, ta sélection sera conservée.');
        sessionStorage.setItem('festiconnect_pending_ticket', JSON.stringify({ ...data, event_id: event.id }));
        setTimeout(() => { location.href = loginUrl(`${location.pathname}${location.search}#reserver`); }, 1200);
      } else if (error.status === 403) {
        formNotice(form, 'Les billets se réservent avec un compte client. Connecte-toi avec ton compte client pour continuer.');
      } else {
        formNotice(form, error.message);
      }
    }
  });
}

// Barre collante sur mobile : prix + accès direct au formulaire, masquée quand il est visible.
function setupBuyBar(event, canBook) {
  if (!buyBar) return;
  const several = (event.categories?.length || 0) > 1;
  buyBar.innerHTML = `
    <div>${several ? '<span class="small">À partir de</span>' : ''}<strong class="price">${escapeHtml(formatPrice(startingPrice(event)))}</strong>${several ? '' : '<span class="small">par billet</span>'}</div>
    <a class="btn btn-primary" href="#reserver">${canBook ? 'Réserver' : 'Voir les détails'}</a>`;
  buyBar.hidden = false;
  document.body.classList.add('has-buy-bar');
  const target = document.querySelector('#reserver');
  if (!('IntersectionObserver' in window) || !target) {
    buyBar.classList.remove('is-hidden');
    return;
  }
  new IntersectionObserver(([entry]) => {
    buyBar.classList.toggle('is-hidden', entry.isIntersecting);
  }, { threshold: 0.15 }).observe(target);
}

async function loadEvent() {
  const id = queryParam('id');
  if (!id) {
    notFoundView();
    return;
  }
  detailRoot.setAttribute('aria-busy', 'true');
  try {
    const { event } = await API.get(`/api/events/${encodeURIComponent(id)}`);
    render(event);
    if (location.hash === '#reserver') document.querySelector('#reserver')?.scrollIntoView({ block: 'start' });
  } catch (error) {
    if (error.status === 404) notFoundView();
    else renderError(detailRoot, error, loadEvent);
  } finally {
    detailRoot.setAttribute('aria-busy', 'false');
  }
}

loadEvent();

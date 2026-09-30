/* Création et modification d'événement, avec catégories de billets.
   Dépend de organizer.js (organizerUser, loadOrganizer). */
const eventForm = document.querySelector('#event-create-form');
const catRows = document.querySelector('#cat-rows');
const singlePricing = document.querySelector('#single-pricing');
const createTitle = document.querySelector('#create-title');
const createIntro = document.querySelector('#create-intro');
const editCancel = document.querySelector('#edit-cancel');
const MAX_CATEGORY_ROWS = 8;
let editingEvent = null;
let catRowSeq = 0;

function categoryRow({ id = '', name = '', price_xof: price = '', capacity = '', sold = 0 } = {}) {
  catRowSeq += 1;
  const n = catRowSeq;
  const soldCount = Number(sold || 0);
  return `
    <li class="cat-row" data-cat-id="${escapeHtml(id)}">
      <div class="field">
        <label class="field-label" for="cat-name-${n}">Nom</label>
        <input class="input" id="cat-name-${n}" data-cat="name" required minlength="2" maxlength="40" value="${escapeHtml(name)}" placeholder="Ex. Carré VIP" data-msg-required="Donne un nom à cette catégorie.">
      </div>
      <div class="field">
        <label class="field-label" for="cat-price-${n}">Prix (FCFA)</label>
        <input class="input" id="cat-price-${n}" data-cat="price_xof" type="number" inputmode="numeric" required min="0" step="1" value="${escapeHtml(price)}" placeholder="5000" data-msg-required="Indique le prix (0 si gratuit).">
      </div>
      <div class="field">
        <label class="field-label" for="cat-cap-${n}">Places</label>
        <input class="input" id="cat-cap-${n}" data-cat="capacity" type="number" inputmode="numeric" required min="${Math.max(1, soldCount)}" step="1" value="${escapeHtml(capacity)}" placeholder="100" data-msg-required="Indique le nombre de places." data-msg-min="${soldCount ? `${soldCount} billets déjà vendus : minimum ${soldCount}.` : 'Au moins 1 place.'}">
      </div>
      <button class="btn btn-ghost btn-icon" type="button" data-remove-cat${soldCount ? ' disabled' : ''} aria-label="Retirer la catégorie ${escapeHtml(name || 'sans nom')}">${icon('trash')}</button>
      ${soldCount ? `<p class="sold-note">${escapeHtml(plural(soldCount, 'billet déjà vendu', 'billets déjà vendus'))} : jauge minimale ${formatNumber(soldCount)}, suppression impossible.</p>` : ''}
    </li>`;
}

// Avec des catégories, le prix et la jauge uniques ne servent plus.
function syncPricingMode() {
  const hasRows = catRows.children.length > 0;
  singlePricing.hidden = hasRows;
  singlePricing.querySelectorAll('input').forEach((input) => { input.disabled = hasRows; });
  document.querySelectorAll('[data-add-cat]').forEach((button) => { button.disabled = catRows.children.length >= MAX_CATEGORY_ROWS; });
}

function addCategoryRow(values, focus = true) {
  catRows.insertAdjacentHTML('beforeend', categoryRow(values));
  syncPricingMode();
  if (focus) {
    const row = catRows.lastElementChild;
    (row.querySelector('[data-cat="name"]').value ? row.querySelector('[data-cat="price_xof"]') : row.querySelector('[data-cat="name"]')).focus();
  }
}

function collectCategories() {
  return [...catRows.querySelectorAll('.cat-row')].map((row) => {
    const value = (key) => row.querySelector(`[data-cat="${key}"]`).value.trim();
    const category = { name: value('name'), price_xof: value('price_xof'), capacity: value('capacity') };
    if (row.dataset.catId) category.id = row.dataset.catId;
    return category;
  });
}

function eventPayload() {
  const data = {};
  ['title', 'category', 'city', 'location', 'starts_at', 'ends_at', 'price_xof', 'capacity', 'description'].forEach((name) => {
    const field = eventForm.elements[name];
    if (field && !field.disabled) data[name] = field.value.trim();
  });
  if (editingEvent) data.cover_url = editingEvent.cover_url;
  data.categories = collectCategories();
  return data;
}

function resetEventForm() {
  editingEvent = null;
  eventForm.reset();
  catRows.innerHTML = '';
  syncPricingMode();
  eventForm.querySelectorAll('[data-touched]').forEach((field) => delete field.dataset.touched);
  eventForm.querySelectorAll('[aria-invalid]').forEach((field) => setFieldError(field, ''));
  createTitle.textContent = 'Créer un événement';
  createIntro.textContent = 'Ton événement sera relu par l\'équipe FestiConnect avant d\'apparaître dans le catalogue.';
  eventForm.querySelector('[data-submit-label]').textContent = organizerUser?.role === 'admin' ? 'Publier' : 'Soumettre à validation';
  editCancel.hidden = true;
}

// Ouvre le formulaire en mode modification pour un événement de l'organisateur.
async function startEditEvent(eventId) {
  try {
    const { event } = await API.get(`/api/events/${encodeURIComponent(eventId)}`);
    resetEventForm();
    editingEvent = event;
    ['title', 'category', 'city', 'location', 'starts_at', 'ends_at', 'price_xof', 'capacity', 'description'].forEach((name) => {
      if (eventForm.elements[name]) eventForm.elements[name].value = event[name] ?? '';
    });
    (event.categories || []).forEach((category) => addCategoryRow(category, false));
    syncPricingMode();
    createTitle.textContent = `Modifier « ${event.title} »`;
    createIntro.textContent = Number(event.tickets_sold || 0) > 0
      ? `${plural(event.tickets_sold, 'billet déjà vendu', 'billets déjà vendus')} : les jauges ne peuvent pas descendre sous les ventes. Si tu changes la date ou le lieu, les détenteurs de billets sont prévenus.`
      : 'Les modifications sont visibles tout de suite sur la fiche de l\'événement.';
    eventForm.querySelector('[data-submit-label]').textContent = 'Enregistrer les modifications';
    editCancel.hidden = false;
    document.querySelector('#creation').scrollIntoView({ block: 'start' });
    eventForm.elements.title.focus({ preventScroll: true });
  } catch (error) {
    toast(error.message, { type: 'error' });
  }
}

enhanceForm(eventForm);
syncPricingMode();

document.querySelector('.cat-presets').addEventListener('click', (event) => {
  const button = event.target.closest('[data-add-cat]');
  if (!button || button.disabled) return;
  addCategoryRow({ name: button.dataset.addCat });
});

catRows.addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove-cat]');
  if (!button || button.disabled) return;
  button.closest('.cat-row').remove();
  syncPricingMode();
});

catRows.addEventListener('input', (event) => {
  if (event.target.dataset.cat !== 'name') return;
  const button = event.target.closest('.cat-row').querySelector('[data-remove-cat]');
  button.setAttribute('aria-label', `Retirer la catégorie ${event.target.value.trim() || 'sans nom'}`);
});

editCancel.addEventListener('click', () => {
  resetEventForm();
  clearFormNotice(eventForm);
});

eventForm.elements.ends_at.addEventListener('change', () => {
  const start = eventForm.elements.starts_at.value;
  const end = eventForm.elements.ends_at.value;
  eventForm.elements.ends_at.setCustomValidity(start && end && end < start ? 'La fin doit être après le début.' : '');
});

eventForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFormNotice(eventForm);
  eventForm.elements.ends_at.dispatchEvent(new Event('change'));
  if (!validateForm(eventForm)) return;
  const names = collectCategories().map((category) => category.name.toLocaleLowerCase('fr'));
  if (new Set(names).size !== names.length) {
    formNotice(eventForm, 'Deux catégories portent le même nom. Renomme l\'une d\'elles.');
    return;
  }
  const button = eventForm.querySelector('button[type="submit"]');
  const data = eventPayload();
  const editing = editingEvent;
  setBusy(button, true);
  try {
    if (editing) {
      await API.patch(`/api/events/${encodeURIComponent(editing.id)}`, data);
      resetEventForm();
      formNotice(eventForm, `« ${data.title} » est à jour.`, 'success');
      toast('Modifications enregistrées.', { type: 'success' });
    } else {
      await API.post('/api/events', data);
      resetEventForm();
      const message = organizerUser.role === 'admin'
        ? `« ${data.title} » est publié.`
        : `« ${data.title} » est envoyé à l'équipe. Il apparaîtra dans le catalogue une fois validé.`;
      formNotice(eventForm, message, 'success');
      toast('Événement enregistré.', { type: 'success' });
    }
    loadOrganizer();
  } catch (error) {
    formNotice(eventForm, error.message);
  } finally {
    setBusy(button, false);
  }
});

if (organizerUser) resetEventForm();

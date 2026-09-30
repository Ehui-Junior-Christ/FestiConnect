/* Codes promo de l'organisateur. Dépend de organizer.js (organizerUser). */
const promoForm = document.querySelector('#promo-form');
const promoList = document.querySelector('#promo-list');
const promoEventSelect = document.querySelector('#promo-event');

function promoValidity(promo) {
  if (!promo.active) return ['Désactivé', 'neutral'];
  if (promo.expired) return ['Expiré', 'danger'];
  if (promo.max_uses && promo.used >= promo.max_uses) return ['Épuisé', 'warning'];
  return ['Actif', 'success'];
}

function promoRow(promo) {
  const [state, tone] = promoValidity(promo);
  const percent = promo.max_uses ? Math.min(100, Math.round((promo.used / promo.max_uses) * 100)) : 0;
  return `
    <tr>
      <td class="cell-main" data-label="Code"><div class="cell-title promo-code">${escapeHtml(promo.code)}</div></td>
      <td data-label="Événement">${escapeHtml(promo.event_title)}</td>
      <td data-label="Remise" class="nowrap"><strong>${escapeHtml(promo.label)}</strong></td>
      <td data-label="Utilisations">
        <div class="usage">
          <span>${escapeHtml(formatNumber(promo.used))}${promo.max_uses ? ` / ${escapeHtml(formatNumber(promo.max_uses))}` : ' (sans limite)'}</span>
          ${promo.max_uses ? `<div class="meter" role="img" aria-label="${escapeHtml(`${promo.used} utilisations sur ${promo.max_uses}`)}"><span data-meter="${percent}"></span></div>` : ''}
        </div>
      </td>
      <td data-label="Validité"><span class="badge badge-${tone} badge-dot">${escapeHtml(state)}</span>${promo.expires_at ? `<div class="small muted mt-2">jusqu'au ${escapeHtml(formatDateShort(promo.expires_at))}</div>` : ''}</td>
      <td class="actions-cell">
        <div class="actions">
          <button class="btn btn-sm${promo.active ? ' btn-danger' : ''}" type="button" data-toggle-promo="${escapeHtml(promo.id)}" data-active="${promo.active}" data-code="${escapeHtml(promo.code)}">${promo.active ? 'Désactiver' : 'Réactiver'}</button>
        </div>
      </td>
    </tr>`;
}

async function loadPromos() {
  promoList.innerHTML = skeletonRows(2, 6);
  setLoading(promoList, true);
  try {
    const [{ promos }, { events }] = await Promise.all([
      API.get('/api/organizer/promos'),
      API.get('/api/organizer/events')
    ]);
    const upcoming = events.filter((event) => event.status !== 'rejected' && eventPhase(event) === 'upcoming');
    const current = promoEventSelect.value;
    promoEventSelect.innerHTML = upcoming.length
      ? `<option value="">Choisis un événement</option>${upcoming.map((event) => `<option value="${escapeHtml(event.id)}">${escapeHtml(event.title)} · ${escapeHtml(formatDateShort(event.starts_at))}</option>`).join('')}`
      : '<option value="">Aucun événement à venir</option>';
    if (upcoming.some((event) => event.id === current)) promoEventSelect.value = current;
    promoList.innerHTML = promos.length
      ? promos.map(promoRow).join('')
      : '<tr><td colspan="6" class="cell-main"><div class="empty"><p>Aucun code pour le moment. Un code partagé sur WhatsApp ou Instagram aide souvent à lancer les ventes.</p></div></td></tr>';
    promoList.querySelectorAll('[data-meter]').forEach((bar) => { bar.style.width = `${bar.dataset.meter}%`; });
  } catch (error) {
    if (error.status === 401) {
      location.replace(loginUrl());
      return;
    }
    promoList.innerHTML = `<tr><td colspan="6">${alertBox('error', error.message)}</td></tr>`;
  } finally {
    setLoading(promoList, false);
  }
}

function syncPromoKind() {
  const percent = promoForm.elements.kind.value === 'percent';
  const value = promoForm.elements.value;
  promoForm.querySelector('[data-value-label]').textContent = percent ? 'Remise (%)' : 'Remise (FCFA)';
  value.min = percent ? '1' : '100';
  value.max = percent ? '100' : '';
  value.placeholder = percent ? '10' : '2000';
  value.dataset.msgMin = percent ? 'Au moins 1 %.' : 'Au moins 100 FCFA.';
  value.dataset.msgMax = 'Au plus 100 %.';
}

enhanceForm(promoForm);
syncPromoKind();
promoForm.addEventListener('change', (event) => {
  if (event.target.name === 'kind') {
    syncPromoKind();
    if (promoForm.elements.value.value) validateField(promoForm.elements.value);
  }
});

promoForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFormNotice(promoForm);
  if (!validateForm(promoForm)) return;
  const data = Object.fromEntries(new FormData(promoForm));
  data.code = data.code.trim().toUpperCase();
  const button = promoForm.querySelector('button[type="submit"]');
  setBusy(button, true);
  try {
    await API.post('/api/organizer/promos', data);
    promoForm.reset();
    syncPromoKind();
    promoForm.querySelectorAll('[data-touched]').forEach((field) => delete field.dataset.touched);
    formNotice(promoForm, `Le code ${data.code} est actif. Partage-le à ton public.`, 'success');
    loadPromos();
  } catch (error) {
    formNotice(promoForm, error.message);
  } finally {
    setBusy(button, false);
  }
});

promoList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-toggle-promo]');
  if (!button) return;
  const activate = button.dataset.active !== 'true';
  setBusy(button, true);
  try {
    await API.patch(`/api/organizer/promos/${encodeURIComponent(button.dataset.togglePromo)}`, { active: activate });
    toast(activate ? `${button.dataset.code} est de nouveau utilisable.` : `${button.dataset.code} ne peut plus être utilisé.`, { type: 'success' });
    loadPromos();
  } catch (error) {
    setBusy(button, false);
    toast(error.message, { type: 'error' });
  }
});

if (organizerUser) loadPromos();

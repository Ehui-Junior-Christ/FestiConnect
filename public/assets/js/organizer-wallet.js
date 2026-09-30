/* Solde et retraits Mobile Money. Dépend de organizer.js (organizerUser, metric). */
const walletStats = document.querySelector('#wallet-stats');
const withdrawForm = document.querySelector('#withdraw-form');
const withdrawList = document.querySelector('#withdraw-list');
let walletBalance = null;

const WITHDRAWAL_STATUS = {
  pending: ['En cours de vérification', 'warning'],
  approved: ['Envoyé', 'success'],
  rejected: ['Refusé', 'danger']
};

function withdrawalRow(item) {
  const [label, tone] = WITHDRAWAL_STATUS[item.status] || [item.status, 'neutral'];
  return `
    <tr>
      <td class="cell-main" data-label="Date"><div class="cell-title">${escapeHtml(formatDateShort(item.created_at))}</div>${item.processed_at ? `<div class="cell-sub small">Traité le ${escapeHtml(formatDateShort(item.processed_at))}</div>` : ''}</td>
      <td class="num" data-label="Montant">${escapeHtml(formatMoney(item.amount_xof))}</td>
      <td data-label="Moyen">${escapeHtml(item.method)}</td>
      <td data-label="Numéro"><span class="nowrap">${escapeHtml(item.phone)}</span></td>
      <td data-label="Statut"><span class="badge badge-${tone} badge-dot">${escapeHtml(label)}</span>${item.admin_note ? `<div class="small muted mt-2">${escapeHtml(item.admin_note)}</div>` : ''}</td>
    </tr>`;
}

async function loadWallet() {
  walletStats.innerHTML = skeletonStats(4);
  withdrawList.innerHTML = skeletonRows(2, 5);
  setLoading(walletStats, true);
  try {
    const { balance, withdrawals } = await API.get('/api/organizer/wallet');
    walletBalance = balance;
    walletStats.innerHTML = [
      metric('Disponible', formatMoney(balance.available), 'wallet', 'pour un retrait', true),
      metric('En vérification', formatMoney(balance.pending), 'clock'),
      metric('Déjà versé', formatMoney(balance.paid_out), 'check-circle'),
      metric('Commission', formatMoney(balance.commission), 'chart', `${String(balance.commission_percent).replace('.', ',')} % des ventes`)
    ].join('');
    withdrawForm.elements.amount_xof.max = String(balance.available);
    withdrawForm.elements.amount_xof.dataset.msgMax = `Ton solde disponible est de ${formatMoney(balance.available)}.`;
    withdrawForm.querySelector('#withdraw-amount-hint').textContent = balance.available >= 1000
      ? `Jusqu'à ${formatMoney(balance.available)}, 1 000 FCFA minimum.`
      : 'Il faut au moins 1 000 FCFA disponibles pour demander un retrait.';
    withdrawList.innerHTML = withdrawals.length
      ? withdrawals.map(withdrawalRow).join('')
      : '<tr><td colspan="5" class="cell-main"><div class="empty"><p>Aucun retrait pour le moment.</p></div></td></tr>';
  } catch (error) {
    if (error.status === 401) {
      location.replace(loginUrl());
      return;
    }
    renderError(walletStats, error, loadWallet);
    withdrawList.innerHTML = '';
  } finally {
    setLoading(walletStats, false);
  }
}

document.querySelector('#withdraw-all').addEventListener('click', () => {
  if (!walletBalance) return;
  withdrawForm.elements.amount_xof.value = String(walletBalance.available);
  validateField(withdrawForm.elements.amount_xof);
});

// Les retraits concernent les comptes organisateurs (pas l'administration).
if (organizerUser?.role === 'admin') document.querySelector('.withdraw-box').hidden = true;
enhanceForm(withdrawForm);
if (organizerUser?.phone) withdrawForm.elements.phone.value = organizerUser.phone;

withdrawForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFormNotice(withdrawForm);
  if (!validateForm(withdrawForm)) return;
  const data = Object.fromEntries(new FormData(withdrawForm));
  const confirmed = await confirmDialog({
    title: `Retirer ${formatMoney(data.amount_xof)} ?`,
    message: `L'argent sera envoyé par ${data.method} au ${data.phone}. Vérifie bien le numéro : un transfert vers un mauvais numéro ne peut pas être annulé.`,
    confirmLabel: 'Confirmer la demande'
  });
  if (!confirmed) return;
  const button = withdrawForm.querySelector('button[type="submit"]');
  setBusy(button, true);
  try {
    await API.post('/api/organizer/withdrawals', data);
    withdrawForm.elements.amount_xof.value = '';
    formNotice(withdrawForm, `Demande de ${formatMoney(data.amount_xof)} envoyée. Tu seras notifié dès que le transfert est effectué.`, 'success');
    loadWallet();
  } catch (error) {
    formNotice(withdrawForm, error.message);
  } finally {
    setBusy(button, false);
  }
});

if (organizerUser) loadWallet();

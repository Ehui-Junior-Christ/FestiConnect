/* Scanner de billets.
   Lecture du QR : BarcodeDetector (natif) si disponible, sinon jsQR (vendor,
   chargé à la demande), sinon saisie manuelle. Le serveur fait foi : chaque
   code lu est envoyé à POST /api/organizer/checkin, qui refuse les billets
   déjà utilisés, annulés ou d'un autre organisateur. */
const scanUser = requireRole(['organisateur', 'admin']);
const video = document.querySelector('#scan-video');
const scanView = document.querySelector('#scan-view');
const scanIdle = document.querySelector('#scan-idle');
const scanIdleText = document.querySelector('#scan-idle-text');
const startButton = document.querySelector('#scan-start');
const stopButton = document.querySelector('#scan-stop');
const engineLabel = document.querySelector('#scan-engine');
const resultBox = document.querySelector('#scan-result');
const manualForm = document.querySelector('#manual-form');
const summaryList = document.querySelector('#scan-summary');
const historyList = document.querySelector('#scan-history');

const SCAN_INTERVAL_MS = 200;
const SAME_CODE_PAUSE_MS = 4000;
let stream = null;
let detectCode = null;
let scanTimer = null;
let busy = false;
let lastCode = '';
let lastCodeAt = 0;
const history = [];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Script indisponible'));
    document.head.appendChild(script);
  });
}

// Choisit le moteur de lecture le plus efficace disponible.
async function createDetector() {
  if ('BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes('qr_code')) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        engineLabel.textContent = 'Lecture native du navigateur.';
        return async () => (await detector.detect(video))[0]?.rawValue || '';
      }
    } catch {
      /* on passe au décodeur embarqué */
    }
  }
  await loadScript('/assets/js/vendor/jsQR.js');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  engineLabel.textContent = 'Lecture par le décodeur FestiConnect.';
  return async () => {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return '';
    // Image réduite : plus rapide sur les téléphones d'entrée de gamme.
    const scale = Math.min(1, 640 / Math.max(width, height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return window.jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })?.data || '';
  };
}

function cameraErrorMessage(error) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    return 'La caméra n\'est pas accessible ici (connexion HTTPS requise). Saisis les codes à la main ci-dessous.';
  }
  if (error?.name === 'NotAllowedError') return 'Accès à la caméra refusé. Autorise-le dans les réglages du navigateur, ou saisis le code à la main.';
  if (error?.name === 'NotFoundError') return 'Aucune caméra détectée sur cet appareil. Saisis le code à la main.';
  return 'Impossible d\'allumer la caméra. Ferme les autres applications qui l\'utilisent, ou saisis le code à la main.';
}

async function startCamera() {
  setBusy(startButton, true);
  try {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('insecure');
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    video.srcObject = stream;
    await video.play();
    detectCode = await createDetector();
    scanView.classList.add('is-live');
    scanIdle.hidden = true;
    stopButton.hidden = false;
    scanTimer = setInterval(scanFrame, SCAN_INTERVAL_MS);
  } catch (error) {
    stopCamera();
    scanIdleText.textContent = cameraErrorMessage(error);
    document.querySelector('#manual-code').focus();
  } finally {
    setBusy(startButton, false);
  }
}

function stopCamera() {
  clearInterval(scanTimer);
  scanTimer = null;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
  scanView.classList.remove('is-live');
  scanIdle.hidden = false;
  stopButton.hidden = true;
  scanIdleText.textContent = 'La caméra est éteinte.';
}

async function scanFrame() {
  if (busy || !detectCode || video.readyState < 2) return;
  try {
    const text = (await detectCode()).trim();
    if (!text) return;
    const now = Date.now();
    if (text === lastCode && now - lastCodeAt < SAME_CODE_PAUSE_MS) return;
    lastCode = text;
    lastCodeAt = now;
    await submitCode(text);
  } catch {
    /* image illisible : on attend la suivante */
  }
}

const OUTCOMES = {
  ok: { tone: 'ok', icon: 'check-circle', title: 'Entrée validée' },
  ALREADY_CHECKED_IN: { tone: 'warn', icon: 'alert', title: 'Déjà utilisé' },
  TICKET_CANCELLED: { tone: 'bad', icon: 'x-circle', title: 'Billet annulé' },
  TICKET_NOT_FOUND: { tone: 'bad', icon: 'x-circle', title: 'Billet inconnu' },
  VALIDATION_ERROR: { tone: 'bad', icon: 'x-circle', title: 'Code non reconnu' },
  other: { tone: 'bad', icon: 'alert', title: 'Vérification impossible' }
};

function showResult(outcome, lines) {
  resultBox.hidden = false;
  resultBox.className = `scan-result scan-${outcome.tone}`;
  resultBox.innerHTML = `
    ${icon(outcome.icon)}
    <div>
      <strong class="scan-result-title">${escapeHtml(outcome.title)}</strong>
      ${lines.map((line) => `<span>${escapeHtml(line)}</span>`).join('')}
    </div>`;
  resultBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function addHistory(outcome, code, detail) {
  history.unshift({ outcome, code, detail, at: new Date() });
  history.length = Math.min(history.length, 12);
  historyList.innerHTML = history.map((item) => `
    <li class="scan-history-item scan-${item.outcome.tone}">
      ${icon(item.outcome.icon)}
      <span><strong>${escapeHtml(item.outcome.title)}</strong> · <span class="mono">${escapeHtml(item.code)}</span><br><span class="small muted">${escapeHtml(item.detail)} · ${escapeHtml(formatTime(item.at))}</span></span>
    </li>`).join('');
}

async function submitCode(rawCode) {
  const code = String(rawCode).trim().toUpperCase().slice(0, 60);
  busy = true;
  try {
    const { ticket } = await API.post('/api/organizer/checkin', { code });
    const people = plural(ticket.quantity, 'personne', 'personnes');
    showResult(OUTCOMES.ok, [
      `${ticket.client_name} · ${people}${ticket.category_name ? ` · ${ticket.category_name}` : ''}`,
      ticket.event_title
    ]);
    addHistory(OUTCOMES.ok, ticket.code, `${ticket.client_name}, ${people}`);
    navigator.vibrate?.(120);
    loadSummary();
  } catch (error) {
    if (error.status === 401) {
      location.replace(loginUrl());
      return;
    }
    const outcome = OUTCOMES[error.code] || OUTCOMES.other;
    showResult(outcome, [error.message]);
    addHistory(outcome, code, error.message);
    navigator.vibrate?.([80, 60, 80]);
  } finally {
    // Petite pause pour laisser le contrôleur lire l'écran.
    setTimeout(() => { busy = false; }, 1200);
  }
}

async function loadSummary() {
  setLoading(summaryList, true);
  try {
    const { events } = await API.get('/api/organizer/checkin/summary');
    summaryList.innerHTML = events.length
      ? events.map((event) => {
          const percent = event.sold ? Math.round((event.checked_in / event.sold) * 100) : 0;
          return `
            <li>
              <div class="row"><span>${escapeHtml(event.title)} <span class="muted">· ${escapeHtml(formatDateShort(event.starts_at))}</span></span><strong>${escapeHtml(formatNumber(event.checked_in))} / ${escapeHtml(formatNumber(event.sold))}</strong></div>
              <div class="meter" role="img" aria-label="${escapeHtml(`${event.checked_in} entrées sur ${event.sold} billets`)}"><span data-meter="${Math.max(event.checked_in ? 2 : 0, percent)}"></span></div>
            </li>`;
        }).join('')
      : '<li class="muted">Aucun événement validé en cours ou à venir.</li>';
    summaryList.querySelectorAll('[data-meter]').forEach((bar) => { bar.style.width = `${bar.dataset.meter}%`; });
  } catch (error) {
    summaryList.innerHTML = `<li>${alertBox('error', error.message)}</li>`;
  } finally {
    setLoading(summaryList, false);
  }
}

startButton.addEventListener('click', startCamera);
stopButton.addEventListener('click', stopCamera);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && stream) stopCamera();
});

enhanceForm(manualForm);
manualForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!validateForm(manualForm)) return;
  const input = manualForm.elements.code;
  await submitCode(input.value);
  input.value = '';
  input.focus();
});

if (scanUser) {
  loadSummary();
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    scanIdleText.textContent = cameraErrorMessage();
    startButton.hidden = true;
  }
}

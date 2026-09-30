/* Tableau de bord des ventes : courbe SVG dessinée à la main (une seule série,
   un seul axe), info-bulle au survol et au clavier, table des chiffres, et
   remplissage par catégorie. Dépend de organizer.js (organizerUser). */
const salesChart = document.querySelector('#sales-chart');
const salesPlot = document.querySelector('#sales-plot');
const salesTooltip = document.querySelector('#sales-tooltip');
const salesTotal = document.querySelector('#sales-total');
const salesTable = document.querySelector('#sales-table');
const salesSummary = document.querySelector('#sales-summary');
const fillList = document.querySelector('#fill-list');
const statsEvent = document.querySelector('#stats-event');
const statsPeriod = document.querySelector('#stats-period');
const SVG_NS = 'http://www.w3.org/2000/svg';
let statsDays = 30;
let statsData = null;
let activeIndex = -1;

const DAY_LABEL = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const DAY_LONG = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function dayLabel(day, long = false) {
  return (long ? DAY_LONG : DAY_LABEL).format(new Date(`${day}T00:00:00Z`)).replace('.', '');
}

// Maximum « rond » pour l'axe : 1, 2 ou 5 × 10^n.
function niceMax(value) {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((factor) => factor * power >= value / 1) * power;
  return step;
}

function svgEl(name, attrs = {}, text = '') {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text) node.textContent = text;
  return node;
}

function drawChart() {
  if (!statsData) return;
  const sales = statsData.sales;
  const width = Math.max(280, Math.round(salesPlot.clientWidth));
  const height = width < 520 ? 200 : 240;
  const margin = { top: 14, right: 12, bottom: 28, left: 34 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const max = niceMax(Math.max(...sales.map((item) => item.tickets), 0));
  const x = (index) => margin.left + (sales.length > 1 ? (index / (sales.length - 1)) * plotW : plotW / 2);
  const y = (value) => margin.top + plotH - (value / max) * plotH;
  const best = sales.reduce((top, item) => (item.tickets > top.tickets ? item : top), sales[0]);

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', focusable: 'false' });
  svg.setAttribute('aria-label', `Billets vendus par jour sur ${statsData.days} jours : ${statsData.totals.tickets} au total${best?.tickets ? `, au plus ${best.tickets} le ${dayLabel(best.day, true)}` : ''}. Les chiffres détaillés sont dans le tableau qui suit.`);

  // Grille et axe Y (discrets)
  [0, max / 2, max].forEach((tick) => {
    svg.appendChild(svgEl('line', { class: tick === 0 ? 'chart-axis' : 'chart-grid', x1: margin.left, x2: width - margin.right, y1: y(tick), y2: y(tick) }));
    svg.appendChild(svgEl('text', { class: 'chart-label', x: margin.left - 8, y: y(tick) + 4, 'text-anchor': 'end' }, formatNumber(tick)));
  });
  // Axe X : quelques repères seulement
  const every = sales.length <= 7 ? 1 : sales.length <= 30 ? 7 : 15;
  sales.forEach((item, index) => {
    if (index % every !== 0 && index !== sales.length - 1) return;
    if (index !== sales.length - 1 && sales.length - 1 - index < every / 2) return;
    const anchor = index === 0 ? 'start' : index === sales.length - 1 ? 'end' : 'middle';
    svg.appendChild(svgEl('text', { class: 'chart-label', x: x(index), y: height - 8, 'text-anchor': anchor }, dayLabel(item.day)));
  });

  // Aire et courbe
  const points = sales.map((item, index) => `${x(index).toFixed(1)},${y(item.tickets).toFixed(1)}`);
  svg.appendChild(svgEl('path', { class: 'chart-area', d: `M${x(0)},${y(0)} L${points.join(' L')} L${x(sales.length - 1)},${y(0)} Z` }));
  svg.appendChild(svgEl('path', { class: 'chart-line', d: `M${points.join(' L')}` }));

  // Étiquette directe unique : le meilleur jour
  if (best?.tickets) {
    const index = sales.indexOf(best);
    svg.appendChild(svgEl('circle', { class: 'chart-dot', cx: x(index), cy: y(best.tickets), r: 4 }));
    const nearRight = x(index) > width - 90;
    svg.appendChild(svgEl('text', { class: 'chart-value', x: x(index) + (nearRight ? -8 : 8), y: Math.max(margin.top + 10, y(best.tickets) - 8), 'text-anchor': nearRight ? 'end' : 'start' }, `${best.tickets} billets`));
  }

  // Couche de survol : réticule vertical + point, pilotable au clavier
  const cross = svgEl('line', { class: 'chart-cross', x1: 0, x2: 0, y1: margin.top, y2: margin.top + plotH, visibility: 'hidden' });
  const marker = svgEl('circle', { class: 'chart-dot chart-dot-active', r: 5, cx: 0, cy: 0, visibility: 'hidden' });
  svg.append(cross, marker);
  const hit = svgEl('rect', { class: 'chart-hit', x: margin.left, y: 0, width: plotW, height: margin.top + plotH, tabindex: 0 });
  hit.setAttribute('aria-label', 'Parcourir les jours avec les flèches gauche et droite');
  svg.appendChild(hit);

  const show = (index) => {
    activeIndex = Math.max(0, Math.min(sales.length - 1, index));
    const item = sales[activeIndex];
    cross.setAttribute('x1', x(activeIndex));
    cross.setAttribute('x2', x(activeIndex));
    cross.setAttribute('visibility', 'visible');
    marker.setAttribute('cx', x(activeIndex));
    marker.setAttribute('cy', y(item.tickets));
    marker.setAttribute('visibility', 'visible');
    salesTooltip.replaceChildren();
    const value = document.createElement('strong');
    value.textContent = plural(item.tickets, 'billet', 'billets');
    const amount = document.createElement('span');
    amount.textContent = formatMoney(item.revenue);
    const day = document.createElement('span');
    day.className = 'muted';
    day.textContent = dayLabel(item.day, true);
    salesTooltip.append(value, amount, day);
    salesTooltip.hidden = false;
    const left = Math.min(width - salesTooltip.offsetWidth, Math.max(0, x(activeIndex) - salesTooltip.offsetWidth / 2));
    salesTooltip.style.left = `${left}px`;
    salesTooltip.style.top = `${salesPlot.offsetTop + Math.max(0, y(item.tickets) - 84)}px`;
  };
  const hide = () => {
    cross.setAttribute('visibility', 'hidden');
    marker.setAttribute('visibility', 'hidden');
    salesTooltip.hidden = true;
  };
  const indexAt = (clientX) => {
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * width;
    return Math.round(((px - margin.left) / plotW) * (sales.length - 1));
  };
  hit.addEventListener('pointermove', (event) => show(indexAt(event.clientX)));
  hit.addEventListener('pointerdown', (event) => show(indexAt(event.clientX)));
  hit.addEventListener('pointerleave', hide);
  hit.addEventListener('focus', () => show(activeIndex >= 0 ? activeIndex : sales.length - 1));
  hit.addEventListener('blur', hide);
  hit.addEventListener('keydown', (event) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const step = moves[event.key];
    show(Number.isFinite(step) ? activeIndex + step : (step < 0 ? 0 : sales.length - 1));
  });

  salesPlot.replaceChildren(svg);
}

function renderFill(fill) {
  fillList.innerHTML = fill.length
    ? fill.map((event) => `
        <div class="fill-event">
          <p class="fill-title"><strong>${escapeHtml(event.event_title)}</strong> <span class="muted small">· ${escapeHtml(formatDateShort(event.starts_at))}</span></p>
          <ul class="bar-list">
            ${event.categories.map((category) => {
              const percent = category.capacity ? Math.min(100, Math.round((category.sold / category.capacity) * 100)) : 0;
              return `
                <li>
                  <div class="row"><span>${escapeHtml(category.name)} <span class="muted">· ${escapeHtml(formatNumber(category.sold))} / ${escapeHtml(formatNumber(category.capacity))}</span></span><strong>${percent} %${percent >= 100 ? ' · complet' : ''}</strong></div>
                  <div class="meter" role="img" aria-label="${escapeHtml(`${category.name} : ${percent} % des places vendues`)}"><span data-meter="${percent}"></span></div>
                </li>`;
            }).join('')}
          </ul>
        </div>`).join('')
    : '<p class="muted">Aucun événement à venir. Crée ou duplique un événement pour suivre son remplissage ici.</p>';
  fillList.querySelectorAll('[data-meter]').forEach((bar) => { bar.style.width = `${bar.dataset.meter}%`; });
}

async function loadStats() {
  salesChart.setAttribute('aria-busy', 'true');
  salesChart.classList.add('is-loading');
  try {
    const params = new URLSearchParams({ days: String(statsDays) });
    if (statsEvent.value) params.set('event_id', statsEvent.value);
    statsData = await API.get(`/api/organizer/stats?${params}`);
    activeIndex = -1;
    salesTotal.textContent = `${plural(statsData.totals.tickets, 'billet', 'billets')} · ${formatMoney(statsData.totals.revenue)}`;
    salesSummary.textContent = `${statsData.days} derniers jours${statsEvent.value ? ` · ${statsEvent.selectedOptions[0].textContent}` : ', tous tes événements'}.`;
    salesTable.innerHTML = statsData.sales.slice().reverse().map((item) => `
      <tr><td>${escapeHtml(dayLabel(item.day, true))}</td><td class="num">${escapeHtml(formatNumber(item.tickets))}</td><td class="num">${escapeHtml(formatMoney(item.revenue))}</td></tr>`).join('');
    drawChart();
    renderFill(statsData.fill);
  } catch (error) {
    if (error.status === 401) {
      location.replace(loginUrl());
      return;
    }
    renderError(salesPlot, error, loadStats);
  } finally {
    salesChart.setAttribute('aria-busy', 'false');
    salesChart.classList.remove('is-loading');
  }
}

async function loadStatsEvents() {
  try {
    const { events } = await API.get('/api/organizer/events');
    statsEvent.insertAdjacentHTML('beforeend', events
      .filter((event) => event.status !== 'rejected')
      .map((event) => `<option value="${escapeHtml(event.id)}">${escapeHtml(event.title)}</option>`).join(''));
  } catch {
    /* le filtre reste sur « Tous mes événements » */
  }
}

statsPeriod.addEventListener('click', (event) => {
  const button = event.target.closest('[data-days]');
  if (!button) return;
  statsDays = Number(button.dataset.days);
  statsPeriod.querySelectorAll('[data-days]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
  loadStats();
});
statsEvent.addEventListener('change', loadStats);

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(drawChart, 150);
});

if (organizerUser) {
  loadStatsEvents();
  loadStats();
}

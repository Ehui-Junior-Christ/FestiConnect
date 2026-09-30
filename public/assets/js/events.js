const filtersForm = document.querySelector('#filters');
const eventsList = document.querySelector('#events-list');
const resultsBar = document.querySelector('#results-bar');
const FILTER_LABELS = { q: 'Recherche', category: 'Catégorie', city: 'Ville' };

function currentFilters() {
  const params = new URLSearchParams(location.search);
  const filters = {};
  for (const key of Object.keys(FILTER_LABELS)) {
    const value = (params.get(key) || '').trim();
    if (value) filters[key] = value;
  }
  return filters;
}

function optionLabel(name, value) {
  const option = [...(filtersForm?.elements[name]?.options || [])].find((item) => item.value === value);
  return option ? option.textContent : value;
}

function filtersUrl(filters) {
  const query = new URLSearchParams(filters).toString();
  return `/evenements.html${query ? `?${query}` : ''}`;
}

function renderResultsBar(count, filters) {
  const keys = Object.keys(filters);
  const chips = keys.map((key) => {
    const rest = { ...filters };
    delete rest[key];
    const label = key === 'q' ? `« ${filters[key]} »` : optionLabel(key, filters[key]);
    return `<a class="chip chip-remove" href="${escapeHtml(filtersUrl(rest))}" aria-label="Retirer le filtre ${escapeHtml(FILTER_LABELS[key])} : ${escapeHtml(label)}">${escapeHtml(label)}${icon('x')}</a>`;
  }).join('');
  resultsBar.innerHTML = `
    <span class="results-count">${count === 0 ? 'Aucun résultat' : plural(count, 'événement', 'événements')}</span>
    ${chips ? `<div class="chips">${chips}</div>` : ''}
    ${keys.length > 1 ? '<a class="small" href="/evenements.html">Tout effacer</a>' : ''}`;
}

async function loadEvents() {
  const filters = currentFilters();
  if (filtersForm) {
    for (const key of Object.keys(FILTER_LABELS)) filtersForm.elements[key].value = filters[key] || '';
  }
  eventsList.innerHTML = skeletonCards(6, 'event');
  resultsBar.innerHTML = '<span class="muted">Chargement des événements…</span>';
  setLoading(eventsList, true);
  try {
    const { events } = await API.get(`/api/events?${new URLSearchParams(filters)}`);
    renderResultsBar(events.length, filters);
    eventsList.innerHTML = events.length
      ? events.map(eventCard).join('')
      : emptyState({
          title: 'Aucun événement ne correspond',
          message: Object.keys(filters).length
            ? 'Essaie une autre ville, une autre catégorie ou un mot-clé plus court.'
            : 'Aucun événement n\'est publié pour le moment. Reviens bientôt.',
          actions: Object.keys(filters).length ? [{ label: 'Voir tous les événements', href: '/evenements.html', variant: 'primary' }] : []
        });
  } catch (error) {
    resultsBar.innerHTML = '';
    renderError(eventsList, error, loadEvents);
  } finally {
    setLoading(eventsList, false);
  }
}

// Soumission : on retire les champs vides pour garder des URL propres et partageables.
filtersForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const filters = {};
  for (const [key, value] of new FormData(filtersForm)) {
    if (String(value).trim()) filters[key] = String(value).trim();
  }
  history.pushState(null, '', filtersUrl(filters));
  loadEvents();
});

// Sur mobile comme sur ordinateur, changer une liste applique le filtre tout de suite.
filtersForm?.addEventListener('change', (event) => {
  if (event.target.matches('select')) filtersForm.requestSubmit();
});

window.addEventListener('popstate', loadEvents);

loadEvents();

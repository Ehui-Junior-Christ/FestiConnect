mountLayout('events');

async function loadEvents() {
  const params = new URLSearchParams(location.search);
  const { events } = await API.get(`/api/events?${params}`);
  document.querySelector('#events-list').innerHTML = events.length
    ? events.map(eventCard).join('')
    : '<div class="panel glass"><h3>Aucun evenement trouve</h3><p class="muted mt-3">Essaie une autre ville ou une autre categorie.</p></div>';
  if (window.lucide) window.lucide.createIcons();
}

document.querySelector('#filters')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = new URLSearchParams(new FormData(event.currentTarget)).toString();
  location.href = `/evenements.html?${query}`;
});

loadEvents().catch((error) => toast(error.message));


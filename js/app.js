/* Bootstrap aplikacji: nawigacja dolna, przełączanie widoków, inicjalizacja paneli. */
(function () {
  'use strict';

  const VIEW_TITLES = {
    dashboard: 'Dziennik Treningowy',
    timer: 'Timer i trening',
    planner: 'Zarządzanie treningami',
    history: 'Historia',
    profile: 'Profil',
  };

  const RENDERERS = {
    dashboard: () => window.Dashboard.render(),
    timer: () => window.Timer.render(),
    planner: () => window.Planner.render(),
    history: () => window.History.render(),
    profile: () => window.Profile.render(),
  };

  function switchView(view) {
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.getAttribute('data-view') === view));
    document.getElementById('header-title').textContent = VIEW_TITLES[view];
    const renderFn = RENDERERS[view];
    if (renderFn) renderFn();
  }

  function init() {
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.getAttribute('data-view')));
    });

    window.Planner.init();
    window.Timer.init();
    window.History.init();
    window.Profile.init();

    window.Profile.render(); // wczytaj/zastosuj ustawienia (np. motyw) od razu
    switchView('dashboard');

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {
        /* offline-first: brak service workera nie blokuje działania appki */
      });
    }
  }

  window.App = { switchView };

  document.addEventListener('DOMContentLoaded', init);
})();

/* Panel 1 — Powitalny: statystyki, dzisiejszy trening, ostatnie sesje. */
(function () {
  'use strict';

  async function render() {
    const [history, scheduled, templates, settingsRaw] = await Promise.all([
      DB.getAll('history_entries'),
      DB.getAll('scheduled_sessions'),
      DB.getAll('templates'),
      DB.get('settings', 1),
    ]);
    const settings = settingsRaw || { jednostki: 'kg', cel_tygodniowy: 3 };
    const today = new Date();
    const todayIso = WorkoutUtils.dateToISO(today);

    const streak = WorkoutUtils.calcStreak(history, today);
    document.getElementById('dash-streak').textContent = streak;
    document.getElementById('dash-streak-label').textContent = streak === 1 ? 'dzień passy' : 'dni passy';

    document.getElementById('dash-total-sessions').textContent = WorkoutUtils.calcTotalSessions(history);

    const weekStart = WorkoutUtils.dateToISO(WorkoutUtils.startOfWeek(today));
    const weekVolume = Math.round(WorkoutUtils.calcVolumeInRange(history, weekStart, todayIso));
    document.getElementById('dash-week-volume').textContent = weekVolume.toLocaleString('pl-PL');

    const sessionsThisWeek = history.filter((e) => e.data >= weekStart && e.data <= todayIso).length;
    document.getElementById('dash-week-goal').textContent = `${sessionsThisWeek}/${settings.cel_tygodniowy ?? 3}`;

    // Dzisiejszy trening
    const todayCard = document.getElementById('dash-today-card');
    const todaysScheduled = scheduled.find((s) => s.data === todayIso && s.status === 'zaplanowana');
    const alreadyDoneToday = history.some((e) => e.data === todayIso);
    if (alreadyDoneToday) {
      todayCard.innerHTML = `<div class="list-item" style="border:none;padding:0"><div><div class="title">Trening dzisiaj zaliczony ✅</div><div class="sub">Wróć jutro po kolejną passę</div></div></div>`;
    } else if (todaysScheduled) {
      const tpl = templates.find((t) => t.id === todaysScheduled.template_id);
      todayCard.innerHTML = `
        <div class="list-item" style="border:none;padding:0 0 12px">
          <div><div class="title">${UI.escapeHtml(tpl?.nazwa || 'Trening')}</div><div class="sub">${(tpl?.cwiczenia || []).length} ćwiczeń</div></div>
        </div>
        <button class="btn btn-primary btn-block" id="dash-start-today">Rozpocznij</button>`;
      document.getElementById('dash-start-today').addEventListener('click', () => {
        window.App.switchView('timer');
      });
    } else {
      todayCard.innerHTML = `<div class="empty-state"><div class="h-title">Brak zaplanowanego treningu</div><p>Zaplanuj sesję w panelu Plan albo zacznij trening bez planu.</p></div>`;
    }

    // Ostatnie treningi
    const recentList = document.getElementById('dash-recent-list');
    const recent = [...history].sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, 5);
    if (recent.length === 0) {
      recentList.innerHTML = `<div class="empty-state"><div class="h-title">Jeszcze pusto</div><p>Twoje treningi pojawią się tutaj.</p></div>`;
    } else {
      recentList.innerHTML = recent
        .map(
          (e) => `
        <div class="list-item">
          <div><div class="title">${UI.escapeHtml(e.nazwa_treningu || 'Trening')}</div><div class="sub">${e.data} · ${WorkoutUtils.formatDuration(e.czas_trwania || 0)}</div></div>
          <span class="badge badge-good">${(e.cwiczenia || []).length} ćw.</span>
        </div>`
        )
        .join('');
    }
  }

  window.Dashboard = { render };
})();

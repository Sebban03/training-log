/* Panel 4 — Historia: kalendarz, rekordy życiowe, log treningów z edycją/usuwaniem. */
(function () {
  'use strict';

  const state = { calDate: new Date() };

  function init() {
    document.getElementById('hist-cal-prev').addEventListener('click', () => {
      state.calDate.setMonth(state.calDate.getMonth() - 1);
      render();
    });
    document.getElementById('hist-cal-next').addEventListener('click', () => {
      state.calDate.setMonth(state.calDate.getMonth() + 1);
      render();
    });
  }

  async function render() {
    const [history, scheduled, exercises] = await Promise.all([DB.getAll('history_entries'), DB.getAll('scheduled_sessions'), DB.getAll('exercises')]);

    UI.renderCalendar(document.getElementById('hist-cal-grid'), document.getElementById('hist-cal-label'), state.calDate, scheduled, history, (iso, dayInfo) => {
      const entry = history.find((e) => e.data === iso);
      if (entry) openEntryDetail(entry, exercises);
    });

    renderPRs(history, exercises);
    renderLog(history, exercises);
  }

  function exName(exercises, id) {
    return exercises.find((e) => e.id === id)?.nazwa || 'Ćwiczenie';
  }

  function renderPRs(history, exercises) {
    const prs = WorkoutUtils.calcPRs(history);
    const el = document.getElementById('pr-list');
    const entries = Object.entries(prs);
    if (entries.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="h-title">Brak jeszcze rekordów</div><p>Pojawią się po pierwszych zapisanych treningach.</p></div>`;
      return;
    }
    el.innerHTML = entries
      .map(([exId, pr]) => {
        const value = pr.kg ? `${pr.kg} kg` : pr.czas ? `${pr.czas}s` : `${pr.powt} powt.`;
        return `<div class="list-item"><div class="title">${UI.escapeHtml(exName(exercises, Number(exId)))}</div><span class="num" style="font-weight:700">${value}</span></div>`;
      })
      .join('');
  }

  function renderLog(history, exercises) {
    const el = document.getElementById('history-log-list');
    const sorted = [...history].sort((a, b) => (a.data < b.data ? 1 : -1));
    if (sorted.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="h-title">Pusto</div><p>Tu pojawi się historia Twoich treningów.</p></div>`;
      return;
    }
    el.innerHTML = sorted
      .map(
        (e) => `
      <div class="list-item">
        <div><div class="title">${UI.escapeHtml(e.nazwa_treningu || 'Trening')}</div><div class="sub">${e.data} · ${WorkoutUtils.formatDuration(e.czas_trwania || 0)}</div></div>
        <div class="item-actions">
          <button class="icon-btn" data-edit-hist="${e.id}"><svg><use href="#i-edit"/></svg></button>
          <button class="icon-btn danger" data-del-hist="${e.id}"><svg><use href="#i-trash"/></svg></button>
        </div>
      </div>`
      )
      .join('');
    el.querySelectorAll('[data-edit-hist]').forEach((btn) =>
      btn.addEventListener('click', async () => openEntryDetail(await DB.get('history_entries', Number(btn.getAttribute('data-edit-hist'))), exercises))
    );
    el.querySelectorAll('[data-del-hist]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        if (!UI.confirmAction('Usunąć ten wpis z historii?')) return;
        await DB.remove('history_entries', Number(btn.getAttribute('data-del-hist')));
        UI.showToast('Usunięto wpis');
        render();
        if (window.Dashboard) window.Dashboard.render();
      })
    );
  }

  function openEntryDetail(entry, exercises) {
    const rows = entry.cwiczenia
      .map(
        (ex, exIdx) => `
      <div class="section-title">${UI.escapeHtml(exName(exercises, ex.exercise_id))}</div>
      ${ex.serie
        .map(
          (s, sIdx) => `
        <div class="set-row" data-ex="${exIdx}" data-set="${sIdx}">
          <span class="set-idx">${sIdx + 1}</span>
          <input type="number" class="h-cel" value="${(s.czas ?? s.powt) ?? ''}" placeholder="powt./s" />
          <input type="number" class="h-kg" value="${s.kg ?? ''}" placeholder="kg" step="0.5" />
          <span></span>
        </div>`
        )
        .join('')}`
      )
      .join('');

    const html = `
      <div class="field"><label>Nazwa treningu</label><input type="text" id="f-hist-nazwa" value="${UI.escapeHtml(entry.nazwa_treningu || '')}" /></div>
      <div class="field"><label>Data</label><input type="date" id="f-hist-data" value="${entry.data}" /></div>
      <div class="field"><label>Notatka</label><textarea id="f-hist-notatka">${UI.escapeHtml(entry.notatka_ogolna || '')}</textarea></div>
      ${rows}
      <button class="btn btn-primary btn-block" id="f-hist-save" style="margin-top:16px">Zapisz zmiany</button>`;

    UI.openSheet('Szczegóły treningu', html, (body) => {
      body.querySelector('#f-hist-save').addEventListener('click', async () => {
        const updated = { ...entry };
        updated.nazwa_treningu = body.querySelector('#f-hist-nazwa').value.trim();
        updated.data = body.querySelector('#f-hist-data').value;
        updated.notatka_ogolna = body.querySelector('#f-hist-notatka').value.trim();
        updated.cwiczenia = entry.cwiczenia.map((ex, exIdx) => ({
          ...ex,
          serie: ex.serie.map((s, sIdx) => {
            const row = body.querySelector(`.set-row[data-ex="${exIdx}"][data-set="${sIdx}"]`);
            const celVal = row.querySelector('.h-cel').value;
            const kgVal = row.querySelector('.h-kg').value;
            return {
              ...s,
              powt: s.czas === null ? (celVal ? Number(celVal) : null) : s.powt,
              czas: s.czas !== null ? (celVal ? Number(celVal) : null) : s.czas,
              kg: kgVal ? Number(kgVal) : null,
            };
          }),
        }));
        await DB.put('history_entries', updated);
        UI.closeSheet();
        UI.showToast('Zapisano zmiany');
        render();
        if (window.Dashboard) window.Dashboard.render();
      });
    });
  }

  window.History = { init, render };
})();

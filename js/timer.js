/* Panel 2 — Timer i start treningu: wybór gotowego treningu, trening bez planu, timer przerwy, aktywna sesja. */
(function () {
  'use strict';

  const state = {
    tab: 'plan',
    restTotal: 90,
    restRemaining: 90,
    restRunning: false,
    restInterval: null,
    session: null, // {name, template_id, scheduled_session_id, startedAt, exercises:[{exercise_id,nazwa,typ_pomiaru,serie:[{powt,czas,kg,sprzet_id}]}]}
    sessionInterval: null,
  };

  function init() {
    document.querySelectorAll('#view-timer .subtab').forEach((btn) =>
      btn.addEventListener('click', () => {
        state.tab = btn.getAttribute('data-timer-tab');
        document.querySelectorAll('#view-timer .subtab').forEach((b) => b.classList.toggle('active', b === btn));
        document.getElementById('timer-tab-plan').style.display = state.tab === 'plan' ? '' : 'none';
        document.getElementById('timer-tab-custom').style.display = state.tab === 'custom' ? '' : 'none';
        document.getElementById('timer-tab-rest').style.display = state.tab === 'rest' ? '' : 'none';
      })
    );

    document.querySelectorAll('[data-rest-preset]').forEach((btn) =>
      btn.addEventListener('click', () => {
        state.restTotal = Number(btn.getAttribute('data-rest-preset'));
        state.restRemaining = state.restTotal;
        state.restRunning = false;
        clearInterval(state.restInterval);
        updateRestDisplay();
      })
    );
    document.getElementById('btn-rest-toggle').addEventListener('click', toggleRest);
    document.getElementById('btn-rest-reset').addEventListener('click', () => {
      state.restRunning = false;
      clearInterval(state.restInterval);
      state.restRemaining = state.restTotal;
      updateRestDisplay();
    });

    document.getElementById('btn-start-custom').addEventListener('click', () => {
      const name = document.getElementById('custom-workout-name').value.trim() || 'Trening bez planu';
      startSession({ name, template_id: null, scheduled_session_id: null, exercises: [] });
      document.getElementById('custom-workout-name').value = '';
    });

    document.getElementById('btn-add-exercise-active').addEventListener('click', openAddExerciseToSession);
    document.getElementById('btn-finish-session').addEventListener('click', finishSession);
    document.getElementById('btn-cancel-session').addEventListener('click', () => {
      if (!UI.confirmAction('Anulować trening? Wpisane dane nie zostaną zapisane.')) return;
      stopSession(false);
    });

    updateRestDisplay();
  }

  /* ---------------- TIMER PRZERWY ---------------- */

  function toggleRest() {
    state.restRunning = !state.restRunning;
    document.getElementById('btn-rest-toggle').textContent = state.restRunning ? 'Pauza' : 'Start';
    if (state.restRunning) {
      state.restInterval = setInterval(() => {
        state.restRemaining -= 1;
        if (state.restRemaining <= 0) {
          state.restRemaining = 0;
          state.restRunning = false;
          clearInterval(state.restInterval);
          document.getElementById('btn-rest-toggle').textContent = 'Start';
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          UI.showToast('Koniec przerwy');
        }
        updateRestDisplay();
      }, 1000);
    } else {
      clearInterval(state.restInterval);
    }
  }

  function updateRestDisplay() {
    document.getElementById('rest-display').textContent = WorkoutUtils.formatDuration(state.restRemaining);
  }

  /* ---------------- LISTA GOTOWYCH TRENINGÓW ---------------- */

  async function render() {
    const showPicker = !state.session;
    document.getElementById('timer-picker').style.display = showPicker ? '' : 'none';
    document.getElementById('active-session').style.display = showPicker ? 'none' : '';
    if (showPicker) await renderPlanList();
    else renderActiveExerciseList();
  }

  async function renderPlanList() {
    const [templates, scheduled] = await Promise.all([DB.getAll('templates'), DB.getAll('scheduled_sessions')]);
    const todayIso = WorkoutUtils.dateToISO(new Date());
    const todaysScheduled = scheduled.find((s) => s.data === todayIso && s.status === 'zaplanowana');
    const list = document.getElementById('timer-plan-list');

    if (templates.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="h-title">Brak gotowych treningów</div><p>Dodaj trening w panelu Plan.</p></div>`;
      return;
    }

    list.innerHTML = templates
      .map((t) => {
        const isToday = todaysScheduled && todaysScheduled.template_id === t.id;
        return `
        <div class="list-item">
          <div>
            <div class="title">${UI.escapeHtml(t.nazwa)} ${isToday ? '<span class="badge badge-good">Dziś</span>' : ''}</div>
            <div class="sub">${(t.cwiczenia || []).length} ćwiczeń</div>
          </div>
          <button class="btn btn-primary" data-start-tpl="${t.id}">Start</button>
        </div>`;
      })
      .join('');

    list.querySelectorAll('[data-start-tpl]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const tpl = templates.find((t) => t.id === Number(btn.getAttribute('data-start-tpl')));
        const linkedSchedule = todaysScheduled && todaysScheduled.template_id === tpl.id ? todaysScheduled.id : null;
        await startFromTemplate(tpl, linkedSchedule);
      })
    );
  }

  async function startFromTemplate(tpl, scheduledSessionId) {
    const exercisesLib = await DB.getAll('exercises');
    const exercises = (tpl.cwiczenia || []).map((c) => {
      const ex = exercisesLib.find((e) => e.id === c.exercise_id) || { nazwa: '?', typ_pomiaru: 'powtorzenia', wymaga_sprzetu: false };
      const serie = Array.from({ length: c.docelowe_serie || 1 }, () => ({
        powt: c.docelowe_powt ?? null,
        czas: c.docelowe_czas ?? null,
        kg: c.docelowe_kg ?? null,
        sprzet_id: c.sprzet_id ?? null,
      }));
      return { exercise_id: c.exercise_id, nazwa: ex.nazwa, typ_pomiaru: ex.typ_pomiaru, serie };
    });
    startSession({ name: tpl.nazwa, template_id: tpl.id, scheduled_session_id: scheduledSessionId, exercises });
  }

  function startSession(session) {
    state.session = { ...session, startedAt: Date.now() };
    document.getElementById('active-session-name').textContent = state.session.name;
    document.getElementById('timer-picker').style.display = 'none';
    document.getElementById('active-session').style.display = '';
    clearInterval(state.sessionInterval);
    state.sessionInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - state.session.startedAt) / 1000);
      document.getElementById('active-session-clock').textContent = WorkoutUtils.formatDuration(elapsed);
    }, 1000);
    renderActiveExerciseList();
  }

  function stopSession(saved) {
    clearInterval(state.sessionInterval);
    state.session = null;
    document.getElementById('timer-picker').style.display = '';
    document.getElementById('active-session').style.display = 'none';
    render();
    if (!saved) UI.showToast('Trening anulowany');
  }

  async function openAddExerciseToSession() {
    const exercisesLib = await DB.getAll('exercises');
    if (exercisesLib.length === 0) { UI.showToast('Najpierw dodaj ćwiczenie w panelu Plan'); return; }
    const html = `
      <div class="field"><label>Ćwiczenie</label><select id="f-add-ex">${UI.buildOptions(exercisesLib, 'id', 'nazwa')}</select></div>
      <button class="btn btn-primary btn-block" id="f-add-ex-save">Dodaj do treningu</button>`;
    UI.openSheet('Dodaj ćwiczenie', html, (body) => {
      body.querySelector('#f-add-ex-save').addEventListener('click', () => {
        const exId = Number(body.querySelector('#f-add-ex').value);
        const ex = exercisesLib.find((e) => e.id === exId);
        state.session.exercises.push({ exercise_id: exId, nazwa: ex.nazwa, typ_pomiaru: ex.typ_pomiaru, serie: [{ powt: null, czas: null, kg: null, sprzet_id: null }] });
        UI.closeSheet();
        renderActiveExerciseList();
      });
    });
  }

  function renderActiveExerciseList() {
    const container = document.getElementById('active-exercise-list');
    if (!state.session) return;
    container.innerHTML = state.session.exercises
      .map((ex, exIdx) => {
        const unit = ex.typ_pomiaru === 'czas' ? 's' : 'x';
        const rows = ex.serie
          .map(
            (s, sIdx) => `
          <div class="set-row" data-ex="${exIdx}" data-set="${sIdx}">
            <span class="set-idx">${sIdx + 1}</span>
            <input type="number" class="set-cel" placeholder="${unit === 's' ? 'sek.' : 'powt.'}" value="${(ex.typ_pomiaru === 'czas' ? s.czas : s.powt) ?? ''}" />
            <input type="number" class="set-kg" placeholder="kg" value="${s.kg ?? ''}" step="0.5" />
            <button class="icon-btn danger set-remove"><svg><use href="#i-trash"/></svg></button>
          </div>`
          )
          .join('');
        return `
        <div class="card">
          <div class="title" style="margin-bottom:8px">${UI.escapeHtml(ex.nazwa)}</div>
          <div class="set-row" style="color:var(--ink-faint);font-size:10px;text-transform:uppercase">
            <span></span><span>${unit === 's' ? 'Czas' : 'Powt.'}</span><span>Kg</span><span></span>
          </div>
          ${rows}
          <button type="button" class="btn btn-ghost btn-block add-set-btn" data-ex="${exIdx}" style="margin-top:6px">+ Seria</button>
        </div>`;
      })
      .join('');

    container.querySelectorAll('.set-cel').forEach((input) =>
      input.addEventListener('change', (e) => {
        const row = e.target.closest('.set-row');
        const exIdx = Number(row.getAttribute('data-ex'));
        const sIdx = Number(row.getAttribute('data-set'));
        const ex = state.session.exercises[exIdx];
        if (ex.typ_pomiaru === 'czas') ex.serie[sIdx].czas = e.target.value ? Number(e.target.value) : null;
        else ex.serie[sIdx].powt = e.target.value ? Number(e.target.value) : null;
      })
    );
    container.querySelectorAll('.set-kg').forEach((input) =>
      input.addEventListener('change', (e) => {
        const row = e.target.closest('.set-row');
        const exIdx = Number(row.getAttribute('data-ex'));
        const sIdx = Number(row.getAttribute('data-set'));
        state.session.exercises[exIdx].serie[sIdx].kg = e.target.value ? Number(e.target.value) : null;
      })
    );
    container.querySelectorAll('.set-remove').forEach((btn) =>
      btn.addEventListener('click', (e) => {
        const row = e.target.closest('.set-row');
        const exIdx = Number(row.getAttribute('data-ex'));
        const sIdx = Number(row.getAttribute('data-set'));
        state.session.exercises[exIdx].serie.splice(sIdx, 1);
        if (state.session.exercises[exIdx].serie.length === 0) state.session.exercises.splice(exIdx, 1);
        renderActiveExerciseList();
      })
    );
    container.querySelectorAll('.add-set-btn').forEach((btn) =>
      btn.addEventListener('click', () => {
        const exIdx = Number(btn.getAttribute('data-ex'));
        state.session.exercises[exIdx].serie.push({ powt: null, czas: null, kg: null, sprzet_id: null });
        renderActiveExerciseList();
      })
    );
  }

  async function finishSession() {
    if (!state.session) return;
    if (state.session.exercises.length === 0) { UI.showToast('Dodaj przynajmniej jedno ćwiczenie'); return; }
    const elapsed = Math.floor((Date.now() - state.session.startedAt) / 1000);
    const entry = {
      data: WorkoutUtils.dateToISO(new Date()),
      scheduled_session_id: state.session.scheduled_session_id,
      nazwa_treningu: state.session.name,
      czas_trwania: elapsed,
      cwiczenia: state.session.exercises.map((ex) => ({ exercise_id: ex.exercise_id, serie: ex.serie, notatka: '' })),
      notatka_ogolna: '',
    };
    await DB.add('history_entries', entry);
    if (state.session.scheduled_session_id) {
      const sched = await DB.get('scheduled_sessions', state.session.scheduled_session_id);
      if (sched) await DB.put('scheduled_sessions', { ...sched, status: 'wykonana' });
    }
    stopSession(true);
    UI.showToast('Trening zapisany 💪');
    if (window.Dashboard) window.Dashboard.render();
  }

  window.Timer = { init, render };
})();

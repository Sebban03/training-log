/**
 * WorkoutUtils — czyste funkcje (bez DOM, bez IndexedDB) do statystyk, kalendarza i timera.
 * Dzięki temu, że nie dotykają DOM/bazy, łatwo je testować w Node.
 */
(function (root) {
  'use strict';

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function dateToISO(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function isoToLocalDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function formatDuration(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${pad2(m)}:${pad2(sec)}`;
    return `${pad2(m)}:${pad2(sec)}`;
  }

  /** Passa dni z rzędu z co najmniej jednym history_entry, licząc wstecz od `today` (Date). */
  function calcStreak(historyEntries, today) {
    const trainedDays = new Set(historyEntries.map((e) => e.data));
    let streak = 0;
    const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    // dziś może jeszcze nie być treningu — jeśli nie ma, zacznij liczyć od wczoraj
    if (!trainedDays.has(dateToISO(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (trainedDays.has(dateToISO(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function calcTotalSessions(historyEntries) {
    return historyEntries.length;
  }

  /** Suma kg*powt (objętość) w danym zakresie dat [startIso, endIso], włącznie. */
  function calcVolumeInRange(historyEntries, startIso, endIso) {
    return historyEntries
      .filter((e) => e.data >= startIso && e.data <= endIso)
      .reduce((sum, entry) => {
        const entryVolume = (entry.cwiczenia || []).reduce((exSum, ex) => {
          const serieVolume = (ex.serie || []).reduce((sSum, s) => {
            const kg = s.kg || 0;
            const powt = s.powt || 0;
            return sSum + kg * powt;
          }, 0);
          return exSum + serieVolume;
        }, 0);
        return sum + entryVolume;
      }, 0);
  }

  function startOfWeek(date) {
    // tydzień zaczyna się w poniedziałek
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = (d.getDay() + 6) % 7; // pon=0 ... niedz=6
    d.setDate(d.getDate() - day);
    return d;
  }

  /** Rekordy życiowe: dla każdego exercise_id najwyższe kg (a jeśli brak kg, najwyższe powt/czas). */
  function calcPRs(historyEntries) {
    const prs = {}; // exercise_id -> {kg, powt, czas, data}
    historyEntries.forEach((entry) => {
      (entry.cwiczenia || []).forEach((ex) => {
        (ex.serie || []).forEach((s) => {
          const current = prs[ex.exercise_id];
          const candidateScore = (s.kg || 0) * 1000 + (s.powt || 0) + (s.czas || 0) / 3600;
          const currentScore = current ? (current.kg || 0) * 1000 + (current.powt || 0) + (current.czas || 0) / 3600 : -1;
          if (candidateScore > currentScore) {
            prs[ex.exercise_id] = { kg: s.kg || null, powt: s.powt || null, czas: s.czas || null, data: entry.data };
          }
        });
      });
    });
    return prs;
  }

  /**
   * Buduje siatkę dni dla widoku dużego kalendarza w danym miesiącu.
   * status: 'wykonany' | 'zaplanowany' | 'pominięty' | null
   */
  function buildCalendarMonth(year, month, scheduledSessions, historyEntries) {
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const historyByDate = new Map();
    historyEntries.forEach((e) => {
      if (!historyByDate.has(e.data)) historyByDate.set(e.data, []);
      historyByDate.get(e.data).push(e);
    });
    const scheduledByDate = new Map();
    scheduledSessions.forEach((s) => {
      if (!scheduledByDate.has(s.data)) scheduledByDate.set(s.data, []);
      scheduledByDate.get(s.data).push(s);
    });

    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const iso = dateToISO(date);
      const history = historyByDate.get(iso) || [];
      const scheduled = scheduledByDate.get(iso) || [];
      let status = null;
      let label = null;
      if (history.length > 0) {
        status = 'wykonany';
        label = history[0].nazwa_treningu || null;
      } else if (scheduled.some((s) => s.status === 'pominięta')) {
        status = 'pominięty';
      } else if (scheduled.length > 0) {
        status = 'zaplanowany';
      }
      days.push({ date: iso, dayOfMonth: d, weekday: date.getDay(), status, label });
    }
    return { firstWeekday: firstDay.getDay(), days };
  }

  const api = {
    pad2,
    dateToISO,
    isoToLocalDate,
    formatDuration,
    calcStreak,
    calcTotalSessions,
    calcVolumeInRange,
    startOfWeek,
    calcPRs,
    buildCalendarMonth,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.WorkoutUtils = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);

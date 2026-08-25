/* Wspólne pomoce UI: sheet (dolny formularz), toast, renderowanie kalendarza, drobne helpery DOM. */
(function () {
  'use strict';

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  const sheetBackdrop = document.getElementById('sheet-backdrop');
  const sheetTitle = document.getElementById('sheet-title');
  const sheetBody = document.getElementById('sheet-body');

  function openSheet(title, bodyHtml, onMount) {
    sheetTitle.textContent = title;
    sheetBody.innerHTML = bodyHtml;
    sheetBackdrop.classList.add('active');
    if (typeof onMount === 'function') onMount(sheetBody);
  }

  function closeSheet() {
    sheetBackdrop.classList.remove('active');
    sheetBody.innerHTML = '';
  }

  document.getElementById('sheet-close').addEventListener('click', closeSheet);
  sheetBackdrop.addEventListener('click', (e) => {
    if (e.target === sheetBackdrop) closeSheet();
  });

  function buildOptions(items, valueKey, labelKey, selectedValue) {
    return items
      .map((item) => {
        const val = item[valueKey];
        const sel = selectedValue !== undefined && String(selectedValue) === String(val) ? 'selected' : '';
        return `<option value="${escapeHtml(val)}" ${sel}>${escapeHtml(item[labelKey])}</option>`;
      })
      .join('');
  }

  const STATUS_LABEL = { wykonany: 'Wykonany', zaplanowany: 'Zaplanowany', 'pominięty': 'Pominięty' };

  /**
   * Renderuje duży kalendarz miesięczny do podanego kontenera (grid) + etykiety miesiąca.
   * onDayClick(iso, dayInfo) wywoływane po tapnięciu w dzień.
   */
  function renderCalendar(gridEl, labelEl, date, scheduledSessions, historyEntries, onDayClick) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const cal = WorkoutUtils.buildCalendarMonth(year, month, scheduledSessions, historyEntries);
    const monthNames = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
    labelEl.textContent = `${monthNames[month]} ${year}`;

    const todayIso = WorkoutUtils.dateToISO(new Date());
    const weekdayLabels = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
    let html = weekdayLabels.map((w) => `<div class="calendar-weekday">${w}</div>`).join('');

    // pon=0 ... niedz=6 offset zamiast JS niedz=0
    const offset = (cal.firstWeekday + 6) % 7;
    for (let i = 0; i < offset; i++) html += `<div class="calendar-day empty"></div>`;

    cal.days.forEach((d) => {
      const statusClass = d.status ? `status-${d.status}` : '';
      const todayClass = d.date === todayIso ? 'is-today' : '';
      html += `<div class="calendar-day ${statusClass} ${todayClass}" data-date="${d.date}" role="button" tabindex="0" aria-label="${d.dayOfMonth} ${d.status ? STATUS_LABEL[d.status] : 'brak treningu'}">${d.dayOfMonth}</div>`;
    });

    gridEl.innerHTML = html;
    gridEl.querySelectorAll('.calendar-day[data-date]').forEach((el) => {
      el.addEventListener('click', () => {
        const iso = el.getAttribute('data-date');
        const dayInfo = cal.days.find((d) => d.date === iso);
        onDayClick(iso, dayInfo);
      });
    });
  }

  function confirmAction(message) {
    return window.confirm(message);
  }

  window.UI = {
    escapeHtml,
    showToast,
    openSheet,
    closeSheet,
    buildOptions,
    renderCalendar,
    confirmAction,
  };
})();

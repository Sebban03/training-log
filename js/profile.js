/* Panel 5 — Profil / Ustawienia: jednostki, cel tygodniowy, motyw, backup, reset. */
(function () {
  'use strict';

  function init() {
    ['setting-units', 'setting-theme', 'setting-weekly-goal'].forEach((id) => {
      document.getElementById(id).addEventListener('change', saveSettings);
    });

    document.getElementById('btn-export-backup').addEventListener('click', exportBackup);
    document.getElementById('btn-import-backup').addEventListener('click', () => document.getElementById('import-file-input').click());
    document.getElementById('import-file-input').addEventListener('change', importBackup);
    document.getElementById('btn-reset-data').addEventListener('click', resetData);
  }

  async function render() {
    const settings = (await DB.get('settings', 1)) || { id: 1, jednostki: 'kg', motyw: 'ciemny', cel_tygodniowy: 3 };
    document.getElementById('setting-units').value = settings.jednostki;
    document.getElementById('setting-theme').value = settings.motyw;
    document.getElementById('setting-weekly-goal').value = settings.cel_tygodniowy;
    applyTheme(settings.motyw);
  }

  function applyTheme(motyw) {
    document.body.classList.toggle('theme-light', motyw === 'jasny');
  }

  async function saveSettings() {
    const settings = {
      id: 1,
      jednostki: document.getElementById('setting-units').value,
      motyw: document.getElementById('setting-theme').value,
      cel_tygodniowy: Number(document.getElementById('setting-weekly-goal').value) || 3,
    };
    await DB.put('settings', settings);
    applyTheme(settings.motyw);
    UI.showToast('Zapisano ustawienia');
    if (window.Dashboard) window.Dashboard.render();
  }

  async function exportBackup() {
    const dump = await DB.exportAll();
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = WorkoutUtils.dateToISO(new Date());
    a.href = url;
    a.download = `dziennik-treningowy-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    UI.showToast('Pobrano kopię zapasową');
  }

  function importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dump = JSON.parse(reader.result);
        if (!UI.confirmAction('Import zastąpi obecne dane kopią zapasową. Kontynuować?')) return;
        await DB.importAll(dump);
        UI.showToast('Zaimportowano kopię zapasową');
        render();
        if (window.Dashboard) window.Dashboard.render();
      } catch (err) {
        UI.showToast('Nieprawidłowy plik kopii zapasowej');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function resetData() {
    if (!UI.confirmAction('Usunąć WSZYSTKIE dane (ćwiczenia, treningi, historię, ustawienia)? Tej operacji nie można cofnąć.')) return;
    await DB.clearAll();
    UI.showToast('Wyczyszczono wszystkie dane');
    render();
    if (window.Dashboard) window.Dashboard.render();
  }

  window.Profile = { init, render };
})();

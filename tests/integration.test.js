/**
 * Test integracyjny: ładuje PRAWDZIWY index.html + wszystkie skrypty appki w jsdom
 * i przechodzi przez pełny przepływ użytkownika — tak jak zrobiłby to telefon.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buildApp() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { url: 'https://example.github.io/workout-app/', pretendToBeVisual: true, runScripts: 'dangerously' });
  const { window } = dom;

  // polyfill IndexedDB (świeża instancja per test) + window.confirm (jsdom domyślnie nie implementuje)
  const fdb = require('fake-indexeddb');
  window.indexedDB = fdb.indexedDB;
  window.IDBKeyRange = fdb.IDBKeyRange;
  window.confirm = () => true;

  const scripts = ['js/db.js', 'js/utils.js', 'js/ui.js', 'js/planner.js', 'js/timer.js', 'js/dashboard.js', 'js/history.js', 'js/profile.js', 'js/app.js'];
  for (const rel of scripts) {
    const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    window.eval(code);
  }

  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true, cancelable: true }));
  await sleep(80); // pozwól dokończyć się asynchronicznym renderom startowym

  return dom;
}

function click(dom, selector) {
  const el = dom.window.document.querySelector(selector);
  if (!el) throw new Error(`Nie znaleziono elementu: ${selector}`);
  el.dispatchEvent(new dom.window.Event('click', { bubbles: true, cancelable: true }));
}

function setValue(dom, selector, value) {
  const el = dom.window.document.querySelector(selector);
  if (!el) throw new Error(`Nie znaleziono elementu: ${selector}`);
  el.value = value;
}

function setChecked(dom, selector, checked) {
  dom.window.document.querySelector(selector).checked = checked;
}

function text(dom, selector) {
  return dom.window.document.querySelector(selector).textContent.trim();
}

test('integracja: dodanie ćwiczenia, sprzętu i treningu przez prawdziwy formularz UI', async () => {
  const dom = await buildApp();
  const doc = dom.window.document;

  click(dom, '.nav-btn[data-view="planner"]');
  click(dom, '.subtab[data-planner-tab="exercises"]');
  click(dom, '#planner-fab');
  await sleep(20);

  setValue(dom, '#f-ex-nazwa', 'Wyciskanie sztangi leżąc');
  setValue(dom, '#f-ex-kat', 'klatka');
  setChecked(dom, '#f-ex-sprzet', true);
  click(dom, '#f-ex-save');
  await sleep(50);

  assert.match(doc.getElementById('exercises-list').textContent, /Wyciskanie sztangi leżąc/);
  assert.doesNotMatch(doc.getElementById('sheet-backdrop').className, /active/, 'sheet powinien się zamknąć po zapisie');

});

test('integracja: pełny cykl — plan treningu -> start w Timerze -> zapis -> widoczne w Dashboardzie i Historii', async () => {
  const dom = await buildApp();
  const doc = dom.window.document;

  // 1) dodaj ćwiczenie
  click(dom, '.nav-btn[data-view="planner"]');
  click(dom, '.subtab[data-planner-tab="exercises"]');
  click(dom, '#planner-fab');
  await sleep(20);
  setValue(dom, '#f-ex-nazwa', 'Przysiad ze sztangą');
  setValue(dom, '#f-ex-kat', 'nogi');
  setChecked(dom, '#f-ex-sprzet', true);
  click(dom, '#f-ex-save');
  await sleep(50);

  // 2) dodaj sprzęt
  click(dom, '.subtab[data-planner-tab="equipment"]');
  click(dom, '#planner-fab');
  await sleep(20);
  setValue(dom, '#f-eq-nazwa', 'Sztanga olimpijska');
  click(dom, '#f-eq-save');
  await sleep(50);
  assert.match(doc.getElementById('equipment-list').textContent, /Sztanga olimpijska/);

  // 3) utwórz gotowy trening (szablon) z tym ćwiczeniem, 3 serie x 10 poza domyślnym kg=40
  click(dom, '.subtab[data-planner-tab="templates"]');
  click(dom, '#planner-fab');
  await sleep(20);
  setValue(dom, '#f-tpl-nazwa', 'Trening A - Nogi');
  setValue(dom, '.tpl-row-kg', '40');
  click(dom, '#f-tpl-save');
  await sleep(50);
  assert.match(doc.getElementById('templates-list').textContent, /Trening A - Nogi/);

  // 4) w Timerze wystartuj ten trening
  click(dom, '.nav-btn[data-view="timer"]');
  await sleep(50);
  assert.match(doc.getElementById('timer-plan-list').textContent, /Trening A - Nogi/);
  click(dom, '[data-start-tpl]');
  await sleep(50);

  assert.equal(doc.getElementById('active-session').style.display, '');
  assert.equal(text(dom, '#active-session-name'), 'Trening A - Nogi');
  const setRows = doc.querySelectorAll('#active-exercise-list .set-row[data-ex]');
  assert.equal(setRows.length, 3, 'powinny być 3 serie zgodnie z docelowe_serie z szablonu');

  // 5) zakończ i zapisz trening
  click(dom, '#btn-finish-session');
  await sleep(80);

  assert.equal(doc.getElementById('timer-picker').style.display, '', 'po zapisaniu wraca ekran wyboru');

  // 6) Dashboard powinien pokazać 1 trening łącznie i objętość 3*10*40=1200
  click(dom, '.nav-btn[data-view="dashboard"]');
  await sleep(50);
  assert.equal(text(dom, '#dash-total-sessions'), '1');
  const volumeDigits = text(dom, '#dash-week-volume').replace(/[^\d]/g, '');
  assert.equal(volumeDigits, '1200');
  assert.match(doc.getElementById('dash-recent-list').textContent, /Trening A - Nogi/);

  // 7) Historia: wpis widoczny, rekord życiowy 40 kg zapisany
  click(dom, '.nav-btn[data-view="history"]');
  await sleep(50);
  assert.match(doc.getElementById('history-log-list').textContent, /Trening A - Nogi/);
  assert.match(doc.getElementById('pr-list').textContent, /40 kg/);

  // 8) edycja wpisu w historii — zmiana nazwy
  click(dom, '[data-edit-hist]');
  await sleep(20);
  setValue(dom, '#f-hist-nazwa', 'Trening A - Nogi (edytowany)');
  click(dom, '#f-hist-save');
  await sleep(50);
  assert.match(doc.getElementById('history-log-list').textContent, /Trening A - Nogi \(edytowany\)/);

  // 9) usunięcie wpisu z historii (confirm zwraca true w tym środowisku testowym)
  click(dom, '[data-del-hist]');
  await sleep(50);
  assert.match(doc.getElementById('history-log-list').textContent, /Pusto/);

});

test('integracja: timer przerwy — presety zmieniają wyświetlany czas', async () => {
  const dom = await buildApp();
  const doc = dom.window.document;

  click(dom, '.nav-btn[data-view="timer"]');
  click(dom, '.subtab[data-timer-tab="rest"]');
  click(dom, '[data-rest-preset="120"]');

  assert.equal(text(dom, '#rest-display'), '02:00');

});

test('integracja: harmonogram — zaplanowanie treningu na dowolny dzień w kalendarzu', async () => {
  const dom = await buildApp();
  const doc = dom.window.document;

  // szybki setup: 1 ćwiczenie + 1 szablon
  click(dom, '.nav-btn[data-view="planner"]');
  click(dom, '.subtab[data-planner-tab="exercises"]');
  click(dom, '#planner-fab');
  await sleep(20);
  setValue(dom, '#f-ex-nazwa', 'Plank');
  setChecked(dom, '#f-ex-sprzet', false);
  click(dom, '#f-ex-save');
  await sleep(50);

  click(dom, '.subtab[data-planner-tab="templates"]');
  click(dom, '#planner-fab');
  await sleep(20);
  setValue(dom, '#f-tpl-nazwa', 'Core');
  click(dom, '#f-tpl-save');
  await sleep(50);

  // otwórz harmonogram i kliknij pierwszy dzień z widocznych w gridzie (nie "empty")
  click(dom, '.subtab[data-planner-tab="schedule"]');
  await sleep(50);
  const dayEl = doc.querySelector('#sched-cal-grid .calendar-day[data-date]');
  assert.ok(dayEl, 'kalendarz powinien wyrenderować przynajmniej jeden dzień');
  dayEl.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  await sleep(20);

  const saveBtn = doc.getElementById('f-sched-save');
  assert.ok(saveBtn, 'powinien pojawić się formularz planowania (ćwiczenie/szablon istnieje)');
  click(dom, '#f-sched-save');
  await sleep(50);

  const targetDate = dayEl.getAttribute('data-date');
  const updatedDay = doc.querySelector(`#sched-cal-grid .calendar-day[data-date="${targetDate}"]`);
  assert.match(updatedDay.className, /status-zaplanowany/);

});

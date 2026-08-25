const test = require('node:test');
const assert = require('node:assert/strict');

// polyfill IndexedDB w Node zanim db.js go użyje
require('fake-indexeddb/auto');

const path = require('node:path');
const DB = require(path.join(__dirname, '..', 'js', 'db.js'));

function freshDb() {
  // każdy test dostaje świeżą bazę: usuwamy poprzednią zawartość, bo fake-indexeddb
  // trzyma stan globalnie per nazwa bazy między testami w tym samym procesie
  const fdb = require('fake-indexeddb');
  global.indexedDB = fdb.indexedDB;
  global.IDBKeyRange = fdb.IDBKeyRange;
  DB.resetForTests();
  return new Promise((resolve, reject) => {
    const req = fdb.indexedDB.deleteDatabase('workoutTrackerDB');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

test('exercises: add / get / getAll / put / remove', async () => {
  await freshDb();
  const id = await DB.add('exercises', {
    nazwa: 'Przysiad ze sztangą',
    opis: 'Trzy serie po osiem',
    kategoria: 'nogi',
    typ_pomiaru: 'powtorzenia',
    wymaga_sprzetu: true,
  });
  assert.ok(id > 0);

  const loaded = await DB.get('exercises', id);
  assert.equal(loaded.nazwa, 'Przysiad ze sztangą');

  loaded.nazwa = 'Przysiad ze sztangą (zaktualizowany)';
  await DB.put('exercises', loaded);
  const updated = await DB.get('exercises', id);
  assert.equal(updated.nazwa, 'Przysiad ze sztangą (zaktualizowany)');

  const all = await DB.getAll('exercises');
  assert.equal(all.length, 1);

  await DB.remove('exercises', id);
  const afterDelete = await DB.getAll('exercises');
  assert.equal(afterDelete.length, 0);
});

test('exercise bez sprzętu: wymaga_sprzetu=false, kg opcjonalne', async () => {
  await freshDb();
  const id = await DB.add('exercises', {
    nazwa: 'Pompki',
    kategoria: 'klatka',
    typ_pomiaru: 'powtorzenia',
    wymaga_sprzetu: false,
  });
  const ex = await DB.get('exercises', id);
  assert.equal(ex.wymaga_sprzetu, false);
});

test('templates: gotowy zestaw ćwiczeń z opcjonalnym kg/sprzętem', async () => {
  await freshDb();
  const tplId = await DB.add('templates', {
    nazwa: 'Trening A – Push',
    opis: 'Klatka, barki, triceps',
    cwiczenia: [
      { exercise_id: 1, docelowe_serie: 3, docelowe_powt: 10, docelowe_kg: 40, sprzet_id: 1 },
      { exercise_id: 2, docelowe_serie: 3, docelowe_powt: 15, docelowe_kg: null, sprzet_id: null },
    ],
    dni_tygodnia: ['pon', 'czw'],
  });
  const tpl = await DB.get('templates', tplId);
  assert.equal(tpl.cwiczenia.length, 2);
  assert.equal(tpl.cwiczenia[1].docelowe_kg, null);
});

test('scheduled_sessions: planowanie wstecz i w przód + odczyt po dacie', async () => {
  await freshDb();
  await DB.add('scheduled_sessions', { data: '2026-08-20', template_id: 1, status: 'wykonana' });
  await DB.add('scheduled_sessions', { data: '2026-08-24', template_id: 1, status: 'zaplanowana' });
  await DB.add('scheduled_sessions', { data: '2026-08-31', template_id: 2, status: 'zaplanowana' });

  const wRange = await DB.getByIndexRange('scheduled_sessions', 'data', '2026-08-21', '2026-08-25');
  assert.equal(wRange.length, 1);
  assert.equal(wRange[0].data, '2026-08-24');

  const all = await DB.getAll('scheduled_sessions');
  assert.equal(all.length, 3);
});

test('history_entries: trening spontaniczny (bez template) z nazwą, masa własna', async () => {
  await freshDb();
  const id = await DB.add('history_entries', {
    data: '2026-08-24',
    scheduled_session_id: null,
    nazwa_treningu: 'Szybki trening w domu',
    czas_trwania: 1200,
    cwiczenia: [
      {
        exercise_id: 2,
        serie: [
          { powt: 15, czas: null, kg: null, sprzet_id: null },
          { powt: 12, czas: null, kg: null, sprzet_id: null },
        ],
        notatka: 'ciężko szło',
      },
    ],
    notatka_ogolna: '',
  });
  const entry = await DB.get('history_entries', id);
  assert.equal(entry.nazwa_treningu, 'Szybki trening w domu');
  assert.equal(entry.cwiczenia[0].serie[0].kg, null);
});

test('equipment: CRUD', async () => {
  await freshDb();
  const id = await DB.add('equipment', { nazwa: 'Hantle 10kg', typ: 'wolne ciężary' });
  await DB.put('equipment', { id, nazwa: 'Hantle 12kg', typ: 'wolne ciężary' });
  const eq = await DB.get('equipment', id);
  assert.equal(eq.nazwa, 'Hantle 12kg');
  await DB.remove('equipment', id);
  assert.equal(await DB.get('equipment', id), undefined);
});

test('settings: pojedynczy rekord z ustalonym id', async () => {
  await freshDb();
  await DB.put('settings', { id: 1, jednostki: 'kg', motyw: 'ciemny', cel_tygodniowy: 4 });
  const s = await DB.get('settings', 1);
  assert.equal(s.jednostki, 'kg');
  assert.equal(s.cel_tygodniowy, 4);
});

test('export/import: pełny backup i przywrócenie', async () => {
  await freshDb();
  await DB.add('exercises', { nazwa: 'Martwy ciąg', kategoria: 'plecy', typ_pomiaru: 'powtorzenia', wymaga_sprzetu: true });
  await DB.add('equipment', { nazwa: 'Sztanga olimpijska', typ: 'sztanga' });
  await DB.put('settings', { id: 1, jednostki: 'kg', motyw: 'ciemny', cel_tygodniowy: 3 });

  const dump = await DB.exportAll();
  assert.equal(dump.exercises.length, 1);
  assert.equal(dump.equipment.length, 1);
  assert.ok(dump._meta.exportedAt);

  // wyczyść i przywróć
  await DB.remove('exercises', dump.exercises[0].id);
  assert.equal((await DB.getAll('exercises')).length, 0);

  await DB.importAll(dump);
  const restored = await DB.getAll('exercises');
  assert.equal(restored.length, 1);
  assert.equal(restored[0].nazwa, 'Martwy ciąg');
});

test('clearAll: czyści wszystkie store\'y naraz (użycie: "Usuń wszystkie dane")', async () => {
  await freshDb();
  await DB.add('exercises', { nazwa: 'A', kategoria: 'nogi', typ_pomiaru: 'czas', wymaga_sprzetu: false });
  await DB.add('equipment', { nazwa: 'Hantle', typ: 'wolne ciężary' });
  await DB.put('settings', { id: 1, jednostki: 'kg', motyw: 'ciemny', cel_tygodniowy: 3 });

  await DB.clearAll();

  assert.equal((await DB.getAll('exercises')).length, 0);
  assert.equal((await DB.getAll('equipment')).length, 0);
  assert.equal(await DB.get('settings', 1), undefined);
});

test('kolejne dodania w tej samej bazie generują rosnące id (autoIncrement)', async () => {
  await freshDb();
  const id1 = await DB.add('exercises', { nazwa: 'A', kategoria: 'nogi', typ_pomiaru: 'czas', wymaga_sprzetu: false });
  const id2 = await DB.add('exercises', { nazwa: 'B', kategoria: 'nogi', typ_pomiaru: 'czas', wymaga_sprzetu: false });
  assert.ok(id2 > id1);
});

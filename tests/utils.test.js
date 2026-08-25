const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const U = require(path.join(__dirname, '..', 'js', 'utils.js'));

test('formatDuration: sekundy -> MM:SS oraz H:MM:SS', () => {
  assert.equal(U.formatDuration(65), '01:05');
  assert.equal(U.formatDuration(3661), '1:01:01');
  assert.equal(U.formatDuration(0), '00:00');
});

test('dateToISO / isoToLocalDate: tam i z powrotem', () => {
  const d = new Date(2026, 7, 24); // 24 sierpnia 2026 (miesiące 0-indeksowane)
  assert.equal(U.dateToISO(d), '2026-08-24');
  const back = U.isoToLocalDate('2026-08-24');
  assert.equal(back.getFullYear(), 2026);
  assert.equal(back.getMonth(), 7);
  assert.equal(back.getDate(), 24);
});

test('calcStreak: liczy dni z rzędu wstecz od dziś, zatrzymuje się na dziurze', () => {
  const today = new Date(2026, 7, 24);
  const entries = [
    { data: '2026-08-24' },
    { data: '2026-08-23' },
    { data: '2026-08-22' },
    { data: '2026-08-20' }, // dziura 21 -> przerywa passę
  ];
  assert.equal(U.calcStreak(entries, today), 3);
});

test('calcStreak: jeśli dziś jeszcze bez treningu, liczy od wczoraj', () => {
  const today = new Date(2026, 7, 24);
  const entries = [{ data: '2026-08-23' }, { data: '2026-08-22' }];
  assert.equal(U.calcStreak(entries, today), 2);
});

test('calcStreak: brak treningów w ogóle -> 0', () => {
  assert.equal(U.calcStreak([], new Date(2026, 7, 24)), 0);
});

test('calcVolumeInRange: sumuje kg*powt tylko w zakresie dat, pomija serie masy własnej (kg=null)', () => {
  const entries = [
    {
      data: '2026-08-20',
      cwiczenia: [{ serie: [{ kg: 40, powt: 10 }, { kg: null, powt: 15 }] }],
    },
    {
      data: '2026-08-30', // poza zakresem
      cwiczenia: [{ serie: [{ kg: 100, powt: 10 }] }],
    },
  ];
  const vol = U.calcVolumeInRange(entries, '2026-08-18', '2026-08-24');
  assert.equal(vol, 400); // 40*10 + 0*15
});

test('calcPRs: znajduje najwyższe kg per ćwiczenie', () => {
  const entries = [
    { data: '2026-08-10', cwiczenia: [{ exercise_id: 1, serie: [{ kg: 60, powt: 5 }] }] },
    { data: '2026-08-17', cwiczenia: [{ exercise_id: 1, serie: [{ kg: 80, powt: 3 }] }] },
    { data: '2026-08-24', cwiczenia: [{ exercise_id: 1, serie: [{ kg: 70, powt: 5 }] }] },
  ];
  const prs = U.calcPRs(entries);
  assert.equal(prs[1].kg, 80);
  assert.equal(prs[1].data, '2026-08-17');
});

test('calcPRs: dla masy własnej (kg=null) bierze najwyższe powtórzenia', () => {
  const entries = [
    { data: '2026-08-10', cwiczenia: [{ exercise_id: 2, serie: [{ kg: null, powt: 12 }] }] },
    { data: '2026-08-17', cwiczenia: [{ exercise_id: 2, serie: [{ kg: null, powt: 20 }] }] },
  ];
  const prs = U.calcPRs(entries);
  assert.equal(prs[2].powt, 20);
  assert.equal(prs[2].kg, null);
});

test('buildCalendarMonth: oznacza dni jako wykonany / zaplanowany / pominięty / brak', () => {
  const scheduled = [
    { data: '2026-08-05', status: 'zaplanowana' },
    { data: '2026-08-10', status: 'pominięta' },
  ];
  const history = [{ data: '2026-08-03', nazwa_treningu: 'Push' }];
  const cal = U.buildCalendarMonth(2026, 7, scheduled, history); // sierpień = miesiąc 7

  const day3 = cal.days.find((d) => d.dayOfMonth === 3);
  const day5 = cal.days.find((d) => d.dayOfMonth === 5);
  const day10 = cal.days.find((d) => d.dayOfMonth === 10);
  const day15 = cal.days.find((d) => d.dayOfMonth === 15);

  assert.equal(day3.status, 'wykonany');
  assert.equal(day3.label, 'Push');
  assert.equal(day5.status, 'zaplanowany');
  assert.equal(day10.status, 'pominięty');
  assert.equal(day15.status, null);
  assert.equal(cal.days.length, 31);
});

test('buildCalendarMonth: wykonany trening ma priorytet nad zaplanowanym tego samego dnia', () => {
  const scheduled = [{ data: '2026-08-05', status: 'zaplanowana' }];
  const history = [{ data: '2026-08-05', nazwa_treningu: 'Zrobione mimo planu' }];
  const cal = U.buildCalendarMonth(2026, 7, scheduled, history);
  const day5 = cal.days.find((d) => d.dayOfMonth === 5);
  assert.equal(day5.status, 'wykonany');
});

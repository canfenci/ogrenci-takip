import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildStudentTimeline,
  calculateStudentSummary,
  getUpcomingLesson
} from '../student-insights.js';

test('finds the next recurring lesson from Turkish weekday and time values', () => {
  const mondayAtFive = new Date(2026, 7, 10, 17, 0, 0);
  const schedule = [
    { gun: 'Salı', saat: '16:00', dersAdi: 'Fen Bilimleri' },
    { gun: 'Pazartesi', saat: '18:00', dersAdi: 'Matematik' }
  ];

  const upcoming = getUpcomingLesson(schedule, mondayAtFive);

  assert.equal(upcoming.dersAdi, 'Matematik');
  assert.equal(upcoming.date.getDate(), 10);
  assert.equal(upcoming.date.getHours(), 18);
});

test('moves a passed lesson to the following week', () => {
  const mondayAtSeven = new Date(2026, 7, 10, 19, 0, 0);
  const upcoming = getUpcomingLesson(
    [{ gun: 'Pazartesi', saat: '18:00', dersAdi: 'Matematik' }],
    mondayAtSeven
  );

  assert.equal(upcoming.date.getDate(), 17);
});

test('combines exams, homework, lessons and growth logs in reverse date order', () => {
  const student = {
    denemeler: [{ id: 'e1', tip: 'genel', tarih: '2026-08-01', denemeAdi: 'LGS 1', toplamNet: 72 }],
    growthPlan: { logs: [{ date: '2026-08-04', count: 80 }] }
  };
  const homeworks = [{ id: 'h1', bitisTarihi: '2026-08-03', konu: 'Basınç', durum: 'tamamlandi', dogru: 18, yanlis: 2 }];
  const lessons = [{ dersNo: 1, tarih: '2026-08-02', ders: 'Fen Bilimleri', konu: 'Basınç' }];

  const timeline = buildStudentTimeline(student, homeworks, lessons);

  assert.deepEqual(timeline.map(event => event.category), ['growth', 'homework', 'lesson', 'exam']);
  assert.equal(timeline[1].detail, 'Basınç · 18D 2Y');
});

test('calculates headline progress metrics', () => {
  const student = {
    denemeler: [
      { id: 'e1', tip: 'genel', tarih: '2026-07-01', toplamNet: 60 },
      { id: 'e2', tip: 'genel', tarih: '2026-08-01', toplamNet: 67.5 }
    ]
  };
  const homeworks = [{ durum: 'tamamlandi' }, { durum: 'verildi' }];
  const lessons = [{ tarih: '2026-08-02', konu: 'Basınç' }];

  const summary = calculateStudentSummary(student, homeworks, lessons, []);

  assert.equal(summary.latestNet, 67.5);
  assert.equal(summary.netChange, 7.5);
  assert.equal(summary.homeworkCompletionRate, 50);
  assert.equal(summary.lastLesson.konu, 'Basınç');
});

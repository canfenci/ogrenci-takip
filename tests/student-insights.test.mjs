import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildStudentTimeline,
  calculateSmartExamAnalysis,
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

test('calculates recent averages, subject trends and target gap recommendations', () => {
  const student = {
    hedefNet: 80,
    denemeler: [
      {
        id: 'g1', tip: 'genel', tarih: '2026-06-01', denemeAdi: 'Genel 1',
        toplamNet: 60, toplamDogru: 70, toplamYanlis: 20, toplamBos: 0, toplamSoru: 90,
        dersSonuclari: { Matematik: { dogru: 12, yanlis: 6, bos: 2 }, Turkce: { dogru: 16, yanlis: 3, bos: 1 } }
      },
      {
        id: 'g2', tip: 'genel', tarih: '2026-07-01', denemeAdi: 'Genel 2',
        toplamNet: 66, toplamDogru: 75, toplamYanlis: 15, toplamBos: 0, toplamSoru: 90,
        dersSonuclari: { Matematik: { dogru: 14, yanlis: 4, bos: 2 }, Turkce: { dogru: 17, yanlis: 2, bos: 1 } }
      },
      {
        id: 'g3', tip: 'genel', tarih: '2026-08-01', denemeAdi: 'Genel 3',
        toplamNet: 72, toplamDogru: 80, toplamYanlis: 10, toplamBos: 0, toplamSoru: 90,
        dersSonuclari: { Matematik: { dogru: 16, yanlis: 3, bos: 1 }, Turkce: { dogru: 18, yanlis: 1, bos: 1 } }
      }
    ]
  };

  const analysis = calculateSmartExamAnalysis(student);

  assert.equal(analysis.recentThreeAverage, 66);
  assert.equal(analysis.recentFiveAverage, 66);
  assert.equal(analysis.latestChange, 6);
  assert.equal(analysis.strongestSubject.subject, 'Turkce');
  assert.equal(analysis.subjectPerformance.find(subject => subject.subject === 'Matematik').trend, 2.33);
  assert.match(analysis.recommendations.join(' '), /8\.00 netlik gelişim/);
  assert.deepEqual(analysis.warnings, []);
});

test('extracts priority topics from branch-exam errors', () => {
  const student = {
    denemeler: [{
      id: 'b1', tip: 'branş', tarih: '2026-08-02', denemeAdi: 'Fen Branş',
      toplamDogru: 1, toplamYanlis: 2, toplamBos: 1, toplamSoru: 4, toplamNet: 0.33,
      sorular: [
        { konuAdi: 'Basınç', durum: 'yanlis' },
        { konuAdi: 'Basınç', durum: 'bos' },
        { konuAdi: 'Basınç', durum: 'dogru' },
        { konuAdi: 'DNA', durum: 'yanlis' }
      ]
    }]
  };

  const analysis = calculateSmartExamAnalysis(student);

  assert.equal(analysis.priorityTopics[0].topic, 'Basınç');
  assert.equal(analysis.priorityTopics[0].errors, 2);
  assert.equal(analysis.priorityTopics[0].errorRate, 66.7);
  assert.match(analysis.recommendations.join(' '), /Basınç konusu 2 hatayla/);
});

test('reports inconsistent exam totals and duplicate identifiers', () => {
  const student = {
    denemeler: [
      { id: 'same', tip: 'genel', tarih: '', denemeAdi: 'Bozuk 1', toplamDogru: 10, toplamYanlis: -1, toplamBos: 2, toplamSoru: 20 },
      { id: 'same', tip: 'genel', tarih: '2026-08-02', denemeAdi: 'Bozuk 2', toplamDogru: 10, toplamYanlis: 2, toplamBos: 2, toplamSoru: 20 }
    ]
  };

  const warnings = calculateSmartExamAnalysis(student).warnings.join(' ');

  assert.match(warnings, /tarih bilgisi eksik/);
  assert.match(warnings, /geçersiz değer/);
  assert.match(warnings, /yinelenen deneme kimliği/);
  assert.match(warnings, /soru sayısıyla uyuşmuyor/);
});

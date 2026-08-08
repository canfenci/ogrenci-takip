import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTodayItems, buildWeeklySummaryMessage, calculateWeeklyGoalProgress, getWeekKey } from '../weekly-goal-insights.js';

const monday = new Date('2026-08-10T10:00:00+03:00');

test('calculates weekly question, task and net goal progress', () => {
  const student = {
    adSoyad: 'Ada', hedefNet: 80,
    weeklyGoals: { questionTarget: 500, taskTarget: 4, netTarget: 80 },
    growthPlan: { logs: [{ date: '2026-08-10', count: 125 }, { date: '2026-08-09', count: 999 }] },
    studyPlan: { Pazartesi: ['Matematik'], Salı: ['Fen'] },
    weeklyGoalProgress: { '2026-08-10': { completedTasks: ['Pazartesi|0|Matematik'] } },
    denemeler: [{ tip: 'genel', tarih: '2026-08-09', denemeAdi: 'Genel', toplamNet: 60 }]
  };
  const progress = calculateWeeklyGoalProgress(student, monday);
  assert.equal(getWeekKey(monday), '2026-08-10');
  assert.equal(progress.questionCount, 125);
  assert.equal(progress.questionPercent, 25);
  assert.equal(progress.completedTaskCount, 1);
  assert.equal(progress.taskPercent, 25);
  assert.equal(progress.netPercent, 75);
  assert.equal(progress.overallPercent, 42);
});

test('combines overdue homework, today lessons and unfinished study tasks', () => {
  const student = { id: 's1', studyPlan: { Pazartesi: ['Paragraf'] } };
  const homeworks = [
    { konu: 'Basınç', durum: 'verildi', bitisTarihi: '2026-08-09' },
    { konu: 'DNA', durum: 'tamamlandi', bitisTarihi: '2026-08-10' }
  ];
  const schedule = [{ gun: 'Pazartesi', saat: '18:00', dersAdi: 'Fen' }];
  const items = buildTodayItems(student, homeworks, schedule, monday);
  assert.deepEqual(items.map(item => item.type), ['overdue', 'lesson', 'study']);
});

test('creates a guardian-friendly weekly summary', () => {
  const student = { adSoyad: 'Ada' };
  const progress = {
    questionCount: 100, completedTaskCount: 2, latestNet: 70, overallPercent: 55,
    goals: { questionTarget: 500, taskTarget: 5, netTarget: 80 }, recommendation: 'Fen tekrarı yapın.'
  };
  const message = buildWeeklySummaryMessage(student, progress, [{ type: 'overdue' }]);
  assert.match(message, /Genel ilerleme: %55/);
  assert.match(message, /Geciken ödev: 1/);
  assert.match(message, /Fen tekrarı/);
});

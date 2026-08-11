import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateLessonFinance, normalizeLessonStatus, updateLessonAttendanceState, updateLessonPaymentState } from '../lesson-finance-insights.js';

test('charges only completed lessons and preserves legacy records', () => {
  const lessons = [
    { odendi: true },
    { katilimDurumu: 'yapildi', odendi: false },
    { katilimDurumu: 'iptal', odendi: true },
    { katilimDurumu: 'mazeretli', odendi: false },
    { katilimDurumu: 'gelmedi', odendi: false },
    { katilimDurumu: 'planlandi', odendi: true }
  ];
  const summary = calculateLessonFinance(lessons, 750);
  assert.equal(normalizeLessonStatus(lessons[0]), 'yapildi');
  assert.equal(summary.billableCount, 2);
  assert.equal(summary.paidAmount, 750);
  assert.equal(summary.pendingAmount, 750);
  assert.equal(summary.totalAmount, 1500);
  assert.deepEqual(summary.statusCounts, { planlandi: 1, yapildi: 2, gelmedi: 1, mazeretli: 1, iptal: 1 });
});

test('inline attendance and payment changes preserve billing integrity', () => {
  const planned = { katilimDurumu: 'planlandi', odendi: false };
  const completed = updateLessonAttendanceState(planned, 'yapildi');
  assert.deepEqual(completed, { katilimDurumu: 'yapildi', odendi: false });

  const paid = updateLessonPaymentState(completed, true);
  assert.equal(paid.odendi, true);

  const cancelled = updateLessonAttendanceState(paid, 'iptal');
  assert.equal(cancelled.odendi, false);
  assert.equal(updateLessonPaymentState(cancelled, true).odendi, false);
});

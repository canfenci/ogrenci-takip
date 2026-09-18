import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateLessonFinance, getEffectiveLessonFee, normalizeLessonStatus, updateLessonAttendanceState, updateLessonPaymentState } from '../lesson-finance-insights.js';

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

test('FINANCE-FEE-01: historical snapshot preservation when student fee changes', () => {
  // Scenario: 2 lessons created when fee was 800, then fee changes to 1000 and 2 more lessons are added
  const lessons = [
    { id: 'l1', katilimDurumu: 'yapildi', odendi: true, ucret: 800 },
    { id: 'l2', katilimDurumu: 'yapildi', odendi: false, ucret: 800 },
    { id: 'l3', katilimDurumu: 'yapildi', odendi: true, ucret: 1000 },
    { id: 'l4', katilimDurumu: 'yapildi', odendi: false, ucret: 1000 }
  ];
  // Current student fee is now 1200, but snapshot ucret must take precedence
  const summary = calculateLessonFinance(lessons, 1200);
  assert.equal(summary.billableCount, 4);
  assert.equal(summary.paidCount, 2);
  assert.equal(summary.pendingCount, 2);
  // paid: 800 + 1000 = 1800 (NOT 2 * 1200 = 2400)
  assert.equal(summary.paidAmount, 1800);
  // pending: 800 + 1000 = 1800 (NOT 2 * 1200 = 2400)
  assert.equal(summary.pendingAmount, 1800);
  // total: 1800 + 1800 = 3600 (NOT 4 * 1200 = 4800)
  assert.equal(summary.totalAmount, 3600);
});

test('FINANCE-FEE-01: legacy lesson fallback when ucret is undefined or null', () => {
  const lessons = [
    { id: 'legacy-1', katilimDurumu: 'yapildi', odendi: true }, // undefined ucret -> fallback 900
    { id: 'legacy-2', katilimDurumu: 'yapildi', odendi: false, ucret: null }, // null ucret -> fallback 900
    { id: 'snap-1', katilimDurumu: 'yapildi', odendi: true, ucret: 750 } // snapshotted 750
  ];
  const summary = calculateLessonFinance(lessons, 900);
  assert.equal(summary.paidAmount, 900 + 750); // 1650
  assert.equal(summary.pendingAmount, 900);
  assert.equal(summary.totalAmount, 2550);
});

test('FINANCE-FEE-01: explicit zero-fee lesson (ucret === 0) is not overridden by fallback fee', () => {
  const lessons = [
    { id: 'free-1', katilimDurumu: 'yapildi', odendi: true, ucret: 0 },
    { id: 'free-2', katilimDurumu: 'yapildi', odendi: false, ucret: 0 },
    { id: 'paid-1', katilimDurumu: 'yapildi', odendi: true, ucret: 500 }
  ];
  // Fallback fee is 1000
  const summary = calculateLessonFinance(lessons, 1000);
  assert.equal(summary.paidAmount, 0 + 500); // 500
  assert.equal(summary.pendingAmount, 0); // 0
  assert.equal(summary.totalAmount, 500);
});

test('FINANCE-FEE-01: mixed rates (5 @ 800 + 5 @ 1000) produces exact mathematical sum', () => {
  const lessons = [
    // 5 lessons at 800 (3 paid, 2 pending)
    { id: 'l1', katilimDurumu: 'yapildi', odendi: true, ucret: 800 },
    { id: 'l2', katilimDurumu: 'yapildi', odendi: true, ucret: 800 },
    { id: 'l3', katilimDurumu: 'yapildi', odendi: true, ucret: 800 },
    { id: 'l4', katilimDurumu: 'yapildi', odendi: false, ucret: 800 },
    { id: 'l5', katilimDurumu: 'yapildi', odendi: false, ucret: 800 },
    // 5 lessons at 1000 (2 paid, 3 pending)
    { id: 'l6', katilimDurumu: 'yapildi', odendi: true, ucret: 1000 },
    { id: 'l7', katilimDurumu: 'yapildi', odendi: true, ucret: 1000 },
    { id: 'l8', katilimDurumu: 'yapildi', odendi: false, ucret: 1000 },
    { id: 'l9', katilimDurumu: 'yapildi', odendi: false, ucret: 1000 },
    { id: 'l10', katilimDurumu: 'yapildi', odendi: false, ucret: 1000 }
  ];
  const summary = calculateLessonFinance(lessons, 1500);
  assert.equal(summary.totalCount, 10);
  assert.equal(summary.billableCount, 10);
  assert.equal(summary.paidCount, 5);
  assert.equal(summary.pendingCount, 5);
  // paid: (3 * 800) + (2 * 1000) = 2400 + 2000 = 4400
  assert.equal(summary.paidAmount, 4400);
  // pending: (2 * 800) + (3 * 1000) = 1600 + 3000 = 4600
  assert.equal(summary.pendingAmount, 4600);
  // total: 4400 + 4600 = 9000
  assert.equal(summary.totalAmount, 9000);
});

test('FINANCE-FEE-01: decimal rates and non-billable attendance handling', () => {
  const lessons = [
    { id: 'd1', katilimDurumu: 'yapildi', odendi: true, ucret: 850.50 },
    { id: 'd2', katilimDurumu: 'yapildi', odendi: false, ucret: 850.50 },
    // Non-billable lessons with snapshot fee must not contribute to revenue or pending
    { id: 'd3', katilimDurumu: 'iptal', odendi: false, ucret: 850.50 },
    { id: 'd4', katilimDurumu: 'mazeretli', odendi: false, ucret: 850.50 },
    { id: 'd5', katilimDurumu: 'gelmedi', odendi: false, ucret: 850.50 },
    { id: 'd6', katilimDurumu: 'planlandi', odendi: false, ucret: 850.50 }
  ];
  const summary = calculateLessonFinance(lessons, 1000);
  assert.equal(summary.billableCount, 2);
  assert.equal(summary.paidAmount, 850.50);
  assert.equal(summary.pendingAmount, 850.50);
  assert.equal(summary.totalAmount, 1701);
});

test('FINANCE-FEE-01: getEffectiveLessonFee exact contract and edge cases', () => {
  // ucret = 0 -> 0
  assert.equal(getEffectiveLessonFee({ ucret: 0 }, 500), 0);
  // ucret = "0" -> 0
  assert.equal(getEffectiveLessonFee({ ucret: "0" }, 500), 0);
  // ucret = 800 -> 800
  assert.equal(getEffectiveLessonFee({ ucret: 800 }, 500), 800);
  // ucret = "800" -> 800
  assert.equal(getEffectiveLessonFee({ ucret: "800" }, 500), 800);
  // ucret = 800.5 -> 800.5
  assert.equal(getEffectiveLessonFee({ ucret: 800.5 }, 500), 800.5);
  // ucret = undefined -> fallback student fee
  assert.equal(getEffectiveLessonFee({ ucret: undefined }, 750), 750);
  assert.equal(getEffectiveLessonFee({}, 750), 750);
  // ucret = null -> fallback student fee
  assert.equal(getEffectiveLessonFee({ ucret: null }, 750), 750);
  // ucret = -100 (negative) -> must not accept negative, falls back to normalized fee
  assert.equal(getEffectiveLessonFee({ ucret: -100 }, 750), 750);
  // ucret = Infinity / -Infinity -> must not accept non-finite, falls back
  assert.equal(getEffectiveLessonFee({ ucret: Infinity }, 750), 750);
  assert.equal(getEffectiveLessonFee({ ucret: -Infinity }, 750), 750);
  // ucret = NaN -> fallback student fee
  assert.equal(getEffectiveLessonFee({ ucret: NaN }, 750), 750);
  // ucret = "abc" -> fallback student fee
  assert.equal(getEffectiveLessonFee({ ucret: "abc" }, 750), 750);
  // fallback itself invalid/negative/non-finite -> returns 0
  assert.equal(getEffectiveLessonFee({ ucret: undefined }, undefined), 0);
  assert.equal(getEffectiveLessonFee({ ucret: undefined }, "invalid"), 0);
  assert.equal(getEffectiveLessonFee({ ucret: undefined }, -500), 0);
  assert.equal(getEffectiveLessonFee({ ucret: undefined }, Infinity), 0);
  assert.equal(getEffectiveLessonFee({ ucret: -100 }, -200), 0);
  // null lesson object -> fallback
  assert.equal(getEffectiveLessonFee(null, 600), 600);
});

test('FINANCE-FEE-01: decimal precision with multiple lessons', () => {
  // 3 lessons at 1250.50
  const lessons = [
    { katilimDurumu: 'yapildi', odendi: true, ucret: 1250.50 },
    { katilimDurumu: 'yapildi', odendi: true, ucret: 1250.50 },
    { katilimDurumu: 'yapildi', odendi: false, ucret: 1250.50 }
  ];
  const summary = calculateLessonFinance(lessons, 1500);
  assert.equal(summary.paidAmount, 2501);
  assert.equal(summary.pendingAmount, 1250.50);
  assert.equal(summary.totalAmount, 3751.50);
});

test('FINANCE-FEE-01: profile fee editing isolation — modifying student fee does not mutate existing lesson snapshot', () => {
  const student = { id: 's1', adSoyad: 'Ali', dersUcreti: 800 };
  const existingLessons = [
    { id: 'l1', dersNo: 1, ucret: 800, katilimDurumu: 'yapildi', odendi: true }
  ];
  // Teacher changes profile fee to 1200
  student.dersUcreti = 1200;

  // Existing lessons array is completely untouched
  assert.equal(existingLessons[0].ucret, 800);
  // Financial calculation preserves 800
  const summary = calculateLessonFinance(existingLessons, student.dersUcreti);
  assert.equal(summary.paidAmount, 800);
});

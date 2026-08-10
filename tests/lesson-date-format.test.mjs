import assert from 'node:assert/strict';
import test from 'node:test';

const { formatLessonDateForDisplay, parseLessonDateInput } = await import('../lesson-date-utils.js');

test('lesson dates are displayed as day/month/year', () => {
  assert.equal(formatLessonDateForDisplay('2026-08-10'), '10/08/2026');
});

test('day/month/year lesson dates are stored in sortable ISO format', () => {
  assert.equal(parseLessonDateInput('10/08/2026'), '2026-08-10');
  assert.equal(parseLessonDateInput('31/02/2026'), '');
  assert.equal(parseLessonDateInput('2026-08-10'), '');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHomeworkDashboard, filterHomeworkDashboard, getHomeworkDueState } from '../homework-dashboard-insights.js';

const today = '2026-09-01';
const student = { id: 's1', adSoyad: 'Yağmur Aydın', sinif: '8' };
const records = [
  { id: 'late', durum: 'verildi', bitisTarihi: '2026-08-31', konu: 'Basınç' },
  { id: 'today', durum: 'verildi', bitisTarihi: '2026-09-01', konu: 'Kaldırma' },
  { id: 'soon', durum: 'verildi', bitisTarihi: '2026-09-03', konu: 'Enerji' },
  { id: 'done', durum: 'tamamlandi', bitisTarihi: '2026-08-30', konu: 'Kuvvet' }
];

test('classifies overdue, today, upcoming and completed homework safely', () => {
  assert.equal(getHomeworkDueState(records[0], today).key, 'overdue');
  assert.equal(getHomeworkDueState(records[1], today).key, 'today');
  assert.equal(getHomeworkDueState(records[2], today).key, 'upcoming');
  assert.equal(getHomeworkDueState(records[3], today).key, 'completed');
});

test('builds real dashboard metrics and composes filters', () => {
  const dashboard = buildHomeworkDashboard([student], () => records, today);
  assert.deepEqual(dashboard.metrics, { total: 4, active: 3, overdue: 1, dueToday: 1, upcoming: 1, completed: 1, completionRate: 25 });
  assert.equal(filterHomeworkDashboard(dashboard.records, { status: 'overdue' }).map(record => record.homework.id)[0], 'late');
  assert.equal(filterHomeworkDashboard(dashboard.records, { query: 'enerji', grade: '8' }).length, 1);
  assert.equal(filterHomeworkDashboard([], { status: 'all' }).length, 0);
});

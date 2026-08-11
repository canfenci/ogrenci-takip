import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWorkPerformance } from '../work-performance-insights.js';

const homeworks = [
  { id: 't1', tur: 'Yaprak Test', durum: 'tamamlandi', konu: 'Basınç', calismaDetayi: 'Test-1', dogru: 8, yanlis: 3, bitisTarihi: '2026-08-01' },
  { id: 'd1', tur: 'Konu Denemesi', durum: 'tamamlandi', konu: 'Basınç', calismaDetayi: '1. Deneme', dogru: 17, yanlis: 3, bitisTarihi: '2026-08-02' },
  { id: 'x1', tur: 'Konu Tekrarı', durum: 'verildi', konu: 'Basınç', dogru: null, yanlis: null }
];

test('combines completed tests and topic exams into one performance series', () => {
  const all = buildWorkPerformance(homeworks);
  assert.equal(all.count, 2);
  assert.equal(all.averageCorrect, 12.5);
  assert.equal(all.averageWrong, 3);
  assert.equal(all.averageNet, 11.5);
  assert.equal(buildWorkPerformance(homeworks, 'topic').count, 1);
  assert.equal(buildWorkPerformance(homeworks, 'test').records[0].label, 'Test-1');
});

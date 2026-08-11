import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTopicExamRecords, calculateTopicExamProgress, calculateTopicTestNet } from '../topic-exam-insights.js';

test('combines legacy topic exams with completed lesson-linked topic homework results', () => {
  const student = { denemeler: [{ id: 'exam-1', tip: 'branş', denemeAdi: 'Basınç 1', tarih: '2026-08-01', ders: 'Fen Bilimleri', sorular: [{ konuAdi: 'Basınç', durum: 'dogru' }, { konuAdi: 'Basınç', durum: 'yanlis' }] }] };
  const homeworks = [{ id: 'hw-1', tur: 'Konu Denemesi', durum: 'tamamlandi', konu: 'Basınç', dogru: 18, yanlis: 3, bitisTarihi: '2026-08-10', yayin: 'Test Yayını', kaynakDers: { lessonId: 'lesson-1', ders: 'Fen Bilimleri' } }];
  const records = buildTopicExamRecords(student, homeworks);
  assert.equal(records.length, 2);
  assert.equal(records[1].lessonId, 'lesson-1');
  assert.equal(records[1].net, 17);
  const progress = calculateTopicExamProgress(student, homeworks);
  assert.equal(progress.count, 2);
  assert.equal(progress.topics[0].topic, 'Basınç');
  assert.equal(progress.averageCorrect, 9.5);
  assert.equal(calculateTopicTestNet(10, 3), 9);
});

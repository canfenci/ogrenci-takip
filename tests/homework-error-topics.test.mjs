import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHomeworkErrorTopics, getSubtopicOptions } from '../homework-error-topics.js';

test('topic-test wrong answers inherit the assigned topic and may include a subtopic', () => {
  assert.deepEqual(buildHomeworkErrorTopics({ homeworkType: 'Konu Denemesi', assignedTopic: 'Mevsimlerin oluşumu', selectedTopic: 'Başka konu', subtopic: 'Eksen Eğikliği', wrong: 2 }), [
    { konu: 'Mevsimlerin oluşumu', altKonu: 'Eksen Eğikliği', adet: 2 }
  ]);
  assert.ok(getSubtopicOptions('Mevsimlerin oluşumu').includes('Eksen Eğikliği'));
});

test('zero wrong answers create no error-topic record', () => {
  assert.deepEqual(buildHomeworkErrorTopics({ homeworkType: 'Konu Denemesi', assignedTopic: 'Basınç', wrong: 0 }), []);
});

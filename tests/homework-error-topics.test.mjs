import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHomeworkErrorTopics } from '../homework-error-topics.js';

test('topic-test wrong answers inherit the assigned topic and may include a subtopic', () => {
  assert.deepEqual(buildHomeworkErrorTopics({ homeworkType: 'Konu Denemesi', assignedTopic: 'Mevsimlerin oluşumu', selectedTopic: 'Başka konu', subtopic: 'Eksen Eğikliği', wrong: 2 }), [
    { konu: 'Mevsimlerin oluşumu', altKonu: 'Eksen Eğikliği', adet: 2 }
  ]);
});

test('zero wrong answers create no error-topic record', () => {
  assert.deepEqual(buildHomeworkErrorTopics({ homeworkType: 'Konu Denemesi', assignedTopic: 'Basınç', wrong: 0 }), []);
});

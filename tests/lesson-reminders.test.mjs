import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLessonReminderMessage,
  buildLessonReminders,
  normalizePhone
} from '../lesson-reminder-insights.js';

test('creates a reminder exactly one hour before a weekly lesson', () => {
  const now = new Date('2026-08-10T17:15:00+03:00');
  const students = [{ id: 's1', adSoyad: 'Ada Yılmaz', veliTel: '0532 111 22 33' }];
  const schedules = { s1: [{ gun: 'Pazartesi', saat: '18:00', dersAdi: 'Matematik' }] };

  const [reminder] = buildLessonReminders(students, schedules, now, {});

  assert.equal(reminder.isDue, true);
  assert.equal(reminder.normalizedPhone, '905321112233');
  assert.equal(reminder.reminderAt.toISOString(), '2026-08-10T14:00:00.000Z');
  assert.equal(reminder.lessonAt.toISOString(), '2026-08-10T15:00:00.000Z');
});

test('moves a passed weekly lesson to next week and excludes cancelled lessons', () => {
  const now = new Date('2026-08-10T18:01:00+03:00');
  const students = [{ id: 's1', adSoyad: 'Ada', veliTel: '' }];
  const schedules = { s1: [
    { gun: 'Pazartesi', saat: '18:00', dersAdi: 'Fen' },
    { gun: 'Salı', saat: '18:00', dersAdi: 'Türkçe', aktif: false }
  ] };

  const reminders = buildLessonReminders(students, schedules, now, {});

  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].lessonAt.toISOString(), '2026-08-17T15:00:00.000Z');
});

test('marks an occurrence as sent without suppressing the following week', () => {
  const students = [{ id: 's1', adSoyad: 'Ada', veliTel: '905321112233' }];
  const schedules = { s1: [{ gun: 'Pazartesi', saat: '18:00', dersAdi: 'Fen' }] };
  const first = buildLessonReminders(students, schedules, new Date('2026-08-10T17:15:00+03:00'), {});
  const history = { [first[0].id]: { sentAt: '2026-08-10T14:15:00.000Z' } };
  const sent = buildLessonReminders(students, schedules, new Date('2026-08-10T17:15:00+03:00'), history);
  const nextWeek = buildLessonReminders(students, schedules, new Date('2026-08-10T18:15:00+03:00'), history);

  assert.equal(sent[0].isSent, true);
  assert.equal(nextWeek[0].isSent, false);
});

test('normalizes Turkish mobile phones and prepares the guardian message', () => {
  assert.equal(normalizePhone('0532 111 22 33'), '905321112233');
  assert.equal(normalizePhone('123'), '');
  assert.equal(buildLessonReminderMessage({ studentName: 'Ada', lessonName: 'Fen', time: '18:00' }), 'Değerli velimiz; “Ada” ile dersimizin bugün saat 18:00\'de olduğunu hatırlatırız.');
});

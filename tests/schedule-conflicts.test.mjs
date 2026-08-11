import assert from 'node:assert/strict';
import test from 'node:test';
import { buildScheduleConflictMessage, findScheduleConflict } from '../schedule-conflicts.js';

const students = [{ id: 's1', adSoyad: 'Ada Yılmaz' }, { id: 's2', adSoyad: 'Ege Demir' }];
const schedulesByStudent = {
  s1: [{ gun: 'Pazartesi', saat: '18:00', dersAdi: 'Matematik' }],
  s2: [{ gun: 'Salı', saat: '17:30', dersAdi: 'Fen Bilimleri' }]
};

test('finds a same-day same-time lesson belonging to another student', () => {
  const conflict = findScheduleConflict({ studentId: 's2', day: 'Pazartesi', time: '18:00', students, schedulesByStudent });
  assert.equal(conflict.student.id, 's1');
  assert.match(buildScheduleConflictMessage(conflict, 'Pazartesi', '18:00'), /Ada Yılmaz.*18:00.*Matematik/);
});

test('ignores the lesson being edited and inactive lessons', () => {
  assert.equal(findScheduleConflict({ studentId: 's1', day: 'Pazartesi', time: '18:00', students, schedulesByStudent, ignoreLessonIndex: 0 }), null);
  const inactiveSchedules = { s1: [{ gun: 'Pazartesi', saat: '18:00', dersAdi: 'Matematik', aktif: false }] };
  assert.equal(findScheduleConflict({ studentId: 's2', day: 'Pazartesi', time: '18:00', students, schedulesByStudent: inactiveSchedules }), null);
});

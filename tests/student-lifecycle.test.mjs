import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const store = fs.readFileSync('store.js', 'utf8');
const students = fs.readFileSync('students.js', 'utf8');
const homework = fs.readFileSync('homework.js', 'utf8');
const schedule = fs.readFileSync('schedule.js', 'utf8');
test('F-05 A/P: legacy students normalize to active without migration', () => { assert.match(store, /status: \['active', 'archived', 'graduated'\]\.includes\(s\.status\) \? s\.status : 'active'/); assert.match(store, /getStudentLifecycleStatus\(student\)/); });
test('F-05 B-E: lifecycle actions support archive, graduate, reactivate', () => { assert.match(students, /updateStudentLifecycle\(id, status\)/); assert.match(students, /status === 'archived'/); assert.match(students, /status === 'graduated'/); assert.match(students, /status === 'active'/); });
test('F-05 F-Q: lifecycle is additive and preserves existing records', () => { assert.match(store, /id: s\.id \|\|/); for (const field of ['denemeler', 'odevler', 'guidanceRecords', 'coachingPlan']) assert.match(store, new RegExp(field)); assert.doesNotMatch(students, /localStorage\.clear\(\)/); });
test('F-05 L-N: active selectors exclude inactive students by default', () => { assert.match(homework, /isActiveStudent\(s\)/); assert.match(schedule, /loadStudentsData\(\)\.filter\(isActiveStudent\)/); assert.match(students, /studentLifecycleFilter/); });
test('F-05 UI: Turkish lifecycle labels and touch-safe controls exist', () => { for (const label of ['Aktif', 'Arşiv', 'Mezun', 'Arşivle', 'Mezun Et', 'Aktife Al']) assert.match(students, new RegExp(label)); assert.match(students, /min-h-\[44px\]/); });

test('F-05 behavioral: lifecycle normalization preserves identity and historical records', async () => {
    const { normalizeStudent, getStudentLifecycleStatus, isActiveStudent } = await import('../store.js');
    const source = {
        id: 'student-42', adSoyad: 'Test Öğrenci', sinif: '8',
        denemeler: [{ id: 'exam-1' }], odevler: [{ id: 'hw-1' }],
        guidanceRecords: [{ id: 'guide-1' }], coachingPlan: { id: 'plan-1' },
        dersKayitlari: [{ id: 'lesson-1', ucret: 500 }]
    };
    const legacy = normalizeStudent(source);
    assert.equal(legacy.id, 'student-42');
    assert.equal(getStudentLifecycleStatus(legacy), 'active');
    assert.equal(isActiveStudent(legacy), true);
    assert.equal(legacy.denemeler[0].id, 'exam-1');
    assert.equal(legacy.odevler[0].id, 'hw-1');
    assert.equal(legacy.guidanceRecords[0].id, 'guide-1');
    assert.equal(legacy.coachingPlan.id, 'plan-1');

    const transition = (student, status) => ({
        ...student,
        status,
        archivedAt: status === 'archived' ? '2026-09-21T10:00:00.000Z' : null,
        graduatedAt: status === 'graduated' ? '2026-09-21T10:00:00.000Z' : null
    });
    const archived = normalizeStudent(transition(legacy, 'archived'));
    const graduated = normalizeStudent(transition(legacy, 'graduated'));
    const reactivated = normalizeStudent(transition(archived, 'active'));
    assert.equal(getStudentLifecycleStatus(archived), 'archived');
    assert.equal(getStudentLifecycleStatus(graduated), 'graduated');
    assert.equal(isActiveStudent(archived), false);
    assert.equal(isActiveStudent(graduated), false);
    assert.equal(reactivated.id, 'student-42');
    assert.equal(reactivated.archivedAt, null);
    assert.equal(reactivated.graduatedAt, null);
    for (const record of [archived, graduated, reactivated]) {
        assert.equal(record.denemeler[0].id, 'exam-1');
        assert.equal(record.odevler[0].id, 'hw-1');
        assert.equal(record.guidanceRecords[0].id, 'guide-1');
        assert.equal(source.dersKayitlari[0].id, 'lesson-1');
    }
});

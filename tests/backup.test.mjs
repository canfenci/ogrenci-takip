import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BACKUP_FORMAT, buildFullBackup, backupFileName, combineRestoreData, summarizeBackupData, validateFullBackup } from '../backup.js';

test('buildFullBackup includes all application data and accurate counts', () => {
    const backup = buildFullBackup({
        exportedAt: '2026-08-15T12:00:00.000Z',
        accountEmail: 'teacher@example.com',
        teacherProfile: { name: 'Öğretmen', branches: ['Fen Bilimleri'] },
        students: [{ id: 's1', userId: 'secret-owner' }],
        homeworks: [{ id: 'h1', studentId: 's1', userId: 'secret-owner' }],
        schedules: { s1: [{ gun: 'Pazartesi', saat: '18:00' }] },
        lessons: { s1: [{ id: 'l1' }, { id: 'l2' }] },
        groups: [{ id: 'g1', userId: 'secret-owner' }],
        resourceBooks: [{ id: 'r1', name: 'Kaynak', userId: 'secret-owner' }],
        reminderSettings: { enabled: true },
        reminderHistory: { sent: true }
    });

    assert.equal(backup.format, BACKUP_FORMAT);
    assert.deepEqual(backup.summary, {
        students: 1,
        homeworks: 1,
        lessonRecords: 2,
        schedules: 1,
        groups: 1,
        resourceBooks: 1
    });
    assert.equal(backup.data.teacherProfile.name, 'Öğretmen');
    assert.equal(backup.data.reminderSettings.enabled, true);
    assert.equal(backup.data.students[0].userId, undefined);
    assert.equal(backup.data.homeworks[0].userId, undefined);
    assert.equal(backup.data.resourceBooks[0].userId, undefined);
});

test('backupFileName uses a stable dated json name', () => {
    assert.equal(backupFileName(new Date('2026-08-15T23:59:00.000Z')), 'canfenci_tam_yedek_2026-08-15.json');
});

test('validateFullBackup rejects malformed and duplicate records', () => {
    const valid = buildFullBackup({ students: [{ id: 's1' }] });
    assert.equal(validateFullBackup(valid).ok, true);
    valid.data.students.push({ id: 's1' });
    assert.match(validateFullBackup(valid).error, /yinelenen/);
    assert.equal(validateFullBackup([]).ok, false);
    const malformedSchedule = buildFullBackup({ schedules: { 'bad/id': [] } });
    assert.match(validateFullBackup(malformedSchedule).error, /geçersiz öğrenci/);
});

test('combineRestoreData merges by id or completely replaces data', () => {
    const current = { teacherProfile: { name: 'Eski' }, students: [{ id: 's1', name: 'Eski' }], homeworks: [], schedules: { s1: [] }, lessons: {}, groups: [], resourceBooks: [], reminderSettings: {}, reminderHistory: {} };
    const incoming = { teacherProfile: { school: 'Okul' }, students: [{ id: 's1', name: 'Yeni' }, { id: 's2' }], homeworks: [], schedules: { s2: [] }, lessons: {}, groups: [], resourceBooks: [], reminderSettings: {}, reminderHistory: {} };
    const merged = combineRestoreData(current, incoming, 'merge');
    assert.equal(merged.students.length, 2);
    assert.equal(merged.students.find(item => item.id === 's1').name, 'Yeni');
    assert.deepEqual(merged.teacherProfile, { name: 'Eski', school: 'Okul' });
    assert.deepEqual(Object.keys(merged.schedules).sort(), ['s1', 's2']);
    assert.deepEqual(combineRestoreData(current, incoming, 'replace'), incoming);
    assert.equal(summarizeBackupData(incoming).students, 2);
});

test('cloud restore stamps ownership and replacement deletes only current user documents', async () => {
    const restoreSource = await readFile(new URL('../backup-restore.js', import.meta.url), 'utf8');
    const studentsSource = await readFile(new URL('../students.js', import.meta.url), 'utf8');
    assert.match(restoreSource, /where\('userId', '==', userId\)/);
    assert.match(restoreSource, /userId: user\.uid/);
    assert.match(restoreSource, /user\.emailVerified/);
    assert.match(studentsSource, /if \(mode === 'replace'\) exportBackup\(\)/);
    assert.match(studentsSource, /restoreAccountEmail/);
    assert.match(studentsSource, /restoreSensitiveData/);
});

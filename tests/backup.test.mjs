import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKUP_FORMAT, buildFullBackup, backupFileName } from '../backup.js';

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

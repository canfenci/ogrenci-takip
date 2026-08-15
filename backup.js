export const BACKUP_FORMAT = 'canfenci-full-backup';
export const BACKUP_VERSION = 1;

function cloneWithoutOwnership(value) {
    if (Array.isArray(value)) return value.map(cloneWithoutOwnership);
    if (!value || typeof value !== 'object') return value;

    return Object.fromEntries(Object.entries(value)
        .filter(([key]) => key !== 'userId')
        .map(([key, item]) => [key, cloneWithoutOwnership(item)]));
}

export function buildFullBackup({
    exportedAt = new Date().toISOString(),
    accountEmail = '',
    mode = 'cloud',
    teacherProfile = {},
    students = [],
    homeworks = [],
    schedules = {},
    lessons = {},
    groups = [],
    resourceBooks = [],
    reminderSettings = {},
    reminderHistory = {}
} = {}) {
    const clean = cloneWithoutOwnership({
        teacherProfile,
        students,
        homeworks,
        schedules,
        lessons,
        groups,
        resourceBooks,
        reminderSettings,
        reminderHistory
    });

    return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt,
        source: {
            application: 'Canfenci Öğrenci Takip Sistemi',
            mode,
            accountEmail
        },
        summary: {
            students: clean.students.length,
            homeworks: clean.homeworks.length,
            lessonRecords: Object.values(clean.lessons).reduce((total, records) => total + (Array.isArray(records) ? records.length : 0), 0),
            schedules: Object.keys(clean.schedules).length,
            groups: clean.groups.length,
            resourceBooks: clean.resourceBooks.length
        },
        data: clean
    };
}

export function backupFileName(date = new Date()) {
    const day = date.toISOString().slice(0, 10);
    return `canfenci_tam_yedek_${day}.json`;
}

export const BACKUP_FORMAT = 'canfenci-full-backup';
export const BACKUP_VERSION = 1;

const ARRAY_SECTIONS = ['students', 'homeworks', 'groups', 'resourceBooks'];
const OBJECT_SECTIONS = ['teacherProfile', 'schedules', 'lessons', 'reminderSettings', 'reminderHistory'];

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

export function validateFullBackup(backup) {
    if (!backup || backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION || !backup.data) {
        return { ok: false, error: 'Bu dosya desteklenen bir Canfenci tam veri yedeği değil.' };
    }
    for (const section of ARRAY_SECTIONS) {
        if (!Array.isArray(backup.data[section])) return { ok: false, error: `${section} bölümü geçersiz.` };
    }
    for (const section of OBJECT_SECTIONS) {
        const value = backup.data[section];
        if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: `${section} bölümü geçersiz.` };
    }
    for (const section of ARRAY_SECTIONS) {
        const ids = new Set();
        for (const record of backup.data[section]) {
            const id = String(record?.id || '');
            if (!id || id.includes('/')) return { ok: false, error: `${section} bölümünde geçersiz kayıt kimliği var.` };
            if (ids.has(id)) return { ok: false, error: `${section} bölümünde yinelenen kayıt kimliği var.` };
            ids.add(id);
        }
    }
    for (const section of ['schedules', 'lessons']) {
        for (const [studentId, records] of Object.entries(backup.data[section])) {
            if (!studentId || studentId.includes('/') || !Array.isArray(records)) {
                return { ok: false, error: `${section} bölümünde geçersiz öğrenci kaydı var.` };
            }
        }
    }
    return { ok: true, backup };
}

export function summarizeBackupData(data) {
    return {
        students: data.students.length,
        homeworks: data.homeworks.length,
        lessonRecords: Object.values(data.lessons).reduce((total, records) => total + records.length, 0),
        schedules: Object.keys(data.schedules).length,
        groups: data.groups.length,
        resourceBooks: data.resourceBooks.length
    };
}

function mergeById(current = [], incoming = []) {
    const records = new Map(current.map(item => [String(item.id), cloneWithoutOwnership(item)]));
    incoming.forEach(item => records.set(String(item.id), cloneWithoutOwnership(item)));
    return [...records.values()];
}

export function combineRestoreData(current, incoming, mode = 'merge') {
    if (mode === 'replace') return cloneWithoutOwnership(incoming);
    return {
        teacherProfile: { ...(current.teacherProfile || {}), ...(incoming.teacherProfile || {}) },
        students: mergeById(current.students, incoming.students),
        homeworks: mergeById(current.homeworks, incoming.homeworks),
        schedules: { ...(current.schedules || {}), ...(incoming.schedules || {}) },
        lessons: { ...(current.lessons || {}), ...(incoming.lessons || {}) },
        groups: mergeById(current.groups, incoming.groups),
        resourceBooks: mergeById(current.resourceBooks, incoming.resourceBooks),
        reminderSettings: { ...(current.reminderSettings || {}), ...(incoming.reminderSettings || {}) },
        reminderHistory: { ...(current.reminderHistory || {}), ...(incoming.reminderHistory || {}) }
    };
}

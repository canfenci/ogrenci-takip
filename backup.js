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

function getRecordIdentity(record, index, recordType = null) {
    if (!record || typeof record !== 'object') return `idx_${index}`;
    if (record.id !== undefined && record.id !== null && String(record.id).trim() !== '') {
        return `id:${String(record.id).trim()}`;
    }
    if (record._id !== undefined && record._id !== null && String(record._id).trim() !== '') {
        return `id:${String(record._id).trim()}`;
    }

    // 1. Homework identity (type 'homework' or presence of homework fields)
    const isHomework = recordType === 'homework' || record.konu !== undefined || record.calismaDetayi !== undefined || record.yayin !== undefined || (record.baslamaTarihi !== undefined && record.bitisTarihi !== undefined);
    if (isHomework) {
        const date = record.baslamaTarihi || record.tarih || record.bitisTarihi || record.date || '';
        const konu = record.konu || '';
        const ders = record.ders || '';
        const student = record.studentId || '';
        return `hw:${student}_${date}_${ders}_${konu}`;
    }

    // 2. Exam identity (type 'exam' or presence of exam fields)
    const isExam = recordType === 'exam' || record.denemeAdi !== undefined || record.toplamNet !== undefined || record.sorular !== undefined || (record.tip === 'genel' || record.tip === 'branş');
    if (isExam) {
        const date = record.tarih || record.date || '';
        const tip = record.tip || '';
        const ders = record.ders || (record.sorular?.[0]?.ders) || '';
        const name = record.denemeAdi || '';
        const yayin = record.yayin || '';
        return `exam:${date}_${tip}_${ders}_${name}_${yayin}`;
    }

    // 3. Guidance identity (type 'guidance' or presence of guidance fields)
    const isGuidance = recordType === 'guidance' || record.followUpDate !== undefined || record.issue !== undefined || record.sorun !== undefined || record.mudahale !== undefined || record.yapilan !== undefined || (record.type && ['academic', 'discipline', 'performance', 'general'].includes(record.type));
    if (isGuidance) {
        const date = record.date || record.tarih || (record.createdAt ? String(record.createdAt).slice(0, 10) : '');
        const type = record.type || record.tur || '';
        const issue = record.issue || record.sorun || record.gozlem || record.not || record.aciklama || record.text || '';
        return `guidance:${date}_${type}_${issue.slice(0, 60)}`;
    }

    // 4. Growth log identity (type 'growth' or count with date)
    const isGrowth = recordType === 'growth' || (record.date !== undefined && record.count !== undefined);
    if (isGrowth) {
        const date = record.date || record.tarih || '';
        return `growth:${date}`;
    }

    // 5. Fallback: serialize stable JSON representation
    try {
        return `json:${JSON.stringify(record)}`;
    } catch {
        return `idx_${index}`;
    }
}

function mergeRecordPair(existingRec, incomingRec, recordType = null) {
    if (!existingRec || typeof existingRec !== 'object') return cloneWithoutOwnership(incomingRec);
    if (!incomingRec || typeof incomingRec !== 'object') return cloneWithoutOwnership(existingRec);

    const merged = { ...cloneWithoutOwnership(existingRec) };
    const cleanIncoming = cloneWithoutOwnership(incomingRec);

    for (const [key, val] of Object.entries(cleanIncoming)) {
        if (val === undefined || val === null) {
            continue;
        }
        if (typeof val === 'string' && val.trim() === '' && typeof merged[key] === 'string' && merged[key].trim() !== '') {
            continue;
        }
        if (Array.isArray(val) && Array.isArray(merged[key])) {
            merged[key] = mergeNestedById(merged[key], val, recordType);
            continue;
        }
        if (val && typeof val === 'object' && merged[key] && typeof merged[key] === 'object' && !Array.isArray(val)) {
            merged[key] = { ...merged[key], ...val };
            continue;
        }
        merged[key] = val;
    }
    return merged;
}

export function mergeNestedById(existing = [], incoming = [], recordType = null) {
    const exList = Array.isArray(existing) ? existing : [];
    const inList = Array.isArray(incoming) ? incoming : [];

    const map = new Map();
    const order = [];

    exList.forEach((item, idx) => {
        if (!item) return;
        let key = getRecordIdentity(item, idx, recordType);
        if (map.has(key)) {
            key = `${key}#ex_${idx}`;
        }
        map.set(key, cloneWithoutOwnership(item));
        order.push(key);
    });

    inList.forEach((item, idx) => {
        if (!item) return;
        const key = getRecordIdentity(item, idx, recordType);
        if (map.has(key)) {
            const current = map.get(key);
            map.set(key, mergeRecordPair(current, item, recordType));
        } else {
            map.set(key, cloneWithoutOwnership(item));
            order.push(key);
        }
    });

    return order.map(k => map.get(k));
}

function mergeStudent(existingStudent, incomingStudent) {
    const existing = cloneWithoutOwnership(existingStudent);
    const incoming = cloneWithoutOwnership(incomingStudent);

    const merged = { ...existing };

    // 1. Top-level scalar fields
    for (const [key, val] of Object.entries(incoming)) {
        if (val === undefined || val === null) {
            continue;
        }
        if (typeof val === 'string' && val.trim() === '' && typeof existing[key] === 'string' && existing[key].trim() !== '') {
            continue;
        }
        if (Array.isArray(val) || (val && typeof val === 'object')) {
            continue;
        }
        merged[key] = val;
    }

    // 2. Known nested collections
    if (existing.exams || incoming.exams) {
        merged.exams = mergeNestedById(existing.exams, incoming.exams, 'exam');
    }
    if (existing.denemeler || incoming.denemeler) {
        merged.denemeler = mergeNestedById(existing.denemeler, incoming.denemeler, 'exam');
    }
    if (existing.guidanceRecords || incoming.guidanceRecords) {
        merged.guidanceRecords = mergeNestedById(existing.guidanceRecords, incoming.guidanceRecords, 'guidance');
    }
    if (existing.rehberlikKayitlari || incoming.rehberlikKayitlari) {
        merged.rehberlikKayitlari = mergeNestedById(existing.rehberlikKayitlari, incoming.rehberlikKayitlari, 'guidance');
    }
    if (existing.growthLogs || incoming.growthLogs) {
        merged.growthLogs = mergeNestedById(existing.growthLogs, incoming.growthLogs, 'growth');
    }
    if (existing.odevler || incoming.odevler) {
        merged.odevler = mergeNestedById(existing.odevler, incoming.odevler, 'homework');
    }

    // 3. Known nested objects
    if (existing.growthPlan || incoming.growthPlan) {
        const exPlan = existing.growthPlan || {};
        const inPlan = incoming.growthPlan || {};
        merged.growthPlan = {
            ...exPlan,
            ...inPlan,
            logs: mergeNestedById(exPlan.logs, inPlan.logs, 'growth')
        };
        if (inPlan.weeklyTarget !== undefined && inPlan.weeklyTarget !== null && inPlan.weeklyTarget !== '') {
            merged.growthPlan.weeklyTarget = inPlan.weeklyTarget;
        } else if (exPlan.weeklyTarget !== undefined) {
            merged.growthPlan.weeklyTarget = exPlan.weeklyTarget;
        }
    }

    if (existing.studyPlan || incoming.studyPlan) {
        const exPlan = existing.studyPlan || {};
        const inPlan = incoming.studyPlan || {};
        const allDays = new Set([...Object.keys(exPlan), ...Object.keys(inPlan)]);
        const mergedStudyPlan = {};
        for (const day of allDays) {
            const exTasks = Array.isArray(exPlan[day]) ? exPlan[day] : [];
            const inTasks = Array.isArray(inPlan[day]) ? inPlan[day] : [];
            mergedStudyPlan[day] = [...new Set([...exTasks, ...inTasks])];
        }
        merged.studyPlan = mergedStudyPlan;
    }

    if (existing.studyPlanProfile || incoming.studyPlanProfile) {
        merged.studyPlanProfile = {
            ...(existing.studyPlanProfile || {}),
            ...(incoming.studyPlanProfile || {})
        };
    }

    if (existing.errorResets || incoming.errorResets) {
        merged.errorResets = {
            ...(existing.errorResets || {}),
            ...(incoming.errorResets || {})
        };
    }

    // 4. Any other custom array/object fields
    for (const [key, val] of Object.entries(incoming)) {
        if (key in merged) continue;
        if (Array.isArray(val)) {
            merged[key] = Array.isArray(existing[key]) ? mergeNestedById(existing[key], val) : cloneWithoutOwnership(val);
        } else if (val && typeof val === 'object') {
            merged[key] = { ...(existing[key] || {}), ...cloneWithoutOwnership(val) };
        } else {
            merged[key] = val;
        }
    }

    return merged;
}

export function mergeStudents(current = [], incoming = []) {
    const currentList = Array.isArray(current) ? current : [];
    const incomingList = Array.isArray(incoming) ? incoming : [];

    const studentMap = new Map();
    const order = [];

    for (const student of currentList) {
        if (!student) continue;
        const id = String(student.id || '');
        if (id) {
            studentMap.set(id, cloneWithoutOwnership(student));
            order.push(id);
        }
    }

    for (const student of incomingList) {
        if (!student) continue;
        const id = String(student.id || '');
        if (!id) continue;

        if (studentMap.has(id)) {
            const existing = studentMap.get(id);
            const merged = mergeStudent(existing, cloneWithoutOwnership(student));
            studentMap.set(id, merged);
        } else {
            studentMap.set(id, cloneWithoutOwnership(student));
            order.push(id);
        }
    }

    return order.map(id => studentMap.get(id));
}

export function combineRestoreData(current, incoming, mode = 'merge') {
    if (mode === 'replace') return cloneWithoutOwnership(incoming);
    return {
        teacherProfile: { ...(current.teacherProfile || {}), ...(incoming.teacherProfile || {}) },
        students: mergeStudents(current.students, incoming.students),
        homeworks: mergeById(current.homeworks, incoming.homeworks),
        schedules: { ...(current.schedules || {}), ...(incoming.schedules || {}) },
        lessons: { ...(current.lessons || {}), ...(incoming.lessons || {}) },
        groups: mergeById(current.groups, incoming.groups),
        resourceBooks: mergeById(current.resourceBooks, incoming.resourceBooks),
        reminderSettings: { ...(current.reminderSettings || {}), ...(incoming.reminderSettings || {}) },
        reminderHistory: { ...(current.reminderHistory || {}), ...(incoming.reminderHistory || {}) }
    };
}

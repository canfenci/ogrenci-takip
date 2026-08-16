import { combineRestoreData, validateFullBackup } from './backup.js';
import { store, STORAGE_KEY, SCHEDULE_KEY, DERS_KAYITLARI_KEY, GROUPS_KEY, localDataKey } from './store.js';

const CLOUD_COLLECTIONS = ['homeworks', 'schedules', 'lessons', 'groups', 'resourceBooks', 'students'];

function currentData() {
    const read = (key, fallback) => {
        try { return JSON.parse(localStorage.getItem(localDataKey(key))) ?? fallback; }
        catch { return fallback; }
    };
    const cloud = store.useFirestore && window.isFirebaseActive && !store.isGuestMode;
    const students = cloud ? (store.globalStudents || []) : read(STORAGE_KEY, []);
    return {
        teacherProfile: {
            name: localStorage.getItem(localDataKey('teacher_name_v1')) || store.teacherName || '',
            school: localStorage.getItem(localDataKey('teacher_school_v1')) || store.teacherSchool || '',
            branches: read('teacher_branches_v1', store.teacherBranches || [])
        },
        students,
        homeworks: cloud ? (store.globalHomeworks || []) : students.flatMap(student => student.odevler || []),
        schedules: cloud ? (store.globalSchedules || {}) : read(SCHEDULE_KEY, {}),
        lessons: cloud ? (store.globalLessons || {}) : read(DERS_KAYITLARI_KEY, {}),
        groups: cloud ? (store.globalGroups || []) : read(GROUPS_KEY, []),
        resourceBooks: cloud ? (store.globalResourceBooks || []) : read('resource_books_v1', []),
        reminderSettings: read('lesson_reminder_settings_v1', {}),
        reminderHistory: read('lesson_reminder_history_v1', {})
    };
}

async function deleteMissingCloudDocuments(collection, keepIds, userId) {
    const snapshot = await window.db.collection(collection).where('userId', '==', userId).get();
    const removable = snapshot.docs.filter(doc => !keepIds.has(doc.id));
    for (let offset = 0; offset < removable.length; offset += 400) {
        const batch = window.db.batch();
        removable.slice(offset, offset + 400).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
}

async function restoreCloud(data, mode) {
    const user = window.auth?.currentUser;
    if (!user || !user.emailVerified) throw new Error('Doğrulanmış bulut hesabı bulunamadı.');

    const documents = {
        students: data.students.map(item => ({ id: item.id, value: { ...item, userId: user.uid, odevler: undefined } })),
        homeworks: data.homeworks.map(item => ({ id: item.id, value: { ...item, userId: user.uid } })),
        schedules: Object.entries(data.schedules).map(([studentId, lessons]) => ({ id: studentId, value: { studentId, lessons, userId: user.uid } })),
        lessons: Object.entries(data.lessons).map(([studentId, kayitlar]) => ({ id: studentId, value: { studentId, kayitlar, userId: user.uid } })),
        groups: data.groups.map(item => ({ id: item.id, value: { ...item, userId: user.uid } })),
        resourceBooks: data.resourceBooks.map(item => ({ id: `${user.uid}_${item.id}`, value: { ...item, userId: user.uid } }))
    };
    documents.students.forEach(record => delete record.value.odevler);

    for (const collection of CLOUD_COLLECTIONS) {
        const records = documents[collection];
        for (let offset = 0; offset < records.length; offset += 400) {
            const batch = window.db.batch();
            records.slice(offset, offset + 400).forEach(record => batch.set(window.db.collection(collection).doc(record.id), record.value));
            await batch.commit();
        }
        if (mode === 'replace') await deleteMissingCloudDocuments(collection, new Set(records.map(record => record.id)), user.uid);
    }

    await window.db.collection('users').doc(user.uid).set({
        name: data.teacherProfile.name || '',
        school: data.teacherProfile.school || '',
        branches: Array.isArray(data.teacherProfile.branches) ? data.teacherProfile.branches : []
    }, { merge: true });
}

function restoreLocal(data) {
    const homeworksByStudent = new Map();
    data.homeworks.forEach(homework => {
        const list = homeworksByStudent.get(homework.studentId) || [];
        list.push(homework);
        homeworksByStudent.set(homework.studentId, list);
    });
    const students = data.students.map(student => ({ ...student, odevler: homeworksByStudent.get(student.id) || [] }));
    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify(students));
    localStorage.setItem(localDataKey(SCHEDULE_KEY), JSON.stringify(data.schedules));
    localStorage.setItem(localDataKey(DERS_KAYITLARI_KEY), JSON.stringify(data.lessons));
    localStorage.setItem(localDataKey(GROUPS_KEY), JSON.stringify(data.groups));
    localStorage.setItem(localDataKey('resource_books_v1'), JSON.stringify(data.resourceBooks));
    localStorage.setItem(localDataKey('lesson_reminder_settings_v1'), JSON.stringify(data.reminderSettings));
    localStorage.setItem(localDataKey('lesson_reminder_history_v1'), JSON.stringify(data.reminderHistory));
    localStorage.setItem(localDataKey('teacher_name_v1'), data.teacherProfile.name || '');
    localStorage.setItem(localDataKey('teacher_school_v1'), data.teacherProfile.school || '');
    localStorage.setItem(localDataKey('teacher_branches_v1'), JSON.stringify(data.teacherProfile.branches || []));
}

export async function restoreFullBackup(backup, mode) {
    const validation = validateFullBackup(backup);
    if (!validation.ok) throw new Error(validation.error);
    const merged = combineRestoreData(currentData(), backup.data, mode);
    if (store.useFirestore && window.isFirebaseActive && !store.isGuestMode) await restoreCloud(merged, mode);
    else restoreLocal(merged);
    return merged;
}

window.restoreFullBackup = restoreFullBackup;

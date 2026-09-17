import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Setup Mock Environment before importing application modules
const localStorageStore = new Map();
global.localStorage = {
    getItem: (key) => localStorageStore.get(key) || null,
    setItem: (key, val) => localStorageStore.set(key, String(val)),
    removeItem: (key) => localStorageStore.delete(key),
    clear: () => localStorageStore.clear()
};

const mockElement = {
    innerHTML: '',
    innerText: '',
    value: '',
    style: {},
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    removeAttribute: () => {},
    setAttribute: () => {},
    appendChild: () => {},
    addEventListener: () => {},
    removeEventListener: () => {}
};

global.document = {
    getElementById: () => mockElement,
    querySelector: () => mockElement,
    querySelectorAll: () => [mockElement],
    createElement: () => mockElement
};

global.window = {
    isFirebaseActive: false,
    confirm: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    renderHomeScreen: () => {},
    showSyncStatus: () => {},
    document: global.document,
    localStorage: global.localStorage
};

global.confirm = () => true;

const { store, STORAGE_KEY, SCHEDULE_KEY, DERS_KAYITLARI_KEY, GROUPS_KEY, localDataKey, loadSchedule, loadDersKayitlari, loadGroupsData, loadStudentsData } = await import('../store.js');
const { deleteStudent } = await import('../students.js');

function resetTestData() {
    localStorageStore.clear();
    store.useFirestore = false;
    store.isGuestMode = false;
    store.globalStudents = [];
    store.globalSchedules = {};
    store.globalLessons = {};
    store.globalGroups = [];
    window.isFirebaseActive = false;
    window.db = null;
}

test('1. Target student is removed while unrelated student remains intact', async () => {
    resetTestData();
    const studentA = { id: 's-A', adSoyad: 'Student A', sinif: '8' };
    const studentB = { id: 's-B', adSoyad: 'Student B', sinif: '8' };

    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([studentA, studentB]));

    await deleteStudent('s-A');

    const remainingStudents = loadStudentsData();
    assert.equal(remainingStudents.length, 1);
    assert.equal(remainingStudents[0].id, 's-B');
    assert.equal(remainingStudents[0].adSoyad, 'Student B');
});

test('2. Schedule entries for deleted student are removed while unrelated schedules are preserved', async () => {
    resetTestData();
    const studentA = { id: 's-A', adSoyad: 'Student A', sinif: '8' };
    const studentB = { id: 's-B', adSoyad: 'Student B', sinif: '8' };

    const studentBSchedule = [
        { gun: 'Çarşamba', saat: '11:00', dersAdi: 'Türkçe' }
    ];

    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([studentA, studentB]));
    localStorage.setItem(localDataKey(SCHEDULE_KEY), JSON.stringify({
        's-A': [
            { gun: 'Pazartesi', saat: '10:00', dersAdi: 'Fen' },
            { gun: 'Salı', saat: '14:00', dersAdi: 'Matematik' }
        ],
        's-B': studentBSchedule
    }));

    await deleteStudent('s-A');

    const rawSched = JSON.parse(localStorage.getItem(localDataKey(SCHEDULE_KEY)));
    assert.equal('s-A' in rawSched, false, 'Student A schedule must be deleted');
    assert.equal('s-B' in rawSched, true, 'Student B schedule must be preserved');
    assert.deepEqual(rawSched['s-B'], studentBSchedule, 'Student B schedule entry must match original fixture exactly');

    // Also check helper loadSchedule
    assert.deepEqual(loadSchedule('s-A'), []);
    assert.deepEqual(loadSchedule('s-B'), studentBSchedule);

    // Global in-memory consistency
    assert.equal('s-A' in (store.globalSchedules || {}), false, 'Global memory must not have student A schedule');
    assert.deepEqual(store.globalSchedules['s-B'], studentBSchedule, 'Global memory must preserve student B schedule');
});

test('3. Lesson records for deleted student are removed while unrelated lessons are preserved', async () => {
    resetTestData();
    const studentA = { id: 's-A', adSoyad: 'Student A', sinif: '8' };
    const studentB = { id: 's-B', adSoyad: 'Student B', sinif: '8' };

    const studentBLesson = {
        tarih: '2026-09-02',
        saat: '11:00',
        konu: 'Doğal Sayılar',
        katilimDurumu: 'yapildi',
        odendi: false
    };

    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([studentA, studentB]));
    localStorage.setItem(localDataKey(DERS_KAYITLARI_KEY), JSON.stringify({
        's-A': [
            { tarih: '2026-09-01', saat: '10:00', konu: 'Hücre', katilimDurumu: 'yapildi', odendi: true }
        ],
        's-B': [studentBLesson]
    }));

    await deleteStudent('s-A');

    const rawLessons = JSON.parse(localStorage.getItem(localDataKey(DERS_KAYITLARI_KEY)));
    assert.equal('s-A' in rawLessons, false, 'Student A lesson records must be deleted');
    assert.equal('s-B' in rawLessons, true, 'Student B lesson records must be preserved');
    assert.equal(rawLessons['s-B'].length, 1);
    assert.equal(rawLessons['s-B'][0].konu, 'Doğal Sayılar');
    assert.equal(rawLessons['s-B'][0].tarih, '2026-09-02');
    assert.equal(rawLessons['s-B'][0].saat, '11:00');
    assert.equal(rawLessons['s-B'][0].katilimDurumu, 'yapildi');
    assert.equal(rawLessons['s-B'][0].odendi, false);
    assert.deepEqual(rawLessons['s-B'][0], studentBLesson, 'Student B lesson record must deepEqual the original fixture');

    assert.deepEqual(loadDersKayitlari('s-A'), []);
    assert.deepEqual(loadDersKayitlari('s-B'), [studentBLesson]);

    // Global in-memory consistency
    assert.equal('s-A' in (store.globalLessons || {}), false, 'Global memory must not have student A lessons');
    assert.deepEqual(store.globalLessons['s-B'], [studentBLesson], 'Global memory must preserve student B lessons');
});

test('4. Group memberships are cleaned up without deleting groups', async () => {
    resetTestData();
    const studentA = { id: 's-A', adSoyad: 'Student A', sinif: '8' };
    const studentB = { id: 's-B', adSoyad: 'Student B', sinif: '8' };

    const originalGroup2 = { id: 'g-2', ad: '7. Sınıflar', studentIds: ['s-B'] };

    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([studentA, studentB]));
    localStorage.setItem(localDataKey(GROUPS_KEY), JSON.stringify([
        { id: 'g-1', ad: 'LGS Kampı', studentIds: ['s-A', 's-B'] },
        originalGroup2,
        { id: 'g-3', ad: 'Özel Grup', studentIds: ['s-A'] }
    ]));

    await deleteStudent('s-A');

    const groups = loadGroupsData();
    assert.equal(groups.length, 3, 'No groups should be deleted');
    assert.deepEqual(groups[0].studentIds, ['s-B'], 'Group 1 should now contain only s-B');
    assert.deepEqual(groups[1], originalGroup2, 'Group 2 = [B] remains completely unchanged and deepEquals fixture');
    assert.deepEqual(groups[2].studentIds, [], 'Group 3 should be empty array instead of deleted');

    // Global in-memory consistency
    assert.ok(Array.isArray(store.globalGroups), 'store.globalGroups must be an array');
    assert.equal(store.globalGroups.length, 3);
    assert.deepEqual(store.globalGroups[1], originalGroup2);
    assert.deepEqual(store.globalGroups[2].studentIds, []);
});

test('5. Multiple references across schedule, lessons, and groups are cleaned completely', async () => {
    resetTestData();
    const studentA = { id: 's-A', adSoyad: 'Student A', sinif: '8' };
    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([studentA]));
    localStorage.setItem(localDataKey(SCHEDULE_KEY), JSON.stringify({
        's-A': [{ gun: 'Pzt', saat: '1' }, { gun: 'Salı', saat: '2' }, { gun: 'Çrş', saat: '3' }]
    }));
    localStorage.setItem(localDataKey(DERS_KAYITLARI_KEY), JSON.stringify({
        's-A': [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }]
    }));
    localStorage.setItem(localDataKey(GROUPS_KEY), JSON.stringify([
        { id: 'g-1', studentIds: ['s-A'] },
        { id: 'g-2', studentIds: ['s-A'] }
    ]));

    await deleteStudent('s-A');

    const sched = JSON.parse(localStorage.getItem(localDataKey(SCHEDULE_KEY)));
    const lessons = JSON.parse(localStorage.getItem(localDataKey(DERS_KAYITLARI_KEY)));
    const groups = loadGroupsData();

    assert.equal('s-A' in sched, false);
    assert.equal('s-A' in lessons, false);
    assert.deepEqual(groups[0].studentIds, []);
    assert.deepEqual(groups[1].studentIds, []);

    // Global in-memory consistency
    assert.equal('s-A' in (store.globalSchedules || {}), false);
    assert.equal('s-A' in (store.globalLessons || {}), false);
    assert.deepEqual(store.globalGroups[0].studentIds, []);
    assert.deepEqual(store.globalGroups[1].studentIds, []);
});

test('6. Student deletion succeeds when no related records exist (no crash)', async () => {
    resetTestData();
    const studentA = { id: 's-A', adSoyad: 'Student A', sinif: '8' };
    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([studentA]));

    await deleteStudent('s-A');

    assert.equal(loadStudentsData().length, 0);
});

test('7. Unrelated localStorage keys are strictly preserved', async () => {
    resetTestData();
    const studentA = { id: 's-A', adSoyad: 'Student A', sinif: '8' };
    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([studentA]));
    localStorage.setItem('unrelated_config_key', JSON.stringify({ token: 'abc', count: 42 }));
    localStorage.setItem('teacher_name_v1', 'Murat Öğretmen');

    await deleteStudent('s-A');

    assert.equal(localStorage.getItem('unrelated_config_key'), JSON.stringify({ token: 'abc', count: 42 }));
    assert.equal(localStorage.getItem('teacher_name_v1'), 'Murat Öğretmen');
});

test('8. Malformed optional related data is handled gracefully without destroying storage', async () => {
    resetTestData();
    const studentA = { id: 's-A', adSoyad: 'Student A', sinif: '8' };
    const studentB = { id: 's-B', adSoyad: 'Student B', sinif: '8' };
    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([studentA, studentB]));
    // Corrupt schedule JSON intentionally
    localStorage.setItem(localDataKey(SCHEDULE_KEY), '{ broken json ');
    // Valid lessons and groups to prove independent cleanup proceeds
    localStorage.setItem(localDataKey(DERS_KAYITLARI_KEY), JSON.stringify({
        's-A': [{ id: 'lesson-a' }],
        's-B': [{ id: 'lesson-b' }]
    }));
    localStorage.setItem(localDataKey(GROUPS_KEY), JSON.stringify([
        { id: 'g-1', studentIds: ['s-A', 's-B'] }
    ]));
    localStorage.setItem('unrelated_setting', 'keep-me');

    await deleteStudent('s-A');

    // Students must still be updated safely
    const remaining = loadStudentsData();
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, 's-B');
    // Corrupt schedule was NOT destroyed or overwritten with {}
    assert.equal(localStorage.getItem(localDataKey(SCHEDULE_KEY)), '{ broken json ');
    // Valid lesson records and groups cleanup still proceeded independently
    const lessons = JSON.parse(localStorage.getItem(localDataKey(DERS_KAYITLARI_KEY)));
    assert.equal('s-A' in lessons, false, 'Lesson cleanup must proceed even if schedule is malformed');
    assert.equal('s-B' in lessons, true);
    const groups = loadGroupsData();
    assert.deepEqual(groups[0].studentIds, ['s-B'], 'Group cleanup must proceed even if schedule is malformed');
    // Unrelated localStorage keys untouched
    assert.equal(localStorage.getItem('unrelated_setting'), 'keep-me');
});

test('9. Guest mode correctly applies guest prefix to all cleaned keys and isolates global memory', async () => {
    resetTestData();
    store.isGuestMode = true;

    const studentA = { id: 'guest-A', adSoyad: 'Guest A', sinif: '7' };
    const guestStorageKey = localDataKey(STORAGE_KEY);
    const guestSchedKey = localDataKey(SCHEDULE_KEY);
    const guestLessonsKey = localDataKey(DERS_KAYITLARI_KEY);
    const guestGroupsKey = localDataKey(GROUPS_KEY);

    assert.ok(guestStorageKey.startsWith('canfenci_guest_v1__'));
    assert.ok(guestSchedKey.startsWith('canfenci_guest_v1__'));
    assert.ok(guestLessonsKey.startsWith('canfenci_guest_v1__'));
    assert.ok(guestGroupsKey.startsWith('canfenci_guest_v1__'));

    // Seed non-guest storage to verify isolation
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'non-guest-s', adSoyad: 'Normal Student' }]));
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify({ 'non-guest-s': [{ gun: 'Pzt' }] }));
    localStorage.setItem(DERS_KAYITLARI_KEY, JSON.stringify({ 'non-guest-s': [{ id: 'ng-1' }] }));
    localStorage.setItem(GROUPS_KEY, JSON.stringify([{ id: 'ng-g', studentIds: ['non-guest-s'] }]));

    localStorage.setItem(guestStorageKey, JSON.stringify([studentA]));
    localStorage.setItem(guestSchedKey, JSON.stringify({ 'guest-A': [{ gun: 'Cuma' }] }));
    localStorage.setItem(guestLessonsKey, JSON.stringify({ 'guest-A': [{ id: '1' }] }));
    localStorage.setItem(guestGroupsKey, JSON.stringify([{ id: 'g-g', studentIds: ['guest-A'] }]));

    await deleteStudent('guest-A');

    // Guest-prefixed storage cleaned
    const rawSched = JSON.parse(localStorage.getItem(guestSchedKey));
    const rawLessons = JSON.parse(localStorage.getItem(guestLessonsKey));
    const rawGroups = JSON.parse(localStorage.getItem(guestGroupsKey));

    assert.equal('guest-A' in rawSched, false);
    assert.equal('guest-A' in rawLessons, false);
    assert.deepEqual(rawGroups[0].studentIds, []);

    // Non-guest storage keys completely untouched
    assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEY)).length, 1);
    assert.equal('non-guest-s' in JSON.parse(localStorage.getItem(SCHEDULE_KEY)), true);
    assert.equal('non-guest-s' in JSON.parse(localStorage.getItem(DERS_KAYITLARI_KEY)), true);
    assert.deepEqual(JSON.parse(localStorage.getItem(GROUPS_KEY))[0].studentIds, ['non-guest-s']);

    // Global in-memory structures cleaned
    assert.equal('guest-A' in (store.globalSchedules || {}), false);
    assert.equal('guest-A' in (store.globalLessons || {}), false);
});

test('10. Cloud mode regression: deleteStudent routes to Firestore batch without touching localStorage keys', async () => {
    resetTestData();
    store.useFirestore = true;
    window.isFirebaseActive = true;

    let batchCommitCalled = false;
    const deletedDocs = [];

    window.auth = { currentUser: { uid: 'teacher_123' } };
    window.db = {
        batch: () => ({
            delete: (docRef) => deletedDocs.push(docRef.path),
            update: () => {},
            commit: async () => { batchCommitCalled = true; }
        }),
        collection: (name) => ({
            doc: (docId) => ({ path: `${name}/${docId}` }),
            where: () => ({
                where: () => ({
                    get: async () => []
                })
            })
        })
    };

    store.globalStudents = [{ id: 'cloud-s1', adSoyad: 'Cloud Student' }];

    // Seed sentinel local values
    const sentinelSched = JSON.stringify({ sentinel: 'schedule_data_must_not_change' });
    const sentinelLessons = JSON.stringify({ sentinel: 'lesson_data_must_not_change' });
    const sentinelGroups = JSON.stringify([{ id: 'sentinel_group', studentIds: ['cloud-s1'] }]);

    localStorage.setItem(localDataKey(SCHEDULE_KEY), sentinelSched);
    localStorage.setItem(localDataKey(DERS_KAYITLARI_KEY), sentinelLessons);
    localStorage.setItem(localDataKey(GROUPS_KEY), sentinelGroups);

    await deleteStudent('cloud-s1');

    assert.equal(batchCommitCalled, true, 'Cloud deletion must commit Firestore batch');
    assert.ok(deletedDocs.includes('students/cloud-s1'), 'Must delete student doc from Firestore');

    // Assert sentinel local values remain byte-identical
    assert.equal(localStorage.getItem(localDataKey(SCHEDULE_KEY)), sentinelSched, 'Cloud delete must not touch local schedule');
    assert.equal(localStorage.getItem(localDataKey(DERS_KAYITLARI_KEY)), sentinelLessons, 'Cloud delete must not touch local lesson records');
    assert.equal(localStorage.getItem(localDataKey(GROUPS_KEY)), sentinelGroups, 'Cloud delete must not touch local groups');
});

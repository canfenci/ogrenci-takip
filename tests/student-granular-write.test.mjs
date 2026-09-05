import test from 'node:test';
import assert from 'node:assert/strict';

import {
    store,
    PROFILE_SCALAR_FIELDS,
    sanitizeProfilePatch,
    createStudentDocument,
    updateStudentProfile,
    STORAGE_KEY,
    localDataKey
} from '../store.js';

function setupMockEnvironment(options = {}) {
    const {
        useFirestore = true,
        isFirebaseActive = true,
        isGuestMode = false,
        onLine = true,
        userId = 'test_teacher_123',
        updateBehavior = () => Promise.resolve(),
        setBehavior = () => Promise.resolve()
    } = options;

    const syncStatusCalls = [];
    const firebaseErrors = [];
    const docUpdates = [];
    const docSets = [];
    const localStorageStore = new Map();

    const mockWindow = {
        isFirebaseActive,
        auth: { currentUser: userId ? { uid: userId } : null },
        showSyncStatus: (msg, isErr) => {
            syncStatusCalls.push({ msg, isErr, timestamp: Date.now() });
        },
        handleFirebaseError: (err) => {
            firebaseErrors.push(err);
        },
        db: {
            collection: (collName) => ({
                doc: (docId) => ({
                    set: (data) => {
                        const callInfo = { collName, docId, data };
                        docSets.push(callInfo);
                        return setBehavior(callInfo);
                    },
                    update: (patch) => {
                        const callInfo = { collName, docId, patch };
                        docUpdates.push(callInfo);
                        return updateBehavior(callInfo);
                    }
                })
            })
        }
    };

    const mockLocalStorage = {
        getItem: (key) => localStorageStore.get(key) || null,
        setItem: (key, val) => localStorageStore.set(key, String(val)),
        removeItem: (key) => localStorageStore.delete(key),
        clear: () => localStorageStore.clear()
    };

    globalThis.window = mockWindow;
    try {
        Object.defineProperty(globalThis.navigator, 'onLine', {
            value: onLine,
            configurable: true,
            writable: true
        });
    } catch {
        // Continue if navigator not configurable
    }
    globalThis.localStorage = mockLocalStorage;

    store.useFirestore = useFirestore;
    store.isGuestMode = isGuestMode;
    store.globalStudents = [];

    return {
        syncStatusCalls,
        firebaseErrors,
        docUpdates,
        docSets,
        localStorageStore,
        mockWindow
    };
}

test('TECH-04.2 Scenario A: Profile update writes exactly one document', async () => {
    const { docUpdates, docSets } = setupMockEnvironment();
    store.globalStudents = [
        { id: 's1', adSoyad: 'Ali Kaya', veliTel: '05551112233' },
        { id: 's2', adSoyad: 'Veli Can', veliTel: '05554445566' }
    ];

    const result = await updateStudentProfile('s1', { veliTel: '05559998877' });

    assert.equal(result.ok, true);
    assert.equal(result.writeCount, 1);
    assert.equal(docSets.length, 0, 'No .set() calls made');
    assert.equal(docUpdates.length, 1, 'Exactly one .update() call made');
    assert.equal(docUpdates[0].docId, 's1');
});

test('TECH-04.2 Scenario B: Profile update writes only whitelisted changed fields', async () => {
    const { docUpdates } = setupMockEnvironment();
    store.globalStudents = [{ id: 's1', adSoyad: 'Ali', veliTel: '111', okul: 'Okul A' }];

    await updateStudentProfile('s1', {
        veliTel: '222',
        okul: 'Okul B'
    });

    assert.equal(docUpdates.length, 1);
    const sentKeys = Object.keys(docUpdates[0].patch);
    assert.deepEqual(sentKeys.sort(), ['okul', 'veliTel'].sort());
    assert.equal(docUpdates[0].patch.veliTel, '222');
    assert.equal(docUpdates[0].patch.okul, 'Okul B');
    assert.equal('adSoyad' in docUpdates[0].patch, false, 'Unchanged field not sent');
});

test('TECH-04.2 Scenario C: Remote nested records survive stale profile update (Unrelated Field Safe)', async () => {
    // Simulated remote Firestore document containing nested entities
    const remoteDoc = {
        id: 's1',
        adSoyad: 'Ali Kaya',
        veliTel: '05551112233',
        denemeler: [{ id: 'exam-1', denemeAdi: 'LGS Prova 1', toplamNet: 82 }],
        guidanceRecords: [{ id: 'gr-1', issue: 'Motivasyon', status: 'open' }],
        growthPlan: { weeklyTarget: 500, logs: [{ count: 100 }] }
    };

    const { docUpdates } = setupMockEnvironment({
        updateBehavior: (callInfo) => {
            // Firestore applying the granular patch to the remote document
            Object.assign(remoteDoc, callInfo.patch);
            return Promise.resolve();
        }
    });

    // Stale client in Tab B (doesn't even have exams in local view) updates only veliTel
    await updateStudentProfile('s1', { veliTel: '05559998877' });

    // Remote document verification
    assert.equal(remoteDoc.veliTel, '05559998877', 'Profile field updated');
    assert.equal(remoteDoc.denemeler.length, 1, 'Exams preserved');
    assert.equal(remoteDoc.denemeler[0].id, 'exam-1', 'exam-1 completely intact');
    assert.equal(remoteDoc.guidanceRecords.length, 1, 'Guidance records preserved');
    assert.equal(remoteDoc.growthPlan.weeklyTarget, 500, 'Growth plan preserved');
});

test('TECH-04.2 Scenario D: Create writes exactly one new student document', async () => {
    const { docSets, docUpdates } = setupMockEnvironment();
    store.globalStudents = [
        { id: 's1', adSoyad: 'Ali' },
        { id: 's2', adSoyad: 'Ayşe' }
    ];

    const newStudent = {
        id: 's3',
        adSoyad: 'Mehmet Demir',
        sinif: '8',
        okul: 'Cumhuriyet OO',
        hedefLise: 'Fen Lisesi',
        hedefNet: '85',
        dersUcreti: '600',
        veliTel: '05550001122',
        denemeler: [],
        studyPlan: {},
        errorResets: {},
        growthPlan: {}
    };

    const result = await createStudentDocument(newStudent);

    assert.equal(result.ok, true);
    assert.equal(result.writeCount, 1);
    assert.equal(docUpdates.length, 0, 'No .update() calls made');
    assert.equal(docSets.length, 1, 'Exactly one .set() call made');
    assert.equal(docSets[0].docId, 's3');
    assert.equal(docSets[0].data.adSoyad, 'Mehmet Demir');
    assert.equal(docSets[0].data.userId, 'test_teacher_123');
    assert.equal(store.globalStudents.length, 3, 'Appended to globalStudents in memory');
});

test('TECH-04.2 Scenario E: Empty patch is safe no-op', async () => {
    const { docUpdates, docSets, syncStatusCalls } = setupMockEnvironment();

    const result = await updateStudentProfile('s1', {});

    assert.equal(result.ok, true);
    assert.equal(result.noop, true);
    assert.equal(result.writeCount, 0);
    assert.equal(docUpdates.length, 0, 'Zero writes dispatched');
    assert.equal(docSets.length, 0);
    assert.equal(syncStatusCalls.length, 0, 'No fake sync status displayed');
});

test('TECH-04.2 Scenario F: Nested and ownership fields are rejected from profile patch', () => {
    const dirtyPatch = {
        adSoyad: 'Valid Name',
        veliTel: '05551112233',
        denemeler: [{ id: 'malicious-exam' }],
        guidanceRecords: [{ id: 'fake-gr' }],
        growthPlan: { hack: true },
        studyPlan: { test: true },
        userId: 'hacker-user-id',
        id: 'other-student-id',
        odevler: [{ id: 'homework' }]
    };

    const sanitized = sanitizeProfilePatch(dirtyPatch);

    assert.deepEqual(Object.keys(sanitized).sort(), ['adSoyad', 'veliTel'].sort());
    assert.equal(sanitized.adSoyad, 'Valid Name');
    assert.equal(sanitized.veliTel, '05551112233');
    assert.equal('denemeler' in sanitized, false);
    assert.equal('guidanceRecords' in sanitized, false);
    assert.equal('growthPlan' in sanitized, false);
    assert.equal('studyPlan' in sanitized, false);
    assert.equal('userId' in sanitized, false);
    assert.equal('id' in sanitized, false);
    assert.equal('odevler' in sanitized, false);
});

test('TECH-04.2 Scenario G: Guest mode behavior preserved', async () => {
    const { docUpdates, docSets, localStorageStore } = setupMockEnvironment({
        useFirestore: false,
        isGuestMode: true
    });

    store.globalStudents = [{ id: 's1', adSoyad: 'Guest Ali', veliTel: '111' }];
    localStorageStore.set(localDataKey(STORAGE_KEY), JSON.stringify(store.globalStudents));

    const result = await updateStudentProfile('s1', { veliTel: '999' });

    assert.equal(result.ok, true);
    assert.equal(result.mode, 'local');
    assert.equal(docUpdates.length, 0, 'No cloud updates');
    assert.equal(docSets.length, 0, 'No cloud sets');

    // In-memory and localStorage verified
    assert.equal(store.globalStudents[0].veliTel, '999');
    const stored = JSON.parse(localStorageStore.get(localDataKey(STORAGE_KEY)));
    assert.equal(stored[0].veliTel, '999');
});

test('TECH-04.2 Scenario H: Offline write dispatch + queued semantics preserved', async () => {
    let updateDispatched = false;
    const { syncStatusCalls, docUpdates } = setupMockEnvironment({
        onLine: false,
        updateBehavior: () => {
            updateDispatched = true;
            return new Promise(() => {}); // Remains pending in offline mode
        }
    });

    const result = await updateStudentProfile('s1', { veliTel: '05557778899' });

    assert.equal(updateDispatched, true, 'Write was dispatched to Firestore offline queue');
    assert.equal(docUpdates.length, 1);
    assert.equal(result.ok, true);
    assert.equal(result.queued, true);

    const queuedStatus = syncStatusCalls.find(c => c.msg.includes('Çevrimdışı'));
    assert.ok(queuedStatus, 'Offline queued message shown to user');
    assert.equal(queuedStatus.isErr, false);
});

test('TECH-04.2 Scenario I: Online success only after SERVER ACK', async () => {
    let resolveWrite;
    const pendingPromise = new Promise(resolve => {
        resolveWrite = resolve;
    });

    const { syncStatusCalls } = setupMockEnvironment({
        onLine: true,
        updateBehavior: () => pendingPromise
    });

    const updateTask = updateStudentProfile('s1', { veliTel: '05553332211' });

    // While in flight
    assert.ok(syncStatusCalls.some(c => c.msg.includes('Buluta kaydediliyor...')));
    assert.equal(syncStatusCalls.some(c => c.msg.includes('Buluta kaydedildi')), false, 'Not acknowledged yet');

    // Server acknowledges
    resolveWrite();
    const result = await updateTask;

    assert.equal(result.ok, true);
    assert.ok(syncStatusCalls.some(c => c.msg.includes('Buluta kaydedildi')), 'Acknowledged after server ack');
});

test('TECH-04.2 Scenario J: Same scalar conflict documented as EXPECTED LAST-WRITE-WINS', async () => {
    let serverValue = 'initial_phone';

    const { docUpdates } = setupMockEnvironment({
        updateBehavior: (callInfo) => {
            serverValue = callInfo.patch.veliTel;
            return Promise.resolve();
        }
    });

    // Tab A writes phone A
    await updateStudentProfile('s1', { veliTel: 'phone_from_tab_A' });
    assert.equal(serverValue, 'phone_from_tab_A');

    // Tab B concurrently writes phone B
    await updateStudentProfile('s1', { veliTel: 'phone_from_tab_B' });
    assert.equal(serverValue, 'phone_from_tab_B', 'Expected Last-Write-Wins policy for identical scalar field');
});

test('TECH-04.2 Write Amplification Fixture: 50 students, 1 phone update', async () => {
    const { docUpdates, docSets } = setupMockEnvironment();
    store.globalStudents = Array.from({ length: 50 }, (_, i) => ({
        id: `s_${i + 1}`,
        adSoyad: `Student ${i + 1}`,
        veliTel: '05550000000'
    }));

    await updateStudentProfile('s_1', { veliTel: '05559999999' });

    assert.equal(docSets.length, 0, '0 full documents overwritten');
    assert.equal(docUpdates.length, 1, 'Exactly 1 document updated');
    assert.equal(Object.keys(docUpdates[0].patch).length, 1, 'Exactly 1 field sent (0 write amplification)');
});

test('TECH-04.2 Create Amplification Fixture: 50 students, 1 create', async () => {
    const { docSets, docUpdates } = setupMockEnvironment();
    store.globalStudents = Array.from({ length: 50 }, (_, i) => ({
        id: `s_${i + 1}`,
        adSoyad: `Student ${i + 1}`
    }));

    await createStudentDocument({
        id: 's_51',
        adSoyad: 'New Student 51'
    });

    assert.equal(docUpdates.length, 0, '0 existing documents touched');
    assert.equal(docSets.length, 1, 'Exactly 1 new document created');
    assert.equal(docSets[0].docId, 's_51');
});

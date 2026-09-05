import test from 'node:test';
import assert from 'node:assert/strict';

import {
    store,
    saveStudentsData,
    buildStudentDocData,
    resolveSyncStatusMessage,
    STORAGE_KEY,
    localDataKey
} from '../store.js';

function setupMockEnvironment(options = {}) {
    const {
        useFirestore = true,
        isFirebaseActive = true,
        onLine = true,
        userId = 'test_teacher_123',
        setBehavior = () => Promise.resolve()
    } = options;

    const syncStatusCalls = [];
    const firebaseErrors = [];
    const docWrites = [];
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
                        docWrites.push(callInfo);
                        return setBehavior(callInfo);
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
        // In case navigator is not defined or configured differently
    }
    globalThis.localStorage = mockLocalStorage;

    store.useFirestore = useFirestore;
    store.globalStudents = [];

    return {
        syncStatusCalls,
        firebaseErrors,
        docWrites,
        localStorageStore,
        mockWindow
    };
}

test('TECH-03 Scenario A: Pending writes must NOT fire success status early', async () => {
    let pendingResolver;
    const pendingPromise = new Promise((resolve) => {
        pendingResolver = resolve;
    });

    const env = setupMockEnvironment({
        setBehavior: () => pendingPromise
    });

    const students = [
        { id: 's1', adSoyad: 'Ali Veli' },
        { id: 's2', adSoyad: 'Ayşe Yılmaz' }
    ];

    // Start saving - returns a promise
    const savePromise = saveStudentsData(students);

    // At this moment, writes are still pending on the network
    assert.equal(env.docWrites.length, 2, 'Writes should be initiated');
    
    // Check that no premature success status has been shown
    const prematureSuccess = env.syncStatusCalls.some(c => 
        c.msg.includes('Bulut senkronize edildi') || c.msg.includes('Buluta kaydedildi')
    );
    assert.equal(prematureSuccess, false, 'Success status must NOT fire before writes resolve');

    // Clean up pending promise
    pendingResolver();
    await savePromise;
});

test('TECH-03 Scenario B: All writes resolve -> success status fires after resolution', async () => {
    let resolvedCount = 0;
    const resolvers = [];

    const env = setupMockEnvironment({
        setBehavior: () => new Promise((resolve) => {
            resolvers.push(() => {
                resolvedCount++;
                resolve();
            });
        })
    });

    const students = [
        { id: 's1', adSoyad: 'Ali' },
        { id: 's2', adSoyad: 'Veli' },
        { id: 's3', adSoyad: 'Ayşe' }
    ];

    const savePromise = saveStudentsData(students);

    // Check before resolution
    assert.equal(resolvedCount, 0);
    assert.equal(env.syncStatusCalls.filter(c => c.msg.includes('Buluta kaydedildi')).length, 0);

    // Resolve all writes
    resolvers.forEach(r => r());
    const result = await savePromise;

    // Verify after resolution
    assert.equal(resolvedCount, 3);
    assert.equal(result.ok, true);
    assert.equal(result.mode, 'firestore');
    assert.equal(result.writeCount, 3);
    assert.equal(result.failedCount, 0);

    const successCalls = env.syncStatusCalls.filter(c => c.msg === '✅ Buluta kaydedildi' && !c.isErr);
    assert.equal(successCalls.length, 1, 'Exactly one success status should be fired upon resolution');
});

test('TECH-03 Scenario C: One write rejects -> no success message, failure/partial status shown', async () => {
    const env = setupMockEnvironment({
        setBehavior: ({ docId }) => {
            if (docId === 's2') {
                return Promise.reject(new Error('Permission denied on doc s2'));
            }
            return Promise.resolve();
        }
    });

    const students = [
        { id: 's1', adSoyad: 'Ali' },
        { id: 's2', adSoyad: 'Ayşe' },
        { id: 's3', adSoyad: 'Mehmet' }
    ];

    const result = await saveStudentsData(students);

    // Verify no success message was ever fired
    const hasSuccess = env.syncStatusCalls.some(c => c.msg.includes('Buluta kaydedildi') || c.msg.includes('senkronize edildi'));
    assert.equal(hasSuccess, false, 'No success message should be shown when a write fails');

    // Verify partial failure semantics
    assert.equal(result.ok, false);
    assert.equal(result.partial, true);
    assert.equal(result.writeCount, 2);
    assert.equal(result.failedCount, 1);

    // Verify error was handled and feedback provided
    assert.equal(env.firebaseErrors.length, 1);
    const partialNotice = env.syncStatusCalls.find(c => c.msg.includes('Kısmi kayıt') && c.isErr);
    assert.ok(partialNotice, 'Should display partial failure warning to user');
});

test('TECH-03 Scenario D: All writes fail -> failure status shown without success', async () => {
    const env = setupMockEnvironment({
        setBehavior: () => Promise.reject(new Error('Network unavailable'))
    });

    const students = [
        { id: 's1', adSoyad: 'Ali' },
        { id: 's2', adSoyad: 'Ayşe' }
    ];

    const result = await saveStudentsData(students);

    assert.equal(result.ok, false);
    assert.equal(result.writeCount, 0);
    assert.equal(result.failedCount, 2);

    const failureCalls = env.syncStatusCalls.filter(c => c.msg === '⚠️ Buluta kaydedilemedi' && c.isErr);
    assert.equal(failureCalls.length, 1, 'Should show failure status');
});

test('TECH-03 Scenario E: Guest / Local mode -> no Firestore write, saves to localStorage', async () => {
    const env = setupMockEnvironment({
        useFirestore: false
    });

    const students = [
        { id: 's1', adSoyad: 'Yerel Öğrenci 1' },
        { id: 's2', adSoyad: 'Yerel Öğrenci 2' }
    ];

    const result = await saveStudentsData(students);

    assert.equal(result.ok, true);
    assert.equal(result.mode, 'local');
    assert.equal(result.writeCount, 2);
    assert.equal(env.docWrites.length, 0, 'No Firestore writes in local mode');

    const key = localDataKey(STORAGE_KEY);
    const raw = env.localStorageStore.get(key);
    assert.ok(raw, 'Data must be saved in localStorage under localDataKey(STORAGE_KEY)');
    const parsed = JSON.parse(raw);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].adSoyad, 'Yerel Öğrenci 1');

    const localSaved = env.syncStatusCalls.filter(c => c.msg === '✅ Kaydedildi');
    assert.equal(localSaved.length, 1);
});

test('TECH-03 Scenario F: Empty students list -> safe no-op without fake cloud success', async () => {
    const env = setupMockEnvironment({
        useFirestore: true
    });

    const result = await saveStudentsData([]);

    assert.equal(result.ok, true);
    assert.equal(result.status, 'empty');
    assert.equal(result.writeCount, 0);
    assert.equal(env.docWrites.length, 0, 'No DB writes for empty list');

    const fakeSuccess = env.syncStatusCalls.some(c => c.msg.includes('Buluta kaydedildi') || c.msg.includes('senkronize edildi'));
    assert.equal(fakeSuccess, false, 'No fake success message should be shown for empty list');
});

test('TECH-03 Scenario G: Offline / Queued semantics informs user changes are queued', async () => {
    const env = setupMockEnvironment({
        onLine: false
    });

    const students = [
        { id: 's1', adSoyad: 'Ali' }
    ];

    const result = await saveStudentsData(students);

    assert.equal(result.ok, true);
    assert.equal(result.mode, 'firestore');
    assert.equal(result.queued, true);
    assert.equal(result.writeCount, 1);

    const queuedCall = env.syncStatusCalls.find(c => c.msg.includes('senkronizasyon için bekliyor') || c.msg.includes('Çevrimdışı'));
    assert.ok(queuedCall, 'Should notify user that writes are queued offline');
});

test('TECH-03 Scenario H: Concurrent save calls discard stale operation feedback', async () => {
    let resolveA;
    let resolveB;

    const env = setupMockEnvironment({
        setBehavior: ({ docId }) => {
            if (docId === 'sA') {
                return new Promise(r => { resolveA = r; });
            }
            if (docId === 'sB') {
                return new Promise(r => { resolveB = r; });
            }
            return Promise.resolve();
        }
    });

    // Call A starts first (slow)
    const promiseA = saveStudentsData([{ id: 'sA', adSoyad: 'Student A' }]);

    // Call B starts immediately after (fast)
    const promiseB = saveStudentsData([{ id: 'sB', adSoyad: 'Student B' }]);

    // Call B finishes first
    resolveB();
    const resultB = await promiseB;
    assert.equal(resultB.ok, true);
    assert.equal(resultB.stale, undefined);

    // Call A finishes later
    resolveA();
    const resultA = await promiseA;
    assert.equal(resultA.stale, true, 'Operation A should be marked stale and not overwrite newer state');

    // Confirm last success call was for current operation
    const successCalls = env.syncStatusCalls.filter(c => c.msg === '✅ Buluta kaydedildi');
    assert.equal(successCalls.length, 1, 'Only the latest active save operation should report final success');
});

test('TECH-03 Helper Tests: buildStudentDocData strips odevler and attaches userId', () => {
    const student = {
        id: 's1',
        adSoyad: 'Mehmet',
        sinif: '8',
        odevler: [{ id: 'hw1', konu: 'Basınç' }]
    };

    const doc = buildStudentDocData(student, 'uid_abc');
    assert.equal(doc.id, 's1');
    assert.equal(doc.adSoyad, 'Mehmet');
    assert.equal(doc.userId, 'uid_abc');
    assert.equal(doc.odevler, undefined, 'odevler must be stripped from student document');
});

test('TECH-03 Helper Tests: resolveSyncStatusMessage returns correct copies', () => {
    assert.deepEqual(resolveSyncStatusMessage({ ok: true, mode: 'local' }), { text: '✅ Kaydedildi', isError: false });
    assert.deepEqual(resolveSyncStatusMessage({ ok: true, mode: 'firestore' }), { text: '✅ Buluta kaydedildi', isError: false });
    assert.deepEqual(resolveSyncStatusMessage({ ok: true, mode: 'firestore', queued: true }), { text: '⏳ Çevrimdışı — değişiklikler senkronizasyon için bekliyor', isError: false });
    assert.deepEqual(resolveSyncStatusMessage({ ok: false, mode: 'firestore' }), { text: '⚠️ Buluta kaydedilemedi', isError: true });
    assert.deepEqual(resolveSyncStatusMessage({ ok: false, mode: 'firestore', partial: true, writeCount: 2, totalCount: 3 }), { text: '⚠️ Kısmi kayıt: 2/3 öğrenci kaydedildi', isError: true });
    assert.equal(resolveSyncStatusMessage({ status: 'empty' }), null);
});

test('TECH-03.1 Scenario I: Offline queued status requires actual Firestore writes to start', async () => {
    let writesDispatched = 0;
    const env = setupMockEnvironment({
        onLine: false,
        setBehavior: () => {
            writesDispatched++;
            return new Promise(() => {}); // pending in offline queue
        }
    });

    const students = [
        { id: 's1', adSoyad: 'Ali' },
        { id: 's2', adSoyad: 'Ayşe' }
    ];

    const result = await saveStudentsData(students);

    // Verify writes were actually started before returning
    assert.equal(writesDispatched, 2, 'Writes must actually be initiated');
    assert.equal(env.docWrites.length, 2);
    assert.equal(result.ok, true);
    assert.equal(result.queued, true);
    assert.equal(result.writeCount, 2);

    // Verify queued message is shown and no premature server success
    const hasQueued = env.syncStatusCalls.some(c => c.msg.includes('senkronizasyon için bekliyor'));
    const hasServerSuccess = env.syncStatusCalls.some(c => c.msg.includes('Buluta kaydedildi'));
    assert.equal(hasQueued, true, 'Must display queued status');
    assert.equal(hasServerSuccess, false, 'Must never claim server success while offline');
});

test('TECH-03.1 Scenario J: Offline background write rejection produces no unhandled rejection', async () => {
    let unhandledCount = 0;
    const rejecters = [];

    const onUnhandled = () => { unhandledCount++; };
    process.on('unhandledRejection', onUnhandled);

    try {
        const env = setupMockEnvironment({
            onLine: false,
            setBehavior: () => new Promise((_, reject) => {
                rejecters.push(reject);
            })
        });

        const students = [
            { id: 's1', adSoyad: 'Ali' },
            { id: 's2', adSoyad: 'Veli' }
        ];

        const result = await saveStudentsData(students);
        assert.equal(result.queued, true);

        // Later in background, server rejects the write (e.g. permission-denied)
        rejecters.forEach(r => r(new Error('permission-denied')));

        // Wait a turn for microtask rejections
        await new Promise(r => setTimeout(r, 50));

        assert.equal(unhandledCount, 0, 'No unhandled rejection must escape from background offline queue');
    } finally {
        process.removeListener('unhandledRejection', onUnhandled);
    }
});

test('TECH-03.1 Scenario K: Older online operation cannot overwrite newer offline queued status', async () => {
    let resolveA;
    const env = setupMockEnvironment({
        setBehavior: ({ docId }) => {
            if (docId === 'sA') {
                return new Promise(r => { resolveA = r; });
            }
            return Promise.resolve();
        }
    });

    // Operation A: Online starts and is delayed
    const promiseA = saveStudentsData([{ id: 'sA', adSoyad: 'Student A' }]);

    // Operation B: Goes offline, saves Student B
    Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true, writable: true });
    const resultB = await saveStudentsData([{ id: 'sB', adSoyad: 'Student B' }]);
    assert.equal(resultB.queued, true);

    // Later, Operation A resolves
    resolveA();
    const resultA = await promiseA;
    assert.equal(resultA.stale, true, 'Operation A must be recognized as stale');

    // Verify last status message is still Operation B's queued message
    const lastCall = env.syncStatusCalls[env.syncStatusCalls.length - 1];
    assert.ok(lastCall.msg.includes('senkronizasyon için bekliyor'), 'Newer offline queued status must not be overwritten');
});

test('TECH-03.1 Scenario L: Empty offline save is safe no-op', async () => {
    const env = setupMockEnvironment({
        onLine: false
    });

    const result = await saveStudentsData([]);

    assert.equal(result.ok, true);
    assert.equal(result.status, 'empty');
    assert.equal(result.writeCount, 0);
    assert.equal(env.docWrites.length, 0, 'Zero writes for empty array');
    assert.equal(env.syncStatusCalls.length, 0, 'No status message fired for empty array');
});


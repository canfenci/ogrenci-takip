import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const homeworkJsContent = fs.readFileSync(path.join(ROOT, 'homework.js'), 'utf8');

// ============================================================================
// PART 1: SAFETY & STATIC CODE CONTRACT
// ============================================================================

test('TECH-SYNC-01A Contract: Cloud homework persistence does not save full student list to overwrite homework collection', () => {
    // importHwResult in cloud mode must update the individual homework document directly
    assert.match(homeworkJsContent, /collection\(["']homeworks["']\)\.doc\(hwId\)\.update\(/, 'Must call collection("homeworks").doc(hwId).update');
    // It must NOT route cloud persistence through saveStudentsData
    const importFnSlice = homeworkJsContent.slice(homeworkJsContent.indexOf('export async function importHwResult'));
    const fnBody = importFnSlice.slice(0, importFnSlice.indexOf('\nexport '));
    assert.doesNotMatch(fnBody, /await\s+saveStudentsData\s*\(/, 'importHwResult must not call saveStudentsData in cloud mode');
});

test('TECH-SYNC-01A Static: importHwResult writes directly to Firestore homeworks collection in cloud mode', () => {
    assert.match(homeworkJsContent, /export\s+async\s+function\s+importHwResult\s*\(/, 'importHwResult must be an async function');
    assert.match(homeworkJsContent, /collection\(["']homeworks["']\)\.doc\(hwId\)\.update\(/, 'Must call collection("homeworks").doc(hwId).update');
    assert.match(homeworkJsContent, /store\.globalHomeworks/, 'Must update store.globalHomeworks in memory');
});

// ============================================================================
// PART 2: RUNTIME DOM & ENVIRONMENT SETUP
// ============================================================================

globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
globalThis.window.removeEventListener = () => {};
try {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true, writable: true });
} catch {
    globalThis.navigator = { onLine: true };
}

const storageMap = new Map();
const mockStorage = {
    getItem: (k) => storageMap.get(k) || null,
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
    clear: () => storageMap.clear()
};
globalThis.localStorage = mockStorage;
globalThis.window.localStorage = mockStorage;

const elementStore = new Map();
const mockDocument = {
    getElementById: (id) => {
        if (!elementStore.has(id)) {
            elementStore.set(id, {
                innerHTML: '',
                textContent: '',
                id,
                classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
                remove() { elementStore.delete(id); }
            });
        }
        return elementStore.get(id);
    },
    querySelectorAll: () => [],
    createElement: (tag) => ({ id: '', className: '', innerHTML: '', remove() {} }),
    body: { prepend() {} }
};
globalThis.document = mockDocument;
globalThis.window.document = mockDocument;

// Track alerts and locations
let alerts = [];
let assignedHrefs = [];
globalThis.alert = (msg) => { alerts.push(msg); };
globalThis.window.alert = globalThis.alert;

delete globalThis.window.location;
globalThis.window.location = {
    origin: 'https://canfenci.com',
    pathname: '/app/',
    get href() { return assignedHrefs[assignedHrefs.length - 1] || 'https://canfenci.com/app/'; },
    set href(val) { assignedHrefs.push(val); }
};

// Import store & homework module
const { store, STORAGE_KEY, localDataKey, saveStudentsData } = await import('../store.js');
const { importHwResult } = await import('../homework.js');

function resetTestState() {
    alerts = [];
    assignedHrefs = [];
    storageMap.clear();
    store.globalStudents = [];
    store.globalHomeworks = [];
    store.useFirestore = false;
    store.isGuestMode = false;
    globalThis.window.isFirebaseActive = false;
    globalThis.window.db = null;
}

// ============================================================================
// PART 3: RUNTIME BEHAVIOR TESTS
// ============================================================================

test('TECH-SYNC-01A Scenario 1: Cloud import persists canonical homework document via db.collection("homeworks")', async () => {
    resetTestState();
    store.useFirestore = true;
    globalThis.window.isFirebaseActive = true;

    const firestoreUpdates = [];
    globalThis.window.db = {
        collection: (name) => {
            assert.equal(name, 'homeworks', 'Must target homeworks collection');
            return {
                doc: (id) => ({
                    update: async (data) => {
                        firestoreUpdates.push({ id, data });
                        return Promise.resolve();
                    }
                })
            };
        }
    };

    // Pre-populate global students and global homeworks
    store.globalStudents = [
        { id: 's_cloud_1', adSoyad: 'Defne Şahin', odevler: [{ id: 'hw_c1', durum: 'verildi', dogru: 0, yanlis: 0 }] }
    ];
    store.globalHomeworks = [
        { id: 'hw_c1', studentId: 's_cloud_1', durum: 'verildi', dogru: 0, yanlis: 0 }
    ];

    await importHwResult('s_cloud_1', 'hw_c1', 18, 2);

    // 1. Firestore update verification
    assert.equal(firestoreUpdates.length, 1, 'Exactly one Firestore homework update must be called');
    assert.equal(firestoreUpdates[0].id, 'hw_c1');
    assert.deepEqual(firestoreUpdates[0].data, {
        durum: 'tamamlandi',
        dogru: 18,
        yanlis: 2
    });

    // 2. In-memory globalHomeworks updated
    assert.equal(store.globalHomeworks[0].durum, 'tamamlandi');
    assert.equal(store.globalHomeworks[0].dogru, 18);
    assert.equal(store.globalHomeworks[0].yanlis, 2);

    // 3. In-memory student.odevler updated
    assert.equal(store.globalStudents[0].odevler[0].durum, 'tamamlandi');
    assert.equal(store.globalStudents[0].odevler[0].dogru, 18);
    assert.equal(store.globalStudents[0].odevler[0].yanlis, 2);

    // 4. Success alert and redirect
    assert.equal(alerts.length, 1);
    assert.ok(alerts[0].includes('Defne Şahin isimli öğrencinin ödev sonucu başarıyla kaydedildi'));
    assert.ok(alerts[0].includes('Doğru: 18, Yanlış: 2'));
    assert.equal(assignedHrefs.length, 1);
    assert.equal(assignedHrefs[0], 'https://canfenci.com/app/?page=odevler');
});

test('TECH-SYNC-01A Scenario 2: Cloud import does NOT rely on saveStudentsData for homework persistence', async () => {
    resetTestState();
    store.useFirestore = true;
    globalThis.window.isFirebaseActive = true;

    let firestoreStudentWrites = 0;
    let firestoreHwWrites = 0;

    globalThis.window.db = {
        collection: (name) => {
            if (name === 'students') {
                return {
                    doc: () => ({
                        set: async () => { firestoreStudentWrites++; return Promise.resolve(); }
                    })
                };
            }
            if (name === 'homeworks') {
                return {
                    doc: () => ({
                        update: async () => { firestoreHwWrites++; return Promise.resolve(); }
                    })
                };
            }
            throw new Error(`Unexpected collection: ${name}`);
        }
    };

    store.globalStudents = [
        { id: 's_cloud_2', adSoyad: 'Can Yılmaz' }
    ];
    store.globalHomeworks = [
        { id: 'hw_c2', studentId: 's_cloud_2', durum: 'verildi' }
    ];

    await importHwResult('s_cloud_2', 'hw_c2', 15, 3);

    assert.equal(firestoreHwWrites, 1, 'Must write directly to homeworks');
    assert.equal(firestoreStudentWrites, 0, 'Must NOT write students document (no saveStudentsData reliance)');
});

test('TECH-SYNC-01A Scenario 3: Reload simulation — refetched homeworks collection reflects completed result', async () => {
    resetTestState();
    store.useFirestore = true;
    globalThis.window.isFirebaseActive = true;

    // Simulated remote database table
    const remoteHomeworkDb = new Map([
        ['hw_persisted_1', { id: 'hw_persisted_1', studentId: 's_reload', durum: 'verildi', dogru: 0, yanlis: 0, konu: 'Hücre Bölünmeleri' }]
    ]);

    globalThis.window.db = {
        collection: (name) => {
            assert.equal(name, 'homeworks');
            return {
                doc: (id) => ({
                    update: async (patch) => {
                        const existing = remoteHomeworkDb.get(id);
                        if (!existing) throw new Error('Document not found');
                        remoteHomeworkDb.set(id, { ...existing, ...patch });
                        return Promise.resolve();
                    }
                })
            };
        }
    };

    store.globalStudents = [{ id: 's_reload', adSoyad: 'Elif Demir' }];
    store.globalHomeworks = [remoteHomeworkDb.get('hw_persisted_1')];

    await importHwResult('s_reload', 'hw_persisted_1', 20, 0);

    // Simulate page reload: wipe in-memory state and reload from remoteHomeworkDb
    store.globalHomeworks = [];
    store.globalStudents = [{ id: 's_reload', adSoyad: 'Elif Demir' }];

    // Re-fetch from remote homework database (as firebase-config onSnapshot does)
    const simulatedRefetch = Array.from(remoteHomeworkDb.values());
    store.globalHomeworks = simulatedRefetch;

    const reloadedHw = store.globalHomeworks.find(h => h.id === 'hw_persisted_1');
    assert.ok(reloadedHw, 'Homework document must exist after reload');
    assert.equal(reloadedHw.durum, 'tamamlandi', 'Persisted status must survive reload');
    assert.equal(reloadedHw.dogru, 20, 'Persisted dogru must survive reload');
    assert.equal(reloadedHw.yanlis, 0, 'Persisted yanlis must survive reload');
});

test('TECH-SYNC-01A Scenario 4: Local / Guest mode preserves localStorage update without Firestore write', async () => {
    resetTestState();
    store.useFirestore = false;
    store.isGuestMode = true;

    const initialStudents = [
        {
            id: 's_local_1',
            adSoyad: 'Ahmet Çelik',
            odevler: [
                { id: 'hw_loc_1', durum: 'verildi', dogru: 0, yanlis: 0, konu: 'Kalıtım' }
            ]
        }
    ];
    mockStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify(initialStudents));

    await importHwResult('s_local_1', 'hw_loc_1', 12, 4);

    // Confirm written to localStorage
    const savedRaw = mockStorage.getItem(localDataKey(STORAGE_KEY));
    assert.ok(savedRaw);
    const savedStudents = JSON.parse(savedRaw);
    assert.equal(savedStudents[0].odevler[0].durum, 'tamamlandi');
    assert.equal(savedStudents[0].odevler[0].dogru, 12);
    assert.equal(savedStudents[0].odevler[0].yanlis, 4);

    // Confirm alert and redirect
    assert.equal(alerts.length, 1);
    assert.ok(alerts[0].includes('Ahmet Çelik isimli öğrencinin ödev sonucu başarıyla kaydedildi'));
    assert.equal(assignedHrefs[0], 'https://canfenci.com/app/?page=odevler');
});

test('TECH-SYNC-01A Scenario 5: Cloud failure handling — network error does not show false success or redirect', async () => {
    resetTestState();
    store.useFirestore = true;
    globalThis.window.isFirebaseActive = true;

    globalThis.window.db = {
        collection: () => ({
            doc: () => ({
                update: async () => Promise.reject(new Error('Network unavailable'))
            })
        })
    };

    store.globalStudents = [{ id: 's_fail', adSoyad: 'Bora Koç' }];
    store.globalHomeworks = [{ id: 'hw_fail', studentId: 's_fail', durum: 'verildi' }];

    await importHwResult('s_fail', 'hw_fail', 10, 2);

    // Error alert shown
    assert.equal(alerts.length, 1);
    assert.ok(alerts[0].includes('hata oluştu') || alerts[0].includes('Network unavailable'));
    // False success not shown
    assert.ok(!alerts[0].includes('başarıyla kaydedildi'));
    // Did NOT redirect
    assert.equal(assignedHrefs.length, 0, 'Must NOT redirect on failure');
});

test('TECH-SYNC-01A Scenario 6: Idempotent updates — repeated import preserves integrity with no duplicate records', async () => {
    resetTestState();
    store.useFirestore = true;
    globalThis.window.isFirebaseActive = true;

    let writeCount = 0;
    const documentState = { id: 'hw_idem', studentId: 's_idem', durum: 'verildi', dogru: 0, yanlis: 0 };

    globalThis.window.db = {
        collection: () => ({
            doc: (id) => ({
                update: async (patch) => {
                    writeCount++;
                    Object.assign(documentState, patch);
                    return Promise.resolve();
                }
            })
        })
    };

    store.globalStudents = [{ id: 's_idem', adSoyad: 'İrem Yıldız', odevler: [documentState] }];
    store.globalHomeworks = [documentState];

    // First call
    await importHwResult('s_idem', 'hw_idem', 19, 1);
    // Second call with corrected result
    await importHwResult('s_idem', 'hw_idem', 20, 0);

    assert.equal(writeCount, 2);
    assert.equal(documentState.durum, 'tamamlandi');
    assert.equal(documentState.dogru, 20);
    assert.equal(documentState.yanlis, 0);
    assert.equal(store.globalHomeworks.length, 1, 'Must not duplicate global homeworks entries');
});

test('TECH-SYNC-01A Scenario 7: Missing document handling — update failure on non-existent document fails safely without creating new documents', async () => {
    resetTestState();
    store.useFirestore = true;
    globalThis.window.isFirebaseActive = true;

    const existingDocs = new Map(); // empty remote db - doc does not exist

    let setCalled = false;
    globalThis.window.db = {
        collection: (name) => {
            assert.equal(name, 'homeworks');
            return {
                doc: (id) => ({
                    update: async (patch) => {
                        if (!existingDocs.has(id)) {
                            const err = new Error('NOT_FOUND: No document to update: ' + id);
                            err.code = 'not-found';
                            throw err;
                        }
                        return Promise.resolve();
                    },
                    set: async () => {
                        setCalled = true;
                        return Promise.resolve();
                    }
                })
            };
        }
    };

    store.globalStudents = [{ id: 's_nonexistent', adSoyad: 'Ali Veli', odevler: [] }];
    store.globalHomeworks = [];

    await importHwResult('s_nonexistent', 'hw_missing_999', 15, 5);

    // 1. Must fail safely
    assert.equal(alerts.length, 1);
    assert.ok(alerts[0].includes('hata oluştu') || alerts[0].includes('not-found') || alerts[0].includes('NOT_FOUND'));
    assert.ok(!alerts[0].includes('başarıyla kaydedildi'));

    // 2. Must not create new document or call set
    assert.equal(setCalled, false, 'Must not create a new document when updating non-existent homework');
    assert.equal(existingDocs.size, 0, 'No document should be added');

    // 3. Must not redirect
    assert.equal(assignedHrefs.length, 0, 'Must NOT redirect on missing doc error');
});

test('TECH-SYNC-01A Scenario 8: Cloud flag binding contract — works with window.isFirebaseActive and window.db without ReferenceError', async () => {
    resetTestState();
    store.useFirestore = true;
    // Test that when global window bindings exist, detection resolves correctly
    globalThis.window.isFirebaseActive = true;

    let updateInvoked = false;
    globalThis.window.db = {
        collection: (name) => {
            assert.equal(name, 'homeworks');
            return {
                doc: (id) => ({
                    update: async (data) => {
                        updateInvoked = true;
                        return Promise.resolve();
                    }
                })
            };
        }
    };

    store.globalStudents = [{ id: 's_flag', adSoyad: 'Zeynep Su' }];
    store.globalHomeworks = [{ id: 'hw_flag', studentId: 's_flag', durum: 'verildi' }];

    await importHwResult('s_flag', 'hw_flag', 20, 0);

    assert.equal(updateInvoked, true, 'Should successfully identify cloud mode and perform update');
    assert.equal(assignedHrefs.length, 1);
});

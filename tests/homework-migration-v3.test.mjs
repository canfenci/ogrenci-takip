import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
globalThis.window.removeEventListener = () => {};
globalThis.document = { body: { appendChild() {} }, querySelectorAll: () => [], getElementById: () => null };
const storage = new Map();
globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key)
};
globalThis.firebase = { firestore: { FieldValue: { delete: () => ({ __delete: true }) } } };
globalThis.window.firebase = globalThis.firebase;

const { store, STORAGE_KEY } = await import('../store.js');
const { migrateHomeworkErrorCodesOnce } = await import('../homework.js');

function makeHomework(index, affected = index <= 18) {
    return {
        id: `hw-${index}`,
        studentId: 'student-1',
        ders: 'Fen Bilimleri',
        konu: 'Basınç',
        altKonu: 'Katı Basıncı',
        soruSayisi: 20,
        dogru: 15,
        yanlis: 3,
        bos: 2,
        durum: 'bekliyor',
        baslamaTarihi: '2026-09-21',
        bitisTarihi: '2026-09-27',
        ...(affected ? { yanlisKonular: [{ konu: 'Basınç' }] } : {})
    };
}

function configureCloud(homeworks, update) {
    store.useFirestore = true;
    store.isGuestMode = false;
    store.syncUserId = 'cloud-user-v3';
    store.homeworksLoaded = true;
    store.globalHomeworks = homeworks;
    window.isFirebaseActive = true;
    window.db = { collection: () => ({ doc: id => ({ update: payload => update(id, payload) }) }) };
}

test('V3 waits for readiness, scans 50 records, deletes fields, and preserves clean records', async () => {
    storage.clear();
    configureCloud([], async () => { throw new Error('must not update before data is loaded'); });
    store.homeworksLoaded = false;
    const waiting = await migrateHomeworkErrorCodesOnce();
    assert.equal(waiting.state, 'waiting');
    assert.equal(storage.has('homework_result_analysis_cleanup_v3_cloud-user-v3'), false);

    const homeworks = Array.from({ length: 50 }, (_, i) => makeHomework(i + 1));
    const updates = [];
    configureCloud(homeworks, async (id, payload) => updates.push({ id, payload }));
    const result = await migrateHomeworkErrorCodesOnce();
    assert.deepEqual(result, { version: 3, state: 'completed', skipped: false, inspected: 50, affected: 18, updated: 18, failed: 0 });
    assert.equal(updates.length, 18);
    assert.ok(updates.every(({ payload }) => payload.yanlisKonular?.__delete === true));
    assert.equal(homeworks.filter(item => Object.hasOwn(item, 'yanlisKonular')).length, 0);
    assert.equal(homeworks.length, 50);
    assert.deepEqual(homeworks.map(item => item.id), Array.from({ length: 50 }, (_, i) => `hw-${i + 1}`));
    assert.equal(homeworks[0].soruSayisi, 20);
    assert.equal(homeworks[0].dogru, 15);
    assert.equal(homeworks[0].yanlis, 3);
    assert.equal(homeworks[0].bos, 2);
    assert.equal(updates.some(({ id }) => id === 'hw-50'), false);
    assert.equal(storage.get('homework_result_analysis_cleanup_v3_cloud-user-v3'), 'done');
});
test('V3 handles empty loaded snapshots, partial failure, retry, and second-run idempotency', async () => {
    storage.clear();
    configureCloud([], async () => {});
    const empty = await migrateHomeworkErrorCodesOnce();
    assert.deepEqual(empty, { version: 3, state: 'completed', skipped: false, inspected: 0, affected: 0, updated: 0, failed: 0 });
    assert.equal(storage.get('homework_result_analysis_cleanup_v3_cloud-user-v3'), 'done');

    storage.clear();
    const homeworks = Array.from({ length: 50 }, (_, i) => makeHomework(i + 1));
    let failOnce = true;
    const updates = [];
    configureCloud(homeworks, async (id, payload) => {
        updates.push({ id, payload });
        if (id === 'hw-18' && failOnce) {
            failOnce = false;
            throw new Error('simulated update failure');
        }
    });
    await assert.rejects(() => migrateHomeworkErrorCodesOnce(), /simulated update failure/);
    assert.equal(storage.has('homework_result_analysis_cleanup_v3_cloud-user-v3'), false);
    assert.equal(window.__homeworkMigrationStatus.state, 'failed');

    const retry = await migrateHomeworkErrorCodesOnce();
    assert.equal(retry.state, 'completed');
    assert.equal(retry.updated, 18);
    const writesAfterRetry = updates.length;
    const second = await migrateHomeworkErrorCodesOnce();
    assert.equal(second.state, 'skipped');
    assert.equal(updates.length, writesAfterRetry);
});

test('V3 local fallback remains scoped and removes legacy fields', async () => {
    storage.clear();
    store.useFirestore = false;
    store.isGuestMode = false;
    store.syncUserId = null;
    store.homeworksLoaded = false;
    const local = makeHomework(1);
    storage.set(STORAGE_KEY, JSON.stringify([{ id: 'student-1', odevler: [local] }]));
    const result = await migrateHomeworkErrorCodesOnce();
    assert.equal(result.state, 'completed');
    const saved = JSON.parse(storage.get(STORAGE_KEY));
    assert.equal(Object.hasOwn(saved[0].odevler[0], 'yanlisKonular'), false);
    assert.equal(storage.get('homework_result_analysis_cleanup_v3_local'), 'done');
});

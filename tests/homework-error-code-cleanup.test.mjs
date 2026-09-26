import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../homework.js', import.meta.url), 'utf8');
const reportSource = await readFile(new URL('../homework-report-insights.js', import.meta.url), 'utf8');
const resultModalSource = source.slice(source.indexOf('export function showEnterOdevSonucModal'), source.indexOf('    document.body.appendChild(modal);'));

test('HOMEWORK-RESULT-SIMPLIFY-02: result UI contains metrics only', () => {
    assert.match(resultModalSource, /Soru Sayısı/);
    assert.match(resultModalSource, /manualWrong/);
    assert.match(resultModalSource, /manualBlank/);
    assert.doesNotMatch(resultModalSource, /errorAnalysisSection|Alan Ekle|Analiz Edilen|error-unit-select|error-topic-select/);
    assert.doesNotMatch(source, /HATA_NEDENLERI/);
    assert.doesNotMatch(source, /error-reasons-group|error-reason-cb|Hata Nedeni/);
    assert.doesNotMatch(source, /Dikkatsizlik|Bilgi Eksikliği|Yanlış Okuma|İşlem Hatası|Kavram Yanılgısı/);
    assert.doesNotMatch(reportSource, /HATA ANALİZİ|normalizeHataNedeniLabel|reasonsPart/);
});

test('HOMEWORK-RESULT-SIMPLIFY-02: compatibility sanitizer removes deprecated result fields', async () => {
    globalThis.window = globalThis;
    globalThis.window.addEventListener = () => {};
    globalThis.window.removeEventListener = () => {};
    globalThis.document = { body: { appendChild() {} }, querySelectorAll: () => [], getElementById: () => null };
    globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    const { sanitizeHomeworkErrorAnalysis } = await import('../homework.js');
    const before = [{ id: 'row-1', unite: 'Basınç', konu: 'Katı Basıncı', altKonu: 'Katı Basıncı', adet: 3, hataNedenleri: ['dikkatsizlik'], hataTipi: 'Dikkatsizlik' }];
    const after = sanitizeHomeworkErrorAnalysis(before);
    assert.deepEqual(after, [{ id: 'row-1', unite: 'Basınç', konu: 'Katı Basıncı', altKonu: 'Katı Basıncı', adet: 3 }]);
    assert.deepEqual(sanitizeHomeworkErrorAnalysis(after), after);
    assert.deepEqual(before[0].hataNedenleri, ['dikkatsizlik']);
});

test('HOMEWORK-ERROR-CODE-CLEANUP-01: result persistence sanitizes new and edited records without changing the homework id', () => {
    const saveFn = source.slice(source.indexOf('export function saveManualOdevResult'), source.indexOf('export function openHomeworkDetailModal'));
    assert.match(saveFn, /yanlisKonular: firestoreDeleteValue\(\)/);
    assert.match(saveFn, /yanlisAnalizi: firestoreDeleteValue\(\)/);
    assert.match(saveFn, /students\[sIdx\]\.odevler\[hwIdx\]/);
    assert.doesNotMatch(saveFn, /error-reason-cb|hataNedenleri/);
    assert.doesNotMatch(saveFn, /odevler\.push|Date\.now\(\)|crypto\.randomUUID/);
    assert.match(source, /const LEGACY_HOMEWORK_ERROR_FIELDS = \['hataNedenleri', 'hataNedeni', 'hataTipi', 'hataKodu', 'errorCode', 'errorType', 'reason', 'neden', 'kategori'\]/);
});

test('HOMEWORK-ERROR-CODE-CLEANUP-01: imported legacy homework is sanitized on the same cloud/local record', () => {
    const importFn = source.slice(source.indexOf('export async function importHwResult'), source.indexOf('export function renderOdevTakibi'));
    assert.match(importFn, /yanlisKonular: firestoreDeleteValue\(\)/);
    assert.match(importFn, /yanlisAnalizi: firestoreDeleteValue\(\)/);
    assert.match(importFn, /Object\.assign\(globalHw, sanitizeHomeworkLegacyFields\(globalHw\)\)/);
    assert.match(importFn, /Object\.assign\(hw, sanitizeHomeworkLegacyFields\(hw\)\)/);
    assert.match(importFn, /Object\.assign\(students\[sIdx\]\.odevler\[hwIdx\], sanitizeHomeworkLegacyFields/);
});

test('HOMEWORK-ERROR-CODE-CLEANUP-01: completed result editing and canonical metrics remain present', () => {
    assert.match(source, /isEditing = odev\.durum === 'tamamlandi'/);
    assert.match(source, /id="homeworkQuestionCount"/);
    assert.match(source, /id="manualWrong"/);
    assert.match(source, /id="manualBlank"/);
    assert.match(source, /calculateHomeworkSuccess/);
    assert.match(source, /durum: "tamamlandi"/);
});

test('HOMEWORK-ERROR-CODE-CLEANUP-01B: migration cleans every affected local homework once and leaves clean records untouched', async () => {
    const storage = new Map();
    globalThis.localStorage = {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, String(value)),
        removeItem: key => storage.delete(key)
    };
    const { store, STORAGE_KEY } = await import('../store.js');
    const { migrateHomeworkErrorCodesOnce } = await import('../homework.js');
    store.useFirestore = false;
    store.isGuestMode = false;
    store.syncUserId = null;
    const legacy = {
        id: 'hw-legacy', studentId: 'student-1', ders: 'Fen Bilimleri', konu: 'Basınç', altKonu: 'Katı Basıncı',
        soruSayisi: 10, dogru: 8, yanlis: 1, bos: 1, durum: 'tamamlandi', bitisTarihi: '2026-09-01',
        yanlisKonular: [{ id: 'row-1', konu: 'Basınç', altKonu: 'Katı Basıncı', adet: 1, hataKodu: 'D' }], hataTipi: 'Dikkatsizlik'
    };
    const clean = { id: 'hw-clean', studentId: 'student-1', konu: 'Sayılar', yanlisKonular: [{ konu: 'Sayılar', altKonu: 'Asal Sayılar', adet: 1 }] };
    storage.set(STORAGE_KEY, JSON.stringify([{ id: 'student-1', adSoyad: 'Test', odevler: [legacy, clean] }]));

    const first = await migrateHomeworkErrorCodesOnce();
    assert.equal(first.updated, 2);
    const migrated = JSON.parse(storage.get(STORAGE_KEY))[0].odevler;
    assert.equal(migrated[0].id, 'hw-legacy');
    assert.equal(migrated[0].studentId, 'student-1');
    assert.equal(migrated[0].konu, 'Basınç');
    assert.equal(migrated[0].altKonu, 'Katı Basıncı');
    assert.equal(migrated[0].soruSayisi, 10);
    assert.equal(migrated[0].dogru, 8);
    assert.equal(migrated[0].yanlis, 1);
    assert.equal(migrated[0].bos, 1);
    assert.equal(migrated[0].durum, 'tamamlandi');
    assert.equal(Object.hasOwn(migrated[0], 'yanlisKonular'), false);
    assert.equal(Object.hasOwn(migrated[0], 'yanlisAnalizi'), false);
    assert.equal(Object.hasOwn(migrated[0], 'hataTipi'), false);
    assert.equal(Object.hasOwn(migrated[0], 'hataKodu'), false);
    assert.equal(Object.hasOwn(migrated[1], 'yanlisKonular'), false);
    const second = await migrateHomeworkErrorCodesOnce();
    assert.equal(second.skipped, true);
    assert.equal(second.updated, 0);
    assert.equal(JSON.parse(storage.get(STORAGE_KEY))[0].odevler[1].id, 'hw-clean');
});

test('HOMEWORK-ERROR-CODE-CLEANUP-01B: migration is triggered once after Homework data is available, not per render', () => {
    assert.match(source, /let homeworkMigrationPromise = null/);
    assert.match(source, /homeworkMigrationPromise = migrateHomeworkErrorCodesOnce\(\)/);
    assert.match(source, /!homeworkMigrationPromise && \(!store\.useFirestore \|\| store\.homeworksLoaded === true \|\| store\.globalHomeworks\.length > 0\)/);
});

test('HOMEWORK-ERROR-CODE-CLEANUP-01B: Firebase partial failure leaves completion marker unset for retry', async () => {
    const storage = new Map();
    globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) };
    globalThis.firebase = { firestore: { FieldValue: { delete: () => ({ __delete: true }) } } };
    globalThis.window.firebase = globalThis.firebase;
    const { store } = await import('../store.js');
    const { migrateHomeworkErrorCodesOnce } = await import('../homework.js');
    store.useFirestore = true;
    store.isGuestMode = false;
    store.syncUserId = 'cloud-user';
    store.homeworksLoaded = true;
    globalThis.window.isFirebaseActive = true;
    store.globalHomeworks = [1, 2, 3].map(index => ({
        id: `hw-${index}`, studentId: 'student-1', konu: 'Basınç', yanlisKonular: [{ konu: 'Basınç', altKonu: 'Katı Basıncı', adet: 1, hataKodu: 'D' }]
    }));
    const updated = [];
    globalThis.window.db = { collection: () => ({ doc: id => ({ update: async () => { updated.push(id); if (id === 'hw-2') throw new Error('simulated failure'); } }) }) };
    await assert.rejects(() => migrateHomeworkErrorCodesOnce(), /simulated failure/);
    assert.equal(storage.has('homework_result_analysis_cleanup_v2_cloud-user'), false);
    assert.deepEqual(updated, ['hw-1', 'hw-2', 'hw-3']);
    store.useFirestore = false;
    store.globalHomeworks = [];
    globalThis.window.db = null;
});

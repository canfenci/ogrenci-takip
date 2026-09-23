import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../homework.js', import.meta.url), 'utf8');
const resultModalSource = source.slice(source.indexOf('export function showEnterOdevSonucModal'), source.indexOf('    document.body.appendChild(modal);'));

test('result modal exposes only canonical result metrics', () => {
    assert.match(resultModalSource, /Soru Sayısı/);
    assert.match(resultModalSource, /Doğru/);
    assert.match(resultModalSource, /Yanlış/);
    assert.match(resultModalSource, /Boş/);
    assert.match(resultModalSource, /calculateHomeworkSuccess/);
    assert.doesNotMatch(resultModalSource, /errorAnalysisSection|Alan Ekle|Analiz Edilen|Hata Nedeni|Bilgi Eksikliği|Dikkatsizlik|Soruyu Yanlış Okuma/);
});

test('new result persistence deletes legacy analysis and preserves the same record', () => {
    const saveFn = source.slice(source.indexOf('export function saveManualOdevResult'), source.indexOf('export function openHomeworkDetailModal'));
    assert.match(saveFn, /yanlisKonular: firestoreDeleteValue\(\)/);
    assert.match(saveFn, /yanlisAnalizi: firestoreDeleteValue\(\)/);
    assert.match(saveFn, /students\[sIdx\]\.odevler\[hwIdx\]/);
    assert.doesNotMatch(saveFn, /odevler\.push|Date\.now\(\)|crypto\.randomUUID/);
});

test('legacy result editing keeps canonical metrics and assignment metadata', () => {
    assert.match(source, /odev\.durum === 'tamamlandi'/);
    assert.match(source, /delete students\[sIdx\]\.odevler\[hwIdx\]\.yanlisKonular/);
    assert.match(source, /delete students\[sIdx\]\.odevler\[hwIdx\]\.yanlisAnalizi/);
    assert.match(source, /durum: "tamamlandi"/);
    assert.match(source, /soruSayisi: questionCount/);
    assert.match(source, /dogru: correct, yanlis: wrong/);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { calculateHomeworkSuccess, formatHomeworkSuccess } from '../homework-success-insights.js';

const homeworkSource = await readFile(new URL('../homework.js', import.meta.url), 'utf8');

test('A-D, N: başarı formülü doğru/yanlış/boş değerlerini doğru hesaplar', () => {
    assert.deepEqual(calculateHomeworkSuccess({ soruSayisi: 10, yanlis: 1, bos: 1 }), {
        valid: true, questionCount: 10, correct: 8, wrong: 1, blank: 1, successRate: 80,
    });
    assert.equal(calculateHomeworkSuccess({ soruSayisi: 20, yanlis: 3, bos: 2 }).successRate, 75);
    assert.equal(calculateHomeworkSuccess({ soruSayisi: 10, yanlis: 0, bos: 0 }).successRate, 100);
    assert.equal(calculateHomeworkSuccess({ soruSayisi: 3, yanlis: 0, bos: 1 }).successRate, 66.7);
    assert.equal(calculateHomeworkSuccess({ soruSayisi: 10, yanlis: 2, bos: 3 }).correct, 5);
    assert.match(formatHomeworkSuccess({ soruSayisi: 10, yanlis: 1, bos: 1 }), /10 Soru · 8 Doğru · 1 Yanlış · 1 Boş · %80 Başarı/);
});

test('E-F: geçersiz ve legacy ödevler güvenli şekilde ele alınır', () => {
    const invalid = calculateHomeworkSuccess({ soruSayisi: 3, yanlis: 2, bos: 2 });
    assert.equal(invalid.valid, false);
    assert.equal(calculateHomeworkSuccess({ dogru: 7, yanlis: 2 }), null);
    assert.equal(formatHomeworkSuccess({ dogru: 7, yanlis: 2 }), null);
    assert.equal(calculateHomeworkSuccess({ soruSayisi: 0, yanlis: 0, bos: 0 }), null);
    assert.equal(calculateHomeworkSuccess({ soruSayisi: 10.5, yanlis: 1, bos: 0 }).valid, false);
    assert.equal(calculateHomeworkSuccess({ soruSayisi: 10, yanlis: -1, bos: 0 }).valid, false);
    assert.equal(calculateHomeworkSuccess({ soruSayisi: 10, yanlis: 1, bos: 2.5 }).valid, false);
    assert.equal(calculateHomeworkSuccess({ soruSayisi: 1, yanlis: 0, bos: 1 }).correct, 0);
});

test('G-H, O: kayıt akışı doğruyu türetir, bağımsız yüzde saklamaz ve toast ile doğrular', () => {
    assert.equal(calculateHomeworkSuccess({ soruSayisi: 12, yanlis: 2, bos: 1 }).correct, 9);
    assert.match(homeworkSource, /calculateHomeworkSuccess/);
    assert.match(homeworkSource, /showToast\(message, \{ type: 'warning' \}\)/);
    assert.doesNotMatch(homeworkSource, /basariOrani\s*:/);
    assert.match(homeworkSource, /soruSayisi: parseInt\(document\.getElementById\('odevSoruSayisi'\)/);
    assert.match(homeworkSource, /type="number"[^>]*id="odevSoruSayisi"/);
    assert.match(homeworkSource, /id="homeworkQuestionCount"[^>]*value="\$\{initialQuestionCount\}"/);
    assert.match(homeworkSource, /const correct = calculated\?\.valid \? calculated\.correct/);
});

test('I-M: düzenleme mevcut durumu ve kimliği korur; yıkıcı migrasyon yoktur', () => {
    assert.match(homeworkSource, /durum\s*===\s*['"]tamamlandi['"]/);
    assert.match(homeworkSource, /students\[sIdx\]\.odevler\[hwIdx\]/);
    assert.doesNotMatch(homeworkSource, /localStorage\.clear\(|indexedDB\.deleteDatabase\(/);
    assert.match(homeworkSource, /soruSayisi/);
    assert.match(homeworkSource, /bos/);
    assert.match(homeworkSource, /Yanlış analizindeki toplam adet/);
    assert.match(homeworkSource, /totalCount > wrong/);
    assert.doesNotMatch(homeworkSource, /successRate\s*:/);
});

test('Create/edit/result contracts remain additive and analysis remains optional', () => {
    assert.match(homeworkSource, /soruSayisi: parseInt\(document\.getElementById\('odevSoruSayisi'\)\?\.value\) \|\| null/);
    assert.match(homeworkSource, /if \(\(rawQuestionCount !== '' \|\| rawWrong !== '' \|\| rawBlank !== ''\)/);
    assert.match(homeworkSource, /showToast\(message, \{ type: 'warning' \}\)/);
    assert.match(homeworkSource, /durum: "tamamlandi"/);
    assert.match(homeworkSource, /hwId/);
    assert.match(homeworkSource, /importedBlank = importedTotal - importedCorrect - importedWrong/);
    assert.match(homeworkSource, /İçe aktarılan doğru ve yanlış toplamı soru sayısını geçemez/);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { calculateHomeworkSuccess } from '../homework-success-insights.js';

const source = await readFile(new URL('../homework.js', import.meta.url), 'utf8');
const modal = source.slice(source.indexOf('export function showEnterOdevSonucModal'), source.indexOf('export function saveManualOdevResult'));
const save = source.slice(source.indexOf('export function saveManualOdevResult'), source.indexOf('export function openHomeworkDetailModal'));

test('A-C: all three entry fields stay editable with integer numeric constraints', () => {
    for (const id of ['homeworkQuestionCount', 'manualWrong', 'manualBlank']) {
        assert.match(modal, new RegExp(`type="number"[^>]*id="${id}"`));
        assert.match(modal, new RegExp(`id="${id}"[^>]*`));
    }
    assert.match(modal, /id="homeworkQuestionCount"[^>]*min="1"[^>]*step="1"/);
    assert.match(modal, /id="manualWrong"[^>]*min="0"[^>]*step="1"/);
    assert.match(modal, /id="manualBlank"[^>]*min="0"[^>]*step="1"/);
    assert.doesNotMatch(modal, /id="(?:homeworkQuestionCount|manualWrong|manualBlank)"[^>]*disabled/);
    assert.doesNotMatch(modal, /id="(?:homeworkQuestionCount|manualWrong|manualBlank)"[^>]*readonly/);
});

test('D: Doğru remains a derived output, never an editable input', () => {
    assert.match(modal, /<output id="computedCorrect"/);
    assert.doesNotMatch(modal, /<input[^>]*id="computedCorrect"/);
    assert.match(modal, /correctOutput\.textContent = result\.correct/);
});

test('E-H: live canonical metrics update correctly', () => {
    assert.deepEqual(calculateHomeworkSuccess({ soruSayisi: 20, yanlis: 3, bos: 2 }), {
        valid: true, questionCount: 20, correct: 15, wrong: 3, blank: 2, successRate: 75,
    });
    assert.equal(calculateHomeworkSuccess({ soruSayisi: 20, yanlis: 1, bos: 2 }).correct, 17);
    assert.equal(calculateHomeworkSuccess({ soruSayisi: 20, yanlis: 1, bos: 0 }).correct, 19);
    assert.match(modal, /addEventListener\('input', updateComputed\)/);
});

test('I-J: temporary invalid values keep fields usable and block save', () => {
    assert.match(modal, /toggleAttribute\('aria-invalid'/);
    assert.equal(calculateHomeworkSuccess({ soruSayisi: 5, yanlis: 4, bos: 2 }).valid, false);
    assert.match(save, /!calculated \|\| !calculated\.valid/);
    assert.match(save, /showToast\(message, \{ type: 'warning' \}\)/);
});

test('K-M: existing and legacy results use the same canonical modal without wrong-analysis UI', () => {
    assert.match(modal, /odev\.durum === 'tamamlandi'/);
    assert.match(modal, /initialQuestionCount/);
    assert.doesNotMatch(modal, /errorAnalysisSection|Alan Ekle|Analiz Edilen|Hata Nedeni/);
});

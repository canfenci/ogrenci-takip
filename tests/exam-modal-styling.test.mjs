import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const source = fs.readFileSync(path.join(process.cwd(), 'exams.js'), 'utf8');

test('F-08 A-C: exam assignment modal keeps its canonical renderer, header, and core fields', () => {
    assert.match(source, /export function showDenemeAtaModal\(preSelectedStudentId = null\)/);
    assert.match(source, /export function renderDenemeAtaModal\(preSelectedStudentId = null\)/);
    assert.match(source, /id="denemeAtaModal" class="app-modal-backdrop"/);
    assert.match(source, /id="denemeAtaModalTitle"[^>]*>Deneme Ata/);
    for (const field of ['denemeAtaExamName', 'bransSinif', 'bransDers', 'bransKonuAdi', 'bransKaynak', 'bransSoruSayisi', 'studentCheck']) {
        assert.match(source, new RegExp(field), `${field} must remain in the assignment modal`);
    }
});

test('F-08 D-E: canonical save and edit persistence keep the existing exam identity', () => {
    assert.match(source, /document\.getElementById\('saveDenemeAtaBtn'\)\.addEventListener\('click', \(\) => saveDenemeAta\(\)\)/);
    assert.match(source, /id: "ex_" \+ Date\.now\(\) \+ "_" \+ Math\.random\(\)\.toString\(36\)\.slice\(2, 6\)/);
    assert.match(source, /updateStudentArrayRecord\(studentId, 'denemeler', exam\.id, updatedExam\)/);
    assert.match(source, /export function editExam\(studentId, examId\)/);
});

test('F-08 F-G: close and cancel controls only dismiss the assignment modal', () => {
    assert.match(source, /export function closeDenemeAtaModal\(\)\s*\{\s*document\.getElementById\('denemeAtaModal'\)\?\.remove\(\);/);
    assert.match(source, /onclick="closeDenemeAtaModal\(\)" class="btn-secondary min-h-\[44px\] px-4">Vazgeç/);
    assert.match(source, /onclick="if\(event\.target===this\) closeDenemeAtaModal\(\)"/);
});

test('F-08 H, O: a single renderer exists for each distinct exam modal path without legacy duplicate markup', () => {
    assert.equal((source.match(/export function renderDenemeAtaModal\(/g) || []).length, 1);
    assert.equal((source.match(/export function viewExam\(/g) || []).length, 1);
    assert.doesNotMatch(source, /bg-blue-650|this\.closest\('\.fixed'\)/);
});

test('F-08 I-K: modal width, touch targets, dark-mode compatibility, and dialog semantics are present', () => {
    assert.match(source, /class="app-modal max-w-2xl" role="dialog" aria-modal="true"/);
    assert.match(source, /class="btn-primary min-h-\[44px\] px-4"/);
    assert.match(source, /class="app-modal-close" aria-label="Pencereyi kapat"/);
    assert.match(source, /dark:border-gray-700/);
    assert.match(source, /class="app-modal-actions"/);
});

test('F-08 L-N: calculation, persistence, and existing exam data fields remain unchanged', () => {
    assert.match(source, /const net = calculateNet\(toplamDogru, toplamYanlis\);/);
    assert.match(source, /toplamDogru: 0,\s*toplamYanlis: 0,\s*toplamBos: sorular\.length,\s*toplamNet: 0,\s*toplamSoru: sorular\.length/s);
    assert.match(source, /const bulkRes = await bulkAddStudentExam\(selectedStudents, newExam\);/);
    assert.match(source, /const res = await deleteStudentArrayRecord\(studentId, 'denemeler', examId\);/);
});

test('F-08: result detail modal also uses the shared modal system and accessible actions', () => {
    assert.match(source, /modal\.id = 'examDetailModal';/);
    assert.match(source, /id="examDetailModalTitle"[^>]*>Deneme Detayı/);
    assert.match(source, /aria-label="Deneme detayını kapat"/);
    assert.match(source, /document\.getElementById\('examDetailModal'\)\?\.remove\(\); editExam/);
});

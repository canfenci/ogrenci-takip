import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const growthSource = await readFile(new URL('../growth.js', import.meta.url), 'utf8');
const guidanceSource = await readFile(new URL('../guidance.js', import.meta.url), 'utf8');

test('A: expanded study-techniques instruction section is removed', () => {
    assert.doesNotMatch(growthSource, /Çalışma Teknikleri Nasıl Uygulanır/i);
    assert.doesNotMatch(growthSource, /technique-grid|technique-card/);
});

test('B-C: compact Pomodoro and Feynman reminders remain', () => {
    assert.match(growthSource, /<h4>Pomodoro<\/h4>/);
    assert.match(growthSource, /<h4>Feynman<\/h4>/);
    assert.match(growthSource, /25 dk odaklan/);
    assert.match(growthSource, /kendi cümlelerinle anlat/);
});

test('D-E: study-plan output omits performance and technique content', () => {
    const pdfSource = growthSource.slice(growthSource.indexOf('export function exportStudyPlanToPdf'), growthSource.indexOf('function legacyExportStudyPlanToPdf'));
    assert.doesNotMatch(pdfSource, /HAFTALIK ÖDEV PERFORMANSI|Pomodoro|Feynman/);
    assert.doesNotMatch(guidanceSource, /weekly-homework-performance/);
});

test('F: current print output is single-page and printable', () => {
    const pdfSource = growthSource.slice(growthSource.indexOf('export function exportStudyPlanToPdf'), growthSource.indexOf('function legacyExportStudyPlanToPdf'));
    assert.doesNotMatch(pdfSource, /page-break/);
    assert.match(pdfSource, /VERİLEN ÖDEVLER/);
    assert.match(pdfSource, /window\.print\(\)/);
});

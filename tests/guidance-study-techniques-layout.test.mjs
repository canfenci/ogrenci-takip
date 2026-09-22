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

test('D-E: Page 2 performance remains and technique content is not duplicated', () => {
    assert.match(growthSource, /HAFTALIK ÖDEV PERFORMANSI/);
    assert.equal((growthSource.match(/<h4>Pomodoro<\/h4>/g) || []).length, 1);
    assert.equal((growthSource.match(/<h4>Feynman<\/h4>/g) || []).length, 1);
    assert.match(guidanceSource, /weekly-homework-performance/);
});

test('F: two-page print structure remains intact', () => {
    assert.match(growthSource, /page-break-before: always/);
    assert.match(growthSource, /weekly-table/);
    assert.match(growthSource, /window\.print\(\)/);
});

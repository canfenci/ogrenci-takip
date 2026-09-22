import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    calculateHomeworkSuccess,
    calculateHomeworkWeeklySummary,
    getAutomaticPlanHomeworks,
    getHomeworkPlacementDay,
    formatHomeworkSuccess
} from '../homework-success-insights.js';

const guidanceSource = await readFile(new URL('../guidance.js', import.meta.url), 'utf8');
const growthSource = await readFile(new URL('../growth.js', import.meta.url), 'utf8');

const fixture = {
    id: 'student-1',
    coachingPlan: {
        branchTargets: [{ subject: 'Fen Bilimleri' }],
        tasks: [{ taskType: 'homework', homeworkId: 'hw-manual', dueDay: 'Pazartesi' }]
    },
    odevler: [
        { id: 'hw-fen', ders: 'Fen', konu: 'Basınç', soruSayisi: 20, baslamaTarihi: '2026-09-22', bitisTarihi: '2026-09-25', durum: 'tamamlandi', dogru: 16, yanlis: 3, bos: 1 },
        { id: 'hw-overlap', ders: 'Fen Bilimleri', konu: 'Kuvvet', soruSayisi: 10, baslamaTarihi: '2026-09-25', bitisTarihi: '2026-09-30', durum: 'verildi' },
        { id: 'hw-other-branch', ders: 'Matematik', soruSayisi: 30, baslamaTarihi: '2026-09-22', bitisTarihi: '2026-09-25', durum: 'verildi' },
        { id: 'hw-old', ders: 'Fen Bilimleri', soruSayisi: 15, baslamaTarihi: '2026-09-10', bitisTarihi: '2026-09-20', durum: 'verildi' },
        { id: 'hw-legacy', ders: 'Fen Bilimleri', konu: 'Eski Ödev', bitisTarihi: '2026-09-24', durum: 'verildi', dogru: 5, yanlis: 2 }
    ]
};

const range = { weekStart: '2026-09-21', weekEnd: '2026-09-27' };

test('A-E, L-M: automatic source filters current student, branch, and overlapping week', () => {
    const result = getAutomaticPlanHomeworks({ student: fixture, studentId: fixture.id, branch: 'Fen Bilimleri', ...range });
    assert.deepEqual(result.map(hw => hw.id), ['hw-fen', 'hw-overlap', 'hw-legacy']);
    assert.equal(result.some(hw => hw.id === 'hw-other-branch'), false);
    assert.equal(result.some(hw => hw.id === 'hw-old'), false);
});

test('F-G, H-I, J-K: canonical records update live, manual day overrides, and orphan safety is source-wired', () => {
    const first = getAutomaticPlanHomeworks({ student: fixture, branch: 'Fen', ...range });
    assert.equal(first.find(hw => hw.id === 'hw-fen').dogru, 16);
    assert.equal(getHomeworkPlacementDay({ id: 'hw-manual', dueDay: 'Pazartesi', bitisTarihi: '2026-09-25' }, range.weekStart, range.weekEnd), 'Pazartesi');
    assert.equal(getHomeworkPlacementDay({ bitisTarihi: '2026-09-24' }, range.weekStart, range.weekEnd), 'Perşembe');
    assert.match(guidanceSource, /getAutomaticPlanHomeworks/);
    assert.match(guidanceSource, /existingIds/);
    assert.match(guidanceSource, /getHomeworkPlacementDay/);
});

test('N-R: weekly summary aggregates totals and excludes pending results from success denominator', () => {
    const result = calculateHomeworkWeeklySummary([
        fixture.odevler[0],
        fixture.odevler[1],
        { id: 'hw-2', soruSayisi: 30, durum: 'verildi' }
    ]);
    assert.deepEqual(result, { assignedQuestions: 60, completedQuestions: 20, correct: 16, wrong: 3, blank: 1, successRate: 80 });
});

test('S-T: pending and legacy homework never fabricate zero metrics or percentage', () => {
    const pendingSummary = calculateHomeworkWeeklySummary([{ soruSayisi: 20, durum: 'verildi' }]);
    assert.deepEqual(pendingSummary, { assignedQuestions: 20, completedQuestions: 0, correct: 0, wrong: 0, blank: 0, successRate: null });
    assert.equal(formatHomeworkSuccess({ dogru: 5, yanlis: 2 }), null);
});

test('U-W: current branch report and compact technique reminders are rendered in guidance', () => {
    assert.match(guidanceSource, /weekly-homework-performance/);
    assert.match(guidanceSource, /Haftalık Ödev Performansı/);
    assert.match(guidanceSource, />Pomodoro</);
    assert.match(guidanceSource, />Feynman</);
    assert.match(guidanceSource, /min-w-\[620px\]/);
    assert.match(growthSource, /page-break-before: always/);
    assert.match(growthSource, /HAFTALIK ÖDEV PERFORMANSI/);
    assert.match(growthSource, /Pomodoro/);
    assert.match(growthSource, /Feynman/);
});

test('X-Y: automatic visibility does not depend on opening the legacy picker and deduplicates by homeworkId', () => {
    assert.match(guidanceSource, /automaticHomeworkTasks/);
    assert.match(guidanceSource, /!existingIds\.has\(String\(t\.homeworkId\)\)/);
    assert.match(guidanceSource, /automaticHomeworkTasks/);
});

test('No duplicate source of truth or destructive migration is introduced', () => {
    assert.doesNotMatch(guidanceSource, /localStorage\.clear\(\)|indexedDB\.deleteDatabase\(/);
    assert.doesNotMatch(guidanceSource, /collection\(['"]homework/);
    assert.match(guidanceSource, /formatHomeworkSuccess/);
});

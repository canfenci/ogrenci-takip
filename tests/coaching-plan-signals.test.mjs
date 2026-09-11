import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { createEmptyCoachingPlan } = await import('../coaching-plan-model.js');
const { getCoachingSignals } = await import('../coaching-plan-progress.js');

// A. low question signal
test('A: low question progress signal', () => {
    const plan = createEmptyCoachingPlan({
        weeklyTargets: { totalQuestions: 100 },
        tasks: [{ id: 't1', taskType: 'question', questionTarget: 100, completedCount: 30 }]
    });
    const { signals } = getCoachingSignals(plan);
    assert.ok(signals.some(s => s.includes('Soru hedefinin gerisinde')));
});

// B. incomplete tasks signal
test('B: incomplete tasks signal', () => {
    const plan = createEmptyCoachingPlan({
        tasks: [
            { id: 't1', completed: false },
            { id: 't2', completed: false },
            { id: 't3', completed: false },
            { id: 't4', completed: true }
        ]
    });
    const { signals } = getCoachingSignals(plan);
    assert.ok(signals.some(s => s.includes('görevlerin önemli bir bölümü tamamlanmamış')));
});

// C. behind branch signal
test('C: behind branch signal', () => {
    const plan = createEmptyCoachingPlan({
        weeklyTargets: { totalQuestions: 200 },
        branchTargets: [{ subject: 'Fen', questionTarget: 100 }],
        tasks: [
            { id: 't1', taskType: 'question', subject: 'Fen', questionTarget: 100, completedCount: 20 },
            { id: 't2', completed: true },
            { id: 't3', completed: true }
        ]
    });
    const { signals } = getCoachingSignals(plan);
    assert.ok(signals.some(s => s.includes('Fen')));
});

// D. positive target-met signal
test('D: positive signal when targets met', () => {
    const plan = createEmptyCoachingPlan({
        weeklyTargets: { totalQuestions: 100 },
        tasks: [
            { id: 't1', taskType: 'question', questionTarget: 100, completedCount: 100, completed: true },
            { id: 't2', completed: true },
            { id: 't3', completed: true }
        ]
    });
    const { signals } = getCoachingSignals(plan);
    assert.ok(signals.some(s => s.includes('Soru hedefi tamamlandı')));
});

// E. nextWeekFocus usage
test('E: nextWeekFocus from plan weeklyCheckIn', () => {
    const plan = createEmptyCoachingPlan({
        weeklyCheckIn: { nextWeekFocus: 'Matematik problem + Fen tekrar' }
    });
    const { nextWeekFocus } = getCoachingSignals(plan);
    assert.equal(nextWeekFocus, 'Matematik problem + Fen tekrar');
});

// F. no target = no fake warning
test('F: no target produces no fake warning', () => {
    const plan = createEmptyCoachingPlan({
        weeklyTargets: { totalQuestions: null },
        tasks: [{ id: 't1', completed: false }]
    });
    const { signals } = getCoachingSignals(plan);
    assert.ok(!signals.some(s => s.includes('Soru hedefinin gerisinde')));
});

// G. sparse data safe
test('G: sparse data produces no crash', () => {
    const plan = createEmptyCoachingPlan();
    const { signals, nextWeekFocus } = getCoachingSignals(plan);
    assert.ok(Array.isArray(signals));
    assert.equal(nextWeekFocus, '');
});

// H. max concise output
test('H: max 2 signals returned', () => {
    const plan = createEmptyCoachingPlan({
        weeklyTargets: { totalQuestions: 100 },
        branchTargets: [
            { subject: 'Fen', questionTarget: 50 },
            { subject: 'Matematik', questionTarget: 50 }
        ],
        tasks: Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, completed: false }))
    });
    plan.branchTargets[0].questionTarget = 50;
    plan.branchTargets[1].questionTarget = 50;
    plan.tasks = [
        { id: 't1', taskType: 'question', subject: 'Fen', questionTarget: 50, completedCount: 5 },
        { id: 't2', taskType: 'question', subject: 'Matematik', questionTarget: 50, completedCount: 5 },
        ...Array.from({ length: 8 }, (_, i) => ({ id: `t${i + 3}`, completed: false }))
    ];
    const { signals } = getCoachingSignals(plan);
    assert.ok(signals.length <= 2);
});

// I. no external AI
test('I: no external AI references in module', () => {
    const progress = fs.readFileSync(new URL('../coaching-plan-progress.js', import.meta.url), 'utf8');
    assert.ok(!progress.includes('fetch('), 'no fetch');
    assert.ok(!progress.includes('openai'), 'no openai');
    assert.ok(!progress.includes('anthropic'), 'no anthropic');
});

// J. teacher note not merged as Teacher Opinion
test('J: weeklyCheckIn.teacherNote is separate from Teacher Opinion', () => {
    const guidance = fs.readFileSync(new URL('../guidance.js', import.meta.url), 'utf8');
    assert.ok(guidance.includes('cp-teacher-note'), 'check-in note field exists');
    assert.ok(guidance.includes('Öğretmen Notu'), 'check-in note label');
});

// K. null input safe
test('K: null input to getCoachingSignals', () => {
    const { signals, nextWeekFocus } = getCoachingSignals(null);
    assert.deepEqual(signals, []);
    assert.equal(nextWeekFocus, '');
});

// L. undefined input safe
test('L: undefined input to getCoachingSignals', () => {
    const { signals, nextWeekFocus } = getCoachingSignals(undefined);
    assert.deepEqual(signals, []);
    assert.equal(nextWeekFocus, '');
});

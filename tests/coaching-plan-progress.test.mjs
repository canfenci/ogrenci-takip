import test from 'node:test';
import assert from 'node:assert/strict';

const {
    getProgressPercent,
    getQuestionProgress,
    getTaskProgress,
    getExamProgress,
    getBranchProgress,
    getTopicProgress,
    getReadingProgress,
    getReviewProgress,
    getTaskCompletionState,
    getWeeklyTargetActuals,
    getPlanProgressSummary
} = await import('../coaching-plan-progress.js');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function makePlan(overrides = {}) {
    return {
        version: 1,
        id: 'cp_test',
        status: 'active',
        weekStart: '2026-09-07',
        weekEnd: '2026-09-13',
        weeklyTargets: {
            totalQuestions: null,
            generalExams: null,
            branchExams: null,
            readingTarget: null,
            reviewSessions: null
        },
        branchTargets: [],
        topicTargets: [],
        tasks: [],
        createdAt: '2026-09-07T00:00:00.000Z',
        updatedAt: '2026-09-07T00:00:00.000Z',
        ...overrides
    };
}

function makeTask(overrides = {}) {
    return {
        id: 'ct_1',
        title: 'Test',
        taskType: 'question',
        subject: null,
        topic: null,
        resource: null,
        questionTarget: null,
        completedCount: 0,
        completed: false,
        dueDay: 'Pazartesi',
        durationMinutes: null,
        notes: null,
        ...overrides
    };
}

// ─── GET PROGRESS PERCENT ─────────────────────────────────────────────────────

test('A: getProgressPercent basic calculation', () => {
    assert.equal(getProgressPercent(50, 100), 50);
    assert.equal(getProgressPercent(75, 100), 75);
    assert.equal(getProgressPercent(3, 4), 75);
});

test('B: getProgressPercent null target', () => {
    assert.equal(getProgressPercent(50, null), null);
    assert.equal(getProgressPercent(50, 0), null);
    assert.equal(getProgressPercent(50, -5), null);
});

test('C: getProgressPercent zero actual', () => {
    assert.equal(getProgressPercent(0, 100), 0);
});

test('D: getProgressPercent overachievement', () => {
    assert.equal(getProgressPercent(600, 550), 109.09);
});

test('E: getProgressPercent both zero', () => {
    assert.equal(getProgressPercent(0, 0), null);
});

// ─── QUESTION PROGRESS ────────────────────────────────────────────────────────

test('F: getQuestionProgress basic', () => {
    const plan = makePlan({
        weeklyTargets: { totalQuestions: 550 },
        tasks: [
            makeTask({ taskType: 'question', completedCount: 100 }),
            makeTask({ taskType: 'question', completedCount: 50 }),
            makeTask({ taskType: 'exam', completedCount: 20 })
        ]
    });
    const result = getQuestionProgress(plan);
    assert.equal(result.actual, 150);
    assert.equal(result.target, 550);
    assert.ok(Math.abs(result.percent - 27.27) < 0.01);
});

test('G: getQuestionProgress null target', () => {
    const plan = makePlan({
        weeklyTargets: { totalQuestions: null },
        tasks: [makeTask({ taskType: 'question', completedCount: 100 })]
    });
    const result = getQuestionProgress(plan);
    assert.equal(result.actual, 100);
    assert.equal(result.target, null);
    assert.equal(result.percent, null);
});

test('H: getQuestionProgress zero target', () => {
    const plan = makePlan({
        weeklyTargets: { totalQuestions: 0 },
        tasks: [makeTask({ taskType: 'question', completedCount: 100 })]
    });
    assert.equal(getQuestionProgress(plan).percent, null);
});

test('I: getQuestionProgress no tasks', () => {
    const plan = makePlan({ weeklyTargets: { totalQuestions: 550 } });
    const result = getQuestionProgress(plan);
    assert.equal(result.actual, 0);
    assert.equal(result.percent, 0);
});

test('J: getQuestionProgress overachievement', () => {
    const plan = makePlan({
        weeklyTargets: { totalQuestions: 100 },
        tasks: [makeTask({ taskType: 'question', completedCount: 150 })]
    });
    assert.equal(getQuestionProgress(plan).actual, 150);
    assert.equal(getQuestionProgress(plan).percent, 150);
});

test('K: getQuestionProgress ignores non-question tasks', () => {
    const plan = makePlan({
        weeklyTargets: { totalQuestions: 100 },
        tasks: [
            makeTask({ taskType: 'exam', completedCount: 50 }),
            makeTask({ taskType: 'review', completedCount: 30 })
        ]
    });
    assert.equal(getQuestionProgress(plan).actual, 0);
});

// ─── TASK PROGRESS ────────────────────────────────────────────────────────────

test('L: getTaskProgress basic', () => {
    const plan = makePlan({
        tasks: [
            makeTask({ completed: true }),
            makeTask({ completed: true }),
            makeTask({ completed: false }),
            makeTask({ completed: false }),
            makeTask({ completed: false })
        ]
    });
    const result = getTaskProgress(plan);
    assert.equal(result.total, 5);
    assert.equal(result.completed, 2);
    assert.equal(result.percent, 40);
});

test('M: getTaskProgress no tasks', () => {
    const result = getTaskProgress(makePlan());
    assert.equal(result.total, 0);
    assert.equal(result.completed, 0);
    assert.equal(result.percent, null);
});

test('N: getTaskProgress all completed', () => {
    const plan = makePlan({
        tasks: [makeTask({ completed: true }), makeTask({ completed: true })]
    });
    assert.equal(getTaskProgress(plan).percent, 100);
});

test('O: getTaskProgress partial count does not equal completed', () => {
    const plan = makePlan({
        tasks: [
            makeTask({ taskType: 'question', completedCount: 25, completed: false }),
            makeTask({ completed: true })
        ]
    });
    const result = getTaskProgress(plan);
    assert.equal(result.total, 2);
    assert.equal(result.completed, 1);
    assert.equal(result.percent, 50);
});

// ─── EXAM PROGRESS ────────────────────────────────────────────────────────────

test('P: getExamProgress general and branch', () => {
    const plan = makePlan({
        weeklyTargets: { generalExams: 3, branchExams: 2 },
        tasks: [
            makeTask({ taskType: 'exam', completed: true, subject: '' }),
            makeTask({ taskType: 'exam', completed: true, subject: '' }),
            makeTask({ taskType: 'exam', completed: true, subject: 'Fen' }),
            makeTask({ taskType: 'exam', completed: false, subject: 'Matematik' })
        ]
    });
    const result = getExamProgress(plan);
    assert.equal(result.generalActual, 2);
    assert.equal(result.generalTarget, 3);
    assert.equal(result.branchActual, 1);
    assert.equal(result.branchTarget, 2);
});

test('Q: getExamProgress null targets', () => {
    const plan = makePlan({
        tasks: [makeTask({ taskType: 'exam', completed: true })]
    });
    const result = getExamProgress(plan);
    assert.equal(result.generalTarget, null);
    assert.equal(result.branchTarget, null);
    assert.equal(result.generalPercent, null);
});

test('R: getExamProgress empty subject is general', () => {
    const plan = makePlan({
        tasks: [
            makeTask({ taskType: 'exam', completed: true, subject: null }),
            makeTask({ taskType: 'exam', completed: true, subject: undefined })
        ]
    });
    assert.equal(getExamProgress(plan).generalActual, 2);
});

// ─── BRANCH PROGRESS ──────────────────────────────────────────────────────────

test('S: getBranchProgress basic', () => {
    const plan = makePlan({
        branchTargets: [
            { id: 'b1', subject: 'Fen', questionTarget: 120, examTarget: 2 },
            { id: 'b2', subject: 'Matematik', questionTarget: 150, examTarget: 1 }
        ],
        tasks: [
            makeTask({ taskType: 'question', subject: 'Fen', completedCount: 85 }),
            makeTask({ taskType: 'question', subject: 'Fen', completedCount: 10 }),
            makeTask({ taskType: 'question', subject: 'Matematik', completedCount: 95 }),
            makeTask({ taskType: 'exam', subject: 'Fen', completed: true })
        ]
    });
    const result = getBranchProgress(plan);
    assert.equal(result.length, 2);
    assert.equal(result[0].subject, 'Fen');
    assert.equal(result[0].actual, 95);
    assert.equal(result[0].target, 120);
    assert.equal(result[0].examActual, 1);
    assert.equal(result[0].examTarget, 2);
    assert.equal(result[1].subject, 'Matematik');
    assert.equal(result[1].actual, 95);
    assert.equal(result[1].target, 150);
});

test('T: getBranchProgress no branches', () => {
    assert.deepEqual(getBranchProgress(makePlan()), []);
});

test('U: getBranchProgress exact subject match', () => {
    const plan = makePlan({
        branchTargets: [{ id: 'b1', subject: 'Fen Bilimleri', questionTarget: 100 }],
        tasks: [
            makeTask({ taskType: 'question', subject: 'Fen', completedCount: 50 }),
            makeTask({ taskType: 'question', subject: 'Fen Bilimleri', completedCount: 30 })
        ]
    });
    const result = getBranchProgress(plan);
    assert.equal(result[0].actual, 30, 'exact match only');
});

test('V: getBranchProgress null targets', () => {
    const plan = makePlan({
        branchTargets: [{ id: 'b1', subject: 'Fen', questionTarget: null }]
    });
    assert.equal(getBranchProgress(plan)[0].percent, null);
});

// ─── TOPIC PROGRESS ───────────────────────────────────────────────────────────

test('W: getTopicProgress basic', () => {
    const plan = makePlan({
        topicTargets: [
            { id: 't1', subject: 'Fen', topic: 'Mevsimler', questionTarget: 40 }
        ],
        tasks: [
            makeTask({ taskType: 'question', subject: 'Fen', topic: 'Mevsimler', completedCount: 25 }),
            makeTask({ taskType: 'question', subject: 'Fen', topic: 'Isı', completedCount: 10 })
        ]
    });
    const result = getTopicProgress(plan);
    assert.equal(result.length, 1);
    assert.equal(result[0].actual, 25);
    assert.equal(result[0].target, 40);
});

test('X: getTopicProgress exact topic match', () => {
    const plan = makePlan({
        topicTargets: [{ id: 't1', subject: 'Fen', topic: 'DNA', questionTarget: 20 }],
        tasks: [
            makeTask({ taskType: 'question', subject: 'Fen', topic: 'DNA', completedCount: 15 }),
            makeTask({ taskType: 'question', subject: 'Fen', topic: 'DNA ve RNA', completedCount: 10 })
        ]
    });
    assert.equal(getTopicProgress(plan)[0].actual, 15, 'exact match only');
});

test('Y: getTopicProgress no topics', () => {
    assert.deepEqual(getTopicProgress(makePlan()), []);
});

// ─── READING PROGRESS ─────────────────────────────────────────────────────────

test('Z: getReadingProgress basic', () => {
    const plan = makePlan({
        weeklyTargets: { readingTarget: 5 },
        tasks: [
            makeTask({ taskType: 'reading', completed: true }),
            makeTask({ taskType: 'reading', completed: true }),
            makeTask({ taskType: 'reading', completed: false })
        ]
    });
    const result = getReadingProgress(plan);
    assert.equal(result.actual, 2);
    assert.equal(result.target, 5);
    assert.equal(result.percent, 40);
});

// ─── REVIEW PROGRESS ──────────────────────────────────────────────────────────

test('AA: getReviewProgress basic', () => {
    const plan = makePlan({
        weeklyTargets: { reviewSessions: 3 },
        tasks: [
            makeTask({ taskType: 'review', completed: true }),
            makeTask({ taskType: 'review', completed: false })
        ]
    });
    const result = getReviewProgress(plan);
    assert.equal(result.actual, 1);
    assert.equal(result.target, 3);
});

// ─── TASK COMPLETION STATE ────────────────────────────────────────────────────

test('AB: getTaskCompletionState completed', () => {
    assert.equal(getTaskCompletionState(makeTask({ completed: true })), 'completed');
});

test('AC: getTaskCompletionState in_progress', () => {
    assert.equal(getTaskCompletionState(makeTask({ taskType: 'question', completedCount: 10, completed: false })), 'in_progress');
});

test('AD: getTaskCompletionState not_started', () => {
    assert.equal(getTaskCompletionState(makeTask()), 'not_started');
});

test('AE: getTaskCompletionState null task', () => {
    assert.equal(getTaskCompletionState(null), 'not_started');
});

test('AF: getTaskCompletionState non-question with count is not_started', () => {
    assert.equal(getTaskCompletionState(makeTask({ taskType: 'exam', completedCount: 5 })), 'not_started');
});

// ─── WEEKLY TARGET ACTUALS ────────────────────────────────────────────────────

test('AG: getWeeklyTargetActuals returns all 5', () => {
    const result = getWeeklyTargetActuals(makePlan());
    assert.ok('questions' in result);
    assert.ok('tasks' in result);
    assert.ok('exams' in result);
    assert.ok('reading' in result);
    assert.ok('review' in result);
});

// ─── PLAN PROGRESS SUMMARY ────────────────────────────────────────────────────

test('AH: getPlanProgressSummary returns all sections', () => {
    const result = getPlanProgressSummary(makePlan());
    assert.ok('questions' in result);
    assert.ok('tasks' in result);
    assert.ok('exams' in result);
    assert.ok('branches' in result);
    assert.ok('topics' in result);
    assert.ok('reading' in result);
    assert.ok('review' in result);
});

// ─── NO NaN / INFINITY ────────────────────────────────────────────────────────

test('AI: no NaN in any output', () => {
    const plan = makePlan({
        weeklyTargets: { totalQuestions: 100 },
        tasks: [makeTask({ taskType: 'question', completedCount: 'abc' })]
    });
    const result = getQuestionProgress(plan);
    assert.ok(Number.isFinite(result.actual));
    assert.ok(result.percent === null || Number.isFinite(result.percent));
});

test('AJ: no Infinity in any output', () => {
    const plan = makePlan({
        weeklyTargets: { totalQuestions: 0 },
        tasks: [makeTask({ taskType: 'question', completedCount: 100 })]
    });
    const result = getQuestionProgress(plan);
    assert.ok(result.percent === null || Number.isFinite(result.percent));
});

// ─── NO MUTATION ──────────────────────────────────────────────────────────────

test('AK: no mutation of input plan', () => {
    const plan = makePlan({
        weeklyTargets: { totalQuestions: 100 },
        tasks: [makeTask({ taskType: 'question', completedCount: 50 })]
    });
    const frozen = JSON.stringify(plan);
    getQuestionProgress(plan);
    getTaskProgress(plan);
    getExamProgress(plan);
    getBranchProgress(plan);
    getTopicProgress(plan);
    getReadingProgress(plan);
    getReviewProgress(plan);
    getPlanProgressSummary(plan);
    assert.equal(JSON.stringify(plan), frozen);
});

// ─── MALFORMED INPUTS ────────────────────────────────────────────────────────

test('AL: null plan safe', () => {
    assert.equal(getQuestionProgress(null).actual, 0);
    assert.equal(getTaskProgress(null).total, 0);
    assert.deepEqual(getBranchProgress(null), []);
    assert.deepEqual(getTopicProgress(null), []);
});

test('AM: plan without tasks safe', () => {
    const plan = makePlan({ tasks: undefined });
    assert.equal(getQuestionProgress(plan).actual, 0);
    assert.equal(getTaskProgress(plan).total, 0);
});

test('AN: task with missing fields safe', () => {
    const plan = makePlan({
        tasks: [{ id: 'x' }]
    });
    assert.equal(getTaskProgress(plan).total, 1);
    assert.equal(getQuestionProgress(plan).actual, 0);
});

// ─── MIXED TASK TYPES ────────────────────────────────────────────────────────

test('AO: mixed task types counted correctly', () => {
    const plan = makePlan({
        weeklyTargets: { totalQuestions: 200, generalExams: 2, readingTarget: 3, reviewSessions: 1 },
        tasks: [
            makeTask({ taskType: 'question', completedCount: 100 }),
            makeTask({ taskType: 'question', completedCount: 50 }),
            makeTask({ taskType: 'exam', completed: true }),
            makeTask({ taskType: 'reading', completed: true }),
            makeTask({ taskType: 'reading', completed: true }),
            makeTask({ taskType: 'review', completed: true }),
            makeTask({ taskType: 'custom', completed: true })
        ]
    });
    assert.equal(getQuestionProgress(plan).actual, 150);
    assert.equal(getExamProgress(plan).generalActual, 1);
    assert.equal(getReadingProgress(plan).actual, 2);
    assert.equal(getReviewProgress(plan).actual, 1);
    assert.equal(getTaskProgress(plan).completed, 5);
});

// ─── COMPLEX SCENARIO ────────────────────────────────────────────────────────

test('AP: full plan with branches and topics', () => {
    const plan = makePlan({
        weeklyTargets: { totalQuestions: 550, generalExams: 3, branchExams: 2, readingTarget: 5, reviewSessions: 3 },
        branchTargets: [
            { id: 'b1', subject: 'Fen', questionTarget: 200, examTarget: 1 },
            { id: 'b2', subject: 'Matematik', questionTarget: 350, examTarget: 1 }
        ],
        topicTargets: [
            { id: 't1', subject: 'Fen', topic: 'DNA', questionTarget: 50 }
        ],
        tasks: [
            makeTask({ taskType: 'question', subject: 'Fen', topic: 'DNA', completedCount: 30 }),
            makeTask({ taskType: 'question', subject: 'Fen', completedCount: 70 }),
            makeTask({ taskType: 'question', subject: 'Matematik', completedCount: 100 }),
            makeTask({ taskType: 'exam', completed: true, subject: 'Fen' }),
            makeTask({ taskType: 'exam', completed: true, subject: '' }),
            makeTask({ taskType: 'reading', completed: true }),
            makeTask({ taskType: 'review', completed: true }),
            makeTask({ completed: true })
        ]
    });
    const summary = getPlanProgressSummary(plan);
    assert.equal(summary.questions.actual, 200);
    assert.equal(summary.branches[0].actual, 100);
    assert.equal(summary.branches[1].actual, 100);
    assert.equal(summary.topics[0].actual, 30);
    assert.equal(summary.exams.generalActual, 1);
    assert.equal(summary.exams.branchActual, 1);
    assert.equal(summary.reading.actual, 1);
    assert.equal(summary.review.actual, 1);
    assert.equal(summary.tasks.completed, 5);
    assert.equal(summary.tasks.total, 8);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    COACHING_PLAN_VERSION,
    TASK_TYPES,
    PLAN_STATUSES,
    getWeekStart,
    getWeekEnd,
    createEmptyCoachingPlan,
    normalizeCoachingPlan,
    normalizeLegacyStudyPlan,
    getTaskTitle,
    getTaskDurationMinutes,
    getTaskTags,
    getActivePlan,
    hasAnyPlan,
    getCombinedTasks,
    getTasksByDay,
    getPlanSummary,
    isLegacyPreserved,
    createHistorySnapshot
} from '../coaching-plan-model.js';

test('COACHING_PLAN_VERSION is 1', () => {
    assert.equal(COACHING_PLAN_VERSION, 1);
});

test('TASK_TYPES defines 5 types', () => {
    assert.equal(Object.keys(TASK_TYPES).length, 5);
    assert.equal(TASK_TYPES.question, 'Soru Çözümü');
    assert.equal(TASK_TYPES.exam, 'Deneme');
    assert.equal(TASK_TYPES.review, 'Tekrar');
    assert.equal(TASK_TYPES.reading, 'Okuma');
    assert.equal(TASK_TYPES.custom, 'Diğer');
});

test('PLAN_STATUSES defines 4 statuses', () => {
    assert.equal(Object.keys(PLAN_STATUSES).length, 4);
    assert.equal(PLAN_STATUSES.draft, 'Taslak');
    assert.equal(PLAN_STATUSES.active, 'Aktif');
    assert.equal(PLAN_STATUSES.completed, 'Tamamlandı');
    assert.equal(PLAN_STATUSES.archived, 'Arşivlendi');
});

test('getWeekStart returns Monday of current week', () => {
    const result = getWeekStart();
    assert.ok(typeof result === 'string');
    assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
    const d = new Date(result + 'T00:00:00');
    assert.equal(d.getDay(), 1); // Monday
});

test('getWeekEnd returns Sunday of the week', () => {
    const weekStart = '2026-09-08'; // Monday
    const result = getWeekEnd(weekStart);
    assert.equal(result, '2026-09-14'); // Sunday
});

test('getWeekEnd returns null for invalid input', () => {
    assert.equal(getWeekEnd(null), null);
    assert.equal(getWeekEnd(undefined), null);
    assert.equal(getWeekEnd(''), null);
    assert.equal(getWeekEnd('invalid'), null);
});

test('createEmptyCoachingPlan creates valid plan', () => {
    const plan = createEmptyCoachingPlan();
    assert.equal(plan.version, 1);
    assert.ok(typeof plan.id === 'string');
    assert.equal(plan.status, 'draft');
    assert.ok(typeof plan.weekStart === 'string');
    assert.ok(typeof plan.weekEnd === 'string');
    assert.deepEqual(plan.weeklyTargets, {
        totalQuestions: null,
        generalExams: null,
        branchExams: null,
        readingTarget: null,
        reviewSessions: null
    });
    assert.deepEqual(plan.branchTargets, []);
    assert.deepEqual(plan.topicTargets, []);
    assert.deepEqual(plan.tasks, []);
    assert.ok(typeof plan.createdAt === 'string');
    assert.ok(typeof plan.updatedAt === 'string');
});

test('createEmptyCoachingPlan accepts overrides', () => {
    const plan = createEmptyCoachingPlan({
        status: 'active',
        weekStart: '2026-09-01',
        weekEnd: '2026-09-07'
    });
    assert.equal(plan.status, 'active');
    assert.equal(plan.weekStart, '2026-09-01');
    assert.equal(plan.weekEnd, '2026-09-07');
});

test('normalizeCoachingPlan returns null for invalid input', () => {
    assert.equal(normalizeCoachingPlan(null), null);
    assert.equal(normalizeCoachingPlan(undefined), null);
    assert.equal(normalizeCoachingPlan('string'), null);
    assert.equal(normalizeCoachingPlan(123), null);
});

test('normalizeCoachingPlan normalizes raw data', () => {
    const raw = {
        version: 1,
        id: 'plan_123',
        status: 'active',
        weekStart: '2026-09-08',
        weekEnd: '2026-09-14',
        weeklyTargets: { totalQuestions: 550 },
        branchTargets: [{ subject: 'Matematik', questionTarget: 200 }],
        topicTargets: [],
        tasks: [{ id: 't1', title: 'Test', taskType: 'question', dueDay: 'Pazartesi' }],
        createdAt: '2026-09-08T10:00:00Z',
        updatedAt: '2026-09-08T10:00:00Z'
    };
    const result = normalizeCoachingPlan(raw);
    assert.equal(result.version, 1);
    assert.equal(result.id, 'plan_123');
    assert.equal(result.status, 'active');
    assert.equal(result.weekStart, '2026-09-08');
    assert.equal(result.weekEnd, '2026-09-14');
    assert.equal(result.weeklyTargets.totalQuestions, 550);
    assert.equal(result.weeklyTargets.generalExams, null);
    assert.equal(result.branchTargets.length, 1);
    assert.equal(result.branchTargets[0].subject, 'Matematik');
    assert.equal(result.tasks.length, 1);
    assert.equal(result.tasks[0].title, 'Test');
});

test('normalizeCoachingPlan handles missing fields gracefully', () => {
    const raw = {};
    const result = normalizeCoachingPlan(raw);
    assert.equal(result.version, 1);
    assert.ok(typeof result.id === 'string');
    assert.equal(result.status, 'draft');
    assert.ok(typeof result.weekStart === 'string');
    assert.ok(typeof result.weekEnd === 'string');
    assert.deepEqual(result.branchTargets, []);
    assert.deepEqual(result.tasks, []);
});

test('normalizeLegacyStudyPlan returns empty array for invalid input', () => {
    assert.deepEqual(normalizeLegacyStudyPlan(null), []);
    assert.deepEqual(normalizeLegacyStudyPlan(undefined), []);
    assert.deepEqual(normalizeLegacyStudyPlan('string'), []);
    assert.deepEqual(normalizeLegacyStudyPlan(123), []);
});

test('normalizeLegacyStudyPlan normalizes string tasks', () => {
    const studyPlan = {
        'Pazartesi': ['Matematik - Konu testi · Pomodoro · 30 dk', 'Fen - Deneme'],
        'Salı': [],
        'Çarşamba': ['Türkçe - Okuma']
    };
    const tasks = normalizeLegacyStudyPlan(studyPlan);
    assert.equal(tasks.length, 3);
    assert.equal(tasks[0].title, 'Matematik - Konu testi · Pomodoro · 30 dk');
    assert.equal(tasks[0].dueDay, 'Pazartesi');
    assert.equal(tasks[0]._legacy, true);
    assert.equal(tasks[1].title, 'Fen - Deneme');
    assert.equal(tasks[2].title, 'Türkçe - Okuma');
    assert.equal(tasks[2].dueDay, 'Çarşamba');
});

test('normalizeLegacyStudyPlan normalizes object tasks', () => {
    const studyPlan = {
        'Pazartesi': [{ title: 'Test Task', completed: true, questionTarget: 20 }]
    };
    const tasks = normalizeLegacyStudyPlan(studyPlan);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].title, 'Test Task');
    assert.equal(tasks[0].completed, true);
    assert.equal(tasks[0].questionTarget, 20);
    assert.equal(tasks[0]._legacy, true);
});

test('getTaskTitle handles string tasks', () => {
    assert.equal(getTaskTitle('Matematik - Konu testi'), 'Matematik - Konu testi');
    assert.equal(getTaskTitle('Matematik - Konu testi · Pomodoro'), 'Matematik - Konu testi');
    assert.equal(getTaskTitle(''), '');
});

test('getTaskTitle handles object tasks', () => {
    assert.equal(getTaskTitle({ title: 'Test' }), 'Test');
    assert.equal(getTaskTitle({ konu: 'Konu' }), 'Konu');
    assert.equal(getTaskTitle({ name: 'Name' }), 'Name');
    assert.equal(getTaskTitle({ text: 'Text' }), 'Text');
    assert.equal(getTaskTitle({}), 'Görev');
});

test('getTaskTitle handles null/undefined', () => {
    assert.equal(getTaskTitle(null), 'Görev');
    assert.equal(getTaskTitle(undefined), 'Görev');
});

test('getTaskDurationMinutes extracts from string', () => {
    assert.equal(getTaskDurationMinutes('Matematik · Pomodoro · 30 dk'), 30);
    assert.equal(getTaskDurationMinutes('Test · 45dk'), 45);
    assert.equal(getTaskDurationMinutes('No duration'), null);
});

test('getTaskDurationMinutes extracts from object', () => {
    assert.equal(getTaskDurationMinutes({ durationMinutes: 30 }), 30);
    assert.equal(getTaskDurationMinutes({ duration: 45 }), 45);
    assert.equal(getTaskDurationMinutes({ sure: 60 }), 60);
    assert.equal(getTaskDurationMinutes({}), null);
});

test('getTaskTags extracts from string', () => {
    assert.deepEqual(getTaskTags('Matematik · Pomodoro · 30 dk'), ['Pomodoro', '30 dk']);
    assert.deepEqual(getTaskTags('Matematik'), []);
});

test('getActivePlan returns none for null student', () => {
    const result = getActivePlan(null);
    assert.equal(result.type, 'none');
    assert.equal(result.coachingPlan, null);
    assert.equal(result.hasLegacy, false);
});

test('getActivePlan returns coaching when active coachingPlan exists', () => {
    const student = {
        coachingPlan: { status: 'active', weekStart: '2026-09-08' },
        studyPlan: { 'Pazartesi': ['Task'] }
    };
    const result = getActivePlan(student);
    assert.equal(result.type, 'coaching');
    assert.ok(result.coachingPlan);
    assert.equal(result.hasLegacy, true);
});

test('getActivePlan returns coaching for draft status', () => {
    const student = {
        coachingPlan: { status: 'draft', weekStart: '2026-09-08' },
        studyPlan: {}
    };
    const result = getActivePlan(student);
    assert.equal(result.type, 'coaching');
});

test('getActivePlan returns legacy when no coachingPlan', () => {
    const student = {
        studyPlan: { 'Pazartesi': ['Task'] }
    };
    const result = getActivePlan(student);
    assert.equal(result.type, 'legacy');
    assert.equal(result.coachingPlan, null);
    assert.equal(result.hasLegacy, true);
});

test('getActivePlan returns none when no plan', () => {
    const student = { studyPlan: {} };
    const result = getActivePlan(student);
    assert.equal(result.type, 'none');
});

test('hasAnyPlan returns true when plan exists', () => {
    assert.equal(hasAnyPlan({ coachingPlan: { status: 'active' } }), true);
    assert.equal(hasAnyPlan({ studyPlan: { 'Pazartesi': ['Task'] } }), true);
    assert.equal(hasAnyPlan({ studyPlan: {} }), false);
    assert.equal(hasAnyPlan(null), false);
});

test('getCombinedTasks returns coachingPlan tasks', () => {
    const student = {
        coachingPlan: {
            status: 'active',
            tasks: [{ id: 't1', title: 'Task 1', dueDay: 'Pazartesi' }]
        },
        studyPlan: { 'Pazartesi': ['Legacy Task'] }
    };
    const tasks = getCombinedTasks(student);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].id, 't1');
});

test('getCombinedTasks returns legacy tasks when no coachingPlan', () => {
    const student = {
        studyPlan: { 'Pazartesi': ['Legacy Task'] }
    };
    const tasks = getCombinedTasks(student);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].title, 'Legacy Task');
    assert.equal(tasks[0]._legacy, true);
});

test('getCombinedTasks returns empty for no plan', () => {
    const student = { studyPlan: {} };
    const tasks = getCombinedTasks(student);
    assert.equal(tasks.length, 0);
});

test('getTasksByDay groups tasks by dueDay', () => {
    const student = {
        coachingPlan: {
            status: 'active',
            tasks: [
                { id: 't1', title: 'Task 1', dueDay: 'Pazartesi' },
                { id: 't2', title: 'Task 2', dueDay: 'Pazartesi' },
                { id: 't3', title: 'Task 3', dueDay: 'Salı' }
            ]
        }
    };
    const grid = getTasksByDay(student);
    assert.equal(grid['Pazartesi'].length, 2);
    assert.equal(grid['Salı'].length, 1);
    assert.equal(grid['Çarşamba'].length, 0);
});

test('getPlanSummary returns null for no plan', () => {
    assert.equal(getPlanSummary(null), null);
    assert.equal(getPlanSummary({ studyPlan: {} }), null);
});

test('getPlanSummary returns coaching summary', () => {
    const student = {
        coachingPlan: {
            status: 'active',
            weekStart: '2026-09-08',
            weekEnd: '2026-09-14',
            tasks: [{ completed: true }, { completed: false }],
            branchTargets: [{ subject: 'Matematik' }],
            topicTargets: [],
            weeklyTargets: { totalQuestions: 550 }
        }
    };
    const summary = getPlanSummary(student);
    assert.equal(summary.type, 'coaching');
    assert.equal(summary.totalTasks, 2);
    assert.equal(summary.completedTasks, 1);
    assert.equal(summary.branchCount, 1);
});

test('getPlanSummary returns legacy summary', () => {
    const student = {
        studyPlan: { 'Pazartesi': ['Task 1', 'Task 2'] }
    };
    const summary = getPlanSummary(student);
    assert.equal(summary.type, 'legacy');
    assert.equal(summary.totalTasks, 2);
});

test('isLegacyPreserved returns true for valid legacy data', () => {
    const student = {
        studyPlan: { 'Pazartesi': ['Task 1', 'Task 2'] },
        studyPlanProfile: { subject: 'Matematik' }
    };
    assert.equal(isLegacyPreserved(student), true);
});

test('isLegacyPreserved returns false for mutated legacy data', () => {
    const student = {
        studyPlan: { 'Pazartesi': [{ title: 'Object task' }] }
    };
    assert.equal(isLegacyPreserved(student), false);
});

test('createHistorySnapshot creates snapshot from coaching plan', () => {
    const plan = {
        id: 'plan_123',
        status: 'active',
        weekStart: '2026-09-08',
        weekEnd: '2026-09-14',
        weeklyTargets: { totalQuestions: 550 },
        branchTargets: [{ subject: 'Matematik' }],
        topicTargets: [],
        tasks: [{ id: 't1', title: 'Task' }],
        createdAt: '2026-09-08T10:00:00Z',
        updatedAt: '2026-09-08T10:00:00Z'
    };
    const snapshot = createHistorySnapshot(plan);
    assert.equal(snapshot.id, 'plan_123');
    assert.equal(snapshot.status, 'active');
    assert.ok(typeof snapshot.archivedAt === 'string');
    assert.deepEqual(snapshot.weeklyTargets, { totalQuestions: 550, generalExams: null, branchExams: null, readingTarget: null, reviewSessions: null });
});

test('createHistorySnapshot returns null for invalid input', () => {
    assert.equal(createHistorySnapshot(null), null);
    assert.equal(createHistorySnapshot(undefined), null);
});

test('no NaN or undefined in normalized plan', () => {
    const plan = normalizeCoachingPlan({});
    assert.ok(Number.isFinite(plan.version));
    assert.ok(typeof plan.id === 'string');
    assert.ok(typeof plan.weekStart === 'string');
    assert.ok(typeof plan.weekEnd === 'string');
    assert.ok(Array.isArray(plan.branchTargets));
    assert.ok(Array.isArray(plan.tasks));
});

test('no mutation of input in normalizeCoachingPlan', () => {
    const input = {
        branchTargets: [{ subject: 'Matematik' }],
        tasks: [{ id: 't1' }]
    };
    const originalBranches = [...input.branchTargets];
    const originalTasks = [...input.tasks];
    normalizeCoachingPlan(input);
    assert.deepEqual(input.branchTargets, originalBranches);
    assert.deepEqual(input.tasks, originalTasks);
});

test('no mutation of input in normalizeLegacyStudyPlan', () => {
    const input = {
        'Pazartesi': ['Task 1', 'Task 2']
    };
    const original = { ...input };
    normalizeLegacyStudyPlan(input);
    assert.deepEqual(input, original);
});

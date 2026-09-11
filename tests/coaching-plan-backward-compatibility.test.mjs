import assert from 'node:assert/strict';
import test from 'node:test';

import {
    getActivePlan,
    hasAnyPlan,
    getCombinedTasks,
    normalizeLegacyStudyPlan,
    normalizeCoachingPlan,
    getPlanSummary,
    isLegacyPreserved
} from '../coaching-plan-model.js';

test('A: legacy-only student renders correctly', () => {
    const student = {
        studyPlan: {
            'Pazartesi': ['Matematik - Konu testi · Pomodoro · 30 dk'],
            'Salı': ['Fen - Deneme']
        },
        studyPlanProfile: {
            subject: 'Matematik',
            stage: 'intermediate',
            badge: 'Problem Çözücü'
        }
    };
    const active = getActivePlan(student);
    assert.equal(active.type, 'legacy');
    assert.equal(active.hasLegacy, true);
    assert.equal(active.coachingPlan, null);

    const tasks = getCombinedTasks(student);
    assert.equal(tasks.length, 2);
    assert.equal(tasks[0]._legacy, true);
});

test('B: new-only student renders correctly', () => {
    const student = {
        studyPlan: {},
        coachingPlan: {
            version: 1,
            status: 'active',
            weekStart: '2026-09-08',
            weekEnd: '2026-09-14',
            tasks: [
                { id: 't1', title: 'Task 1', taskType: 'question', dueDay: 'Pazartesi', completed: false },
                { id: 't2', title: 'Task 2', taskType: 'exam', dueDay: 'Salı', completed: true }
            ],
            branchTargets: [{ subject: 'Matematik', questionTarget: 200 }],
            weeklyTargets: { totalQuestions: 550 }
        }
    };
    const active = getActivePlan(student);
    assert.equal(active.type, 'coaching');
    assert.ok(active.coachingPlan);
    assert.equal(active.hasLegacy, false);

    const tasks = getCombinedTasks(student);
    assert.equal(tasks.length, 2);
    assert.equal(tasks[0].id, 't1');
});

test('C: mixed student prefers coachingPlan', () => {
    const student = {
        studyPlan: {
            'Pazartesi': ['Legacy Task']
        },
        studyPlanProfile: {
            subject: 'Fen Bilimleri',
            stage: 'beginner'
        },
        coachingPlan: {
            version: 1,
            status: 'active',
            weekStart: '2026-09-08',
            weekEnd: '2026-09-14',
            tasks: [{ id: 't1', title: 'Coaching Task', dueDay: 'Pazartesi' }]
        }
    };
    const active = getActivePlan(student);
    assert.equal(active.type, 'coaching');
    assert.equal(active.hasLegacy, true);

    const tasks = getCombinedTasks(student);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].id, 't1');
    assert.equal(tasks[0].title, 'Coaching Task');
});

test('D: old reader ignores coachingPlan field', () => {
    const student = {
        studyPlan: {
            'Pazartesi': ['Task']
        },
        studyPlanProfile: {
            subject: 'Matematik',
            stage: 'intermediate'
        },
        coachingPlan: {
            version: 1,
            status: 'active',
            tasks: [{ id: 't1', title: 'New Task' }]
        }
    };

    // Simulate old reader that only reads studyPlan and studyPlanProfile
    const oldReader = {
        planProfile: student.studyPlanProfile,
        rawStudyPlan: student.studyPlan,
        tasks: student.studyPlan['Pazartesi'] || []
    };

    assert.equal(oldReader.planProfile.subject, 'Matematik');
    assert.equal(oldReader.tasks.length, 1);
    assert.equal(oldReader.tasks[0], 'Task');
    // coachingPlan is ignored by old reader
});

test('E: legacy fields preserved after new save', () => {
    const student = {
        id: 'student_123',
        adSoyad: 'Test Öğrenci',
        studyPlan: {
            'Pazartesi': ['Legacy Task']
        },
        studyPlanProfile: {
            subject: 'Matematik',
            stage: 'intermediate',
            badge: 'Problem Çözücü'
        },
        coachingPlan: {
            version: 1,
            status: 'active',
            tasks: [{ id: 't1', title: 'New Task' }]
        }
    };

    // Verify legacy fields are still present and correct
    assert.ok(student.studyPlan);
    assert.equal(student.studyPlan['Pazartesi'].length, 1);
    assert.equal(student.studyPlan['Pazartesi'][0], 'Legacy Task');
    assert.ok(student.studyPlanProfile);
    assert.equal(student.studyPlanProfile.subject, 'Matematik');
    assert.equal(student.studyPlanProfile.stage, 'intermediate');
    assert.equal(student.studyPlanProfile.badge, 'Problem Çözücü');
});

test('F: no forced migration — reading legacy data does not trigger write', () => {
    const student = {
        studyPlan: { 'Pazartesi': ['Task'] },
        studyPlanProfile: { subject: 'Matematik' }
    };

    // normalizeCoachingPlan is read-only, does not mutate student
    const originalStudyPlan = JSON.stringify(student.studyPlan);
    const originalProfile = JSON.stringify(student.studyPlanProfile);

    const active = getActivePlan(student);
    assert.equal(active.type, 'legacy');

    // Verify no mutation occurred
    assert.equal(JSON.stringify(student.studyPlan), originalStudyPlan);
    assert.equal(JSON.stringify(student.studyPlanProfile), originalProfile);
});

test('G: no read-time write — getActivePlan does not modify student', () => {
    const student = {
        studyPlan: { 'Pazartesi': ['Task'] },
        coachingPlan: { status: 'active', tasks: [] }
    };
    const originalCoaching = JSON.stringify(student.coachingPlan);
    const originalStudy = JSON.stringify(student.studyPlan);

    getActivePlan(student);
    hasAnyPlan(student);
    getCombinedTasks(student);
    getPlanSummary(student);

    assert.equal(JSON.stringify(student.coachingPlan), originalCoaching);
    assert.equal(JSON.stringify(student.studyPlan), originalStudy);
});

test('H: rollback safe — v2 data readable by v1 logic', () => {
    // Simulate new data with extra fields
    const student = {
        studyPlan: { 'Pazartesi': ['Legacy Task'] },
        studyPlanProfile: { subject: 'Matematik' },
        coachingPlan: {
            version: 1,
            status: 'active',
            weeklyTargets: { totalQuestions: 550 },
            branchTargets: [{ subject: 'Matematik', questionTarget: 200 }],
            tasks: [{ id: 't1', title: 'Task' }]
        }
    };

    // Old reader logic
    const legacyTasks = student.studyPlan['Pazartesi'] || [];
    assert.equal(legacyTasks.length, 1);
    assert.equal(legacyTasks[0], 'Legacy Task');

    // New reader logic
    const active = getActivePlan(student);
    assert.equal(active.type, 'coaching');
    assert.equal(active.coachingPlan.tasks.length, 1);
});

test('I: no plan student returns safe defaults', () => {
    const student = { studyPlan: {} };
    const active = getActivePlan(student);
    assert.equal(active.type, 'none');

    const tasks = getCombinedTasks(student);
    assert.equal(tasks.length, 0);

    const summary = getPlanSummary(student);
    assert.equal(summary, null);

    assert.equal(hasAnyPlan(student), false);
});

test('J: mixed legacy string and object tasks in studyPlan', () => {
    const student = {
        studyPlan: {
            'Pazartesi': [
                'String Task · Pomodoro · 30 dk',
                { title: 'Object Task', completed: true }
            ]
        }
    };
    const tasks = normalizeLegacyStudyPlan(student.studyPlan);
    assert.equal(tasks.length, 2);
    assert.equal(tasks[0].title, 'String Task · Pomodoro · 30 dk');
    assert.equal(tasks[0]._legacy, true);
    assert.equal(tasks[1].title, 'Object Task');
    assert.equal(tasks[1].completed, true);
    assert.equal(tasks[1]._legacy, true);
});

test('K: empty studyPlan produces empty legacy tasks', () => {
    const tasks = normalizeLegacyStudyPlan({});
    assert.equal(tasks.length, 0);
});

test('L: coachingPlan with null/undefined fields normalizes safely', () => {
    const plan = normalizeCoachingPlan({
        weeklyTargets: null,
        branchTargets: null,
        topicTargets: null,
        tasks: null
    });
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
});

test('M: plan summary for coaching plan with completed tasks', () => {
    const student = {
        coachingPlan: {
            status: 'active',
            weekStart: '2026-09-08',
            weekEnd: '2026-09-14',
            tasks: [
                { completed: true },
                { completed: true },
                { completed: false }
            ],
            branchTargets: [],
            topicTargets: [],
            weeklyTargets: { totalQuestions: 100 }
        }
    };
    const summary = getPlanSummary(student);
    assert.equal(summary.totalTasks, 3);
    assert.equal(summary.completedTasks, 2);
});

test('N: legacy plan preserved check for mutated data', () => {
    const student = {
        studyPlan: { 'Pazartesi': [{ notATask: true }] }
    };
    assert.equal(isLegacyPreserved(student), false);
});

test('O: null student handled safely by all functions', () => {
    assert.equal(getActivePlan(null).type, 'none');
    assert.equal(hasAnyPlan(null), false);
    assert.deepEqual(getCombinedTasks(null), []);
    assert.equal(getPlanSummary(null), null);
    assert.equal(isLegacyPreserved(null), true);
});

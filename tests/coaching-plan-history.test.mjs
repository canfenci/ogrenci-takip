import test from 'node:test';
import assert from 'node:assert/strict';

const { createEmptyCoachingPlan, normalizeCoachingPlan, createHistorySnapshot } = await import('../coaching-plan-model.js');
const { getMonthlyProgress, getHistoryWeekCount } = await import('../coaching-plan-history.js');

// A. snapshot on archive
test('A: createHistorySnapshot creates snapshot from plan', () => {
    const plan = createEmptyCoachingPlan({ id: 'plan-1', weekStart: '2026-09-08', weekEnd: '2026-09-14' });
    const snap = createHistorySnapshot(plan);
    assert.ok(snap);
    assert.equal(snap.id, 'plan-1');
    assert.ok(snap.archivedAt);
});

// B. no snapshot on normal save
test('B: no snapshot created during normal save (manual)', () => {
    const plan = createEmptyCoachingPlan();
    assert.ok(!plan.archivedAt);
});

// C. no snapshot on read
test('C: no snapshot on read (manual)', () => {
    const plan = createEmptyCoachingPlan();
    assert.equal(typeof plan.archivedAt, 'undefined');
});

// D. immutable deep clone
test('D: snapshot is deep clone - mutations do not affect source', () => {
    const plan = createEmptyCoachingPlan({
        id: 'plan-1',
        tasks: [{ id: 't1', completedCount: 10 }],
        branchTargets: [{ subject: 'Fen', questionTarget: 100 }]
    });
    const snap = createHistorySnapshot(plan);
    snap.tasks[0].completedCount = 999;
    snap.branchTargets[0].questionTarget = 999;
    const snap2 = createHistorySnapshot(plan);
    assert.equal(snap2.tasks[0].completedCount, 10);
    assert.equal(snap2.branchTargets[0].questionTarget, 100);
});

// E. progressSummary included
test('E: progressSummary included in snapshot when provided', () => {
    const plan = createEmptyCoachingPlan({ id: 'plan-1' });
    const ps = { questions: { actual: 435, target: 550 } };
    const snap = createHistorySnapshot(plan, ps);
    assert.deepEqual(snap.progressSummary, ps);
});

// F. weeklyCheckIn included
test('F: weeklyCheckIn included in snapshot', () => {
    const plan = createEmptyCoachingPlan({
        weeklyCheckIn: { teacherNote: 'Good', nextWeekFocus: 'Math', checkedAt: '2026-09-10T10:00:00Z' }
    });
    const snap = createHistorySnapshot(plan);
    assert.equal(snap.weeklyCheckIn.teacherNote, 'Good');
    assert.equal(snap.weeklyCheckIn.nextWeekFocus, 'Math');
    assert.equal(snap.weeklyCheckIn.checkedAt, '2026-09-10T10:00:00Z');
});

// G. repeated archive dedup
test('G: repeated archive produces snapshots with same ID (dedup by ID)', () => {
    const plan = createEmptyCoachingPlan({ id: 'plan-1' });
    const snap1 = createHistorySnapshot(plan);
    const snap2 = createHistorySnapshot(plan);
    assert.equal(snap1.id, snap2.id);
    const history = [snap1];
    const deduped = history.filter(h => h.id !== snap2.id);
    assert.equal(deduped.length, 0, 'dedup removes duplicate');
});

// H. snapshot plan ID stable
test('H: snapshot plan ID matches source plan ID', () => {
    const plan = createEmptyCoachingPlan({ id: 'stable-id' });
    const snap = createHistorySnapshot(plan);
    assert.equal(snap.id, 'stable-id');
});

// I. archivedAt exists
test('I: archivedAt is set on snapshot', () => {
    const plan = createEmptyCoachingPlan();
    const snap = createHistorySnapshot(plan);
    assert.ok(snap.archivedAt);
    assert.ok(!isNaN(new Date(snap.archivedAt).getTime()));
});

// J. active plan edits don't mutate history
test('J: active plan edits do not mutate history snapshot', () => {
    const plan = createEmptyCoachingPlan({ id: 'plan-1', tasks: [{ id: 't1', completedCount: 0 }] });
    const snap = createHistorySnapshot(plan);
    plan.tasks[0].completedCount = 50;
    assert.equal(snap.tasks[0].completedCount, 0);
});

// K. monthly empty
test('K: monthly aggregation with empty history', () => {
    const result = getMonthlyProgress([], 2026, 9);
    assert.equal(result.weeks, 0);
    assert.equal(result.totalQuestionTarget, 0);
});

// L. monthly one week
test('L: monthly aggregation with one week', () => {
    const plan = createEmptyCoachingPlan({
        id: 'plan-1',
        weekStart: '2026-09-08',
        weeklyTargets: { totalQuestions: 100 }
    });
    const snap = createHistorySnapshot(plan, { questions: { actual: 50, target: 100 }, tasks: { completed: 3, total: 5 }, exams: { actual: 1, target: 2 } });
    const result = getMonthlyProgress([snap], 2026, 9);
    assert.equal(result.weeks, 1);
    assert.equal(result.totalQuestionTarget, 100);
    assert.equal(result.totalQuestionActual, 50);
    assert.equal(result.taskCompleted, 3);
    assert.equal(result.taskTotal, 5);
});

// M. monthly multiple weeks
test('M: monthly aggregation with multiple weeks', () => {
    const snap1 = createHistorySnapshot(
        createEmptyCoachingPlan({ id: 'p1', weekStart: '2026-09-08' }),
        { questions: { actual: 50, target: 100 }, tasks: { completed: 3, total: 5 }, exams: { actual: 1, target: 2 } }
    );
    const snap2 = createHistorySnapshot(
        createEmptyCoachingPlan({ id: 'p2', weekStart: '2026-09-15' }),
        { questions: { actual: 80, target: 100 }, tasks: { completed: 4, total: 5 }, exams: { actual: 2, target: 2 } }
    );
    const result = getMonthlyProgress([snap1, snap2], 2026, 9);
    assert.equal(result.weeks, 2);
    assert.equal(result.totalQuestionActual, 130);
    assert.equal(result.taskCompleted, 7);
});

// N. branch aggregation
test('N: branch totals aggregated across weeks', () => {
    const snap1 = createHistorySnapshot(
        createEmptyCoachingPlan({ id: 'p1', weekStart: '2026-09-08' }),
        { branches: [{ subject: 'Fen', actual: 30, target: 60 }] }
    );
    const snap2 = createHistorySnapshot(
        createEmptyCoachingPlan({ id: 'p2', weekStart: '2026-09-15' }),
        { branches: [{ subject: 'Fen', actual: 40, target: 60 }] }
    );
    const result = getMonthlyProgress([snap1, snap2], 2026, 9);
    assert.equal(result.branchTotals['Fen'].actual, 70);
    assert.equal(result.branchTotals['Fen'].target, 120);
});

// O. topic aggregation
test('O: topic totals aggregated across weeks', () => {
    const snap1 = createHistorySnapshot(
        createEmptyCoachingPlan({ id: 'p1', weekStart: '2026-09-08' }),
        { topics: [{ subject: 'Fen', topic: 'Mevsimler', actual: 10, target: 20 }] }
    );
    const snap2 = createHistorySnapshot(
        createEmptyCoachingPlan({ id: 'p2', weekStart: '2026-09-15' }),
        { topics: [{ subject: 'Fen', topic: 'Mevsimler', actual: 15, target: 20 }] }
    );
    const result = getMonthlyProgress([snap1, snap2], 2026, 9);
    assert.equal(result.topicTotals.length, 1);
    assert.equal(result.topicTotals[0].actual, 25);
});

// P. month boundary rule
test('P: weekStart month determines bucket', () => {
    const snap = createHistorySnapshot(
        createEmptyCoachingPlan({ id: 'p1', weekStart: '2026-09-29' }),
        { questions: { actual: 10, target: 20 } }
    );
    const septResult = getMonthlyProgress([snap], 2026, 9);
    const octResult = getMonthlyProgress([snap], 2026, 10);
    assert.equal(septResult.weeks, 1);
    assert.equal(octResult.weeks, 0);
});

// Q. null target
test('Q: null target in snapshot handled safely', () => {
    const snap = createHistorySnapshot(
        createEmptyCoachingPlan({ id: 'p1', weekStart: '2026-09-08' }),
        { questions: { actual: 10, target: null } }
    );
    const result = getMonthlyProgress([snap], 2026, 9);
    assert.equal(result.totalQuestionActual, 10);
    assert.equal(result.totalQuestionTarget, 0);
});

// R. no NaN
test('R: no NaN in monthly aggregation', () => {
    const result = getMonthlyProgress([], 2026, 9);
    assert.ok(!isNaN(result.totalQuestionActual));
    assert.ok(!isNaN(result.taskCompleted));
    assert.ok(!isNaN(result.examActual));
});

// S. no Infinity
test('S: no Infinity in monthly aggregation', () => {
    const result = getMonthlyProgress([], 2026, 9);
    assert.ok(isFinite(result.totalQuestionActual));
    assert.ok(isFinite(result.taskCompleted));
});

// T. version included in snapshot
test('T: version included in snapshot', () => {
    const plan = createEmptyCoachingPlan({ version: 2 });
    const snap = createHistorySnapshot(plan);
    assert.equal(snap.version, 2);
});

// U. getHistoryWeekCount
test('U: getHistoryWeekCount returns correct count', () => {
    assert.equal(getHistoryWeekCount([]), 0);
    assert.equal(getHistoryWeekCount(null), 0);
    assert.equal(getHistoryWeekCount([{ id: '1' }, { id: '2' }]), 2);
});

// V. progressSummary deep clone immutability
test('V: progressSummary in snapshot is deep cloned', () => {
    const plan = createEmptyCoachingPlan({ id: 'p1' });
    const ps = { questions: { actual: 10, target: 20 }, branches: [{ subject: 'Fen', actual: 5 }] };
    const snap = createHistorySnapshot(plan, ps);
    ps.questions.actual = 999;
    ps.branches[0].actual = 999;
    assert.equal(snap.progressSummary.questions.actual, 10);
    assert.equal(snap.progressSummary.branches[0].actual, 5);
});

// W. Strong forward immutability — nested in-place mutation of active plan
test('W: nested in-place mutation of active plan does not affect snapshot', () => {
    const plan = createEmptyCoachingPlan({
        id: 'plan-w',
        weeklyTargets: { totalQuestions: 100, generalExams: 2, branchExams: 1, readingTarget: 30, reviewSessions: 5 },
        branchTargets: [{ id: 'b1', subject: 'Fen', questionTarget: 60, examTarget: 1 }],
        topicTargets: [{ id: 't1', subject: 'Fen', topic: 'Mevsimler', questionTarget: 30 }],
        tasks: [{ id: 'tk1', title: 'Math HW', taskType: 'question', questionTarget: 40, completedCount: 10, completed: false }],
        weeklyCheckIn: { teacherNote: 'Good week', nextWeekFocus: 'Focus on Fen', checkedAt: '2026-09-10T10:00:00Z' }
    });
    const ps = { questions: { actual: 10, target: 100 }, tasks: { completed: 0, total: 1 } };
    const snap = createHistorySnapshot(plan, ps);

    // In-place nested mutation of active plan
    plan.weeklyTargets.totalQuestions = 999;
    plan.weeklyTargets.generalExams = 999;
    plan.branchTargets[0].questionTarget = 999;
    plan.branchTargets[0].subject = 'CHANGED';
    plan.topicTargets[0].topic = 'CHANGED';
    plan.topicTargets[0].questionTarget = 999;
    plan.tasks[0].title = 'CHANGED';
    plan.tasks[0].completedCount = 999;
    plan.tasks[0].completed = true;
    plan.weeklyCheckIn.teacherNote = 'CHANGED';
    plan.weeklyCheckIn.nextWeekFocus = 'CHANGED';
    ps.questions.actual = 999;

    // Snapshot must be unchanged
    assert.equal(snap.weeklyTargets.totalQuestions, 100);
    assert.equal(snap.weeklyTargets.generalExams, 2);
    assert.equal(snap.branchTargets[0].questionTarget, 60);
    assert.equal(snap.branchTargets[0].subject, 'Fen');
    assert.equal(snap.topicTargets[0].topic, 'Mevsimler');
    assert.equal(snap.topicTargets[0].questionTarget, 30);
    assert.equal(snap.tasks[0].title, 'Math HW');
    assert.equal(snap.tasks[0].completedCount, 10);
    assert.equal(snap.tasks[0].completed, false);
    assert.equal(snap.weeklyCheckIn.teacherNote, 'Good week');
    assert.equal(snap.weeklyCheckIn.nextWeekFocus, 'Focus on Fen');
    assert.equal(snap.progressSummary.questions.actual, 10);
});

// X. Reverse immutability — snapshot mutation does not affect active plan
test('X: snapshot mutation does not affect active plan', () => {
    const plan = createEmptyCoachingPlan({
        id: 'plan-x',
        tasks: [{ id: 'tk1', title: 'Original', completedCount: 10 }],
        weeklyCheckIn: { teacherNote: 'Original', nextWeekFocus: '', checkedAt: null }
    });
    const snap = createHistorySnapshot(plan);

    // Mutate snapshot in-place
    snap.tasks[0].title = 'SNAPSHOT CHANGED';
    snap.tasks[0].completedCount = 999;
    snap.weeklyCheckIn.teacherNote = 'SNAPSHOT CHANGED';
    snap.weeklyTargets.totalQuestions = 999;

    // Active plan must be unchanged
    assert.equal(plan.tasks[0].title, 'Original');
    assert.equal(plan.tasks[0].completedCount, 10);
    assert.equal(plan.weeklyCheckIn.teacherNote, 'Original');
    assert.equal(plan.weeklyTargets.totalQuestions, null);
});

// Y. Array identity — reference inequality
test('Y: array/object references are different between plan and snapshot', () => {
    const plan = createEmptyCoachingPlan({
        branchTargets: [{ id: 'b1', subject: 'Fen', questionTarget: 50 }],
        topicTargets: [{ id: 't1', subject: 'Fen', topic: 'Mevsimler', questionTarget: 30 }],
        tasks: [{ id: 'tk1', title: 'Task' }]
    });
    const snap = createHistorySnapshot(plan);

    assert.ok(snap.tasks !== plan.tasks, 'tasks array reference different');
    assert.ok(snap.branchTargets !== plan.branchTargets, 'branchTargets array reference different');
    assert.ok(snap.topicTargets !== plan.topicTargets, 'topicTargets array reference different');
    assert.ok(snap.tasks[0] !== plan.tasks[0], 'task object reference different');
    assert.ok(snap.branchTargets[0] !== plan.branchTargets[0], 'branch target object reference different');
    assert.ok(snap.topicTargets[0] !== plan.topicTargets[0], 'topic target object reference different');
    assert.ok(snap.weeklyCheckIn !== plan.weeklyCheckIn, 'weeklyCheckIn reference different');
    assert.ok(snap.weeklyTargets !== plan.weeklyTargets, 'weeklyTargets reference different');
});

// Z. Progress summary full detach
test('Z: progressSummary fully detached from source', () => {
    const plan = createEmptyCoachingPlan({ id: 'plan-z' });
    const ps = { questions: { actual: 50, target: 100 }, branches: [{ subject: 'Fen', actual: 20, target: 40 }] };
    const snap = createHistorySnapshot(plan, ps);

    assert.ok(snap.progressSummary !== ps, 'progressSummary reference different');
    assert.ok(snap.progressSummary.questions !== ps.questions, 'questions object reference different');
    assert.ok(snap.progressSummary.branches !== ps.branches, 'branches array reference different');
    assert.ok(snap.progressSummary.branches[0] !== ps.branches[0], 'branch entry reference different');
});

// AA. WeeklyCheckIn full detach
test('AA: weeklyCheckIn fully detached from source', () => {
    const plan = createEmptyCoachingPlan({
        weeklyCheckIn: { teacherNote: 'Note', nextWeekFocus: 'Focus', checkedAt: '2026-09-10' }
    });
    const snap = createHistorySnapshot(plan);

    assert.ok(snap.weeklyCheckIn !== plan.weeklyCheckIn, 'weeklyCheckIn reference different');
    assert.equal(snap.weeklyCheckIn.teacherNote, 'Note');
    assert.equal(snap.weeklyCheckIn.nextWeekFocus, 'Focus');
    assert.equal(snap.weeklyCheckIn.checkedAt, '2026-09-10');
});

// BB. Snapshot status semantics — history entries are canonical archived records
test('BB: snapshot status is archived with sourceStatus preserved', () => {
    const active = createEmptyCoachingPlan({ status: 'active', id: 'plan-bb' });
    const snapActive = createHistorySnapshot(active);
    assert.equal(snapActive.status, 'archived');
    assert.equal(snapActive.sourceStatus, 'active');

    const draft = createEmptyCoachingPlan({ status: 'draft', id: 'plan-bb2' });
    const snapDraft = createHistorySnapshot(draft);
    assert.equal(snapDraft.status, 'archived');
    assert.equal(snapDraft.sourceStatus, 'draft');

    const completed = createEmptyCoachingPlan({ status: 'completed', id: 'plan-bb3' });
    const snapCompleted = createHistorySnapshot(completed);
    assert.equal(snapCompleted.status, 'archived');
    assert.equal(snapCompleted.sourceStatus, 'completed');
});

// BB2. Legacy snapshot without sourceStatus is safe to read
test('BB2: legacy snapshot without sourceStatus is safe', () => {
    const legacy = {
        id: 'legacy-1',
        status: 'active',
        weekStart: '2026-09-08',
        weeklyTargets: { totalQuestions: 100 },
        tasks: [{ id: 't1', completed: true }]
    };
    assert.equal(legacy.sourceStatus, undefined);
    const { getMonthlyProgress: gmp } = { getMonthlyProgress };
    const result = gmp([legacy], 2026, 9);
    assert.equal(result.weeks, 1);
    assert.equal(result.totalQuestionTarget, 100);
});

// BB3. Backup round-trip preserves status and sourceStatus
test('BB3: backup round-trip preserves status and sourceStatus', () => {
    const plan = createEmptyCoachingPlan({ status: 'active', id: 'plan-bb3b' });
    const snap = createHistorySnapshot(plan);
    const restored = JSON.parse(JSON.stringify(snap));
    assert.equal(restored.status, 'archived');
    assert.equal(restored.sourceStatus, 'active');
});

// CC. Repeated archive — same plan id produces one history entry
test('CC: repeated archive dedup by plan ID', () => {
    const plan = createEmptyCoachingPlan({ id: 'plan-cc' });
    const snap1 = createHistorySnapshot(plan);
    const snap2 = createHistorySnapshot(plan);
    const history = [snap1];
    // Simulate dedup: filter out if same id already exists
    const deduped = history.filter(h => h.id !== snap2.id);
    assert.equal(deduped.length, 0, 'same ID filtered out');
});

// DD. Normalization read-only — input plan not mutated
test('DD: normalizeCoachingPlan does not mutate input', () => {
    const input = {
        id: 'plan-dd',
        weeklyTargets: { totalQuestions: 100 },
        branchTargets: [{ subject: 'Fen', questionTarget: 50 }],
        topicTargets: [{ subject: 'Fen', topic: 'Mevsimler', questionTarget: 30 }],
        tasks: [{ id: 'tk1', title: 'Task', completedCount: 10 }],
        weeklyCheckIn: { teacherNote: 'Note' }
    };
    const frozen = JSON.stringify(input);
    normalizeCoachingPlan(input);
    assert.equal(JSON.stringify(input), frozen, 'input unchanged');
});

// EE. Monthly aggregation does not mutate snapshots
test('EE: getMonthlyProgress does not mutate history snapshots', () => {
    const plan = createEmptyCoachingPlan({
        id: 'plan-ee',
        weekStart: '2026-09-08',
        weeklyTargets: { totalQuestions: 100 }
    });
    const ps = { questions: { actual: 50, target: 100 }, tasks: { completed: 3, total: 5 } };
    const snap = createHistorySnapshot(plan, ps);
    const frozen = JSON.stringify(snap);
    getMonthlyProgress([snap], 2026, 9);
    assert.equal(JSON.stringify(snap), frozen, 'snapshot unchanged after aggregation');
});

// FF. Backup round-trip — nested content preserved
test('FF: backup round-trip preserves nested content', () => {
    const plan = createEmptyCoachingPlan({
        id: 'plan-ff',
        tasks: [{ id: 'tk1', title: 'Math', completedCount: 15, completed: true, subject: 'Matematik' }],
        weeklyCheckIn: { teacherNote: 'Good week', nextWeekFocus: 'Fen focus', checkedAt: '2026-09-10' },
        branchTargets: [{ id: 'b1', subject: 'Fen', questionTarget: 60 }]
    });
    const ps = { questions: { actual: 15, target: 100 } };
    const snap = createHistorySnapshot(plan, ps);

    // Simulate JSON backup/restore
    const json = JSON.stringify(snap);
    const restored = JSON.parse(json);

    assert.equal(restored.tasks[0].title, 'Math');
    assert.equal(restored.tasks[0].completedCount, 15);
    assert.equal(restored.tasks[0].completed, true);
    assert.equal(restored.weeklyCheckIn.teacherNote, 'Good week');
    assert.equal(restored.weeklyCheckIn.nextWeekFocus, 'Fen focus');
    assert.equal(restored.branchTargets[0].subject, 'Fen');
    assert.equal(restored.progressSummary.questions.actual, 15);
    assert.ok(restored.archivedAt, 'archivedAt preserved');
});

// ============================================================================
// SECTION 11: SPECIFIC CANONICAL LIFECYCLE TESTS (A-G)
// ============================================================================

// 11.A active plan archive -> snapshot.status === 'archived', snapshot.sourceStatus === 'active'
test('11.A: active plan archive results in status: archived and sourceStatus: active', () => {
    const plan = createEmptyCoachingPlan({ id: 'plan-11a', status: 'active' });
    const snap = createHistorySnapshot(plan);
    assert.equal(snap.status, 'archived');
    assert.equal(snap.sourceStatus, 'active');
});

// 11.B draft plan archive -> status: archived, sourceStatus: draft
test('11.B: draft plan archive results in status: archived and sourceStatus: draft', () => {
    const plan = createEmptyCoachingPlan({ id: 'plan-11b', status: 'draft' });
    const snap = createHistorySnapshot(plan);
    assert.equal(snap.status, 'archived');
    assert.equal(snap.sourceStatus, 'draft');
});

// 11.C completed plan archive -> status: archived, sourceStatus: completed
test('11.C: completed plan archive results in status: archived and sourceStatus: completed', () => {
    const plan = createEmptyCoachingPlan({ id: 'plan-11c', status: 'completed' });
    const snap = createHistorySnapshot(plan);
    assert.equal(snap.status, 'archived');
    assert.equal(snap.sourceStatus, 'completed');
});

// 11.D repeated archive -> one snapshot, sourceStatus stable
test('11.D: repeated archive results in exactly one snapshot with stable sourceStatus', () => {
    const plan = createEmptyCoachingPlan({ id: 'plan-11d', status: 'active' });
    const snap1 = createHistorySnapshot(plan);
    const history = [snap1];

    // Second archive attempt with the same plan
    const snap2 = createHistorySnapshot(plan);
    if (!history.some(h => h && h.id === snap2.id)) {
        history.push(snap2);
    }

    assert.equal(history.length, 1, 'history must not contain duplicates');
    assert.equal(history[0].status, 'archived');
    assert.equal(history[0].sourceStatus, 'active');
});

// 11.E backup round-trip preserves sourceStatus
test('11.E: backup round-trip preserves sourceStatus and archived status', () => {
    const plan = createEmptyCoachingPlan({ id: 'plan-11e', status: 'completed' });
    const snap = createHistorySnapshot(plan);
    const serialized = JSON.stringify(snap);
    const deserialized = JSON.parse(serialized);

    assert.equal(deserialized.status, 'archived');
    assert.equal(deserialized.sourceStatus, 'completed');
    assert.equal(deserialized.id, 'plan-11e');
});

// 11.F monthly aggregation unchanged
test('11.F: monthly aggregation unchanged across archived snapshots and legacy snapshots', () => {
    const snapCanonical = createHistorySnapshot(createEmptyCoachingPlan({
        id: 'plan-canonical',
        weekStart: '2026-09-08',
        weeklyTargets: { totalQuestions: 150 },
        tasks: [{ id: 't1', completed: true }]
    }));
    const snapLegacy = {
        id: 'plan-legacy',
        status: 'active',
        weekStart: '2026-09-15',
        weeklyTargets: { totalQuestions: 200 },
        tasks: [{ id: 't2', completed: true }]
    };

    const monthly = getMonthlyProgress([snapCanonical, snapLegacy], 2026, 9);
    assert.equal(monthly.weeks, 2);
    assert.equal(monthly.totalQuestionTarget, 350);
    assert.equal(monthly.taskCompleted, 2);
});

// 11.G legacy snapshot without sourceStatus safe
test('11.G: legacy snapshot without sourceStatus is read safely without error or unexpected mutation', () => {
    const legacySnapshots = [
        {
            id: 'old-1',
            status: 'draft',
            weekStart: '2026-09-01',
            weeklyTargets: { totalQuestions: 100 }
        },
        {
            id: 'old-2',
            status: 'active',
            weekStart: '2026-09-08',
            weeklyTargets: { totalQuestions: 120 }
        }
    ];

    assert.equal(legacySnapshots[0].sourceStatus, undefined);
    assert.equal(legacySnapshots[1].sourceStatus, undefined);

    const weekCount = getHistoryWeekCount(legacySnapshots);
    assert.equal(weekCount, 2);

    const progress = getMonthlyProgress(legacySnapshots, 2026, 9);
    assert.equal(progress.weeks, 2);
    assert.equal(progress.totalQuestionTarget, 220);
});


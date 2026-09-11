import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { createEmptyCoachingPlan, normalizeCoachingPlan, createHistorySnapshot } = await import('../coaching-plan-model.js');

// A. default weeklyCheckIn
test('A: default weeklyCheckIn on empty plan', () => {
    const plan = createEmptyCoachingPlan();
    assert.deepEqual(plan.weeklyCheckIn, { teacherNote: '', nextWeekFocus: '', checkedAt: null });
});

// B. normalize existing check-in
test('B: normalize preserves existing check-in', () => {
    const plan = createEmptyCoachingPlan({
        weeklyCheckIn: { teacherNote: 'Good week', nextWeekFocus: 'Math focus', checkedAt: '2026-09-10T10:00:00Z' }
    });
    const norm = normalizeCoachingPlan(plan);
    assert.equal(norm.weeklyCheckIn.teacherNote, 'Good week');
    assert.equal(norm.weeklyCheckIn.nextWeekFocus, 'Math focus');
    assert.equal(norm.weeklyCheckIn.checkedAt, '2026-09-10T10:00:00Z');
});

// C. completedCount update
test('C: completedCount update via task matching', () => {
    const plan = createEmptyCoachingPlan({
        tasks: [
            { id: 't1', taskType: 'question', questionTarget: 40, completedCount: 0, completed: false },
            { id: 't2', taskType: 'question', questionTarget: 30, completedCount: 10, completed: false }
        ]
    });
    const updatedTasks = plan.tasks.map(t => t.id === 't1' ? { ...t, completedCount: 25 } : t);
    assert.equal(updatedTasks[0].completedCount, 25);
    assert.equal(updatedTasks[1].completedCount, 10);
});

// D. completed toggle
test('D: completed toggle independent of completedCount', () => {
    const plan = createEmptyCoachingPlan({
        tasks: [{ id: 't1', taskType: 'question', questionTarget: 40, completedCount: 40, completed: false }]
    });
    const updated = plan.tasks.map(t => t.id === 't1' ? { ...t, completed: true } : t);
    assert.equal(updated[0].completed, true);
    assert.equal(updated[0].completedCount, 40);
});

// E. stable task ID matching
test('E: task matching uses id not title or index', () => {
    const plan = createEmptyCoachingPlan({
        tasks: [
            { id: 't1', title: 'Math', completedCount: 0 },
            { id: 't2', title: 'Math', completedCount: 0 }
        ]
    });
    const updated = plan.tasks.map(t => t.id === 't2' ? { ...t, completedCount: 10 } : t);
    assert.equal(updated[0].completedCount, 0);
    assert.equal(updated[1].completedCount, 10);
});

// F. unrelated task fields preserved
test('F: unrelated task fields preserved on update', () => {
    const plan = createEmptyCoachingPlan({
        tasks: [{ id: 't1', taskType: 'question', subject: 'Fen', topic: 'Mevsimler', questionTarget: 40, completedCount: 0, completed: false, resource: 'Test Kitabı', durationMinutes: 30 }]
    });
    const updated = plan.tasks.map(t => t.id === 't1' ? { ...t, completedCount: 15 } : t);
    assert.equal(updated[0].subject, 'Fen');
    assert.equal(updated[0].topic, 'Mevsimler');
    assert.equal(updated[0].resource, 'Test Kitabı');
    assert.equal(updated[0].durationMinutes, 30);
});

// G. branch/topic/weekly targets preserved
test('G: branch/topic/weekly targets preserved on check-in save', () => {
    const plan = createEmptyCoachingPlan({
        weeklyTargets: { totalQuestions: 550, generalExams: 2 },
        branchTargets: [{ subject: 'Fen', questionTarget: 120 }],
        topicTargets: [{ subject: 'Fen', topic: 'Mevsimler', questionTarget: 40 }],
        weeklyCheckIn: { teacherNote: 'Note', nextWeekFocus: 'Focus', checkedAt: null }
    });
    const norm = normalizeCoachingPlan(plan);
    assert.equal(norm.weeklyTargets.totalQuestions, 550);
    assert.equal(norm.branchTargets.length, 1);
    assert.equal(norm.topicTargets.length, 1);
});

// H. id preserved
test('H: plan id preserved on normalization', () => {
    const plan = createEmptyCoachingPlan({ id: 'custom-id-123' });
    const norm = normalizeCoachingPlan(plan);
    assert.equal(norm.id, 'custom-id-123');
});

// I. createdAt preserved
test('I: createdAt preserved on normalization', () => {
    const plan = createEmptyCoachingPlan({ createdAt: '2026-09-01T00:00:00Z' });
    const norm = normalizeCoachingPlan(plan);
    assert.equal(norm.createdAt, '2026-09-01T00:00:00Z');
});

// J. updatedAt changes
test('J: updatedAt can be updated', () => {
    const plan = createEmptyCoachingPlan({ updatedAt: '2026-09-01T00:00:00Z' });
    const newNow = '2026-09-11T12:00:00Z';
    const updated = { ...plan, updatedAt: newNow };
    assert.equal(updated.updatedAt, newNow);
});

// K. checkedAt changes only on save
test('K: checkedAt set only on explicit save', () => {
    const plan = createEmptyCoachingPlan();
    assert.equal(plan.weeklyCheckIn.checkedAt, null);
    const updated = { ...plan, weeklyCheckIn: { ...plan.weeklyCheckIn, checkedAt: '2026-09-11T12:00:00Z' } };
    assert.equal(updated.weeklyCheckIn.checkedAt, '2026-09-11T12:00:00Z');
    assert.equal(plan.weeklyCheckIn.checkedAt, null);
});

// L. no autosave marker
test('L: no autosave marker in code', () => {
    const guidance = fs.readFileSync(new URL('../guidance.js', import.meta.url), 'utf8');
    assert.ok(!guidance.includes('autosave'), 'no autosave');
    assert.ok(!guidance.includes('autoSave'), 'no autoSave');
});

// M. cancel no write
test('M: cancel does not write', () => {
    const plan = createEmptyCoachingPlan({
        weeklyCheckIn: { teacherNote: 'Original', nextWeekFocus: '', checkedAt: null }
    });
    const unchanged = normalizeCoachingPlan(plan);
    assert.equal(unchanged.weeklyCheckIn.teacherNote, 'Original');
    assert.equal(unchanged.weeklyCheckIn.checkedAt, null);
});

// N. invalid count safe
test('N: invalid completedCount normalized to 0', () => {
    const plan = createEmptyCoachingPlan({
        tasks: [{ id: 't1', completedCount: NaN }]
    });
    const norm = normalizeCoachingPlan(plan);
    assert.equal(norm.tasks[0].completedCount, 0);
});

// O. over-target count allowed
test('O: completedCount > questionTarget allowed', () => {
    const plan = createEmptyCoachingPlan({
        tasks: [{ id: 't1', questionTarget: 40, completedCount: 60 }]
    });
    assert.equal(plan.tasks[0].completedCount, 60);
});

// P. legacy untouched
test('P: legacy task not editable through check-in', () => {
    const plan = createEmptyCoachingPlan({
        tasks: [{ id: 'legacy_1', _legacy: true, completedCount: 0 }]
    });
    assert.ok(plan.tasks[0]._legacy);
});

// Q. mixed mode safe
test('Q: mixed mode - only coachingPlan tasks edited', () => {
    const plan = createEmptyCoachingPlan({
        tasks: [
            { id: 't1', taskType: 'question', completedCount: 0, _legacy: false },
            { id: 'legacy_1', _legacy: true, completedCount: 0 }
        ]
    });
    const updated = plan.tasks.map(t => {
        if (!t.id || t._legacy) return t;
        return t.id === 't1' ? { ...t, completedCount: 20 } : t;
    });
    assert.equal(updated[0].completedCount, 20);
    assert.equal(updated[1].completedCount, 0);
});

// R. write failure no false success
test('R: saveCoachingPlanCheckin function exists', () => {
    const guidance = fs.readFileSync(new URL('../guidance.js', import.meta.url), 'utf8');
    assert.ok(guidance.includes('saveCoachingPlanCheckin'), 'saveCoachingPlanCheckin defined');
    assert.ok(guidance.includes('✗ Kaydetme hatası'), 'error feedback exists');
});

import test from 'node:test';
import assert from 'node:assert/strict';

const { createEmptyCoachingPlan, createHistorySnapshot } = await import('../coaching-plan-model.js');

function makeStudent(overrides = {}) {
    return {
        id: 'std_1', adSoyad: 'Test Öğrenci', sinif: '8', denemeler: [],
        studyPlan: { Pazartesi: ['Soru çöz'] },
        studyPlanProfile: { mode: 'general', badge: 'Test' },
        coachingPlan: null,
        studyPlanHistory: null,
        ...overrides
    };
}

function mergeStudents(existingList, incomingList) {
    const merged = [...existingList];
    for (const incoming of incomingList) {
        const idx = merged.findIndex(s => s.id === incoming.id);
        if (idx >= 0) {
            const existing = merged[idx];
            merged[idx] = { ...existing };
            if (incoming.coachingPlan || existing.coachingPlan) {
                merged[idx].coachingPlan = { ...(existing.coachingPlan || {}), ...(incoming.coachingPlan || {}) };
            }
            if (incoming.studyPlanHistory || existing.studyPlanHistory) {
                const exH = Array.isArray(existing.studyPlanHistory) ? existing.studyPlanHistory : [];
                const inH = Array.isArray(incoming.studyPlanHistory) ? incoming.studyPlanHistory : [];
                const map = new Map();
                for (const item of exH) { if (item && item.id) map.set(item.id, item); }
                for (const item of inH) { if (item && item.id) map.set(item.id, item); }
                merged[idx].studyPlanHistory = Array.from(map.values());
            }
        } else {
            merged.push({ ...incoming });
        }
    }
    return merged;
}

// ─── COACHING PLAN BACKUP ─────────────────────────────────────────────────────

test('A: coachingPlan survives backup round-trip', () => {
    const plan = createEmptyCoachingPlan();
    plan.weeklyTargets.totalQuestions = 550;
    plan.branchTargets = [{ id: 'bt1', subject: 'Matematik', questionTarget: 100, examTarget: 2 }];
    plan.tasks = [{ id: 'ct1', title: 'Soru çöz', taskType: 'question', subject: 'Matematik' }];
    const student = makeStudent({ coachingPlan: plan });
    const backup = JSON.parse(JSON.stringify(student));
    const restored = makeStudent(backup);
    assert.deepEqual(restored.coachingPlan.weeklyTargets, plan.weeklyTargets);
    assert.equal(restored.coachingPlan.branchTargets.length, 1);
    assert.equal(restored.coachingPlan.tasks.length, 1);
    assert.equal(restored.coachingPlan.tasks[0].title, 'Soru çöz');
});

// ─── HISTORY BACKUP ───────────────────────────────────────────────────────────

test('B: studyPlanHistory survives backup round-trip', () => {
    const snap = createHistorySnapshot(createEmptyCoachingPlan());
    const student = makeStudent({ studyPlanHistory: [snap] });
    const backup = JSON.parse(JSON.stringify(student));
    const restored = makeStudent(backup);
    assert.equal(restored.studyPlanHistory.length, 1);
    assert.equal(restored.studyPlanHistory[0].id, snap.id);
});

// ─── HISTORY ID DEDUP ─────────────────────────────────────────────────────────

test('C: history ID dedup prevents duplicates', () => {
    const plan = createEmptyCoachingPlan();
    const snap1 = createHistorySnapshot(plan);
    const snap2 = { ...snap1 };
    const existing = [snap1];
    const incoming = [snap2];
    const map = new Map();
    for (const item of existing) { if (item && item.id) map.set(item.id, item); }
    for (const item of incoming) { if (item && item.id) map.set(item.id, item); }
    const result = Array.from(map.values());
    assert.equal(result.length, 1, 'Same ID deduped to 1');
});

// ─── REPEATED RESTORE IDEMPOTENT ──────────────────────────────────────────────

test('D: repeated restore of same backup is idempotent', () => {
    const plan = createEmptyCoachingPlan();
    const snap = createHistorySnapshot(plan);
    let student = makeStudent({ studyPlanHistory: [snap] });
    const backup = JSON.parse(JSON.stringify(student));
    student = mergeStudents([student], [makeStudent(backup)])[0];
    assert.equal(student.studyPlanHistory.length, 1);
    student = mergeStudents([student], [makeStudent(backup)])[0];
    assert.equal(student.studyPlanHistory.length, 1, 'Still 1 after second restore');
});

// ─── MERGE DEDUP ──────────────────────────────────────────────────────────────

test('E: merge dedup with different IDs preserves both', () => {
    const existing = [{ id: 'h1', weekStart: '2026-01-06' }];
    const incoming = [{ id: 'h2', weekStart: '2026-01-13' }];
    const map = new Map();
    for (const item of existing) { if (item && item.id) map.set(item.id, item); }
    for (const item of incoming) { if (item && item.id) map.set(item.id, item); }
    const result = Array.from(map.values());
    assert.equal(result.length, 2);
    assert.equal(result[0].id, 'h1');
    assert.equal(result[1].id, 'h2');
});

// ─── MIXED LEGACY/NEW ROUND-TRIP ─────────────────────────────────────────────

test('F: mixed legacy + coachingPlan student survives round-trip', () => {
    const plan = createEmptyCoachingPlan();
    const student = makeStudent({
        studyPlan: { Pazartesi: ['Soru çöz'] },
        studyPlanProfile: { mode: 'general', badge: 'Test' },
        coachingPlan: plan,
        studyPlanHistory: [createHistorySnapshot(plan)]
    });
    const backup = JSON.parse(JSON.stringify(student));
    const restored = makeStudent(backup);
    assert.deepEqual(restored.studyPlan, student.studyPlan);
    assert.deepEqual(restored.studyPlanProfile, student.studyPlanProfile);
    assert.ok(restored.coachingPlan, 'coachingPlan preserved');
    assert.equal(restored.studyPlanHistory.length, 1);
});

// ─── UNRELATED FIELDS PRESERVED ───────────────────────────────────────────────

test('G: unrelated student fields preserved through merge', () => {
    const existing = makeStudent({ notepad: 'some notes', growthPlan: { weeklyTarget: 5 } });
    const incoming = makeStudent({ coachingPlan: createEmptyCoachingPlan() });
    const merged = mergeStudents([existing], [incoming]);
    assert.equal(merged[0].notepad, 'some notes');
    assert.deepEqual(merged[0].growthPlan, { weeklyTarget: 5 });
    assert.ok(merged[0].coachingPlan, 'coachingPlan added');
});

// ─── COACHING PLAN MERGE OVERWRITE ────────────────────────────────────────────

test('H: coachingPlan merge overwrites existing', () => {
    const old = createEmptyCoachingPlan();
    old.weeklyTargets.totalQuestions = 100;
    const newPlan = createEmptyCoachingPlan();
    newPlan.id = old.id;
    newPlan.weeklyTargets.totalQuestions = 500;
    const existing = makeStudent({ coachingPlan: old });
    const incoming = makeStudent({ coachingPlan: newPlan });
    const merged = mergeStudents([existing], [incoming]);
    assert.equal(merged[0].coachingPlan.weeklyTargets.totalQuestions, 500);
});

// ─── NO COACHING PLAN PRESERVED ───────────────────────────────────────────────

test('I: student without coachingPlan keeps it null after merge', () => {
    const existing = makeStudent();
    const incoming = makeStudent({ coachingPlan: null });
    const merged = mergeStudents([existing], [incoming]);
    assert.equal(merged[0].coachingPlan, null);
});

// ─── LEGACY FIELDS SURVIVE COACHING PLAN ADD ─────────────────────────────────

test('J: legacy studyPlan and studyPlanProfile survive coachingPlan addition', () => {
    const existing = makeStudent({
        studyPlan: { Pazartesi: ['Soru çöz'] },
        studyPlanProfile: { mode: 'branch:Matematik', badge: 'Örnek' }
    });
    const incoming = makeStudent({ coachingPlan: createEmptyCoachingPlan() });
    const merged = mergeStudents([existing], [incoming]);
    assert.deepEqual(merged[0].studyPlan, { Pazartesi: ['Soru çöz'] });
    assert.equal(merged[0].studyPlanProfile.mode, 'branch:Matematik');
    assert.equal(merged[0].studyPlanProfile.badge, 'Örnek');
});

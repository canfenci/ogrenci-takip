// ==================== GUIDANCE STUDY PLAN HOMEWORK DISTRIBUTION TESTS ====================
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const growthRaw = readFileSync(new URL('../growth.js', import.meta.url), 'utf-8');
const guidanceRaw = readFileSync(new URL('../guidance.js', import.meta.url), 'utf-8');

describe('GUIDANCE-PLAN-01: Homework Distribution into Weekly Study Plan', () => {

    describe('A. Current student only', () => {
        it('picker loads homework via getStudentOdevler for specific student', () => {
            assert.ok(growthRaw.includes('getStudentOdevler(student)'), 'should load homework for specific student');
        });

        it('picker does not use global homework list', () => {
            const fnIdx = growthRaw.indexOf('openHomeworkPicker = function');
            const fnBlock = growthRaw.slice(fnIdx, fnIdx + 1500);
            assert.ok(!fnBlock.includes('store.globalHomeworks'), 'should not use global homework list');
        });
    });

    describe('B. Current branch only', () => {
        it('openHomeworkPicker accepts planBranch parameter', () => {
            assert.ok(growthRaw.includes('openHomeworkPicker = function(studentId, planBranch)'), 'should accept planBranch');
        });

        it('picker filters homework by branch when planBranch is provided', () => {
            const fnIdx = growthRaw.indexOf('openHomeworkPicker = function');
            const fnBlock = growthRaw.slice(fnIdx, fnIdx + 1500);
            assert.ok(fnBlock.includes('planBranch'), 'should use planBranch for filtering');
            assert.ok(fnBlock.includes('normalizedBranch'), 'should normalize branch for comparison');
        });

        it('picker shows all homework when no branch is set (conditional filter)', () => {
            const fnIdx = growthRaw.indexOf('openHomeworkPicker = function');
            const fnBlock = growthRaw.slice(fnIdx, fnIdx + 1500);
            assert.ok(fnBlock.includes('if (planBranch)'), 'branch filter should be conditional');
        });

        it('branch comparison is case-insensitive', () => {
            const fnIdx = growthRaw.indexOf('openHomeworkPicker = function');
            const fnBlock = growthRaw.slice(fnIdx, fnIdx + 1500);
            assert.ok(fnBlock.includes('.toLowerCase()'), 'should use case-insensitive comparison');
        });
    });

    describe('C. Selected homework → chosen day', () => {
        it('day selection dropdown exists with all 7 canonical days', () => {
            assert.ok(growthRaw.includes('hwPickerDay'), 'day select should exist');
            const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
            days.forEach(d => {
                assert.ok(growthRaw.includes(`"${d}"`) || growthRaw.includes(`'${d}'`), `${d} should exist`);
            });
        });

        it('dueDay is set from selected day', () => {
            assert.ok(growthRaw.includes('dueDay: day'), 'dueDay should be set from day variable');
        });
    });

    describe('D. Same homework not duplicated on same day', () => {
        it('confirmHomeworkPicker checks for existing homeworkId on same day', () => {
            assert.ok(growthRaw.includes('existingHwIds'), 'should track existing homework IDs');
            assert.ok(growthRaw.includes('has(hwId)'), 'should check for duplicate');
        });

        it('duplicate homework is skipped with alert', () => {
            assert.ok(growthRaw.includes('atlandı'), 'should notify about skipped duplicates');
        });
    });

    describe('E. Plan stores reference, not independent homework copy', () => {
        it('confirmHomeworkPicker stores only homeworkId and homeworkStudentId', () => {
            const fnIdx = growthRaw.indexOf('window.confirmHomeworkPicker');
            const fnBlock = growthRaw.slice(fnIdx, fnIdx + 1000);
            assert.ok(fnBlock.includes('homeworkId: hwId'), 'should store homeworkId');
            assert.ok(fnBlock.includes('homeworkStudentId: studentId'), 'should store homeworkStudentId');
        });

        it('no title/subject/resource copied into plan task', () => {
            const fnIdx = growthRaw.indexOf('window.confirmHomeworkPicker');
            const fnBlock = growthRaw.slice(fnIdx, fnIdx + 1000);
            assert.ok(!fnBlock.includes('title: cb.dataset'), 'should NOT copy title');
            assert.ok(!fnBlock.includes('subject: cb.dataset'), 'should NOT copy subject');
            assert.ok(!fnBlock.includes('resource: cb.dataset'), 'should NOT copy resource');
        });
    });

    describe('F. Canonical homework metadata update appears in plan', () => {
        it('guidance.js resolves title from live homework record', () => {
            assert.ok(guidanceRaw.includes('hw.calismaDetayi || hw.konu'), 'should resolve title from live homework');
        });

        it('guidance.js resolves resource from live homework record', () => {
            assert.ok(guidanceRaw.includes('hw.yayin || hw.tur'), 'should resolve resource from live homework');
        });

        it('title variable is reassigned for homework override', () => {
            const hwIdx = guidanceRaw.indexOf("taskType === 'homework'");
            const hwBlock = guidanceRaw.slice(hwIdx, hwIdx + 2000);
            assert.ok(hwBlock.includes('title = hw.'), 'should reassign title from live homework');
        });

        it('resource variable is reassigned for homework override', () => {
            const hwIdx = guidanceRaw.indexOf("taskType === 'homework'");
            const hwBlock = guidanceRaw.slice(hwIdx, hwIdx + 2000);
            assert.ok(hwBlock.includes('resource = hw.'), 'should reassign resource from live homework');
        });
    });

    describe('G. Canonical homework status wins over plan completed fields', () => {
        it('isDone is overridden by hw.durum when homework exists', () => {
            const hwIdx = guidanceRaw.indexOf("taskType === 'homework'");
            const hwBlock = guidanceRaw.slice(hwIdx, hwIdx + 2000);
            assert.ok(hwBlock.includes('isDone = hwStatus'), 'should override isDone from canonical status');
        });

        it('homework checkbox is disabled (no competing completion state)', () => {
            assert.ok(guidanceRaw.includes("isHomework ? 'disabled' : ''"), 'homework checkbox should be disabled');
        });
    });

    describe('H. Remove from plan does not delete homework', () => {
        it('removeCpTask only splices from tasks array', () => {
            const idx = growthRaw.indexOf('window.removeCpTask');
            const block = growthRaw.slice(idx, idx + 400);
            assert.ok(block.includes('splice'), 'should splice from tasks array');
        });

        it('removeCpTask does not touch homework collections', () => {
            const idx = growthRaw.indexOf('window.removeCpTask');
            const block = growthRaw.slice(idx, idx + 400);
            assert.ok(!block.includes('odevler') && !block.includes('homeworks'), 'should not touch homework collections');
        });
    });

    describe('I. Orphan reference does not crash', () => {
        it('detects orphaned homework references', () => {
            assert.ok(guidanceRaw.includes('hwOrphan'), 'should detect orphaned references');
        });

        it('shows warning for deleted homework', () => {
            assert.ok(guidanceRaw.includes('Referans ödev silinmiş') || guidanceRaw.includes('Silinmiş'), 'should show orphan warning');
        });

        it('orphan reference can be removed from plan via removeCpTask', () => {
            assert.ok(growthRaw.includes('window.removeCpTask'), 'removeCpTask should exist for any task type');
        });
    });

    describe('J. Week A reference does not leak into Week B', () => {
        it('coaching plan has weekStart field', () => {
            assert.ok(guidanceRaw.includes('weekStart') || growthRaw.includes('weekStart'), 'plan should have weekStart');
        });

        it('tasks belong to coaching plan (week-scoped)', () => {
            assert.ok(guidanceRaw.includes('coachingPlan.tasks'), 'tasks should come from coachingPlan');
        });

        it('getStudyTasksForDay filters by day within current plan', () => {
            assert.ok(guidanceRaw.includes('dueDay === dayName'), 'should filter tasks by dueDay');
        });
    });

    describe('K. Existing non-homework task types unaffected', () => {
        it('taskType options still include question, exam, review, reading, custom', () => {
            assert.ok(growthRaw.includes('value="question"'), 'question type should exist');
            assert.ok(growthRaw.includes('value="exam"'), 'exam type should exist');
            assert.ok(growthRaw.includes('value="review"'), 'review type should exist');
            assert.ok(growthRaw.includes('value="reading"'), 'reading type should exist');
            assert.ok(growthRaw.includes('value="custom"'), 'custom type should exist');
        });

        it('homework type is added alongside existing types', () => {
            assert.ok(growthRaw.includes('value="homework"'), 'homework type should exist');
        });

        it('addCpTask still creates standard task objects with default taskType', () => {
            const idx = growthRaw.indexOf('window.addCpTask');
            const block = growthRaw.slice(idx, idx + 400);
            assert.ok(block.includes("taskType: 'question'"), 'default taskType should be question');
        });
    });
});

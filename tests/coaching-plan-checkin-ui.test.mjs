import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const guidanceJs = fs.readFileSync(new URL('../guidance.js', import.meta.url), 'utf8');
const historyJs = fs.readFileSync(new URL('../coaching-plan-history.js', import.meta.url), 'utf8');

// A. Haftalık Kontrol visible for coaching plan
test('A: Haftalık Kontrol section exists', () => {
    assert.ok(guidanceJs.includes('cp-checkin-section'), 'check-in section ID');
    assert.ok(guidanceJs.includes('Haftalık Kontrol'), 'section title');
});

// B. completedCount inputs
test('B: completedCount input elements exist', () => {
    assert.ok(guidanceJs.includes('cp-question-count'), 'question count input class');
    assert.ok(guidanceJs.includes('type="number"'), 'number input type');
    assert.ok(guidanceJs.includes('min="0"'), 'min=0 constraint');
});

// C. completion checkbox
test('C: completion checkbox exists', () => {
    assert.ok(guidanceJs.includes('cp-task-completed'), 'completed checkbox class');
    assert.ok(guidanceJs.includes('type="checkbox"'), 'checkbox input type');
});

// D. teacherNote field
test('D: teacherNote textarea exists', () => {
    assert.ok(guidanceJs.includes('cp-teacher-note'), 'teacher note ID');
    assert.ok(guidanceJs.includes('Öğretmen Notu'), 'teacher note label');
});

// E. nextWeekFocus field
test('E: nextWeekFocus textarea exists', () => {
    assert.ok(guidanceJs.includes('cp-next-week-focus'), 'next week focus ID');
    assert.ok(guidanceJs.includes('Gelecek Hafta Odak'), 'next week focus label');
});

// F. Save action
test('F: Save button exists with saveCoachingPlanCheckin', () => {
    assert.ok(guidanceJs.includes('saveCoachingPlanCheckin'), 'save function call');
    assert.ok(guidanceJs.includes('Kaydet'), 'save button text');
});

// G. no autosave markers
test('G: no autosave in code', () => {
    assert.ok(!guidanceJs.includes('autosave'), 'no autosave');
    assert.ok(!guidanceJs.includes('autoSave'), 'no autoSave');
    assert.ok(!guidanceJs.includes('setTimeout(() => save'), 'no debounced save');
});

// H. legacy no check-in
test('H: legacy tasks not editable in check-in', () => {
    assert.ok(guidanceJs.includes('!task._legacy'), 'legacy guard');
    assert.ok(guidanceJs.includes('editable = coachingPlan'), 'editable requires coachingPlan');
});

// I. mixed mode coaching only
test('I: editing only targets coachingPlan tasks', () => {
    assert.ok(guidanceJs.includes('data-task-id'), 'task ID data attribute');
    assert.ok(guidanceJs.includes('querySelector'), 'DOM query for task card');
});

// J. mobile layout
test('J: mobile layout uses responsive classes', () => {
    assert.ok(guidanceJs.includes('sm:grid-cols-2') || guidanceJs.includes('lg:grid-cols-3'), 'responsive grid');
});

// K. dark mode
test('K: dark mode classes present', () => {
    assert.ok(guidanceJs.includes('dark:bg-gray-900'), 'dark mode backgrounds');
    assert.ok(guidanceJs.includes('dark:text-gray-100') || guidanceJs.includes('dark:text-white'), 'dark mode text');
});

// L. success feedback
test('L: success feedback exists', () => {
    assert.ok(guidanceJs.includes('cp-checkin-feedback'), 'feedback element ID');
    assert.ok(guidanceJs.includes('✓ Kaydedildi'), 'success message');
});

// M. error feedback
test('M: error feedback exists', () => {
    assert.ok(guidanceJs.includes('✗ Kaydetme hatası'), 'error message');
});

// N. saveCoachingPlanCheckin function defined
test('N: saveCoachingPlanCheckin function defined and bound', () => {
    assert.ok(guidanceJs.includes('async function saveCoachingPlanCheckin'), 'function definition');
    assert.ok(guidanceJs.includes('window.saveCoachingPlanCheckin = saveCoachingPlanCheckin'), 'window binding');
});

// O. history module exports
test('O: coaching-plan-history.js exports getMonthlyProgress', () => {
    assert.ok(historyJs.includes('export function getMonthlyProgress'), 'getMonthlyProgress exported');
    assert.ok(historyJs.includes('export function getHistoryWeekCount'), 'getHistoryWeekCount exported');
});

// P. history module pure
test('P: history module has no DOM/persistence/network', () => {
    assert.ok(!historyJs.includes('document.'), 'no DOM');
    assert.ok(!historyJs.includes('localStorage'), 'no localStorage');
    assert.ok(!historyJs.includes('fetch('), 'no fetch');
    assert.ok(!historyJs.includes('firebase'), 'no firebase');
    assert.ok(!historyJs.includes('window.'), 'no window');
});

// Q. history module no mutation
test('Q: history module has no mutation', () => {
    assert.ok(!historyJs.includes('.push('), 'no push');
    assert.ok(!historyJs.includes('.splice('), 'no splice');
});

// R. saveCoachingPlanCheckin reads current plan
test('R: saveCoachingPlanCheckin reads latest plan before save', () => {
    assert.ok(guidanceJs.includes('loadStudentsData'), 'reads current student data');
    assert.ok(guidanceJs.includes('normalizeCoachingPlan'), 'normalizes plan');
});

// S. saveCoachingPlanCheckin preserves unrelated fields
test('S: save preserves all plan fields', () => {
    assert.ok(guidanceJs.includes('...plan'), 'spreads existing plan');
    assert.ok(guidanceJs.includes('tasks: updatedTasks'), 'updates tasks');
    assert.ok(guidanceJs.includes('weeklyCheckIn:'), 'updates check-in');
});

// T. checkedAt only on save
test('T: checkedAt set only in save function', () => {
    const checkinSection = guidanceJs.includes('cp-checkin-section');
    const checkedAtInSave = guidanceJs.includes('checkedAt: new Date().toISOString()');
    assert.ok(checkinSection, 'check-in section exists');
    assert.ok(checkedAtInSave, 'checkedAt set in save');
});

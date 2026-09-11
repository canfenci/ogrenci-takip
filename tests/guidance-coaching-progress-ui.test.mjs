import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const guidanceJs = fs.readFileSync(path.join(ROOT, 'guidance.js'), 'utf8');
const progressJs = fs.readFileSync(path.join(ROOT, 'coaching-plan-progress.js'), 'utf8');

// ─── STATIC CODE CONTRACT TESTS ───────────────────────────────────────────────

test('A: progress helpers imported in guidance.js', () => {
    assert.ok(guidanceJs.includes("from './coaching-plan-progress.js'"), 'progress import exists');
    assert.ok(guidanceJs.includes('getPlanProgressSummary'), 'getPlanProgressSummary imported');
    assert.ok(guidanceJs.includes('getQuestionProgress'), 'getQuestionProgress imported');
    assert.ok(guidanceJs.includes('getTaskProgress'), 'getTaskProgress imported');
    assert.ok(guidanceJs.includes('getTaskCompletionState'), 'getTaskCompletionState imported');
});

test('B: coachingPlanSummaryHtml uses progress helpers', () => {
    assert.ok(guidanceJs.includes('getPlanProgressSummary(coachingPlan)'), 'calls getPlanProgressSummary');
    assert.ok(guidanceJs.includes('progress.questions'), 'uses questions progress');
    assert.ok(guidanceJs.includes('progress.tasks'), 'uses tasks progress');
    assert.ok(guidanceJs.includes('progress.exams'), 'uses exams progress');
    assert.ok(guidanceJs.includes('progress.branches'), 'uses branches progress');
    assert.ok(guidanceJs.includes('progress.topics'), 'uses topics progress');
});

test('C: Soru metric shows actual/target', () => {
    assert.ok(guidanceJs.includes("'Soru'"), 'Soru label');
    assert.ok(guidanceJs.includes('qProg.actual'), 'question actual');
    assert.ok(guidanceJs.includes('qProg.target'), 'question target');
});

test('D: Gorev metric shows completed/total', () => {
    assert.ok(guidanceJs.includes("'Görev'"), 'Gorev label');
    assert.ok(guidanceJs.includes('tProg.completed'), 'task completed');
    assert.ok(guidanceJs.includes('tProg.total'), 'task total');
});

test('E: Deneme metric shows combined exam counts', () => {
    assert.ok(guidanceJs.includes("'Deneme'"), 'Deneme label');
    assert.ok(guidanceJs.includes('eProg.generalActual'), 'general exam actual');
    assert.ok(guidanceJs.includes('eProg.branchActual'), 'branch exam actual');
});

test('F: Branch section renders with progress bar', () => {
    assert.ok(guidanceJs.includes('Branş Hedefleri'), 'branch section label');
    assert.ok(guidanceJs.includes('progress.branches.map'), 'iterates branches');
    assert.ok(guidanceJs.includes('fmtBar(b.percent)'), 'branch progress bar');
});

test('G: Topic section renders with progress bar', () => {
    assert.ok(guidanceJs.includes('Konu Hedefleri'), 'topic section label');
    assert.ok(guidanceJs.includes('progress.topics.map'), 'iterates topics');
    assert.ok(guidanceJs.includes('fmtBar(t.percent)'), 'topic progress bar');
});

test('H: Progress bar capped at 100 for display', () => {
    assert.ok(guidanceJs.includes('Math.min(pct, 100)'), 'bar capped at 100');
});

test('I: Overachievement shown in raw text', () => {
    assert.ok(guidanceJs.includes('valText'), 'raw value text displayed');
});

test('J: Null target shows dash', () => {
    assert.ok(guidanceJs.includes("target != null ? `${actual} / ${target}` : `${actual}`"), 'null target handling');
});

test('K: Progress bar color logic', () => {
    assert.ok(guidanceJs.includes('pct >= 80'), 'green threshold');
    assert.ok(guidanceJs.includes('pct >= 50'), 'amber threshold');
    assert.ok(guidanceJs.includes('bg-emerald-500'), 'green bar color');
    assert.ok(guidanceJs.includes('bg-amber-500'), 'amber bar color');
    assert.ok(guidanceJs.includes('bg-red-500'), 'red bar color');
});

test('L: Task status labels exist', () => {
    assert.ok(guidanceJs.includes("'Tamamlandı'"), 'completed label');
    assert.ok(guidanceJs.includes("'Devam Ediyor'"), 'in_progress label');
    assert.ok(guidanceJs.includes("'Başlanmadı'"), 'not_started label');
});

test('M: Task card shows completedCount/questionTarget', () => {
    assert.ok(guidanceJs.includes('completedCount'), 'completedCount in task card');
    assert.ok(guidanceJs.includes('completedCount} / ${question} soru'), 'question progress in task card');
});

test('N: Overview KPI uses progress metrics', () => {
    assert.ok(guidanceJs.includes('getQuestionProgress(student.coachingPlan)'), 'KPI uses question progress');
    assert.ok(guidanceJs.includes('getTaskProgress(student.coachingPlan)'), 'KPI uses task progress');
    assert.ok(guidanceJs.includes('Soru ${qp.actual}'), 'KPI shows question actual');
    assert.ok(guidanceJs.includes('Görev ${tp.completed}'), 'KPI shows task completed');
});

test('O: No single overall percentage', () => {
    assert.ok(!guidanceJs.includes("'Plan %'"), 'no Plan % label');
    assert.ok(!guidanceJs.match(/plan.*%.*tamamland/), 'no plan completion percentage text');
});

test('P: Legacy plan path unchanged', () => {
    assert.ok(guidanceJs.includes('legacy 7-day plan') || guidanceJs.includes('legacyStudyPlanHtml') || guidanceJs.includes('studyPlan[dayName]') || guidanceJs.includes('rawStudyPlan'), 'legacy plan rendering exists');
});

// ─── PROGRESS MODULE STRUCTURE ────────────────────────────────────────────────

test('Q: progress module exports all required helpers', () => {
    assert.ok(progressJs.includes('export function getProgressPercent'), 'getProgressPercent');
    assert.ok(progressJs.includes('export function getQuestionProgress'), 'getQuestionProgress');
    assert.ok(progressJs.includes('export function getTaskProgress'), 'getTaskProgress');
    assert.ok(progressJs.includes('export function getExamProgress'), 'getExamProgress');
    assert.ok(progressJs.includes('export function getBranchProgress'), 'getBranchProgress');
    assert.ok(progressJs.includes('export function getTopicProgress'), 'getTopicProgress');
    assert.ok(progressJs.includes('export function getReadingProgress'), 'getReadingProgress');
    assert.ok(progressJs.includes('export function getReviewProgress'), 'getReviewProgress');
    assert.ok(progressJs.includes('export function getTaskCompletionState'), 'getTaskCompletionState');
    assert.ok(progressJs.includes('export function getWeeklyTargetActuals'), 'getWeeklyTargetActuals');
    assert.ok(progressJs.includes('export function getPlanProgressSummary'), 'getPlanProgressSummary');
});

test('R: progress module has no DOM/persistence/network', () => {
    assert.ok(!progressJs.includes('document.'), 'no DOM');
    assert.ok(!progressJs.includes('localStorage'), 'no localStorage');
    assert.ok(!progressJs.includes('fetch('), 'no fetch');
    assert.ok(!progressJs.includes('firebase'), 'no firebase');
    assert.ok(!progressJs.includes('window.'), 'no window');
});

test('S: progress module has no mutation', () => {
    assert.ok(!progressJs.includes('.push('), 'no array push');
    assert.ok(!progressJs.includes('.splice('), 'no splice');
    assert.ok(!progressJs.includes('delete '), 'no delete');
});

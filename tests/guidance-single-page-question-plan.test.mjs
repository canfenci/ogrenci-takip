import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    calculateRemainingQuestionTarget,
    distributeWeeklyQuestionTarget,
    getEligiblePlanHomeworks,
    getPlanHomeworkPlacementDay,
    resolveSelectedPlanHomeworks,
    sumSelectedHomeworkQuestions
} from '../guidance-plan-homework.js';
import { normalizeCoachingPlan } from '../coaching-plan-model.js';

const growthSource = await readFile(new URL('../growth.js', import.meta.url), 'utf8');

const student = { id: 'student-a', odevler: [
    { id: 'h1', ders: 'Fen Bilimleri', konu: 'Mevsimler', soruSayisi: 20, durum: 'verildi', bitisTarihi: '2026-09-29' },
    { id: 'h2', ders: 'Fen Bilimleri', konu: 'İklim', soruSayisi: 15, durum: 'tamamlandi', dogru: 13, yanlis: 1, bos: 1, bitisTarihi: '2026-10-01' },
    { id: 'h3', ders: 'Matematik', konu: 'Problemler', soruSayisi: 30, durum: 'verildi', bitisTarihi: '2026-10-01' },
    { id: 'h4', ders: 'Fen Bilimleri', konu: 'Dünya', durum: 'verildi', bitisTarihi: '2026-10-02' }
] };
const plan = { weekStart: '2026-09-28', weekEnd: '2026-10-04', selectedHomeworkIds: ['h1', 'h2', 'missing'], tasks: [{ taskType: 'homework', homeworkId: 'h1', dueDay: 'Cuma' }] };

test('weekly target is distributed deterministically and exactly', () => {
    assert.deepEqual(distributeWeeklyQuestionTarget(120, ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']).map(item => item.questionTarget), [20, 20, 20, 20, 20, 20]);
    const split = distributeWeeklyQuestionTarget(100, ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']);
    assert.equal(split.reduce((sum, item) => sum + item.questionTarget, 0), 100);
    assert.deepEqual(split.map(item => item.questionTarget), [17, 17, 17, 17, 16, 16]);
});

test('plan normalization persists weekly target, active days, and stable Homework IDs', () => {
    const normalized = normalizeCoachingPlan({
        id: 'plan-1', weeklyQuestionTarget: 120,
        activeStudyDays: ['Pazartesi', 'Pazartesi', 'Cumartesi'],
        selectedHomeworkIds: ['h1', 'h1', 'h4']
    });
    assert.equal(normalized.weeklyQuestionTarget, 120);
    assert.deepEqual(normalized.activeStudyDays, ['Pazartesi', 'Cumartesi']);
    assert.deepEqual(normalized.selectedHomeworkIds, ['h1', 'h4']);
    assert.equal(normalizeCoachingPlan({ weeklyQuestionTarget: 12.5 }).weeklyQuestionTarget, null);
});

test('only current student branch and unfinished Homework are candidates', () => {
    const candidates = getEligiblePlanHomeworks({ student, branch: 'Fen Bilimleri', weekStart: plan.weekStart, weekEnd: plan.weekEnd });
    assert.deepEqual(candidates.map(item => item.id), ['h1', 'h4']);
});

test('selected active Homework resolves live, ignores completed and deleted references', () => {
    const selected = resolveSelectedPlanHomeworks({ student, plan, branch: 'Fen Bilimleri' });
    assert.deepEqual(selected.map(item => item.id), ['h1']);
    assert.equal(sumSelectedHomeworkQuestions(selected), 20);
    assert.equal(calculateRemainingQuestionTarget(120, 20), 100);
    assert.equal(calculateRemainingQuestionTarget(40, 50), 0);
});

test('completed-after-selection recalculates the active workload and unselected Homework stays out', () => {
    const currentStudent = { id: 'student-a', odevler: [
        { id: 'h1', ders: 'Fen Bilimleri', soruSayisi: 20, durum: 'verildi', bitisTarihi: '2026-09-29' },
        { id: 'h2', ders: 'Fen Bilimleri', soruSayisi: 15, durum: 'verildi', bitisTarihi: '2026-10-01' },
        { id: 'h3', ders: 'Fen Bilimleri', soruSayisi: 25, durum: 'verildi', bitisTarihi: '2026-10-02' }
    ] };
    const selectedPlan = { weekStart: '2026-09-28', weekEnd: '2026-10-04', selectedHomeworkIds: ['h1', 'h2'] };
    const initiallySelected = resolveSelectedPlanHomeworks({ student: currentStudent, plan: selectedPlan, branch: 'Fen Bilimleri' });
    assert.deepEqual(initiallySelected.map(item => item.id), ['h1', 'h2']);
    assert.equal(sumSelectedHomeworkQuestions(initiallySelected), 35);
    assert.equal(calculateRemainingQuestionTarget(120, 35), 85);
    currentStudent.odevler[0] = { ...currentStudent.odevler[0], durum: 'tamamlandi', dogru: 20, yanlis: 0, bos: 0 };
    const afterCompletion = resolveSelectedPlanHomeworks({ student: currentStudent, plan: selectedPlan, branch: 'Fen Bilimleri' });
    assert.deepEqual(afterCompletion.map(item => item.id), ['h2']);
    assert.equal(sumSelectedHomeworkQuestions(afterCompletion), 15);
    assert.equal(calculateRemainingQuestionTarget(120, 15), 105);
    assert.equal(afterCompletion.some(item => item.id === 'h3'), false);
});

test('new matching Homework is a candidate but never auto-selected', () => {
    const updatedStudent = { ...student, odevler: [...student.odevler, { id: 'h-new', ders: 'Fen Bilimleri', soruSayisi: 12, durum: 'verildi', bitisTarihi: '2026-10-03' }] };
    const candidates = getEligiblePlanHomeworks({ student: updatedStudent, branch: 'Fen Bilimleri', weekStart: plan.weekStart, weekEnd: plan.weekEnd });
    assert.equal(candidates.some(item => item.id === 'h-new'), true);
    const selected = resolveSelectedPlanHomeworks({ student: updatedStudent, plan, branch: 'Fen Bilimleri' });
    assert.equal(selected.some(item => item.id === 'h-new'), false);
});

test('legacy Homework without soruSayisi remains selectable and contributes zero', () => {
    const selected = resolveSelectedPlanHomeworks({ student, plan: { ...plan, selectedHomeworkIds: ['h4'], tasks: [] }, branch: 'Fen Bilimleri' });
    assert.equal(selected[0].id, 'h4');
    assert.equal(sumSelectedHomeworkQuestions(selected), 0);
});

test('manual day overrides due-date placement', () => {
    assert.equal(getPlanHomeworkPlacementDay(student.odevler[0], plan), 'Cuma');
    assert.equal(getPlanHomeworkPlacementDay(student.odevler[3], { ...plan, tasks: [] }), 'Cuma');
});

test('editor and single-page PDF omit performance analytics and second-page output', () => {
    assert.match(growthSource, /Haftalık Soru Hedefi/);
    assert.match(growthSource, /Bu Haftanın Ödevleri/);
    const pdfSource = growthSource.slice(growthSource.indexOf('export function exportStudyPlanToPdf'), growthSource.indexOf('function legacyExportStudyPlanToPdf'));
    assert.match(pdfSource, /Ek Soru Hedefi/);
    assert.match(pdfSource, /VERİLEN ÖDEVLER/);
    assert.doesNotMatch(pdfSource, /page-break|HAFTALIK ÖDEV PERFORMANSI|Pomodoro|Feynman|DERS BAZLI GELİŞİM ÖNERİLERİ|Doğru:|Yanlış:|Başarı:/);
    assert.match(pdfSource, /Seçilen ödevlerin soru toplamı haftalık hedefi aşıyor/);
    assert.match(pdfSource, /normalTasks/);
    assert.match(pdfSource, /VERİLEN ÖDEVLER/);
    assert.match(pdfSource, /Ödev<\/th><th>Soru<\/th><th>Son Tarih/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const studentsJs = fs.readFileSync(path.join(ROOT, 'students.js'), 'utf8');

// ============================================================================
// KPI CARD CONSISTENCY
// ============================================================================

test('A: Overview KPI uses <div>, not <article>', () => {
    const kpiSection = studentsJs.match(/<!-- 3 Ana KPI -->[\s\S]*?<\/section>/);
    assert.ok(kpiSection, 'Overview KPI section exists');
    assert.doesNotMatch(kpiSection[0], /<article/);
    assert.match(kpiSection[0], /<div class="app-panel p-3">/);
});

test('B: Overview KPI uses p-3, not p-4', () => {
    const kpiSection = studentsJs.match(/<!-- 3 Ana KPI -->[\s\S]*?<\/section>/);
    assert.ok(kpiSection, 'Overview KPI section exists');
    assert.doesNotMatch(kpiSection[0], /app-panel p-4/);
    assert.match(kpiSection[0], /app-panel p-3/);
});

test('C: Overview KPI value is text-xl, not text-2xl', () => {
    const kpiSection = studentsJs.match(/<!-- 3 Ana KPI -->[\s\S]*?<\/section>/);
    assert.ok(kpiSection, 'Overview KPI section exists');
    assert.doesNotMatch(kpiSection[0], /text-2xl/);
    assert.match(kpiSection[0], /text-xl font-black/);
});

test('D: Overview KPI label uses tracking-[.08em]', () => {
    const kpiSection = studentsJs.match(/<!-- 3 Ana KPI -->[\s\S]*?<\/section>/);
    assert.ok(kpiSection, 'Overview KPI section exists');
    assert.match(kpiSection[0], /tracking-\[\.08em\]/);
    assert.doesNotMatch(kpiSection[0], /tracking-\[\.1em\]/);
});

test('E: Overview KPI label has text-gray-400 on <p> element', () => {
    const kpiSection = studentsJs.match(/<!-- 3 Ana KPI -->[\s\S]*?<\/section>/);
    assert.ok(kpiSection, 'Overview KPI section exists');
    assert.match(kpiSection[0], /text-\[11px\] font-black uppercase tracking-\[\.08em\] text-gray-400/);
});

test('F: Overview KPI detail uses mt-0.5, not mt-1', () => {
    const kpiSection = studentsJs.match(/<!-- 3 Ana KPI -->[\s\S]*?<\/section>/);
    assert.ok(kpiSection, 'Overview KPI section exists');
    assert.match(kpiSection[0], /text-xs text-gray-500 mt-0.5 truncate/);
});

// ============================================================================
// CHART HEIGHT CONSISTENCY
// ============================================================================

test('G: Trend chart uses h-60 sm:h-64', () => {
    assert.match(studentsJs, /id="cockpitTrendChart"[^>]*>/);
    const trendChart = studentsJs.match(/<div[^>]*>\s*<canvas id="cockpitTrendChart"/);
    assert.ok(trendChart, 'Trend chart container exists');
    const containerMatch = studentsJs.match(/<div class="[^"]*h-\d+ sm:h-\d+[^"]*">\s*<canvas id="cockpitTrendChart"/);
    assert.ok(containerMatch, 'Trend chart has height class');
    assert.match(containerMatch[0], /h-60 sm:h-64/);
});

test('H: Homework chart uses h-60 sm:h-64', () => {
    const hwChart = studentsJs.match(/<div class="[^"]*h-\d+ sm:h-\d+[^"]*">\s*\$\{hwPerf\.chronological/);
    assert.ok(hwChart, 'Homework chart container exists');
    assert.match(hwChart[0], /h-60 sm:h-64/);
});

test('I: General exam chart uses h-60 sm:h-64', () => {
    const genelChart = studentsJs.match(/<div class="[^"]*h-\d+ sm:h-\d+[^"]*">\s*<canvas id="cockpitGenelExamChart"/);
    assert.ok(genelChart, 'General exam chart container exists');
    assert.match(genelChart[0], /h-60 sm:h-64/);
});

test('J: Branch exam chart uses h-60 sm:h-64', () => {
    const bransChart = studentsJs.match(/<div class="[^"]*h-\d+ sm:h-\d+[^"]*">\s*<canvas id="cockpitBransExamChart"/);
    assert.ok(bransChart, 'Branch exam chart container exists');
    assert.match(bransChart[0], /h-60 sm:h-64/);
});

test('K: No h-64 sm:h-72 in cockpit', () => {
    assert.doesNotMatch(studentsJs, /h-64 sm:h-72/);
});

test('L: No h-56 sm:h-60 in cockpit', () => {
    assert.doesNotMatch(studentsJs, /h-56 sm:h-60/);
});

// ============================================================================
// EMPTY STATE CONSISTENCY
// ============================================================================

test('M: No oversized dashed chart empty states in cockpit', () => {
    const cockpitPerf = studentsJs.match(/function renderCockpitPerformanceTab[\s\S]*?function renderStudentCockpit/);
    assert.ok(cockpitPerf, 'renderCockpitPerformanceTab exists');
    assert.doesNotMatch(cockpitPerf[0], /border-dashed/);
});

test('N: No min-h on chart empty states', () => {
    assert.doesNotMatch(studentsJs, /min-h-\[\d+px\][^"]*border-dashed/);
    assert.doesNotMatch(studentsJs, /border-dashed[^"]*min-h-\[\d+px\]/);
});

test('O: Compact inline empty states use py-4, not py-8', () => {
    const py8Count = (studentsJs.match(/py-8 text-center/g) || []).length;
    assert.equal(py8Count, 0, 'No py-8 text-center empty states should remain');
});

test('P: Compact inline empty states use text-xl icons, not text-2xl', () => {
    const emptyStates = studentsJs.match(/<div class="py-4 sm:py-5 text-center">[\s\S]*?<\/div>/g) || [];
    for (const state of emptyStates) {
        assert.doesNotMatch(state, /text-2xl/, 'Empty state icon should be text-xl, not text-2xl');
    }
});

test('Q: Compact inline empty states use text-sm font-semibold titles', () => {
    const emptyStates = studentsJs.match(/<div class="py-4 sm:py-5 text-center">[\s\S]*?<\/div>/g) || [];
    for (const state of emptyStates) {
        assert.match(state, /text-sm font-semibold/, 'Empty state title should use text-sm font-semibold');
    }
});

test('R: Full empty state (cf-empty-state) preserved', () => {
    assert.match(studentsJs, /class="cf-empty-state/);
});

// ============================================================================
// CONTENT PRESERVATION
// ============================================================================

test('S: Overview KPI labels preserved', () => {
    assert.match(studentsJs, /Son Deneme/);
    assert.match(studentsJs, /Ödev Disiplini/);
    assert.match(studentsJs, /Hedefe Kalan|Hedef Durumu/);
});

test('T: Homework KPI labels preserved', () => {
    assert.match(studentsJs, /Ödev Disiplini/);
    assert.match(studentsJs, /Geciken/);
    assert.match(studentsJs, /Ortalama Başarı/);
    assert.match(studentsJs, /Ortalama Net/);
});

test('U: School exam dynamic KPI states preserved', () => {
    assert.match(studentsJs, /Son Deneme/);
    assert.match(studentsJs, /Deneme Sayısı/);
    assert.match(studentsJs, /Eğilim/);
    assert.match(studentsJs, /Son Net/);
    assert.match(studentsJs, /En Yüksek Net/);
});

test('V: Trend threshold ±1.25 preserved', () => {
    assert.match(studentsJs, /1\.25/);
});

test('W: No business logic changes - comparability key reuse', () => {
    assert.match(studentsJs, /getCockpitExamComparabilityKey/);
});

test('X: No business logic changes - latest5 logic preserved', () => {
    assert.match(studentsJs, /recentComparable/);
    assert.match(studentsJs, /chronological/);
});

test('Y: Chart insufficient-data messages preserved', () => {
    assert.match(studentsJs, /en az 2 tamamlanmış ödev gerekli/);
    assert.match(studentsJs, /Trend için en az 2 genel deneme/);
    assert.match(studentsJs, /en az 2 branş denemesi gerekli/);
});

test('Z: Warning box (Eksik Hata Analizi) preserved', () => {
    assert.match(studentsJs, /Eksik Hata Analizi/);
    assert.match(studentsJs, /bg-amber-50\/80/);
});

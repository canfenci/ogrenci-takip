import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const homeworkJs = fs.readFileSync(path.join(ROOT, 'homework.js'), 'utf8');

// ============================================================================
// A. WEEK NAVIGATION PRESERVED
// ============================================================================

test('A: Week navigation prev/next buttons preserved', () => {
    assert.match(homeworkJs, /updateHomeworkDashboardFilters\(\{week: \$\{prevWeekNum\}\}\)/);
    assert.match(homeworkJs, /updateHomeworkDashboardFilters\(\{week: \$\{nextWeekNum\}\}\)/);
    assert.match(homeworkJs, /fa-chevron-left/);
    assert.match(homeworkJs, /fa-chevron-right/);
});

// ============================================================================
// B. CURRENT WEEK ACTION PRESERVED
// ============================================================================

test('B: Bu Haftaya Dön action preserved', () => {
    assert.match(homeworkJs, /Bu Haftaya Dön/);
    assert.match(homeworkJs, /updateHomeworkDashboardFilters\(\{week: \$\{curWeekNum\}\}\)/);
});

// ============================================================================
// C. STUDENT FILTER PRESERVED
// ============================================================================

test('C: Student filter select preserved', () => {
    assert.match(homeworkJs, /updateHomeworkDashboardFilters\(\{studentId: this\.value\}\)/);
    assert.match(homeworkJs, /Tüm Öğrenciler/);
});

// ============================================================================
// D. CLASS FILTER PRESERVED
// ============================================================================

test('D: Class filter select preserved', () => {
    assert.match(homeworkJs, /updateHomeworkDashboardFilters\(\{grade:this\.value\}\)/);
    assert.match(homeworkJs, /Tüm sınıflar/);
    assert.match(homeworkJs, /5\. Sınıf/);
    assert.match(homeworkJs, /8\. Sınıf/);
});

// ============================================================================
// E. FREE-TEXT SEARCH PRESERVED
// ============================================================================

test('E: Free-text search input preserved', () => {
    assert.match(homeworkJs, /updateHomeworkDashboardFilters\(\{query:this\.value\}\)/);
    assert.match(homeworkJs, /Öğrenci, konu veya kaynak ara|Ara\.\.\./);
});

// ============================================================================
// F. SIX STATUS FILTERS PRESERVED
// ============================================================================

test('F: Six status filters preserved', () => {
    assert.match(homeworkJs, /\['all', 'Tümü'/);
    assert.match(homeworkJs, /\['active', 'Aktif'/);
    assert.match(homeworkJs, /\['overdue', 'Geciken'/);
    assert.match(homeworkJs, /\['today', 'Bugün'/);
    assert.match(homeworkJs, /\['upcoming', 'Yaklaşan'/);
    assert.match(homeworkJs, /\['completed', 'Tamamlanan'/);
});

// ============================================================================
// G. KPI COUNT SEMANTICS PRESERVED
// ============================================================================

test('G: KPI metric cards preserve all 4 metrics', () => {
    assert.match(homeworkJs, /Toplam Ödev/);
    assert.match(homeworkJs, /Tamamlanan/);
    assert.match(homeworkJs, /Aktif \/ Bekleyen/);
    assert.match(homeworkJs, /Geciken/);
    assert.match(homeworkJs, /metrics\.total/);
    assert.match(homeworkJs, /metrics\.completed/);
    assert.match(homeworkJs, /metrics\.active/);
    assert.match(homeworkJs, /metrics\.overdue/);
});

// ============================================================================
// H. KPI COMPACT PATTERN
// ============================================================================

test('H: KPI cards use compact pattern p-3 text-xl', () => {
    const kpiSection = homeworkJs.match(/<!-- Metrics Cards -->[\s\S]*?<\/section>/);
    assert.ok(kpiSection, 'Metrics Cards section exists');
    assert.match(kpiSection[0], /app-panel p-3/);
    assert.match(kpiSection[0], /text-xl font-black/);
    assert.doesNotMatch(kpiSection[0], /app-panel p-4/);
    assert.doesNotMatch(kpiSection[0], /text-2xl/);
});

// ============================================================================
// I. COMBINED CONTROL PANEL
// ============================================================================

test('I: Week and student controls combined in single panel', () => {
    assert.match(homeworkJs, /Combined Week \+ Student Control Bar/);
    assert.doesNotMatch(homeworkJs, /2-Axis Primary Filter Panel/);
});

// ============================================================================
// J. REMOVED LARGE VISIBLE INTERNAL LABELS
// ============================================================================

test('J: Large internal labels removed (Hafta Seçimi, Öğrenci Filtresi)', () => {
    assert.doesNotMatch(homeworkJs, /Hafta Seçimi/);
    assert.doesNotMatch(homeworkJs, /Öğrenci Filtresi/);
});

// ============================================================================
// K. COMPACT SEARCH PANEL
// ============================================================================

test('K: Search panel uses compact layout', () => {
    assert.match(homeworkJs, /min-h-\[44px\]/);
    assert.doesNotMatch(homeworkJs, /app-panel p-4 mt-3[\s\S]*?Status Filters/);
});

// ============================================================================
// L. DUE DATE ROW SIMPLIFICATION
// ============================================================================

test('L: Due date row simplified - no "Teslim" label', () => {
    const rows = homeworkJs.match(/records\.map\(\([\s\S]*?\)\.join\(''\)/);
    assert.ok(rows, 'Row template exists');
    assert.doesNotMatch(rows[0], /<p class="text-xs text-gray-400">Teslim<\/p>/);
    assert.match(rows[0], /title="Teslim tarihi"/);
});

// ============================================================================
// M. DETAIL ACTION WIRING PRESERVED
// ============================================================================

test('M: Detail action wiring preserved', () => {
    assert.match(homeworkJs, /openHomeworkDetailModal/);
    assert.match(homeworkJs, /openHomeworkResultFromBoard/);
    assert.match(homeworkJs, /showOdevAtaModal/);
});

// ============================================================================
// N. EMPTY LIST STATE
// ============================================================================

test('N: Empty list state compact', () => {
    assert.match(homeworkJs, /Bu filtrelere uygun ödev bulunamadı/);
    assert.match(homeworkJs, /fa-folder-open/);
});

// ============================================================================
// O. MOBILE SEARCH SECTION PRESERVED
// ============================================================================

test('O: Mobile search section preserved', () => {
    assert.match(homeworkJs, /class="sm:hidden"/);
    assert.match(homeworkJs, /Öğrenci, konu veya kaynak ara/);
});

// ============================================================================
// P. DARK MODE CLASSES
// ============================================================================

test('P: Dark mode classes present throughout', () => {
    assert.match(homeworkJs, /dark:text-white/);
    assert.match(homeworkJs, /dark:bg-gray-800/);
    assert.match(homeworkJs, /dark:border-gray-700/);
    assert.match(homeworkJs, /dark:text-gray-300/);
});

// ============================================================================
// Q. NO WRITE SEMANTICS
// ============================================================================

test('Q: No new write semantics introduced in render function', () => {
    const renderFn = homeworkJs.match(/export function renderOdevTakibi[\s\S]*?(?=export function updateHomeworkDashboardFilters)/);
    assert.ok(renderFn, 'renderOdevTakibi function exists');
    assert.doesNotMatch(renderFn[0], /\.set\(/);
    assert.doesNotMatch(renderFn[0], /\.update\(/);
    assert.doesNotMatch(renderFn[0], /\.add\(/);
});

// ============================================================================
// R. ROW DENSITY
// ============================================================================

test('R: Row padding reduced from py-4 to py-3', () => {
    assert.match(homeworkJs, /px-4 py-3/);
    assert.doesNotMatch(homeworkJs, /px-5 py-4/);
});

// ============================================================================
// S. TOUCH TARGETS
// ============================================================================

test('S: No sub-44px touch targets for interactive controls', () => {
    assert.doesNotMatch(homeworkJs, /min-h-\[36px\]/, 'No 36px min-h allowed');
    assert.doesNotMatch(homeworkJs, /min-h-\[34px\]/, 'No 34px min-h allowed');
    assert.doesNotMatch(homeworkJs, /min-h-\[32px\]/, 'No 32px min-h allowed');
    assert.doesNotMatch(homeworkJs, /min-h-\[40px\]/, 'No 40px min-h allowed');
    assert.doesNotMatch(homeworkJs, /min-h-\[42px\]/, 'No 42px min-h allowed');
});

// ============================================================================
// T. SPECIFIC INTERACTIVE MIN-H ASSERTIONS
// ============================================================================

test('T: Week prev/next buttons >= 44px', () => {
    assert.match(homeworkJs, /updateHomeworkDashboardFilters\(\{week: \$\{prevWeekNum\}\}\)[^>]*min-h-\[44px\]/);
    assert.match(homeworkJs, /updateHomeworkDashboardFilters\(\{week: \$\{nextWeekNum\}\}\)[^>]*min-h-\[44px\]/);
});

test('U: Week select >= 44px', () => {
    assert.match(homeworkJs, /updateHomeworkDashboardFilters\(\{week: this\.value\}\)[^>]*min-h-\[44px\]/);
});

test('V: Student select >= 44px', () => {
    assert.match(homeworkJs, /updateHomeworkDashboardFilters\(\{studentId: this\.value\}\)[^>]*min-h-\[44px\]/);
});

test('W: Status filter pills >= 44px', () => {
    assert.match(homeworkJs, /updateHomeworkDashboardFilters\(\{status:[^)]+\}\)[^>]*min-h-\[44px\]/);
});

test('X: Search input >= 44px', () => {
    assert.match(homeworkJs, /updateHomeworkDashboardFilters\(\{query:this\.value\}\)[^>]*min-h-\[44px\]/);
});

test('Y: Class select >= 44px', () => {
    assert.match(homeworkJs, /updateHomeworkDashboardFilters\(\{grade:this\.value\}\)[^>]*min-h-\[44px\]/);
});

test('Z: Row action buttons >= 44px', () => {
    assert.match(homeworkJs, /openHomeworkDetailModal[^>]*min-h-\[44px\]/);
    assert.match(homeworkJs, /openHomeworkResultFromBoard[^>]*min-h-\[44px\]/);
});

test('AA: Yeni Ödev button >= 44px', () => {
    assert.match(homeworkJs, /showOdevAtaModal[^>]*min-h-\[44px\]/);
});

// ============================================================================
// AB. DUE DATE ACCESSIBILITY
// ============================================================================

test('AB: Due date elements have aria-label', () => {
    assert.match(homeworkJs, /aria-label="Teslim tarihi"/g);
    const ariaLabelCount = (homeworkJs.match(/aria-label="Teslim tarihi"/g) || []).length;
    assert.ok(ariaLabelCount >= 2, `Expected at least 2 aria-label="Teslim tarihi" (desktop + mobile), found ${ariaLabelCount}`);
});

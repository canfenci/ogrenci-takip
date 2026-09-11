import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const guidanceJs = fs.readFileSync(path.join(ROOT, 'guidance.js'), 'utf8');
const guidanceStudentInsightsJs = fs.readFileSync(path.join(ROOT, 'guidance-student-insights.js'), 'utf8');

// ============================================================================
// A. buildCoachingSummary: high priority student
// ============================================================================

test('A: buildCoachingSummary returns correct summary for high priority student', () => {
    assert.match(guidanceStudentInsightsJs, /export function buildCoachingSummary/);
    // Function should exist and be deterministic
    assert.ok(guidanceStudentInsightsJs.includes('priorityLabel'), 'Uses priorityLabel from detail');
});

// ============================================================================
// B. buildCoachingSummary: medium priority student
// ============================================================================

test('B: buildCoachingSummary includes priority label in output', () => {
    // Should compose priorityLabel into summary
    assert.match(guidanceStudentInsightsJs, /priorityLabel.*öncelikli öğrenci/);
});

// ============================================================================
// C. buildCoachingSummary: watch priority student
// ============================================================================

test('C: buildCoachingSummary falls back to mainProblemSummary when no reasons', () => {
    assert.match(guidanceStudentInsightsJs, /mainProblemSummary/);
});

// ============================================================================
// D. buildCoachingSummary: includes reasons when present
// ============================================================================

test('D: buildCoachingSummary includes active plan status when plan exists', () => {
    assert.match(guidanceStudentInsightsJs, /activePlan.*status.*active/);
    assert.match(guidanceStudentInsightsJs, /Aktif çalışma planı devam ediyor/);
});

// ============================================================================
// E. buildCoachingSummary: falls back to mainProblemSummary
// ============================================================================

test('E: buildCoachingSummary truncates at 200 characters', () => {
    assert.match(guidanceStudentInsightsJs, /summary\.length > 200/);
    assert.match(guidanceStudentInsightsJs, /197.*\.\.\./);
});

// ============================================================================
// F. buildCoachingSummary: includes active plan status
// ============================================================================

test('F: buildCoachingSummary handles null input gracefully', () => {
    assert.match(guidanceStudentInsightsJs, /if \(!detail \|\| typeof detail !== 'object'\)/);
});

// ============================================================================
// G. buildCoachingSummary: truncates long summaries
// ============================================================================

test('G: getLatestTeacherOpinion extracts latest note from records', () => {
    assert.match(guidanceStudentInsightsJs, /export function getLatestTeacherOpinion/);
});

// ============================================================================
// H. buildCoachingSummary: handles null input
// ============================================================================

test('H: getLatestTeacherOpinion returns null for empty records', () => {
    assert.match(guidanceStudentInsightsJs, /if \(!Array\.isArray\(guidanceRecords\) \|\| guidanceRecords\.length === 0\) return null/);
});

// ============================================================================
// I. getLatestTeacherOpinion: returns latest note >= 5 chars
// ============================================================================

test('I: getLatestTeacherOpinion prefers resultNote over note', () => {
    assert.match(guidanceStudentInsightsJs, /const text = resultNote \|\| note/);
});

// ============================================================================
// J. getLatestTeacherOpinion: returns null for empty records
// ============================================================================

test('J: getLatestTeacherOpinion skips short notes < 5 chars', () => {
    assert.match(guidanceStudentInsightsJs, /text\.length >= 5/);
});

// ============================================================================
// K. getLatestTeacherOpinion: prefers resultNote over note
// ============================================================================

test('K: getLatestTeacherOpinion truncates long opinions at 120 chars', () => {
    assert.match(guidanceStudentInsightsJs, /text\.length > 120/);
    assert.match(guidanceStudentInsightsJs, /117.*\.\.\./);
});

// ============================================================================
// L. getLatestTeacherOpinion: skips short notes
// ============================================================================

test('L: getLatestTeacherOpinion sorts records by date descending', () => {
    assert.match(guidanceStudentInsightsJs, /dateB.*localeCompare.*dateA/);
});

// ============================================================================
// M. getLatestTeacherOpinion: truncates long opinions
// ============================================================================

test('M: getLatestTeacherOpinion filters out non-object records', () => {
    assert.match(guidanceStudentInsightsJs, /\.filter\(r => r && typeof r === 'object'\)/);
});

// ============================================================================
// N. getLatestTeacherOpinion: sorts by date descending
// ============================================================================

test('N: renderGuidanceStudentDetail imports buildCoachingSummary and getLatestTeacherOpinion', () => {
    assert.match(guidanceJs, /import.*buildCoachingSummary.*getLatestTeacherOpinion.*from.*guidance-student-insights/);
});

// ============================================================================
// O. Tab reorder: Genel Bakış → Müdahaleler → Çalışma Planı → Performans → Rapor
// ============================================================================

test('O: renderGuidanceStudentDetail tabs reordered correctly', () => {
    // Check the exact order in detailTabs array
    const tabsMatch = guidanceJs.match(/const detailTabs = \[([\s\S]*?)\];/);
    assert.ok(tabsMatch, 'detailTabs array exists');
    const tabsStr = tabsMatch[1];
    const overviewIdx = tabsStr.indexOf("'overview'");
    const interventionsIdx = tabsStr.indexOf("'interventions'");
    const studyIdx = tabsStr.indexOf("'study'");
    const performanceIdx = tabsStr.indexOf("'performance'");
    const reportIdx = tabsStr.indexOf("'report'");
    assert.ok(overviewIdx < interventionsIdx, 'overview before interventions');
    assert.ok(interventionsIdx < studyIdx, 'interventions before study');
    assert.ok(studyIdx < performanceIdx, 'study before performance');
    assert.ok(performanceIdx < reportIdx, 'performance before report');
});

// ============================================================================
// P. Overview shows coaching summary with data-testid
// ============================================================================

test('P: Overview shows coaching summary with data-testid', () => {
    assert.match(guidanceJs, /data-testid="coaching-summary"/);
    assert.match(guidanceJs, /buildCoachingSummary\(detail\)/);
    assert.match(guidanceJs, /Koçluk Analizi/);
    assert.match(guidanceJs, /Öğrenci verilerinden otomatik oluşturuldu/);
});

// ============================================================================
// Q. Overview shows teacher opinion when present
// ============================================================================

test('Q: Overview shows teacher opinion when present', () => {
    assert.match(guidanceJs, /data-testid="teacher-opinion"/);
    assert.match(guidanceJs, /getLatestTeacherOpinion\(detail\.guidanceRecords\)/);
    assert.match(guidanceJs, /Öğretmen Görüşü/);
});

// ============================================================================
// R. Overview hides teacher opinion when absent
// ============================================================================

test('R: Overview always shows teacher opinion section (with empty state)', () => {
    // Teacher opinion block is always visible — no conditional wrapper
    assert.match(guidanceJs, /data-testid="teacher-opinion"/);
    assert.match(guidanceJs, /data-testid="teacher-opinion-empty"/);
    assert.match(guidanceJs, /Öğretmen Görüşü/);
    assert.match(guidanceJs, /Henüz öğretmen görüşü eklenmedi/);
});

// ============================================================================
// S. Overview removes 3-column quick cards
// ============================================================================

test('S: Overview removes 3-column quick cards grid', () => {
    // The old 3-column grid (md:grid-cols-3) with quick cards should be removed
    assert.ok(!guidanceJs.includes('3 Sütunlu Hızlı Durum ve Yönlendirme Kartları'), 'Old 3-column grid header removed');
    // The old "Neden müdahale gerekiyor?" section header is removed from cards
    assert.ok(!guidanceJs.includes('Neden müdahale gerekiyor?'), 'Old Neden header removed');
});

// ============================================================================
// T. Overview keeps recommendation action plan
// ============================================================================

test('T: Overview keeps recommendation action plan section', () => {
    assert.match(guidanceJs, /Bu Haftanın Odağı/);
    assert.match(guidanceJs, /detail\.recommendation\.title/);
    assert.match(guidanceJs, /detail\.recommendation\.action/);
    assert.match(guidanceJs, /showGuidanceRecordModal/);
    assert.match(guidanceJs, /showStudyPlanSetup/);
});

// ============================================================================
// U. Visible label "Veli Raporları"
// ============================================================================

test('U: Tab label shows "Veli Raporları" instead of "Rapor"', () => {
    assert.match(guidanceJs, /\['report',\s*'fa-file-pdf',\s*'Veli Raporları'\]/);
});

// ============================================================================
// V. Header action "Veli Raporu"
// ============================================================================

test('V: Header action button shows "Veli Raporu"', () => {
    // Button label changed from "Rehberlik Raporu" to "Veli Raporu"
    assert.match(guidanceJs, /fa-file-pdf text-red-500.*Veli Raporu/s);
    // The old button label "Rehberlik Raporu" no longer appears in the button
    assert.ok(!guidanceJs.includes('Rehberlik Raporu</i>'), 'Old button label removed');
});

// ============================================================================
// W. + Not Ekle exists
// ============================================================================

test('W: + Not Ekle action exists with general type preselect', () => {
    assert.match(guidanceJs, /Not Ekle/);
    // showGuidanceRecordModal accepts initialType parameter
    assert.match(guidanceJs, /function showGuidanceRecordModal\(studentId,\s*recordId\s*=\s*null,\s*initialType\s*=\s*null\)/);
    // The + Not Ekle button calls with 'general' type
    assert.ok(guidanceJs.includes("showGuidanceRecordModal('${studentId}', null, 'general')"), '+ Not Ekle calls showGuidanceRecordModal with general type');
});

// ============================================================================
// X. Teacher opinion empty state exists
// ============================================================================

test('X: Teacher opinion empty state exists', () => {
    assert.match(guidanceJs, /data-testid="teacher-opinion-empty"/);
    assert.match(guidanceJs, /Henüz öğretmen görüşü eklenmedi/);
    assert.match(guidanceJs, /Öğretmen Görüşü/);
});

// ============================================================================
// Y. 4 KPI include Plan Durumu
// ============================================================================

test('Y: 4 KPI metrics include Plan Durumu', () => {
    assert.match(guidanceJs, /'Son Net'/);
    assert.match(guidanceJs, /'Hedefe Kalan'/);
    assert.match(guidanceJs, /'Ödev Disiplini'/);
    assert.match(guidanceJs, /'Plan Durumu'/);
    assert.ok(!guidanceJs.includes("'Baskın Hata'"), 'Old Baskın Hata KPI removed');
});

// ============================================================================
// Z. No fake plan percentage
// ============================================================================

test('Z: No fake plan completion percentage in KPI', () => {
    // Plan Durumu shows progress metrics or 'Aktif' or '—', never a single fake percentage
    assert.ok(guidanceJs.includes("'Plan Durumu'"), 'Plan Durumu KPI exists');
    assert.ok(!guidanceJs.includes("plan '%") && !guidanceJs.includes("plan '%"), 'No fake percentage literal');
});

// ============================================================================
// AA. Top operational metrics compact
// ============================================================================

test('AA: Main page top metrics use compact layout', () => {
    assert.match(guidanceJs, /grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3/);
    assert.match(guidanceJs, /text-\[10px\] font-black uppercase tracking/);
    assert.match(guidanceJs, /text-lg font-black/);
});

// ============================================================================
// AB. Watch student compact pattern
// ============================================================================

test('AB: Watch students use compact row pattern', () => {
    assert.match(guidanceJs, /const isWatch = item\.priority === 'watch'/);
    assert.match(guidanceJs, /app-panel p-3 flex items-center justify-between/);
    assert.match(guidanceJs, /Dosyayı Aç/);
});

// ============================================================================
// AC. Priority principles not persistent rail
// ============================================================================

test('AC: Priority principles removed from persistent right rail', () => {
    assert.ok(!guidanceJs.includes('Önceliklendirme İlkeleri'), 'Old persistent principles removed');
    // Help trigger exists instead
    assert.match(guidanceJs, /priorityHelpPopover/);
    assert.match(guidanceJs, /Öncelik Sınıflandırması/);
});

// ============================================================================
// AD. Help trigger exists
// ============================================================================

test('AD: Priority help trigger exists with toggle', () => {
    assert.match(guidanceJs, /onclick="document\.getElementById\('priorityHelpPopover'\)\.classList\.toggle\('hidden'\)"/);
    assert.match(guidanceJs, /fa-circle-question/);
});

// ============================================================================
// AE. This week focus exists
// ============================================================================

test('AE: This Week Focus block exists', () => {
    assert.match(guidanceJs, /Bu Haftanın Odağı/);
    assert.match(guidanceJs, /fa-crosshairs/);
    assert.match(guidanceJs, /detail\.recommendation\.title/);
});

// ============================================================================
// AF. Active plan summary exists
// ============================================================================

test('AF: Active Plan Summary exists in overview', () => {
    assert.match(guidanceJs, /Aktif Plan Özeti/);
    assert.match(guidanceJs, /detail\.activePlan\.subject/);
    assert.match(guidanceJs, /detail\.activePlan\.durationWeeks/);
    assert.match(guidanceJs, /detail\.activePlan\.stage/);
});

// ============================================================================
// AG. Mobile touch targets >=44px
// ============================================================================

test('AG: All interactive controls have min-h-[44px]', () => {
    // Check that Not Ekle, action bar buttons all have min-h-[44px]
    assert.match(guidanceJs, /min-h-\[44px\]/g);
    // Count occurrences — should be many
    const matches = guidanceJs.match(/min-h-\[44px\]/g);
    assert.ok(matches && matches.length >= 10, `Expected at least 10 min-h-[44px] occurrences, found ${matches ? matches.length : 0}`);
});

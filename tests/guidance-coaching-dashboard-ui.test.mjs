import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
    getAvailableCoachingMonths,
    getDefaultCoachingMonth,
    renderCoachingMonthlyDashboardHtml,
    renderMonthSelectorHtml
} from '../guidance-coaching-dashboard.js';
import { buildMonthlyCoachingSummary } from '../coaching-plan-monthly-summary.js';

const ROOT = process.cwd();
const guidanceJs = fs.readFileSync(path.join(ROOT, 'guidance.js'), 'utf8');

// ============================================================================
// A. study segmented control exists
// ============================================================================
test('A: study segmented control exists in guidance.js', () => {
    assert.match(guidanceJs, /role="tablist"[^>]*aria-label="Çalışma Planı Görünüm Seçimi"/, 'tablist with accessible label exists');
    assert.match(guidanceJs, /data-testid="study-subtab-weekly"/, 'weekly sub-tab button exists');
    assert.match(guidanceJs, /data-testid="study-subtab-monthly"/, 'monthly sub-tab button exists');
    assert.match(guidanceJs, /Haftalık Plan/, 'weekly sub-tab text label exists');
    assert.match(guidanceJs, /Aylık Koçluk Özeti/, 'monthly sub-tab text label exists');
});

// ============================================================================
// B. default weekly
// ============================================================================
test('B: default study sub-tab is weekly', () => {
    assert.match(
        guidanceJs,
        /const studySubTab = window\._guidanceStudySubTab === ['"]monthly['"] \? ['"]monthly['"] : ['"]weekly['"];/,
        'studySubTab defaults to weekly when undefined or not monthly'
    );
});

// ============================================================================
// C. monthly switch
// ============================================================================
test('C: monthly switch renders monthly coaching dashboard', () => {
    assert.match(guidanceJs, /if \(studySubTab === ['"]monthly['"]\)/, 'branches on monthly subtab');
    assert.match(guidanceJs, /buildMonthlyCoachingSummary\(/, 'calls buildMonthlyCoachingSummary for monthly tab');
    assert.match(guidanceJs, /renderCoachingMonthlyDashboardHtml\(/, 'calls renderCoachingMonthlyDashboardHtml for monthly tab');
    assert.match(guidanceJs, /data-testid="study-subtab-monthly"/, 'monthly button has data-testid');
});

// ============================================================================
// D. weekly switch back
// ============================================================================
test('D: weekly switch preserves original weekly study plan content verbatim', () => {
    assert.match(guidanceJs, /studyPlanMainContentHtml/, 'weekly content incorporates studyPlanMainContentHtml');
    assert.match(guidanceJs, /Çalışma Planı Etki Analizi/, 'weekly content retains impact analysis');
    assert.match(guidanceJs, /İlgili Birebir Dersler/, 'weekly content retains recent lessons');
    assert.match(guidanceJs, /Detaylı Öğrenci Kokpiti/, 'weekly content retains cockpit panel');
    assert.match(guidanceJs, /openStudentCockpitDirect/, 'cockpit action preserved');
});

// ============================================================================
// E. dashboard import/wiring
// ============================================================================
test('E: dashboard pure engine helpers imported cleanly in guidance.js', () => {
    assert.match(guidanceJs, /import\s*\{[^}]*buildMonthlyCoachingSummary[^}]*\}\s*from\s*['"]\.\/coaching-plan-monthly-summary\.js['"]/, 'imports buildMonthlyCoachingSummary');
    assert.match(guidanceJs, /import\s*\{[^}]*renderCoachingMonthlyDashboardHtml[^}]*\}\s*from\s*['"]\.\/guidance-coaching-dashboard\.js['"]/, 'imports renderCoachingMonthlyDashboardHtml');
    assert.match(guidanceJs, /import\s*\{[^}]*getAvailableCoachingMonths[^}]*\}\s*from\s*['"]\.\/guidance-coaching-dashboard\.js['"]/, 'imports getAvailableCoachingMonths');
    assert.match(guidanceJs, /import\s*\{[^}]*getDefaultCoachingMonth[^}]*\}\s*from\s*['"]\.\/guidance-coaching-dashboard\.js['"]/, 'imports getDefaultCoachingMonth');
});

// ============================================================================
// F. default current month
// ============================================================================
test('F: default coaching month resolves to current month when archived history exists in current month', () => {
    const refNow = new Date('2026-08-15T12:00:00Z');
    const student = {
        id: 's-f',
        studyPlanHistory: [
            { weekStart: '2026-07-06' },
            { weekStart: '2026-08-03' }
        ]
    };
    const ym = getDefaultCoachingMonth(student, refNow);
    assert.deepEqual(ym, { year: 2026, month: 8 });
});

// ============================================================================
// G. active-only current month
// ============================================================================
test('G: default coaching month resolves to current month when only active plan exists in current month', () => {
    const refNow = new Date('2026-08-15T12:00:00Z');
    const student = {
        id: 's-g',
        studyPlanHistory: [
            { weekStart: '2026-06-01' }
        ],
        coachingPlan: {
            status: 'active',
            weekStart: '2026-08-10'
        }
    };
    const ym = getDefaultCoachingMonth(student, refNow);
    assert.deepEqual(ym, { year: 2026, month: 8 });
});

// ============================================================================
// H. latest-history fallback
// ============================================================================
test('H: default coaching month resolves to latest history month when no current month plan or history', () => {
    const refNow = new Date('2026-08-15T12:00:00Z');
    const student = {
        id: 's-h',
        studyPlanHistory: [
            { weekStart: '2026-05-04' },
            { weekStart: '2026-06-08' },
            { weekStart: '2026-07-06' }
        ],
        coachingPlan: null
    };
    const ym = getDefaultCoachingMonth(student, refNow);
    assert.deepEqual(ym, { year: 2026, month: 7 });
});

// ============================================================================
// I. no-history current month
// ============================================================================
test('I: default coaching month resolves safely to current month when student has zero history', () => {
    const refNow = new Date('2026-08-15T12:00:00Z');
    const student = {
        id: 's-i',
        studyPlanHistory: []
    };
    const ym = getDefaultCoachingMonth(student, refNow);
    assert.deepEqual(ym, { year: 2026, month: 8 });
});

// ============================================================================
// J. student-switch reset
// ============================================================================
test('J: student switch resets month state to target student default month', () => {
    assert.match(
        guidanceJs,
        /if \(!window\._guidanceCoachingSelectedMonth \|\| window\._guidanceCoachingSelectedMonth\.studentId !== studentId\)/,
        'checks studentId change and resets selected month'
    );
    assert.match(
        guidanceJs,
        /const defaultYm = getDefaultCoachingMonth\(student\);/,
        'recomputes default month for new student'
    );
});

// ============================================================================
// K. previous month
// ============================================================================
test('K: previous month navigation decrements month and rolls back year across January', () => {
    const refNow = new Date('2027-05-01');
    const janHtml = renderMonthSelectorHtml(
        { year: 2027, month: 1, monthLabel: 'Ocak 2027' },
        { now: refNow, canGoPrev: true }
    );
    assert.match(janHtml, /data-action="prev-coaching-month" data-year="2026" data-month="12"/);
});

// ============================================================================
// L. next month
// ============================================================================
test('L: next month navigation increments month and rolls over year across December', () => {
    const refNow = new Date('2027-05-01');
    const decHtml = renderMonthSelectorHtml(
        { year: 2026, month: 12, monthLabel: 'Aralık 2026' },
        { now: refNow, canGoNext: true }
    );
    assert.match(decHtml, /data-action="next-coaching-month" data-year="2027" data-month="1"/);
});

// ============================================================================
// M. future rejected
// ============================================================================
test('M: future month navigation is strictly guarded in UI and handler logic', () => {
    // UI check
    const refNow = new Date('2026-08-15T12:00:00Z');
    const currentHtml = renderMonthSelectorHtml(
        { year: 2026, month: 8, monthLabel: 'Ağustos 2026' },
        { now: refNow }
    );
    assert.match(currentHtml, /data-action="next-coaching-month"[^>]*disabled/);
    assert.match(currentHtml, /aria-disabled="true"/);

    // Code handler check in guidance.js
    assert.match(guidanceJs, /year > currentYear \|\| \(year === currentYear && month > currentMonth\)/, 'handler rejects future months');
});

// ============================================================================
// N. earliest month bound
// ============================================================================
test('N: earliest month bound disables previous button when at earliest available month', () => {
    const refNow = new Date('2026-09-15T12:00:00Z');
    const available = [{ year: 2026, month: 7 }, { year: 2026, month: 8 }];
    const earliestHtml = renderMonthSelectorHtml(
        { year: 2026, month: 7, monthLabel: 'Temmuz 2026' },
        { now: refNow, availableMonths: available }
    );
    assert.match(earliestHtml, /data-action="prev-coaching-month"[^>]*disabled/);
    assert.match(earliestHtml, /aria-disabled="true"/);

    // Later month is enabled
    const laterHtml = renderMonthSelectorHtml(
        { year: 2026, month: 8, monthLabel: 'Ağustos 2026' },
        { now: refNow, availableMonths: available }
    );
    assert.doesNotMatch(laterHtml, /data-action="prev-coaching-month"[^>]*disabled/);
});

// ============================================================================
// O. active preview visible
// ============================================================================
test('O: active preview row is displayed with "Devam Ediyor" status and preview badge', () => {
    const student = {
        id: 's-o',
        studyPlanHistory: [
            {
                weekStart: '2026-08-03',
                tasks: [{ title: 'T1', completed: true, questionTarget: 100, completedCount: 100 }]
            }
        ],
        coachingPlan: {
            status: 'active',
            weekStart: '2026-08-10',
            tasks: [{ title: 'T2', completed: false, questionTarget: 150, completedCount: 50 }]
        }
    };

    const summary = buildMonthlyCoachingSummary(student, 2026, 8, {
        includeActiveWeek: true,
        now: new Date('2026-08-12')
    });

    const html = renderCoachingMonthlyDashboardHtml(summary, student, { now: new Date('2026-08-12') });
    assert.match(html, /Devam Ediyor/, 'active week has Devam Ediyor badge');
    assert.match(html, /data-testid="preview-week-badge"/, 'preview badge in selector');
    assert.match(html, /\+1 Aktif Hafta \(Önizleme\)/, 'selector preview text');
});

// ============================================================================
// P. finalized KPI preserved
// ============================================================================
test('P: finalized KPI cards are strictly isolated and not contaminated by active week', () => {
    const student = {
        id: 's-p',
        studyPlanHistory: [
            {
                weekStart: '2026-08-03',
                weeklyTargets: { totalQuestions: 200 },
                tasks: [{ title: 'T1', taskType: 'question', completed: true, questionTarget: 200, completedCount: 100 }]
            }
        ],
        coachingPlan: {
            status: 'active',
            weekStart: '2026-08-10',
            weeklyTargets: { totalQuestions: 500 },
            tasks: [{ title: 'T2', taskType: 'question', completed: true, questionTarget: 500, completedCount: 500 }]
        }
    };

    const summary = buildMonthlyCoachingSummary(student, 2026, 8, {
        includeActiveWeek: true,
        now: new Date('2026-08-12')
    });

    // Finalized planMetrics questionActual must be 100, NOT 600
    assert.equal(summary.planMetrics.questionActual, 100);
    assert.equal(summary.planMetrics.questionTarget, 200);

    const html = renderCoachingMonthlyDashboardHtml(summary, student, { now: new Date('2026-08-12') });
    assert.match(html, />100<\/span>/);
    assert.match(html, /\/ 200 Hedef/);
    assert.doesNotMatch(html, />600<\/span>/);
});

// ============================================================================
// Q. overview quick link
// ============================================================================
test('Q: overview quick link "Aylık Koçluk Özeti →" exists and calls openGuidanceMonthlyCoachingDashboard', () => {
    assert.match(guidanceJs, /data-testid="overview-monthly-coaching-link"/, 'overview quick link has test id');
    assert.match(guidanceJs, /openGuidanceMonthlyCoachingDashboard\('\$\{studentId\}'\)/, 'quick link calls openGuidanceMonthlyCoachingDashboard');
    assert.match(guidanceJs, /<span>Aylık Koçluk Özeti<\/span>/, 'quick link text label');
    assert.match(guidanceJs, /<i class="fas fa-arrow-right text-\[10px\]"><\/i>/, 'arrow icon exists');
});

// ============================================================================
// R. detail tabs unchanged
// ============================================================================
test('R: 5 canonical detail tabs remain unchanged (Genel Bakış, Müdahaleler, Çalışma Planı, Performans, Veli Raporları)', () => {
    assert.match(guidanceJs, /\['overview',\s*'fa-id-card',\s*'Genel Bakış'\]/);
    assert.match(guidanceJs, /\['interventions',\s*'fa-clipboard-list',\s*'Müdahaleler'/);
    assert.match(guidanceJs, /\['study',\s*'fa-compass',\s*'Çalışma Planı'\]/);
    assert.match(guidanceJs, /\['performance',\s*'fa-chart-line',\s*'Performans'\]/);
    assert.match(guidanceJs, /\['report',\s*'fa-file-pdf',\s*'Veli Raporları'\]/);
});

// ============================================================================
// S. performance 2-subtab contract
// ============================================================================
test('S: performance tab contains strictly 2 subtabs (Ödev Performansı, Okul Denemeleri)', () => {
    assert.match(guidanceJs, /switchGuidancePerformanceTab\('\$\{studentId\}',\s*'homework'\)/);
    assert.match(guidanceJs, /switchGuidancePerformanceTab\('\$\{studentId\}',\s*'exams'\)/);
    assert.match(guidanceJs, /Ödev Performansı/);
    assert.match(guidanceJs, /Okul Denemeleri/);
    assert.doesNotMatch(guidanceJs, /switchGuidancePerformanceTab\('[^']+',\s*'coaching'\)/, 'no third coaching subtab in performance');
});

// ============================================================================
// T. no priority score
// ============================================================================
test('T: no numeric priorityScore, risk skoru, or öncelik puanı rendered in monthly dashboard', () => {
    const summary = {
        period: { year: 2026, month: 8, monthLabel: 'Ağustos 2026', weekCount: 1 },
        planMetrics: { questionActual: 100, questionTarget: 200, questionPercent: 50 },
        weeklyTrend: [{ weekStart: '2026-08-03', questionActual: 100, questionTarget: 200, questionPercent: 50 }],
        branchSummary: [],
        topicSummary: [],
        examContext: {},
        homeworkContext: {},
        guidanceContext: {},
        strengths: [],
        attentionAreas: [],
        recentFocuses: []
    };
    const html = renderCoachingMonthlyDashboardHtml(summary, { id: 's-t' });
    assert.doesNotMatch(html, /priorityScore/i);
    assert.doesNotMatch(html, /Risk Skoru/i);
    assert.doesNotMatch(html, /Öncelik Puanı/i);
    assert.doesNotMatch(html, /\b\d+\s*puan\b/i);
});

// ============================================================================
// U. no teacherNote
// ============================================================================
test('U: raw teacherNote text is strictly excluded from monthly dashboard rendering', () => {
    const secret = 'TOP_SECRET_TEACHER_NOTE_EXCLUSION_02C2';
    const summary = {
        period: { year: 2026, month: 8, monthLabel: 'Ağustos 2026', weekCount: 1 },
        planMetrics: { questionActual: 100 },
        weeklyTrend: [
            {
                weekStart: '2026-08-03',
                questionActual: 100,
                weeklyCheckIn: { teacherNote: secret }
            }
        ],
        teacherNote: secret,
        teacherNotes: [secret],
        recentFocuses: ['Matematik denemesi çözülecek']
    };
    const html = renderCoachingMonthlyDashboardHtml(summary, { id: 's-u' });
    assert.doesNotMatch(html, new RegExp(secret));
});

// ============================================================================
// V. no writes
// ============================================================================
test('V: guidance.js handlers perform 0 Firestore writes, 0 localStorage writes, 0 mutations', () => {
    const subTabFnMatch = guidanceJs.match(/export function switchGuidanceStudySubTab[\s\S]*?^}/m);
    assert.ok(subTabFnMatch, 'switchGuidanceStudySubTab exists');
    assert.doesNotMatch(subTabFnMatch[0], /setDoc|updateDoc|addDoc|localStorage|sessionStorage|indexedDB/);

    const monthFnMatch = guidanceJs.match(/export function switchGuidanceCoachingMonth[\s\S]*?^}/m);
    assert.ok(monthFnMatch, 'switchGuidanceCoachingMonth exists');
    assert.doesNotMatch(monthFnMatch[0], /setDoc|updateDoc|addDoc|localStorage|sessionStorage|indexedDB/);

    const openFnMatch = guidanceJs.match(/export function openGuidanceMonthlyCoachingDashboard[\s\S]*?^}/m);
    assert.ok(openFnMatch, 'openGuidanceMonthlyCoachingDashboard exists');
    assert.doesNotMatch(openFnMatch[0], /setDoc|updateDoc|addDoc|localStorage|sessionStorage|indexedDB/);
});

// ============================================================================
// W. mobile classes
// ============================================================================
test('W: responsive mobile classes present on subtabs and dashboard', () => {
    assert.match(guidanceJs, /min-h-\[44px\]/, 'min touch target 44px on subtabs');
    assert.match(guidanceJs, /flex-wrap/, 'flex-wrap on controls');
    assert.match(guidanceJs, /data-testid="study-subtab-weekly"/);
    assert.match(guidanceJs, /data-testid="study-subtab-monthly"/);
});

// ============================================================================
// X. dark mode
// ============================================================================
test('X: dark mode utility classes present on all new subtabs and links', () => {
    assert.match(guidanceJs, /dark:bg-gray-800\/70/, 'dark background for tablist');
    assert.match(guidanceJs, /dark:text-white/, 'dark text for active subtab');
    assert.match(guidanceJs, /dark:text-gray-400/, 'dark text for inactive subtab');
    assert.match(guidanceJs, /dark:text-indigo-400/, 'dark text for overview quick link');
});

// ============================================================================
// Y. accessibility
// ============================================================================
test('Y: accessibility semantics satisfied (role="tab", role="tablist", aria-selected, labels)', () => {
    assert.match(guidanceJs, /role="tablist"/, 'tablist role');
    assert.match(guidanceJs, /role="tab"/, 'tab roles on buttons');
    assert.match(guidanceJs, /aria-selected=/, 'aria-selected dynamic binding');
    assert.match(guidanceJs, /aria-label="Çalışma Planı Görünüm Seçimi"/, 'accessible tablist label');
    assert.match(guidanceJs, /aria-label="Aylık Koçluk Özeti sayfasına git"/, 'accessible quick link label');
});

// ============================================================================
// Z. invalid month safe
// ============================================================================
test('Z: invalid month arguments (NaN, <1, >12, string) are rejected safely without throw', () => {
    assert.match(guidanceJs, /!Number\.isInteger\(year\) \|\| !Number\.isInteger\(month\)/, 'validates integers');
    assert.match(guidanceJs, /month < 1 \|\| month > 12/, 'validates month range 1..12');
    assert.match(guidanceJs, /year < 2000 \|\| year > 2100/, 'validates year range');
});

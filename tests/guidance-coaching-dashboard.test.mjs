import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    parseYearMonth,
    escapeHtml,
    getAvailableCoachingMonths,
    getDefaultCoachingMonth,
    renderMonthSelectorHtml,
    renderCoachingKpiCardsHtml,
    renderWeeklyTrendHtml,
    renderBranchSummaryHtml,
    renderTopicSummaryHtml,
    renderContextCardsHtml,
    renderStrengthsAndAttentionHtml,
    renderRecentFocusesHtml,
    renderCoachingEmptyStateHtml,
    renderCoachingMonthlyDashboardHtml
} from '../guidance-coaching-dashboard.js';

// Deep-freeze helper to verify mutation safety
function deepFreeze(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    Object.freeze(obj);
    for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            deepFreeze(obj[key]);
        }
    }
    return obj;
}

test('02C1-01: Module Purity & Exports', () => {
    assert.equal(typeof parseYearMonth, 'function');
    assert.equal(typeof escapeHtml, 'function');
    assert.equal(typeof getAvailableCoachingMonths, 'function');
    assert.equal(typeof getDefaultCoachingMonth, 'function');
    assert.equal(typeof renderMonthSelectorHtml, 'function');
    assert.equal(typeof renderCoachingKpiCardsHtml, 'function');
    assert.equal(typeof renderWeeklyTrendHtml, 'function');
    assert.equal(typeof renderBranchSummaryHtml, 'function');
    assert.equal(typeof renderTopicSummaryHtml, 'function');
    assert.equal(typeof renderContextCardsHtml, 'function');
    assert.equal(typeof renderStrengthsAndAttentionHtml, 'function');
    assert.equal(typeof renderRecentFocusesHtml, 'function');
    assert.equal(typeof renderCoachingEmptyStateHtml, 'function');
    assert.equal(typeof renderCoachingMonthlyDashboardHtml, 'function');

    // Confirm no global window or document access in pure module
    assert.equal(typeof globalThis.window, 'undefined');
    assert.equal(typeof globalThis.document, 'undefined');
});

test('02C1-02: getAvailableCoachingMonths contract (dedup, valid YYYY-MM, ascending order)', () => {
    const student = {
        studyPlanHistory: [
            { weekStart: '2026-08-10' },
            { weekStart: '2026-07-20' },
            { weekStart: '2026-08-17' }, // Duplicate August
            { weekStart: 'invalid-date' },
            null,
            { weekStart: '2026-09-01' }
        ],
        coachingPlan: {
            status: 'active',
            weekStart: '2026-09-15' // Duplicate September
        }
    };

    const months = getAvailableCoachingMonths(student);
    assert.deepEqual(months, [
        { year: 2026, month: 7 },
        { year: 2026, month: 8 },
        { year: 2026, month: 9 }
    ]);

    // Handles null / empty safely
    assert.deepEqual(getAvailableCoachingMonths(null), []);
    assert.deepEqual(getAvailableCoachingMonths({}), []);
});

test('02C1-03: getDefaultCoachingMonth contract (Policies A, B, C, D with explicit now)', () => {
    const refNow = new Date('2026-08-15T10:00:00Z'); // Current is August 2026

    // Policy A: Archived history has August 2026
    const studentA = {
        studyPlanHistory: [
            { weekStart: '2026-06-01' },
            { weekStart: '2026-08-03' }
        ]
    };
    assert.deepEqual(getDefaultCoachingMonth(studentA, refNow), { year: 2026, month: 8 });

    // Policy B: No archived August, but active coachingPlan in August 2026
    const studentB = {
        studyPlanHistory: [
            { weekStart: '2026-05-01' }
        ],
        coachingPlan: {
            status: 'active',
            weekStart: '2026-08-10'
        }
    };
    assert.deepEqual(getDefaultCoachingMonth(studentB, refNow), { year: 2026, month: 8 });

    // Policy C: No August data, but history exists (latest is July 2026)
    const studentC = {
        studyPlanHistory: [
            { weekStart: '2026-05-10' },
            { weekStart: '2026-07-20' }
        ],
        coachingPlan: {
            status: 'completed', // completed, not active/draft
            weekStart: '2026-07-27'
        }
    };
    assert.deepEqual(getDefaultCoachingMonth(studentC, refNow), { year: 2026, month: 7 });

    // Policy D: Zero history, zero plan -> falls back to current month (August 2026)
    const studentD = {
        studyPlanHistory: []
    };
    assert.deepEqual(getDefaultCoachingMonth(studentD, refNow), { year: 2026, month: 8 });
});

test('02C1-04: Future Month Guard (current month -> next disabled; past month -> next enabled)', () => {
    const refNow = new Date('2026-08-15T12:00:00Z');

    // Case 1: Selected month is current month (August 2026) -> Next button MUST be disabled
    const currentHtml = renderMonthSelectorHtml(
        { year: 2026, month: 8, monthLabel: 'Ağustos 2026' },
        { now: refNow }
    );
    assert.match(currentHtml, /disabled/);
    assert.match(currentHtml, /aria-disabled="true"/);
    assert.match(currentHtml, /cursor-not-allowed/);

    // Case 2: Selected month is past month (July 2026) -> Next button MUST be enabled
    const pastHtml = renderMonthSelectorHtml(
        { year: 2026, month: 7, monthLabel: 'Temmuz 2026' },
        { now: refNow }
    );
    assert.doesNotMatch(pastHtml, /disabled/);
    assert.doesNotMatch(pastHtml, /aria-disabled="true"/);
    assert.doesNotMatch(pastHtml, /cursor-not-allowed/);
});

test('02C1-04b: Earliest Month Bound (canGoPrev and availableMonths policy)', () => {
    const refNow = new Date('2026-09-15T12:00:00Z');
    const availableMonths = [
        { year: 2026, month: 7 },
        { year: 2026, month: 8 }
    ];

    // Case 1: At earliest available month (July 2026) -> Previous button MUST be disabled
    const earliestHtml = renderMonthSelectorHtml(
        { year: 2026, month: 7, monthLabel: 'Temmuz 2026' },
        { now: refNow, availableMonths }
    );
    assert.match(earliestHtml, /data-action="prev-coaching-month"[^>]*disabled/);
    assert.match(earliestHtml, /data-action="prev-coaching-month"[^>]*aria-disabled="true"/);

    // Case 2: Above earliest month (August 2026) -> Previous button MUST be enabled
    const laterHtml = renderMonthSelectorHtml(
        { year: 2026, month: 8, monthLabel: 'Ağustos 2026' },
        { now: refNow, availableMonths }
    );
    assert.doesNotMatch(laterHtml, /data-action="prev-coaching-month"[^>]*disabled/);

    // Case 3: Empty available months -> Previous button MUST be disabled
    const emptyHtml = renderMonthSelectorHtml(
        { year: 2026, month: 8, monthLabel: 'Ağustos 2026' },
        { now: refNow, availableMonths: [] }
    );
    assert.match(emptyHtml, /data-action="prev-coaching-month"[^>]*disabled/);

    // Case 4: Explicit canGoPrev: false -> Previous button MUST be disabled
    const explicitDisabledHtml = renderMonthSelectorHtml(
        { year: 2026, month: 8, monthLabel: 'Ağustos 2026' },
        { now: refNow, canGoPrev: false }
    );
    assert.match(explicitDisabledHtml, /data-action="prev-coaching-month"[^>]*disabled/);
});

test('02C1-05: Month Boundaries (Jan previous -> Dec prev year, Dec next -> Jan next year)', () => {
    // January 2027 previous -> December 2026
    const janHtml = renderMonthSelectorHtml(
        { year: 2027, month: 1, monthLabel: 'Ocak 2027' },
        { now: new Date('2027-05-01') }
    );
    assert.match(janHtml, /data-action="prev-coaching-month" data-year="2026" data-month="12"/);

    // December 2026 next -> January 2027
    const decHtml = renderMonthSelectorHtml(
        { year: 2026, month: 12, monthLabel: 'Aralık 2026' },
        { now: new Date('2027-05-01') }
    );
    assert.match(decHtml, /data-action="next-coaching-month" data-year="2027" data-month="1"/);
});

test('02C1-06: KPI Finalized-Only Gate (active week must NEVER contaminate finalized totals)', () => {
    // planMetrics has 100/200 questions finalized
    const planMetrics = {
        questionActual: 100,
        questionTarget: 200,
        questionPercent: 50,
        taskCompleted: 5,
        taskTotal: 10,
        taskPercent: 50,
        examActual: 1,
        examTarget: 2,
        examPercent: 50
    };

    const period = {
        year: 2026,
        month: 8,
        finalizedWeekCount: 1,
        previewWeekIncluded: true
    };

    const html = renderCoachingKpiCardsHtml(planMetrics, period);

    // Verbatim from planMetrics: 100 / 200 (%50)
    assert.match(html, />100<\/span>/);
    assert.match(html, /\/ 200 Hedef/);
    assert.match(html, /%50/);

    // Must NOT contain contaminated active numbers like 200 / 300
    assert.doesNotMatch(html, />200<\/span>/);
    assert.doesNotMatch(html, /\/ 300/);
});

test('02C1-07: Active Preview (Devam Ediyor vs Tamamlandı)', () => {
    const weeklyTrend = [
        {
            weekStart: '2026-08-03',
            weekEnd: '2026-08-09',
            questionActual: 300,
            questionTarget: 300,
            questionPercent: 100,
            taskCompleted: 8,
            taskTotal: 8,
            taskPercent: 100,
            isPreview: false
        },
        {
            weekStart: '2026-08-10',
            weekEnd: '2026-08-16',
            questionActual: 100,
            questionTarget: 300,
            questionPercent: 33,
            taskCompleted: 2,
            taskTotal: 8,
            taskPercent: 25,
            isPreview: true
        }
    ];

    const html = renderWeeklyTrendHtml(weeklyTrend);

    // Archived week renders "Tamamlandı"
    assert.match(html, /Tamamlandı/);

    // Active week renders "Devam Ediyor" and NOT completed semantics
    assert.match(html, /Devam Ediyor/);
    assert.match(html, /data-is-preview="true"/);
});

test('02C1-08: Hostile Teacher Note Exclusion (SECRET_TEACHER_NOTE_02C1 must be absent)', () => {
    const secretMarker = 'SECRET_TEACHER_NOTE_02C1';

    const summaryWithSecret = {
        period: { year: 2026, month: 8, monthLabel: 'Ağustos 2026', weekCount: 1 },
        planMetrics: { questionActual: 100, taskCompleted: 5 },
        weeklyTrend: [
            {
                weekStart: '2026-08-03',
                questionActual: 100,
                weeklyCheckIn: { teacherNote: secretMarker }
            }
        ],
        teacherNote: secretMarker,
        teacherNotes: [secretMarker],
        recentFocuses: ['Matematik denemesi çözülecek']
    };

    const html = renderCoachingMonthlyDashboardHtml(summaryWithSecret, {
        teacherNote: secretMarker
    }, {
        teacherNote: secretMarker
    });

    assert.doesNotMatch(html, new RegExp(secretMarker));
    assert.doesNotMatch(html, /Öğretmen Check-In Günlüğü/i);
    assert.doesNotMatch(html, /teacherNote/i);
});

test('02C1-09: Hostile Priority Score Exclusion (numeric score must be absent)', () => {
    const summaryWithPriority = {
        period: { year: 2026, month: 8, monthLabel: 'Ağustos 2026', weekCount: 1 },
        planMetrics: { questionActual: 200, taskCompleted: 10 },
        priorityScore: 97,
        priorityLabel: 'Yüksek',
        score: '97 puan',
        riskScore: 97
    };

    const html = renderCoachingMonthlyDashboardHtml(summaryWithPriority);

    assert.doesNotMatch(html, /\b97\b/);
    assert.doesNotMatch(html, /97\s*puan/i);
    assert.doesNotMatch(html, /Öncelik Puanı/i);
    assert.doesNotMatch(html, /Risk Skoru/i);
});

test('02C1-10: Recent Focuses (max 4, HTML escaped, empty strings ignored, teacherNote excluded)', () => {
    const focuses = [
        '  Paragrafta süre tutulacak  ',
        'Fen <Bilimleri> denemesi',
        '',
        '   ',
        'Çarpanlar ve katlar',
        'Üslü ifadeler',
        '5. Fazla Odak (Görünmemeli)'
    ];

    const html = renderRecentFocusesHtml(focuses);

    assert.match(html, /Paragrafta süre tutulacak/);
    assert.match(html, /Fen &lt;Bilimleri&gt; denemesi/);
    assert.match(html, /Çarpanlar ve katlar/);
    assert.match(html, /Üslü ifadeler/);
    assert.doesNotMatch(html, /5\. Fazla Odak/);

    // Empty list fallback
    const emptyHtml = renderRecentFocusesHtml([]);
    assert.match(emptyHtml, /Kayıtlı haftalık odak bulunmuyor/);
});

test('02C1-11: Branch Ordering (actual descending, tie -> Turkish locale, max 5)', () => {
    const branches = [
        { subject: 'Türkçe', actual: 300, target: 300, percent: 100 },
        { subject: 'Fen Bilimleri', actual: 400, target: 400, percent: 100 },
        { subject: 'Matematik', actual: 400, target: 400, percent: 100 }, // Same actual as Fen -> tiebreak: Fen Bilimleri < Matematik
        { subject: 'İngilizce', actual: 150, target: 150, percent: 100 },
        { subject: 'Din Kültürü', actual: 200, target: 200, percent: 100 },
        { subject: 'İnkılap', actual: 100, target: 100, percent: 100 } // 6th branch
    ];

    const html = renderBranchSummaryHtml(branches);

    // 1st: Fen Bilimleri (400, F < M), 2nd: Matematik (400), 3rd: Türkçe (300), 4th: Din Kültürü (200), 5th: İngilizce (150)
    const fenIdx = html.indexOf('Fen Bilimleri');
    const matIdx = html.indexOf('Matematik');
    const turkIdx = html.indexOf('Türkçe');
    const dinIdx = html.indexOf('Din Kültürü');
    const ingIdx = html.indexOf('İngilizce');

    assert.ok(fenIdx !== -1 && matIdx !== -1 && turkIdx !== -1 && dinIdx !== -1 && ingIdx !== -1);
    assert.ok(fenIdx < matIdx, 'Fen Bilimleri should come before Matematik on tie-break');
    assert.ok(matIdx < turkIdx, 'Matematik (400) should come before Türkçe (300)');
    assert.ok(turkIdx < dinIdx, 'Türkçe (300) should come before Din Kültürü (200)');
    assert.ok(dinIdx < ingIdx, 'Din Kültürü (200) should come before İngilizce (150)');

    // 6th branch excluded
    assert.doesNotMatch(html, /İnkılap/);
});

test('02C1-12: Topic Ordering & errorCount Prohibition', () => {
    const topics = [
        { subject: 'Matematik', topic: 'Üslü İfadeler', actual: 80 },
        { subject: 'Fen Bilimleri', topic: 'Mevsimler', actual: 120 },
        { subject: 'Matematik', topic: 'Çarpanlar ve Katlar', actual: 120 }, // tiebreak: Fen < Matematik
        { subject: 'Türkçe', topic: 'Fiilimsiler', actual: 60 },
        { subject: 'Din', topic: 'Kader İnancı', actual: 40 },
        { subject: 'İngilizce', topic: 'Friendship', actual: 20 } // 6th topic
    ];

    const html = renderTopicSummaryHtml(topics);

    const mevsimIdx = html.indexOf('Mevsimler');
    const carpanIdx = html.indexOf('Çarpanlar ve Katlar');
    assert.ok(mevsimIdx < carpanIdx, 'Mevsimler (Fen) comes before Çarpanlar (Mat) on tiebreak');
    assert.doesNotMatch(html, /Friendship/);

    // Absolute prohibition on errorCount and hataSayisi
    assert.doesNotMatch(html, /errorCount/i);
    assert.doesNotMatch(html, /hataSayisi/i);
});

test('02C1-13: Exam Context (trend label only when valid, no self-inference on insufficient_data)', () => {
    // Case 1: canonical trendStatus is improving
    const improvingContext = {
        examCount: 3,
        latestNet: 75.5,
        netDelta: 2.5,
        trendStatus: 'improving'
    };
    const html1 = renderContextCardsHtml(improvingContext, {}, {});
    assert.match(html1, /Yükseliyor/);
    assert.match(html1, /\+2\.50 Net Değişim/);

    // Case 2: canonical trendStatus is insufficient_data -> MUST NOT render trend direction badge
    const insufficientContext = {
        examCount: 2,
        latestNet: 70.0,
        netDelta: 10.0, // High net delta, but trendStatus is insufficient_data
        trendStatus: 'insufficient_data'
    };
    const html2 = renderContextCardsHtml(insufficientContext, {}, {});
    assert.doesNotMatch(html2, /Yükseliyor/);
    assert.doesNotMatch(html2, /Düşüyor/);
    assert.doesNotMatch(html2, /Dengeli/);
});

test('02C1-14: Homework Zero Safety (explicit no-record state, no fake 0%, no NaN)', () => {
    const emptyHw = {
        total: 0,
        completed: 0,
        overdue: 0,
        completionRate: null
    };

    const html = renderContextCardsHtml({}, emptyHw, {});

    assert.match(html, /Bu ay tanımlı ödev bulunmuyor/);
    assert.doesNotMatch(html, /NaN%/);
    assert.doesNotMatch(html, /null%/);
    assert.doesNotMatch(html, /undefined%/);
    assert.doesNotMatch(html, /%0\b/);
    assert.doesNotMatch(html, /0\s*\/\s*0/);
});

test('02C1-15: Guidance Context Privacy (structured counts only, zero raw note text)', () => {
    const guidanceContext = {
        interventionCount: 3,
        followUpCount: 2,
        resolvedCount: 2,
        privateNotes: 'Ailenin özel durumu görüşüldü',
        rawRecord: { note: 'Öğrencinin sağlık problemi' }
    };

    const html = renderContextCardsHtml({}, {}, guidanceContext);

    assert.match(html, /3 Görüşme/);
    assert.match(html, /2 Aktif Takip/);
    assert.match(html, /2 Çözümlendi/);

    // Privacy verification
    assert.doesNotMatch(html, /Ailenin özel durumu/);
    assert.doesNotMatch(html, /sağlık problemi/);
});

test('02C1-16: Empty State (cf-empty-state, strictly read-only, no forms or write triggers)', () => {
    const period = {
        year: 2026,
        month: 10,
        monthLabel: 'Ekim 2026',
        weekCount: 0
    };

    const html = renderCoachingEmptyStateHtml(period);

    assert.match(html, /cf-empty-state/);
    assert.match(html, /Bu Ay İçin Koçluk Planı Bulunmuyor/);
    assert.match(html, /Ekim 2026/);

    // Strict: No write actions, no buttons, no forms
    assert.doesNotMatch(html, /<button/i);
    assert.doesNotMatch(html, /<form/i);
    assert.doesNotMatch(html, /Plan Oluştur/i);
    assert.doesNotMatch(html, /onclick/i);
});

test('02C1-17: Partial Data Safety (Questions only -> no fake 0/0 or NaN in missing domains)', () => {
    const partialMetrics = {
        questionActual: 450,
        questionTarget: 500,
        questionPercent: 90,
        taskCompleted: 0,
        taskTotal: 0,
        taskPercent: null,
        examActual: 0,
        examTarget: null,
        examPercent: null
    };

    const html = renderCoachingKpiCardsHtml(partialMetrics);

    assert.match(html, />450<\/span>/);
    assert.match(html, /%90/);
    assert.match(html, /Görev Yok/);
    assert.match(html, /Deneme Yok/);

    assert.doesNotMatch(html, /NaN%/);
    assert.doesNotMatch(html, /null%/);
    assert.doesNotMatch(html, /Infinity%/);
    assert.doesNotMatch(html, /0\s*\/\s*0/);
});

test('02C1-18: Hostile HTML Escaping (XSS payloads safely sanitized)', () => {
    const hostileXss = '<script>alert(1)</script><img src=x onerror=alert(1)>"\'>';

    const summary = {
        period: { year: 2026, month: 8, monthLabel: hostileXss, weekCount: 1 },
        planMetrics: { questionActual: 100, taskCompleted: 5 },
        branchSummary: [{ subject: hostileXss, actual: 50 }],
        topicSummary: [{ subject: hostileXss, topic: hostileXss, actual: 50 }],
        strengths: [hostileXss],
        attentionAreas: [hostileXss],
        recentFocuses: [hostileXss]
    };

    const html = renderCoachingMonthlyDashboardHtml(summary);

    // Executable tags must not appear
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
    assert.doesNotMatch(html, /<img src=x onerror=alert\(1\)>/);

    // Escaped versions must be present
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('02C1-19: Mutation Safety (deep-frozen inputs are completely unmodified)', () => {
    const frozenStudent = deepFreeze({
        studyPlanHistory: [{ weekStart: '2026-08-03' }],
        coachingPlan: { status: 'active', weekStart: '2026-08-10' }
    });

    const frozenSummary = deepFreeze({
        period: { year: 2026, month: 8, monthLabel: 'Ağustos 2026', weekCount: 1 },
        planMetrics: { questionActual: 100, taskCompleted: 5 },
        weeklyTrend: [{ weekStart: '2026-08-03', questionActual: 100, isPreview: false }],
        branchSummary: [{ subject: 'Matematik', actual: 100 }],
        topicSummary: [{ subject: 'Matematik', topic: 'Çarpanlar', actual: 100 }],
        examContext: { examCount: 1, latestNet: 80 },
        homeworkContext: { total: 2, completed: 2 },
        guidanceContext: { interventionCount: 1 },
        strengths: ['Başarılı çalışma'],
        attentionAreas: ['Zaman yönetimi'],
        recentFocuses: ['Odaklanma']
    });

    const frozenOptions = deepFreeze({ now: new Date('2026-08-15') });

    // Calling every helper must succeed without throwing TypeError: Cannot assign to read only property
    assert.doesNotThrow(() => getAvailableCoachingMonths(frozenStudent));
    assert.doesNotThrow(() => getDefaultCoachingMonth(frozenStudent, frozenOptions.now));
    assert.doesNotThrow(() => renderMonthSelectorHtml(frozenSummary.period, frozenOptions));
    assert.doesNotThrow(() => renderCoachingKpiCardsHtml(frozenSummary.planMetrics, frozenSummary.period));
    assert.doesNotThrow(() => renderWeeklyTrendHtml(frozenSummary.weeklyTrend));
    assert.doesNotThrow(() => renderBranchSummaryHtml(frozenSummary.branchSummary));
    assert.doesNotThrow(() => renderTopicSummaryHtml(frozenSummary.topicSummary));
    assert.doesNotThrow(() => renderContextCardsHtml(frozenSummary.examContext, frozenSummary.homeworkContext, frozenSummary.guidanceContext));
    assert.doesNotThrow(() => renderStrengthsAndAttentionHtml(frozenSummary.strengths, frozenSummary.attentionAreas));
    assert.doesNotThrow(() => renderRecentFocusesHtml(frozenSummary.recentFocuses));
    assert.doesNotThrow(() => renderCoachingMonthlyDashboardHtml(frozenSummary, frozenStudent, frozenOptions));
});

test('02C1-20: Deterministic Output (10 repeated executions yield identical HTML)', () => {
    const summary = {
        period: { year: 2026, month: 8, monthLabel: 'Ağustos 2026', weekCount: 2, finalizedWeekCount: 2 },
        planMetrics: { questionActual: 600, questionTarget: 800, questionPercent: 75, taskCompleted: 15, taskTotal: 20, taskPercent: 75 },
        weeklyTrend: [
            { weekStart: '2026-08-03', weekEnd: '2026-08-09', questionActual: 300, questionTarget: 400, questionPercent: 75, taskCompleted: 8, taskTotal: 10, taskPercent: 80, isPreview: false }
        ],
        branchSummary: [{ subject: 'Fen Bilimleri', actual: 300, target: 400, percent: 75 }],
        topicSummary: [{ subject: 'Fen Bilimleri', topic: 'Mevsimler', actual: 150 }],
        strengths: ['Soru hedefi dengeli'],
        attentionAreas: ['Geometri eksik'],
        recentFocuses: ['Hedef tekrarı']
    };

    const options = { now: new Date('2026-08-20') };
    const referenceHtml = renderCoachingMonthlyDashboardHtml(summary, {}, options);

    for (let i = 0; i < 10; i++) {
        const currentHtml = renderCoachingMonthlyDashboardHtml(summary, {}, options);
        assert.equal(currentHtml, referenceHtml);
    }
});

test('02C1-21 & 22 & 23: Mobile, Dark Mode, and Accessibility Contracts', () => {
    const summary = {
        period: { year: 2026, month: 8, monthLabel: 'Ağustos 2026', weekCount: 1, finalizedWeekCount: 1 },
        planMetrics: { questionActual: 100, questionTarget: 100, questionPercent: 100, taskCompleted: 5, taskTotal: 5, taskPercent: 100 },
        weeklyTrend: [{ weekStart: '2026-08-03', weekEnd: '2026-08-09', questionActual: 100, questionTarget: 100, questionPercent: 100, taskCompleted: 5, taskTotal: 5, taskPercent: 100, isPreview: false }]
    };

    const html = renderCoachingMonthlyDashboardHtml(summary);

    // Mobile: Touch targets >= 44px
    assert.match(html, /min-h-\[44px\]/);
    assert.match(html, /min-w-\[44px\]/);

    // Responsive: grid-cols-1 used for mobile layout without wide tables
    assert.match(html, /grid-cols-1/);
    assert.doesNotMatch(html, /<table/i);

    // Dark mode classes present across cards
    assert.match(html, /dark:bg-gray-800/);
    assert.match(html, /dark:text-white/);
    assert.match(html, /dark:border-gray-700/);

    // Accessibility: aria-label present
    assert.match(html, /aria-label="Önceki Ay"/);
    assert.match(html, /aria-label="Sonraki Ay"/);
});

test('02C1-24: Pure Module Static Source Audit', () => {
    const modulePath = path.resolve('guidance-coaching-dashboard.js');
    const source = fs.readFileSync(modulePath, 'utf8');

    // Remove comments to verify zero functional references
    const stripped = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

    const forbidden = [
        'document',
        'window',
        'localStorage',
        'sessionStorage',
        'fetch(',
        'XMLHttpRequest',
        'firebase',
        'setDoc',
        'updateDoc',
        'addDoc'
    ];

    for (const term of forbidden) {
        assert.ok(!stripped.includes(term), `Forbidden functional term found in guidance-coaching-dashboard.js: "${term}"`);
    }
});

test('02C1-25: Performance Benchmark (< 10ms per render)', () => {
    const richSummary = {
        period: { year: 2026, month: 8, monthLabel: 'Ağustos 2026', weekCount: 5, finalizedWeekCount: 4, previewWeekIncluded: true },
        planMetrics: { questionActual: 2000, questionTarget: 2000, questionPercent: 100, taskCompleted: 50, taskTotal: 50, taskPercent: 100, examActual: 10, examTarget: 10, examPercent: 100 },
        weeklyTrend: Array.from({ length: 5 }, (_, i) => ({
            weekStart: `2026-08-0${i + 1}`,
            weekEnd: `2026-08-0${i + 7}`,
            questionActual: 400,
            questionTarget: 400,
            questionPercent: 100,
            taskCompleted: 10,
            taskTotal: 10,
            taskPercent: 100,
            isPreview: i === 4
        })),
        branchSummary: [
            { subject: 'Matematik', actual: 600, target: 600, percent: 100 },
            { subject: 'Fen Bilimleri', actual: 500, target: 500, percent: 100 },
            { subject: 'Türkçe', actual: 400, target: 400, percent: 100 },
            { subject: 'İnkılap', actual: 300, target: 300, percent: 100 },
            { subject: 'İngilizce', actual: 200, target: 200, percent: 100 }
        ],
        topicSummary: [
            { subject: 'Fen', topic: 'Mevsimler', actual: 150 },
            { subject: 'Fen', topic: 'DNA', actual: 140 },
            { subject: 'Mat', topic: 'Çarpanlar', actual: 130 },
            { subject: 'Mat', topic: 'Üslü', actual: 120 },
            { subject: 'Türkçe', topic: 'Fiilimsi', actual: 110 }
        ],
        examContext: { examCount: 4, latestNet: 82.5, netDelta: 3.5, trendStatus: 'improving' },
        homeworkContext: { total: 10, completed: 9, overdue: 1, completionRate: 90 },
        guidanceContext: { interventionCount: 4, followUpCount: 2, resolvedCount: 2 },
        strengths: ['Hedef aşıldı', 'Net artışı istikrarlı'],
        attentionAreas: ['Geometride dikkat', 'Ödev teslim süresi'],
        recentFocuses: ['Odak 1', 'Odak 2', 'Odak 3', 'Odak 4']
    };

    const iterations = 100;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        renderCoachingMonthlyDashboardHtml(richSummary, {}, { now: new Date('2026-08-25') });
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    assert.ok(avgMs < 10, `Render took too long: ${avgMs.toFixed(3)}ms per render (must be < 10ms)`);
});

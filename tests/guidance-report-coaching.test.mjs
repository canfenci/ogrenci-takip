import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildParentSafeCoachingSummary,
    buildGuidanceReportData
} from '../guidance-report-insights.js';

import { generateGuidancePdf } from '../guidance-report-pdf.js';

// Mock jsPDF class for testing PDF text outputs without canvas/DOM
class MockJsPDF {
    constructor(options) {
        this.options = options;
        this.pages = [1];
        this.renderedTexts = [];
    }
    addFileToVFS() {}
    addFont() {}
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setFillColor() {}
    setDrawColor() {}
    rect() {}
    roundedRect() {}
    line() {}
    text(txt) {
        if (Array.isArray(txt)) {
            this.renderedTexts.push(...txt);
        } else {
            this.renderedTexts.push(txt);
        }
    }
    splitTextToSize(txt) {
        return [txt];
    }
    addPage() {
        this.pages.push(this.pages.length + 1);
    }
    getNumberOfPages() {
        return this.pages.length;
    }
    setPage() {}
}

test('02B3C-1: buildParentSafeCoachingSummary returns safe empty contract on null/empty input', () => {
    const empty1 = buildParentSafeCoachingSummary(null);
    assert.equal(empty1.hasData, false);
    assert.equal(empty1.weekCount, 0);
    assert.equal(empty1.monthLabel, '');
    assert.deepEqual(empty1.metrics.questions, { actual: 0, target: null, percent: null });
    assert.deepEqual(empty1.metrics.tasks, { completed: 0, total: 0, percent: null });
    assert.deepEqual(empty1.metrics.plannedExams, { completed: 0, planned: null, percent: null });
    assert.deepEqual(empty1.branchRows, []);
    assert.deepEqual(empty1.topicRows, []);
    assert.deepEqual(empty1.strengths, []);
    assert.deepEqual(empty1.attentionAreas, []);

    const empty2 = buildParentSafeCoachingSummary({});
    assert.equal(empty2.hasData, false);
});

test('02B3C-2: buildParentSafeCoachingSummary strictly excludes internal notes and priority scores', () => {
    const rawSummary = {
        period: {
            year: 2026,
            month: 8,
            monthLabel: 'Ağustos 2026',
            weekCount: 3
        },
        planMetrics: {
            questionActual: 450,
            questionTarget: 500,
            questionPercent: 90,
            taskCompleted: 14,
            taskTotal: 16,
            taskPercent: 87.5,
            examCompleted: 3,
            examTarget: 4,
            examPercent: 75
        },
        branchSummary: [
            { subject: 'Fen Bilimleri', target: 200, actual: 180, percent: 90 },
            { subject: 'Matematik', target: 150, actual: 120, percent: 80 }
        ],
        topicSummary: [
            { subject: 'Fen Bilimleri', topic: 'Mevsimler ve İklim', actual: 80, errorCount: 12 }
        ],
        examContext: { examCount: 2, averageNet: 16.5, netDelta: 1.5 },
        homeworkContext: { total: 5, completed: 5, completionRate: 100 },
        strengths: ['Haftalık soru hedefine düzenli ulaşıldı.'],
        attentionAreas: ['Matematik branş hedefi geride kaldı.'],
        // Internal / unapproved fields that MUST be stripped:
        priorityScore: 78,
        priority: 'high',
        confidence: 'high',
        dataCoverage: { archivedWeeks: 3 },
        signals: [{ code: 'LOW_PLAN_COMPLETION', points: 20 }],
        weeklyCheckIn: { teacherNote: 'Gizli öğretmen notu - veli görmemeli' },
        recentFocuses: [{ note: 'Özel odak notu' }],
        privateNote: 'İç rehberlik notu',
        internalId: 'secret_guid_123'
    };

    const sanitized = buildParentSafeCoachingSummary(rawSummary);

    assert.equal(sanitized.hasData, true);
    assert.equal(sanitized.monthLabel, 'Ağustos 2026');
    assert.equal(sanitized.weekCount, 3);
    assert.equal(sanitized.metrics.questions.actual, 450);
    assert.equal(sanitized.metrics.questions.target, 500);
    assert.equal(sanitized.metrics.questions.percent, 90);

    // Verify forbidden fields are absent
    assert.equal(sanitized.priorityScore, undefined);
    assert.equal(sanitized.priority, undefined);
    assert.equal(sanitized.confidence, undefined);
    assert.equal(sanitized.dataCoverage, undefined);
    assert.equal(sanitized.signals, undefined);
    assert.equal(sanitized.weeklyCheckIn, undefined);
    assert.equal(sanitized.recentFocuses, undefined);
    assert.equal(sanitized.privateNote, undefined);
    assert.equal(sanitized.internalId, undefined);

    // Verify topicRows has NO errorCount
    assert.equal(sanitized.topicRows[0].errorCount, undefined);
    assert.equal(sanitized.topicRows[0].topic, 'Mevsimler ve İklim');
    assert.equal(sanitized.topicRows[0].completedCount, 80);

    // Verify input object was NOT mutated
    assert.equal(rawSummary.priorityScore, 78);
    assert.equal(rawSummary.weeklyCheckIn.teacherNote, 'Gizli öğretmen notu - veli görmemeli');
});

test('02B3C-3: buildParentSafeCoachingSummary handles division by zero, overachievement and bounds', () => {
    const raw = {
        period: { weekCount: 2, monthLabel: 'Eylül 2026' },
        planMetrics: {
            questionActual: 250,
            questionTarget: 200, // 125% overachievement
            taskCompleted: 5,
            taskTotal: 0, // division by 0
            examCompleted: 0,
            examTarget: null
        },
        branchSummary: [
            { subject: 'Fen Bilimleri', target: 100, actual: 125, percent: 125 },
            { subject: 'Türkçe', target: 0, actual: 40 },
            { subject: 'Matematik', target: 100, actual: 90 },
            { subject: 'İnkılap', target: 50, actual: 45 },
            { subject: 'İngilizce', target: 50, actual: 50 },
            { subject: 'Din Kültürü', target: 50, actual: 40 } // 6th branch, must be capped at 5
        ],
        topicSummary: [
            { subject: 'Fen', topic: 'DNA', actual: 60 },
            { subject: 'Fen', topic: 'Mevsimler', actual: 50 },
            { subject: 'Fen', topic: 'Kalıtım', actual: 40 },
            { subject: 'Fen', topic: 'Basınç', actual: 30 } // 4th topic, must be capped at 3
        ],
        strengths: ['Güçlü 1', 'Güçlü 2', 'Güçlü 3'], // capped at 2
        attentionAreas: ['Gelişim 1', 'Gelişim 2', 'Gelişim 3'] // capped at 2
    };

    const s = buildParentSafeCoachingSummary(raw);

    assert.equal(s.metrics.questions.percent, 125);
    assert.equal(s.metrics.tasks.percent, null); // 5 / 0 -> null, not Infinity
    assert.equal(s.metrics.plannedExams.percent, null); // target null -> null

    assert.equal(s.branchRows.length, 5, 'Top 5 branches maximum');
    assert.equal(s.topicRows.length, 3, 'Top 3 topics maximum');
    assert.equal(s.strengths.length, 2, 'Max 2 strengths');
    assert.equal(s.attentionAreas.length, 2, 'Max 2 attention areas');
});

test('02B3C-4: buildGuidanceReportData integrates coachingSummary and defaults section to true', () => {
    const student = {
        id: 's_coach_1',
        adSoyad: 'Defne Kaya',
        sinif: '8',
        coachingPlan: {
            status: 'active',
            weekStart: '2026-08-24'
        },
        studyPlanHistory: [
            {
                weekStart: '2026-08-10',
                status: 'archived',
                progressSummary: {
                    questions: { target: 400, actual: 380 },
                    tasks: { total: 10, completed: 9 },
                    plannedExams: { target: 2, completed: 2 },
                    branches: [
                        { subject: 'Fen Bilimleri', target: 200, actual: 190 }
                    ],
                    topics: [
                        { subject: 'Fen Bilimleri', topic: 'Mevsimler', actual: 80 }
                    ]
                }
            }
        ],
        denemeler: [],
        odevler: []
    };

    const report = buildGuidanceReportData(student, {
        now: '2026-08-28T12:00:00Z',
        period: '4weeks'
    });

    assert.ok(report.coachingSummary, 'coachingSummary must exist in reportData');
    assert.equal(report.coachingSummary.hasData, true);
    assert.equal(report.coachingSummary.weekCount, 1);
    assert.equal(report.coachingSummary.metrics.questions.actual, 380);
    assert.equal(report.coachingSummary.metrics.questions.target, 400);
    assert.equal(report.sections.coachingSummary, true, 'Default section toggle is true');
});

test('02B3C-5: buildGuidanceReportData uses archived-only weeks by default (includeActiveWeek=false)', () => {
    const student = {
        id: 's_coach_2',
        adSoyad: 'Can Yılmaz',
        coachingPlan: {
            status: 'active',
            weekStart: '2026-08-24',
            tasks: [
                { taskType: 'question', completedCount: 999 } // active week should NOT be counted in parent report
            ]
        },
        studyPlanHistory: [
            {
                weekStart: '2026-08-10',
                status: 'archived',
                progressSummary: {
                    questions: { target: 300, actual: 250 },
                    tasks: { total: 8, completed: 7 }
                }
            }
        ]
    };

    const report = buildGuidanceReportData(student, {
        now: '2026-08-28T12:00:00Z',
        period: '4weeks'
    });

    // Only archived 250 questions, not 999
    assert.equal(report.coachingSummary.metrics.questions.actual, 250);
});

test('02B3C-6: PDF generation renders KOÇLUK VE ÇALIŞMA PLANI GELİŞİMİ when enabled and hasData', () => {
    const student = {
        id: 's_coach_pdf',
        adSoyad: 'Elif Şahin',
        sinif: '8',
        studyPlanHistory: [
            {
                weekStart: '2026-08-10',
                status: 'archived',
                progressSummary: {
                    questions: { target: 500, actual: 450 },
                    tasks: { total: 15, completed: 14 },
                    plannedExams: { target: 2, completed: 2 },
                    branches: [
                        { subject: 'Fen Bilimleri', target: 200, actual: 190 }
                    ],
                    topics: [
                        { subject: 'Fen Bilimleri', topic: 'Mevsimler ve İklim', actual: 95 }
                    ]
                }
            }
        ]
    };

    const reportData = buildGuidanceReportData(student, { now: '2026-08-28T12:00:00Z' });
    const mock = new MockJsPDF({ format: 'a4', orientation: 'portrait' });
    generateGuidancePdf(reportData, function() { return mock; });

    const allOutput = mock.renderedTexts.join(' ');
    assert.match(allOutput, /KOÇLUK VE ÇALIŞMA PLANI GELİŞİMİ/);
    assert.match(allOutput, /PLANLANAN SORU HEDEFİ/);
    assert.match(allOutput, /GÖREV TAMAMLAMA/);
    assert.match(allOutput, /PLANLANAN DENEME/);
    assert.match(allOutput, /Fen Bilimleri/);
    assert.match(allOutput, /Mevsimler ve İklim/);
});

test('02B3C-7: PDF generation omits coaching section when sections.coachingSummary is false', () => {
    const student = {
        id: 's_coach_omit',
        adSoyad: 'Elif Şahin',
        studyPlanHistory: [
            {
                weekStart: '2026-08-10',
                status: 'archived',
                progressSummary: {
                    questions: { target: 500, actual: 450 }
                }
            }
        ]
    };

    const reportData = buildGuidanceReportData(student, {
        now: '2026-08-28T12:00:00Z',
        sections: {
            coachingSummary: false
        }
    });

    const mock = new MockJsPDF({ format: 'a4', orientation: 'portrait' });
    generateGuidancePdf(reportData, function() { return mock; });

    const allOutput = mock.renderedTexts.join(' ');
    assert.doesNotMatch(allOutput, /KOÇLUK VE ÇALIŞMA PLANI GELİŞİMİ/);
});

test('02B3C-8: PDF generation omits coaching section when student has no study history (hasData=false)', () => {
    const student = {
        id: 's_no_history',
        adSoyad: 'Boş Kayıt',
        studyPlanHistory: []
    };

    const reportData = buildGuidanceReportData(student, { now: '2026-08-28T12:00:00Z' });
    assert.equal(reportData.coachingSummary.hasData, false);

    const mock = new MockJsPDF({ format: 'a4', orientation: 'portrait' });
    generateGuidancePdf(reportData, function() { return mock; });

    const allOutput = mock.renderedTexts.join(' ');
    assert.doesNotMatch(allOutput, /KOÇLUK VE ÇALIŞMA PLANI GELİŞİMİ/);
});

test('02B3C-9: PDF generation renders Strengths and Attention Areas with proper headings', () => {
    const student = {
        id: 's_coach_insights',
        adSoyad: 'Murat Arslan',
        studyPlanHistory: [
            {
                weekStart: '2026-08-03',
                status: 'archived',
                progressSummary: {
                    questions: { target: 500, actual: 480 },
                    tasks: { total: 10, completed: 9 },
                    branches: [{ subject: 'Fen Bilimleri', target: 200, actual: 195 }]
                }
            }
        ]
    };

    const reportData = buildGuidanceReportData(student, { now: '2026-08-28T12:00:00Z' });
    // Inject deterministic strengths and attention areas for PDF rendering verification
    reportData.coachingSummary.strengths = ['Aylık soru hedefi başarıyla tamamlandı.'];
    reportData.coachingSummary.attentionAreas = ['Matematik branşında soru artırımı önerilir.'];

    const mock = new MockJsPDF({ format: 'a4', orientation: 'portrait' });
    generateGuidancePdf(reportData, function() { return mock; });

    const allOutput = mock.renderedTexts.join(' ');
    assert.match(allOutput, /GÜÇLÜ YÖNLER/);
    assert.match(allOutput, /Aylık soru hedefi başarıyla tamamlandı\./);
    assert.match(allOutput, /TAKİP EDİLECEK GELİŞİM ALANLARI/);
    assert.match(allOutput, /Matematik branşında soru artırımı önerilir\./);
});

test('02B3C-10: Modal UI markup contains sec_coachingSummary with proper label and default checked', async () => {
    const fs = await import('node:fs/promises');
    const guidanceCode = await fs.readFile(new URL('../guidance.js', import.meta.url), 'utf8');

    assert.match(guidanceCode, /id="sec_coachingSummary"/);
    assert.match(guidanceCode, /id="sec_coachingSummary"\s+checked/);
    assert.match(guidanceCode, /Koçluk ve Çalışma Planı Gelişimi/);
    assert.match(guidanceCode, /coachingSummary:\s*document\.getElementById\('sec_coachingSummary'\)\?\.checked\s*\?\?\s*true/);
});

test('02B3C-11: Turkish character glyphs in coaching PDF render cleanly', () => {
    const student = {
        id: 's_tr',
        adSoyad: 'Çağrı Öztürk',
        sinif: '8',
        studyPlanHistory: [
            {
                weekStart: '2026-08-10',
                status: 'archived',
                progressSummary: {
                    questions: { target: 300, actual: 290 },
                    tasks: { total: 5, completed: 5 },
                    branches: [
                        { subject: 'İnkılap Tarihi ve Atatürkçülük', target: 50, actual: 50 }
                    ],
                    topics: [
                        { subject: 'İnkılap Tarihi', topic: 'Milli Uyanış: Bağımsızlık Yolunda Atılan Adımlar', actual: 40 }
                    ]
                }
            }
        ]
    };

    const reportData = buildGuidanceReportData(student, { now: '2026-08-28T12:00:00Z' });
    const mock = new MockJsPDF({ format: 'a4', orientation: 'portrait' });
    generateGuidancePdf(reportData, function() { return mock; });

    const allOutput = mock.renderedTexts.join(' ');
    assert.match(allOutput, /İnkılap Tarihi ve Atatürkçülük/);
    assert.match(allOutput, /Milli Uyanış/);
});

test('02B3C-12: Overachievement and missing denominators never output NaN% or Infinity%', () => {
    const student = {
        id: 's_nan_guard',
        adSoyad: 'Ali Veli',
        studyPlanHistory: [
            {
                weekStart: '2026-08-10',
                status: 'archived',
                progressSummary: {
                    questions: { target: 0, actual: 150 }, // target 0
                    tasks: { total: 0, completed: 0 },
                    plannedExams: { target: null, completed: 0 },
                    branches: [
                        { subject: 'Matematik', target: null, actual: 80 }
                    ]
                }
            }
        ]
    };

    const reportData = buildGuidanceReportData(student, { now: '2026-08-28T12:00:00Z' });
    const mock = new MockJsPDF({ format: 'a4', orientation: 'portrait' });
    generateGuidancePdf(reportData, function() { return mock; });

    const allOutput = mock.renderedTexts.join(' ');
    assert.doesNotMatch(allOutput, /NaN%/);
    assert.doesNotMatch(allOutput, /Infinity%/);
    assert.doesNotMatch(allOutput, /null%/);
    assert.doesNotMatch(allOutput, /undefined%/);
});

test('02B3C-13: PDF does not contain internal diagnostic words or forbidden tokens', () => {
    const student = {
        id: 's_forbidden_check',
        adSoyad: 'Zeynep Ak',
        studyPlanHistory: [
            {
                weekStart: '2026-08-10',
                status: 'archived',
                progressSummary: {
                    questions: { target: 200, actual: 180 },
                    tasks: { total: 4, completed: 4 }
                }
            }
        ]
    };

    const reportData = buildGuidanceReportData(student, { now: '2026-08-28T12:00:00Z' });
    const mock = new MockJsPDF({ format: 'a4', orientation: 'portrait' });
    generateGuidancePdf(reportData, function() { return mock; });

    const allOutput = mock.renderedTexts.join(' ');
    assert.doesNotMatch(allOutput, /priorityScore/);
    assert.doesNotMatch(allOutput, /confidence/);
    assert.doesNotMatch(allOutput, /dataCoverage/);
    assert.doesNotMatch(allOutput, /Teşhis/);
    assert.doesNotMatch(allOutput, /Tanı/);
});

test('02B3C-14: Branch and topic partial and full empty states behavior', () => {
    // Case A: Both empty -> sub-block omitted for compact height
    const studentBothEmpty = {
        id: 's_both_empty',
        adSoyad: 'Ayşe Kaya',
        studyPlanHistory: [
            {
                weekStart: '2026-08-10',
                status: 'archived',
                progressSummary: {
                    questions: { target: 100, actual: 50 },
                    tasks: { total: 2, completed: 1 },
                    branches: [],
                    topics: []
                }
            }
        ]
    };
    const repBoth = buildGuidanceReportData(studentBothEmpty, { now: '2026-08-28T12:00:00Z' });
    const mockBoth = new MockJsPDF({ format: 'a4', orientation: 'portrait' });
    generateGuidancePdf(repBoth, function() { return mockBoth; });
    const outBoth = mockBoth.renderedTexts.join(' ');
    assert.doesNotMatch(outBoth, /BRANŞ GELİŞİMİ/);
    assert.doesNotMatch(outBoth, /ODAKLANILAN KONULAR/);

    // Case B: Branches present, topics empty -> right column shows fallback
    const studentBranchOnly = {
        id: 's_branch_only',
        adSoyad: 'Mehmet Can',
        studyPlanHistory: [
            {
                weekStart: '2026-08-10',
                status: 'archived',
                progressSummary: {
                    questions: { target: 100, actual: 50 },
                    tasks: { total: 2, completed: 1 },
                    branches: [{ subject: 'Fen Bilimleri', target: 50, actual: 50 }],
                    topics: []
                }
            }
        ]
    };
    const repBranch = buildGuidanceReportData(studentBranchOnly, { now: '2026-08-28T12:00:00Z' });
    const mockBranch = new MockJsPDF({ format: 'a4', orientation: 'portrait' });
    generateGuidancePdf(repBranch, function() { return mockBranch; });
    const outBranch = mockBranch.renderedTexts.join(' ');
    assert.match(outBranch, /BRANŞ GELİŞİMİ/);
    assert.match(outBranch, /Konu hedef kaydı bulunmuyor\./);
});


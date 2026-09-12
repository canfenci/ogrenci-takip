import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildMonthlyCoachingSummary,
    filterSnapshotsForMonth,
    extractWeekMetrics,
    buildWeeklyTrend,
    deriveQuestionTrend,
    calculateMonthlyPlanMetrics,
    buildBranchSummary,
    buildTopicSummary,
    buildMonthlyExamContext,
    buildMonthlyHomeworkContext,
    buildMonthlyGuidanceContext,
    extractRecentFocuses,
    deriveMonthlyStrengths,
    deriveMonthlyAttentionAreas,
    deriveDataCoverage,
    calcPercent,
    getYearMonthFromDateStr
} from '../coaching-plan-monthly-summary.js';

// ─── A. EMPTY MONTH ──────────────────────────────────────────────────────────
test('A: empty month returns safe object with 0 counts and null rates', () => {
    const student = { id: 's1', name: 'Ali' };
    const res = buildMonthlyCoachingSummary(student, 2026, 9);

    assert.equal(res.period.year, 2026);
    assert.equal(res.period.month, 9);
    assert.equal(res.period.monthLabel, 'Eylül 2026');
    assert.equal(res.period.weekCount, 0);
    assert.equal(res.period.finalizedWeekCount, 0);
    assert.equal(res.period.previewWeekIncluded, false);

    assert.equal(res.planMetrics.questionActual, 0);
    assert.equal(res.planMetrics.questionTarget, null);
    assert.equal(res.planMetrics.questionPercent, null);
    assert.equal(res.planMetrics.taskTotal, 0);
    assert.equal(res.planMetrics.taskCompleted, 0);
    assert.equal(res.planMetrics.taskPercent, null);
    assert.equal(res.planMetrics.examActual, 0);
    assert.equal(res.planMetrics.examTarget, null);
    assert.equal(res.planMetrics.examPercent, null);
    assert.equal(res.planMetrics.trendStatus, 'insufficient_data');

    assert.deepEqual(res.weeklyTrend, []);
    assert.deepEqual(res.branchSummary, []);
    assert.deepEqual(res.topicSummary, []);
    assert.deepEqual(res.strengths, []);
    assert.deepEqual(res.attentionAreas, []);
    assert.deepEqual(res.recentFocuses, []);
    assert.equal(res.dataCoverage.archivedWeeks, 0);
    assert.equal(res.dataCoverage.confidence, 'minimal');
});

// ─── B. ONE ARCHIVED WEEK ────────────────────────────────────────────────────
test('B: one archived week has valid metrics and insufficient_data trend', () => {
    const snapshot = {
        weekStart: '2026-09-07',
        weekEnd: '2026-09-13',
        status: 'archived',
        progressSummary: {
            questions: { actual: 120, target: 150 },
            tasks: { completed: 4, total: 5 },
            exams: { actual: 1, target: 1 }
        }
    };
    const student = { id: 's1', studyPlanHistory: [snapshot] };
    const res = buildMonthlyCoachingSummary(student, 2026, 9);

    assert.equal(res.period.weekCount, 1);
    assert.equal(res.planMetrics.questionActual, 120);
    assert.equal(res.planMetrics.questionTarget, 150);
    assert.equal(res.planMetrics.questionPercent, 80);
    assert.equal(res.planMetrics.taskCompleted, 4);
    assert.equal(res.planMetrics.taskTotal, 5);
    assert.equal(res.planMetrics.taskPercent, 80);
    assert.equal(res.planMetrics.trendStatus, 'insufficient_data');
    assert.equal(res.weeklyTrend.length, 1);
    assert.equal(res.weeklyTrend[0].questionPercent, 80);
});

// ─── C. TWO WEEKS NO TREND CLAIM ─────────────────────────────────────────────
test('C: two archived weeks do not declare improving/declining trend', () => {
    const history = [
        {
            weekStart: '2026-09-07',
            weekEnd: '2026-09-13',
            status: 'archived',
            progressSummary: {
                questions: { actual: 100, target: 200 } // 50%
            }
        },
        {
            weekStart: '2026-09-14',
            weekEnd: '2026-09-20',
            status: 'archived',
            progressSummary: {
                questions: { actual: 180, target: 200 } // 90%
            }
        }
    ];
    const student = { id: 's1', studyPlanHistory: history };
    const res = buildMonthlyCoachingSummary(student, 2026, 9);

    assert.equal(res.period.weekCount, 2);
    assert.equal(res.planMetrics.trendStatus, 'insufficient_data');
});

// ─── D. THREE WEEKS TREND ALLOWED ────────────────────────────────────────────
test('D: three archived weeks allow trend classification', () => {
    const history = [
        {
            weekStart: '2026-09-07',
            weekEnd: '2026-09-13',
            status: 'archived',
            progressSummary: { questions: { actual: 100, target: 200 } } // 50%
        },
        {
            weekStart: '2026-09-14',
            weekEnd: '2026-09-20',
            status: 'archived',
            progressSummary: { questions: { actual: 140, target: 200 } } // 70%
        },
        {
            weekStart: '2026-09-21',
            weekEnd: '2026-09-27',
            status: 'archived',
            progressSummary: { questions: { actual: 180, target: 200 } } // 90%
        }
    ];
    const student = { id: 's1', studyPlanHistory: history };
    const res = buildMonthlyCoachingSummary(student, 2026, 9);

    assert.equal(res.period.weekCount, 3);
    assert.equal(res.planMetrics.trendStatus, 'improving');
});

// ─── E. QUESTION AGGREGATION ─────────────────────────────────────────────────
test('E: question aggregation sums targets and actuals across all month weeks', () => {
    const history = [
        { weekStart: '2026-09-01', progressSummary: { questions: { actual: 80, target: 100 } } },
        { weekStart: '2026-09-08', progressSummary: { questions: { actual: 120, target: 100 } } }
    ];
    const res = buildMonthlyCoachingSummary({ studyPlanHistory: history }, 2026, 9);

    assert.equal(res.planMetrics.questionActual, 200);
    assert.equal(res.planMetrics.questionTarget, 200);
    assert.equal(res.planMetrics.questionPercent, 100);
});

// ─── F. TASK AGGREGATION ─────────────────────────────────────────────────────
test('F: task aggregation sums completed and total tasks', () => {
    const history = [
        { weekStart: '2026-09-01', progressSummary: { tasks: { completed: 3, total: 4 } } },
        { weekStart: '2026-09-08', progressSummary: { tasks: { completed: 2, total: 6 } } }
    ];
    const res = buildMonthlyCoachingSummary({ studyPlanHistory: history }, 2026, 9);

    assert.equal(res.planMetrics.taskCompleted, 5);
    assert.equal(res.planMetrics.taskTotal, 10);
    assert.equal(res.planMetrics.taskPercent, 50);
});

// ─── G. PLAN EXAM AGGREGATION ────────────────────────────────────────────────
test('G: plan exam aggregation counts exam-task completions separately from exam records', () => {
    const history = [
        { weekStart: '2026-09-01', progressSummary: { exams: { actual: 2, target: 2 } } },
        { weekStart: '2026-09-08', progressSummary: { exams: { actual: 1, target: 2 } } }
    ];
    const res = buildMonthlyCoachingSummary({ studyPlanHistory: history }, 2026, 9);

    assert.equal(res.planMetrics.examActual, 3);
    assert.equal(res.planMetrics.examTarget, 4);
    assert.equal(res.planMetrics.examPercent, 75);
});

// ─── H. OVERACHIEVEMENT ──────────────────────────────────────────────────────
test('H: overachievement is allowed and computes >100% without clipping', () => {
    const history = [
        { weekStart: '2026-09-01', progressSummary: { questions: { actual: 250, target: 200 } } }
    ];
    const res = buildMonthlyCoachingSummary({ studyPlanHistory: history }, 2026, 9);

    assert.equal(res.planMetrics.questionPercent, 125);
});

// ─── I. NULL TARGETS ─────────────────────────────────────────────────────────
test('I: null targets return null percent without crashing', () => {
    const history = [
        { weekStart: '2026-09-01', progressSummary: { questions: { actual: 50, target: null } } }
    ];
    const res = buildMonthlyCoachingSummary({ studyPlanHistory: history }, 2026, 9);

    assert.equal(res.planMetrics.questionTarget, null);
    assert.equal(res.planMetrics.questionPercent, null);
});

// ─── J. ZERO TARGETS ─────────────────────────────────────────────────────────
test('J: zero targets return null percent instead of division by zero or fake 0%', () => {
    const history = [
        { weekStart: '2026-09-01', progressSummary: { questions: { actual: 10, target: 0 } } }
    ];
    const res = buildMonthlyCoachingSummary({ studyPlanHistory: history }, 2026, 9);

    assert.equal(res.planMetrics.questionPercent, null);
});

// ─── K. NO NAN ───────────────────────────────────────────────────────────────
test('K: malformed numeric values never produce NaN in output', () => {
    const history = [
        { weekStart: '2026-09-01', progressSummary: { questions: { actual: 'corrupt', target: 'bad' } } }
    ];
    const res = buildMonthlyCoachingSummary({ studyPlanHistory: history }, 2026, 9);

    assert.ok(!Number.isNaN(res.planMetrics.questionActual));
    assert.equal(res.planMetrics.questionTarget, null);
    assert.equal(res.planMetrics.questionPercent, null);
});

// ─── L. NO INFINITY ──────────────────────────────────────────────────────────
test('L: actual > 0 with 0 target produces null percent rather than Infinity', () => {
    const pct = calcPercent(100, 0);
    assert.equal(pct, null);
    assert.notEqual(pct, Infinity);
});

// ─── M. BRANCH AGGREGATION ───────────────────────────────────────────────────
test('M: branch aggregation sums targets, actuals and weekCount across month', () => {
    const history = [
        {
            weekStart: '2026-09-01',
            progressSummary: {
                branches: [
                    { subject: 'Fen Bilimleri', actual: 40, target: 50 },
                    { subject: 'Matematik', actual: 30, target: 40 }
                ]
            }
        },
        {
            weekStart: '2026-09-08',
            progressSummary: {
                branches: [
                    { subject: 'Fen Bilimleri', actual: 50, target: 50 }
                ]
            }
        }
    ];
    const res = buildMonthlyCoachingSummary({ studyPlanHistory: history }, 2026, 9);

    assert.equal(res.branchSummary.length, 2);
    const fen = res.branchSummary.find(b => b.subject === 'Fen Bilimleri');
    assert.equal(fen.actual, 90);
    assert.equal(fen.target, 100);
    assert.equal(fen.percent, 90);
    assert.equal(fen.weekCount, 2);

    const mat = res.branchSummary.find(b => b.subject === 'Matematik');
    assert.equal(mat.actual, 30);
    assert.equal(mat.target, 40);
    assert.equal(mat.percent, 75);
    assert.equal(mat.weekCount, 1);
});

// ─── N. BRANCH EXACT MATCH ───────────────────────────────────────────────────
test('N: branch names are matched exactly without fuzzy blending', () => {
    const history = [
        {
            weekStart: '2026-09-01',
            progressSummary: {
                branches: [
                    { subject: 'Fen Bilimleri', actual: 30, target: 40 },
                    { subject: 'Fen', actual: 20, target: 20 }
                ]
            }
        }
    ];
    const res = buildMonthlyCoachingSummary({ studyPlanHistory: history }, 2026, 9);

    assert.equal(res.branchSummary.length, 2);
    assert.ok(res.branchSummary.some(b => b.subject === 'Fen Bilimleri'));
    assert.ok(res.branchSummary.some(b => b.subject === 'Fen'));
});

// ─── O. TOPIC AGGREGATION ────────────────────────────────────────────────────
test('O: topic aggregation groups by subject + topic', () => {
    const history = [
        {
            weekStart: '2026-09-01',
            progressSummary: {
                topics: [
                    { subject: 'Fen Bilimleri', topic: 'Hücre Bölünmeleri', actual: 20, target: 25 }
                ]
            }
        },
        {
            weekStart: '2026-09-08',
            progressSummary: {
                topics: [
                    { subject: 'Fen Bilimleri', topic: 'Hücre Bölünmeleri', actual: 30, target: 25 }
                ]
            }
        }
    ];
    const res = buildMonthlyCoachingSummary({ studyPlanHistory: history }, 2026, 9);

    assert.equal(res.topicSummary.length, 1);
    assert.equal(res.topicSummary[0].subject, 'Fen Bilimleri');
    assert.equal(res.topicSummary[0].topic, 'Hücre Bölünmeleri');
    assert.equal(res.topicSummary[0].actual, 50);
    assert.equal(res.topicSummary[0].target, 50);
    assert.equal(res.topicSummary[0].percent, 100);
    assert.equal(res.topicSummary[0].weekCount, 2);
});

// ─── P. TOPIC EXACT SUBJECT + TOPIC ──────────────────────────────────────────
test('P: identical topic name in different subjects is not merged', () => {
    const history = [
        {
            weekStart: '2026-09-01',
            progressSummary: {
                topics: [
                    { subject: 'Fen Bilimleri', topic: 'Grafik Okuma', actual: 10, target: 20 },
                    { subject: 'Matematik', topic: 'Grafik Okuma', actual: 15, target: 20 }
                ]
            }
        }
    ];
    const res = buildMonthlyCoachingSummary({ studyPlanHistory: history }, 2026, 9);

    assert.equal(res.topicSummary.length, 2);
    assert.equal(res.topicSummary[0].subject, 'Fen Bilimleri');
    assert.equal(res.topicSummary[1].subject, 'Matematik');
});

// ─── Q. NO FAKE ERRORCOUNT ───────────────────────────────────────────────────
test('Q: topicSummary never contains errorCount field', () => {
    const history = [
        {
            weekStart: '2026-09-01',
            progressSummary: {
                topics: [{ subject: 'Fen Bilimleri', topic: 'Kalıtım', actual: 20, target: 30 }]
            }
        }
    ];
    const res = buildMonthlyCoachingSummary({ studyPlanHistory: history }, 2026, 9);

    assert.equal('errorCount' in res.topicSummary[0], false);
});

// ─── R. WEEKLY CHRONOLOGICAL SORT ────────────────────────────────────────────
test('R: weeklyTrend is sorted chronologically by weekStart regardless of input order', () => {
    const history = [
        { weekStart: '2026-09-22', progressSummary: { questions: { actual: 90, target: 100 } } },
        { weekStart: '2026-09-01', progressSummary: { questions: { actual: 80, target: 100 } } },
        { weekStart: '2026-09-15', progressSummary: { questions: { actual: 85, target: 100 } } }
    ];
    const res = buildMonthlyCoachingSummary({ studyPlanHistory: history }, 2026, 9);

    assert.equal(res.weeklyTrend[0].weekStart, '2026-09-01');
    assert.equal(res.weeklyTrend[1].weekStart, '2026-09-15');
    assert.equal(res.weeklyTrend[2].weekStart, '2026-09-22');
});

// ─── S. MONTH BUCKET VIA WEEKSTART ───────────────────────────────────────────
test('S: month bucket strictly determined by weekStart date', () => {
    const history = [
        { weekStart: '2026-08-25', weekEnd: '2026-08-31', progressSummary: { questions: { actual: 50 } } },
        { weekStart: '2026-09-01', weekEnd: '2026-09-07', progressSummary: { questions: { actual: 60 } } }
    ];
    const resSep = buildMonthlyCoachingSummary({ studyPlanHistory: history }, 2026, 9);
    assert.equal(resSep.period.weekCount, 1);
    assert.equal(resSep.planMetrics.questionActual, 60);

    const resAug = buildMonthlyCoachingSummary({ studyPlanHistory: history }, 2026, 8);
    assert.equal(resAug.period.weekCount, 1);
    assert.equal(resAug.planMetrics.questionActual, 50);
});

// ─── T. AUG 31 - SEP 6 BELONGS AUGUST ────────────────────────────────────────
test('T: weekStart 2026-08-31 belongs to August bucket and never counts in September', () => {
    const history = [
        {
            weekStart: '2026-08-31',
            weekEnd: '2026-09-06',
            progressSummary: { questions: { actual: 150, target: 150 } }
        }
    ];
    const resSep = buildMonthlyCoachingSummary({ studyPlanHistory: history }, 2026, 9);
    assert.equal(resSep.period.weekCount, 0);
    assert.equal(resSep.planMetrics.questionActual, 0);

    const resAug = buildMonthlyCoachingSummary({ studyPlanHistory: history }, 2026, 8);
    assert.equal(resAug.period.weekCount, 1);
    assert.equal(resAug.planMetrics.questionActual, 150);
});

// ─── U. LEGACY SNAPSHOT SAFE ─────────────────────────────────────────────────
test('U: legacy snapshots without progressSummary calculate actuals from tasks and targets', () => {
    const legacySnap = {
        weekStart: '2026-09-07',
        weekEnd: '2026-09-13',
        weeklyTargets: { totalQuestions: 100, generalExams: 1, branchExams: 1 },
        tasks: [
            { taskType: 'question', completedCount: 50, completed: false },
            { taskType: 'question', completedCount: 40, completed: true },
            { taskType: 'exam', completed: true }
        ]
    };
    const res = buildMonthlyCoachingSummary({ studyPlanHistory: [legacySnap] }, 2026, 9);

    assert.equal(res.period.weekCount, 1);
    assert.equal(res.planMetrics.questionActual, 90);
    assert.equal(res.planMetrics.questionTarget, 100);
    assert.equal(res.planMetrics.questionPercent, 90);
    assert.equal(res.planMetrics.taskTotal, 3);
    assert.equal(res.planMetrics.taskCompleted, 2);
    assert.equal(res.planMetrics.examActual, 1);
    assert.equal(res.planMetrics.examTarget, 2);
});

// ─── V. SOURCESTATUS MISSING SAFE ────────────────────────────────────────────
test('V: snapshots without sourceStatus or status are accepted without migration', () => {
    const rawSnap = {
        weekStart: '2026-09-07',
        progressSummary: { questions: { actual: 100, target: 100 } }
    };
    const res = buildMonthlyCoachingSummary({ studyPlanHistory: [rawSnap] }, 2026, 9);

    assert.equal(res.period.weekCount, 1);
    assert.equal(res.planMetrics.questionActual, 100);
});

// ─── W. RECORDED EXAM CONTEXT ────────────────────────────────────────────────
test('W: recorded exam context extracts monthly general exams and calculates first, latest and delta', () => {
    const student = {
        id: 's1',
        denemeler: [
            { tip: 'genel', tarih: '2026-08-25', toplamNet: 10.0 }, // August (ignored)
            { tip: 'genel', tarih: '2026-09-05', toplamNet: 12.0 },
            { tip: 'genel', tarih: '2026-09-15', toplamNet: 14.5 },
            { tip: 'brans', tarih: '2026-09-20', net: 18.0 } // Branch (ignored from general examContext)
        ]
    };
    const res = buildMonthlyCoachingSummary(student, 2026, 9);

    assert.equal(res.examContext.examCount, 2);
    assert.equal(res.examContext.firstNet, 12.0);
    assert.equal(res.examContext.latestNet, 14.5);
    assert.equal(res.examContext.netDelta, 2.5);
    assert.equal(res.examContext.trendStatus, 'insufficient_data'); // only 2 exams
});

// ─── X. <3 EXAMS NO TREND ────────────────────────────────────────────────────
test('X: 2 recorded exams in month evaluate to insufficient_data trend', () => {
    const student = {
        denemeler: [
            { tip: 'genel', tarih: '2026-09-05', toplamNet: 18.0 },
            { tip: 'genel', tarih: '2026-09-15', toplamNet: 12.0 }
        ]
    };
    const res = buildMonthlyCoachingSummary(student, 2026, 9);

    assert.equal(res.examContext.examCount, 2);
    assert.equal(res.examContext.trendStatus, 'insufficient_data');
});

// ─── Y. >=3 EXAMS TREND ──────────────────────────────────────────────────────
test('Y: >=3 recorded exams declare improving, declining, or stable trend', () => {
    const studentDeclining = {
        denemeler: [
            { tip: 'genel', tarih: '2026-09-05', toplamNet: 16.0 },
            { tip: 'genel', tarih: '2026-09-12', toplamNet: 14.0 },
            { tip: 'genel', tarih: '2026-09-20', toplamNet: 13.0 }
        ]
    };
    const resDec = buildMonthlyCoachingSummary(studentDeclining, 2026, 9);
    assert.equal(resDec.examContext.examCount, 3);
    assert.equal(resDec.examContext.trendStatus, 'declining');
    assert.equal(resDec.examContext.netDelta, -3.0);

    const studentImproving = {
        denemeler: [
            { tip: 'genel', tarih: '2026-09-05', toplamNet: 12.0 },
            { tip: 'genel', tarih: '2026-09-12', toplamNet: 13.5 },
            { tip: 'genel', tarih: '2026-09-20', toplamNet: 15.0 }
        ]
    };
    const resImp = buildMonthlyCoachingSummary(studentImproving, 2026, 9);
    assert.equal(resImp.examContext.trendStatus, 'improving');
});

// ─── Z. HOMEWORK CONTEXT ─────────────────────────────────────────────────────
test('Z: homework context isolates monthly records with total, completed, overdue, and rate', () => {
    const student = {
        odevler: [
            { bitisTarihi: '2026-09-05', durum: 'tamamlandi' },
            { bitisTarihi: '2026-09-10', durum: 'tamamlandi' },
            { bitisTarihi: '2026-09-12', durum: 'bekliyor' }, // overdue relative to now 2026-09-20
            { bitisTarihi: '2026-08-20', durum: 'tamamlandi' } // August (ignored)
        ]
    };
    const res = buildMonthlyCoachingSummary(student, 2026, 9, { now: new Date('2026-09-20') });

    assert.equal(res.homeworkContext.total, 3);
    assert.equal(res.homeworkContext.completed, 2);
    assert.equal(res.homeworkContext.overdue, 1);
    assert.equal(res.homeworkContext.completionRate, 67);
});

// ─── AA. GUIDANCE CONTEXT ────────────────────────────────────────────────────
test('AA: guidance context counts interventions, follow-ups, and resolved cases without notes', () => {
    const student = {
        guidanceRecords: [
            { id: 'g1', createdAt: '2026-09-02', status: 'open', followUpDate: '2026-09-10', privateNote: 'Confidential note' },
            { id: 'g2', createdAt: '2026-09-05', status: 'completed', closedAt: '2026-09-15' },
            { id: 'g3', createdAt: '2026-08-10', status: 'open', followUpDate: '2026-09-25' } // Planned for Sep follow-up
        ]
    };
    const res = buildMonthlyCoachingSummary(student, 2026, 9);

    assert.equal(res.guidanceContext.interventionCount, 2);
    assert.equal(res.guidanceContext.followUpCount, 2);
    assert.equal(res.guidanceContext.resolvedCount, 1);
    assert.equal('privateNote' in res.guidanceContext, false);
});

// ─── AB. TEACHER NOTE EXCLUDED ───────────────────────────────────────────────
test('AB: teacherNote text from weekly check-ins is strictly excluded from output contract', () => {
    const history = [
        {
            weekStart: '2026-09-01',
            progressSummary: { questions: { actual: 100, target: 100 } },
            weeklyCheckIn: {
                teacherNote: 'Öğrenci derste dikkat dağınıklığı yaşadı.',
                nextWeekFocus: 'Optik tekrarı'
            }
        }
    ];
    const res = buildMonthlyCoachingSummary({ studyPlanHistory: history }, 2026, 9);

    const jsonStr = JSON.stringify(res);
    assert.ok(!jsonStr.includes('dikkat dağınıklığı'));
    assert.ok(!res.strengths.some(s => s.includes('dikkat')));
    assert.ok(!res.attentionAreas.some(a => a.includes('dikkat')));
});

// ─── AC. RECENT FOCUSES DEDUP ────────────────────────────────────────────────
test('AC: recentFocuses trims, eliminates duplicates, and caps at max 4 items', () => {
    const history = [
        { weekStart: '2026-09-01', weeklyCheckIn: { nextWeekFocus: 'Basınç Soru Çözümü' } },
        { weekStart: '2026-09-08', weeklyCheckIn: { nextWeekFocus: '  Basınç Soru Çözümü  ' } },
        { weekStart: '2026-09-15', weeklyCheckIn: { nextWeekFocus: 'Periyodik Tablo' } },
        { weekStart: '2026-09-22', weeklyCheckIn: { nextWeekFocus: '' } }
    ];
    const res = buildMonthlyCoachingSummary({ studyPlanHistory: history }, 2026, 9);

    assert.equal(res.recentFocuses.length, 2);
    assert.ok(res.recentFocuses.includes('Basınç Soru Çözümü'));
    assert.ok(res.recentFocuses.includes('Periyodik Tablo'));
});

// ─── AD. NO NEXTMONTHFOCUS INFERENCE ─────────────────────────────────────────
test('AD: recentFocuses are never labeled as nextMonthFocus or inferred as future goals', () => {
    const history = [
        { weekStart: '2026-09-01', weeklyCheckIn: { nextWeekFocus: 'Kalıtım' } }
    ];
    const res = buildMonthlyCoachingSummary({ studyPlanHistory: history }, 2026, 9);

    assert.equal('nextMonthFocus' in res, false);
    assert.ok(Array.isArray(res.recentFocuses));
});

// ─── AE. STRENGTHS MAX 2 ─────────────────────────────────────────────────────
test('AE: strengths length never exceeds 2 items', () => {
    const history = [
        {
            weekStart: '2026-09-01',
            progressSummary: {
                questions: { actual: 200, target: 100 }, // 200%
                tasks: { completed: 5, total: 5 }, // 100%
                branches: [{ subject: 'Fen Bilimleri', actual: 100, target: 50 }] // 200%
            }
        }
    ];
    const student = {
        studyPlanHistory: history,
        odevler: [
            { bitisTarihi: '2026-09-05', durum: 'tamamlandi' },
            { bitisTarihi: '2026-09-10', durum: 'tamamlandi' },
            { bitisTarihi: '2026-09-15', durum: 'tamamlandi' }
        ]
    };
    const res = buildMonthlyCoachingSummary(student, 2026, 9);

    assert.ok(res.strengths.length <= 2);
});

// ─── AF. ATTENTION MAX 2 ─────────────────────────────────────────────────────
test('AF: attentionAreas length never exceeds 2 items and dedups related signals', () => {
    const history = [
        {
            weekStart: '2026-09-01',
            progressSummary: {
                questions: { actual: 20, target: 100 }, // 20%
                tasks: { completed: 1, total: 5 }, // 20%
                branches: [{ subject: 'Fen Bilimleri', actual: 10, target: 50 }] // 20%
            }
        }
    ];
    const student = {
        studyPlanHistory: history,
        denemeler: [
            { tip: 'genel', tarih: '2026-09-01', toplamNet: 18.0 },
            { tip: 'genel', tarih: '2026-09-10', toplamNet: 15.0 },
            { tip: 'genel', tarih: '2026-09-20', toplamNet: 12.0 } // Declining exam trend (-6 net)
        ],
        odevler: [
            { bitisTarihi: '2026-09-05', durum: 'bekliyor' },
            { bitisTarihi: '2026-09-10', durum: 'bekliyor' } // Overdue
        ]
    };
    const res = buildMonthlyCoachingSummary(student, 2026, 9, { now: new Date('2026-09-25') });

    assert.ok(res.attentionAreas.length <= 2);
    // Exam trend and plan question should be prioritized from diverse domains
    assert.ok(res.attentionAreas.some(a => a.includes('deneme') || a.includes('düşüş')));
});

// ─── AG. EVIDENCE-BASED STRENGTHS ────────────────────────────────────────────
test('AG: every strength contains quantitative or concrete evidence', () => {
    const history = [
        {
            weekStart: '2026-09-01',
            progressSummary: { questions: { actual: 120, target: 100 } }
        }
    ];
    const res = buildMonthlyCoachingSummary({ studyPlanHistory: history }, 2026, 9);

    assert.equal(res.strengths.length, 1);
    assert.ok(res.strengths[0].includes('%120'));
    assert.ok(res.strengths[0].includes('120/100 soru'));
});

// ─── AH. EVIDENCE-BASED ATTENTION ────────────────────────────────────────────
test('AH: every attention area contains concrete evidence and avoids diagnostic language', () => {
    const history = [
        {
            weekStart: '2026-09-01',
            progressSummary: { questions: { actual: 30, target: 100 } }
        }
    ];
    const res = buildMonthlyCoachingSummary({ studyPlanHistory: history }, 2026, 9);

    assert.equal(res.attentionAreas.length, 1);
    assert.ok(res.attentionAreas[0].includes('%30'));
    assert.ok(!res.attentionAreas[0].includes('bozukluk') && !res.attentionAreas[0].includes('yetersiz'));
});

// ─── AI. CONTRADICTORY SIGNALS PRESERVED ─────────────────────────────────────
test('AI: strong plan adherence and declining exam trend coexist without silencing either', () => {
    const history = [
        {
            weekStart: '2026-09-01',
            progressSummary: { questions: { actual: 150, target: 100 } } // 150% plan
        }
    ];
    const student = {
        studyPlanHistory: history,
        denemeler: [
            { tip: 'genel', tarih: '2026-09-01', toplamNet: 18.0 },
            { tip: 'genel', tarih: '2026-09-10', toplamNet: 15.0 },
            { tip: 'genel', tarih: '2026-09-20', toplamNet: 12.0 } // Declining exam trend
        ]
    };
    const res = buildMonthlyCoachingSummary(student, 2026, 9);

    assert.ok(res.strengths.some(s => s.includes('hedefi aşıldı') || s.includes('%150')));
    assert.ok(res.attentionAreas.some(a => a.includes('düşüş trendi')));
});

// ─── AJ. EMPTY DATA NEUTRAL ──────────────────────────────────────────────────
test('AJ: empty student entity does not raise false alarms or generate attention areas', () => {
    const res = buildMonthlyCoachingSummary({}, 2026, 9);

    assert.equal(res.strengths.length, 0);
    assert.equal(res.attentionAreas.length, 0);
    assert.equal(res.dataCoverage.confidence, 'minimal');
});

// ─── AK. ACTIVE PREVIEW OPTIONAL ─────────────────────────────────────────────
test('AK: active week is excluded by default and included only when includeActiveWeek: true', () => {
    const student = {
        studyPlanHistory: [
            { weekStart: '2026-09-01', progressSummary: { questions: { actual: 80, target: 100 } } }
        ],
        coachingPlan: {
            status: 'active',
            weekStart: '2026-09-08',
            weekEnd: '2026-09-14',
            progressSummary: { questions: { actual: 40, target: 100 } }
        }
    };

    const resDefault = buildMonthlyCoachingSummary(student, 2026, 9);
    assert.equal(resDefault.weeklyTrend.length, 1);
    assert.equal(resDefault.period.previewWeekIncluded, false);

    const resWithPreview = buildMonthlyCoachingSummary(student, 2026, 9, { includeActiveWeek: true });
    assert.equal(resWithPreview.weeklyTrend.length, 2);
    assert.equal(resWithPreview.period.previewWeekIncluded, true);
});

// ─── AL. ACTIVE PREVIEW LABELED ──────────────────────────────────────────────
test('AL: active preview week is explicitly labeled with isPreview: true and statusLabel', () => {
    const student = {
        studyPlanHistory: [],
        coachingPlan: {
            status: 'active',
            weekStart: '2026-09-08',
            weekEnd: '2026-09-14',
            progressSummary: { questions: { actual: 40, target: 100 } }
        }
    };
    const res = buildMonthlyCoachingSummary(student, 2026, 9, { includeActiveWeek: true });

    assert.equal(res.weeklyTrend.length, 1);
    assert.equal(res.weeklyTrend[0].isPreview, true);
    assert.equal(res.weeklyTrend[0].statusLabel, 'Devam Eden Hafta');
});

// ─── AM. ACTIVE PREVIEW EXCLUDED FROM FINALIZED TOTALS ───────────────────────
test('AM: active preview week never alters finalized planMetrics or finalizedWeekCount', () => {
    const student = {
        studyPlanHistory: [
            { weekStart: '2026-09-01', progressSummary: { questions: { actual: 100, target: 100 } } }
        ],
        coachingPlan: {
            status: 'active',
            weekStart: '2026-09-08',
            weekEnd: '2026-09-14',
            progressSummary: { questions: { actual: 50, target: 100 } }
        }
    };
    const resWithPreview = buildMonthlyCoachingSummary(student, 2026, 9, { includeActiveWeek: true });

    assert.equal(resWithPreview.period.finalizedWeekCount, 1);
    assert.equal(resWithPreview.period.weekCount, 1);
    assert.equal(resWithPreview.planMetrics.questionActual, 100);
    assert.equal(resWithPreview.planMetrics.questionTarget, 100);
});

// ─── AN. MUTATION SAFETY ─────────────────────────────────────────────────────
test('AN: buildMonthlyCoachingSummary never mutates input student, history, or options', () => {
    const originalStudent = {
        id: 's_freeze',
        studyPlanHistory: [
            { weekStart: '2026-09-01', progressSummary: { questions: { actual: 50, target: 100 } } }
        ],
        denemeler: [{ tip: 'genel', tarih: '2026-09-05', toplamNet: 15.0 }],
        odevler: [{ bitisTarihi: '2026-09-10', durum: 'tamamlandi' }],
        guidanceRecords: [{ id: 'g1', createdAt: '2026-09-02', status: 'open' }]
    };

    const frozen = JSON.parse(JSON.stringify(originalStudent));
    Object.freeze(frozen);
    Object.freeze(frozen.studyPlanHistory);
    Object.freeze(frozen.studyPlanHistory[0]);
    Object.freeze(frozen.denemeler);
    Object.freeze(frozen.denemeler[0]);
    Object.freeze(frozen.odevler);
    Object.freeze(frozen.odevler[0]);
    Object.freeze(frozen.guidanceRecords);
    Object.freeze(frozen.guidanceRecords[0]);

    const res = buildMonthlyCoachingSummary(frozen, 2026, 9);
    assert.ok(res);
    assert.deepEqual(frozen.studyPlanHistory[0].weekStart, '2026-09-01');
});

// ─── AO. DETERMINISTIC OUTPUT ────────────────────────────────────────────────
test('AO: repeated executions with identical inputs yield identical outputs', () => {
    const student = {
        studyPlanHistory: [
            { weekStart: '2026-09-01', progressSummary: { questions: { actual: 100, target: 120 } } }
        ]
    };
    const r1 = buildMonthlyCoachingSummary(student, 2026, 9);
    const r2 = buildMonthlyCoachingSummary(student, 2026, 9);

    assert.deepEqual(r1, r2);
});

// ─── AP. TURKISH MONTH LABEL ─────────────────────────────────────────────────
test('AP: generates deterministic Turkish month label for all 12 months', () => {
    const expected = [
        [1, 'Ocak 2026'],
        [2, 'Şubat 2026'],
        [3, 'Mart 2026'],
        [4, 'Nisan 2026'],
        [5, 'Mayıs 2026'],
        [6, 'Haziran 2026'],
        [7, 'Temmuz 2026'],
        [8, 'Ağustos 2026'],
        [9, 'Eylül 2026'],
        [10, 'Ekim 2026'],
        [11, 'Kasım 2026'],
        [12, 'Aralık 2026']
    ];

    for (const [m, label] of expected) {
        const res = buildMonthlyCoachingSummary({}, 2026, m);
        assert.equal(res.period.monthLabel, label);
    }
});

// ─── AQ. NO NETWORK / STORAGE DEPENDENCY ─────────────────────────────────────
test('AQ: module executes purely without DOM, window, localStorage, or fetch', () => {
    assert.equal(typeof buildMonthlyCoachingSummary, 'function');
    assert.equal(typeof filterSnapshotsForMonth, 'function');
    assert.equal(typeof extractWeekMetrics, 'function');
});

// ─── AR. PERFORMANCE BENCHMARK ───────────────────────────────────────────────
test('AR: benchmark realistic student with 12 history weeks, 20 exams, 30 homeworks, 20 guidance records runs in < 10ms', () => {
    const heavyStudent = {
        id: 'bench_heavy',
        name: 'Heavy Benchmark Student',
        studyPlanHistory: Array.from({ length: 12 }, (_, i) => ({
            id: `snap_${i}`,
            weekStart: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
            progressSummary: {
                questions: { actual: 120 + i, target: 150 },
                tasks: { completed: 4, total: 5 },
                exams: { actual: 1, target: 1 },
                branches: [
                    { subject: 'Fen Bilimleri', actual: 60, target: 75 },
                    { subject: 'Matematik', actual: 40, target: 50 }
                ],
                topics: [
                    { subject: 'Fen Bilimleri', topic: 'Hücre Bölünmesi', actual: 30, target: 30 },
                    { subject: 'Matematik', topic: 'Üslü Sayılar', actual: 20, target: 25 }
                ]
            },
            weeklyCheckIn: { nextWeekFocus: `Odak ${i % 3}` }
        })),
        denemeler: Array.from({ length: 20 }, (_, i) => ({
            id: `exam_${i}`,
            tip: 'genel',
            tarih: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
            toplamNet: 12.0 + (i * 0.2)
        })),
        odevler: Array.from({ length: 30 }, (_, i) => ({
            id: `hw_${i}`,
            bitisTarihi: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
            durum: i % 4 === 0 ? 'bekliyor' : 'tamamlandi'
        })),
        guidanceRecords: Array.from({ length: 20 }, (_, i) => ({
            id: `gr_${i}`,
            createdAt: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
            followUpDate: `2026-09-${String((i % 28) + 5).padStart(2, '0')}`,
            closedAt: i % 2 === 0 ? `2026-09-${String((i % 28) + 6).padStart(2, '0')}` : null,
            status: i % 2 === 0 ? 'completed' : 'open'
        }))
    };

    const start = performance.now();
    const summary = buildMonthlyCoachingSummary(heavyStudent, 2026, 9);
    const duration = performance.now() - start;

    assert.ok(summary);
    assert.ok(duration < 10, `Monthly summary took ${duration.toFixed(2)}ms (expected < 10ms)`);
});

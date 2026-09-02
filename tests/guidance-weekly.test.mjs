import test from 'node:test';
import assert from 'node:assert/strict';

import {
    formatWeekDateRange,
    shiftWeekRange,
    extractAllGuidanceRecords,
    getWeeklyGuidanceAnalytics,
    compareGuidanceWeeks
} from '../guidance-weekly-insights.js';

test('UX-06.5 Scenario A: Week Monday-Sunday boundaries formatting and shifting', () => {
    // 2026-08-31 to 2026-09-06
    const label = formatWeekDateRange('2026-08-31', '2026-09-06');
    assert.equal(label, '31 Ağu – 6 Eyl 2026');

    // Shift previous week
    const prevWeek = shiftWeekRange('2026-08-31', -1);
    assert.equal(prevWeek.monday, '2026-08-24');
    assert.equal(prevWeek.sunday, '2026-08-30');

    // Shift next week
    const nextWeek = shiftWeekRange('2026-08-31', 1);
    assert.equal(nextWeek.monday, '2026-09-07');
    assert.equal(nextWeek.sunday, '2026-09-13');
});

test('UX-06.5 Scenario B: Planned follow-up count counts records with followUpDate in selected week', () => {
    const students = [
        {
            id: 's1',
            adSoyad: 'Ahmet Yılmaz',
            guidanceRecords: [
                { id: 'r1', status: 'open', followUpDate: '2026-09-01' }, // In week
                { id: 'r2', status: 'completed', followUpDate: '2026-09-04' }, // In week
                { id: 'r3', status: 'open', followUpDate: '2026-08-25' }, // Past week
                { id: 'r4', status: 'open', followUpDate: null } // Undated
            ]
        }
    ];

    const weekRange = { monday: '2026-08-31', sunday: '2026-09-06' };
    const analytics = getWeeklyGuidanceAnalytics(students, { weekRange, now: '2026-09-02T10:00:00Z' });

    assert.equal(analytics.metrics.plannedCount, 2);
    assert.equal(analytics.plannedRecords.length, 2);
});

test('UX-06.5 Scenario C: Completed count strictly uses closedAt timestamp', () => {
    const students = [
        {
            id: 's1',
            adSoyad: 'Fatma Şahin',
            guidanceRecords: [
                // Planned past, but closed in this week
                { id: 'r1', status: 'completed', followUpDate: '2026-08-20', closedAt: '2026-09-01T14:30:00' },
                // Planned this week and closed in this week
                { id: 'r2', status: 'completed', followUpDate: '2026-09-02', closedAt: '2026-09-02T16:00:00' },
                // Planned this week, but closed in next week
                { id: 'r3', status: 'completed', followUpDate: '2026-09-03', closedAt: '2026-09-08T10:00:00' },
                // Open (not completed)
                { id: 'r4', status: 'open', followUpDate: '2026-09-02' }
            ]
        }
    ];

    const weekRange = { monday: '2026-08-31', sunday: '2026-09-06' };
    const analytics = getWeeklyGuidanceAnalytics(students, { weekRange, now: '2026-09-02T10:00:00Z' });

    assert.equal(analytics.metrics.completedCount, 2);
    assert.equal(analytics.completedInWeek.map(i => i.record.id).sort().join(','), 'r1,r2');
});

test('UX-06.5 Scenario D: On-time completed classification (closedAt <= followUpDate)', () => {
    const students = [
        {
            id: 's1',
            adSoyad: 'Ali Demir',
            guidanceRecords: [
                { id: 'r_ontime1', status: 'completed', followUpDate: '2026-09-03', closedAt: '2026-09-02T10:00:00' }, // Before due date
                { id: 'r_ontime2', status: 'completed', followUpDate: '2026-09-02', closedAt: '2026-09-02T17:00:00' }  // Same day as due date
            ]
        }
    ];

    const weekRange = { monday: '2026-08-31', sunday: '2026-09-06' };
    const analytics = getWeeklyGuidanceAnalytics(students, { weekRange, now: '2026-09-02T10:00:00Z' });

    assert.equal(analytics.metrics.onTimeCount, 2);
    assert.equal(analytics.metrics.lateCount, 0);
    assert.equal(analytics.metrics.onTimeRate, 100);
});

test('UX-06.5 Scenario E: Late completed classification (closedAt > followUpDate)', () => {
    const students = [
        {
            id: 's1',
            adSoyad: 'Zeynep Kaya',
            guidanceRecords: [
                { id: 'r_late', status: 'completed', followUpDate: '2026-08-30', closedAt: '2026-09-02T11:00:00' } // 3 days late
            ]
        }
    ];

    const weekRange = { monday: '2026-08-31', sunday: '2026-09-06' };
    const analytics = getWeeklyGuidanceAnalytics(students, { weekRange, now: '2026-09-02T10:00:00Z' });

    assert.equal(analytics.metrics.lateCount, 1);
    assert.equal(analytics.lateCompleted[0].daysLate, 3);
    assert.equal(analytics.metrics.onTimeCount, 0);
    assert.equal(analytics.metrics.onTimeRate, 0);
});

test('UX-06.5 Scenario F: Open future record in current week is NOT overdue', () => {
    const students = [
        {
            id: 's1',
            adSoyad: 'Can Öz',
            guidanceRecords: [
                { id: 'r_future_in_week', status: 'open', followUpDate: '2026-09-05' } // Saturday (future relative to Wednesday Sep 2)
            ]
        }
    ];

    const weekRange = { monday: '2026-08-31', sunday: '2026-09-06' };
    const analytics = getWeeklyGuidanceAnalytics(students, { weekRange, now: '2026-09-02T10:00:00Z' });

    assert.equal(analytics.metrics.openCount, 1);
    assert.equal(analytics.metrics.overdueCount, 0, 'Future record within current week must not be overdue');
    assert.equal(analytics.futureOpenThisWeek.length, 1);
});

test('UX-06.5 Scenario G: Open past record in current week IS overdue', () => {
    const students = [
        {
            id: 's1',
            adSoyad: 'Murat Can',
            guidanceRecords: [
                { id: 'r_past_in_week', status: 'open', followUpDate: '2026-08-31' } // Monday (past relative to Wednesday Sep 2)
            ]
        }
    ];

    const weekRange = { monday: '2026-08-31', sunday: '2026-09-06' };
    const analytics = getWeeklyGuidanceAnalytics(students, { weekRange, now: '2026-09-02T10:00:00Z' });

    assert.equal(analytics.metrics.overdueCount, 1);
    assert.equal(analytics.overdueRecords[0].daysOverdue, 2);
});

test('UX-06.5 Scenario H: Pending outcome is excluded from measurable outcome denominator', () => {
    const students = [
        {
            id: 's1',
            adSoyad: 'Ece Yıldız',
            guidanceRecords: [
                { id: 'r1', status: 'completed', result: 'positive', closedAt: '2026-09-01T10:00:00' },
                { id: 'r2', status: 'completed', result: 'positive', closedAt: '2026-09-02T11:00:00' },
                { id: 'r3', status: 'completed', result: 'neutral', closedAt: '2026-09-02T12:00:00' },
                // Pending open record
                { id: 'r4', status: 'open', result: 'pending', followUpDate: '2026-09-02' }
            ]
        }
    ];

    const weekRange = { monday: '2026-08-31', sunday: '2026-09-06' };
    const analytics = getWeeklyGuidanceAnalytics(students, { weekRange, now: '2026-09-02T10:00:00Z' });

    // Positive rate: 2 positive / (2 positive + 1 neutral) = 2/3 = 67%
    assert.equal(analytics.metrics.positiveRate, 67);
    assert.equal(analytics.pendingOpenCount, 1);
});

test('UX-06.5 Scenario I: Outcome distribution counts positive, neutral, negative and pending', () => {
    const students = [
        {
            id: 's1',
            adSoyad: 'Ozan Tekin',
            guidanceRecords: [
                { id: 'r1', status: 'completed', result: 'positive', closedAt: '2026-09-01T10:00:00' },
                { id: 'r2', status: 'completed', result: 'neutral', closedAt: '2026-09-02T10:00:00' },
                { id: 'r3', status: 'completed', result: 'negative', closedAt: '2026-09-03T10:00:00' }
            ]
        }
    ];

    const weekRange = { monday: '2026-08-31', sunday: '2026-09-06' };
    const analytics = getWeeklyGuidanceAnalytics(students, { weekRange, now: '2026-09-04T10:00:00Z' });

    assert.equal(analytics.outcomes.positive, 1);
    assert.equal(analytics.outcomes.neutral, 1);
    assert.equal(analytics.outcomes.negative, 1);
    assert.equal(analytics.metrics.positiveRate, 33);
});

test('UX-06.5 Scenario J: Category distribution correctly classifies types and finds dominant category', () => {
    const students = [
        {
            id: 's1',
            adSoyad: 'Selin Acar',
            guidanceRecords: [
                { id: 'r1', status: 'open', type: 'academic', followUpDate: '2026-09-01' },
                { id: 'r2', status: 'open', type: 'academic', followUpDate: '2026-09-02' },
                { id: 'r3', status: 'open', type: 'discipline', followUpDate: '2026-09-03' }
            ]
        }
    ];

    const weekRange = { monday: '2026-08-31', sunday: '2026-09-06' };
    const analytics = getWeeklyGuidanceAnalytics(students, { weekRange, now: '2026-09-02T10:00:00Z' });

    assert.equal(analytics.categories.academic, 2);
    assert.equal(analytics.categories.discipline, 1);
    assert.equal(analytics.dominantCategory.key, 'academic');
    assert.equal(analytics.dominantCategory.count, 2);
});

test('UX-06.5 Scenario K: Per-student weekly aggregation groups counts by student', () => {
    const students = [
        {
            id: 's_yagmur',
            adSoyad: 'Yağmur Aydın',
            guidanceRecords: [
                { id: 'r1', status: 'completed', result: 'positive', followUpDate: '2026-09-01', closedAt: '2026-09-01T10:00:00' },
                { id: 'r2', status: 'completed', result: 'neutral', followUpDate: '2026-09-02', closedAt: '2026-09-02T11:00:00' }
            ]
        },
        {
            id: 's_ali',
            adSoyad: 'Ali Yılmaz',
            guidanceRecords: [
                { id: 'r3', status: 'open', followUpDate: '2026-08-31' }, // Overdue
                { id: 'r4', status: 'open', followUpDate: '2026-09-04' }  // Open future
            ]
        }
    ];

    const weekRange = { monday: '2026-08-31', sunday: '2026-09-06' };
    const analytics = getWeeklyGuidanceAnalytics(students, { weekRange, now: '2026-09-02T10:00:00Z' });

    assert.equal(analytics.studentSummaries.length, 2);

    const ali = analytics.studentSummaries.find(s => s.studentId === 's_ali');
    assert.equal(ali.openCount, 2);
    assert.equal(ali.overdueCount, 1);
    assert.equal(ali.completedCount, 0);

    const yagmur = analytics.studentSummaries.find(s => s.studentId === 's_yagmur');
    assert.equal(yagmur.completedCount, 2);
    assert.equal(yagmur.openCount, 0);
    assert.equal(yagmur.results.length, 2);
});

test('UX-06.5 Scenario L: Current-week open semantics (Hâlâ Açık Takipler)', () => {
    const weekRange = { monday: '2026-08-31', sunday: '2026-09-06' };
    const analytics = getWeeklyGuidanceAnalytics([], { weekRange, now: '2026-09-02T10:00:00Z' });

    assert.equal(analytics.isCurrentWeek, true);
    assert.equal(analytics.isPastWeek, false);
});

test('UX-06.5 Scenario M: Past-week carried open semantics (Devreden Açık Takipler)', () => {
    const weekRange = { monday: '2026-08-24', sunday: '2026-08-30' }; // Past week
    const analytics = getWeeklyGuidanceAnalytics([], { weekRange, now: '2026-09-02T10:00:00Z' });

    assert.equal(analytics.isCurrentWeek, false);
    assert.equal(analytics.isPastWeek, true);
});

test('UX-06.5 Scenario N: Previous-week comparison computes delta metrics', () => {
    const currentAnalytics = {
        metrics: {
            plannedCount: 8,
            completedCount: 6,
            completionRate: 75,
            overdueCount: 2,
            positiveRate: 67
        }
    };

    const prevAnalytics = {
        metrics: {
            plannedCount: 8,
            completedCount: 5,
            completionRate: 63,
            overdueCount: 3,
            positiveRate: 60
        }
    };

    const comparison = compareGuidanceWeeks(currentAnalytics, prevAnalytics);
    assert.equal(comparison.hasEnoughData, true);
    assert.equal(comparison.diffCompRate, 12);
    assert.equal(comparison.diffOverdue, -1);
    assert.equal(comparison.diffPositiveRate, 7);
});

test('UX-06.5 Scenario O: No previous data fallback message', () => {
    const currentAnalytics = {
        metrics: { plannedCount: 4, completedCount: 2, completionRate: 50, overdueCount: 1, positiveRate: 50 }
    };
    const emptyPrevAnalytics = {
        metrics: { plannedCount: 0, completedCount: 0, completionRate: null, overdueCount: 0, positiveRate: null }
    };

    const comparison = compareGuidanceWeeks(currentAnalytics, emptyPrevAnalytics);
    assert.equal(comparison.hasEnoughData, false);
    assert.equal(comparison.message, 'Karşılaştırma için önceki haftada yeterli kayıt yok.');
});

test('UX-06.5 Scenario P: Timezone-safe date boundary without UTC drift', () => {
    const weekRange = { monday: '2026-08-31', sunday: '2026-09-06' };
    const students = [
        {
            id: 's_tz',
            adSoyad: 'Timezone Öğrenci',
            guidanceRecords: [
                { id: 'r_tz1', status: 'open', followUpDate: '2026-08-31' },
                { id: 'r_tz2', status: 'open', followUpDate: '2026-09-06' }
            ]
        }
    ];

    const analytics = getWeeklyGuidanceAnalytics(students, { weekRange, now: '2026-09-02T23:59:59' });
    assert.equal(analytics.metrics.plannedCount, 2);
});

test('UX-06.5 Scenario Q: Scale test with 10 students, 20 planned, 14 completed, 3 overdue, 3 future, 9 positive', () => {
    const students = [];
    for (let i = 1; i <= 10; i++) {
        const records = [
            // 1 planned and completed on-time with positive result
            { id: `rec_${i}_c1`, status: 'completed', type: 'academic', result: 'positive', followUpDate: '2026-09-01', closedAt: '2026-09-01T10:00:00' },
            // 4 students have second completed record
            ...(i <= 4 ? [
                { id: `rec_${i}_c2`, status: 'completed', type: 'discipline', result: (i <= 3 ? 'neutral' : 'negative'), followUpDate: '2026-09-02', closedAt: '2026-09-02T11:00:00' }
            ] : []),
            // 3 overdue
            ...(i <= 3 ? [
                { id: `rec_${i}_od`, status: 'open', type: 'academic', followUpDate: '2026-08-31' }
            ] : []),
            // 3 future open
            ...(i >= 8 ? [
                { id: `rec_${i}_fut`, status: 'open', type: 'performance', followUpDate: '2026-09-05' }
            ] : []),
            // 2 pending
            ...(i <= 2 ? [
                { id: `rec_${i}_pnd`, status: 'open', result: 'pending', followUpDate: '2026-09-02' }
            ] : [])
        ];

        students.push({
            id: `s_scale_${i}`,
            adSoyad: `Öğrenci ${i}`,
            sinif: '8',
            guidanceRecords: records
        });
    }

    const weekRange = { monday: '2026-08-31', sunday: '2026-09-06' };
    const t0 = performance.now();
    const analytics = getWeeklyGuidanceAnalytics(students, { weekRange, now: '2026-09-02T10:00:00Z' });
    const t1 = performance.now();

    assert.equal(analytics.metrics.completedCount, 14); // 10 + 4
    assert.equal(analytics.metrics.overdueCount, 3);
    assert.equal(analytics.metrics.futureOpenCount, 3);
    assert.equal(analytics.outcomes.positive, 10);
    assert.ok((t1 - t0) < 50, `Scale test should be fast, took ${t1 - t0}ms`);
});

test('UX-06.5.1 Scenario A: Carry-in completion does not inflate planned cohort', () => {
    const students = [
        {
            id: 's_carry',
            adSoyad: 'Devir Öğrenci',
            guidanceRecords: [
                // Planned previous week, completed this week
                { id: 'r_prev', status: 'completed', followUpDate: '2026-08-25', closedAt: '2026-09-02T10:00:00' },
                // Planned this week, not completed
                { id: 'r_curr', status: 'open', followUpDate: '2026-09-03' }
            ]
        }
    ];

    const weekRange = { monday: '2026-08-31', sunday: '2026-09-06' };
    const analytics = getWeeklyGuidanceAnalytics(students, { weekRange, now: '2026-09-02T10:00:00Z' });

    assert.equal(analytics.metrics.plannedCount, 1, 'Only 1 record planned in this week');
    assert.equal(analytics.metrics.plannedCompletedCount, 0, '0 of this week planned records completed');
    assert.equal(analytics.metrics.plannedCompletionRate, 0);
    assert.equal(analytics.metrics.completedInWeekCount, 1, '1 total closed this week (carry-in)');
});

test('UX-06.5.1 Scenario B: Completion rate cannot exceed 100 even with multiple carry-ins', () => {
    const students = [
        {
            id: 's_many_carry',
            adSoyad: 'Çoklu Devir',
            guidanceRecords: [
                // 3 carry-ins from previous weeks closed this week
                { id: 'r_c1', status: 'completed', followUpDate: '2026-08-10', closedAt: '2026-09-01T10:00:00' },
                { id: 'r_c2', status: 'completed', followUpDate: '2026-08-15', closedAt: '2026-09-02T10:00:00' },
                { id: 'r_c3', status: 'completed', followUpDate: '2026-08-20', closedAt: '2026-09-03T10:00:00' },
                // Only 1 planned this week and completed
                { id: 'r_curr', status: 'completed', followUpDate: '2026-09-02', closedAt: '2026-09-02T11:00:00' }
            ]
        }
    ];

    const weekRange = { monday: '2026-08-31', sunday: '2026-09-06' };
    const analytics = getWeeklyGuidanceAnalytics(students, { weekRange, now: '2026-09-04T10:00:00Z' });

    assert.equal(analytics.metrics.plannedCount, 1);
    assert.equal(analytics.metrics.plannedCompletedCount, 1);
    assert.equal(analytics.metrics.plannedCompletionRate, 100);
    assert.ok(analytics.metrics.plannedCompletionRate <= 100);
    assert.equal(analytics.metrics.completedInWeekCount, 4);
});

test('UX-06.5.1 Scenario C: Planned cohort completion computes exact 75% for 3/4', () => {
    const students = [
        {
            id: 's_cohort',
            adSoyad: 'Cohort Öğrenci',
            guidanceRecords: [
                { id: 'r1', status: 'completed', followUpDate: '2026-09-01', closedAt: '2026-09-01T10:00:00' },
                { id: 'r2', status: 'completed', followUpDate: '2026-09-02', closedAt: '2026-09-02T10:00:00' },
                { id: 'r3', status: 'completed', followUpDate: '2026-09-03', closedAt: '2026-09-03T10:00:00' },
                { id: 'r4', status: 'open', followUpDate: '2026-09-04' }
            ]
        }
    ];

    const weekRange = { monday: '2026-08-31', sunday: '2026-09-06' };
    const analytics = getWeeklyGuidanceAnalytics(students, { weekRange, now: '2026-09-04T10:00:00Z' });

    assert.equal(analytics.metrics.plannedCount, 4);
    assert.equal(analytics.metrics.plannedCompletedCount, 3);
    assert.equal(analytics.metrics.plannedCompletionRate, 75);
});

test('UX-06.5.1 Scenario D & E: Past week historical open and later completion does not rewrite history', () => {
    const students = [
        {
            id: 's_hist',
            adSoyad: 'Tarihsel Öğrenci',
            guidanceRecords: [
                // Planned in past week (24-30 Aug), closed in next week (1 Sep)
                { id: 'r_hist', status: 'completed', followUpDate: '2026-08-26', closedAt: '2026-09-01T10:00:00' }
            ]
        }
    ];

    // Check past week 2026-08-24 to 2026-08-30 (evaluated on today 2026-09-02)
    const pastWeekRange = { monday: '2026-08-24', sunday: '2026-08-30' };
    const pastAnalytics = getWeeklyGuidanceAnalytics(students, { weekRange: pastWeekRange, now: '2026-09-02T10:00:00Z' });

    // As-of 30 August, r_hist was NOT closed yet (closed on Sep 1)
    assert.equal(pastAnalytics.metrics.plannedCount, 1);
    assert.equal(pastAnalytics.metrics.plannedCompletedCount, 0, 'Was not completed by 30 Aug');
    assert.equal(pastAnalytics.metrics.plannedCompletionRate, 0);
    assert.equal(pastAnalytics.openInWeek.length, 1, 'Must appear as open/carried over on 30 Aug');
    assert.equal(pastAnalytics.openInWeek[0].record.id, 'r_hist');

    // Check current week 2026-08-31 to 2026-09-06
    const currWeekRange = { monday: '2026-08-31', sunday: '2026-09-06' };
    const currAnalytics = getWeeklyGuidanceAnalytics(students, { weekRange: currWeekRange, now: '2026-09-02T10:00:00Z' });

    assert.equal(currAnalytics.metrics.plannedCount, 0, 'Not planned in this week');
    assert.equal(currAnalytics.metrics.completedInWeekCount, 1, 'Closed in this week');
});

test('UX-06.5.1 Scenario F: Past week overdue uses weekEnd reference date', () => {
    const students = [
        {
            id: 's_od_past',
            adSoyad: 'Geçmiş Gecikme',
            guidanceRecords: [
                // Planned 25 Aug, never closed, evaluating week 24-30 Aug on today 2 Sep
                { id: 'r_p1', status: 'open', followUpDate: '2026-08-25' }
            ]
        }
    ];

    const pastWeekRange = { monday: '2026-08-24', sunday: '2026-08-30' };
    const pastAnalytics = getWeeklyGuidanceAnalytics(students, { weekRange: pastWeekRange, now: '2026-09-02T10:00:00Z' });

    assert.equal(pastAnalytics.overdueRecords.length, 1);
    // 30 Aug - 25 Aug = 5 days overdue (not 8 days from Sep 2)
    assert.equal(pastAnalytics.overdueRecords[0].daysOverdue, 5);
});

test('UX-06.5.1 Scenario G: Current week overdue uses today reference date', () => {
    const students = [
        {
            id: 's_od_curr',
            adSoyad: 'Güncel Gecikme',
            guidanceRecords: [
                // Planned 31 Aug, evaluating current week on today 2 Sep
                { id: 'r_c1', status: 'open', followUpDate: '2026-08-31' }
            ]
        }
    ];

    const currWeekRange = { monday: '2026-08-31', sunday: '2026-09-06' };
    const currAnalytics = getWeeklyGuidanceAnalytics(students, { weekRange: currWeekRange, now: '2026-09-02T10:00:00Z' });

    assert.equal(currAnalytics.overdueRecords.length, 1);
    // 2 Sep - 31 Aug = 2 days overdue
    assert.equal(currAnalytics.overdueRecords[0].daysOverdue, 2);
});

test('UX-06.5.1 Scenario H: Future week produces no fake overdue', () => {
    const students = [
        {
            id: 's_fut',
            adSoyad: 'Gelecek Hafta',
            guidanceRecords: [
                { id: 'r_f1', status: 'open', followUpDate: '2026-09-10' }
            ]
        }
    ];

    const futureWeekRange = { monday: '2026-09-07', sunday: '2026-09-13' };
    const futureAnalytics = getWeeklyGuidanceAnalytics(students, { weekRange: futureWeekRange, now: '2026-09-02T10:00:00Z' });

    assert.equal(futureAnalytics.isFutureWeek, true);
    assert.equal(futureAnalytics.metrics.overdueCount, 0);
    assert.equal(futureAnalytics.overdueRecords.length, 0);
});

test('UX-06.5.1 Scenario I: Narrative strictly uses planned completed count', () => {
    const students = [
        {
            id: 's_nar',
            adSoyad: 'Anlatım Öğrenci',
            guidanceRecords: [
                // 1 planned and completed
                { id: 'r_p', status: 'completed', followUpDate: '2026-09-01', closedAt: '2026-09-01T10:00:00' },
                // 1 carry-in completed
                { id: 'r_c', status: 'completed', followUpDate: '2026-08-20', closedAt: '2026-09-02T10:00:00' }
            ]
        }
    ];

    const currWeekRange = { monday: '2026-08-31', sunday: '2026-09-06' };
    const analytics = getWeeklyGuidanceAnalytics(students, { weekRange: currWeekRange, now: '2026-09-02T10:00:00Z' });

    assert.ok(analytics.narrative.includes('1 planlı takipten 1\'i tamamlandı'));
    assert.ok(analytics.narrative.includes('Bu hafta toplam 2 takip sonuçlandırıldı'));
});

test('UX-06.5.1 Scenario J: Previous week comparison uses identical plannedCompletionRate metric', () => {
    const curr = {
        metrics: {
            plannedCount: 4,
            plannedCompletedCount: 3,
            plannedCompletionRate: 75,
            completedInWeekCount: 5,
            overdueCount: 1,
            positiveRate: 80
        }
    };

    const prev = {
        metrics: {
            plannedCount: 4,
            plannedCompletedCount: 2,
            plannedCompletionRate: 50,
            completedInWeekCount: 3,
            overdueCount: 2,
            positiveRate: 60
        }
    };

    const comp = compareGuidanceWeeks(curr, prev);
    assert.equal(comp.hasEnoughData, true);
    assert.equal(comp.diffCompRate, 25);
    assert.equal(comp.diffOverdue, -1);
    assert.equal(comp.diffPositiveRate, 20);
});

test('UX-06.5.2 Scenario A: Current week future closedAt anomaly does not count before today', () => {
    const students = [
        {
            id: 's_anom',
            adSoyad: 'Anomali Öğrenci',
            guidanceRecords: [
                // Planned this week, closedAt set to future date (5 Sep) while today is 2 Sep
                { id: 'r_anom', status: 'completed', followUpDate: '2026-09-01', closedAt: '2026-09-05T10:00:00' }
            ]
        }
    ];

    const weekRange = { monday: '2026-08-31', sunday: '2026-09-06' };
    const analytics = getWeeklyGuidanceAnalytics(students, { weekRange, now: '2026-09-02T10:00:00Z' });

    assert.equal(analytics.metrics.plannedCount, 1);
    assert.equal(analytics.metrics.plannedCompletedCount, 0, 'Future closedAt must not count as completed on 2 Sep');
    assert.equal(analytics.metrics.plannedCompletionRate, 0);
    assert.equal(analytics.metrics.completedInWeekCount, 0, 'Must not count in completedInWeek before 5 Sep');
    assert.equal(analytics.openInWeek.length, 1, 'Still open on 2 Sep snapshot');
});

test('UX-06.5.2 Scenario B: Current week valid closedAt counts on or before today', () => {
    const students = [
        {
            id: 's_val',
            adSoyad: 'Geçerli Öğrenci',
            guidanceRecords: [
                { id: 'r_val', status: 'completed', followUpDate: '2026-09-01', closedAt: '2026-09-02T10:00:00' }
            ]
        }
    ];

    const weekRange = { monday: '2026-08-31', sunday: '2026-09-06' };
    const analytics = getWeeklyGuidanceAnalytics(students, { weekRange, now: '2026-09-02T10:00:00Z' });

    assert.equal(analytics.metrics.plannedCount, 1);
    assert.equal(analytics.metrics.plannedCompletedCount, 1);
    assert.equal(analytics.metrics.plannedCompletionRate, 100);
    assert.equal(analytics.metrics.completedInWeekCount, 1);
    assert.equal(analytics.openInWeek.length, 0);
});

test('UX-06.5.2 Scenario C & D: Future week has null completion rate and zero performance metrics', () => {
    const students = [
        {
            id: 's_fut2',
            adSoyad: 'Gelecek Plan',
            guidanceRecords: [
                { id: 'r_f1', status: 'open', followUpDate: '2026-09-08' },
                { id: 'r_f2', status: 'open', followUpDate: '2026-09-09' }
            ]
        }
    ];

    const futureWeekRange = { monday: '2026-09-07', sunday: '2026-09-13' };
    const analytics = getWeeklyGuidanceAnalytics(students, { weekRange: futureWeekRange, now: '2026-09-02T10:00:00Z' });

    assert.equal(analytics.isFutureWeek, true);
    assert.equal(analytics.metrics.plannedCount, 2);
    assert.equal(analytics.metrics.plannedCompletedCount, 0);
    assert.equal(analytics.metrics.plannedCompletionRate, null, 'Must be null, not 0%');
    assert.equal(analytics.metrics.completedInWeekCount, 0);
    assert.equal(analytics.metrics.overdueCount, 0);
    assert.equal(analytics.metrics.onTimeRate, null);
    assert.equal(analytics.metrics.positiveRate, null);
});

test('UX-06.5.2 Scenario E: Future week narrative produces neutral planning statement', () => {
    const students = [
        {
            id: 's_fut3',
            adSoyad: 'Planlı Öğrenci',
            guidanceRecords: [
                { id: 'r_f1', status: 'open', followUpDate: '2026-09-08' },
                { id: 'r_f2', status: 'open', followUpDate: '2026-09-09' },
                { id: 'r_f3', status: 'open', followUpDate: '2026-09-10' }
            ]
        }
    ];

    const futureWeekRange = { monday: '2026-09-07', sunday: '2026-09-13' };
    const analytics = getWeeklyGuidanceAnalytics(students, { weekRange: futureWeekRange, now: '2026-09-02T10:00:00Z' });

    assert.equal(analytics.narrative, 'Gelecek hafta için 3 rehberlik takibi planlandı.');
});

test('UX-06.5.2 Scenario F: Past week historical snapshot regression preserved', () => {
    const students = [
        {
            id: 's_past_reg',
            adSoyad: 'Geçmiş Regresyon',
            guidanceRecords: [
                // Planned 25 Aug, closed 1 Sep (evaluating 24-30 Aug on 2 Sep)
                { id: 'r_p', status: 'completed', followUpDate: '2026-08-25', closedAt: '2026-09-01T10:00:00' }
            ]
        }
    ];

    const pastWeekRange = { monday: '2026-08-24', sunday: '2026-08-30' };
    const pastAnalytics = getWeeklyGuidanceAnalytics(students, { weekRange: pastWeekRange, now: '2026-09-02T10:00:00Z' });

    assert.equal(pastAnalytics.isPastWeek, true);
    assert.equal(pastAnalytics.snapshotDate, '2026-08-30');
    assert.equal(pastAnalytics.metrics.plannedCount, 1);
    assert.equal(pastAnalytics.metrics.plannedCompletedCount, 0);
    assert.equal(pastAnalytics.metrics.completedInWeekCount, 0);
    assert.equal(pastAnalytics.openInWeek.length, 1);
    assert.equal(pastAnalytics.overdueRecords.length, 1);
    assert.equal(pastAnalytics.overdueRecords[0].daysOverdue, 5);
});

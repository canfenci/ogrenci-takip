/**
 * Pure helper module for weekly guidance analytics, performance, and reporting.
 * Read-only, deterministic, zero side-effects.
 * Supports exact historical snapshot semantics based on reference dates (weekEnd for past, today for current).
 * Enforces strict snapshot boundary: no event after snapshotDate is counted as completed.
 */

import { getLocalIsoDate, getCalendarWeekRange } from './guidance-followup-insights.js';
import { GUIDANCE_RECORD_TYPES, GUIDANCE_RESULT_OPTIONS } from './guidance-records.js';

const TURKISH_MONTH_NAMES_SHORT = [
    'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
    'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'
];

/**
 * Formats a short date string e.g. "31 Ağu – 6 Eyl 2026"
 */
export function formatWeekDateRange(mondayStr, sundayStr) {
    if (!mondayStr || !sundayStr) return '';
    const [mY, mM, mD] = mondayStr.split('-').map(Number);
    const [sY, sM, sD] = sundayStr.split('-').map(Number);

    const mMonth = TURKISH_MONTH_NAMES_SHORT[mM - 1] || '';
    const sMonth = TURKISH_MONTH_NAMES_SHORT[sM - 1] || '';

    if (mMonth === sMonth && mY === sY) {
        return `${mD} – ${sD} ${sMonth} ${sY}`;
    }
    if (mY === sY) {
        return `${mD} ${mMonth} – ${sD} ${sMonth} ${sY}`;
    }
    return `${mD} ${mMonth} ${mY} – ${sD} ${sMonth} ${sY}`;
}

/**
 * Shifts a Monday-Sunday week by an offset in weeks (-1 for previous week, +1 for next week).
 */
export function shiftWeekRange(mondayStr, offsetWeeks = 0) {
    const [y, m, d] = mondayStr.split('-').map(Number);
    const date = new Date(y, m - 1, d + (offsetWeeks * 7), 12, 0, 0);
    return getCalendarWeekRange(date);
}

/**
 * Extracts and normalizes all guidance records from student objects into a flat array.
 */
export function extractAllGuidanceRecords(students = []) {
    const records = [];
    for (const student of students) {
        if (!student || !Array.isArray(student.guidanceRecords)) continue;
        for (const rec of student.guidanceRecords) {
            if (!rec || !rec.id) continue;
            records.push({
                studentId: student.id,
                studentName: student.adSoyad || 'İsimsiz Öğrenci',
                sinif: student.sinif || '',
                record: rec
            });
        }
    }
    return records;
}

/**
 * Gets weekly guidance analytics and metrics for a specific Monday-Sunday week.
 * Reconstructs accurate historical snapshot at weekEnd for past weeks, or at today for current week.
 * Handles future week with forward planning semantics (no premature performance metrics).
 */
export function getWeeklyGuidanceAnalytics(students = [], options = {}) {
    const today = options.now ? new Date(options.now) : new Date();
    const todayStr = getLocalIsoDate(today);

    // Selected week range (defaults to current week)
    let weekRange = options.weekRange;
    if (!weekRange || !weekRange.monday || !weekRange.sunday) {
        weekRange = getCalendarWeekRange(today);
    }

    const { monday: weekStart, sunday: weekEnd } = weekRange;
    const isCurrentWeek = (todayStr >= weekStart && todayStr <= weekEnd);
    const isPastWeek = todayStr > weekEnd;
    const isFutureWeek = todayStr < weekStart;

    // Snapshot evaluation reference date
    // Past week evaluates as-of weekEnd; current week as-of todayStr; future week has no performance snapshot
    const snapshotDate = isPastWeek ? weekEnd : (isCurrentWeek ? todayStr : null);

    const allItems = extractAllGuidanceRecords(students);

    // 1. Planned Cohort in Selected Week: followUpDate falls between weekStart and weekEnd
    const plannedRecords = allItems.filter(item => {
        const fDate = item.record.followUpDate ? item.record.followUpDate.slice(0, 10) : null;
        return fDate && fDate >= weekStart && fDate <= weekEnd;
    });

    // Planned cohort items that were completed on or before snapshotDate
    const plannedCompletedRecords = isFutureWeek ? [] : plannedRecords.filter(item => {
        const cDate = item.record.closedAt ? item.record.closedAt.slice(0, 10) : null;
        return item.record.status === 'completed' && cDate && cDate <= snapshotDate;
    });

    const plannedCount = plannedRecords.length;
    const plannedCompletedCount = plannedCompletedRecords.length;
    const plannedCompletionRate = isFutureWeek ? null : (plannedCount > 0 ? Math.round((plannedCompletedCount / plannedCount) * 100) : null);

    // 2. Completed in Selected Week (Bu Hafta Sonuçlandırılan / Tamamlanan):
    // closedAt falls between weekStart and weekEnd AND on/before snapshotDate
    const completedInWeek = isFutureWeek ? [] : allItems.filter(item => {
        if (item.record.status !== 'completed') return false;
        const cDate = item.record.closedAt ? item.record.closedAt.slice(0, 10) : null;
        return cDate && cDate >= weekStart && cDate <= weekEnd && cDate <= snapshotDate;
    });

    // 3. On-time vs Late completed within completedInWeek
    const onTimeCompleted = [];
    const lateCompleted = [];
    const completedWithoutFollowUpDate = [];

    if (!isFutureWeek) {
        for (const item of completedInWeek) {
            const cDate = item.record.closedAt ? item.record.closedAt.slice(0, 10) : null;
            const fDate = item.record.followUpDate ? item.record.followUpDate.slice(0, 10) : null;

            if (!fDate) {
                completedWithoutFollowUpDate.push(item);
            } else if (cDate <= fDate) {
                onTimeCompleted.push(item);
            } else {
                // Calculate how many days late relative to followUpDate
                const cTime = new Date(cDate + 'T12:00:00').getTime();
                const fTime = new Date(fDate + 'T12:00:00').getTime();
                const daysLate = Math.max(1, Math.round((cTime - fTime) / (1000 * 60 * 60 * 24)));
                lateCompleted.push({ ...item, daysLate });
            }
        }
    }

    const completedWithDateCount = onTimeCompleted.length + lateCompleted.length;
    const onTimeRate = (!isFutureWeek && completedWithDateCount > 0) ? Math.round((onTimeCompleted.length / completedWithDateCount) * 100) : null;

    // 4. Historical Open / Overdue / Carried Over records at snapshotDate
    // A record was open at snapshotDate if:
    // - Planned on or before weekEnd (for past week) or on/before weekEnd (for current week)
    // - AND (not closed OR closedAt > snapshotDate)
    const openInWeek = isFutureWeek ? plannedRecords.filter(item => item.record.status === 'open') : allItems.filter(item => {
        const fDate = item.record.followUpDate ? item.record.followUpDate.slice(0, 10) : null;
        if (!fDate) return false;
        if (fDate > weekEnd) return false;

        const cDate = (item.record.status === 'completed' && item.record.closedAt) ? item.record.closedAt.slice(0, 10) : null;
        const wasOpenAtSnapshot = !cDate || cDate > snapshotDate;
        return wasOpenAtSnapshot;
    });

    // Overdue items at snapshotDate (followUpDate < snapshotDate)
    const overdueRecords = isFutureWeek ? [] : openInWeek.filter(item => {
        const fDate = item.record.followUpDate.slice(0, 10);
        return fDate < snapshotDate;
    }).map(item => {
        const fDate = item.record.followUpDate.slice(0, 10);
        const refTime = new Date(snapshotDate + 'T12:00:00').getTime();
        const fTime = new Date(fDate + 'T12:00:00').getTime();
        const daysOverdue = Math.max(1, Math.round((refTime - fTime) / (1000 * 60 * 60 * 24)));
        return { ...item, daysOverdue };
    });

    // Today open items (only relevant for current week)
    const todayOpenRecords = isCurrentWeek ? openInWeek.filter(item => {
        const fDate = item.record.followUpDate.slice(0, 10);
        return fDate === todayStr;
    }) : [];

    // Future open items within this week (snapshotDate < followUpDate <= weekEnd)
    const futureOpenThisWeek = isFutureWeek ? plannedRecords.filter(item => item.record.status === 'open') : openInWeek.filter(item => {
        const fDate = item.record.followUpDate.slice(0, 10);
        return fDate > snapshotDate && fDate <= weekEnd;
    });

    // 5. Outcome distribution of completed records in this week
    const outcomes = {
        positive: 0,
        neutral: 0,
        negative: 0,
        pending: 0
    };

    if (!isFutureWeek) {
        for (const item of completedInWeek) {
            const res = item.record.result;
            if (res === 'positive') outcomes.positive++;
            else if (res === 'neutral') outcomes.neutral++;
            else if (res === 'negative') outcomes.negative++;
            else if (res === 'pending') outcomes.pending++;
        }
    }

    // Pending count among open records
    const pendingOpenCount = openInWeek.filter(item => item.record.result === 'pending').length;

    // Measurable completed count (positive + neutral + negative)
    const measurableCount = outcomes.positive + outcomes.neutral + outcomes.negative;
    const positiveRate = (!isFutureWeek && measurableCount > 0) ? Math.round((outcomes.positive / measurableCount) * 100) : null;

    // 6. Category / Type distribution for this week's planned records
    const categories = {
        academic: 0,
        discipline: 0,
        performance: 0,
        general: 0
    };

    for (const item of plannedRecords) {
        const t = item.record.type || 'academic';
        if (categories[t] !== undefined) {
            categories[t]++;
        } else {
            categories.general++;
        }
    }

    let dominantCategory = null;
    let maxCatCount = 0;
    for (const [catKey, count] of Object.entries(categories)) {
        if (count > maxCatCount) {
            maxCatCount = count;
            dominantCategory = {
                key: catKey,
                label: GUIDANCE_RECORD_TYPES[catKey] || 'Genel Takip',
                count
            };
        }
    }

    // 7. Per-student weekly summaries with exact cohort metrics
    const studentMap = new Map();

    for (const item of plannedRecords) {
        if (!studentMap.has(item.studentId)) {
            studentMap.set(item.studentId, {
                studentId: item.studentId,
                studentName: item.studentName,
                sinif: item.sinif,
                plannedCount: 0,
                plannedCompletedCount: 0,
                completedInWeekCount: 0,
                completedCount: 0,
                onTimeCount: 0,
                openCount: 0,
                overdueCount: 0,
                results: []
            });
        }
        const sData = studentMap.get(item.studentId);
        sData.plannedCount++;
        const cDate = item.record.closedAt ? item.record.closedAt.slice(0, 10) : null;
        if (!isFutureWeek && item.record.status === 'completed' && cDate && cDate <= snapshotDate) {
            sData.plannedCompletedCount++;
        }
    }

    for (const item of completedInWeek) {
        if (!studentMap.has(item.studentId)) {
            studentMap.set(item.studentId, {
                studentId: item.studentId,
                studentName: item.studentName,
                sinif: item.sinif,
                plannedCount: 0,
                plannedCompletedCount: 0,
                completedInWeekCount: 0,
                completedCount: 0,
                onTimeCount: 0,
                openCount: 0,
                overdueCount: 0,
                results: []
            });
        }
        const sData = studentMap.get(item.studentId);
        sData.completedInWeekCount++;
        sData.completedCount++;
        if (item.record.result && item.record.result !== 'pending') {
            sData.results.push(GUIDANCE_RESULT_OPTIONS[item.record.result] || item.record.result);
        }
    }

    for (const item of openInWeek) {
        if (!studentMap.has(item.studentId)) {
            studentMap.set(item.studentId, {
                studentId: item.studentId,
                studentName: item.studentName,
                sinif: item.sinif,
                plannedCount: 0,
                plannedCompletedCount: 0,
                completedInWeekCount: 0,
                completedCount: 0,
                onTimeCount: 0,
                openCount: 0,
                overdueCount: 0,
                results: []
            });
        }
        const sData = studentMap.get(item.studentId);
        sData.openCount++;
        if (!isFutureWeek && item.record.followUpDate && item.record.followUpDate.slice(0, 10) < snapshotDate) {
            sData.overdueCount++;
        }
    }

    const studentSummaries = Array.from(studentMap.values()).sort((a, b) => {
        if (b.overdueCount !== a.overdueCount) return b.overdueCount - a.overdueCount;
        if (b.openCount !== a.openCount) return b.openCount - a.openCount;
        return b.plannedCount - a.plannedCount;
    });

    // 8. Deterministic weekly narrative summary with strictly separated cohort metrics
    let narrative = '';
    if (isFutureWeek) {
        if (plannedCount > 0) {
            narrative = `Gelecek hafta için ${plannedCount} rehberlik takibi planlandı.`;
        } else {
            narrative = 'Gelecek hafta için planlanmış rehberlik takibi bulunmuyor.';
        }
    } else if (plannedCount === 0 && completedInWeek.length === 0 && openInWeek.length === 0) {
        narrative = 'Bu hafta için planlanmış veya tamamlanmış rehberlik takibi bulunmuyor.';
    } else {
        const parts = [];
        if (plannedCount > 0) {
            parts.push(`${plannedCount} planlı takipten ${plannedCompletedCount}'i tamamlandı.`);
        }

        if (completedInWeek.length > 0 && completedInWeek.length !== plannedCompletedCount) {
            parts.push(`Bu hafta toplam ${completedInWeek.length} takip sonuçlandırıldı.`);
        } else if (plannedCount === 0 && completedInWeek.length > 0) {
            parts.push(`Bu hafta ${completedInWeek.length} rehberlik takibi tamamlandı.`);
        }

        if (onTimeCompleted.length > 0) {
            parts.push(`${onTimeCompleted.length} takip zamanında sonuçlandı.`);
        }

        if (overdueRecords.length > 0) {
            parts.push(`${overdueRecords.length} açık takip gecikmede.`);
        } else if (openInWeek.length > 0) {
            parts.push(`${openInWeek.length} açık takip devam ediyor.`);
        }

        if (outcomes.positive > 0) {
            parts.push(`${outcomes.positive} takipte olumlu gelişme kaydedildi.`);
        }

        narrative = parts.join(' ');
    }

    return {
        weekRange,
        snapshotDate,
        isCurrentWeek,
        isPastWeek,
        isFutureWeek,
        metrics: {
            plannedCount,
            plannedCompletedCount,
            plannedCompletionRate,
            completedCount: completedInWeek.length,
            completedInWeekCount: completedInWeek.length,
            onTimeCount: onTimeCompleted.length,
            lateCount: lateCompleted.length,
            openCount: openInWeek.length,
            overdueCount: overdueRecords.length,
            todayOpenCount: todayOpenRecords.length,
            futureOpenCount: futureOpenThisWeek.length,
            positiveOutcomeCount: outcomes.positive,
            onTimeRate,
            positiveRate
        },
        outcomes,
        categories,
        dominantCategory,
        plannedRecords,
        plannedCompletedRecords,
        completedInWeek,
        onTimeCompleted,
        lateCompleted,
        openInWeek,
        overdueRecords,
        todayOpenRecords,
        futureOpenThisWeek,
        pendingOpenCount,
        studentSummaries,
        narrative
    };
}

/**
 * Compares current selected week analytics with previous week analytics using identical cohort metrics.
 */
export function compareGuidanceWeeks(currentAnalytics, previousAnalytics) {
    if (!currentAnalytics || !previousAnalytics) {
        return { hasEnoughData: false, message: 'Karşılaştırma için önceki haftada yeterli kayıt yok.' };
    }

    const prevPlanned = previousAnalytics.metrics.plannedCount || 0;
    const prevCompletedInWeek = previousAnalytics.metrics.completedInWeekCount || previousAnalytics.metrics.completedCount || 0;

    if (prevPlanned === 0 && prevCompletedInWeek === 0) {
        return { hasEnoughData: false, message: 'Karşılaştırma için önceki haftada yeterli kayıt yok.' };
    }

    const currCompRate = (currentAnalytics.metrics.plannedCompletionRate !== undefined && currentAnalytics.metrics.plannedCompletionRate !== null)
        ? currentAnalytics.metrics.plannedCompletionRate
        : currentAnalytics.metrics.completionRate;

    const prevCompRate = (previousAnalytics.metrics.plannedCompletionRate !== undefined && previousAnalytics.metrics.plannedCompletionRate !== null)
        ? previousAnalytics.metrics.plannedCompletionRate
        : previousAnalytics.metrics.completionRate;

    const diffCompRate = (currCompRate !== null && prevCompRate !== null && currCompRate !== undefined && prevCompRate !== undefined)
        ? (currCompRate - prevCompRate)
        : null;

    const currOverdue = currentAnalytics.metrics.overdueCount || 0;
    const prevOverdue = previousAnalytics.metrics.overdueCount || 0;
    const diffOverdue = currOverdue - prevOverdue;

    const currPositiveRate = currentAnalytics.metrics.positiveRate;
    const prevPositiveRate = previousAnalytics.metrics.positiveRate;
    const diffPositiveRate = (currPositiveRate !== null && prevPositiveRate !== null && currPositiveRate !== undefined && prevPositiveRate !== undefined)
        ? (currPositiveRate - prevPositiveRate)
        : null;

    return {
        hasEnoughData: true,
        diffCompRate,
        diffOverdue,
        diffPositiveRate,
        prevMetrics: previousAnalytics.metrics,
        currMetrics: currentAnalytics.metrics
    };
}

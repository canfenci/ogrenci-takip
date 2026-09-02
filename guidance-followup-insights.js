/**
 * Guidance Follow-Up & Action Calendar Insights Helper Module
 * Provides deterministic date math, classification, and metrics for student guidance follow-ups.
 */

import { getStudentGuidanceRecords } from './guidance-records.js';

/**
 * Normalizes a Date or string to a local YYYY-MM-DD string without UTC drift.
 */
export function getLocalIsoDate(d = new Date()) {
    const dateObj = (d instanceof Date && !isNaN(d.getTime())) ? d : new Date(d);
    if (isNaN(dateObj.getTime())) return '';
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Calculates Monday to Sunday range for the calendar week containing reference date.
 */
export function getCalendarWeekRange(refDate = new Date()) {
    const dateObj = (refDate instanceof Date && !isNaN(refDate.getTime())) ? new Date(refDate) : new Date(refDate);
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    // In Monday-first week: Monday is offset (dayOfWeek === 0 ? -6 : 1 - dayOfWeek)
    const mondayOffset = (dayOfWeek === 0) ? -6 : 1 - dayOfWeek;
    const mondayDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate() + mondayOffset);
    const sundayDate = new Date(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate() + 6);

    return {
        monday: getLocalIsoDate(mondayDate),
        sunday: getLocalIsoDate(sundayDate),
        mondayDate,
        sundayDate
    };
}

/**
 * Calculates integer days overdue between today and a past follow-up date.
 */
export function getDaysOverdue(followUpDateStr, todayStr = getLocalIsoDate()) {
    if (!followUpDateStr || !todayStr || followUpDateStr >= todayStr) return 0;
    const [y1, m1, d1] = followUpDateStr.split('-').map(Number);
    const [y2, m2, d2] = todayStr.split('-').map(Number);
    const dt1 = new Date(y1, m1 - 1, d1);
    const dt2 = new Date(y2, m2 - 1, d2);
    const diffMs = dt2.getTime() - dt1.getTime();
    return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Formats Turkish short date (e.g., "3 Eylül Perşembe" or "9 Eyl").
 */
export function formatFollowUpDisplayDate(dateStr, includeWeekday = false) {
    if (!dateStr || typeof dateStr !== 'string') return '';
    const parts = dateStr.slice(0, 10).split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts.map(Number);
    const dt = new Date(y, m - 1, d);
    if (isNaN(dt.getTime())) return dateStr;

    const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const weekdays = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

    const dayNum = d;
    const monthName = months[m - 1] || '';
    if (includeWeekday) {
        const weekdayName = weekdays[dt.getDay()] || '';
        return `${dayNum} ${monthName}, ${weekdayName}`;
    }
    return `${dayNum} ${monthName}`;
}

/**
 * Classifies all open guidance records into operational follow-up buckets.
 */
export function classifyGuidanceFollowUps(students = [], options = {}) {
    const now = options.now ? ((options.now instanceof Date) ? options.now : new Date(options.now)) : new Date();
    const todayStr = getLocalIsoDate(now);
    const weekRange = getCalendarWeekRange(now);
    const sundayStr = weekRange.sunday;

    const categoryFilter = options.category && options.category !== 'all' ? options.category : null;
    const studentFilter = options.studentId && options.studentId !== 'all' ? options.studentId : null;
    const normalizedQuery = options.query ? String(options.query).trim().toLocaleLowerCase('tr-TR') : '';

    const overdue = [];
    const today = [];
    const thisWeek = [];
    const upcoming = [];
    const undated = [];

    let totalOpenCount = 0;

    (students || []).forEach(student => {
        if (!student) return;
        if (studentFilter && student.id !== studentFilter) return;

        const records = getStudentGuidanceRecords(student);
        records.forEach(rec => {
            // Only consider open records (completed records are excluded)
            if (rec.status !== 'open') return;

            totalOpenCount++;

            // Apply category filter
            if (categoryFilter && rec.type !== categoryFilter) return;

            // Apply query filter (student name, issue, action, note)
            if (normalizedQuery) {
                const sName = (student.adSoyad || '').toLocaleLowerCase('tr-TR');
                const sIssue = (rec.issue || '').toLocaleLowerCase('tr-TR');
                const sAction = (rec.action || '').toLocaleLowerCase('tr-TR');
                const sNote = (rec.note || '').toLocaleLowerCase('tr-TR');
                const matches = sName.includes(normalizedQuery) ||
                                sIssue.includes(normalizedQuery) ||
                                sAction.includes(normalizedQuery) ||
                                sNote.includes(normalizedQuery);
                if (!matches) return;
            }

            const item = {
                studentId: student.id,
                studentName: student.adSoyad,
                sinif: student.sinif,
                okul: student.okul,
                record: rec,
                daysOverdue: 0
            };

            const fDate = rec.followUpDate ? rec.followUpDate.slice(0, 10) : null;

            if (!fDate) {
                undated.push(item);
            } else if (fDate < todayStr) {
                item.daysOverdue = getDaysOverdue(fDate, todayStr);
                overdue.push(item);
            } else if (fDate === todayStr) {
                today.push(item);
            } else if (fDate <= sundayStr) {
                thisWeek.push(item);
            } else {
                upcoming.push(item);
            }
        });
    });

    // Sort overdue: oldest follow-up first (most overdue first)
    overdue.sort((a, b) => String(a.record.followUpDate).localeCompare(String(b.record.followUpDate)));

    // Sort today: newest created first
    today.sort((a, b) => String(b.record.createdAt).localeCompare(String(a.record.createdAt)));

    // Sort thisWeek: chronological ascending
    thisWeek.sort((a, b) => String(a.record.followUpDate).localeCompare(String(b.record.followUpDate)));

    // Sort upcoming: chronological ascending, limit to 15 items
    upcoming.sort((a, b) => String(a.record.followUpDate).localeCompare(String(b.record.followUpDate)));
    const limitedUpcoming = upcoming.slice(0, 15);

    // Sort undated: newest created first
    undated.sort((a, b) => String(b.record.createdAt).localeCompare(String(a.record.createdAt)));

    return {
        todayStr,
        weekRange,
        overdue,
        today,
        thisWeek,
        upcoming: limitedUpcoming,
        undated,
        totalOpenCount,
        dueCount: overdue.length + today.length
    };
}

/**
 * Calculates unfiltered top-level follow-up operational metrics.
 */
export function getGuidanceFollowUpMetrics(students = [], now = new Date()) {
    const classification = classifyGuidanceFollowUps(students, { now });
    return {
        todayCount: classification.today.length,
        overdueCount: classification.overdue.length,
        thisWeekCount: classification.thisWeek.length,
        upcomingCount: classification.upcoming.length,
        undatedCount: classification.undated.length,
        totalOpenCount: classification.totalOpenCount,
        dueCount: classification.dueCount,
        isAllClear: (classification.today.length === 0 && classification.overdue.length === 0)
    };
}

// Bind to window for global access
if (typeof window !== 'undefined') {
    window.getLocalIsoDate = getLocalIsoDate;
    window.getCalendarWeekRange = getCalendarWeekRange;
    window.getDaysOverdue = getDaysOverdue;
    window.formatFollowUpDisplayDate = formatFollowUpDisplayDate;
    window.classifyGuidanceFollowUps = classifyGuidanceFollowUps;
    window.getGuidanceFollowUpMetrics = getGuidanceFollowUpMetrics;
}

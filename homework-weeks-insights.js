// ==================== HOMEWORK WEEKS & COMBINED FILTER INSIGHTS ====================
// Pure calculations for weekly homework scheduling and multi-axis filtering.
// Does NOT modify existing homework data model.

import { getHomeworkDueState } from './homework-dashboard-insights.js';

export const ANCHOR_START_DATE = '2026-08-10'; // 1. Hafta Pazartesi (10 Ağustos 2026)

const TURKISH_MONTHS_SHORT = [
    'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
    'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'
];

const TURKISH_MONTHS_FULL = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

function pad2(n) {
    return String(n).padStart(2, '0');
}

export function toIsoDateString(d) {
    if (!d) return '';
    if (typeof d === 'string') {
        const match = d.match(/^\d{4}-\d{2}-\d{2}/);
        if (match) return match[0];
    }
    const dateObj = d instanceof Date ? d : new Date(d);
    if (isNaN(dateObj.getTime())) return '';
    return `${dateObj.getFullYear()}-${pad2(dateObj.getMonth() + 1)}-${pad2(dateObj.getDate())}`;
}

export function parseIsoDate(dateStr) {
    if (!dateStr) return null;
    const cleanStr = String(dateStr).trim().slice(0, 10);
    const parts = cleanStr.split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day, 12, 0, 0);
    return isNaN(date.getTime()) ? null : date;
}

export function getMondayForDate(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = (day + 6) % 7; // Monday = 0, Tuesday = 1, ..., Sunday = 6
    d.setDate(d.getDate() - diffToMonday);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function formatWeekDateRange(mondayDate, sundayDate, format = 'short') {
    const months = format === 'full' ? TURKISH_MONTHS_FULL : TURKISH_MONTHS_SHORT;
    const mDay = mondayDate.getDate();
    const mMonth = months[mondayDate.getMonth()];
    const mYear = mondayDate.getFullYear();

    const sDay = sundayDate.getDate();
    const sMonth = months[sundayDate.getMonth()];
    const sYear = sundayDate.getFullYear();

    if (mondayDate.getMonth() === sundayDate.getMonth() && mYear === sYear) {
        return `${mDay}–${sDay} ${mMonth}`;
    }
    if (mYear === sYear) {
        return `${mDay} ${mMonth} – ${sDay} ${sMonth}`;
    }
    return `${mDay} ${mMonth} ${mYear} – ${sDay} ${sMonth} ${sYear}`;
}

export function getWeekInfoByNumber(weekNumber, anchorDateStr = ANCHOR_START_DATE) {
    const num = Math.max(1, parseInt(weekNumber, 10) || 1);
    const anchorMonday = parseIsoDate(anchorDateStr);
    if (!anchorMonday) return null;

    const monday = new Date(anchorMonday);
    monday.setDate(monday.getDate() + (num - 1) * 7);

    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);

    const mondayStr = toIsoDateString(monday);
    const sundayStr = toIsoDateString(sunday);
    const dateRangeLabel = formatWeekDateRange(monday, sunday, 'full');
    const dateRangeShort = formatWeekDateRange(monday, sunday, 'short');

    return {
        weekNumber: num,
        isPreStart: false,
        mondayStr,
        sundayStr,
        dateRangeLabel,
        dateRangeShort,
        fullLabel: `${num}. Hafta · ${dateRangeLabel}`,
        compactLabel: `${num}. Hafta (${dateRangeShort})`
    };
}

export function getWeekInfoForDate(dateInput, anchorDateStr = ANCHOR_START_DATE) {
    const date = typeof dateInput === 'string' ? parseIsoDate(dateInput) : dateInput;
    if (!date) return null;

    const anchorMonday = parseIsoDate(anchorDateStr);
    if (!anchorMonday) return null;

    const monday = getMondayForDate(date);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);

    const mondayStr = toIsoDateString(monday);
    const sundayStr = toIsoDateString(sunday);

    const diffDays = Math.round((monday.getTime() - anchorMonday.getTime()) / 86400000);
    const weekIndex = Math.floor(diffDays / 7) + 1;

    if (weekIndex < 1) {
        return {
            weekNumber: 0,
            isPreStart: true,
            mondayStr,
            sundayStr,
            dateRangeLabel: '10 Ağustos 2026 Öncesi',
            dateRangeShort: 'Önceki',
            fullLabel: 'Önceki Kayıtlar (Müfredat Öncesi)',
            compactLabel: 'Önceki Kayıtlar'
        };
    }

    const dateRangeLabel = formatWeekDateRange(monday, sunday, 'full');
    const dateRangeShort = formatWeekDateRange(monday, sunday, 'short');

    return {
        weekNumber: weekIndex,
        isPreStart: false,
        mondayStr,
        sundayStr,
        dateRangeLabel,
        dateRangeShort,
        fullLabel: `${weekIndex}. Hafta · ${dateRangeLabel}`,
        compactLabel: `${weekIndex}. Hafta (${dateRangeShort})`
    };
}

export function getCurrentWeekNumber(currentDate = new Date(), anchorDateStr = ANCHOR_START_DATE) {
    const info = getWeekInfoForDate(currentDate, anchorDateStr);
    return info && info.weekNumber > 0 ? info.weekNumber : 1;
}

export function generateWeekList(totalWeeks = 35, anchorDateStr = ANCHOR_START_DATE) {
    const list = [];
    for (let i = 1; i <= totalWeeks; i++) {
        list.push(getWeekInfoByNumber(i, anchorDateStr));
    }
    return list;
}

export function resolveHomeworkWeek(homework, anchorDateStr = ANCHOR_START_DATE) {
    if (!homework) return null;
    const dateStr = homework.baslamaTarihi || homework.tarih || homework.bitisTarihi || homework.teslimTarihi || '';
    return getWeekInfoForDate(dateStr, anchorDateStr);
}

/**
 * Pure filter function implementing the 2-axis combined matrix:
 * 
 * Matrix:
 * 1. Hafta Var, Öğrenci Yok -> Seçili haftadaki tüm öğrencilerin ödevleri
 * 2. Hafta Yok, Öğrenci Var -> Seçili öğrencinin tüm tarihsel ödevleri
 * 3. Hafta Var, Öğrenci Var -> Seçili öğrencinin seçili haftadaki ödevleri
 * 4. Hafta Yok, Öğrenci Yok -> Güncel haftaya otomatik dön (tüm öğrenciler)
 */
export function filterHomeworksCombined({
    students = [],
    getHomeworks = (s => s.odevler || []),
    week = null,
    studentId = null,
    query = '',
    status = 'all',
    currentDate = new Date(),
    anchorDateStr = ANCHOR_START_DATE
} = {}) {
    const currentWeekNum = getCurrentWeekNumber(currentDate, anchorDateStr);
    const todayStr = toIsoDateString(currentDate);

    // Resolve active student
    const activeStudentId = String(studentId || '').trim();
    const activeStudent = activeStudentId ? students.find(s => s.id === activeStudentId) || null : null;

    // Resolve active week number
    let activeWeekNum = null;
    let viewMode = 'week_all_students';

    if (week !== null && week !== undefined && week !== '' && String(week).toLowerCase() !== 'all') {
        activeWeekNum = parseInt(week, 10) || currentWeekNum;
        viewMode = activeStudent ? 'week_single_student' : 'week_all_students';
    } else {
        if (activeStudent) {
            // Student selected, week explicitly unselected -> All history for this student
            activeWeekNum = null;
            viewMode = 'student_all_history';
        } else {
            // Neither week nor student selected -> Fall back to current week
            activeWeekNum = currentWeekNum;
            viewMode = 'week_all_students';
        }
    }

    const activeWeekInfo = activeWeekNum ? getWeekInfoByNumber(activeWeekNum, anchorDateStr) : null;

    // Build raw list of all records mapped with week info and due state
    const allRecords = students.flatMap(student => {
        return (getHomeworks(student) || []).map(homework => {
            const weekInfo = resolveHomeworkWeek(homework, anchorDateStr);
            const due = getHomeworkDueState(homework, todayStr);
            return {
                homework,
                student,
                weekInfo,
                due
            };
        });
    });

    // Apply primary 2-axis filter (Week & Student)
    let filtered = allRecords.filter(item => {
        if (activeStudent) {
            if (item.student.id !== activeStudent.id) return false;
        }
        if (activeWeekNum !== null) {
            if (!item.weekInfo || item.weekInfo.weekNumber !== activeWeekNum) return false;
        }
        return true;
    });

    // Calculate subset metrics BEFORE search & status filter
    const totalCount = filtered.length;
    const completedCount = filtered.filter(i => i.due.key === 'completed').length;
    const overdueCount = filtered.filter(i => i.due.key === 'overdue').length;
    const dueTodayCount = filtered.filter(i => i.due.key === 'today').length;
    const upcomingCount = filtered.filter(i => i.due.key === 'upcoming').length;
    const activeCount = filtered.filter(i => i.due.key !== 'completed').length;
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : null;

    const metrics = {
        total: totalCount,
        completed: completedCount,
        active: activeCount,
        overdue: overdueCount,
        dueToday: dueTodayCount,
        upcoming: upcomingCount,
        completionRate
    };

    // Apply query search if any
    const normalizedQuery = String(query || '').trim().toLocaleLowerCase('tr-TR');
    if (normalizedQuery) {
        filtered = filtered.filter(item => {
            const searchable = [
                item.student.adSoyad,
                item.homework.konu,
                item.homework.calismaDetayi,
                item.homework.yayin,
                item.homework.tur,
                item.weekInfo ? item.weekInfo.compactLabel : ''
            ].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR');
            return searchable.includes(normalizedQuery);
        });
    }

    // Apply status filter if any
    if (status && status !== 'all') {
        filtered = filtered.filter(item => {
            if (status === 'active') {
                return ['active', 'today', 'upcoming', 'overdue'].includes(item.due.key);
            }
            return item.due.key === status;
        });
    }

    // Sort records:
    // In student history mode: sort by week desc, then due date
    // In week mode: sort by status priority (overdue first), then student name
    filtered.sort((a, b) => {
        if (viewMode === 'student_all_history') {
            const aWeek = a.weekInfo ? a.weekInfo.weekNumber : -1;
            const bWeek = b.weekInfo ? b.weekInfo.weekNumber : -1;
            if (bWeek !== aWeek) return bWeek - aWeek;
            return String(b.homework.bitisTarihi || '').localeCompare(String(a.homework.bitisTarihi || ''));
        }
        const statusWeight = { overdue: 0, today: 1, upcoming: 2, active: 3, completed: 4 };
        const weightDiff = (statusWeight[a.due.key] ?? 5) - (statusWeight[b.due.key] ?? 5);
        if (weightDiff !== 0) return weightDiff;
        return a.student.adSoyad.localeCompare(b.student.adSoyad, 'tr');
    });

    // Dynamic Title & Subtitle based on Rule 16
    let title = '';
    let subtitle = '';

    if (viewMode === 'week_all_students') {
        title = `${activeWeekInfo.weekNumber}. Hafta`;
        subtitle = `${activeWeekInfo.dateRangeLabel} · Tüm Öğrenciler`;
    } else if (viewMode === 'student_all_history') {
        title = activeStudent.adSoyad;
        subtitle = `Tüm Ödev Geçmişi (${activeStudent.sinif ? `${activeStudent.sinif}. Sınıf` : 'Sınıf belirtilmedi'})`;
    } else { // week_single_student
        title = activeStudent.adSoyad;
        subtitle = `${activeWeekInfo.weekNumber}. Hafta · ${activeWeekInfo.dateRangeLabel}`;
    }

    return {
        records: filtered,
        metrics,
        viewMode,
        activeWeekNum,
        activeWeekInfo,
        activeStudent,
        currentWeekNum,
        title,
        subtitle
    };
}

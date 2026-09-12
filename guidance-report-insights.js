/**
 * Pure helper module for Student Guidance Progress Report Data Builder.
 * Read-only, deterministic, zero side-effects.
 * Reuses existing insight engines and normalizers.
 */

import {
    buildGuidancePriority,
    getRepeatedWeakTopics,
    getDominantErrorType,
    getExamTrendInsight,
    getHomeworkDisciplineInsight,
    getRecommendedIntervention,
    formatActivityDate,
    getStudentInitials
} from './guidance-center-insights.js';

import {
    buildStudentGuidanceDetail,
    getErrorReasonsDistribution,
    getStudentActivityTimeline
} from './guidance-student-insights.js';

import {
    getStudentGuidanceRecords,
    isGuidanceRecordDue,
    GUIDANCE_RECORD_TYPES,
    GUIDANCE_RESULT_OPTIONS
} from './guidance-records.js';

import {
    normalizeHomeworkErrorAnalysis,
    normalizeHataNedeniLabel,
    normalizeHataNedeniKey
} from './homework-error-topics.js';

import { getLocalIsoDate, formatFollowUpDisplayDate } from './guidance-followup-insights.js';
import { formatWeekDateRange } from './guidance-weekly-insights.js';
import { buildMonthlyCoachingSummary } from './coaching-plan-monthly-summary.js';

const TURKISH_MONTH_NAMES_SHORT = [
    'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
    'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'
];

/**
 * Cleanly normalizes student name and date to produce a safe PDF filename.
 * Example: canfenci-rehberlik-yagmur-aydin-2026-09-02.pdf
 */
export function normalizeGuidanceReportFilename({ studentName = 'Ogrenci', date = '' }) {
    const trMap = {
        'ç': 'c', 'Ç': 'c',
        'ğ': 'g', 'Ğ': 'g',
        'ı': 'i', 'I': 'i', 'İ': 'i',
        'ö': 'o', 'Ö': 'o',
        'ş': 's', 'Ş': 's',
        'ü': 'u', 'Ü': 'u'
    };

    const clean = str => (str || '')
        .toLowerCase()
        .replace(/[çÇğĞıIİöÖşŞüÜ]/g, m => trMap[m] || m)
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    const safeName = clean(studentName) || 'ogrenci';
    const safeDate = (date ? clean(date) : getLocalIsoDate(new Date()));

    return `canfenci-rehberlik-${safeName}-${safeDate}.pdf`;
}

export function formatReportDisplayDate(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const mName = TURKISH_MONTH_NAMES_SHORT[m - 1] || '';
    return `${d} ${mName} ${y}`;
}

/**
 * Calculates start and end dates for a period option.
 */
export function calculateReportPeriodRange(periodOption = '4weeks', now = new Date()) {
    const nowTime = now.getTime();
    const endIso = getLocalIsoDate(now);

    let startIso;
    if (periodOption === '4weeks') {
        const startDate = new Date(nowTime - (28 * 24 * 60 * 60 * 1000));
        startIso = getLocalIsoDate(startDate);
    } else if (periodOption === '8weeks') {
        const startDate = new Date(nowTime - (56 * 24 * 60 * 60 * 1000));
        startIso = getLocalIsoDate(startDate);
    } else if (periodOption === 'term') {
        // Current semester / academic term start: Aug 1 of current school cycle
        const nowYear = now.getFullYear();
        startIso = `${nowYear}-08-01`;
        if (endIso < startIso) {
            startIso = `${nowYear - 1}-08-01`;
        }
    } else {
        // all
        startIso = '2000-01-01';
    }

    const [sY, sM, sD] = startIso.split('-').map(Number);
    const [eY, eM, eD] = endIso.split('-').map(Number);
    const sMonth = TURKISH_MONTH_NAMES_SHORT[sM - 1] || '';
    const eMonth = TURKISH_MONTH_NAMES_SHORT[eM - 1] || '';

    let periodLabel = `${sD} ${sMonth} ${sY} – ${eD} ${eMonth} ${eY}`;
    if (sY === eY) {
        periodLabel = `${sD} ${sMonth} – ${eD} ${eMonth} ${eY}`;
    }
    if (periodOption === 'all') {
        periodLabel = 'Tüm Geçmiş';
    }

    return {
        option: periodOption,
        startDate: startIso,
        endDate: endIso,
        label: periodLabel
    };
}

/**
 * Sanitizes and normalizes monthly coaching summary into a parent-safe data contract.
 * Pure, deterministic, zero side-effects.
 * Excludes all internal notes, priority scores, teacher internal fields, and raw diagnostic labels.
 */
export function buildParentSafeCoachingSummary(rawSummary) {
    if (!rawSummary || typeof rawSummary !== 'object') {
        return {
            hasData: false,
            weekCount: 0,
            monthLabel: '',
            metrics: {
                questions: { actual: 0, target: null, percent: null },
                tasks: { completed: 0, total: 0, percent: null },
                plannedExams: { completed: 0, planned: null, percent: null }
            },
            branchRows: [],
            topicRows: [],
            examContext: { examCount: 0, averageNet: null, netDelta: null },
            homeworkContext: { total: 0, completed: 0, completionRate: null },
            strengths: [],
            attentionAreas: []
        };
    }

    const weekCount = Number.isFinite(Number(rawSummary.period?.weekCount))
        ? Number(rawSummary.period.weekCount)
        : (Number.isFinite(Number(rawSummary.weekCount)) ? Number(rawSummary.weekCount) : 0);

    const monthLabel = String(rawSummary.period?.monthLabel || rawSummary.monthLabel || '');

    const planMetrics = rawSummary.planMetrics || {};
    const qActual = Number.isFinite(Number(planMetrics.questionActual)) ? Number(planMetrics.questionActual) : 0;
    const qTarget = (planMetrics.questionTarget != null && Number.isFinite(Number(planMetrics.questionTarget)) && Number(planMetrics.questionTarget) > 0)
        ? Number(planMetrics.questionTarget)
        : null;
    let qPercent = null;
    if (qTarget != null && qTarget > 0) {
        qPercent = Math.round(((qActual / qTarget) * 100 + Number.EPSILON) * 100) / 100;
    } else if (planMetrics.questionPercent != null && Number.isFinite(Number(planMetrics.questionPercent))) {
        qPercent = Number(planMetrics.questionPercent);
    }

    const tCompleted = Number.isFinite(Number(planMetrics.taskCompleted)) ? Number(planMetrics.taskCompleted) : 0;
    const tTotal = (planMetrics.taskTotal != null && Number.isFinite(Number(planMetrics.taskTotal)) && Number(planMetrics.taskTotal) > 0)
        ? Number(planMetrics.taskTotal)
        : 0;
    let tPercent = null;
    if (tTotal > 0) {
        tPercent = Math.round(((tCompleted / tTotal) * 100 + Number.EPSILON) * 100) / 100;
    } else if (planMetrics.taskPercent != null && Number.isFinite(Number(planMetrics.taskPercent))) {
        tPercent = Number(planMetrics.taskPercent);
    }

    const eCompleted = Number.isFinite(Number(planMetrics.examCompleted)) ? Number(planMetrics.examCompleted) : 0;
    const eTarget = (planMetrics.examTarget != null && Number.isFinite(Number(planMetrics.examTarget)) && Number(planMetrics.examTarget) > 0)
        ? Number(planMetrics.examTarget)
        : null;
    let ePercent = null;
    if (eTarget != null && eTarget > 0) {
        ePercent = Math.round(((eCompleted / eTarget) * 100 + Number.EPSILON) * 100) / 100;
    } else if (planMetrics.examPercent != null && Number.isFinite(Number(planMetrics.examPercent))) {
        ePercent = Number(planMetrics.examPercent);
    }

    const branchRows = (Array.isArray(rawSummary.branchSummary) ? rawSummary.branchSummary : [])
        .slice()
        .sort((a, b) => (Number(b.actual ?? b.completed ?? 0)) - (Number(a.actual ?? a.completed ?? 0)))
        .slice(0, 5)
        .map(b => {
            const actual = Number.isFinite(Number(b.actual)) ? Number(b.actual) : (Number.isFinite(Number(b.completed)) ? Number(b.completed) : 0);
            const target = (b.target != null && Number.isFinite(Number(b.target)) && Number(b.target) > 0) ? Number(b.target) : null;
            let percent = (b.percent != null && Number.isFinite(Number(b.percent))) ? Number(b.percent) : null;
            if (percent == null && target != null && target > 0) {
                percent = Math.round(((actual / target) * 100 + Number.EPSILON) * 100) / 100;
            }
            return {
                subject: String(b.subject || ''),
                completed: actual,
                actual,
                target,
                percent
            };
        });

    const topicRows = (Array.isArray(rawSummary.topicSummary) ? rawSummary.topicSummary : [])
        .slice()
        .sort((a, b) => (Number(b.actual ?? b.completedCount ?? 0)) - (Number(a.actual ?? a.completedCount ?? 0)))
        .slice(0, 3)
        .map(t => {
            const count = Number.isFinite(Number(t.actual)) ? Number(t.actual) : (Number.isFinite(Number(t.completedCount)) ? Number(t.completedCount) : 0);
            return {
                topic: String(t.topic || ''),
                branch: String(t.branch || t.subject || ''),
                subject: String(t.subject || t.branch || ''),
                completedCount: count,
                actual: count
            };
        });

    const examContext = {
        examCount: Number.isFinite(Number(rawSummary.examContext?.examCount)) ? Number(rawSummary.examContext.examCount) : 0,
        averageNet: (rawSummary.examContext?.averageNet != null && Number.isFinite(Number(rawSummary.examContext.averageNet))) ? Number(rawSummary.examContext.averageNet) : null,
        netDelta: (rawSummary.examContext?.netDelta != null && Number.isFinite(Number(rawSummary.examContext.netDelta))) ? Number(rawSummary.examContext.netDelta) : null
    };

    const homeworkContext = {
        total: Number.isFinite(Number(rawSummary.homeworkContext?.total)) ? Number(rawSummary.homeworkContext.total) : 0,
        completed: Number.isFinite(Number(rawSummary.homeworkContext?.completed)) ? Number(rawSummary.homeworkContext.completed) : 0,
        completionRate: (rawSummary.homeworkContext?.completionRate != null && Number.isFinite(Number(rawSummary.homeworkContext.completionRate))) ? Number(rawSummary.homeworkContext.completionRate) : null
    };

    const strengths = Array.isArray(rawSummary.strengths)
        ? rawSummary.strengths.filter(s => typeof s === 'string' && s.trim()).slice(0, 2)
        : [];

    const attentionAreas = Array.isArray(rawSummary.attentionAreas)
        ? rawSummary.attentionAreas.filter(a => typeof a === 'string' && a.trim()).slice(0, 2)
        : [];

    const hasData = (weekCount > 0) || (qActual > 0) || (tCompleted > 0) || (branchRows.length > 0);

    return {
        hasData,
        weekCount,
        monthLabel,
        metrics: {
            questions: { actual: qActual, target: qTarget, percent: qPercent },
            tasks: { completed: tCompleted, total: tTotal, percent: tPercent },
            plannedExams: { completed: eCompleted, planned: eTarget, percent: ePercent }
        },
        branchRows,
        topicRows,
        examContext,
        homeworkContext,
        strengths,
        attentionAreas
    };
}

/**
 * Builds the complete guidance progress report data model for a student.
 */
export function buildGuidanceReportData(student, options = {}) {
    if (!student || !student.id) return null;

    const now = options.now ? new Date(options.now) : new Date();
    const todayStr = getLocalIsoDate(now);
    const period = calculateReportPeriodRange(options.period || '4weeks', now);
    const allHomeworks = options.allHomeworks || student.odevler || [];
    const isBoundedPeriod = period.option !== 'all';

    // Filter student data by selected period
    const periodExams = (student.denemeler || []).filter(e => {
        const d = e.tarih ? String(e.tarih).slice(0, 10) : null;
        return d && d >= period.startDate && d <= period.endDate;
    });

    const periodHomeworks = allHomeworks.filter(hw => {
        const d = (hw.baslamaTarihi || hw.tamamlanmaTarihi || hw.tarih || '').slice(0, 10);
        if (!d) return !isBoundedPeriod; // Undated homework excluded from bounded periods
        return d >= period.startDate && d <= period.endDate;
    });

    const periodGuidanceRecords = getStudentGuidanceRecords(student).filter(rec => {
        const cDate = (rec.date || rec.createdAt || '').slice(0, 10);
        const fDate = (rec.followUpDate || '').slice(0, 10);
        const clDate = (rec.closedAt || '').slice(0, 10);
        const isCreatedInPeriod = cDate && cDate >= period.startDate && cDate <= period.endDate;
        const isFollowUpInPeriod = fDate && fDate >= period.startDate && fDate <= period.endDate;
        const isClosedInPeriod = clDate && clDate >= period.startDate && clDate <= period.endDate;
        return isCreatedInPeriod || isFollowUpInPeriod || isClosedInPeriod;
    });

    // 1. Student Profile
    const studentProfile = {
        id: student.id,
        name: student.adSoyad || 'İsimsiz Öğrenci',
        initials: getStudentInitials(student.adSoyad),
        sinif: student.sinif ? `${student.sinif}. Sınıf` : '—',
        okul: student.okul || '—',
        hedefLise: student.hedefLise || '—',
        hedefNet: student.hedefNet ? Number(student.hedefNet) : null,
        reportDate: formatFollowUpDisplayDate(todayStr),
        periodLabel: period.label
    };

    // 2. Base Guidance Detail (for general guidance priority)
    const detail = buildStudentGuidanceDetail(student, allHomeworks, now);

    // 3. Academic & Exam Analysis in Period
    const sortedExams = [...periodExams].sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)));
    const latestExam = sortedExams.length ? sortedExams[sortedExams.length - 1] : null;
    const prevExam = sortedExams.length > 1 ? sortedExams[sortedExams.length - 2] : null;
    const latestNet = latestExam ? Number(latestExam.toplamNet || 0) : null;
    const prevNet = prevExam ? Number(prevExam.toplamNet || 0) : null;
    const examDelta = (latestNet !== null && prevNet !== null) ? Number((latestNet - prevNet).toFixed(2)) : null;

    let maxNet = null;
    if (sortedExams.length > 0) {
        maxNet = Math.max(...sortedExams.map(e => Number(e.toplamNet || 0)));
    }

    const examTrend = {
        hasData: sortedExams.length > 0,
        examCount: sortedExams.length,
        latestNet,
        prevNet,
        delta: examDelta,
        maxNet,
        targetNet: studentProfile.hedefNet,
        targetGap: (latestNet !== null && studentProfile.hedefNet) ? Number((studentProfile.hedefNet - latestNet).toFixed(2)) : null,
        exams: sortedExams.map(e => ({
            name: e.denemeAdi || 'Deneme',
            date: formatFollowUpDisplayDate(String(e.tarih).slice(0, 10)),
            net: Number(Number(e.toplamNet || 0).toFixed(2))
        }))
    };

    // 4. Weak Topics strictly evaluated within Period
    const periodStudentView = {
        ...student,
        odevler: periodHomeworks,
        denemeler: periodExams
    };
    const periodWeakTopics = getRepeatedWeakTopics(periodStudentView, periodHomeworks);
    const weakTopics = (periodWeakTopics || []).slice(0, 5).map(t => ({
        topic: t.topic || 'Genel',
        unite: t.unite || '',
        errorCount: t.errorCount || 0,
        occurrenceCount: t.occurrenceCount || 0,
        isChronic: !!t.isChronic,
        summary: `${t.errorCount} Yanlış (${t.occurrenceCount} çalışmada tekrarlandı)`
    }));

    // 5. Canonical Error Reasons Distribution strictly evaluated within Period
    const rawErrorReasons = getErrorReasonsDistribution(student, periodHomeworks);
    const totalErrorCount = rawErrorReasons.reduce((acc, cur) => acc + (cur.count || 0), 0);
    const errorReasons = rawErrorReasons.slice(0, 5).map(r => ({
        key: r.key,
        label: r.label,
        count: r.count,
        percent: totalErrorCount > 0 ? Math.round((r.count / totalErrorCount) * 100) : 0
    }));

    const dominantErrorLabel = (errorReasons.length > 0 && totalErrorCount > 0) ? errorReasons[0].label : '—';

    // 6. Homework & Study Discipline in Period
    let completedHwCount = 0;
    let incompleteHwCount = 0;
    let overdueHwCount = 0;

    for (const hw of periodHomeworks) {
        if (hw.durum === 'tamamlandi' || hw.isCompleted) {
            completedHwCount++;
        } else if (hw.bitisTarihi && String(hw.bitisTarihi).slice(0, 10) < todayStr) {
            overdueHwCount++;
        } else {
            incompleteHwCount++;
        }
    }

    const totalHwCount = periodHomeworks.length;
    const hwCompletionRate = totalHwCount > 0 ? Math.round((completedHwCount / totalHwCount) * 100) : null;

    const homeworkSummary = {
        hasData: totalHwCount > 0,
        total: totalHwCount,
        completed: completedHwCount,
        incomplete: incompleteHwCount,
        overdue: overdueHwCount,
        completionRate: hwCompletionRate
    };

    // 7. Guidance Interventions & Results in Period
    const outcomes = {
        positive: 0,
        neutral: 0,
        negative: 0,
        pending: 0
    };

    const guidanceRecordsList = periodGuidanceRecords.map(rec => {
        const isClosed = rec.status === 'completed';
        const isDue = isGuidanceRecordDue(rec, now);
        const fDate = rec.followUpDate ? String(rec.followUpDate).slice(0, 10) : null;
        const clDate = rec.closedAt ? String(rec.closedAt).slice(0, 10) : null;

        if (isClosed && rec.result && rec.result !== 'pending') {
            if (rec.result === 'positive') outcomes.positive++;
            else if (rec.result === 'neutral') outcomes.neutral++;
            else if (rec.result === 'negative') outcomes.negative++;
        } else {
            outcomes.pending++;
        }

        return {
            id: rec.id,
            date: formatFollowUpDisplayDate(rec.date || String(rec.createdAt).slice(0, 10)),
            typeKey: rec.type || 'academic',
            typeLabel: GUIDANCE_RECORD_TYPES[rec.type] || 'Akademik',
            issue: rec.issue || 'Gözlem kaydı',
            action: rec.action || 'Planlanan çalışma',
            followUpDate: fDate ? formatFollowUpDisplayDate(fDate) : '—',
            rawFollowUpDate: fDate,
            closedAt: clDate ? formatFollowUpDisplayDate(clDate) : null,
            status: rec.status || 'open',
            isClosed,
            isDue,
            result: rec.result || 'pending',
            resultLabel: rec.result && rec.result !== 'pending' ? (GUIDANCE_RESULT_OPTIONS[rec.result] || rec.result) : 'Henüz Ölçülmedi',
            resultNote: rec.resultNote || ''
        };
    }).sort((a, b) => {
        // Open items first, then by date descending
        if (a.isClosed !== b.isClosed) return a.isClosed ? 1 : -1;
        return String(b.rawFollowUpDate || '').localeCompare(String(a.rawFollowUpDate || ''));
    });

    // 8. Open / Ongoing Follow-Ups
    const openFollowUps = guidanceRecordsList.filter(r => !r.isClosed).map(r => {
        let overdueDays = 0;
        if (r.rawFollowUpDate && r.rawFollowUpDate < todayStr) {
            const refTime = new Date(todayStr + 'T12:00:00').getTime();
            const fTime = new Date(r.rawFollowUpDate + 'T12:00:00').getTime();
            overdueDays = Math.max(1, Math.round((refTime - fTime) / (1000 * 60 * 60 * 24)));
        }
        return {
            ...r,
            overdueDays
        };
    });

    // 9. Recommended Next Actions (Deterministic, 3-5 items)
    const nextActions = [];
    if (weakTopics[0]) {
        nextActions.push(`${weakTopics[0].topic} konusunda hedefe yönelik kısa konu tekrarı.`);
    }
    if (weakTopics[1]) {
        nextActions.push(`${weakTopics[1].topic} alanında odaklı pekiştirme çalışması.`);
    }
    if (errorReasons[0] && errorReasons[0].label === 'Dikkatsizlik') {
        nextActions.push('Soru köklerini işaretleyerek okuma ve işlem kontrol rutini uygulanması.');
    } else if (errorReasons[0] && errorReasons[0].label === 'Süre Yetmedi') {
        nextActions.push('Soru başına süre tutarak aşamalı hızlandırma egzersizi.');
    } else if (errorReasons[0] && totalErrorCount > 0) {
        nextActions.push(`Hata dağılımında öne çıkan ${errorReasons[0].label.toLocaleLowerCase('tr-TR')} için çözüm stratejisi.`);
    }
    if (examTrend.targetGap && examTrend.targetGap > 0) {
        nextActions.push(`Hedef nete ulaşmak için haftalık soru ve net artış planının takibi (${examTrend.targetGap} net fark).`);
    }
    if (nextActions.length < 3) {
        nextActions.push('Haftalık ödev disiplininin ve soru hedeflerinin düzenli takibi.');
    }

    // 10. Next Follow-Up Date (Earliest today or future open record followUpDate)
    let nextFollowUpDate = null;
    const upcomingDates = openFollowUps
        .filter(r => r.rawFollowUpDate && r.rawFollowUpDate >= todayStr)
        .map(r => r.rawFollowUpDate)
        .sort();
    if (upcomingDates.length > 0) {
        nextFollowUpDate = formatReportDisplayDate(upcomingDates[0]);
    }

    // 11. Teacher Evaluation Note (Passed from options, purely report-local)
    const teacherNote = typeof options.teacherNote === 'string' ? options.teacherNote.trim() : '';

    // 12. Monthly Coaching Summary (Parent-safe, finalized archived only)
    let targetYear = (options.year != null && Number.isFinite(Number(options.year))) ? Number(options.year) : null;
    let targetMonth = (options.month != null && Number.isFinite(Number(options.month))) ? Number(options.month) : null;
    if (!targetYear || !targetMonth) {
        const dateForMonth = period.endDate || todayStr;
        const parts = String(dateForMonth).slice(0, 10).split('-');
        if (parts.length >= 2) {
            targetYear = targetYear || parseInt(parts[0], 10);
            targetMonth = targetMonth || parseInt(parts[1], 10);
        }
    }

    const rawCoachingSummary = buildMonthlyCoachingSummary(student, targetYear, targetMonth, {
        includeActiveWeek: false,
        homeworks: allHomeworks,
        now
    });
    const coachingSummary = buildParentSafeCoachingSummary(rawCoachingSummary);

    const defaultSections = {
        academicSummary: true,
        examTrend: true,
        weakTopics: true,
        errorReasons: true,
        homeworkSummary: true,
        coachingSummary: true,
        guidanceInterventions: true,
        openFollowUps: true,
        nextActions: true,
        teacherNote: true
    };

    return {
        student: studentProfile,
        period,
        academicSummary: {
            priority: detail.priority,
            priorityLabel: detail.priorityLabel,
            mainProblemSummary: detail.mainProblemSummary,
            latestNet: examTrend.latestNet,
            targetGap: examTrend.targetGap,
            disciplineRate: homeworkSummary.completionRate,
            dominantError: dominantErrorLabel
        },
        examTrend,
        weakTopics,
        errorReasons,
        homeworkSummary,
        coachingSummary,
        guidanceRecords: guidanceRecordsList,
        outcomes,
        openFollowUps,
        nextActions: nextActions.slice(0, 4),
        nextFollowUpDate,
        teacherNote,
        sections: options.sections ? { ...defaultSections, ...options.sections } : defaultSections
    };
}

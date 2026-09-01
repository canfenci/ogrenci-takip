// ==================== GUIDANCE STUDENT INSIGHTS MODULE ====================
// Student-level deep guidance decision support, evidence aggregation, and before/after intervention analytics.
// Completely pure and read-only. No mutations or database writes.

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

import { normalizeHomeworkErrorAnalysis, normalizeHataNedeniLabel, normalizeHataNedeniKey } from './homework-error-topics.js';

function safeNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}

function round(value, digits = 2) {
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

function isValidDateString(str) {
    if (!str || typeof str !== 'string') return false;
    return /^\d{4}-\d{2}-\d{2}$/.test(str.slice(0, 10));
}

/**
 * Generates concise rule-based main problem diagnosis sentence.
 */
export function getStudentMainProblemSummary({ priority, repeatedTopics = [], dominantError, examTrend, discipline }) {
    const parts = [];

    const topTopic = repeatedTopics[0];
    if (topTopic) {
        if (topTopic.isChronic) {
            parts.push(`${topTopic.topic} konusunda kronik zayıflık (${topTopic.errorCount} hata)`);
        } else {
            parts.push(`${topTopic.topic} konusunda tekrar eden eksik`);
        }
    }

    if (dominantError && dominantError.count >= 3) {
        parts.push(`baskın olarak ${dominantError.label.toLocaleLowerCase('tr-TR')}`);
    }

    if (examTrend?.trend === 'declining') {
        parts.push(`son genel denemelerde net düşüşü (${Math.abs(examTrend.delta).toFixed(2)} net)`);
    } else if (discipline?.isProblematic) {
        parts.push(`ödev tamamlama oranında düşüklük (%${discipline.completionRate})`);
    }

    if (parts.length === 0) {
        return 'Öğrencinin akademik performansı ve çalışma disiplini dengeli ilerliyor.';
    }

    return `Ana Sorun: ${parts.join(', ')}.`;
}

/**
 * Calculates error reason distribution (top canonical reasons with counts).
 */
export function getErrorReasonsDistribution(student, homeworks = []) {
    const counts = {};

    const hwList = (homeworks && homeworks.length) ? homeworks : (student.odevler || []);
    hwList.forEach(hw => {
        const errorList = normalizeHomeworkErrorAnalysis(hw);
        errorList.forEach(err => {
            (err.hataNedenleriKeys || []).forEach(key => {
                counts[key] = (counts[key] || 0) + (safeNumber(err.adet) || 1);
            });
        });
    });

    (student.denemeler || []).forEach(exam => {
        (exam.sorular || []).forEach(q => {
            if (q.durum === 'yanlis' && q.hataKodu) {
                const key = normalizeHataNedeniKey(q.hataKodu);
                if (key) counts[key] = (counts[key] || 0) + 1;
            }
        });
    });

    const totalErrors = Object.values(counts).reduce((sum, c) => sum + c, 0);

    return Object.entries(counts)
        .map(([key, count]) => ({
            key,
            label: normalizeHataNedeniLabel(key),
            count,
            percentage: totalErrors > 0 ? Math.round((count / totalErrors) * 100) : 0
        }))
        .sort((a, b) => b.count - a.count);
}

/**
 * Calculates before/after intervention net comparison.
 */
export function getInterventionBeforeAfter(student) {
    const planProfile = student.studyPlanProfile;
    if (!planProfile || !planProfile.generatedAt || !isValidDateString(planProfile.generatedAt)) {
        return {
            hasIntervention: false,
            status: 'no_plan',
            message: 'Henüz aktif veya tamamlanmış bir çalışma planı kaydı bulunmuyor.'
        };
    }

    const planDateStr = String(planProfile.generatedAt).slice(0, 10);

    const generalExams = (student.denemeler || [])
        .filter(exam => exam.tip === 'genel' && exam.tarih && isValidDateString(exam.tarih) && Number.isFinite(Number(exam.toplamNet)))
        .sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)));

    const beforeExams = generalExams.filter(e => e.tarih.slice(0, 10) <= planDateStr);
    const afterExams = generalExams.filter(e => e.tarih.slice(0, 10) > planDateStr);

    if (!afterExams.length) {
        return {
            hasIntervention: true,
            planSubject: planProfile.subject || 'Genel Plan',
            planDate: planDateStr,
            formattedPlanDate: formatActivityDate(planDateStr),
            status: 'pending_measurement',
            message: 'Henüz müdahale sonrası yeterli ölçüm yok.',
            beforeNet: beforeExams.length ? safeNumber(beforeExams.at(-1).toplamNet) : null,
            afterNet: null,
            delta: null
        };
    }

    const beforeNet = beforeExams.length ? safeNumber(beforeExams.at(-1).toplamNet) : safeNumber(generalExams[0]?.toplamNet);
    const afterNet = safeNumber(afterExams.at(-1).toplamNet);
    const delta = round(afterNet - beforeNet);

    let impactStatus = 'neutral';
    let impactLabel = 'Değişim Yok';
    if (delta >= 1.0) {
        impactStatus = 'positive';
        impactLabel = 'Olumlu Değişim';
    } else if (delta <= -1.0) {
        impactStatus = 'negative';
        impactLabel = 'Gerileme';
    }

    return {
        hasIntervention: true,
        planSubject: planProfile.subject || 'Genel Plan',
        planDate: planDateStr,
        formattedPlanDate: formatActivityDate(planDateStr),
        status: 'measured',
        impactStatus,
        impactLabel,
        beforeNet,
        afterNet,
        delta,
        beforeExamName: beforeExams.length ? (beforeExams.at(-1).denemeAdi || 'Önceki Deneme') : 'İlk Deneme',
        afterExamName: afterExams.at(-1).denemeAdi || 'Sonraki Deneme'
    };
}

/**
 * Builds chronological timeline events specifically for a single student.
 */
export function getStudentActivityTimeline(student, limit = 8) {
    const events = [];

    // Study Plan
    if (student.studyPlanProfile?.generatedAt && isValidDateString(student.studyPlanProfile.generatedAt)) {
        const dateStr = String(student.studyPlanProfile.generatedAt).slice(0, 10);
        events.push({
            date: dateStr,
            formattedDate: formatActivityDate(dateStr),
            type: 'plan',
            typeLabel: 'Çalışma Planı',
            icon: 'fa-compass',
            detail: `${student.studyPlanProfile.subject || 'Genel Program'} oluşturuldu`
        });
    }

    // Lessons
    (student.dersKayitlari || []).forEach(l => {
        if (isValidDateString(l.tarih)) {
            const dateStr = String(l.tarih).slice(0, 10);
            events.push({
                date: dateStr,
                formattedDate: formatActivityDate(dateStr),
                type: 'lesson',
                typeLabel: 'Ders Kaydı',
                icon: 'fa-book-open',
                detail: `${l.konu || (l.dersNo ? `${l.dersNo}. Ders` : 'Ders işlendi')}${l.notlar ? ` · ${l.notlar}` : ''}`
            });
        }
    });

    // Exams
    (student.denemeler || []).forEach(e => {
        if (isValidDateString(e.tarih)) {
            const dateStr = String(e.tarih).slice(0, 10);
            events.push({
                date: dateStr,
                formattedDate: formatActivityDate(dateStr),
                type: 'exam',
                typeLabel: 'Deneme Sonucu',
                icon: 'fa-file-lines',
                detail: `${e.denemeAdi || 'Genel Deneme'} (${Number(e.toplamNet || 0).toFixed(2)} net)`
            });
        }
    });

    // Homeworks
    (student.odevler || []).forEach(hw => {
        const completionDate = hw.tamamlanmaTarihi || hw.completedAt || hw.sonucTarihi;
        if (completionDate && isValidDateString(completionDate)) {
            const dateStr = String(completionDate).slice(0, 10);
            events.push({
                date: dateStr,
                formattedDate: formatActivityDate(dateStr),
                type: 'homework',
                typeLabel: 'Ödev Tamamlandı',
                icon: 'fa-circle-check',
                detail: `${hw.konu || 'Ödev'} tamamlandı`
            });
        } else if (hw.baslamaTarihi && isValidDateString(hw.baslamaTarihi)) {
            const dateStr = String(hw.baslamaTarihi).slice(0, 10);
            events.push({
                date: dateStr,
                formattedDate: formatActivityDate(dateStr),
                type: 'homework',
                typeLabel: 'Ödev Verildi',
                icon: 'fa-list-check',
                detail: `${hw.konu || 'Ödev'} verildi`
            });
        }
    });

    events.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return events.slice(0, limit);
}

/**
 * Builds complete detailed guidance decision report model for a student.
 */
export function buildStudentGuidanceDetail(student, allHomeworks = null, now = new Date()) {
    const homeworks = allHomeworks || (student.odevler || []);
    const priorityData = buildGuidancePriority(student, homeworks, now);
    const errorReasons = getErrorReasonsDistribution(student, homeworks);
    const interventionImpact = getInterventionBeforeAfter(student);
    const timeline = getStudentActivityTimeline(student, 8);

    const mainProblemSummary = getStudentMainProblemSummary({
        priority: priorityData.priority,
        repeatedTopics: priorityData.repeatedTopics,
        dominantError: priorityData.dominantError,
        examTrend: priorityData.examTrend,
        discipline: priorityData.discipline
    });

    // Recent lessons (last 4)
    const recentLessons = (student.dersKayitlari || [])
        .filter(l => isValidDateString(l.tarih))
        .sort((a, b) => String(b.tarih).localeCompare(String(a.tarih)))
        .slice(0, 4)
        .map(l => ({
            date: l.tarih,
            formattedDate: formatActivityDate(l.tarih),
            dersNo: l.dersNo,
            konu: l.konu || 'Ders işlendi',
            notlar: l.notlar || ''
        }));

    // Recent exams (last 4)
    const recentExams = (student.denemeler || [])
        .filter(e => e.tip === 'genel' && isValidDateString(e.tarih))
        .sort((a, b) => String(b.tarih).localeCompare(String(a.tarih)))
        .slice(0, 4)
        .map(e => ({
            date: e.tarih,
            formattedDate: formatActivityDate(e.tarih),
            name: e.denemeAdi || 'Genel Deneme',
            net: safeNumber(e.toplamNet)
        }));

    return {
        studentId: student.id,
        studentName: student.adSoyad,
        initials: getStudentInitials(student.adSoyad),
        sinif: student.sinif || '—',
        okul: student.okul || '',
        hedefNet: safeNumber(student.hedefNet) || null,
        hedefLise: student.hedefLise || '',
        priority: priorityData.priority,
        priorityLabel: priorityData.priorityLabel,
        priorityScore: priorityData.priorityScore,
        reasons: priorityData.reasons,
        mainProblemSummary,
        recommendation: priorityData.recommendation,
        repeatedTopics: priorityData.repeatedTopics.slice(0, 5), // Top 5
        dominantError: priorityData.dominantError,
        errorReasons: errorReasons.slice(0, 4), // Top 4
        examTrend: priorityData.examTrend,
        discipline: priorityData.discipline,
        targetGap: priorityData.targetGap,
        activePlan: priorityData.activePlan,
        interventionImpact,
        timeline,
        recentLessons,
        recentExams
    };
}

/**
 * Guidance Priority Score Engine (UX-GUIDANCE-02B3A).
 *
 * Pure, deterministic decision-support module that computes coaching priority,
 * evidence-based reasons, and data confidence.
 *
 * Zero DOM, zero persistence, zero network, zero mutation.
 */

import { getPlanProgressSummary } from './coaching-plan-progress.js';
import {
    getRepeatedWeakTopics,
    getDominantErrorType,
    getExamTrendInsight,
    getHomeworkDisciplineInsight
} from './guidance-center-insights.js';

function safeNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function round(value, digits = 2) {
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Calculates data coverage and confidence level across available student domains.
 */
export function calculateDataCoverage(student = {}, homeworks = []) {
    const hasPlan = !!(student.coachingPlan && (student.coachingPlan.status === 'active' || student.coachingPlan.status === 'draft'));

    const usableExams = (student.denemeler || []).filter(e =>
        e && (e.tip === 'genel' || !e.tip) && e.tarih && Number.isFinite(Number(e.toplamNet))
    );
    const hasExams = usableExams.length >= 2;
    const hasFullExams = usableExams.length >= 3;

    const hwList = (Array.isArray(homeworks) && homeworks.length > 0) ? homeworks : (student.odevler || []);
    const hasHomework = Array.isArray(hwList) && hwList.length > 0;

    const rawGuidance = Array.isArray(student.guidanceRecords) ? student.guidanceRecords : (Array.isArray(student.rehberlikKayitlari) ? student.rehberlikKayitlari : []);
    const hasGuidance = rawGuidance.length > 0;

    const coverage = {
        plan: hasPlan,
        exams: hasExams,
        homework: hasHomework,
        guidance: hasGuidance
    };

    let confidence = 'minimal';
    if (hasPlan && hasFullExams && hasHomework) {
        confidence = 'full';
    } else {
        const domainCount = [hasPlan, hasExams, hasHomework, hasGuidance].filter(Boolean).length;
        if (domainCount >= 2) {
            confidence = 'partial';
        } else {
            confidence = 'minimal';
        }
    }

    return { coverage, confidence, usableExams, rawGuidance, hwList };
}

/**
 * Evaluates coaching plan realization signals (Max 30 points).
 */
export function evaluatePlanSignals(plan, now = new Date()) {
    if (!plan || (plan.status !== 'active' && plan.status !== 'draft')) {
        return { points: 0, signals: null, reasons: [] };
    }

    const ps = getPlanProgressSummary(plan);
    const reasons = [];
    let qPoints = 0;
    let tPoints = 0;
    let branchPoints = 0;
    let examTaskPoints = 0;

    const qProg = ps.questions || {};
    const tProg = ps.tasks || {};
    const branches = ps.branches || [];
    const exams = ps.exams || {};

    // 1. Question progress signal with Small Target Guard
    if (qProg.target > 0) {
        const target = qProg.target;
        const actual = qProg.actual;
        const pct = qProg.percent ?? 0;
        const gap = target - actual;

        if (target <= 30) {
            // Small target guard: do not apply harsh percentage penalties for small absolute misses
            if (gap <= 5) {
                qPoints = 0;
            } else if (gap <= 12) {
                qPoints = 6;
                reasons.push({
                    domain: 'plan',
                    severity: 2,
                    text: `Soru hedefinin biraz gerisinde (${actual}/${target} soru).`
                });
            } else {
                qPoints = 12;
                reasons.push({
                    domain: 'plan',
                    severity: 3,
                    text: `Soru hedefi %${pct} seviyesinde kaldı (${actual}/${target} soru).`
                });
            }
        } else {
            if (pct < 60) {
                qPoints = 15;
                reasons.push({
                    domain: 'plan',
                    severity: 3,
                    text: `Soru hedefi %${pct} seviyesinde kaldı (${actual}/${target} soru).`
                });
            } else if (pct < 80) {
                qPoints = 8;
                reasons.push({
                    domain: 'plan',
                    severity: 2,
                    text: `Soru hedefi %${pct} seviyesinde (${actual}/${target} soru).`
                });
            } else {
                qPoints = 0;
            }
        }
    }

    // 2. Task completion signal with Sample Size Guard
    if (tProg.total > 0) {
        const total = tProg.total;
        const completed = tProg.completed;
        const pct = tProg.percent ?? 0;

        if (total < 3) {
            // Sample size guard: 0/1 or 0/2 is not treated like 0/10
            if (completed === 0) {
                tPoints = 4;
                reasons.push({
                    domain: 'plan',
                    severity: 2,
                    text: `Haftalık plan görevleri henüz tamamlanmadı (${completed}/${total}).`
                });
            } else {
                tPoints = 0;
            }
        } else {
            if (pct < 50) {
                tPoints = 10;
                reasons.push({
                    domain: 'plan',
                    severity: 3,
                    text: `Haftalık görevlerin önemli kısmı tamamlanmadı (${completed}/${total}).`
                });
            } else if (pct < 70) {
                tPoints = 5;
                reasons.push({
                    domain: 'plan',
                    severity: 2,
                    text: `Haftalık görevler kısmen tamamlandı (${completed}/${total}).`
                });
            } else {
                tPoints = 0;
            }
        }
    }

    // 3. Underperforming branch signal (supporting only, max 5 pts)
    let mostBehind = null;
    let lowestPct = Infinity;
    for (const b of branches) {
        if (b.target > 0 && b.percent != null && b.percent < lowestPct) {
            lowestPct = b.percent;
            mostBehind = b;
        }
    }

    if (mostBehind && lowestPct < 60) {
        branchPoints = 5;
        reasons.push({
            domain: 'plan',
            severity: 2,
            text: `${mostBehind.subject} hedefinin gerisinde (%${lowestPct}).`
        });
    }

    // 4. Exam-task completion (supporting only, max 5 pts)
    if (exams.target > 0 && exams.actual === 0) {
        examTaskPoints = 5;
    }

    const totalPlanPoints = Math.min(30, qPoints + tPoints + branchPoints + examTaskPoints);

    return {
        points: totalPlanPoints,
        qPoints,
        taskPoints: tPoints,
        branchPoints,
        examTaskPoints,
        signals: {
            questionTarget: qProg.target || 0,
            questionActual: qProg.actual || 0,
            questionPercent: qProg.percent ?? null,
            taskTotal: tProg.total || 0,
            taskCompleted: tProg.completed || 0,
            taskPercent: tProg.percent ?? null,
            mostBehindBranch: mostBehind ? { subject: mostBehind.subject, percent: lowestPct } : null,
            examTaskTarget: exams.target || 0,
            examTaskActual: exams.actual || 0
        },
        reasons
    };
}

/**
 * Evaluates check-in recency signal respecting plan lifecycle (Max 10 points).
 */
export function evaluateCheckInSignals(plan, now = new Date()) {
    if (!plan || (plan.status !== 'active' && plan.status !== 'draft')) {
        return { points: 0, signals: null, reasons: [] };
    }

    const todayStr = (now instanceof Date && !isNaN(now.getTime())) ? now.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const hasCheckIn = !!(plan.weeklyCheckIn && plan.weeklyCheckIn.checkedAt);
    const isExpiredWeek = !!(plan.weekEnd && plan.weekEnd < todayStr);

    let points = 0;
    const reasons = [];

    // Only penalize if the scheduled week has ended and no check-in was logged
    if (isExpiredWeek && !hasCheckIn) {
        points = 10;
        reasons.push({
            domain: 'checkin',
            severity: 2,
            text: 'Haftalık plan kontrolü yapılmamış.'
        });
    }

    return {
        points,
        signals: {
            hasCheckIn,
            isExpiredWeek,
            checkedAt: plan.weeklyCheckIn?.checkedAt || null
        },
        reasons
    };
}

/**
 * Evaluates academic trend signals (Max 30 points).
 * Requires minimum 3 usable general exams to declare an academic trend.
 */
export function evaluateAcademicTrendSignals(student, usableExams = [], targetNet = null) {
    const generalExams = usableExams
        .filter(e => e.tip === 'genel' || !e.tip)
        .sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)));

    if (generalExams.length < 3) {
        // Less than 3 exams: exactly 0 scoring points. Do not claim a trend.
        const latestNet = generalExams.length ? safeNumber(generalExams.at(-1).toplamNet) : null;
        let delta = null;
        if (generalExams.length === 2) {
            const firstNet = safeNumber(generalExams[0].toplamNet);
            const lastNet = safeNumber(generalExams[1].toplamNet);
            delta = round(lastNet - firstNet);
        }
        const trendName = generalExams.length === 2 ? 'insufficient_data' : 'no_data';
        return {
            points: 0,
            trend: trendName,
            signals: {
                points: 0,
                trend: trendName,
                examCount: generalExams.length,
                latestNet,
                delta,
                targetGap: null
            },
            reasons: []
        };
    }

    const recent = generalExams.slice(-3);
    const firstNet = safeNumber(recent[0].toplamNet);
    const lastNet = safeNumber(recent.at(-1).toplamNet);
    const delta = round(lastNet - firstNet);

    let trend = 'stable';
    let points = 0;
    const reasons = [];

    if (delta <= -1.25) {
        trend = 'declining';
        points = 30;
        reasons.push({
            domain: 'academic_trend',
            severity: 3,
            text: `Son ${recent.length} denemede ${Math.abs(delta).toFixed(2)} net düşüş var.`
        });
    } else if (delta >= 1.25) {
        trend = 'improving';
        points = 0;
        reasons.push({
            domain: 'academic_counter',
            severity: 1,
            text: `Son ${recent.length} denemede +${delta.toFixed(2)} net artış var.`
        });
    } else {
        trend = 'stable';
        points = 0;
    }

    // Target gap: only as supporting points when trend is declining
    let targetGap = null;
    if (targetNet !== null && targetNet > 0 && lastNet !== null) {
        targetGap = round(targetNet - lastNet);
        if (trend === 'declining' && targetGap >= 4.0) {
            points = Math.min(30, points + 5);
        }
    }

    return {
        points,
        trend,
        signals: {
            points,
            trend,
            examCount: generalExams.length,
            latestNet: lastNet,
            delta,
            targetGap
        },
        reasons
    };
}

/**
 * Evaluates homework discipline signals (Max 20 points).
 */
export function evaluateHomeworkSignals(discipline) {
    if (!discipline || discipline.total === 0) {
        return { points: 0, signals: null, reasons: [] };
    }

    let points = 0;
    const reasons = [];

    if (discipline.completionRate < 50 || discipline.overdue >= 3) {
        points = 20;
        reasons.push({
            domain: 'homework',
            severity: 3,
            text: `Ödev tamamlama oranı %${discipline.completionRate} (${discipline.overdue} geciken ödev).`
        });
    } else if (discipline.isProblematic) {
        points = 10;
        reasons.push({
            domain: 'homework',
            severity: 2,
            text: `Ödev tamamlama oranı %${discipline.completionRate}.`
        });
    }

    return {
        points,
        signals: {
            total: discipline.total,
            completed: discipline.completed,
            overdue: discipline.overdue,
            completionRate: discipline.completionRate
        },
        reasons
    };
}

/**
 * Evaluates chronic weak topics and dominant error types (Max 20 points).
 */
export function evaluateChronicSignals(repeatedTopics = [], dominantError = null) {
    let points = 0;
    const reasons = [];

    const chronicTopic = repeatedTopics.find(t => t.isChronic);
    const repeatTopic = repeatedTopics.find(t => t.isRepeated);

    if (chronicTopic) {
        points += 20;
        const detail = chronicTopic.assignmentCount > 1
            ? `${chronicTopic.assignmentCount} çalışmada tekrar etti`
            : `${chronicTopic.errorCount} hata ile kronikleşti`;
        reasons.push({
            domain: 'chronic_topic',
            severity: 3,
            text: `${chronicTopic.topic} konusunda kronik zayıflık (${detail}).`
        });
    } else if (repeatTopic) {
        points += 10;
        reasons.push({
            domain: 'chronic_topic',
            severity: 2,
            text: `${repeatTopic.topic} konusunda tekrar eden eksik (${repeatTopic.errorCount} hata).`
        });
    }

    if (dominantError && dominantError.count >= 4) {
        points = Math.min(20, points + 5);
        if (!chronicTopic) {
            reasons.push({
                domain: 'dominant_error',
                severity: 2,
                text: `Baskın hata türü: ${dominantError.label} (${dominantError.count} kez).`
            });
        }
    }

    return {
        points: Math.min(20, points),
        signals: {
            chronicTopic: chronicTopic ? chronicTopic.topic : null,
            repeatTopic: repeatTopic ? repeatTopic.topic : null,
            dominantError: dominantError ? dominantError.key : null
        },
        reasons
    };
}

/**
 * Evaluates unresolved guidance records with due/overdue follow-up (Max 15 points).
 */
export function evaluateGuidanceSignals(guidanceRecords = [], now = new Date()) {
    const todayStr = (now instanceof Date && !isNaN(now.getTime())) ? now.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const hasOverdue = guidanceRecords.some(r =>
        r && (r.status === 'open' || !r.status || r.durum === 'acik') && r.followUpDate && r.followUpDate <= todayStr
    );

    let points = 0;
    const reasons = [];

    if (hasOverdue) {
        points = 15;
        reasons.push({
            domain: 'guidance_followup',
            severity: 3,
            text: 'Takip tarihi geçmiş açık rehberlik kaydı var.'
        });
    }

    return {
        points,
        signals: {
            hasOverdue
        },
        reasons
    };
}

/**
 * Primary pure entry point for computing coaching priority score.
 *
 * @param {Object} context - { student, homeworks, now, ... } or student object directly
 * @returns {Object} Complete priority classification and explainability
 */
export function buildPriorityScore(context = {}) {
    const student = (context && context.student) ? context.student : (context || {});
    const now = (context && context.now instanceof Date) ? context.now : new Date();

    const { coverage, confidence, usableExams, rawGuidance, hwList } = calculateDataCoverage(
        student,
        context.homeworks
    );

    // Context may pass precalculated insights to conserve compute
    const repeatedTopics = context.repeatedTopics || getRepeatedWeakTopics(student, hwList);
    const dominantError = context.dominantError || getDominantErrorType(student, hwList);
    const discipline = context.discipline || getHomeworkDisciplineInsight(student, hwList);
    const targetNet = safeNumber(student.hedefNet, null);

    // Domain evaluations
    const planEval = evaluatePlanSignals(student.coachingPlan, now);
    const checkInEval = evaluateCheckInSignals(student.coachingPlan, now);
    const trendEval = evaluateAcademicTrendSignals(student, usableExams, targetNet);
    const hwEval = evaluateHomeworkSignals(discipline);
    const chronicEval = evaluateChronicSignals(repeatedTopics, dominantError);
    const guidanceEval = evaluateGuidanceSignals(rawGuidance, now);

    // Double penalty prevention: Combined discipline cap (plan tasks + homework discipline <= 30)
    let adjustedHwPoints = hwEval.points;
    if (planEval.taskPoints + adjustedHwPoints > 30) {
        adjustedHwPoints = Math.max(0, 30 - planEval.taskPoints);
    }

    // Additive score model with 100 cap
    const rawScore = planEval.points +
        checkInEval.points +
        trendEval.points +
        adjustedHwPoints +
        chronicEval.points +
        guidanceEval.points;

    const priorityScore = Math.min(100, Math.max(0, Math.round(rawScore)));

    // Level assignment with confidence safeguards
    let priority = 'watch';
    let priorityLabel = 'İzle';

    const hasCriticalDecline = trendEval.trend === 'declining';
    const hasCriticalDiscipline = discipline?.completionRate < 50 || discipline?.overdue >= 3;
    const hasChronicTopic = !!repeatedTopics.find(t => t.isChronic);
    const hasCriticalBilgiEksikligi = dominantError?.key === 'bilgi_eksikligi' && dominantError.count >= 6;
    const hasOverdueGuidance = guidanceEval.signals?.hasOverdue;

    // Critical decline only escalates to High if confidence is NOT minimal OR supported by another risk domain
    const otherRiskCount = [
        planEval.points >= 10,
        adjustedHwPoints >= 10,
        chronicEval.points >= 10,
        guidanceEval.points >= 10
    ].filter(Boolean).length;

    const criticalDeclineQualified = hasCriticalDecline && (confidence !== 'minimal' || otherRiskCount >= 1);
    const criticalDisciplineQualified = hasCriticalDiscipline && (confidence !== 'minimal' || otherRiskCount >= 1);

    if (
        (priorityScore >= 50 && confidence !== 'minimal') ||
        criticalDeclineQualified ||
        criticalDisciplineQualified ||
        (hasChronicTopic && priorityScore >= 35) ||
        (hasCriticalBilgiEksikligi && confidence !== 'minimal') ||
        (hasOverdueGuidance && priorityScore >= 35)
    ) {
        priority = 'high';
        priorityLabel = 'Yüksek';
    } else if (
        priorityScore >= 20 ||
        hasCriticalDecline || // with minimal confidence, capped at medium
        hasCriticalDiscipline ||
        repeatedTopics.some(t => t.isRepeated) ||
        discipline?.isProblematic ||
        hasOverdueGuidance ||
        planEval.points >= 12
    ) {
        priority = 'medium';
        priorityLabel = 'Orta';
    } else {
        priority = 'watch';
        priorityLabel = 'İzle';
    }

    // Reason selection: max 3, prioritized by severity across independent domains
    const allCandidateReasons = [
        ...planEval.reasons,
        ...checkInEval.reasons,
        ...trendEval.reasons,
        ...hwEval.reasons,
        ...chronicEval.reasons,
        ...guidanceEval.reasons
    ];

    // Filter out counter-signal if student is in high priority and has negative reasons
    const filteredCandidates = allCandidateReasons.filter(r => {
        if (priority === 'high' && r.domain === 'academic_counter') return false;
        return true;
    });

    filteredCandidates.sort((a, b) => b.severity - a.severity);

    // Pick unique domains first to avoid repetitive reasons
    const chosenReasons = [];
    const usedDomains = new Set();

    for (const item of filteredCandidates) {
        if (!usedDomains.has(item.domain)) {
            chosenReasons.push(item.text);
            usedDomains.add(item.domain);
            if (chosenReasons.length >= 3) break;
        }
    }

    // Fill up to 3 if we still have slots and remaining candidates
    if (chosenReasons.length < 3) {
        for (const item of filteredCandidates) {
            if (!chosenReasons.includes(item.text)) {
                chosenReasons.push(item.text);
                if (chosenReasons.length >= 3) break;
            }
        }
    }

    // Fallback explainability when no reasons exist
    if (chosenReasons.length === 0) {
        if (confidence === 'minimal') {
            chosenReasons.push('Genel takip stabil veya henüz yeterli veri yok.');
        } else {
            chosenReasons.push('Genel performans stabil, kritik sinyal yok.');
        }
    }

    return {
        priority,
        priorityLabel,
        priorityScore,
        reasons: chosenReasons.slice(0, 3),
        confidence,
        dataCoverage: coverage,
        signals: {
            plan: planEval.signals,
            checkIn: checkInEval.signals,
            trend: trendEval.signals,
            homework: hwEval.signals,
            chronic: chronicEval.signals,
            guidance: guidanceEval.signals
        }
    };
}

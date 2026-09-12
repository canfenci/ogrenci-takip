/**
 * Coaching Plan Monthly Summary Engine (UX-GUIDANCE-02B3B).
 *
 * Pure, deterministic engine that computes monthly coaching plan realization,
 * weekly trend metrics, branch/topic summaries, and isolated academic/homework/guidance contexts.
 *
 * Zero DOM, zero persistence, zero network, zero mutation.
 */

import { getMonthlyProgress } from './coaching-plan-history.js';

const TURKISH_MONTHS = [
    '',
    'Ocak',
    'Şubat',
    'Mart',
    'Nisan',
    'Mayıs',
    'Haziran',
    'Temmuz',
    'Ağustos',
    'Eylül',
    'Ekim',
    'Kasım',
    'Aralık'
];

function safeNumber(val, fallback = 0) {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
}

function round(val, digits = 2) {
    if (!Number.isFinite(val)) return 0;
    const factor = 10 ** digits;
    return Math.round((val + Number.EPSILON) * factor) / factor;
}

/**
 * Safely parses YYYY and MM from an ISO or YYYY-MM-DD date string without UTC shift.
 */
export function getYearMonthFromDateStr(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const clean = dateStr.trim();
    const parts = clean.slice(0, 10).split('-');
    if (parts.length < 2) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        return null;
    }
    return { year, month };
}

/**
 * Filters history snapshots by month using weekStart as the bucket key.
 * Deterministic: weekStart month determines bucket (avoids double-counting across boundaries).
 */
export function filterSnapshotsForMonth(historyArray, year, month) {
    if (!Array.isArray(historyArray)) return [];
    return historyArray.filter(s => {
        if (!s || !s.weekStart) return false;
        const ym = getYearMonthFromDateStr(s.weekStart);
        return ym && ym.year === year && ym.month === month;
    });
}

/**
 * Calculates percentage safely. Returns null if target is non-positive or invalid.
 */
export function calcPercent(actual, target) {
    if (target == null || !Number.isFinite(Number(target))) return null;
    const t = Number(target);
    if (t <= 0) return null;
    const a = safeNumber(actual, 0);
    return round((a / t) * 100);
}

/**
 * Extracts weekly metrics from a single snapshot (archived or preview).
 */
export function extractWeekMetrics(snapshot, isPreview = false) {
    if (!snapshot || typeof snapshot !== 'object') return null;

    let questionActual = 0;
    let questionTarget = null;
    let taskCompleted = 0;
    let taskTotal = 0;
    let examActual = 0;
    let examTarget = null;

    const ps = snapshot.progressSummary;
    if (ps && typeof ps === 'object') {
        questionActual = safeNumber(ps.questions?.actual);
        if (ps.questions?.target != null && Number.isFinite(Number(ps.questions.target))) {
            questionTarget = Number(ps.questions.target);
        }

        taskCompleted = safeNumber(ps.tasks?.completed);
        taskTotal = safeNumber(ps.tasks?.total);

        // Exams from progressSummary
        if (ps.exams && typeof ps.exams === 'object') {
            if (ps.exams.actual != null) {
                examActual = safeNumber(ps.exams.actual);
            } else {
                examActual = safeNumber(ps.exams.generalActual) + safeNumber(ps.exams.branchActual);
            }

            if (ps.exams.target != null && Number.isFinite(Number(ps.exams.target))) {
                examTarget = Number(ps.exams.target);
            } else if (ps.exams.generalTarget != null || ps.exams.branchTarget != null) {
                examTarget = safeNumber(ps.exams.generalTarget) + safeNumber(ps.exams.branchTarget);
            }
        }
    } else {
        // Legacy snapshot fallback without progressSummary
        const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
        const wt = (snapshot.weeklyTargets && typeof snapshot.weeklyTargets === 'object') ? snapshot.weeklyTargets : {};

        if (wt.totalQuestions != null && Number.isFinite(Number(wt.totalQuestions))) {
            questionTarget = Number(wt.totalQuestions);
        }
        questionActual = tasks
            .filter(t => t && t.taskType === 'question')
            .reduce((sum, t) => sum + safeNumber(t.completedCount), 0);

        taskTotal = tasks.length;
        taskCompleted = tasks.filter(t => t && t.completed === true).length;

        if (wt.generalExams != null || wt.branchExams != null) {
            examTarget = safeNumber(wt.generalExams) + safeNumber(wt.branchExams);
        }
        examActual = tasks.filter(t => t && t.taskType === 'exam' && t.completed === true).length;
    }

    const questionPercent = calcPercent(questionActual, questionTarget);
    const taskPercent = taskTotal > 0 ? round((taskCompleted / taskTotal) * 100) : null;
    const examPercent = calcPercent(examActual, examTarget);

    const weekItem = {
        weekStart: snapshot.weekStart || '',
        weekEnd: snapshot.weekEnd || '',
        questionActual,
        questionTarget,
        questionPercent,
        taskCompleted,
        taskTotal,
        taskPercent,
        examActual,
        examTarget,
        examPercent,
        isPreview: !!isPreview
    };

    if (isPreview) {
        weekItem.statusLabel = 'Devam Eden Hafta';
    }

    return weekItem;
}

/**
 * Builds chronological weekly trend array from archived snapshots.
 */
export function buildWeeklyTrend(snapshots = [], options = {}, activePlan = null, year = null, month = null) {
    const sorted = [...snapshots].sort((a, b) => String(a.weekStart || '').localeCompare(String(b.weekStart || '')));
    const trend = sorted.map(s => extractWeekMetrics(s, false)).filter(Boolean);

    if (options.includeActiveWeek === true && activePlan && typeof activePlan === 'object') {
        const ym = getYearMonthFromDateStr(activePlan.weekStart);
        if (ym && ym.year === year && ym.month === month) {
            // Include active week as preview
            const preview = extractWeekMetrics(activePlan, true);
            if (preview) {
                trend.push(preview);
            }
        }
    }

    return trend;
}

/**
 * Computes deterministic question trend direction across weeks with valid question percent.
 * Minimum 3 usable data points required for 'improving' / 'declining' / 'stable'.
 */
export function deriveQuestionTrend(weeklyTrend = []) {
    const usable = weeklyTrend.filter(w => !w.isPreview && w.questionPercent != null);
    if (usable.length < 3) {
        return 'insufficient_data';
    }

    const first = usable[0].questionPercent;
    const last = usable.at(-1).questionPercent;
    const delta = round(last - first);

    if (delta >= 10) return 'improving';
    if (delta <= -10) return 'declining';
    return 'stable';
}

/**
 * Aggregates monthly plan metrics from archived snapshots only.
 */
export function calculateMonthlyPlanMetrics(snapshots = []) {
    if (!snapshots.length) {
        return {
            questionTarget: null,
            questionActual: 0,
            questionPercent: null,
            taskTotal: 0,
            taskCompleted: 0,
            taskPercent: null,
            examTarget: null,
            examActual: 0,
            examPercent: null,
            trendStatus: 'insufficient_data'
        };
    }

    let hasQuestionTarget = false;
    let totalQuestionTarget = 0;
    let totalQuestionActual = 0;

    let totalTaskTotal = 0;
    let totalTaskCompleted = 0;

    let hasExamTarget = false;
    let totalExamTarget = 0;
    let totalExamActual = 0;

    const weeklyTrend = snapshots.map(s => extractWeekMetrics(s, false));

    for (const w of weeklyTrend) {
        totalQuestionActual += w.questionActual;
        if (w.questionTarget != null) {
            hasQuestionTarget = true;
            totalQuestionTarget += w.questionTarget;
        }

        totalTaskTotal += w.taskTotal;
        totalTaskCompleted += w.taskCompleted;

        totalExamActual += w.examActual;
        if (w.examTarget != null) {
            hasExamTarget = true;
            totalExamTarget += w.examTarget;
        }
    }

    const questionTarget = hasQuestionTarget ? totalQuestionTarget : null;
    const questionPercent = calcPercent(totalQuestionActual, questionTarget);

    const taskPercent = totalTaskTotal > 0 ? round((totalTaskCompleted / totalTaskTotal) * 100) : null;

    const examTarget = hasExamTarget ? totalExamTarget : null;
    const examPercent = calcPercent(totalExamActual, examTarget);

    const trendStatus = deriveQuestionTrend(weeklyTrend);

    return {
        questionTarget,
        questionActual: totalQuestionActual,
        questionPercent,
        taskTotal: totalTaskTotal,
        taskCompleted: totalTaskCompleted,
        taskPercent,
        examTarget,
        examActual: totalExamActual,
        examPercent,
        trendStatus
    };
}

/**
 * Aggregates branch metrics across snapshots (exact string match).
 */
export function buildBranchSummary(snapshots = []) {
    const branchMap = new Map();

    for (const s of snapshots) {
        const ps = s.progressSummary;
        const weekSubjects = new Set();

        if (ps && Array.isArray(ps.branches)) {
            for (const b of ps.branches) {
                const subj = (b.subject || '').trim();
                if (!subj) continue;
                weekSubjects.add(subj);

                if (!branchMap.has(subj)) {
                    branchMap.set(subj, { target: 0, actual: 0, hasTarget: false, weekCount: 0 });
                }
                const entry = branchMap.get(subj);
                entry.actual += safeNumber(b.actual);
                if (b.target != null && Number.isFinite(Number(b.target))) {
                    entry.target += Number(b.target);
                    entry.hasTarget = true;
                }
            }
        } else {
            // Fallback to branchTargets + tasks
            const branches = Array.isArray(s.branchTargets) ? s.branchTargets : [];
            const tasks = Array.isArray(s.tasks) ? s.tasks : [];

            for (const b of branches) {
                const subj = (b.subject || '').trim();
                if (!subj) continue;
                weekSubjects.add(subj);

                if (!branchMap.has(subj)) {
                    branchMap.set(subj, { target: 0, actual: 0, hasTarget: false, weekCount: 0 });
                }
                const entry = branchMap.get(subj);
                if (b.questionTarget != null && Number.isFinite(Number(b.questionTarget))) {
                    entry.target += Number(b.questionTarget);
                    entry.hasTarget = true;
                }
            }

            for (const t of tasks) {
                const subj = (t.subject || '').trim();
                if (!subj) continue;
                weekSubjects.add(subj);

                if (!branchMap.has(subj)) {
                    branchMap.set(subj, { target: 0, actual: 0, hasTarget: false, weekCount: 0 });
                }
                const entry = branchMap.get(subj);
                if (t.taskType === 'question') {
                    entry.actual += safeNumber(t.completedCount);
                }
            }
        }

        for (const subj of weekSubjects) {
            if (branchMap.has(subj)) {
                branchMap.get(subj).weekCount += 1;
            }
        }
    }

    const result = [];
    for (const [subject, data] of branchMap.entries()) {
        const target = data.hasTarget ? data.target : null;
        result.push({
            subject,
            target,
            actual: data.actual,
            percent: calcPercent(data.actual, target),
            weekCount: data.weekCount
        });
    }

    return result.sort((a, b) => a.subject.localeCompare(b.subject, 'tr'));
}

/**
 * Aggregates topic metrics across snapshots (exact subject + topic match).
 * Note: Never adds errorCount (plan history alone does not track errorCount).
 */
export function buildTopicSummary(snapshots = []) {
    const topicMap = new Map();

    for (const s of snapshots) {
        const ps = s.progressSummary;
        const weekTopicKeys = new Set();

        if (ps && Array.isArray(ps.topics)) {
            for (const t of ps.topics) {
                const subj = (t.subject || '').trim();
                const topic = (t.topic || '').trim();
                if (!subj || !topic) continue;
                const key = `${subj}|||${topic}`;
                weekTopicKeys.add(key);

                if (!topicMap.has(key)) {
                    topicMap.set(key, { subject: subj, topic, target: 0, actual: 0, hasTarget: false, weekCount: 0 });
                }
                const entry = topicMap.get(key);
                entry.actual += safeNumber(t.actual);
                if (t.target != null && Number.isFinite(Number(t.target))) {
                    entry.target += Number(t.target);
                    entry.hasTarget = true;
                }
            }
        } else {
            // Fallback from topicTargets + tasks
            const topics = Array.isArray(s.topicTargets) ? s.topicTargets : [];
            const tasks = Array.isArray(s.tasks) ? s.tasks : [];

            for (const t of topics) {
                const subj = (t.subject || '').trim();
                const topic = (t.topic || '').trim();
                if (!subj || !topic) continue;
                const key = `${subj}|||${topic}`;
                weekTopicKeys.add(key);

                if (!topicMap.has(key)) {
                    topicMap.set(key, { subject: subj, topic, target: 0, actual: 0, hasTarget: false, weekCount: 0 });
                }
                const entry = topicMap.get(key);
                if (t.questionTarget != null && Number.isFinite(Number(t.questionTarget))) {
                    entry.target += Number(t.questionTarget);
                    entry.hasTarget = true;
                }
            }

            for (const t of tasks) {
                const subj = (t.subject || '').trim();
                const topic = (t.topic || '').trim();
                if (!subj || !topic || t.taskType !== 'question') continue;
                const key = `${subj}|||${topic}`;
                weekTopicKeys.add(key);

                if (!topicMap.has(key)) {
                    topicMap.set(key, { subject: subj, topic, target: 0, actual: 0, hasTarget: false, weekCount: 0 });
                }
                const entry = topicMap.get(key);
                entry.actual += safeNumber(t.completedCount);
            }
        }

        for (const key of weekTopicKeys) {
            if (topicMap.has(key)) {
                topicMap.get(key).weekCount += 1;
            }
        }
    }

    const result = [];
    for (const data of topicMap.values()) {
        const target = data.hasTarget ? data.target : null;
        result.push({
            subject: data.subject,
            topic: data.topic,
            target,
            actual: data.actual,
            percent: calcPercent(data.actual, target),
            weekCount: data.weekCount
        });
    }

    return result.sort((a, b) => {
        const cmp = a.subject.localeCompare(b.subject, 'tr');
        if (cmp !== 0) return cmp;
        return a.topic.localeCompare(b.topic, 'tr');
    });
}

/**
 * Builds isolated recorded general exam context within requested month.
 * Minimum 3 exams required for improving / declining / stable trend.
 */
export function buildMonthlyExamContext(student, year, month) {
    const rawExams = (student && Array.isArray(student.denemeler))
        ? student.denemeler
        : ((student && Array.isArray(student.sinavlar)) ? student.sinavlar : []);

    const monthlyGeneralExams = rawExams.filter(e => {
        if (!e || !e.tarih) return false;
        const ym = getYearMonthFromDateStr(e.tarih);
        if (!ym || ym.year !== year || ym.month !== month) return false;
        const isGeneral = e.tip === 'genel' || !e.tip;
        const netVal = e.toplamNet ?? e.net;
        return isGeneral && Number.isFinite(Number(netVal));
    }).sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)));

    const count = monthlyGeneralExams.length;
    if (count === 0) {
        return {
            examCount: 0,
            latestNet: null,
            firstNet: null,
            netDelta: null,
            trendStatus: 'insufficient_data'
        };
    }

    const firstNet = safeNumber(monthlyGeneralExams[0].toplamNet ?? monthlyGeneralExams[0].net);
    const latestNet = safeNumber(monthlyGeneralExams.at(-1).toplamNet ?? monthlyGeneralExams.at(-1).net);
    const netDelta = round(latestNet - firstNet);

    let trendStatus = 'insufficient_data';
    if (count >= 3) {
        if (netDelta >= 1.25) {
            trendStatus = 'improving';
        } else if (netDelta <= -1.25) {
            trendStatus = 'declining';
        } else {
            trendStatus = 'stable';
        }
    }

    return {
        examCount: count,
        latestNet,
        firstNet,
        netDelta: count >= 2 ? netDelta : null,
        trendStatus
    };
}

/**
 * Builds isolated homework discipline context for the requested month.
 */
export function buildMonthlyHomeworkContext(student, year, month, options = {}) {
    const hwList = (options.homeworks && Array.isArray(options.homeworks))
        ? options.homeworks
        : ((student && Array.isArray(student.odevler)) ? student.odevler : []);

    const now = (options.now instanceof Date && !isNaN(options.now.getTime()))
        ? options.now
        : new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const monthlyHw = hwList.filter(h => {
        if (!h) return false;
        const dateStr = h.bitisTarihi || h.tamamlanmaTarihi || h.baslamaTarihi || h.tarih || h.createdAt;
        if (!dateStr || typeof dateStr !== 'string') return false;
        const ym = getYearMonthFromDateStr(dateStr);
        return ym && ym.year === year && ym.month === month;
    });

    const total = monthlyHw.length;
    const completed = monthlyHw.filter(h => h.durum === 'tamamlandi').length;
    const overdue = monthlyHw.filter(h => h.durum !== 'tamamlandi' && h.bitisTarihi && h.bitisTarihi < todayStr).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : null;

    return {
        total,
        completed,
        overdue,
        completionRate
    };
}

/**
 * Builds isolated guidance intervention context for the requested month.
 * Privacy-safe: zero internal note texts exposed.
 */
export function buildMonthlyGuidanceContext(student, year, month) {
    const rawRecords = (student && Array.isArray(student.guidanceRecords))
        ? student.guidanceRecords
        : ((student && Array.isArray(student.rehberlikKayitlari)) ? student.rehberlikKayitlari : []);

    let interventionCount = 0;
    let followUpCount = 0;
    let resolvedCount = 0;

    for (const r of rawRecords) {
        if (!r) continue;
        const createdYm = getYearMonthFromDateStr(r.createdAt || r.tarih || r.date);
        const followUpYm = getYearMonthFromDateStr(r.followUpDate);
        const closedYm = getYearMonthFromDateStr(r.closedAt);

        if (createdYm && createdYm.year === year && createdYm.month === month) {
            interventionCount++;
        }
        if (followUpYm && followUpYm.year === year && followUpYm.month === month) {
            followUpCount++;
        }
        if (closedYm && closedYm.year === year && closedYm.month === month && (r.status === 'completed' || r.closedAt)) {
            resolvedCount++;
        }
    }

    return {
        interventionCount,
        followUpCount,
        resolvedCount
    };
}

/**
 * Extracts recent teacher focuses from weekly check-ins.
 * Rules: trimmed, non-empty, deduplicated, max 4 items.
 * Does NOT label as nextMonthFocus.
 */
export function extractRecentFocuses(snapshots = [], activePlan = null, options = {}, year = null, month = null) {
    const candidates = [];

    // Chronological order from archived snapshots
    const sorted = [...snapshots].sort((a, b) => String(a.weekStart || '').localeCompare(String(b.weekStart || '')));
    for (const s of sorted) {
        const focus = s.weeklyCheckIn?.nextWeekFocus;
        if (typeof focus === 'string' && focus.trim()) {
            candidates.push(focus.trim());
        }
    }

    if (options.includeActiveWeek === true && activePlan && typeof activePlan === 'object') {
        const ym = getYearMonthFromDateStr(activePlan.weekStart);
        if (ym && ym.year === year && ym.month === month) {
            const focus = activePlan.weeklyCheckIn?.nextWeekFocus;
            if (typeof focus === 'string' && focus.trim()) {
                candidates.push(focus.trim());
            }
        }
    }

    // Deduplicate while preserving most recent first
    const seen = new Set();
    const result = [];
    for (let i = candidates.length - 1; i >= 0; i--) {
        const item = candidates[i];
        const lower = item.toLowerCase();
        if (!seen.has(lower)) {
            seen.add(lower);
            result.push(item);
        }
    }

    return result.slice(0, 4);
}

/**
 * Derives deterministic strengths (max 2) with concrete evidence.
 */
export function deriveMonthlyStrengths(planMetrics, branchSummary = [], examContext = {}, homeworkContext = {}) {
    const candidates = [];

    // 1. Question Target Exceeded / High Realization
    if (planMetrics.questionTarget > 0 && planMetrics.questionPercent != null) {
        if (planMetrics.questionPercent >= 100) {
            candidates.push({
                domain: 'plan_question',
                priority: 1,
                text: `Aylık soru hedefi aşıldı (%${planMetrics.questionPercent}, ${planMetrics.questionActual}/${planMetrics.questionTarget} soru).`
            });
        } else if (planMetrics.questionPercent >= 85) {
            candidates.push({
                domain: 'plan_question',
                priority: 2,
                text: `Aylık soru hedefi yüksek oranda gerçekleştirildi (%${planMetrics.questionPercent}, ${planMetrics.questionActual}/${planMetrics.questionTarget} soru).`
            });
        }
    }

    // 2. Task Completion High
    if (planMetrics.taskTotal >= 3 && planMetrics.taskPercent != null && planMetrics.taskPercent >= 80) {
        candidates.push({
            domain: 'plan_task',
            priority: 3,
            text: `Haftalık plan görevleri yüksek oranda tamamlandı (%${planMetrics.taskPercent}, ${planMetrics.taskCompleted}/${planMetrics.taskTotal} görev).`
        });
    }

    // 3. Academic Trend Improving with >=3 exams
    if (examContext.trendStatus === 'improving' && examContext.examCount >= 3 && examContext.netDelta != null) {
        candidates.push({
            domain: 'academic_trend',
            priority: 1,
            text: `Genel denemelerde net artış trendi görüldü (+${examContext.netDelta.toFixed(2)} net).`
        });
    }

    // 4. Branch Target Strongly Achieved
    const strongBranches = branchSummary.filter(b => b.target != null && b.target >= 30 && b.percent != null && b.percent >= 90)
        .sort((a, b) => b.percent - a.percent);
    if (strongBranches.length > 0) {
        candidates.push({
            domain: 'branch',
            priority: 4,
            text: `${strongBranches[0].subject} branşında hedef güçlü şekilde gerçekleşti (%${strongBranches[0].percent}).`
        });
    }

    // 5. Homework Discipline Strong
    if (homeworkContext.total >= 3 && homeworkContext.completionRate != null && homeworkContext.completionRate >= 85) {
        candidates.push({
            domain: 'homework',
            priority: 5,
            text: `Ödev teslim disiplini güçlü seviyede (%${homeworkContext.completionRate}).`
        });
    }

    // Sort by priority and deduplicate by domain
    candidates.sort((a, b) => a.priority - b.priority);

    const selected = [];
    const usedDomains = new Set();
    for (const c of candidates) {
        if (!usedDomains.has(c.domain)) {
            usedDomains.add(c.domain);
            selected.push(c.text);
            if (selected.length === 2) break;
        }
    }

    return selected;
}

/**
 * Derives deterministic attention areas (max 2) with concrete evidence and signal dedup.
 */
export function deriveMonthlyAttentionAreas(planMetrics, branchSummary = [], examContext = {}, homeworkContext = {}) {
    const candidates = [];

    // 1. Declining Exam Trend with >= 3 exams
    if (examContext.trendStatus === 'declining' && examContext.examCount >= 3 && examContext.netDelta != null) {
        candidates.push({
            domain: 'academic_trend',
            priority: 1,
            text: `Genel denemelerde net düşüş trendi tespit edildi (${Math.abs(examContext.netDelta).toFixed(2)} net düşüş).`
        });
    }

    // 2. Question Completion Materially Low (<60%)
    if (planMetrics.questionTarget > 0 && planMetrics.questionPercent != null && planMetrics.questionPercent < 60) {
        candidates.push({
            domain: 'plan',
            subDomain: 'plan_question',
            priority: 2,
            text: `Aylık soru hedefinin gerisinde kalındı (%${planMetrics.questionPercent}, ${planMetrics.questionActual}/${planMetrics.questionTarget} soru).`
        });
    }

    // 3. Homework Completion Low or Overdue
    if (homeworkContext.total >= 2 && (homeworkContext.completionRate < 60 || homeworkContext.overdue >= 2)) {
        candidates.push({
            domain: 'homework',
            priority: 3,
            text: `Ödev tamamlama oranı düşük seyretti (%${homeworkContext.completionRate ?? 0}${homeworkContext.overdue > 0 ? `, ${homeworkContext.overdue} gecikmiş ödev` : ''}).`
        });
    }

    // 4. Task Completion Low (<50%)
    if (planMetrics.taskTotal >= 3 && planMetrics.taskPercent != null && planMetrics.taskPercent < 50) {
        candidates.push({
            domain: 'plan',
            subDomain: 'plan_task',
            priority: 4,
            text: `Plan görevlerinin önemli kısmı tamamlanmadı (%${planMetrics.taskPercent}, ${planMetrics.taskCompleted}/${planMetrics.taskTotal} görev).`
        });
    }

    // 5. Under-target Branch
    const weakBranches = branchSummary.filter(b => b.target != null && b.target >= 30 && b.percent != null && b.percent < 60)
        .sort((a, b) => a.percent - b.percent);
    if (weakBranches.length > 0) {
        candidates.push({
            domain: 'plan',
            subDomain: 'plan_branch',
            priority: 5,
            text: `${weakBranches[0].subject} branş hedefi belirgin şekilde geride kaldı (%${weakBranches[0].percent}).`
        });
    }

    // Sort by priority
    candidates.sort((a, b) => a.priority - b.priority);

    // Dedup by domain: prevents 2 plan-related attention areas from crowding out other domains
    const selected = [];
    const usedDomains = new Set();
    for (const c of candidates) {
        if (!usedDomains.has(c.domain)) {
            usedDomains.add(c.domain);
            selected.push(c.text);
            if (selected.length === 2) break;
        }
    }

    return selected;
}

/**
 * Derives data coverage and confidence level.
 */
export function deriveDataCoverage(snapshots = [], examContext = {}, homeworkContext = {}, guidanceContext = {}) {
    const archivedWeeks = snapshots.length;
    const examCount = examContext.examCount || 0;
    const homeworkCount = homeworkContext.total || 0;
    const guidanceRecordCount = (guidanceContext.interventionCount || 0) + (guidanceContext.followUpCount || 0);

    const hasWeeks = archivedWeeks >= 3;
    const hasExams = examCount >= 2;
    const hasHw = homeworkCount >= 2;

    let confidence = 'minimal';
    if (hasWeeks && hasExams && hasHw) {
        confidence = 'full';
    } else {
        const domainCount = [archivedWeeks >= 1, examCount >= 1, homeworkCount >= 1, guidanceRecordCount >= 1].filter(Boolean).length;
        if (domainCount >= 2) {
            confidence = 'partial';
        }
    }

    return {
        archivedWeeks,
        examCount,
        homeworkCount,
        guidanceRecordCount,
        confidence
    };
}

/**
 * Primary pure entry point for computing monthly coaching summary and trends.
 *
 * @param {Object} student - Student entity
 * @param {number} year - Year (e.g. 2026)
 * @param {number} month - Month (1-12)
 * @param {Object} options - Optional parameters { includeActiveWeek, homeworks, now }
 * @returns {Object} Complete monthly summary contract
 */
export function buildMonthlyCoachingSummary(student, year, month, options = {}) {
    const s = student || {};
    const y = safeNumber(year);
    const m = safeNumber(month);

    const monthLabel = (m >= 1 && m <= 12)
        ? `${TURKISH_MONTHS[m]} ${y}`
        : `${y}-${String(m).padStart(2, '0')}`;

    // 1. Primary historical source: studyPlanHistory snapshots filtered by weekStart month
    const history = Array.isArray(s.studyPlanHistory) ? s.studyPlanHistory : [];
    const monthlyProgress = getMonthlyProgress(history, y, m);
    const snapshots = filterSnapshotsForMonth(history, y, m);

    // 2. Active week preview determination
    const activePlan = (s.coachingPlan && (s.coachingPlan.status === 'active' || s.coachingPlan.status === 'draft'))
        ? s.coachingPlan
        : null;

    let previewWeekIncluded = false;
    if (options.includeActiveWeek === true && activePlan && activePlan.weekStart) {
        const ym = getYearMonthFromDateStr(activePlan.weekStart);
        if (ym && ym.year === y && ym.month === m) {
            previewWeekIncluded = true;
        }
    }

    // 3. Finalized metrics (archived snapshots only)
    const planMetrics = calculateMonthlyPlanMetrics(snapshots);

    // 4. Weekly Trend (archived weeks + optional preview week)
    const weeklyTrend = buildWeeklyTrend(snapshots, options, activePlan, y, m);

    // 5. Branch & Topic Summaries
    const branchSummary = buildBranchSummary(snapshots);
    const topicSummary = buildTopicSummary(snapshots);

    // 6. External Contexts (separate from plan metrics)
    const examContext = buildMonthlyExamContext(s, y, m);
    const homeworkContext = buildMonthlyHomeworkContext(s, y, m, options);
    const guidanceContext = buildMonthlyGuidanceContext(s, y, m);

    // 7. Recent Focuses (from check-ins)
    const recentFocuses = extractRecentFocuses(snapshots, activePlan, options, y, m);

    // 8. Strengths & Attention Areas
    const strengths = deriveMonthlyStrengths(planMetrics, branchSummary, examContext, homeworkContext);
    const attentionAreas = deriveMonthlyAttentionAreas(planMetrics, branchSummary, examContext, homeworkContext);

    // 9. Data Coverage
    const dataCoverage = deriveDataCoverage(snapshots, examContext, homeworkContext, guidanceContext);

    return {
        period: {
            year: y,
            month: m,
            monthLabel,
            weekCount: snapshots.length,
            finalizedWeekCount: snapshots.length,
            previewWeekIncluded
        },
        planMetrics,
        weeklyTrend,
        branchSummary,
        topicSummary,
        examContext,
        homeworkContext,
        guidanceContext,
        strengths,
        attentionAreas,
        recentFocuses,
        dataCoverage
    };
}

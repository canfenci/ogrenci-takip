/**
 * Coaching Plan History — monthly aggregation helpers.
 * Pure functions. No DOM, no persistence, no network, no mutation.
 */

/**
 * Filters history snapshots by month using weekStart as the bucket key.
 * Deterministic: weekStart month determines bucket (avoids double-counting).
 */
function filterSnapshotsByMonth(historyArray, year, month) {
    if (!Array.isArray(historyArray)) return [];
    return historyArray.filter(s => {
        if (!s || !s.weekStart) return false;
        const d = new Date(s.weekStart);
        return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });
}

/**
 * Safe number helper.
 */
function sn(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * Aggregates monthly progress from history snapshots.
 * weekStart month determines bucket.
 *
 * @param {Array} historyArray - array of history snapshots
 * @param {number} year - e.g. 2026
 * @param {number} month - 1-12
 * @returns {Object} monthly aggregation
 */
export function getMonthlyProgress(historyArray, year, month) {
    const snapshots = filterSnapshotsByMonth(historyArray, year, month);
    if (snapshots.length === 0) {
        return {
            weeks: 0,
            totalQuestionTarget: 0,
            totalQuestionActual: 0,
            taskCompleted: 0,
            taskTotal: 0,
            examTarget: 0,
            examActual: 0,
            branchTotals: {},
            topicTotals: {}
        };
    }

    let totalQuestionTarget = 0;
    let totalQuestionActual = 0;
    let taskCompleted = 0;
    let taskTotal = 0;
    let examTarget = 0;
    let examActual = 0;
    const branchTotals = {};
    const topicTotals = {};

    for (const snap of snapshots) {
        const ps = snap.progressSummary;
        if (ps) {
            totalQuestionTarget += sn(ps.questions?.target);
            totalQuestionActual += sn(ps.questions?.actual);
            taskCompleted += sn(ps.tasks?.completed);
            taskTotal += sn(ps.tasks?.total);
            examTarget += sn(ps.exams?.target);
            examActual += sn(ps.exams?.actual);

            if (Array.isArray(ps.branches)) {
                for (const b of ps.branches) {
                    const key = b.subject || '';
                    if (!key) continue;
                    if (!branchTotals[key]) branchTotals[key] = { actual: 0, target: 0 };
                    branchTotals[key].actual += sn(b.actual);
                    branchTotals[key].target += sn(b.target);
                }
            }

            if (Array.isArray(ps.topics)) {
                for (const t of ps.topics) {
                    const key = `${t.subject || ''}||${t.topic || ''}`;
                    if (!topicTotals[key]) topicTotals[key] = { subject: t.subject || '', topic: t.topic || '', actual: 0, target: 0 };
                    topicTotals[key].actual += sn(t.actual);
                    topicTotals[key].target += sn(t.target);
                }
            }
        } else {
            const wt = snap.weeklyTargets || {};
            totalQuestionTarget += sn(wt.totalQuestions);
            const tasks = Array.isArray(snap.tasks) ? snap.tasks : [];
            taskTotal += tasks.length;
            taskCompleted += tasks.filter(t => t && t.completed).length;
            const genExam = sn(wt.generalExams);
            const brExam = sn(wt.branchExams);
            examTarget += genExam + brExam;
            const examTasks = tasks.filter(t => t && t.taskType === 'exam' && t.completed);
            examActual += examTasks.length;
        }
    }

    const topicTotalsArr = Object.values(topicTotals);

    return {
        weeks: snapshots.length,
        totalQuestionTarget,
        totalQuestionActual,
        taskCompleted,
        taskTotal,
        examTarget,
        examActual,
        branchTotals,
        topicTotals: topicTotalsArr
    };
}

/**
 * Returns the total number of archived weeks in history.
 */
export function getHistoryWeekCount(historyArray) {
    return Array.isArray(historyArray) ? historyArray.length : 0;
}

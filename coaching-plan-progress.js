/**
 * Coaching Plan Progress Engine — Pure helpers for progress calculation.
 * Read-only, deterministic, zero side-effects.
 * Source of truth: task.completedCount and task.completed.
 * Exam/homework records are NOT included in progress calculation.
 */

function safeNumber(val, fallback = 0) {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
}

function safeTasks(plan) {
    return (plan && Array.isArray(plan.tasks)) ? plan.tasks : [];
}

function safeBranchTargets(plan) {
    return (plan && Array.isArray(plan.branchTargets)) ? plan.branchTargets : [];
}

function safeTopicTargets(plan) {
    return (plan && Array.isArray(plan.topicTargets)) ? plan.topicTargets : [];
}

function safeWeeklyTargets(plan) {
    return (plan && plan.weeklyTargets && typeof plan.weeklyTargets === 'object') ? plan.weeklyTargets : {};
}

/**
 * Calculates percent from actual/target. Returns null if target is invalid.
 */
export function getProgressPercent(actual, target) {
    const t = safeNumber(target);
    const a = safeNumber(actual);
    if (t <= 0) return null;
    return Math.round((a / t) * 10000) / 100;
}

/**
 * Returns question progress: sum of completedCount for question tasks.
 */
export function getQuestionProgress(plan) {
    const tasks = safeTasks(plan);
    const wt = safeWeeklyTargets(plan);
    const actual = tasks
        .filter(t => t && t.taskType === 'question')
        .reduce((sum, t) => sum + safeNumber(t.completedCount), 0);
    const target = wt.totalQuestions != null ? safeNumber(wt.totalQuestions) : null;
    return {
        actual,
        target,
        percent: target != null ? getProgressPercent(actual, target) : null
    };
}

/**
 * Returns task completion progress: completed tasks / total tasks.
 */
export function getTaskProgress(plan) {
    const tasks = safeTasks(plan);
    const total = tasks.length;
    const completed = tasks.filter(t => t && t.completed === true).length;
    return {
        total,
        completed,
        percent: total > 0 ? Math.round((completed / total) * 10000) / 100 : null
    };
}

/**
 * Returns exam progress: general and branch exam counts from tasks.
 */
export function getExamProgress(plan) {
    const tasks = safeTasks(plan);
    const wt = safeWeeklyTargets(plan);
    const examTasks = tasks.filter(t => t && t.taskType === 'exam' && t.completed === true);
    const generalActual = examTasks.filter(t => !t.subject || t.subject.trim() === '').length;
    const branchActual = examTasks.filter(t => t.subject && t.subject.trim() !== '').length;
    const generalTarget = wt.generalExams != null ? safeNumber(wt.generalExams) : null;
    const branchTarget = wt.branchExams != null ? safeNumber(wt.branchExams) : null;
    return {
        generalActual,
        generalTarget,
        branchActual,
        branchTarget,
        generalPercent: generalTarget != null ? getProgressPercent(generalActual, generalTarget) : null,
        branchPercent: branchTarget != null ? getProgressPercent(branchActual, branchTarget) : null
    };
}

/**
 * Returns branch progress: per-branch question and exam actuals.
 */
export function getBranchProgress(plan) {
    const tasks = safeTasks(plan);
    const branches = safeBranchTargets(plan);
    return branches.map(branch => {
        const subject = branch.subject || '';
        const questionTasks = tasks.filter(t =>
            t && t.taskType === 'question' && t.subject === subject
        );
        const examTasks = tasks.filter(t =>
            t && t.taskType === 'exam' && t.subject === subject && t.completed === true
        );
        const actual = questionTasks.reduce((sum, t) => sum + safeNumber(t.completedCount), 0);
        const target = branch.questionTarget != null ? safeNumber(branch.questionTarget) : null;
        const examActual = examTasks.length;
        const examTarget = branch.examTarget != null ? safeNumber(branch.examTarget) : null;
        return {
            subject,
            actual,
            target,
            examActual,
            examTarget,
            percent: target != null ? getProgressPercent(actual, target) : null,
            examPercent: examTarget != null ? getProgressPercent(examActual, examTarget) : null
        };
    });
}

/**
 * Returns topic progress: per-topic question actuals.
 */
export function getTopicProgress(plan) {
    const tasks = safeTasks(plan);
    const topics = safeTopicTargets(plan);
    return topics.map(topic => {
        const subject = topic.subject || '';
        const topicName = topic.topic || '';
        const matched = tasks.filter(t =>
            t && t.taskType === 'question' && t.subject === subject && t.topic === topicName
        );
        const actual = matched.reduce((sum, t) => sum + safeNumber(t.completedCount), 0);
        const target = topic.questionTarget != null ? safeNumber(topic.questionTarget) : null;
        return {
            subject,
            topic: topicName,
            actual,
            target,
            percent: target != null ? getProgressPercent(actual, target) : null
        };
    });
}

/**
 * Returns reading progress.
 */
export function getReadingProgress(plan) {
    const tasks = safeTasks(plan);
    const wt = safeWeeklyTargets(plan);
    const actual = tasks.filter(t => t && t.taskType === 'reading' && t.completed === true).length;
    const target = wt.readingTarget != null ? safeNumber(wt.readingTarget) : null;
    return {
        actual,
        target,
        percent: target != null ? getProgressPercent(actual, target) : null
    };
}

/**
 * Returns review session progress.
 */
export function getReviewProgress(plan) {
    const tasks = safeTasks(plan);
    const wt = safeWeeklyTargets(plan);
    const actual = tasks.filter(t => t && t.taskType === 'review' && t.completed === true).length;
    const target = wt.reviewSessions != null ? safeNumber(wt.reviewSessions) : null;
    return {
        actual,
        target,
        percent: target != null ? getProgressPercent(actual, target) : null
    };
}

/**
 * Derives task completion state without persisting.
 */
export function getTaskCompletionState(task) {
    if (!task) return 'not_started';
    if (task.completed === true) return 'completed';
    if (task.taskType === 'question' && safeNumber(task.completedCount) > 0) return 'in_progress';
    return 'not_started';
}

/**
 * Returns weekly target actuals for all 5 target types.
 */
export function getWeeklyTargetActuals(plan) {
    return {
        questions: getQuestionProgress(plan),
        tasks: getTaskProgress(plan),
        exams: getExamProgress(plan),
        reading: getReadingProgress(plan),
        review: getReviewProgress(plan)
    };
}

/**
 * Returns complete plan progress summary.
 */
export function getPlanProgressSummary(plan) {
    return {
        questions: getQuestionProgress(plan),
        tasks: getTaskProgress(plan),
        exams: getExamProgress(plan),
        branches: getBranchProgress(plan),
        topics: getTopicProgress(plan),
        reading: getReadingProgress(plan),
        review: getReviewProgress(plan)
    };
}

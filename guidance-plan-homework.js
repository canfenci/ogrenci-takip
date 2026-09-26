import { calculateHomeworkSuccess } from './homework-success-insights.js';

export const PLAN_DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const normalizeText = value => String(value || '').trim().toLocaleLowerCase('tr-TR');
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').slice(0, 10)) ? String(value).slice(0, 10) : null;

export function distributeWeeklyQuestionTarget(target, activeDays) {
    const total = Number(target);
    const days = [...new Set((activeDays || []).filter(day => PLAN_DAYS.includes(day)))];
    if (!Number.isInteger(total) || total < 0 || days.length === 0) return [];
    const base = Math.floor(total / days.length);
    const remainder = total % days.length;
    return days.map((day, index) => ({ day, questionTarget: base + (index < remainder ? 1 : 0) }));
}

export function isCompletedPlanHomework(homework) {
    if (!homework || homework.durum === 'tamamlandi') return true;
    const hasEnteredCorrect = Number.isInteger(Number(homework.dogru)) && homework.dogru !== '' && homework.dogru != null;
    return hasEnteredCorrect && Boolean(calculateHomeworkSuccess(homework)?.valid);
}

export function homeworkMatchesPlanBranch(homework, branch) {
    const homeworkBranch = normalizeText(homework?.ders || homework?.kaynakDers?.ders);
    const planBranch = normalizeText(branch);
    return Boolean(homeworkBranch && planBranch && (homeworkBranch === planBranch || homeworkBranch.includes(planBranch) || planBranch.includes(homeworkBranch)));
}

export function homeworkOverlapsPlanWeek(homework, weekStart, weekEnd) {
    if (!weekStart || !weekEnd) return true;
    const start = validDate(homework?.baslamaTarihi) || validDate(homework?.bitisTarihi);
    const end = validDate(homework?.bitisTarihi) || validDate(homework?.baslamaTarihi);
    if (!start && !end) return true;
    return (start || end) <= weekEnd && (end || start) >= weekStart;
}

export function getEligiblePlanHomeworks({ student, branch, weekStart, weekEnd, getHomeworks } = {}) {
    if (!student || !branch) return [];
    const homeworks = typeof getHomeworks === 'function' ? getHomeworks(student) : student.odevler;
    return (Array.isArray(homeworks) ? homeworks : []).filter(homework =>
        homework?.id
        && !isCompletedPlanHomework(homework)
        && homeworkMatchesPlanBranch(homework, branch)
        && homeworkOverlapsPlanWeek(homework, weekStart, weekEnd)
    );
}

export function getSelectedHomeworkIds(plan = {}) {
    const explicit = Array.isArray(plan.selectedHomeworkIds) ? plan.selectedHomeworkIds : [];
    const legacy = Array.isArray(plan.tasks) ? plan.tasks.filter(task => task?.taskType === 'homework').map(task => task.homeworkId) : [];
    return [...new Set([...explicit, ...legacy].filter(Boolean).map(String))];
}

export function getHomeworkManualDays(plan = {}) {
    const days = new Map();
    (Array.isArray(plan.tasks) ? plan.tasks : []).forEach(task => {
        if (task?.taskType === 'homework' && task.homeworkId && PLAN_DAYS.includes(task.dueDay)) days.set(String(task.homeworkId), task.dueDay);
    });
    return days;
}

export function resolveSelectedPlanHomeworks({ student, plan, branch, getHomeworks } = {}) {
    const selectedIds = new Set(getSelectedHomeworkIds(plan));
    const eligible = getEligiblePlanHomeworks({ student, branch, weekStart: plan?.weekStart, weekEnd: plan?.weekEnd, getHomeworks });
    return eligible.filter(homework => selectedIds.has(String(homework.id)));
}

export function sumSelectedHomeworkQuestions(homeworks = []) {
    return homeworks.reduce((total, homework) => {
        const count = Number(homework?.soruSayisi);
        return total + (Number.isInteger(count) && count > 0 ? count : 0);
    }, 0);
}

export function calculateRemainingQuestionTarget(weeklyQuestionTarget, selectedHomeworkQuestionTotal) {
    const target = Number(weeklyQuestionTarget);
    const selected = Number(selectedHomeworkQuestionTotal);
    return Math.max((Number.isInteger(target) && target > 0 ? target : 0) - (Number.isFinite(selected) ? selected : 0), 0);
}

export function getPlanHomeworkPlacementDay(homework, plan) {
    const manualDay = getHomeworkManualDays(plan).get(String(homework?.id));
    if (manualDay) return manualDay;
    const dueDate = validDate(homework?.bitisTarihi);
    if (dueDate && plan?.weekStart && plan?.weekEnd && dueDate >= plan.weekStart && dueDate <= plan.weekEnd) {
        return PLAN_DAYS[(new Date(`${dueDate}T12:00:00`).getDay() + 6) % 7];
    }
    return null;
}

/**
 * Coaching Plan Model — Pure helpers for safe schema evolution.
 * Read-only, deterministic, zero side-effects.
 * Legacy studyPlan / studyPlanProfile fields are NEVER mutated.
 */

export const COACHING_PLAN_VERSION = 1;

export const TASK_TYPES = {
    question: 'Soru Çözümü',
    exam: 'Deneme',
    review: 'Tekrar',
    reading: 'Okuma',
    custom: 'Diğer'
};

export const PLAN_STATUSES = {
    draft: 'Taslak',
    active: 'Aktif',
    completed: 'Tamamlandı',
    archived: 'Arşivlendi'
};

const CANONICAL_DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

function safeNumber(val, fallback = 0) {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
}

function safeString(val, fallback = '') {
    return typeof val === 'string' ? val : fallback;
}

function generateId() {
    return 'cp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * Returns the Monday of the week containing the given date.
 */
export function getWeekStart(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + offset);
    d.setHours(0, 0, 0, 0);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

/**
 * Returns the Sunday end of the week for a given weekStart.
 */
export function getWeekEnd(weekStart) {
    if (!weekStart || typeof weekStart !== 'string') return null;
    const parts = weekStart.split('-').map(Number);
    if (parts.length !== 3 || parts.some(v => !Number.isFinite(v))) return null;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + 6);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

/**
 * Creates a minimal empty coaching plan.
 */
export function createEmptyCoachingPlan(overrides = {}) {
    const now = new Date().toISOString();
    return {
        version: COACHING_PLAN_VERSION,
        id: generateId(),
        status: 'draft',
        weekStart: getWeekStart(),
        weekEnd: getWeekEnd(getWeekStart()),
        weeklyTargets: {
            totalQuestions: null,
            generalExams: null,
            branchExams: null,
            readingTarget: null,
            reviewSessions: null
        },
        branchTargets: [],
        topicTargets: [],
        tasks: [],
        createdAt: now,
        updatedAt: now,
        ...overrides
    };
}

/**
 * Normalizes a raw coaching plan object from storage.
 * Returns a safe, complete object. Does NOT mutate input.
 */
export function normalizeCoachingPlan(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const now = new Date().toISOString();
    const weekStart = safeString(raw.weekStart) || getWeekStart();
    const weekEnd = safeString(raw.weekEnd) || getWeekEnd(weekStart);

    return {
        version: safeNumber(raw.version, COACHING_PLAN_VERSION),
        id: safeString(raw.id) || generateId(),
        status: PLAN_STATUSES[raw.status] ? raw.status : 'draft',
        weekStart,
        weekEnd,
        weeklyTargets: normalizeWeeklyTargets(raw.weeklyTargets),
        branchTargets: normalizeBranchTargets(raw.branchTargets),
        topicTargets: normalizeTopicTargets(raw.topicTargets),
        tasks: normalizeTasks(raw.tasks),
        createdAt: safeString(raw.createdAt) || now,
        updatedAt: safeString(raw.updatedAt) || now
    };
}

function normalizeWeeklyTargets(raw) {
    if (!raw || typeof raw !== 'object') {
        return { totalQuestions: null, generalExams: null, branchExams: null, readingTarget: null, reviewSessions: null };
    }
    return {
        totalQuestions: raw.totalQuestions != null ? safeNumber(raw.totalQuestions) : null,
        generalExams: raw.generalExams != null ? safeNumber(raw.generalExams) : null,
        branchExams: raw.branchExams != null ? safeNumber(raw.branchExams) : null,
        readingTarget: raw.readingTarget != null ? safeNumber(raw.readingTarget) : null,
        reviewSessions: raw.reviewSessions != null ? safeNumber(raw.reviewSessions) : null
    };
}

function normalizeBranchTargets(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter(t => t && typeof t === 'object').map(t => ({
        id: safeString(t.id) || generateId(),
        subject: safeString(t.subject),
        questionTarget: t.questionTarget != null ? safeNumber(t.questionTarget) : null,
        examTarget: t.examTarget != null ? safeNumber(t.examTarget) : null
    }));
}

function normalizeTopicTargets(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter(t => t && typeof t === 'object').map(t => ({
        id: safeString(t.id) || generateId(),
        subject: safeString(t.subject),
        topic: safeString(t.topic),
        questionTarget: t.questionTarget != null ? safeNumber(t.questionTarget) : null
    }));
}

function normalizeTasks(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter(t => t && typeof t === 'object').map(t => ({
        id: safeString(t.id) || generateId(),
        title: safeString(t.title) || 'Görev',
        taskType: TASK_TYPES[t.taskType] ? t.taskType : 'custom',
        subject: t.subject != null ? safeString(t.subject) : null,
        topic: t.topic != null ? safeString(t.topic) : null,
        resource: t.resource != null ? safeString(t.resource) : null,
        questionTarget: t.questionTarget != null ? safeNumber(t.questionTarget) : null,
        completedCount: safeNumber(t.completedCount),
        completed: Boolean(t.completed),
        dueDay: CANONICAL_DAYS.includes(t.dueDay) ? t.dueDay : null,
        durationMinutes: t.durationMinutes != null ? safeNumber(t.durationMinutes) : null,
        notes: t.notes != null ? safeString(t.notes) : null
    }));
}

/**
 * Normalizes a legacy studyPlan day-keyed object into structured tasks.
 * READ-ONLY adapter — does NOT modify the original data.
 */
export function normalizeLegacyStudyPlan(studyPlan) {
    if (!studyPlan || typeof studyPlan !== 'object') return [];
    const tasks = [];
    for (const day of CANONICAL_DAYS) {
        const dayTasks = Array.isArray(studyPlan[day]) ? studyPlan[day] : [];
        dayTasks.forEach((raw, index) => {
            if (typeof raw === 'string' && raw.trim()) {
                tasks.push({
                    id: `legacy_${day}_${index}`,
                    title: raw.trim(),
                    taskType: 'custom',
                    subject: null,
                    topic: null,
                    resource: null,
                    questionTarget: null,
                    completedCount: 0,
                    completed: false,
                    dueDay: day,
                    durationMinutes: null,
                    notes: null,
                    _legacy: true
                });
            } else if (raw && typeof raw === 'object') {
                tasks.push({
                    id: safeString(raw.id) || `legacy_${day}_${index}`,
                    title: safeString(raw.title) || safeString(raw.konu) || safeString(raw.name) || safeString(raw.text) || 'Görev',
                    taskType: TASK_TYPES[raw.taskType] ? raw.taskType : 'custom',
                    subject: raw.subject != null ? safeString(raw.subject) : null,
                    topic: raw.topic != null ? safeString(raw.topic) : null,
                    resource: raw.resource != null ? safeString(raw.resource) : null,
                    questionTarget: raw.questionTarget != null ? safeNumber(raw.questionTarget) : null,
                    completedCount: safeNumber(raw.completedCount),
                    completed: Boolean(raw.completed || raw.tamamlandi),
                    dueDay: CANONICAL_DAYS.includes(raw.dueDay) ? raw.dueDay : day,
                    durationMinutes: raw.durationMinutes != null ? safeNumber(raw.durationMinutes) : null,
                    notes: raw.notes != null ? safeString(raw.notes) : null,
                    _legacy: true
                });
            }
        });
    }
    return tasks;
}

/**
 * Returns a safe task title string for rendering.
 * Handles both string and object tasks.
 */
export function getTaskTitle(task) {
    if (typeof task === 'string') {
        return task.split('·')[0]?.trim() || task;
    }
    if (task && typeof task === 'object') {
        return task.title || task.konu || task.name || task.text || 'Görev';
    }
    return 'Görev';
}

/**
 * Returns task duration in minutes from a legacy string task.
 * "Matematik - Konu testi · Pomodoro · 30 dk" → 30
 */
export function getTaskDurationMinutes(task) {
    if (typeof task === 'string') {
        const match = task.match(/(\d+)\s*dk/i);
        return match ? parseInt(match[1], 10) : null;
    }
    if (task && typeof task === 'object') {
        return task.durationMinutes || task.duration || task.sure || null;
    }
    return null;
}

/**
 * Returns task tags from a legacy string task.
 * "Matematik - Konu testi · Pomodoro · 30 dk" → ["Pomodoro", "30 dk"]
 */
export function getTaskTags(task) {
    if (typeof task === 'string') {
        const parts = task.split('·').map(p => p.trim()).slice(1);
        return parts;
    }
    return [];
}

/**
 * Determines the active plan for a student.
 * Priority: coachingPlan (active/draft) > legacy studyPlan.
 */
export function getActivePlan(student) {
    if (!student) return { type: 'none', coachingPlan: null, hasLegacy: false };

    const coachingPlan = student.coachingPlan && typeof student.coachingPlan === 'object'
        ? normalizeCoachingPlan(student.coachingPlan)
        : null;

    const hasLegacy = Boolean(
        student.studyPlan && typeof student.studyPlan === 'object' && Object.keys(student.studyPlan).length > 0
    );

    if (coachingPlan && (coachingPlan.status === 'active' || coachingPlan.status === 'draft')) {
        return { type: 'coaching', coachingPlan, hasLegacy };
    }

    if (hasLegacy) {
        return { type: 'legacy', coachingPlan: null, hasLegacy };
    }

    return { type: 'none', coachingPlan: null, hasLegacy: false };
}

/**
 * Checks if a student has any plan data (legacy or coaching).
 */
export function hasAnyPlan(student) {
    if (!student) return false;
    const active = getActivePlan(student);
    return active.type !== 'none';
}

/**
 * Returns combined tasks from coachingPlan + legacy studyPlan.
 * coachingPlan tasks take priority for the same dueDay.
 */
export function getCombinedTasks(student) {
    if (!student) return [];

    const active = getActivePlan(student);
    if (active.type === 'coaching' && active.coachingPlan) {
        return active.coachingPlan.tasks || [];
    }

    if (active.type === 'legacy') {
        return normalizeLegacyStudyPlan(student.studyPlan);
    }

    return [];
}

/**
 * Returns tasks grouped by dueDay for the 7-day grid.
 */
export function getTasksByDay(student) {
    const tasks = getCombinedTasks(student);
    const grid = {};
    CANONICAL_DAYS.forEach(d => { grid[d] = []; });

    tasks.forEach(task => {
        const day = task.dueDay;
        if (day && grid[day]) {
            grid[day].push(task);
        } else {
            grid['Pazar'] = grid['Pazar'] || [];
        }
    });

    return grid;
}

/**
 * Returns a summary of the active plan.
 */
export function getPlanSummary(student) {
    const active = getActivePlan(student);
    if (active.type === 'none') return null;

    if (active.type === 'coaching' && active.coachingPlan) {
        const plan = active.coachingPlan;
        const totalTasks = plan.tasks.length;
        const completedTasks = plan.tasks.filter(t => t.completed).length;
        return {
            type: 'coaching',
            status: plan.status,
            weekStart: plan.weekStart,
            weekEnd: plan.weekEnd,
            totalTasks,
            completedTasks,
            branchCount: plan.branchTargets.length,
            topicCount: plan.topicTargets.length,
            weeklyTargets: plan.weeklyTargets
        };
    }

    if (active.type === 'legacy') {
        const legacyTasks = normalizeLegacyStudyPlan(student.studyPlan);
        const totalTasks = legacyTasks.length;
        return {
            type: 'legacy',
            status: 'active',
            totalTasks,
            completedTasks: 0,
            branchCount: 0,
            topicCount: 0,
            weeklyTargets: null
        };
    }

    return null;
}

/**
 * Checks if legacy studyPlan fields are preserved (not mutated).
 */
export function isLegacyPreserved(student) {
    if (!student) return true;
    const sp = student.studyPlan;
    const spp = student.studyPlanProfile;
    if (sp && typeof sp === 'object') {
        for (const key of Object.keys(sp)) {
            if (Array.isArray(sp[key])) {
                for (const item of sp[key]) {
                    if (typeof item !== 'string') return false;
                }
            }
        }
    }
    return true;
}

/**
 * Creates a history snapshot from a coaching plan.
 */
export function createHistorySnapshot(coachingPlan) {
    if (!coachingPlan || typeof coachingPlan !== 'object') return null;
    const plan = normalizeCoachingPlan(coachingPlan);
    if (!plan) return null;
    return {
        id: plan.id,
        weekStart: plan.weekStart,
        weekEnd: plan.weekEnd,
        status: plan.status,
        weeklyTargets: { ...plan.weeklyTargets },
        branchTargets: plan.branchTargets.map(b => ({ ...b })),
        topicTargets: plan.topicTargets.map(t => ({ ...t })),
        tasks: plan.tasks.map(t => ({ ...t })),
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
        archivedAt: new Date().toISOString()
    };
}

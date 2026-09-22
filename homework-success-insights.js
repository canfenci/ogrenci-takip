export function calculateHomeworkSuccess(homework = {}) {
    const hasValue = value => value !== undefined && value !== null && String(value).trim() !== '';
    const toMetric = value => {
        if (!hasValue(value)) return 0;
        const numeric = Number(value);
        return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
    };
    const questionCount = toMetric(homework.soruSayisi);
    const wrong = toMetric(homework.yanlis);
    const blank = toMetric(homework.bos);
    if (questionCount === null || wrong === null || blank === null) return { valid: false, reason: 'metrics_must_be_non_negative_integers' };
    if (questionCount === 0) return null;
    if (wrong + blank > questionCount) return { valid: false, questionCount, wrong, blank };
    const correct = questionCount - wrong - blank;
    const rawRate = (correct / questionCount) * 100;
    return { valid: true, questionCount, correct, wrong, blank, successRate: Number(rawRate.toFixed(1)) };
}

export function formatHomeworkSuccess(homework = {}) {
    const result = calculateHomeworkSuccess(homework);
    if (!result || !result.valid) return null;
    const rate = Number.isInteger(result.successRate) ? result.successRate : result.successRate.toFixed(1);
    return `${result.questionCount} Soru · ${result.correct} Doğru · ${result.wrong} Yanlış · ${result.blank} Boş · %${rate} Başarı`;
}

function normalizeSubject(value) {
    return String(value || '').trim().toLocaleLowerCase('tr-TR');
}

function subjectsMatch(homeworkSubject, planSubject) {
    const hw = normalizeSubject(homeworkSubject);
    const plan = normalizeSubject(planSubject);
    return Boolean(hw && plan && (hw === plan || hw.includes(plan) || plan.includes(hw)));
}

function validDate(value) {
    const text = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function rangesOverlap(start, end, weekStart, weekEnd) {
    const from = validDate(start) || validDate(end);
    const to = validDate(end) || validDate(start);
    if (!weekStart || !weekEnd) return true;
    if (!from && !to) return true;
    return (from || to) <= weekEnd && (to || from) >= weekStart;
}

export function getAutomaticPlanHomeworks({ student, studentId, branch, weekStart, weekEnd, getHomeworks } = {}) {
    if (!student) return [];
    const homeworks = typeof getHomeworks === 'function' ? getHomeworks(student) : (Array.isArray(student.odevler) ? student.odevler : []);
    const manualDays = new Map();
    const planTasks = Array.isArray(student.coachingPlan?.tasks) ? student.coachingPlan.tasks : [];
    planTasks.forEach(task => {
        if (task?.taskType === 'homework' && task.homeworkId && task.dueDay) manualDays.set(String(task.homeworkId), task.dueDay);
    });
    return homeworks.filter(hw => hw && hw.id && subjectsMatch(hw.ders || hw.kaynakDers?.ders, branch))
        .filter(hw => rangesOverlap(hw.baslamaTarihi, hw.bitisTarihi, weekStart, weekEnd))
        .map(hw => ({
            ...hw,
            _automaticHomework: true,
            homeworkId: hw.id,
            homeworkStudentId: studentId || student.id,
            dueDay: manualDays.get(String(hw.id)) || null
        }));
}

export function getHomeworkPlacementDay(homework, weekStart, weekEnd) {
    if (homework?.dueDay) return homework.dueDay;
    const date = validDate(homework?.bitisTarihi);
    if (date && weekStart && weekEnd && date >= weekStart && date <= weekEnd) {
        const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        return days[new Date(`${date}T12:00:00`).getDay()];
    }
    return 'Hafta İçinde';
}

export function calculateHomeworkWeeklySummary(homeworks = []) {
    const summary = { assignedQuestions: 0, completedQuestions: 0, correct: 0, wrong: 0, blank: 0, successRate: null };
    homeworks.forEach(hw => {
        const total = calculateHomeworkSuccess({ soruSayisi: hw?.soruSayisi, yanlis: hw?.yanlis, bos: hw?.bos });
        const questionCount = Number(hw?.soruSayisi);
        if (Number.isInteger(questionCount) && questionCount > 0) summary.assignedQuestions += questionCount;
        if (hw?.durum === 'tamamlandi' && total?.valid) {
            summary.completedQuestions += total.questionCount;
            summary.correct += total.correct;
            summary.wrong += total.wrong;
            summary.blank += total.blank;
        }
    });
    summary.successRate = summary.completedQuestions > 0
        ? Number(((summary.correct / summary.completedQuestions) * 100).toFixed(1))
        : null;
    return summary;
}

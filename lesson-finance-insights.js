export const ATTENDANCE_LABELS = {
    planlandi: 'Planlandı / Henüz İşlenmedi',
    yapildi: 'Ders Yapıldı',
    gelmedi: 'Öğrenci Katılmadı',
    mazeretli: 'Mazeretli',
    iptal: 'İptal'
};

export function normalizeLessonStatus(lesson) {
    return ATTENDANCE_LABELS[lesson?.katilimDurumu] ? lesson.katilimDurumu : 'yapildi';
}

export function isBillableLesson(lesson) {
    return normalizeLessonStatus(lesson) === 'yapildi';
}

export function calculateLessonFinance(lessons = [], lessonFee = 0) {
    const fee = Number(lessonFee) || 0;
    const billable = lessons.filter(isBillableLesson);
    const paid = billable.filter(lesson => lesson.odendi === true);
    const pending = billable.filter(lesson => lesson.odendi !== true);
    const statusCounts = Object.fromEntries(Object.keys(ATTENDANCE_LABELS).map(status => [status, 0]));
    lessons.forEach(lesson => { statusCounts[normalizeLessonStatus(lesson)] += 1; });
    return {
        totalCount: lessons.length,
        billableCount: billable.length,
        paidCount: paid.length,
        pendingCount: pending.length,
        paidAmount: paid.length * fee,
        pendingAmount: pending.length * fee,
        totalAmount: billable.length * fee,
        statusCounts
    };
}

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

export function updateLessonAttendanceState(lesson, attendanceStatus) {
    const katilimDurumu = ATTENDANCE_LABELS[attendanceStatus]
        ? attendanceStatus
        : normalizeLessonStatus(lesson);
    return {
        ...lesson,
        katilimDurumu,
        odendi: katilimDurumu === 'yapildi' ? lesson?.odendi === true : false
    };
}

export function updateLessonPaymentState(lesson, isPaid) {
    return {
        ...lesson,
        odendi: isBillableLesson(lesson) ? isPaid === true : false
    };
}

export function getEffectiveLessonFee(lesson, fallbackFee = 0) {
    const rawVal = lesson?.ucret;
    if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
        const num = Number(rawVal);
        if (Number.isFinite(num) && num >= 0) {
            return num;
        }
    }
    const fallbackNum = Number(fallbackFee);
    if (Number.isFinite(fallbackNum) && fallbackNum >= 0) {
        return fallbackNum;
    }
    return 0;
}

export function calculateLessonFinance(lessons = [], lessonFee = 0) {
    const fallback = Number(lessonFee) || 0;
    const billable = lessons.filter(isBillableLesson);
    const paid = billable.filter(lesson => lesson.odendi === true);
    const pending = billable.filter(lesson => lesson.odendi !== true);
    const statusCounts = Object.fromEntries(Object.keys(ATTENDANCE_LABELS).map(status => [status, 0]));
    lessons.forEach(lesson => { statusCounts[normalizeLessonStatus(lesson)] += 1; });

    const paidAmount = paid.reduce((sum, lesson) => sum + getEffectiveLessonFee(lesson, fallback), 0);
    const pendingAmount = pending.reduce((sum, lesson) => sum + getEffectiveLessonFee(lesson, fallback), 0);
    const totalAmount = billable.reduce((sum, lesson) => sum + getEffectiveLessonFee(lesson, fallback), 0);

    return {
        totalCount: lessons.length,
        billableCount: billable.length,
        paidCount: paid.length,
        pendingCount: pending.length,
        paidAmount,
        pendingAmount,
        totalAmount,
        statusCounts
    };
}

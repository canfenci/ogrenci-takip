function normalizeTime(value) {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return String(value || '').trim();
    return `${match[1].padStart(2, '0')}:${match[2]}`;
}

export function findScheduleConflict({ studentId, day, time, students = [], schedulesByStudent = {}, ignoreLessonIndex = null }) {
    const normalizedDay = String(day || '').trim();
    const normalizedTime = normalizeTime(time);
    for (const student of students) {
        const lessons = schedulesByStudent[student.id] || [];
        const lessonIndex = lessons.findIndex((lesson, index) => {
            if (lesson.aktif === false) return false;
            if (student.id === studentId && index === ignoreLessonIndex) return false;
            return String(lesson.gun || '').trim() === normalizedDay && normalizeTime(lesson.saat) === normalizedTime;
        });
        if (lessonIndex !== -1) {
            return { student, lesson: lessons[lessonIndex], lessonIndex };
        }
    }
    return null;
}

export function buildScheduleConflictMessage(conflict, day, time) {
    const studentName = conflict?.student?.adSoyad || 'Başka bir öğrenci';
    const lessonName = conflict?.lesson?.dersAdi || 'ders';
    return `Ders çakışması: ${studentName} için ${day} günü saat ${normalizeTime(time)}'te ${lessonName} dersi bulunuyor. Lütfen farklı bir gün veya saat seçin.`;
}

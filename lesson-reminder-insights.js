export const REMINDER_MINUTES = 60;

const DAY_INDEX = {
    Pazar: 0,
    Pazartesi: 1,
    Salı: 2,
    Çarşamba: 3,
    Perşembe: 4,
    Cuma: 5,
    Cumartesi: 6
};

function parseTime(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return null;
    return { hour, minute };
}

function nextOccurrence(day, time, now) {
    const dayIndex = DAY_INDEX[day];
    const parsedTime = parseTime(time);
    if (dayIndex === undefined || !parsedTime) return null;
    const occurrence = new Date(now);
    occurrence.setHours(parsedTime.hour, parsedTime.minute, 0, 0);
    let daysAhead = (dayIndex - now.getDay() + 7) % 7;
    if (daysAhead === 0 && occurrence <= now) daysAhead = 7;
    occurrence.setDate(occurrence.getDate() + daysAhead);
    return occurrence;
}

export function normalizePhone(phone) {
    let normalized = String(phone || '').replace(/\D/g, '');
    if (normalized.startsWith('0')) normalized = `90${normalized.slice(1)}`;
    else if (!normalized.startsWith('90') && normalized.length === 10) normalized = `90${normalized}`;
    return normalized.length >= 12 ? normalized : '';
}

export function buildLessonReminderMessage(reminder) {
    return `Merhaba Sayın Velimiz,\n\n${reminder.studentName} öğrencimizin ${reminder.lessonName} dersi bugün saat ${reminder.time}'de başlayacaktır. Dersimize 1 saat kaldığını hatırlatmak isteriz.\n\nİyi çalışmalar dileriz.`;
}

export function buildLessonReminders(students, schedulesByStudent, now = new Date(), history = {}) {
    return students.flatMap(student => (schedulesByStudent[student.id] || [])
        .filter(lesson => lesson.aktif !== false)
        .map((lesson, lessonIndex) => {
            const lessonAt = nextOccurrence(lesson.gun, lesson.saat, now);
            if (!lessonAt) return null;
            const reminderAt = new Date(lessonAt.getTime() - REMINDER_MINUTES * 60 * 1000);
            const occurrenceKey = `${student.id}|${lesson.gun}|${lesson.saat}|${lesson.dersAdi}|${lessonAt.toISOString().slice(0, 10)}`;
            return {
                id: occurrenceKey,
                lessonIndex,
                studentId: student.id,
                studentName: student.adSoyad || 'Öğrenci',
                guardianPhone: student.veliTel || '',
                normalizedPhone: normalizePhone(student.veliTel),
                day: lesson.gun,
                time: lesson.saat,
                lessonName: lesson.dersAdi || 'Ders',
                lessonAt,
                reminderAt,
                isDue: now >= reminderAt && now < lessonAt,
                isSent: Boolean(history[occurrenceKey]?.sentAt),
                isNotified: Boolean(history[occurrenceKey]?.notifiedAt)
            };
        })
        .filter(Boolean))
        .sort((a, b) => a.lessonAt - b.lessonAt);
}

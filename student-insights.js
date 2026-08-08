const DAY_INDEX = {
    "Pazar": 0,
    "Pazartesi": 1,
    "Salı": 2,
    "Çarşamba": 3,
    "Perşembe": 4,
    "Cuma": 5,
    "Cumartesi": 6
};

function parseLocalDate(dateString) {
    if (!dateString || typeof dateString !== 'string') return null;
    const [year, month, day] = dateString.split('-').map(Number);
    if (!year || !month || !day) return null;
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
}

function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

export function formatTimelineDate(dateString) {
    const date = parseLocalDate(dateString);
    if (!date) return dateString || 'Tarih yok';
    return new Intl.DateTimeFormat('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(date);
}

export function getUpcomingLesson(schedule = [], now = new Date()) {
    const candidates = schedule.flatMap((lesson, index) => {
        const dayIndex = DAY_INDEX[lesson.gun];
        const [hour, minute] = String(lesson.saat || '').split(':').map(Number);
        if (dayIndex === undefined || !Number.isInteger(hour) || !Number.isInteger(minute)) return [];

        const lessonDate = new Date(now);
        lessonDate.setHours(hour, minute, 0, 0);
        let daysAhead = (dayIndex - now.getDay() + 7) % 7;
        if (daysAhead === 0 && lessonDate <= now) daysAhead = 7;
        lessonDate.setDate(lessonDate.getDate() + daysAhead);

        return [{ ...lesson, index, date: lessonDate }];
    });

    return candidates.sort((a, b) => a.date - b.date)[0] || null;
}

export function buildStudentTimeline(student, homeworks = [], lessonRecords = []) {
    const events = [];

    (student.denemeler || []).forEach(exam => {
        if (!exam.tarih) return;
        events.push({
            id: `exam-${exam.id || exam.tarih}`,
            date: exam.tarih,
            category: 'exam',
            icon: exam.tip === 'genel' ? '📘' : '🔬',
            title: exam.tip === 'genel' ? 'Genel deneme sonucu' : 'Branş denemesi sonucu',
            detail: `${exam.denemeAdi || 'İsimsiz deneme'} · ${safeNumber(exam.toplamNet).toFixed(2)} net`,
            tone: 'blue'
        });
    });

    homeworks.forEach(homework => {
        const date = homework.bitisTarihi || homework.baslamaTarihi;
        if (!date) return;
        const completed = homework.durum === 'tamamlandi';
        const result = completed && homework.dogru !== null && homework.dogru !== undefined
            ? ` · ${safeNumber(homework.dogru)}D ${safeNumber(homework.yanlis)}Y`
            : '';
        events.push({
            id: `homework-${homework.id || date}`,
            date,
            category: 'homework',
            icon: completed ? '✅' : '📝',
            title: completed ? 'Ödev tamamlandı' : 'Ödev teslim tarihi',
            detail: `${homework.konu || 'Konu belirtilmemiş'}${homework.yayin ? ` · ${homework.yayin}` : ''}${result}`,
            tone: completed ? 'green' : 'amber'
        });
    });

    lessonRecords.forEach((lesson, index) => {
        if (!lesson.tarih) return;
        events.push({
            id: `lesson-${lesson.dersNo || index}-${lesson.tarih}`,
            date: lesson.tarih,
            category: 'lesson',
            icon: '📖',
            title: `Ders kaydı${lesson.ders ? `: ${lesson.ders}` : ''}`,
            detail: [lesson.konu, lesson.icerik].filter(Boolean).join(' · ') || 'Ders içeriği belirtilmemiş',
            tone: 'purple'
        });
    });

    ((student.growthPlan && student.growthPlan.logs) || []).forEach((log, index) => {
        if (!log.date) return;
        events.push({
            id: `growth-${index}-${log.date}`,
            date: log.date,
            category: 'growth',
            icon: '⚡',
            title: 'Soru çözüm kaydı',
            detail: `${safeNumber(log.count)} soru çözüldü`,
            tone: 'indigo'
        });
    });

    return events.sort((a, b) => {
        const dateCompare = String(b.date).localeCompare(String(a.date));
        return dateCompare || a.category.localeCompare(b.category);
    });
}

export function calculateStudentSummary(student, homeworks = [], lessonRecords = [], schedule = [], now = new Date()) {
    const generalExams = (student.denemeler || [])
        .filter(exam => exam.tip === 'genel')
        .sort((a, b) => String(a.tarih || '').localeCompare(String(b.tarih || '')));
    const latestExam = generalExams.at(-1) || null;
    const previousExam = generalExams.at(-2) || null;
    const latestNet = latestExam ? safeNumber(latestExam.toplamNet) : null;
    const netChange = latestExam && previousExam
        ? Number((latestNet - safeNumber(previousExam.toplamNet)).toFixed(2))
        : null;
    const completedHomeworkCount = homeworks.filter(homework => homework.durum === 'tamamlandi').length;
    const homeworkCompletionRate = homeworks.length
        ? Math.round((completedHomeworkCount / homeworks.length) * 100)
        : null;
    const lastLesson = [...lessonRecords]
        .filter(lesson => lesson.tarih)
        .sort((a, b) => String(b.tarih).localeCompare(String(a.tarih)))[0] || null;

    return {
        latestExam,
        latestNet,
        netChange,
        homeworkCompletionRate,
        completedHomeworkCount,
        homeworkCount: homeworks.length,
        lastLesson,
        upcomingLesson: getUpcomingLesson(schedule, now)
    };
}

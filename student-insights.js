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

function round(value, digits = 2) {
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

function average(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
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
            title: exam.tip === 'genel' ? 'Genel deneme sonucu' : 'Konu denemesi sonucu',
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

export function calculateSmartExamAnalysis(student, homeworks = []) {
    const exams = student.denemeler || [];
    const generalExams = exams
        .filter(exam => exam.tip === 'genel')
        .sort((a, b) => String(a.tarih || '').localeCompare(String(b.tarih || '')));
    const branchExams = exams.filter(exam => exam.tip === 'branş');
    const latestExam = generalExams.at(-1) || null;
    const previousExam = generalExams.at(-2) || null;
    const recentThree = generalExams.slice(-3);
    const recentFive = generalExams.slice(-5);
    const recentThreeAverage = average(recentThree.map(exam => safeNumber(exam.toplamNet)));
    const recentFiveAverage = average(recentFive.map(exam => safeNumber(exam.toplamNet)));
    const latestChange = latestExam && previousExam
        ? round(safeNumber(latestExam.toplamNet) - safeNumber(previousExam.toplamNet))
        : null;

    const subjectAccumulator = {};
    recentFive.forEach(exam => {
        Object.entries(exam.dersSonuclari || {}).forEach(([subject, result]) => {
            const correct = safeNumber(result.dogru);
            const wrong = safeNumber(result.yanlis);
            const blank = safeNumber(result.bos);
            const questionCount = correct + wrong + blank;
            if (!subjectAccumulator[subject]) {
                subjectAccumulator[subject] = { subject, correct: 0, wrong: 0, blank: 0, questionCount: 0, examCount: 0 };
            }
            const accumulator = subjectAccumulator[subject];
            accumulator.correct += correct;
            accumulator.wrong += wrong;
            accumulator.blank += blank;
            accumulator.questionCount += questionCount;
            accumulator.examCount += 1;
        });
    });

    const subjectPerformance = Object.values(subjectAccumulator).map(subject => {
        const latestResult = latestExam?.dersSonuclari?.[subject.subject];
        const previousResult = previousExam?.dersSonuclari?.[subject.subject];
        const resultNet = result => result ? safeNumber(result.dogru) - (safeNumber(result.yanlis) / 3) : null;
        const latestSubjectNet = resultNet(latestResult);
        const previousSubjectNet = resultNet(previousResult);
        const trend = latestSubjectNet !== null && previousSubjectNet !== null
            ? round(latestSubjectNet - previousSubjectNet)
            : null;
        return {
            ...subject,
            successRate: subject.questionCount ? round((subject.correct / subject.questionCount) * 100, 1) : null,
            averageNet: subject.examCount ? round((subject.correct - (subject.wrong / 3)) / subject.examCount) : null,
            trend
        };
    }).sort((a, b) => (b.successRate ?? -1) - (a.successRate ?? -1));

    const topicAccumulator = {};
    branchExams.forEach(exam => {
        (exam.sorular || []).forEach(question => {
            const topic = question.konuAdi?.trim();
            if (!topic) return;
            if (!topicAccumulator[topic]) topicAccumulator[topic] = { topic, attempts: 0, errors: 0 };
            topicAccumulator[topic].attempts += 1;
            if (question.durum === 'yanlis' || question.durum === 'bos') topicAccumulator[topic].errors += 1;
        });
    });
    homeworks.filter(homework => homework.tur === 'Konu Denemesi' && homework.durum === 'tamamlandi').forEach(homework => {
        const topic = String(homework.konu || homework.kaynakDers?.konu || '').trim();
        if (!topic) return;
        const correct = safeNumber(homework.dogru);
        const wrong = safeNumber(homework.yanlis);
        if (!topicAccumulator[topic]) topicAccumulator[topic] = { topic, attempts: 0, errors: 0 };
        topicAccumulator[topic].attempts += correct + wrong;
        topicAccumulator[topic].errors += wrong;
    });

    const priorityTopics = Object.values(topicAccumulator)
        .filter(topic => topic.errors > 0)
        .map(topic => ({ ...topic, errorRate: round((topic.errors / topic.attempts) * 100, 1) }))
        .sort((a, b) => b.errors - a.errors || b.errorRate - a.errorRate)
        .slice(0, 3);

    const warnings = [];
    const seenIds = new Set();
    exams.forEach((exam, index) => {
        const examLabel = exam.denemeAdi || `${index + 1}. deneme`;
        if (!exam.tarih) warnings.push(`${examLabel}: tarih bilgisi eksik.`);
        if (exam.id && seenIds.has(exam.id)) warnings.push(`${examLabel}: yinelenen deneme kimliği var.`);
        if (exam.id) seenIds.add(exam.id);
        const values = [exam.toplamDogru, exam.toplamYanlis, exam.toplamBos];
        if (values.some(value => !Number.isFinite(Number(value)) || Number(value) < 0)) {
            warnings.push(`${examLabel}: sonuç alanlarında geçersiz değer var.`);
        }
        const answeredTotal = values.reduce((sum, value) => sum + safeNumber(value), 0);
        if (Number.isFinite(Number(exam.toplamSoru)) && answeredTotal !== Number(exam.toplamSoru)) {
            warnings.push(`${examLabel}: doğru, yanlış ve boş toplamı soru sayısıyla uyuşmuyor.`);
        }
    });

    const recommendations = [];
    if (generalExams.length < 2) {
        recommendations.push('Net eğilimi için en az 2 genel deneme sonucu girin.');
    }
    const weakestSubject = subjectPerformance.at(-1);
    if (weakestSubject && weakestSubject.successRate !== null) {
        recommendations.push(`${weakestSubject.subject} dersinde başarı %${weakestSubject.successRate}; haftalık tekrar ve hedefli soru çalışması planlayın.`);
    }
    if (priorityTopics[0]) {
        recommendations.push(`${priorityTopics[0].topic} konusu ${priorityTopics[0].errors} hatayla ilk çalışma önceliği olmalı.`);
    }
    if (latestChange !== null && latestChange < 0) {
        recommendations.push(`Son genel denemede ${Math.abs(latestChange).toFixed(2)} net düşüş var; son iki denemenin yanlışlarını karşılaştırın.`);
    }
    const targetNet = Number(student.hedefNet);
    if (latestExam && Number.isFinite(targetNet) && targetNet > safeNumber(latestExam.toplamNet)) {
        recommendations.push(`Hedefe ulaşmak için ${round(targetNet - safeNumber(latestExam.toplamNet)).toFixed(2)} netlik gelişim gerekiyor.`);
    }

    return {
        generalExamCount: generalExams.length,
        recentThreeAverage: recentThreeAverage === null ? null : round(recentThreeAverage),
        recentFiveAverage: recentFiveAverage === null ? null : round(recentFiveAverage),
        latestChange,
        subjectPerformance,
        strongestSubject: subjectPerformance[0] || null,
        weakestSubject: subjectPerformance.at(-1) || null,
        priorityTopics,
        warnings,
        recommendations
    };
}

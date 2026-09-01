// Öğrenci Kokpiti için yalnızca görüntüleme/selector hesapları.
// Veri yazma, Firebase ve mevcut analiz motorları bu modülün dışında tutulur.

const number = value => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const round = value => Math.round((value + Number.EPSILON) * 100) / 100;

export function getStudentInitials(name = '') {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length > 1) return `${parts[0][0]}${parts.at(-1)[0]}`.toLocaleUpperCase('tr-TR');
    return (parts[0] || 'Ö').slice(0, 2).toLocaleUpperCase('tr-TR');
}

export function formatCockpitNet(value) {
    return Number.isFinite(Number(value))
        ? new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(Number(value))
        : '—';
}

export function getCockpitData({ student, homeworks = [], summary, analysis, timeline = [] }) {
    const generalExams = (student.denemeler || [])
        .filter(exam => exam.tip === 'genel' && exam.tarih && Number.isFinite(Number(exam.toplamNet)))
        .sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)));
    const recentExams = generalExams.slice(-5);
    const averageWindow = generalExams.slice(-5);
    const averageNet = averageWindow.length
        ? round(averageWindow.reduce((sum, exam) => sum + number(exam.toplamNet), 0) / averageWindow.length)
        : null;
    const targetNet = Number(student.hedefNet);
    const targetGap = summary.latestNet !== null && Number.isFinite(targetNet) && targetNet > 0
        ? round(targetNet - summary.latestNet)
        : null;
    const pendingHomeworks = homeworks
        .filter(homework => homework.durum !== 'tamamlandi' && homework.bitisTarihi)
        .sort((a, b) => String(a.bitisTarihi).localeCompare(String(b.bitisTarihi)));
    const strongest = analysis.strongestSubject?.successRate !== null ? analysis.strongestSubject : null;
    const weakest = analysis.weakestSubject?.successRate !== null ? analysis.weakestSubject : null;
    const criticalTopic = analysis.priorityTopics?.[0] || null;
    const errorCounts = {};
    (student.denemeler || []).forEach(exam => (exam.sorular || []).forEach(question => {
        if (!question.hataKodu || question.durum === 'dogru') return;
        errorCounts[question.hataKodu] = (errorCounts[question.hataKodu] || 0) + 1;
    }));
    const errorCandidates = Object.entries(errorCounts)
        .sort((a, b) => number(b[1]) - number(a[1]));
    const mostFrequentError = errorCandidates[0]
        ? { label: errorCandidates[0][0], count: number(errorCandidates[0][1]) }
        : null;
    const trendDelta = recentExams.length >= 2
        ? round(number(recentExams.at(-1).toplamNet) - number(recentExams[0].toplamNet))
        : null;
    const lastThree = recentExams.slice(-3);
    const lastThreeDelta = lastThree.length === 3
        ? round(number(lastThree.at(-1).toplamNet) - number(lastThree[0].toplamNet))
        : null;
    const priorities = criticalTopic
        ? `${criticalTopic.topic} tekrarı + 2 konu testi`
        : null;

    return {
        generalExams,
        recentExams,
        averageNet,
        averageCount: averageWindow.length,
        targetGap,
        pendingHomework: pendingHomeworks[0] || null,
        strongest,
        weakest,
        criticalTopic,
        mostFrequentError,
        priority: priorities,
        trendDelta,
        lastThreeDelta,
        timeline: timeline.slice(0, 7),
        upcomingLesson: summary.upcomingLesson || null,
        homeworkCompletionRate: summary.homeworkCompletionRate,
        homeworkCount: summary.homeworkCount,
        completedHomeworkCount: summary.completedHomeworkCount
    };
}

export function buildCockpitStatusItems(data) {
    const items = [];
    if (data.lastThreeDelta !== null) {
        items.push({
            tone: data.lastThreeDelta >= 0 ? 'positive' : 'critical',
            icon: data.lastThreeDelta >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down',
            text: data.lastThreeDelta >= 0
                ? `Son 3 genel denemede ${formatCockpitNet(data.lastThreeDelta)} net artış var.`
                : `Son 3 genel denemede ${formatCockpitNet(Math.abs(data.lastThreeDelta))} net düşüş var.`
        });
    }
    if (data.criticalTopic) items.push({ tone: 'warning', icon: 'fa-triangle-exclamation', text: `${data.criticalTopic.topic}, ${data.criticalTopic.errors} hatayla öncelikli konu.` });
    if (data.mostFrequentError) items.push({ tone: 'warning', icon: 'fa-magnifying-glass', text: `${data.mostFrequentError.label}, en sık görülen hata türü.` });
    if (data.homeworkCompletionRate !== null) items.push({ tone: data.homeworkCompletionRate >= 75 ? 'positive' : 'warning', icon: 'fa-list-check', text: `Ödev tamamlama oranı %${data.homeworkCompletionRate}.` });
    if (data.targetGap !== null) items.push({ tone: data.targetGap <= 0 ? 'positive' : 'neutral', icon: 'fa-bullseye', text: data.targetGap <= 0 ? 'Son deneme hedef nete ulaştı.' : `Hedef için ${formatCockpitNet(data.targetGap)} net daha gerekiyor.` });
    return items.slice(0, 4);
}

export const cockpitTimelineIcons = {
    exam: 'fa-file-lines',
    homework: 'fa-list-check',
    lesson: 'fa-book-open',
    growth: 'fa-chart-line'
};

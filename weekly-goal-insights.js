const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getWeekKey(now = new Date()) {
    const monday = new Date(now);
    const offset = monday.getDay() === 0 ? -6 : 1 - monday.getDay();
    monday.setDate(monday.getDate() + offset);
    monday.setHours(0, 0, 0, 0);
    return localDateString(monday);
}

function clampPercent(value, target) {
    return target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
}

function latestGeneralExam(student) {
    return (student.denemeler || [])
        .filter(exam => exam.tip === 'genel')
        .sort((a, b) => String(a.tarih || '').localeCompare(String(b.tarih || '')))
        .at(-1) || null;
}

function getWeakestSubject(student) {
    const accumulator = {};
    (student.denemeler || []).filter(exam => exam.tip === 'genel').slice(-5).forEach(exam => {
        Object.entries(exam.dersSonuclari || {}).forEach(([subject, result]) => {
            if (!accumulator[subject]) accumulator[subject] = { correct: 0, total: 0 };
            accumulator[subject].correct += Number(result.dogru) || 0;
            accumulator[subject].total += (Number(result.dogru) || 0) + (Number(result.yanlis) || 0) + (Number(result.bos) || 0);
        });
    });
    return Object.entries(accumulator)
        .filter(([, value]) => value.total > 0)
        .map(([subject, value]) => ({ subject, success: Math.round((value.correct / value.total) * 100) }))
        .sort((a, b) => a.success - b.success)[0] || null;
}

export function calculateWeeklyGoalProgress(student, now = new Date()) {
    const weekKey = getWeekKey(now);
    const goals = {
        questionTarget: Number(student.weeklyGoals?.questionTarget || student.growthPlan?.weeklyTarget) || 500,
        taskTarget: Number(student.weeklyGoals?.taskTarget) || 5,
        netTarget: Number(student.weeklyGoals?.netTarget || student.hedefNet) || 0
    };
    const nextWeek = new Date(`${weekKey}T00:00:00`);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const questionCount = (student.growthPlan?.logs || []).reduce((total, log) => {
        const date = new Date(`${log.date}T00:00:00`);
        return date >= new Date(`${weekKey}T00:00:00`) && date < nextWeek ? total + (Number(log.count) || 0) : total;
    }, 0);
    const allStudyTasks = Object.entries(student.studyPlan || {}).flatMap(([day, tasks]) =>
        (tasks || []).map((task, index) => ({ id: `${day}|${index}|${task}`, day, task })));
    const completedIds = student.weeklyGoalProgress?.[weekKey]?.completedTasks || [];
    const completedTaskCount = allStudyTasks.filter(task => completedIds.includes(task.id)).length;
    const latestExam = latestGeneralExam(student);
    const latestNet = Number(latestExam?.toplamNet) || 0;
    const questionPercent = clampPercent(questionCount, goals.questionTarget);
    const taskPercent = clampPercent(completedTaskCount, goals.taskTarget);
    const netPercent = clampPercent(latestNet, goals.netTarget);
    const overallPercent = Math.round((questionPercent + taskPercent + netPercent) / 3);
    const weakest = getWeakestSubject(student);
    const recommendation = weakest
        ? `${weakest.subject} başarısı %${weakest.success}; bu hafta konu tekrarı ve hedefli soru çalışması ekleyin.`
        : 'Deneme verisi oluşana kadar temel tekrar ve düzenli soru çözümüne odaklanın.';

    return {
        weekKey,
        goals,
        questionCount,
        completedTaskCount,
        plannedTaskCount: allStudyTasks.length,
        latestNet,
        latestExamName: latestExam?.denemeAdi || null,
        questionPercent,
        taskPercent,
        netPercent,
        overallPercent,
        recommendation,
        todayName: DAY_NAMES[now.getDay()],
        todayTasks: allStudyTasks.filter(task => task.day === DAY_NAMES[now.getDay()]).map(task => ({ ...task, completed: completedIds.includes(task.id) }))
    };
}

export function buildTodayItems(student, homeworks = [], schedule = [], now = new Date()) {
    const today = localDateString(now);
    const todayName = DAY_NAMES[now.getDay()];
    const progress = calculateWeeklyGoalProgress(student, now);
    const homeworkItems = homeworks
        .filter(homework => homework.durum !== 'tamamlandi' && homework.bitisTarihi <= today)
        .map(homework => ({
            type: homework.bitisTarihi < today ? 'overdue' : 'homework',
            label: homework.konu || 'Ödev',
            detail: homework.bitisTarihi < today ? `Son tarih ${homework.bitisTarihi}` : 'Bugün teslim'
        }));
    const lessonItems = schedule
        .filter(lesson => lesson.gun === todayName && lesson.aktif !== false)
        .sort((a, b) => String(a.saat).localeCompare(String(b.saat)))
        .map(lesson => ({ type: 'lesson', label: lesson.dersAdi || 'Ders', detail: lesson.saat || 'Saat yok' }));
    const studyItems = progress.todayTasks
        .filter(task => !task.completed)
        .map(task => ({ type: 'study', label: task.task, detail: 'Bugünkü çalışma görevi', taskId: task.id }));
    return [...homeworkItems, ...lessonItems, ...studyItems];
}

export function buildWeeklySummaryMessage(student, progress, todayItems) {
    const urgentCount = todayItems.filter(item => item.type === 'overdue').length;
    return `Merhaba Sayın Velimiz,\n\n${student.adSoyad} öğrencimizin haftalık gelişim özeti:\n` +
        `• Soru hedefi: ${progress.questionCount}/${progress.goals.questionTarget}\n` +
        `• Çalışma görevi: ${progress.completedTaskCount}/${progress.goals.taskTarget}\n` +
        `• Son net: ${progress.latestNet}/${progress.goals.netTarget}\n` +
        `• Genel ilerleme: %${progress.overallPercent}\n` +
        `• Geciken ödev: ${urgentCount}\n\n` +
        `${progress.recommendation}\n\nİyi çalışmalar dileriz.`;
}

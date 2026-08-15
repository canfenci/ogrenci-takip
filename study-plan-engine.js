export const STUDY_TECHNIQUES = {
    feynman: 'Feynman Tekniği',
    pomodoro: 'Pomodoro Tekniği',
    spaced: 'Aralıklı Tekrar',
    recall: 'Aktif Hatırlatma',
    mindmap: 'Zihin Haritalama'
};

export const BRANCH_BADGES = {
    'Fen Bilimleri': { beginner: 'Bilim Kaşifi', intermediate: 'Deney Uzmanı', advanced: 'Bilim Ustası' },
    'Matematik': { beginner: 'Sayı Kaşifi', intermediate: 'Problem Çözücü', advanced: 'Matematik Stratejisti' },
    'Türkçe': { beginner: 'Sözcük Kaşifi', intermediate: 'Anlam Avcısı', advanced: 'Dil Stratejisti' },
    'Sosyal Bilgiler': { beginner: 'Tarih Kaşifi', intermediate: 'Kronoloji Uzmanı', advanced: 'Tarih Stratejisti' },
    'İnkılap Tarihi ve Sosyal Bilgiler': { beginner: 'Tarih Kaşifi', intermediate: 'Kronoloji Uzmanı', advanced: 'Tarih Stratejisti' },
    general: { beginner: 'Çalışma Kaşifi', intermediate: 'Planlı Öğrenci', advanced: 'Öğrenme Stratejisti' }
};

const GENERAL_SUBJECT_KEYS = {
    'Sosyal Bilgiler': 'İnkılap Tarihi ve Sosyal Bilgiler',
    'İnkılap Tarihi / Sosyal Bilgiler': 'İnkılap Tarihi ve Sosyal Bilgiler'
};

export function getStudyBadge(subject, stage) {
    const badges = BRANCH_BADGES[subject] || BRANCH_BADGES.general;
    return badges[stage] || badges.beginner;
}

export function calculateStudyProfile(student, subject = '') {
    const subjectKey = GENERAL_SUBJECT_KEYS[subject] || subject;
    const scores = [];
    const exams = Array.isArray(student?.denemeler) ? student.denemeler : [];
    exams.slice(-5).forEach(exam => {
        if (exam.tip === 'genel') {
            const result = exam.dersSonuclari?.[subjectKey];
            const total = result ? Number(result.dogru || 0) + Number(result.yanlis || 0) + Number(result.bos || 0) : 0;
            if (total > 0) scores.push((Number(result.dogru || 0) / total) * 100);
        } else if (!subject || exam.ders === subject) {
            const questions = Array.isArray(exam.sorular) ? exam.sorular : [];
            if (questions.length) scores.push((questions.filter(question => question.durum === 'dogru').length / questions.length) * 100);
        }
    });

    const allHomework = Array.isArray(student?.odevler) ? student.odevler : [];
    const homework = subject
        ? allHomework.filter(item => !item.ders && !item.kaynakDers?.ders || item.ders === subject || item.kaynakDers?.ders === subject)
        : allHomework;
    const completed = homework.filter(item => item.durum === 'tamamlandi').length;
    const completionRate = homework.length ? (completed / homework.length) * 100 : null;
    const examRate = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
    const dataPoints = scores.length + homework.length;
    const score = examRate === null
        ? completionRate === null ? 0 : completionRate
        : completionRate === null ? examRate : (examRate * 0.7) + (completionRate * 0.3);
    const stage = dataPoints < 3 || score < 45 ? 'beginner' : score < 75 ? 'intermediate' : 'advanced';
    const intensity = dataPoints < 3 || completionRate === null || completionRate < 50
        ? 'light'
        : completionRate >= 80 && score >= 75 ? 'intensive' : 'balanced';

    return {
        score: Math.round(score),
        stage,
        intensity,
        dataPoints,
        examRate: examRate === null ? null : Math.round(examRate),
        completionRate: completionRate === null ? null : Math.round(completionRate),
        confidence: dataPoints < 3 ? 'low' : dataPoints < 7 ? 'medium' : 'high'
    };
}

export function buildAdaptiveStudyPlan({ subject, stage, intensity, techniques, days, dailyMinutes }) {
    const plan = Object.fromEntries(['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map(day => [day, []]));
    const selectedDays = days.length ? days : ['Pazartesi', 'Çarşamba', 'Cuma'];
    const techniqueKeys = techniques.length ? techniques : ['pomodoro', 'recall'];
    const questionBase = stage === 'advanced' ? 30 : stage === 'intermediate' ? 20 : 10;
    const intensityFactor = intensity === 'intensive' ? 1.5 : intensity === 'balanced' ? 1.2 : 1;
    const questionCount = Math.round(questionBase * intensityFactor);
    const focusMinutes = Math.min(Number(dailyMinutes) || 30, stage === 'advanced' ? 40 : stage === 'intermediate' ? 25 : 20);
    const templates = [
        `Eksik konu tekrarı ve ${questionCount} soru`,
        `Konu testi (${questionCount} soru)`,
        'Yanlış soruların analizi ve tekrar çözümü',
        'Kaynak kitaptan çalışma',
        'Konu denemesi ve sonuç analizi',
        'Haftalık tekrar ve gelişim değerlendirmesi'
    ];

    selectedDays.forEach((day, index) => {
        const technique = STUDY_TECHNIQUES[techniqueKeys[index % techniqueKeys.length]];
        const prefix = subject || 'Genel Çalışma';
        plan[day].push(`${prefix} - ${templates[index % templates.length]} · ${technique} · ${focusMinutes} dk`);
        if (intensity === 'intensive' && index % 2 === 0) {
            plan[day].push(`${prefix} - Aktif hatırlatma ve kısa tekrar · 15 dk`);
        }
    });
    return plan;
}

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

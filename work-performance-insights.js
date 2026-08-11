function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : 0;
}

function round(value) {
    return Number(Number(value || 0).toFixed(2));
}

export function calculateWorkNet(correct, wrong) {
    return round(Math.max(0, safeNumber(correct) - (safeNumber(wrong) / 3)));
}

export function buildWorkPerformance(homeworks = [], filter = 'all') {
    const records = homeworks
        .filter(homework => homework.durum === 'tamamlandi' && homework.dogru !== null && homework.dogru !== undefined)
        .filter(homework => filter === 'all' || (filter === 'topic' ? homework.tur === 'Konu Denemesi' : homework.tur !== 'Konu Denemesi'))
        .map(homework => ({
            id: homework.id,
            date: homework.bitisTarihi || homework.baslamaTarihi || '',
            label: homework.calismaDetayi || homework.konu || 'Çalışma',
            topic: homework.konu || '',
            type: homework.tur || 'Diğer',
            correct: safeNumber(homework.dogru),
            wrong: safeNumber(homework.yanlis),
            net: calculateWorkNet(homework.dogru, homework.yanlis)
        }))
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const average = key => records.length ? round(records.reduce((sum, record) => sum + record[key], 0) / records.length) : null;
    return {
        records,
        count: records.length,
        averageCorrect: average('correct'),
        averageWrong: average('wrong'),
        averageNet: average('net')
    };
}

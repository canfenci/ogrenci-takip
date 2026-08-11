function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : 0;
}

function round(value) {
    return Number(Number(value || 0).toFixed(2));
}

export function calculateTopicTestNet(correct, wrong) {
    return round(Math.max(0, safeNumber(correct) - (safeNumber(wrong) / 3)));
}

export function buildTopicExamRecords(student, homeworks = []) {
    const records = [];
    (student?.denemeler || []).filter(exam => exam.tip === 'branş').forEach(exam => {
        const topicGroups = {};
        (exam.sorular || []).forEach(question => {
            const topic = String(question.konuAdi || exam.konu || 'Konu belirtilmemiş').trim();
            if (!topicGroups[topic]) topicGroups[topic] = { correct: 0, wrong: 0, blank: 0 };
            if (question.durum === 'dogru') topicGroups[topic].correct += 1;
            else if (question.durum === 'yanlis') topicGroups[topic].wrong += 1;
            else topicGroups[topic].blank += 1;
        });
        Object.entries(topicGroups).forEach(([topic, result]) => records.push({
            id: `${exam.id || exam.tarih}-${topic}`, source: 'exam', sourceId: exam.id,
            name: exam.denemeAdi || 'Konu Denemesi', date: exam.tarih || '', subject: exam.ders || '', topic,
            correct: result.correct, wrong: result.wrong, blank: result.blank,
            net: calculateTopicTestNet(result.correct, result.wrong)
        }));
    });
    homeworks.filter(homework => homework.tur === 'Konu Denemesi' && homework.durum === 'tamamlandi' && homework.dogru !== null && homework.dogru !== undefined).forEach(homework => {
        const correct = safeNumber(homework.dogru);
        const wrong = safeNumber(homework.yanlis);
        records.push({
            id: `homework-${homework.id}`, source: 'homework', sourceId: homework.id,
            lessonId: homework.kaynakDers?.lessonId || null, name: homework.yayin || 'Bağlantılı Konu Denemesi',
            date: homework.bitisTarihi || homework.baslamaTarihi || '', subject: homework.kaynakDers?.ders || homework.ders || '',
            topic: homework.konu || homework.kaynakDers?.konu || 'Konu belirtilmemiş', correct, wrong, blank: 0,
            net: calculateTopicTestNet(correct, wrong)
        });
    });
    return records.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function calculateTopicExamProgress(student, homeworks = []) {
    const records = buildTopicExamRecords(student, homeworks);
    const average = field => records.length ? round(records.reduce((sum, record) => sum + safeNumber(record[field]), 0) / records.length) : null;
    const topicMap = {};
    records.forEach(record => {
        if (!topicMap[record.topic]) topicMap[record.topic] = [];
        topicMap[record.topic].push(record);
    });
    const topics = Object.entries(topicMap).map(([topic, topicRecords]) => ({
        topic, count: topicRecords.length,
        averageCorrect: round(topicRecords.reduce((sum, record) => sum + record.correct, 0) / topicRecords.length),
        averageWrong: round(topicRecords.reduce((sum, record) => sum + record.wrong, 0) / topicRecords.length),
        averageNet: round(topicRecords.reduce((sum, record) => sum + record.net, 0) / topicRecords.length),
        latestNet: topicRecords.at(-1).net
    })).sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic, 'tr'));
    return { records, count: records.length, averageCorrect: average('correct'), averageWrong: average('wrong'), averageNet: average('net'), topics };
}

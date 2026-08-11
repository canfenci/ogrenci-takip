export function buildHomeworkErrorTopics({ homeworkType, assignedTopic, selectedTopic, subtopic, wrong }) {
    const wrongCount = Math.max(0, Number(wrong) || 0);
    if (!wrongCount) return [];
    const topic = homeworkType === 'Konu Denemesi' ? String(assignedTopic || '').trim() : String(selectedTopic || assignedTopic || '').trim();
    if (!topic) return [];
    return [{ konu: topic, altKonu: String(subtopic || '').trim(), adet: wrongCount }];
}

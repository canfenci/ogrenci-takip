export const MANUAL_SUBTOPIC_VALUE = '__manual__';

const SUBTOPICS = {
    'Mevsimlerin oluşumu': ['Eksen Eğikliği', 'Dünya’nın Güneş Etrafındaki Dolanımı', 'Güneş Işınlarının Geliş Açısı'],
    'İklim ve Hava Hareketleri': ['İklim ve Hava Olayları', 'Hava Tahminleri', 'Küresel İklim Değişikliği'],
    'DNA ve Genetik Kod': ['DNA’nın Yapısı', 'Gen', 'Kromozom', 'Nükleotid'],
    'Kalıtım': ['Çaprazlama', 'Genotip ve Fenotip', 'Akraba Evliliği'],
    'Katı basıncı': ['Kuvvet ve Yüzey Alanı', 'Günlük Hayatta Katı Basıncı'],
    'Sıvı Basıncı': ['Derinlik', 'Yoğunluk', 'Pascal Prensibi']
};

export function getSubtopicOptions(topic) {
    return SUBTOPICS[String(topic || '').trim()] || [];
}

export function buildHomeworkErrorTopics({ homeworkType, assignedTopic, selectedTopic, subtopic, wrong }) {
    const wrongCount = Math.max(0, Number(wrong) || 0);
    if (!wrongCount) return [];
    const topic = homeworkType === 'Konu Denemesi' ? String(assignedTopic || '').trim() : String(selectedTopic || assignedTopic || '').trim();
    if (!topic) return [];
    return [{ konu: topic, altKonu: String(subtopic || '').trim(), adet: wrongCount }];
}

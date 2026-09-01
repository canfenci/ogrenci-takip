// ==================== HOMEWORK ERROR TOPICS & ANALYSIS HELPERS ====================

import {
    CURRICULUM_UNITS,
    getUnitsAndTopicsBySinifAndDers,
    getUnitListBySinifAndDers,
    getTopicsForUnit
} from './store.js';

export {
    CURRICULUM_UNITS,
    getUnitsAndTopicsBySinifAndDers,
    getUnitListBySinifAndDers,
    getTopicsForUnit
};

export const HATA_NEDENLERI = [
    { key: "bilgi_eksikligi", label: "Bilgi Eksikliği", shortKod: "BE", color: "amber" },
    { key: "dikkatsizlik", label: "Dikkatsizlik", shortKod: "D", color: "blue" },
    { key: "yanlis_okuma", label: "Soruyu Yanlış Okuma", shortKod: "YO", color: "gray" },
    { key: "sure_yetmedi", label: "Süre Yetmedi", shortKod: "ZY", color: "amber" },
    { key: "islem_hatasi", label: "İşlem Hatası", shortKod: "İH", color: "red" },
    { key: "yorumlama_hatasi", label: "Yorumlama / Çıkarım Hatası", shortKod: "KY", color: "purple" },
    { key: "diger", label: "Diğer", shortKod: "DİĞ", color: "gray" }
];

export function normalizeHataNedeniLabel(val) {
    const raw = String(val || "").trim();
    if (!raw) return "";
    const map = {
        "bilgi_eksikligi": "Bilgi Eksikliği",
        "BE": "Bilgi Eksikliği",
        "Bilgi Eksikliği": "Bilgi Eksikliği",

        "dikkatsizlik": "Dikkatsizlik",
        "D": "Dikkatsizlik",
        "Dikkatsizlik": "Dikkatsizlik",

        "yanlis_okuma": "Soruyu Yanlış Okuma",
        "YO": "Soruyu Yanlış Okuma",
        "Yanlış Okuma": "Soruyu Yanlış Okuma",
        "Soruyu Yanlış Okuma": "Soruyu Yanlış Okuma",

        "sure_yetmedi": "Süre Yetmedi",
        "ZY": "Süre Yetmedi",
        "Zaman Yetmedi": "Süre Yetmedi",
        "Süre Yetmedi": "Süre Yetmedi",

        "islem_hatasi": "İşlem Hatası",
        "İH": "İşlem Hatası",
        "İşlem Hatası": "İşlem Hatası",

        "yorumlama_hatasi": "Yorumlama / Çıkarım Hatası",
        "KY": "Yorumlama / Çıkarım Hatası",
        "Kavram Yanılgısı": "Yorumlama / Çıkarım Hatası",
        "Yorumlama / Çıkarım Hatası": "Yorumlama / Çıkarım Hatası",
        "Yorumlama Hatası": "Yorumlama / Çıkarım Hatası",

        "diger": "Diğer",
        "DİĞ": "Diğer",
        "Diğer": "Diğer"
    };
    return map[raw] || raw;
}

export function normalizeHataNedeniKey(val) {
    const raw = String(val || "").trim();
    if (!raw) return "";
    const map = {
        "Bilgi Eksikliği": "bilgi_eksikligi",
        "BE": "bilgi_eksikligi",
        "bilgi_eksikligi": "bilgi_eksikligi",

        "Dikkatsizlik": "dikkatsizlik",
        "D": "dikkatsizlik",
        "dikkatsizlik": "dikkatsizlik",

        "Soruyu Yanlış Okuma": "yanlis_okuma",
        "Yanlış Okuma": "yanlis_okuma",
        "YO": "yanlis_okuma",
        "yanlis_okuma": "yanlis_okuma",

        "Süre Yetmedi": "sure_yetmedi",
        "Zaman Yetmedi": "sure_yetmedi",
        "ZY": "sure_yetmedi",
        "sure_yetmedi": "sure_yetmedi",

        "İşlem Hatası": "islem_hatasi",
        "İH": "islem_hatasi",
        "islem_hatasi": "islem_hatasi",

        "Yorumlama / Çıkarım Hatası": "yorumlama_hatasi",
        "Yorumlama Hatası": "yorumlama_hatasi",
        "Kavram Yanılgısı": "yorumlama_hatasi",
        "KY": "yorumlama_hatasi",
        "yorumlama_hatasi": "yorumlama_hatasi",

        "Diğer": "diger",
        "DİĞ": "diger",
        "diger": "diger"
    };
    return map[raw] || "diger";
}

export function normalizeHomeworkErrorAnalysis(homeworkOrArray) {
    if (!homeworkOrArray) return [];
    const list = Array.isArray(homeworkOrArray)
        ? homeworkOrArray
        : (homeworkOrArray.yanlisAnalizi || homeworkOrArray.yanlisKonular || []);

    if (!Array.isArray(list)) return [];

    return list.map(item => {
        if (!item || typeof item !== 'object') return null;
        const rawUnite = String(item.unite || '').trim();
        const rawKonu = String(item.konu || item.topic || '').trim();
        const rawAltKonu = String(item.altKonu || item.subtopic || '').trim();
        const adet = Math.max(0, Number(item.adet || item.count || item.yanlisSayisi) || 0);

        let unite = rawUnite;
        let konu = rawKonu;
        let altKonu = rawAltKonu;

        if (unite && konu) {
            altKonu = altKonu || konu;
        } else if (!unite && rawKonu && rawAltKonu) {
            unite = rawKonu;
            konu = rawAltKonu;
            altKonu = rawAltKonu;
        } else if (!unite && rawKonu) {
            unite = rawKonu;
            konu = rawKonu;
            altKonu = '';
        }

        let rawReasons = [];
        if (Array.isArray(item.hataNedenleri)) {
            rawReasons = item.hataNedenleri;
        } else if (item.hataNedeni) {
            rawReasons = [item.hataNedeni];
        } else if (item.hataTipi) {
            rawReasons = [item.hataTipi];
        } else if (item.hataKodu) {
            rawReasons = [item.hataKodu];
        }

        const hataNedenleri = rawReasons.map(normalizeHataNedeniLabel).filter(Boolean);
        const hataNedenleriKeys = rawReasons.map(normalizeHataNedeniKey).filter(Boolean);

        return {
            unite: unite || 'Genel',
            konu: konu || unite || 'Genel',
            altKonu: altKonu || '',
            adet: adet || 1,
            hataNedenleri,
            hataNedenleriKeys,
            hataNedenleriLabels: hataNedenleri
        };
    }).filter(Boolean);
}

export function validateErrorAnalysisTotal(items, totalWrong) {
    const wrongLimit = Math.max(0, Number(totalWrong) || 0);
    const normalized = normalizeHomeworkErrorAnalysis(items);
    const sum = normalized.reduce((acc, item) => acc + (Number(item.adet) || 0), 0);
    return {
        isValid: sum <= wrongLimit,
        sum,
        maxAllowed: wrongLimit,
        exceededBy: Math.max(0, sum - wrongLimit)
    };
}

export function buildHomeworkErrorTopics(params) {
    if (!params) return [];

    if (Array.isArray(params.entries) && params.entries.length > 0) {
        const wrongTotal = Math.max(0, Number(params.wrong) || 0);
        if (!wrongTotal) return [];
        return params.entries.map(entry => {
            const unite = String(entry.unite || entry.konu || '').trim();
            const konu = String(entry.konu || entry.altKonu || unite || '').trim();
            const adet = Math.max(1, Number(entry.adet) || 1);
            const rawReasons = Array.isArray(entry.hataNedenleri)
                ? entry.hataNedenleri
                : (entry.hataNedeni ? [entry.hataNedeni] : []);
            const canonicalKeys = rawReasons.map(normalizeHataNedeniKey).filter(Boolean);

            const res = {
                unite,
                konu,
                adet
            };
            if (canonicalKeys.length > 0) {
                res.hataNedenleri = canonicalKeys;
            }
            return res;
        }).filter(item => Boolean(item.konu || item.unite));
    }

    const wrongCount = Math.max(0, Number(params.wrong) || 0);
    if (!wrongCount) return [];
    const topic = params.homeworkType === 'Konu Denemesi'
        ? String(params.assignedTopic || '').trim()
        : String(params.selectedTopic || params.assignedTopic || '').trim();
    if (!topic) return [];

    const rawReasons = Array.isArray(params.hataNedenleri)
        ? params.hataNedenleri
        : (params.hataNedeni ? [params.hataNedeni] : []);
    const canonicalKeys = rawReasons.map(normalizeHataNedeniKey).filter(Boolean);

    const res = {
        unite: String(params.unite || topic).trim(),
        konu: String(params.konu || params.subtopic || topic).trim(),
        adet: wrongCount
    };
    if (canonicalKeys.length > 0) {
        res.hataNedenleri = canonicalKeys;
    }
    return [res];
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildStudentGuidanceDetail,
    getInterventionBeforeAfter,
    getErrorReasonsDistribution,
    getStudentActivityTimeline,
    getStudentMainProblemSummary
} from '../guidance-student-insights.js';

test('UX-06.2 Scenario A: High priority student detail generates complete decision support model', () => {
    const student = {
        id: 's1',
        adSoyad: 'Yağmur Aydın',
        sinif: '8',
        okul: 'Atatürk Ortaokulu',
        hedefNet: 18,
        denemeler: [
            { tip: 'genel', denemeAdi: '1. Deneme', tarih: '2026-08-10', toplamNet: 16.0 },
            { tip: 'genel', denemeAdi: '2. Deneme', tarih: '2026-08-20', toplamNet: 14.0 },
            { tip: 'genel', denemeAdi: '3. Deneme', tarih: '2026-08-28', toplamNet: 11.5 }
        ],
        odevler: [
            { id: 'hw1', durum: 'tamamlandi', yanlisKonular: [{ unite: 'Basınç', konu: 'Katı Basıncı', adet: 4, hataNedenleri: ['bilgi_eksikligi'] }] },
            { id: 'hw2', durum: 'tamamlandi', yanlisKonular: [{ unite: 'Basınç', konu: 'Katı Basıncı', adet: 3, hataNedenleri: ['bilgi_eksikligi'] }] }
        ]
    };

    const detail = buildStudentGuidanceDetail(student);
    assert.equal(detail.studentId, 's1');
    assert.equal(detail.priority, 'high');
    assert.equal(detail.priorityLabel, 'Yüksek');
    assert.ok(detail.mainProblemSummary.includes('Katı Basıncı') || detail.mainProblemSummary.includes('Bilgi Eksikliği') || detail.mainProblemSummary.includes('düşüş'));
    assert.equal(detail.recommendation.title, 'Konu Tekrarı + Temel Soru');
});

test('UX-06.2 Scenario B: Gracefully handles missing exam data without throwing', () => {
    const student = {
        id: 's_no_exam',
        adSoyad: 'Sınavsız Öğrenci',
        sinif: '7',
        denemeler: [],
        odevler: []
    };

    const detail = buildStudentGuidanceDetail(student);
    assert.equal(detail.priority, 'watch');
    assert.equal(detail.examTrend, null);
    assert.ok(detail.mainProblemSummary);
    assert.equal(detail.recentExams.length, 0);
});

test('UX-06.2 Scenario C: Repeated weak topics correctly identified with counts and unit details', () => {
    const student = {
        id: 's3',
        adSoyad: 'Ali Kaya',
        odevler: [
            { yanlisKonular: [{ unite: 'Mevsimler', konu: 'İklim', adet: 3 }] },
            { yanlisKonular: [{ unite: 'Mevsimler', konu: 'İklim', adet: 2 }] }
        ]
    };

    const detail = buildStudentGuidanceDetail(student);
    assert.ok(detail.repeatedTopics.length >= 1);
    assert.equal(detail.repeatedTopics[0].topic, 'İklim');
    assert.equal(detail.repeatedTopics[0].assignmentCount, 2);
    assert.equal(detail.repeatedTopics[0].errorCount, 5);
});

test('UX-06.2 Scenario D: Dominant error type and error reasons distribution calculate percentages', () => {
    const student = {
        odevler: [
            {
                durum: 'tamamlandi',
                yanlisKonular: [
                    { konu: 'Basınç', adet: 4, hataNedenleri: ['bilgi_eksikligi'] },
                    { konu: 'Kuvvet', adet: 1, hataNedenleri: ['dikkatsizlik'] }
                ]
            }
        ]
    };

    const dist = getErrorReasonsDistribution(student);
    assert.equal(dist[0].key, 'bilgi_eksikligi');
    assert.equal(dist[0].count, 4);
    assert.equal(dist[0].percentage, 80);
    assert.equal(dist[1].key, 'dikkatsizlik');
    assert.equal(dist[1].count, 1);
    assert.equal(dist[1].percentage, 20);
});

test('UX-06.2 Scenario E: Homework discipline calculates totals, overdue and completion rate', () => {
    const student = {
        odevler: [
            { durum: 'tamamlandi' },
            { durum: 'tamamlandi' },
            { durum: 'bekliyor', bitisTarihi: '2026-08-01' } // overdue
        ]
    };

    const detail = buildStudentGuidanceDetail(student);
    assert.equal(detail.discipline.total, 3);
    assert.equal(detail.discipline.completed, 2);
    assert.equal(detail.discipline.overdue, 1);
    assert.equal(detail.discipline.completionRate, 67);
});

test('UX-06.2 Scenario F: Active study plan profile metadata is read accurately', () => {
    const student = {
        id: 's_plan',
        adSoyad: 'Planlı Öğrenci',
        studyPlanProfile: {
            subject: 'Basınç Tekrarı',
            stage: 'intermediate',
            durationWeeks: 2,
            badge: 'Basınç Kaşifi',
            generatedAt: '2026-08-28'
        }
    };

    const detail = buildStudentGuidanceDetail(student);
    assert.ok(detail.activePlan);
    assert.equal(detail.activePlan.subject, 'Basınç Tekrarı');
    assert.equal(detail.activePlan.durationWeeks, 2);
    assert.equal(detail.activePlan.hasPlan, true);
});

test('UX-06.2 Scenario G: Before/After intervention measures positive net improvement', () => {
    const student = {
        id: 's_imp',
        adSoyad: 'Gelişen Öğrenci',
        studyPlanProfile: {
            subject: 'Basınç Programı',
            generatedAt: '2026-08-20'
        },
        denemeler: [
            { tip: 'genel', denemeAdi: 'Önceki Deneme', tarih: '2026-08-15', toplamNet: 10.0 },
            { tip: 'genel', denemeAdi: 'Sonraki Deneme', tarih: '2026-08-28', toplamNet: 12.5 }
        ]
    };

    const impact = getInterventionBeforeAfter(student);
    assert.equal(impact.hasIntervention, true);
    assert.equal(impact.status, 'measured');
    assert.equal(impact.impactStatus, 'positive');
    assert.equal(impact.impactLabel, 'Olumlu Değişim');
    assert.equal(impact.beforeNet, 10.0);
    assert.equal(impact.afterNet, 12.5);
    assert.equal(impact.delta, 2.5);
});

test('UX-06.2 Scenario H: Before/After returns pending_measurement when no post exam exists', () => {
    const student = {
        id: 's_pending',
        adSoyad: 'Bekleyen Öğrenci',
        studyPlanProfile: {
            subject: 'Yeni Program',
            generatedAt: '2026-08-30'
        },
        denemeler: [
            { tip: 'genel', denemeAdi: 'Geçmiş Deneme', tarih: '2026-08-25', toplamNet: 14.0 }
        ]
    };

    const impact = getInterventionBeforeAfter(student);
    assert.equal(impact.hasIntervention, true);
    assert.equal(impact.status, 'pending_measurement');
    assert.equal(impact.message, 'Henüz müdahale sonrası yeterli ölçüm yok.');
    assert.equal(impact.afterNet, null);
});

test('UX-06.2 Scenario I: Activity timeline returns items sorted newest first', () => {
    const student = {
        studyPlanProfile: { subject: 'Genel Plan', generatedAt: '2026-08-29' },
        dersKayitlari: [{ tarih: '2026-08-31', konu: 'Hücre' }],
        denemeler: [{ tip: 'genel', tarih: '2026-08-25', denemeAdi: 'Deneme' }]
    };

    const timeline = getStudentActivityTimeline(student, 5);
    assert.equal(timeline[0].date, '2026-08-31');
    assert.equal(timeline[0].type, 'lesson');
    assert.equal(timeline[1].date, '2026-08-29');
    assert.equal(timeline[1].type, 'plan');
    assert.equal(timeline[2].date, '2026-08-25');
    assert.equal(timeline[2].type, 'exam');
});

test('UX-06.2 Scenario J: Legacy homework error format compatibility for student detail', () => {
    const student = {
        odevler: [
            {
                durum: 'tamamlandi',
                yanlisKonular: [
                    { konu: 'Mevsimler', altKonu: 'Eksen Eğikliği', adet: 2, hataTipi: 'Dikkatsizlik' }
                ]
            }
        ]
    };

    const detail = buildStudentGuidanceDetail(student);
    assert.equal(detail.dominantError.key, 'dikkatsizlik');
    assert.equal(detail.dominantError.label, 'Dikkatsizlik');
});

test('UX-06.2.1 Scenario A: form_eksik is never generated as a canonical error key', () => {
    const student = {
        odevler: [
            {
                durum: 'tamamlandi',
                yanlisKonular: [
                    { konu: 'Basınç', adet: 2, hataNedenleri: ['bilgi_eksikligi'] },
                    { konu: 'Mevsimler', adet: 1, hataNedenleri: ['islem_hatasi'] }
                ]
            }
        ]
    };

    const dist = getErrorReasonsDistribution(student);
    const keys = dist.map(d => d.key);
    assert.ok(!keys.includes('form_eksik'));
});

test('UX-06.2.1 Scenario B: islem_hatasi maps cleanly to "İşlem Hatası"', () => {
    const student = {
        odevler: [{ durum: 'tamamlandi', yanlisKonular: [{ konu: 'Kuvvet', adet: 3, hataNedenleri: ['islem_hatasi'] }] }]
    };

    const dist = getErrorReasonsDistribution(student);
    assert.equal(dist[0].key, 'islem_hatasi');
    assert.equal(dist[0].label, 'İşlem Hatası');
    assert.equal(dist[0].count, 3);
});

test('UX-06.2.1 Scenario C: yorumlama_hatasi maps cleanly to "Yorumlama / Çıkarım Hatası"', () => {
    const student = {
        odevler: [{ durum: 'tamamlandi', yanlisKonular: [{ konu: 'Kalıtım', adet: 2, hataNedenleri: ['yorumlama_hatasi'] }] }]
    };

    const dist = getErrorReasonsDistribution(student);
    assert.equal(dist[0].key, 'yorumlama_hatasi');
    assert.equal(dist[0].label, 'Yorumlama / Çıkarım Hatası');
    assert.equal(dist[0].count, 2);
});

test('UX-06.2.1 Scenario D: Legacy error code normalization works across all historical keys (BE, D, YO, ZY, İH)', () => {
    const student = {
        odevler: [
            {
                durum: 'tamamlandi',
                yanlisKonular: [
                    { konu: 'Konu 1', adet: 1, hataTipi: 'BE' },
                    { konu: 'Konu 2', adet: 1, hataTipi: 'D' },
                    { konu: 'Konu 3', adet: 1, hataTipi: 'YO' },
                    { konu: 'Konu 4', adet: 1, hataTipi: 'ZY' },
                    { konu: 'Konu 5', adet: 1, hataTipi: 'İH' }
                ]
            }
        ]
    };

    const dist = getErrorReasonsDistribution(student);
    const keys = dist.map(d => d.key);
    assert.ok(keys.includes('bilgi_eksikligi'));
    assert.ok(keys.includes('dikkatsizlik'));
    assert.ok(keys.includes('yanlis_okuma'));
    assert.ok(keys.includes('sure_yetmedi'));
    assert.ok(keys.includes('islem_hatasi'));
});

test('UX-06.2.1 Scenario E: Unknown error reason safely falls back to "diger" / "Diğer"', () => {
    const student = {
        odevler: [
            {
                durum: 'tamamlandi',
                yanlisKonular: [
                    { konu: 'Konu X', adet: 2, hataTipi: 'Bilinmeyen Sebeb 123' }
                ]
            }
        ]
    };

    const dist = getErrorReasonsDistribution(student);
    assert.equal(dist[0].key, 'diger');
    assert.equal(dist[0].label, 'Diğer');
});

test('UX-06.2.1 Scenario F: Guidance detail UI action buttons and section titles do not contain decorative emojis', async () => {
    const fs = await import('node:fs');
    const guidanceCode = fs.readFileSync(new URL('../guidance.js', import.meta.url), 'utf8');

    // Detail section strings
    assert.doesNotMatch(guidanceCode, />\s*🧭/);
    assert.doesNotMatch(guidanceCode, />\s*📝/);
    assert.doesNotMatch(guidanceCode, />\s*📊/);
    assert.doesNotMatch(guidanceCode, />\s*🔍/);
});



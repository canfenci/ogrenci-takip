import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getRepeatedWeakTopics,
    getDominantErrorType,
    getExamTrendInsight,
    getHomeworkDisciplineInsight,
    getRecommendedIntervention,
    buildGuidancePriority,
    buildGuidanceCenterDashboard,
    getRecentStudentActivities
} from '../guidance-center-insights.js';

test('UX-06.1 Scenario A: Net decline + repeated topic -> assigns High priority', () => {
    const student = {
        id: 's1',
        adSoyad: 'Yağmur Aydın',
        sinif: '8',
        denemeler: [
            { tip: 'genel', tarih: '2026-08-15', toplamNet: 14.5 },
            { tip: 'genel', tarih: '2026-08-22', toplamNet: 12.0 },
            { tip: 'genel', tarih: '2026-08-29', toplamNet: 10.0 }
        ],
        odevler: [
            {
                id: 'hw1',
                durum: 'tamamlandi',
                dogru: 30,
                yanlis: 6,
                yanlisKonular: [{ unite: 'Basınç', konu: 'Katı Basıncı', adet: 4, hataNedenleri: ['bilgi_eksikligi'] }]
            },
            {
                id: 'hw2',
                durum: 'tamamlandi',
                dogru: 28,
                yanlis: 5,
                yanlisKonular: [{ unite: 'Basınç', konu: 'Katı Basıncı', adet: 3, hataNedenleri: ['bilgi_eksikligi'] }]
            },
            {
                id: 'hw3',
                durum: 'tamamlandi',
                dogru: 25,
                yanlis: 4,
                yanlisKonular: [{ unite: 'Basınç', konu: 'Katı Basıncı', adet: 2, hataNedenleri: ['bilgi_eksikligi'] }]
            }
        ]
    };

    const priority = buildGuidancePriority(student);
    assert.equal(priority.priority, 'high');
    assert.equal(priority.priorityLabel, 'Yüksek');
    assert.ok(priority.reasons.some(r => r.includes('düşüş') || r.includes('deneme')));
    assert.ok(priority.reasons.some(r => r.includes('Katı Basıncı')));
});

test('UX-06.1 Scenario B: Single weakness -> assigns Medium priority', () => {
    const student = {
        id: 's2',
        adSoyad: 'Ali Yılmaz',
        sinif: '7',
        denemeler: [
            { tip: 'genel', tarih: '2026-08-15', toplamNet: 12.0 },
            { tip: 'genel', tarih: '2026-08-29', toplamNet: 12.5 }
        ],
        odevler: [
            {
                id: 'hw1',
                durum: 'tamamlandi',
                dogru: 30,
                yanlis: 4,
                yanlisKonular: [{ unite: 'Kuvvet', konu: 'Sürat', adet: 2, hataNedenleri: ['dikkatsizlik'] }]
            },
            {
                id: 'hw2',
                durum: 'tamamlandi',
                dogru: 32,
                yanlis: 3,
                yanlisKonular: [{ unite: 'Kuvvet', konu: 'Sürat', adet: 2, hataNedenleri: ['dikkatsizlik'] }]
            }
        ]
    };

    const priority = buildGuidancePriority(student);
    assert.equal(priority.priority, 'medium');
    assert.equal(priority.priorityLabel, 'Orta');
    assert.ok(priority.reasons.some(r => r.includes('Sürat')));
});

test('UX-06.1 Scenario C: Stable student without critical errors -> assigns Watch (İzle)', () => {
    const student = {
        id: 's3',
        adSoyad: 'Zeynep Çelik',
        sinif: '8',
        denemeler: [
            { tip: 'genel', tarih: '2026-08-15', toplamNet: 16.0 },
            { tip: 'genel', tarih: '2026-08-29', toplamNet: 16.5 }
        ],
        odevler: [
            {
                id: 'hw1',
                durum: 'tamamlandi',
                dogru: 38,
                yanlis: 1,
                yanlisKonular: [{ unite: 'Mevsimler', konu: 'İklim', adet: 1, hataNedenleri: ['dikkatsizlik'] }]
            }
        ]
    };

    const priority = buildGuidancePriority(student);
    assert.equal(priority.priority, 'watch');
    assert.equal(priority.priorityLabel, 'İzle');
});

test('UX-06.1 Scenario D: Bilgi Eksikliği generates targeted concept repetition action', () => {
    const intervention = getRecommendedIntervention({
        dominantError: { key: 'bilgi_eksikligi', label: 'Bilgi Eksikliği', count: 6 },
        repeatedTopic: { topic: 'Katı Basıncı', isRepeated: true }
    });

    assert.equal(intervention.title, 'Konu Tekrarı + Temel Soru');
    assert.ok(intervention.action.includes('Katı Basıncı'));
    assert.ok(intervention.action.includes('konu tekrarı'));
});

test('UX-06.1 Scenario E: Dikkatsizlik generates controlled question-solving action', () => {
    const intervention = getRecommendedIntervention({
        dominantError: { key: 'dikkatsizlik', label: 'Dikkatsizlik', count: 5 }
    });

    assert.equal(intervention.title, 'Kontrollü Soru Rutini');
    assert.ok(intervention.action.includes('Kontrollü soru'));
});

test('UX-06.1 Scenario F: Repeated topic count calculation groups correctly', () => {
    const student = {
        odevler: [
            { yanlisKonular: [{ konu: 'Makaralar', adet: 2 }, { konu: 'Kaldıraçlar', adet: 1 }] },
            { yanlisKonular: [{ konu: 'Makaralar', adet: 3 }] }
        ],
        denemeler: [
            { sorular: [{ durum: 'yanlis', konu: 'Makaralar' }] }
        ]
    };

    const weakTopics = getRepeatedWeakTopics(student);
    assert.equal(weakTopics[0].topic, 'Makaralar');
    assert.equal(weakTopics[0].assignmentCount, 2);
    assert.equal(weakTopics[0].errorCount, 6); // 2 + 3 + 1
    assert.equal(weakTopics[0].isRepeated, true);
});

test('UX-06.1 Scenario G: Homework discipline calculation detects overdue homeworks', () => {
    const student = {
        odevler: [
            { durum: 'tamamlandi' },
            { durum: 'bekliyor', bitisTarihi: '2026-08-01' }, // Overdue
            { durum: 'bekliyor', bitisTarihi: '2026-08-02' }  // Overdue
        ]
    };

    const discipline = getHomeworkDisciplineInsight(student);
    assert.equal(discipline.total, 3);
    assert.equal(discipline.completed, 1);
    assert.equal(discipline.overdue, 2);
    assert.equal(discipline.isProblematic, true);
});

test('UX-06.1 Scenario H: Gracefully handles missing data, empty arrays, and no targets', () => {
    const emptyStudent = { id: 'empty', adSoyad: 'Boş Kayıt' };
    const priority = buildGuidancePriority(emptyStudent);

    assert.equal(priority.priority, 'watch');
    assert.equal(priority.priorityLabel, 'İzle');
    assert.ok(priority.reasons.length > 0);
    assert.ok(priority.recommendation.title);
});

test('UX-06.1 Scenario I: Legacy homework error format compatibility', () => {
    const legacyStudent = {
        odevler: [
            {
                durum: 'tamamlandi',
                yanlisKonular: [
                    { konu: 'Mevsimler', altKonu: 'Eksen Eğikliği', adet: 3, hataTipi: 'Bilgi Eksikliği' }
                ]
            }
        ]
    };

    const dominant = getDominantErrorType(legacyStudent);
    assert.equal(dominant.key, 'bilgi_eksikligi');
    assert.equal(dominant.label, 'Bilgi Eksikliği');
});

test('UX-06.1 Scenario J: 10+ students scale test aggregates metrics cleanly without performance delay', () => {
    const tenStudents = Array.from({ length: 12 }, (_, i) => ({
        id: `scale_${i + 1}`,
        adSoyad: `Öğrenci ${i + 1}`,
        sinif: '8',
        denemeler: i < 4 ? [
            { tip: 'genel', tarih: '2026-08-10', toplamNet: 15.0 },
            { tip: 'genel', tarih: '2026-08-25', toplamNet: 11.0 } // declining
        ] : [
            { tip: 'genel', tarih: '2026-08-10', toplamNet: 14.0 },
            { tip: 'genel', tarih: '2026-08-25', toplamNet: 14.5 }
        ],
        odevler: [
            {
                durum: 'tamamlandi',
                yanlisKonular: [{ konu: 'Basınç', adet: 3, hataNedenleri: ['bilgi_eksikligi'] }]
            }
        ],
        studyPlanProfile: i % 2 === 0 ? { subject: 'Fen Bilimleri', durationWeeks: 2, badge: 'Kaşif' } : null
    }));

    const start = performance.now();
    const dashboard = buildGuidanceCenterDashboard(tenStudents);
    const elapsed = performance.now() - start;

    assert.equal(dashboard.metrics.totalStudents, 12);
    assert.ok(dashboard.metrics.needIntervention >= 4);
    assert.equal(dashboard.metrics.activePlans, 6);
    assert.equal(dashboard.studentPriorities.length, 12);
    assert.ok(elapsed < 80, `Dashboard computation took ${elapsed}ms`);
});

test('UX-06.1.1 Scenario A & B: Chronological student activities are extracted and sorted newest first', () => {
    const sample = [
        {
            id: 's1',
            adSoyad: 'Yağmur Aydın',
            studyPlanProfile: { subject: 'Basınç Tekrar Programı', generatedAt: '2026-08-30T10:00:00Z' },
            denemeler: [{ tarih: '2026-08-25', denemeAdi: '2. Deneme', toplamNet: 14.5 }]
        },
        {
            id: 's2',
            adSoyad: 'Ali Yılmaz',
            dersKayitlari: [{ tarih: '2026-08-31', konu: 'Hücre Bölünmesi' }],
            odevler: [{ durum: 'tamamlandi', tamamlanmaTarihi: '2026-08-28', bitisTarihi: '2026-08-30', konu: 'Mitoz Testi' }]
        }
    ];

    const activities = getRecentStudentActivities(sample, 6);
    assert.ok(activities.length >= 4);
    assert.equal(activities[0].date, '2026-08-31');
    assert.equal(activities[0].studentName, 'Ali Yılmaz');
    assert.equal(activities[0].type, 'lesson');
    assert.equal(activities[1].date, '2026-08-30');
    assert.equal(activities[1].studentName, 'Yağmur Aydın');
    assert.equal(activities[1].type, 'plan');
});

test('UX-06.1.1 Scenario C: Limit parameter restricts timeline items to maximum allowed', () => {
    const sample = [
        {
            id: 's1',
            adSoyad: 'Öğrenci',
            denemeler: Array.from({ length: 10 }, (_, i) => ({
                tarih: `2026-08-${String(i + 10).padStart(2, '0')}`,
                denemeAdi: `Deneme ${i + 1}`,
                toplamNet: 15
            }))
        }
    ];

    const activities = getRecentStudentActivities(sample, 6);
    assert.equal(activities.length, 6);
    assert.equal(activities[0].date, '2026-08-19'); // newest first
});

test('UX-06.1.1 Scenario D: Handles missing and invalid dates gracefully without throwing', () => {
    const sample = [
        {
            id: 's_invalid',
            adSoyad: 'Hatalı Kayıt',
            studyPlanProfile: { subject: 'Program', generatedAt: null },
            dersKayitlari: [{ tarih: '' }, { tarih: 'geçersiz-tarih' }],
            denemeler: [{ tarih: undefined }]
        }
    ];

    const activities = getRecentStudentActivities(sample, 6);
    assert.equal(activities.length, 0);
});

test('UX-06.1.1 Scenario E: Empty state returns empty array', () => {
    const emptyActivities = getRecentStudentActivities([], 6);
    assert.deepEqual(emptyActivities, []);
});

test('UX-06.1.1 Scenario F: Active study plans are labeled as study plans, not fake interventions', () => {
    const sample = [
        {
            id: 's1',
            adSoyad: 'Yağmur Aydın',
            studyPlanProfile: { subject: 'Basınç Tekrar Programı', durationWeeks: 2, badge: 'Basınç Ustası' }
        }
    ];

    const dashboard = buildGuidanceCenterDashboard(sample);
    assert.equal(dashboard.activeInterventions.length, 1);
    assert.equal(dashboard.activeInterventions[0].subject, 'Basınç Tekrar Programı');
    assert.equal(dashboard.metrics.activePlans, 1);
});

test('UX-06.1.2 Scenario A: Deadline timestamp (bitisTarihi) alone does NOT generate a completion event', () => {
    const sample = [
        {
            id: 's1',
            adSoyad: 'Yağmur Aydın',
            odevler: [{ durum: 'bekliyor', bitisTarihi: '2026-09-06', konu: 'Basınç Fasikülü' }]
        }
    ];

    const activities = getRecentStudentActivities(sample, 6);
    assert.equal(activities.length, 0); // bitisTarihi alone without baslamaTarihi / completion date does not fabricate an event
});

test('UX-06.1.2 Scenario B: Assignment/start date (baslamaTarihi) generates "Ödev Verildi" label', () => {
    const sample = [
        {
            id: 's1',
            adSoyad: 'Yağmur Aydın',
            odevler: [{ baslamaTarihi: '2026-08-31', bitisTarihi: '2026-09-06', konu: 'Basınç Fasikülü' }]
        }
    ];

    const activities = getRecentStudentActivities(sample, 6);
    assert.equal(activities.length, 1);
    assert.equal(activities[0].typeLabel, 'Ödev Verildi');
    assert.equal(activities[0].detail, 'Basınç Fasikülü verildi');
    assert.equal(activities[0].date, '2026-08-31');
});

test('UX-06.1.2 Scenario C: Real completion timestamp (tamamlanmaTarihi/completedAt) generates "Ödev Tamamlandı"', () => {
    const sample = [
        {
            id: 's1',
            adSoyad: 'Yağmur Aydın',
            odevler: [{
                baslamaTarihi: '2026-08-31',
                bitisTarihi: '2026-09-06',
                tamamlanmaTarihi: '2026-09-02',
                durum: 'tamamlandi',
                konu: 'Katı Basıncı Testi'
            }]
        }
    ];

    const activities = getRecentStudentActivities(sample, 6);
    assert.equal(activities.length, 1);
    assert.equal(activities[0].typeLabel, 'Ödev Tamamlandı');
    assert.equal(activities[0].detail, 'Katı Basıncı Testi tamamlandı');
    assert.equal(activities[0].date, '2026-09-02');
});

test('UX-06.1.2 Scenario D: Homework with missing date is safely skipped', () => {
    const sample = [
        {
            id: 's1',
            adSoyad: 'Yağmur Aydın',
            odevler: [{ durum: 'tamamlandi', konu: 'Tarihsiz Ödev' }]
        }
    ];

    const activities = getRecentStudentActivities(sample, 6);
    assert.equal(activities.length, 0);
});



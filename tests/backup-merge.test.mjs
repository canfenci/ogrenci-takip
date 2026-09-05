import test from 'node:test';
import assert from 'node:assert/strict';
import { combineRestoreData, mergeNestedById, mergeStudents, buildFullBackup, validateFullBackup } from '../backup.js';

test('TECH-02 Scenario A: Existing newer exam survives in MERGE mode', () => {
    const current = {
        students: [
            {
                id: 's1',
                adSoyad: 'Ali',
                exams: [
                    { id: 'exam-old', net: 10 },
                    { id: 'exam-new', net: 15 }
                ]
            }
        ]
    };
    const incoming = {
        students: [
            {
                id: 's1',
                adSoyad: 'Ali',
                exams: [
                    { id: 'exam-old', net: 10 }
                ]
            }
        ]
    };

    const merged = combineRestoreData(current, incoming, 'merge');
    const student = merged.students.find(s => s.id === 's1');
    assert.equal(student.exams.length, 2, 'Both exams must survive');
    assert.equal(student.exams.some(e => e.id === 'exam-new'), true, 'Newer exam must not be deleted');
    assert.equal(student.exams.some(e => e.id === 'exam-old'), true, 'Old exam must exist');
});

test('TECH-02 Scenario B: Existing guidance record survives when incoming has empty array', () => {
    const current = {
        students: [
            {
                id: 's1',
                guidanceRecords: [
                    { id: 'gr-new', issue: 'Dikkat eksikliği', status: 'open' }
                ]
            }
        ]
    };
    const incoming = {
        students: [
            {
                id: 's1',
                guidanceRecords: []
            }
        ]
    };

    const merged = combineRestoreData(current, incoming, 'merge');
    const student = merged.students.find(s => s.id === 's1');
    assert.equal(student.guidanceRecords.length, 1);
    assert.equal(student.guidanceRecords[0].id, 'gr-new');
    assert.equal(student.guidanceRecords[0].issue, 'Dikkat eksikliği');
});

test('TECH-02 Scenario C: Existing growth logs survive when incoming has empty array', () => {
    const current = {
        students: [
            {
                id: 's1',
                growthLogs: [
                    { id: 'growth-new', date: '2026-09-01', count: 120 }
                ]
            }
        ]
    };
    const incoming = {
        students: [
            {
                id: 's1',
                growthLogs: []
            }
        ]
    };

    const merged = combineRestoreData(current, incoming, 'merge');
    const student = merged.students.find(s => s.id === 's1');
    assert.equal(student.growthLogs.length, 1);
    assert.equal(student.growthLogs[0].id, 'growth-new');
    assert.equal(student.growthLogs[0].count, 120);
});

test('TECH-02 Scenario D: Incoming new records are added', () => {
    const current = {
        students: [
            {
                id: 's1',
                exams: [{ id: 'exam-1', score: 80 }]
            }
        ]
    };
    const incoming = {
        students: [
            {
                id: 's1',
                exams: [{ id: 'exam-2', score: 90 }]
            }
        ]
    };

    const merged = combineRestoreData(current, incoming, 'merge');
    const student = merged.students.find(s => s.id === 's1');
    assert.equal(student.exams.length, 2);
    assert.deepEqual(student.exams.map(e => e.id), ['exam-1', 'exam-2']);
});

test('TECH-02 Scenario E: Same-ID record fields merge without erasing missing fields', () => {
    const current = {
        students: [
            {
                id: 's1',
                exams: [
                    { id: 'exam-1', net: 10, note: 'korunmalı', date: '2026-08-01' }
                ]
            }
        ]
    };
    const incoming = {
        students: [
            {
                id: 's1',
                exams: [
                    { id: 'exam-1', net: 12 }
                ]
            }
        ]
    };

    const merged = combineRestoreData(current, incoming, 'merge');
    const student = merged.students.find(s => s.id === 's1');
    assert.equal(student.exams.length, 1);
    const exam = student.exams[0];
    assert.equal(exam.id, 'exam-1');
    assert.equal(exam.net, 12, 'Net should be updated to incoming value');
    assert.equal(exam.note, 'korunmalı', 'Existing note must be preserved');
    assert.equal(exam.date, '2026-08-01', 'Existing date must be preserved');
});

test('TECH-02 Scenario F: Missing incoming top-level fields do not erase existing fields', () => {
    const current = {
        students: [
            {
                id: 's1',
                adSoyad: 'Mehmet Yılmaz',
                okul: 'Atatürk O.O.',
                sinif: '8',
                hedefLise: 'Fen Lisesi',
                hedefNet: '85',
                dersUcreti: '500',
                veliTel: '05551234567',
                studyPlanProfile: { badge: 'LGS Master', stage: 'advanced' }
            }
        ]
    };
    const incoming = {
        students: [
            {
                id: 's1',
                adSoyad: 'Mehmet Yılmaz (Güncel)',
                hedefNet: '88'
                // okul, sinif, veliTel, studyPlanProfile are omitted
            }
        ]
    };

    const merged = combineRestoreData(current, incoming, 'merge');
    const student = merged.students.find(s => s.id === 's1');
    assert.equal(student.adSoyad, 'Mehmet Yılmaz (Güncel)');
    assert.equal(student.hedefNet, '88');
    assert.equal(student.okul, 'Atatürk O.O.', 'Omitted okul must be preserved');
    assert.equal(student.sinif, '8', 'Omitted sinif must be preserved');
    assert.equal(student.veliTel, '05551234567', 'Omitted phone must be preserved');
    assert.equal(student.dersUcreti, '500', 'Omitted fee must be preserved');
    assert.deepEqual(student.studyPlanProfile, { badge: 'LGS Master', stage: 'advanced' });
});

test('TECH-02 Scenario G: REPLACE mode remains authoritative and removes absent records', () => {
    const current = {
        teacherProfile: { name: 'Eski Öğretmen' },
        students: [
            {
                id: 's1',
                adSoyad: 'Ali',
                exams: [
                    { id: 'exam-old' },
                    { id: 'exam-new' }
                ]
            },
            { id: 's2', adSoyad: 'Silinecek Öğrenci' }
        ],
        homeworks: [{ id: 'hw-old' }]
    };
    const incoming = {
        teacherProfile: { name: 'Yeni Öğretmen' },
        students: [
            {
                id: 's1',
                adSoyad: 'Ali (Snapshot)',
                exams: [
                    { id: 'exam-old' }
                ]
            }
        ],
        homeworks: []
    };

    const replaced = combineRestoreData(current, incoming, 'replace');
    assert.equal(replaced.students.length, 1);
    assert.equal(replaced.students[0].id, 's1');
    assert.equal(replaced.students[0].exams.length, 1, 'Absent exam-new should be removed in REPLACE mode');
    assert.equal(replaced.students[0].exams[0].id, 'exam-old');
    assert.equal(replaced.homeworks.length, 0, 'Absent homework should be removed in REPLACE mode');
    assert.equal(replaced.teacherProfile.name, 'Yeni Öğretmen');
});

test('TECH-02 Scenario H: Student only in existing is preserved in MERGE mode', () => {
    const current = {
        students: [
            { id: 's1', adSoyad: 'Öğrenci 1' },
            { id: 's2', adSoyad: 'Öğrenci 2' }
        ]
    };
    const incoming = {
        students: [
            { id: 's1', adSoyad: 'Öğrenci 1 (Güncel)' }
        ]
    };

    const merged = combineRestoreData(current, incoming, 'merge');
    assert.equal(merged.students.length, 2);
    assert.equal(merged.students.some(s => s.id === 's2' && s.adSoyad === 'Öğrenci 2'), true);
});

test('TECH-02 Scenario I: Student only in backup is added in MERGE mode', () => {
    const current = {
        students: [
            { id: 's1', adSoyad: 'Öğrenci 1' }
        ]
    };
    const incoming = {
        students: [
            { id: 's2', adSoyad: 'Öğrenci 2' }
        ]
    };

    const merged = combineRestoreData(current, incoming, 'merge');
    assert.equal(merged.students.length, 2);
    assert.deepEqual(merged.students.map(s => s.id), ['s1', 's2']);
});

test('TECH-02 Scenario J: Duplicate IDs in backup are deterministic', () => {
    const existing = [{ id: 'e1', count: 10, note: 'original' }];
    const incoming = [
        { id: 'e1', count: 20 },
        { id: 'e1', count: 30 }
    ];

    const merged = mergeNestedById(existing, incoming);
    assert.equal(merged.length, 1, 'Duplicate IDs must resolve to 1 entry');
    assert.equal(merged[0].id, 'e1');
    assert.equal(merged[0].count, 30, 'Last incoming record wins deterministically');
    assert.equal(merged[0].note, 'original', 'Preserves non-overwritten field');
});

test('TECH-02 Production Schema: denemeler, growthPlan.logs, and studyPlan merge correctly', () => {
    const current = {
        students: [
            {
                id: 's1',
                denemeler: [
                    { id: 'd1', tip: 'genel', toplamNet: 65, tarih: '2026-08-01' },
                    { id: 'd2', tip: 'genel', toplamNet: 72, tarih: '2026-08-15' }
                ],
                growthPlan: {
                    weeklyTarget: 400,
                    logs: [
                        { date: '2026-08-10', count: 50 },
                        { date: '2026-08-11', count: 60 }
                    ]
                },
                studyPlan: {
                    Pazartesi: ['Paragraf çöz', 'Matematik tekrar']
                }
            }
        ]
    };

    const incoming = {
        students: [
            {
                id: 's1',
                denemeler: [
                    { id: 'd1', tip: 'genel', toplamNet: 68 } // updated d1, d2 omitted
                ],
                growthPlan: {
                    weeklyTarget: 500,
                    logs: [
                        { date: '2026-08-10', count: 55 } // updated count, Aug 11 omitted
                    ]
                },
                studyPlan: {
                    Pazartesi: ['Fen testi'],
                    Salı: ['Deneme analizi']
                }
            }
        ]
    };

    const merged = combineRestoreData(current, incoming, 'merge');
    const s = merged.students[0];

    // denemeler: d2 survived, d1 updated
    assert.equal(s.denemeler.length, 2);
    assert.equal(s.denemeler.find(d => d.id === 'd1').toplamNet, 68);
    assert.equal(s.denemeler.find(d => d.id === 'd1').tarih, '2026-08-01');
    assert.equal(s.denemeler.find(d => d.id === 'd2').toplamNet, 72);

    // growthPlan: target updated, Aug 11 log survived, Aug 10 log updated
    assert.equal(s.growthPlan.weeklyTarget, 500);
    assert.equal(s.growthPlan.logs.length, 2);
    assert.equal(s.growthPlan.logs.find(l => l.date === '2026-08-10').count, 55);
    assert.equal(s.growthPlan.logs.find(l => l.date === '2026-08-11').count, 60);

    // studyPlan: unique tasks unioned
    assert.deepEqual(s.studyPlan.Pazartesi, ['Paragraf çöz', 'Matematik tekrar', 'Fen testi']);
    assert.deepEqual(s.studyPlan.Salı, ['Deneme analizi']);
});

test('TECH-02 Legacy Records: un-identified records use composite fallback identity', () => {
    const existing = [
        { tarih: '2026-07-01', tip: 'genel', denemeAdi: 'Deneme A', net: 50 },
        { tarih: '2026-07-15', tip: 'genel', denemeAdi: 'Deneme B', net: 55 }
    ];
    const incoming = [
        { tarih: '2026-07-01', tip: 'genel', denemeAdi: 'Deneme A', net: 52 }
    ];

    const merged = mergeNestedById(existing, incoming);
    assert.equal(merged.length, 2, 'Deneme B without ID must survive based on composite identity');
    assert.equal(merged.find(e => e.denemeAdi === 'Deneme A').net, 52, 'Deneme A should be updated');
    assert.equal(merged.find(e => e.denemeAdi === 'Deneme B').net, 55, 'Deneme B should be preserved');
});

test('TECH-02 Legacy Backup Compatibility: validateFullBackup and combineRestoreData accept standard v1 backup', () => {
    const full = buildFullBackup({
        students: [
            {
                id: 's-legacy',
                adSoyad: 'Eski Öğrenci',
                denemeler: [{ id: 'ex-1', toplamNet: 40 }]
            }
        ]
    });

    const validation = validateFullBackup(full);
    assert.equal(validation.ok, true);

    const merged = combineRestoreData({ students: [] }, full.data, 'merge');
    assert.equal(merged.students.length, 1);
    assert.equal(merged.students[0].adSoyad, 'Eski Öğrenci');
});

test('TECH-02.1 Scenario K: multiple legacy homeworks for same student survive without collision', () => {
    const existing = [
        { studentId: 's1', konu: 'Basınç', baslamaTarihi: '2026-08-10' },
        { studentId: 's1', konu: 'DNA', baslamaTarihi: '2026-08-17' },
        { studentId: 's1', konu: 'Mevsimler', baslamaTarihi: '2026-08-24' }
    ];
    const incoming = [
        { studentId: 's1', konu: 'Basınç', baslamaTarihi: '2026-08-10', durum: 'tamamlandi' },
        { studentId: 's1', konu: 'Madde', baslamaTarihi: '2026-08-31' }
    ];

    const merged = mergeNestedById(existing, incoming, 'homework');
    assert.equal(merged.length, 4, 'All 4 distinct topics must survive without collapsing');
    assert.deepEqual(merged.map(h => h.konu), ['Basınç', 'DNA', 'Mevsimler', 'Madde']);
    assert.equal(merged.find(h => h.konu === 'Basınç').durum, 'tamamlandi', 'Basınç status should be updated in-place');
    assert.equal(merged.find(h => h.konu === 'DNA').baslamaTarihi, '2026-08-17');
});

test('TECH-02.1 Scenario L: same-date different homework survives', () => {
    const existing = [
        { studentId: 's1', konu: 'Matematik Cebir', baslamaTarihi: '2026-08-10', calismaDetayi: 'Sayfa 10-20' },
        { studentId: 's1', konu: 'Fen Basınç', baslamaTarihi: '2026-08-10', calismaDetayi: 'Test 3' }
    ];
    const incoming = [
        { studentId: 's1', konu: 'Matematik Cebir', baslamaTarihi: '2026-08-10', durum: 'yapildi' }
    ];

    const merged = mergeNestedById(existing, incoming, 'homework');
    assert.equal(merged.length, 2, 'Different subjects on the same day must not collide');
    assert.equal(merged.find(h => h.konu === 'Matematik Cebir').durum, 'yapildi');
    assert.equal(merged.find(h => h.konu === 'Fen Basınç').calismaDetayi, 'Test 3');
});

test('TECH-02.1 Scenario M: same-date guidance records remain distinct', () => {
    const existing = [
        { date: '2026-08-10', type: 'academic', sorun: 'Deneme stresi', mudahale: 'Nefes egzersizi' },
        { date: '2026-08-10', type: 'academic', sorun: 'Zaman yönetimi', mudahale: 'Süre tutma taktiği' }
    ];
    const incoming = [
        { date: '2026-08-10', type: 'academic', sorun: 'Deneme stresi', plan: 'Haftalık takip' }
    ];

    const merged = mergeNestedById(existing, incoming, 'guidance');
    assert.equal(merged.length, 2, 'Distinct guidance notes on the same date must remain separate');
    const stresi = merged.find(g => g.sorun === 'Deneme stresi');
    assert.equal(stresi.plan, 'Haftalık takip');
    assert.equal(stresi.mudahale, 'Nefes egzersizi');
    const zaman = merged.find(g => g.sorun === 'Zaman yönetimi');
    assert.equal(zaman.mudahale, 'Süre tutma taktiği');
});

test('TECH-02.1 Scenario N: same-date different exams remain distinct', () => {
    const existing = [
        { tarih: '2026-08-10', tip: 'branş', ders: 'Matematik', toplamNet: 18 },
        { tarih: '2026-08-10', tip: 'branş', ders: 'Fen Bilimleri', toplamNet: 19 }
    ];
    const incoming = [
        { tarih: '2026-08-10', tip: 'branş', ders: 'Matematik', toplamNet: 19 }
    ];

    const merged = mergeNestedById(existing, incoming, 'exam');
    assert.equal(merged.length, 2, 'Matematik and Fen Bilimleri on the same date must not collide');
    assert.equal(merged.find(e => e.ders === 'Matematik').toplamNet, 19);
    assert.equal(merged.find(e => e.ders === 'Fen Bilimleri').toplamNet, 19);
});

test('TECH-02.1 Scenario O: fallback identity never collapses unrelated records or loses duplicates', () => {
    const existing = [
        { date: '2026-08-10', count: 50, note: 'Morning' },
        { date: '2026-08-10', count: 50, note: 'Evening session' }
    ];
    const incoming = [
        { date: '2026-08-10', count: 50, note: 'Morning updated' }
    ];

    const merged = mergeNestedById(existing, incoming, 'growth');
    assert.equal(merged.length, 2, 'Both duplicate existing entries must survive without data loss');
    assert.equal(merged[0].note, 'Morning updated');
    assert.equal(merged[1].note, 'Evening session');
});


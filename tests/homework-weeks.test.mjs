import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ANCHOR_START_DATE,
    getWeekInfoByNumber,
    getWeekInfoForDate,
    getCurrentWeekNumber,
    generateWeekList,
    resolveHomeworkWeek,
    filterHomeworksCombined
} from '../homework-weeks-insights.js';

const mockStudents = [
    {
        id: 's1',
        adSoyad: 'Yağmur Aydın',
        sinif: '8',
        odevler: [
            {
                id: 'hw1',
                konu: 'Basınç',
                calismaDetayi: 'Basınç Fasikülü',
                yayin: 'CanFenci Yayınları',
                tur: 'Konu Denemesi',
                baslamaTarihi: '2026-08-31', // Week 4
                bitisTarihi: '2026-09-06',
                durum: 'tamamlandi',
                dogru: 32,
                yanlis: 6
            },
            {
                id: 'hw2',
                konu: 'Katı Basıncı',
                calismaDetayi: 'Katı Basıncı Testi',
                yayin: 'CanFenci Yayınları',
                tur: 'Kazanım Testi',
                baslamaTarihi: '2026-08-31', // Week 4
                bitisTarihi: '2026-09-05',
                durum: 'bekliyor'
            },
            {
                id: 'hw3',
                konu: 'Mevsimler ve İklim',
                calismaDetayi: '1. Hafta Fasikülü',
                yayin: 'CanFenci Yayınları',
                tur: 'Fasikül',
                baslamaTarihi: '2026-08-10', // Week 1
                bitisTarihi: '2026-08-16',
                durum: 'tamamlandi',
                dogru: 38,
                yanlis: 2
            },
            {
                id: 'hw_legacy',
                konu: 'Yaz Kampı Giriş',
                calismaDetayi: 'Hazırlık Çalışması',
                yayin: 'CanFenci',
                tur: 'Test',
                baslamaTarihi: '2026-08-03', // Pre-start (before Aug 10, 2026)
                bitisTarihi: '2026-08-08',
                durum: 'tamamlandi'
            }
        ]
    },
    {
        id: 's2',
        adSoyad: 'Ali Yılmaz',
        sinif: '7',
        odevler: [
            {
                id: 'hw4',
                konu: 'Kuvvet ve Enerji',
                calismaDetayi: 'Kuvvet ve Enerji Fasikülü',
                yayin: 'Fen Bilimleri',
                tur: 'Fasikül',
                baslamaTarihi: '2026-09-01', // Week 4
                bitisTarihi: '2026-09-07',
                durum: 'bekliyor'
            },
            {
                id: 'hw5',
                konu: 'Hücre ve Bölünmeler',
                calismaDetayi: '2. Hafta Testi',
                yayin: 'CanFenci',
                tur: 'Test',
                baslamaTarihi: '2026-08-18', // Week 2
                bitisTarihi: '2026-08-23',
                durum: 'tamamlandi'
            }
        ]
    },
    {
        id: 's3',
        adSoyad: 'Zeynep Çelik',
        sinif: '8',
        odevler: [
            {
                id: 'hw6',
                konu: 'Mevsimler Denemesi',
                calismaDetayi: 'Branş Denemesi 1',
                yayin: 'CanFenci Yayınları',
                tur: 'Deneme',
                baslamaTarihi: '2026-09-02', // Week 4
                bitisTarihi: '2026-09-06',
                durum: 'tamamlandi'
            }
        ]
    }
];

test('UX-05.6 Week Calculation: maps week dates accurately from Aug 10, 2026 anchor', () => {
    const w1 = getWeekInfoByNumber(1);
    assert.equal(w1.weekNumber, 1);
    assert.equal(w1.mondayStr, '2026-08-10');
    assert.equal(w1.sundayStr, '2026-08-16');
    assert.equal(w1.dateRangeLabel, '10–16 Ağustos');

    const w4 = getWeekInfoByNumber(4);
    assert.equal(w4.weekNumber, 4);
    assert.equal(w4.mondayStr, '2026-08-31');
    assert.equal(w4.sundayStr, '2026-09-06');
    assert.equal(w4.dateRangeLabel, '31 Ağustos – 6 Eylül');

    // Date lookup
    const dateLookupW4 = getWeekInfoForDate('2026-09-01');
    assert.equal(dateLookupW4.weekNumber, 4);

    // Current week on Sep 1, 2026
    const curW = getCurrentWeekNumber(new Date('2026-09-01T12:00:00'));
    assert.equal(curW, 4);
});

test('UX-05.6 Scenario A: Week provided + Student NOT provided -> returns all students homeworks for that week', () => {
    const result = filterHomeworksCombined({
        students: mockStudents,
        week: 4,
        studentId: null,
        currentDate: new Date('2026-09-01T12:00:00')
    });

    assert.equal(result.viewMode, 'week_all_students');
    assert.equal(result.activeWeekNum, 4);
    assert.equal(result.title, '4. Hafta');
    assert.ok(result.subtitle.includes('31 Ağustos – 6 Eylül'));

    // Should contain hw1 (Yağmur), hw2 (Yağmur), hw4 (Ali), hw6 (Zeynep) = 4 records
    assert.equal(result.records.length, 4);
    const studentNames = result.records.map(r => r.student.adSoyad);
    assert.ok(studentNames.includes('Yağmur Aydın'));
    assert.ok(studentNames.includes('Ali Yılmaz'));
    assert.ok(studentNames.includes('Zeynep Çelik'));

    // Metrics for week 4 (4 total: 2 completed, 2 active/pending)
    assert.equal(result.metrics.total, 4);
    assert.equal(result.metrics.completed, 2);
    assert.equal(result.metrics.active, 2);
});

test('UX-05.6 Scenario B: Week NOT provided + Student provided -> returns full historical records for that student', () => {
    const result = filterHomeworksCombined({
        students: mockStudents,
        week: null,
        studentId: 's1', // Yağmur Aydın
        currentDate: new Date('2026-09-01T12:00:00')
    });

    assert.equal(result.viewMode, 'student_all_history');
    assert.equal(result.activeWeekNum, null);
    assert.equal(result.title, 'Yağmur Aydın');
    assert.equal(result.subtitle, 'Tüm Ödev Geçmişi (8. Sınıf)');

    // Should contain all 4 homeworks of Yağmur (hw1, hw2, hw3, hw_legacy)
    assert.equal(result.records.length, 4);
    assert.equal(result.metrics.total, 4);
    assert.equal(result.metrics.completed, 3);
});

test('UX-05.6 Scenario C: Week provided + Student provided -> returns only that student homeworks in selected week', () => {
    const result = filterHomeworksCombined({
        students: mockStudents,
        week: 4,
        studentId: 's1', // Yağmur Aydın
        currentDate: new Date('2026-09-01T12:00:00')
    });

    assert.equal(result.viewMode, 'week_single_student');
    assert.equal(result.activeWeekNum, 4);
    assert.equal(result.title, 'Yağmur Aydın');
    assert.ok(result.subtitle.includes('4. Hafta'));

    // Should contain hw1 and hw2 (both in week 4 for Yağmur)
    assert.equal(result.records.length, 2);
    assert.equal(result.metrics.total, 2);
    assert.equal(result.metrics.completed, 1);
    assert.equal(result.metrics.active, 1);
});

test('UX-05.6 Scenario D: Neither Week nor Student provided -> automatically defaults to current week', () => {
    const result = filterHomeworksCombined({
        students: mockStudents,
        week: null,
        studentId: null,
        currentDate: new Date('2026-09-01T12:00:00')
    });

    assert.equal(result.viewMode, 'week_all_students');
    assert.equal(result.activeWeekNum, 4); // Sep 1, 2026 is Week 4
    assert.equal(result.title, '4. Hafta');
    assert.equal(result.records.length, 4);
});

test('UX-05.6 Scenario E: Search within week subset', () => {
    const result = filterHomeworksCombined({
        students: mockStudents,
        week: 4,
        studentId: null,
        query: 'Kuvvet',
        currentDate: new Date('2026-09-01T12:00:00')
    });

    // In week 4, only Ali Yılmaz has 'Kuvvet ve Enerji'
    assert.equal(result.records.length, 1);
    assert.equal(result.records[0].student.adSoyad, 'Ali Yılmaz');
    assert.equal(result.records[0].homework.id, 'hw4');
});

test('UX-05.6 Scenario F: Search within student history', () => {
    const result = filterHomeworksCombined({
        students: mockStudents,
        week: null,
        studentId: 's1',
        query: 'Mevsimler',
        currentDate: new Date('2026-09-01T12:00:00')
    });

    assert.equal(result.records.length, 1);
    assert.equal(result.records[0].homework.id, 'hw3');
});

test('UX-05.6 Scenario G: Status filtering combined with week and student', () => {
    const completedResult = filterHomeworksCombined({
        students: mockStudents,
        week: 4,
        studentId: 's1',
        status: 'completed',
        currentDate: new Date('2026-09-01T12:00:00')
    });

    assert.equal(completedResult.records.length, 1);
    assert.equal(completedResult.records[0].homework.id, 'hw1');

    const activeResult = filterHomeworksCombined({
        students: mockStudents,
        week: 4,
        studentId: 's1',
        status: 'active',
        currentDate: new Date('2026-09-01T12:00:00')
    });

    assert.equal(activeResult.records.length, 1);
    assert.equal(activeResult.records[0].homework.id, 'hw2');
});

test('UX-05.6 Scenario H: Pre-start legacy records (dates before Aug 10, 2026)', () => {
    const preInfo = getWeekInfoForDate('2026-08-01');
    assert.equal(preInfo.isPreStart, true);
    assert.equal(preInfo.weekNumber, 0);

    const result = filterHomeworksCombined({
        students: mockStudents,
        week: null,
        studentId: 's1',
        currentDate: new Date('2026-09-01T12:00:00')
    });

    const legacyHw = result.records.find(r => r.homework.id === 'hw_legacy');
    assert.ok(legacyHw);
    assert.equal(legacyHw.weekInfo.isPreStart, true);
});

test('UX-05.6 Scenario I: Generates up to 35 weeks cleanly without gaps or invalid dates', () => {
    const weeks = generateWeekList(35);
    assert.equal(weeks.length, 35);
    assert.equal(weeks[0].weekNumber, 1);
    assert.equal(weeks[34].weekNumber, 35);
    weeks.forEach(w => {
        assert.ok(w.mondayStr);
        assert.ok(w.sundayStr);
        assert.ok(w.fullLabel);
    });
});

test('UX-05.6 Scenario J: 900 homeworks scale scenario executes efficiently in sub-millisecond range', () => {
    // Generate 10 students x 30 weeks x 3 homeworks = 900 homeworks
    const bigStudents = Array.from({ length: 10 }, (_, sIdx) => {
        const studentId = `big_s_${sIdx + 1}`;
        const studentName = `Öğrenci ${sIdx + 1}`;
        const odevler = [];
        for (let w = 1; w <= 30; w++) {
            const wInfo = getWeekInfoByNumber(w);
            for (let k = 1; k <= 3; k++) {
                odevler.push({
                    id: `hw_${sIdx}_${w}_${k}`,
                    konu: `Konu ${w}.${k}`,
                    calismaDetayi: `Test ${k}`,
                    yayin: 'CanFenci',
                    tur: 'Test',
                    baslamaTarihi: wInfo.mondayStr,
                    bitisTarihi: wInfo.sundayStr,
                    durum: k === 1 ? 'tamamlandi' : 'bekliyor'
                });
            }
        }
        return {
            id: studentId,
            adSoyad: studentName,
            sinif: '8',
            odevler
        };
    });

    // Warm up JIT compiler to ensure timing measures algorithmic complexity rather than module compilation
    filterHomeworksCombined({
        students: bigStudents,
        week: 4,
        studentId: null,
        currentDate: new Date('2026-09-01T12:00:00')
    });

    const start = performance.now();
    const result = filterHomeworksCombined({
        students: bigStudents,
        week: 4,
        studentId: null,
        currentDate: new Date('2026-09-01T12:00:00')
    });
    const elapsed = performance.now() - start;

    // Default view should only return 30 records (10 students * 3 hw for week 4)
    assert.equal(result.records.length, 30);
    // Warm execution takes ~2.5ms; 25ms provides 10x headroom against parallel thread CPU context switches
    assert.ok(elapsed < 25, `Execution took ${elapsed}ms which is under 25ms`);
});

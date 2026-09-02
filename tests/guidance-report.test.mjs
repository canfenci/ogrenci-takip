import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeGuidanceReportFilename,
    calculateReportPeriodRange,
    buildGuidanceReportData
} from '../guidance-report-insights.js';
import { generateGuidancePdf } from '../guidance-report-pdf.js';

test('UX-06.6 Scenario A: Student basic profile mapping', () => {
    const student = {
        id: 's1',
        adSoyad: 'Yağmur Aydın',
        sinif: '8',
        okul: 'Atatürk Ortaokulu',
        hedefLise: 'Fen Lisesi',
        hedefNet: 18
    };

    const report = buildGuidanceReportData(student, { now: '2026-09-02T10:00:00Z' });
    assert.equal(report.student.name, 'Yağmur Aydın');
    assert.equal(report.student.sinif, '8. Sınıf');
    assert.equal(report.student.okul, 'Atatürk Ortaokulu');
    assert.equal(report.student.hedefLise, 'Fen Lisesi');
    assert.equal(report.student.hedefNet, 18);
    assert.equal(report.student.initials, 'YA');
});

test('UX-06.6 Scenario B: 4-week and 8-week period range calculations', () => {
    const now = new Date('2026-09-02T10:00:00Z');
    const p4 = calculateReportPeriodRange('4weeks', now);
    assert.equal(p4.option, '4weeks');
    assert.equal(p4.endDate, '2026-09-02');
    assert.equal(p4.startDate, '2026-08-05');
    assert.match(p4.label, /5 Ağu – 2 Eyl 2026/);

    const p8 = calculateReportPeriodRange('8weeks', now);
    assert.equal(p8.option, '8weeks');
    assert.equal(p8.endDate, '2026-09-02');
    assert.equal(p8.startDate, '2026-07-08');

    const pall = calculateReportPeriodRange('all', now);
    assert.equal(pall.label, 'Tüm Geçmiş');
});

test('UX-06.6 Scenario C: Exam trend period filtering', () => {
    const student = {
        id: 's2',
        adSoyad: 'Deneme Öğrenci',
        sinif: '8',
        hedefNet: 18,
        denemeler: [
            // Out of 4-week period (2026-07-15)
            { id: 'e_old', tip: 'genel', denemeAdi: 'Eski Deneme', toplamNet: 10.0, tarih: '2026-07-15' },
            // In 4-week period (2026-08-15)
            { id: 'e1', tip: 'genel', denemeAdi: '1. Genel', toplamNet: 12.5, tarih: '2026-08-15' },
            // In 4-week period (2026-08-28)
            { id: 'e2', tip: 'genel', denemeAdi: '2. Genel', toplamNet: 14.5, tarih: '2026-08-28' }
        ]
    };

    const report = buildGuidanceReportData(student, { period: '4weeks', now: '2026-09-02T10:00:00Z' });
    assert.equal(report.examTrend.hasData, true);
    assert.equal(report.examTrend.examCount, 2, 'Old exam must be filtered out');
    assert.equal(report.examTrend.latestNet, 14.5);
    assert.equal(report.examTrend.prevNet, 12.5);
    assert.equal(report.examTrend.delta, 2.0);
    assert.equal(report.examTrend.maxNet, 14.5);
    assert.equal(report.examTrend.targetGap, 3.5);
});

test('UX-06.6 Scenario D & E: Weak topic mapping and canonical error reason labels', () => {
    const student = {
        id: 's3',
        adSoyad: 'Ali Kaya',
        sinif: '8',
        odevler: [
            {
                id: 'h1',
                konu: 'Basınç',
                durum: 'tamamlandi',
                baslamaTarihi: '2026-08-20',
                yanlisKonular: [
                    { konu: 'Katı Basıncı', adet: 4, hataNedenleri: ['bilgi_eksikligi', 'dikkatsizlik'] }
                ]
            },
            {
                id: 'h2',
                konu: 'Basınç',
                durum: 'tamamlandi',
                baslamaTarihi: '2026-08-25',
                yanlisKonular: [
                    { konu: 'Katı Basıncı', adet: 3, hataNedenleri: ['bilgi_eksikligi'] }
                ]
            }
        ]
    };

    const report = buildGuidanceReportData(student, { period: '4weeks', now: '2026-09-02T10:00:00Z' });
    assert.ok(report.weakTopics.length > 0);
    assert.equal(report.weakTopics[0].topic, 'Katı Basıncı');
    assert.equal(report.weakTopics[0].errorCount, 7);

    assert.ok(report.errorReasons.length > 0);
    assert.equal(report.errorReasons[0].label, 'Bilgi Eksikliği');
});

test('UX-06.6 Scenario F: Homework discipline summary in period', () => {
    const student = {
        id: 's4',
        adSoyad: 'Selin Yıldız',
        odevler: [
            { id: 'h1', baslamaTarihi: '2026-08-10', durum: 'tamamlandi' },
            { id: 'h2', baslamaTarihi: '2026-08-15', durum: 'tamamlandi' },
            { id: 'h3', baslamaTarihi: '2026-08-20', bitisTarihi: '2026-08-25', durum: 'verildi' }, // Overdue
            { id: 'h4', baslamaTarihi: '2026-08-30', bitisTarihi: '2026-09-05', durum: 'verildi' }  // Incomplete/ongoing
        ]
    };

    const report = buildGuidanceReportData(student, { period: '4weeks', now: '2026-09-02T10:00:00Z' });
    assert.equal(report.homeworkSummary.total, 4);
    assert.equal(report.homeworkSummary.completed, 2);
    assert.equal(report.homeworkSummary.overdue, 1);
    assert.equal(report.homeworkSummary.incomplete, 1);
    assert.equal(report.homeworkSummary.completionRate, 50);
});

test('UX-06.6 Scenario G, H & I: Guidance interventions, pending vs outcome mapping', () => {
    const student = {
        id: 's5',
        adSoyad: 'Emre Çelik',
        guidanceRecords: [
            // Completed positive
            {
                id: 'r1',
                date: '2026-08-12',
                type: 'academic',
                issue: 'Basınç net düşüşü',
                action: 'Konu tekrarı',
                status: 'completed',
                result: 'positive',
                closedAt: '2026-08-20T10:00:00'
            },
            // Open pending
            {
                id: 'r2',
                date: '2026-08-25',
                type: 'discipline',
                issue: 'Ödev aksatma',
                action: 'Günlük takip çizelgesi',
                followUpDate: '2026-08-30',
                status: 'open',
                result: 'pending'
            }
        ]
    };

    const report = buildGuidanceReportData(student, { period: '4weeks', now: '2026-09-02T10:00:00Z' });
    assert.equal(report.guidanceRecords.length, 2);
    assert.equal(report.outcomes.positive, 1);
    assert.equal(report.outcomes.pending, 1);
    assert.equal(report.openFollowUps.length, 1);
    assert.equal(report.openFollowUps[0].id, 'r2');
    assert.equal(report.openFollowUps[0].overdueDays, 3, '2026-09-02 minus 2026-08-30 is 3 days overdue');
});

test('UX-06.6 Scenario J & K: Next follow up date extraction', () => {
    const student = {
        id: 's6',
        adSoyad: 'Zeynep Ak',
        guidanceRecords: [
            { id: 'r1', status: 'open', followUpDate: '2026-09-08', issue: 'Soru kontrolü' }
        ]
    };

    const report = buildGuidanceReportData(student, { period: '4weeks', now: '2026-09-02T10:00:00Z' });
    assert.equal(report.nextFollowUpDate, '8 Eyl 2026');
});

test('UX-06.6 Scenario L: No fake data when student has no exams or homeworks', () => {
    const student = { id: 's_empty', adSoyad: 'Boş Kayıt', sinif: '7' };
    const report = buildGuidanceReportData(student, { now: '2026-09-02T10:00:00Z' });

    assert.equal(report.examTrend.hasData, false);
    assert.equal(report.examTrend.latestNet, null);
    assert.equal(report.homeworkSummary.hasData, false);
    assert.equal(report.weakTopics.length, 0);
    assert.equal(report.guidanceRecords.length, 0);
    assert.equal(report.openFollowUps.length, 0);
    assert.equal(report.nextFollowUpDate, null);
});

test('UX-06.6 Scenario M: Teacher note does not persist or mutate student object', () => {
    const student = { id: 's_note', adSoyad: 'Not Test' };
    const report = buildGuidanceReportData(student, {
        teacherNote: 'Bu ay gayretli çalıştı.',
        now: '2026-09-02T10:00:00Z'
    });

    assert.equal(report.teacherNote, 'Bu ay gayretli çalıştı.');
    assert.equal(student.teacherNote, undefined, 'Student object must not be mutated');
    assert.equal(student.guidanceRecords, undefined);
});

test('UX-06.6 Scenario N: Filename slug converts Turkish characters cleanly', () => {
    const fn = normalizeGuidanceReportFilename({
        studentName: 'Şükrü Çağlar Özkan',
        date: '2026-09-02'
    });
    assert.equal(fn, 'canfenci-rehberlik-sukru-caglar-ozkan-2026-09-02.pdf');
});

test('UX-06.6 PDF Scenario A–E: generateGuidancePdf renders all sections with mock jsPDF', () => {
    const student = {
        id: 's_synth',
        adSoyad: 'Yağmur Aydın',
        sinif: '8',
        okul: 'Cumhuriyet OO',
        hedefLise: 'Atatürk Fen Lisesi',
        hedefNet: 19,
        denemeler: [
            { id: 'e1', tip: 'genel', denemeAdi: '1. Deneme', toplamNet: 14.5, tarih: '2026-08-15' },
            { id: 'e2', tip: 'genel', denemeAdi: '2. Deneme', toplamNet: 16.0, tarih: '2026-08-28' }
        ],
        odevler: [
            {
                id: 'h1',
                konu: 'Basınç',
                durum: 'tamamlandi',
                baslamaTarihi: '2026-08-20',
                yanlisKonular: [
                    { konu: 'Katı Basıncı', adet: 3, hataNedenleri: ['bilgi_eksikligi', 'dikkatsizlik'] }
                ]
            }
        ],
        guidanceRecords: [
            {
                id: 'r1',
                date: '2026-08-20',
                type: 'academic',
                issue: 'Basınç eksikliği',
                action: 'Etüt çalışması',
                followUpDate: '2026-08-27',
                status: 'completed',
                result: 'positive',
                closedAt: '2026-08-27T10:00:00'
            },
            {
                id: 'r2',
                date: '2026-08-28',
                type: 'discipline',
                issue: 'Dikkatsizlik analizi',
                action: 'Soru kontrol rutini',
                followUpDate: '2026-09-05',
                status: 'open',
                result: 'pending'
            }
        ]
    };

    const reportData = buildGuidanceReportData(student, {
        teacherNote: 'Öğrencinin fen netlerinde istikrarlı artış var.',
        now: '2026-09-02T10:00:00Z'
    });

    const renderedTexts = [];
    class MockJsPDF {
        constructor(options) {
            this.options = options;
            this.pages = [1];
        }
        addFileToVFS() {}
        addFont() {}
        setFont() {}
        setFontSize() {}
        setTextColor() {}
        setFillColor() {}
        setDrawColor() {}
        rect() {}
        roundedRect() {}
        line() {}
        text(txt) {
            if (Array.isArray(txt)) renderedTexts.push(...txt);
            else renderedTexts.push(txt);
        }
        splitTextToSize(txt) { return [txt]; }
        addPage() { this.pages.push(this.pages.length + 1); }
        getNumberOfPages() { return this.pages.length; }
        setPage() {}
    }

    const doc = generateGuidancePdf(reportData, MockJsPDF);
    assert.equal(doc.options.format, 'a4');
    assert.equal(doc.options.orientation, 'portrait');

    const allOutput = renderedTexts.join(' ');
    assert.match(allOutput, /CanFenci/);
    assert.match(allOutput, /REHBERLİK GELİŞİM RAPORU/);
    assert.match(allOutput, /Yağmur Aydın/);
    assert.match(allOutput, /8\. Sınıf/);
    assert.match(allOutput, /AKADEMİK DURUM VE TAKİP ÖZETİ/);
    assert.match(allOutput, /DENEME & NET GELİŞİMİ/);
    assert.match(allOutput, /ZAYIF ÜNİTE VE KONULAR/);
    assert.match(allOutput, /HATA NEDENLERİ DAĞILIMI/);
    assert.match(allOutput, /ÖDEV VE ÇALIŞMA DİSİPLİNİ/);
    assert.match(allOutput, /REHBERLİK MÜDAHALELERİ VE TAKİP GÜNLÜĞÜ/);
    assert.match(allOutput, /DEVAM EDEN AÇIK TAKİPLER/);
    assert.match(allOutput, /ÖNERİLEN SONRAKİ ÇALIŞMA ADIMLARI/);
    assert.match(allOutput, /ÖĞRETMEN DEĞERLENDİRMESİ VE NOTU/);
    assert.match(allOutput, /Öğrencinin fen netlerinde istikrarlı artış var\./);
});

test('UX-06.6 Fixture Test: Full synthetic student with 6 exams, 12 homeworks, 4 interventions', () => {
    const student = {
        id: 's_full_fixture',
        adSoyad: 'Barış Demir',
        sinif: '8',
        okul: 'Gazi OO',
        hedefLise: 'Kabataş Erkek Lisesi',
        hedefNet: 19.5,
        denemeler: [
            { id: 'e1', tip: 'genel', denemeAdi: '1. Deneme', toplamNet: 15.0, tarih: '2026-08-05' },
            { id: 'e2', tip: 'genel', denemeAdi: '2. Deneme', toplamNet: 15.5, tarih: '2026-08-10' },
            { id: 'e3', tip: 'genel', denemeAdi: '3. Deneme', toplamNet: 16.0, tarih: '2026-08-16' },
            { id: 'e4', tip: 'genel', denemeAdi: '4. Deneme', toplamNet: 16.5, tarih: '2026-08-20' },
            { id: 'e5', tip: 'genel', denemeAdi: '5. Deneme', toplamNet: 17.0, tarih: '2026-08-26' },
            { id: 'e6', tip: 'genel', denemeAdi: '6. Deneme', toplamNet: 18.0, tarih: '2026-09-01' }
        ],
        odevler: Array.from({ length: 12 }, (_, i) => ({
            id: `hw_${i + 1}`,
            konu: i % 3 === 0 ? 'Basınç' : (i % 3 === 1 ? 'Mevsimler ve İklim' : 'DNA ve Genetik Kod'),
            durum: i < 10 ? 'tamamlandi' : 'verildi',
            baslamaTarihi: `2026-08-${String(i * 2 + 5).padStart(2, '0')}`,
            yanlisKonular: [
                {
                    konu: i % 3 === 0 ? 'Katı Basıncı' : (i % 3 === 1 ? 'İklim Olayları' : 'Nükleotidler'),
                    adet: 2,
                    hataNedenleri: i % 2 === 0 ? ['bilgi_eksikligi'] : ['dikkatsizlik']
                }
            ]
        })),
        guidanceRecords: [
            {
                id: 'r1',
                date: '2026-08-10',
                type: 'academic',
                issue: 'Basınç net kaybı',
                action: 'Katı basıncı pekiştirme föyü',
                followUpDate: '2026-08-17',
                status: 'completed',
                result: 'positive',
                closedAt: '2026-08-17T10:00:00'
            },
            {
                id: 'r2',
                date: '2026-08-15',
                type: 'discipline',
                issue: 'Ödev erteleme',
                action: 'Haftalık takip çizelgesi',
                followUpDate: '2026-08-22',
                status: 'completed',
                result: 'positive',
                closedAt: '2026-08-22T10:00:00'
            },
            {
                id: 'r3',
                date: '2026-08-20',
                type: 'exam_performance',
                issue: 'Süre yetiştirememe',
                action: 'Süre tutularak soru çözümü',
                followUpDate: '2026-08-27',
                status: 'completed',
                result: 'neutral',
                closedAt: '2026-08-27T10:00:00'
            },
            {
                id: 'r4',
                date: '2026-08-28',
                type: 'general',
                issue: 'Hedef lise net takibi',
                action: 'Haftalık 150 soru hedefi',
                followUpDate: '2026-09-08',
                status: 'open',
                result: 'pending'
            }
        ]
    };

    const report = buildGuidanceReportData(student, { period: '4weeks', now: '2026-09-02T10:00:00Z' });
    assert.equal(report.examTrend.examCount, 6);
    assert.equal(report.examTrend.latestNet, 18.0);
    assert.equal(report.examTrend.prevNet, 17.0);
    assert.equal(report.examTrend.delta, 1.0);
    assert.equal(report.examTrend.maxNet, 18.0);
    assert.equal(report.examTrend.targetGap, 1.5);

    assert.equal(report.homeworkSummary.total, 12);
    assert.equal(report.homeworkSummary.completed, 10);
    assert.equal(report.homeworkSummary.completionRate, 83);

    assert.equal(report.guidanceRecords.length, 4);
    assert.equal(report.outcomes.positive, 2);
    assert.equal(report.outcomes.neutral, 1);
    assert.equal(report.outcomes.pending, 1);

    assert.equal(report.openFollowUps.length, 1);
    assert.equal(report.openFollowUps[0].id, 'r4');
    assert.equal(report.nextFollowUpDate, '8 Eyl 2026');
});

test('UX-06.6 Section Toggle: respects disabled sections in PDF generator', () => {
    const student = { id: 's_toggle', adSoyad: 'Toggle Test', sinif: '8' };
    const reportData = buildGuidanceReportData(student, {
        now: '2026-09-02T10:00:00Z',
        sections: {
            academicSummary: false,
            examTrend: false,
            weakTopics: false,
            errorReasons: false,
            homeworkSummary: false,
            guidanceInterventions: false,
            openFollowUps: false,
            nextActions: false,
            teacherNote: false
        }
    });

    const renderedTexts = [];
    class MockJsPDF {
        constructor(options) {
            this.options = options;
            this.pages = [1];
        }
        addFileToVFS() {}
        addFont() {}
        setFont() {}
        setFontSize() {}
        setTextColor() {}
        setFillColor() {}
        setDrawColor() {}
        rect() {}
        roundedRect() {}
        line() {}
        text(txt) {
            if (Array.isArray(txt)) renderedTexts.push(...txt);
            else renderedTexts.push(txt);
        }
        splitTextToSize(txt) { return [txt]; }
        addPage() { this.pages.push(this.pages.length + 1); }
        getNumberOfPages() { return this.pages.length; }
        setPage() {}
    }

    generateGuidancePdf(reportData, MockJsPDF);
    const combined = renderedTexts.join(' ');
    assert.doesNotMatch(combined, /1\. AKADEMİK DURUM VE TAKİP ÖZETİ/);
    assert.doesNotMatch(combined, /2\. DENEME & NET GELİŞİMİ/);
    assert.doesNotMatch(combined, /3\. ZAYIF ÜNİTE VE KONULAR/);
    assert.doesNotMatch(combined, /4\. HATA NEDENLERİ DAĞILIMI/);
    assert.doesNotMatch(combined, /5\. ÖDEV VE ÇALIŞMA DİSİPLİNİ/);
    assert.doesNotMatch(combined, /6\. REHBERLİK MÜDAHALELERİ VE TAKİP GÜNLÜĞÜ/);
});

test('UX-06.6.1 Scenario A & B: Weak topics strictly respect 4-week period and exclude old topics', () => {
    const student = {
        id: 's_period_leak_test',
        adSoyad: 'Dönem Test Öğrenci',
        sinif: '8',
        odevler: [
            // Old homework in July (outside 4-week period of 2026-09-02) with high errors
            {
                id: 'h_old',
                konu: 'Basınç',
                durum: 'tamamlandi',
                baslamaTarihi: '2026-07-10',
                yanlisKonular: [
                    { konu: 'Katı Basıncı', adet: 10, hataNedenleri: ['bilgi_eksikligi'] }
                ]
            },
            // Recent homework in August (inside 4-week period) with Adaptasyon errors
            {
                id: 'h_recent',
                konu: 'Canlılar ve Yaşam',
                durum: 'tamamlandi',
                baslamaTarihi: '2026-08-20',
                yanlisKonular: [
                    { konu: 'Adaptasyon', adet: 3, hataNedenleri: ['dikkatsizlik'] }
                ]
            }
        ]
    };

    const report4w = buildGuidanceReportData(student, { period: '4weeks', now: '2026-09-02T10:00:00Z' });
    assert.equal(report4w.weakTopics.length, 1);
    assert.equal(report4w.weakTopics[0].topic, 'Adaptasyon');
    assert.equal(report4w.weakTopics[0].errorCount, 3);
    assert.equal(report4w.weakTopics.some(t => t.topic === 'Katı Basıncı'), false, 'Old July topic must not leak into 4-week report');

    // In 'all' period, both should appear with Katı Basıncı having 10 errors
    const reportAll = buildGuidanceReportData(student, { period: 'all', now: '2026-09-02T10:00:00Z' });
    assert.equal(reportAll.weakTopics.length, 2);
    assert.equal(reportAll.weakTopics[0].topic, 'Katı Basıncı');
    assert.equal(reportAll.weakTopics[0].errorCount, 10);
});

test('UX-06.6.1 Scenario C: Error reasons and weak topics use identical period dataset', () => {
    const student = {
        id: 's_error_consistency',
        adSoyad: 'Tutarlılık Test',
        odevler: [
            // Old homework (July) has 'bilgi_eksikligi'
            {
                id: 'h_old',
                baslamaTarihi: '2026-07-15',
                durum: 'tamamlandi',
                yanlisKonular: [{ konu: 'Eski Konu', adet: 5, hataNedenleri: ['bilgi_eksikligi'] }]
            },
            // Recent homework (Aug 25) has 'dikkatsizlik'
            {
                id: 'h_recent',
                baslamaTarihi: '2026-08-25',
                durum: 'tamamlandi',
                yanlisKonular: [{ konu: 'Yeni Konu', adet: 2, hataNedenleri: ['dikkatsizlik'] }]
            }
        ]
    };

    const report = buildGuidanceReportData(student, { period: '4weeks', now: '2026-09-02T10:00:00Z' });
    assert.equal(report.weakTopics.length, 1);
    assert.equal(report.weakTopics[0].topic, 'Yeni Konu');
    assert.equal(report.errorReasons.length, 1);
    assert.equal(report.errorReasons[0].label, 'Dikkatsizlik');
    assert.equal(report.academicSummary.dominantError, 'Dikkatsizlik');
});

test('UX-06.6.1 Scenario D: Next actions contain no "kazanım" wording', () => {
    const student = {
        id: 's_kazanim_free',
        adSoyad: 'Kazanım Test',
        odevler: [
            {
                id: 'h1',
                baslamaTarihi: '2026-08-20',
                durum: 'tamamlandi',
                yanlisKonular: [{ konu: 'Basınç', adet: 4, hataNedenleri: ['bilgi_eksikligi'] }]
            }
        ]
    };

    const report = buildGuidanceReportData(student, { period: '4weeks', now: '2026-09-02T10:00:00Z' });
    const allActions = report.nextActions.join(' ');
    assert.doesNotMatch(allActions, /kazanım/i);
    assert.match(allActions, /Basınç konusunda hedefe yönelik kısa konu tekrarı/);
});

test('UX-06.6.1 Scenario E: PDF output contains no "Teşhis" or "Tanı"', () => {
    const student = {
        id: 's_teshis_free',
        adSoyad: 'Dil Test',
        sinif: '8',
        odevler: [
            {
                id: 'h1',
                baslamaTarihi: '2026-08-20',
                durum: 'tamamlandi',
                yanlisKonular: [{ konu: 'DNA', adet: 2, hataNedenleri: ['bilgi_eksikligi'] }]
            }
        ]
    };

    const reportData = buildGuidanceReportData(student, { now: '2026-09-02T10:00:00Z' });
    const renderedTexts = [];
    class MockJsPDF {
        constructor(options) { this.options = options; this.pages = [1]; }
        addFileToVFS() {}
        addFont() {}
        setFont() {}
        setFontSize() {}
        setTextColor() {}
        setFillColor() {}
        setDrawColor() {}
        rect() {}
        roundedRect() {}
        line() {}
        text(txt) {
            if (Array.isArray(txt)) renderedTexts.push(...txt);
            else renderedTexts.push(txt);
        }
        splitTextToSize(txt) { return [txt]; }
        addPage() { this.pages.push(this.pages.length + 1); }
        getNumberOfPages() { return this.pages.length; }
        setPage() {}
    }

    generateGuidancePdf(reportData, MockJsPDF);
    const combined = renderedTexts.join(' ');
    assert.doesNotMatch(combined, /Teşhis/i);
    assert.doesNotMatch(combined, /Tanı/i);
    assert.match(combined, /Değerlendirme:/);
});

test('UX-06.6.1 Scenario F: Empty error data produces dominantError "—", not invented "Dengeli"', () => {
    const student = { id: 's_no_err', adSoyad: 'Hata Yok', sinif: '8' };
    const report = buildGuidanceReportData(student, { now: '2026-09-02T10:00:00Z' });
    assert.equal(report.academicSummary.dominantError, '—');
});

test('UX-06.6.1 Scenario G: Undated homework is excluded from bounded period and included in all', () => {
    const student = {
        id: 's_undated',
        adSoyad: 'Tarihsiz Test',
        odevler: [
            { id: 'h_nodate', konu: 'Tarihsiz Ödev', durum: 'tamamlandi' }
        ]
    };

    const report4w = buildGuidanceReportData(student, { period: '4weeks', now: '2026-09-02T10:00:00Z' });
    assert.equal(report4w.homeworkSummary.total, 0, 'Undated homework must be excluded from 4weeks');

    const reportAll = buildGuidanceReportData(student, { period: 'all', now: '2026-09-02T10:00:00Z' });
    assert.equal(reportAll.homeworkSummary.total, 1, 'Undated homework must be included in all');
});

test('UX-06.6.1 Scenario H & I: Upcoming follow-up strictly picks today or future date, never past overdue', () => {
    const studentOverdueOnly = {
        id: 's_overdue_only',
        adSoyad: 'Geciken Takip Öğrenci',
        guidanceRecords: [
            // Past overdue follow up (2026-08-25 vs now 2026-09-02)
            { id: 'r1', status: 'open', followUpDate: '2026-08-25', issue: 'Eski açık takip' }
        ]
    };

    const reportOverdueOnly = buildGuidanceReportData(studentOverdueOnly, { period: '4weeks', now: '2026-09-02T10:00:00Z' });
    assert.equal(reportOverdueOnly.openFollowUps.length, 1);
    assert.equal(reportOverdueOnly.openFollowUps[0].overdueDays, 8);
    assert.equal(reportOverdueOnly.nextFollowUpDate, null, 'Overdue follow-up must NOT be labeled as next upcoming control date');

    const studentWithFuture = {
        id: 's_future',
        adSoyad: 'Gelecek Takip Öğrenci',
        guidanceRecords: [
            // Past overdue
            { id: 'r1', status: 'open', followUpDate: '2026-08-25', issue: 'Eski açık takip' },
            // Upcoming future
            { id: 'r2', status: 'open', followUpDate: '2026-09-10', issue: 'Gelecek takip' }
        ]
    };

    const reportWithFuture = buildGuidanceReportData(studentWithFuture, { period: '4weeks', now: '2026-09-02T10:00:00Z' });
    assert.equal(reportWithFuture.openFollowUps.length, 2);
    assert.equal(reportWithFuture.nextFollowUpDate, '10 Eyl 2026', 'Next follow up date must pick the future date');
});



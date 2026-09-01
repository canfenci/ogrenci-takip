import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReportFilename, buildHomeworkReportData, buildWhatsAppReportMessage, generateHomeworkPdf } from '../homework-report-insights.js';

test('normalizeReportFilename converts Turkish characters and removes invalid filesystem characters', () => {
    const filename = normalizeReportFilename({
        studentName: 'Yağmur Aydın',
        homeworkTitle: 'Basınç — 40 Soru / Test',
        date: '2026-09-01'
    });
    assert.equal(filename, 'CanFenci_Yagmur-Aydin_Basinc-40-Soru-Test_Odev-Raporu_2026-09-01.pdf');
});

test('normalizeReportFilename uses safe fallbacks when values are missing', () => {
    const filename = normalizeReportFilename({});
    assert.match(filename, /^CanFenci_Ogrenci_Odev_Odev-Raporu_\d{4}-\d{2}-\d{2}\.pdf$/);
});

test('buildHomeworkReportData maps standard homework result safely (Scenario A)', () => {
    const student = { id: 's1', adSoyad: 'Yağmur Aydın', sinif: '8', veliTel: '05551234567' };
    const homework = {
        id: 'h1',
        konu: 'Basınç',
        calismaDetayi: 'Test 1-2',
        yayin: 'CanFenci Yayınları',
        tur: 'Konu Denemesi',
        baslamaTarihi: '2026-08-25',
        bitisTarihi: '2026-09-01',
        durum: 'tamamlandi',
        dogru: 32,
        yanlis: 6,
        toplamSoru: 40,
        ogretmenNotu: 'Gayet başarılı bir çalışma.'
    };

    const report = buildHomeworkReportData({ student, homework });
    assert.equal(report.studentName, 'Yağmur Aydın');
    assert.equal(report.sinif, '8. Sınıf');
    assert.equal(report.correct, 32);
    assert.equal(report.wrong, 6);
    assert.equal(report.emptyCount, 2);
    assert.equal(report.net, 30);
    assert.equal(report.successRate, 80);
    assert.equal(report.evalStatus, 'Yeterli / İyi');
    assert.match(report.evalMessage, /%80 başarı elde etmiştir/);
    assert.equal(report.teacherNote, 'Gayet başarılı bir çalışma.');
});

test('buildHomeworkReportData handles missing optional fields safely (Scenario B)', () => {
    const student = { id: 's2', adSoyad: 'Ali Yılmaz' };
    const homework = {
        id: 'h2',
        konu: 'Hücre',
        dogru: 18,
        yanlis: 2,
        durum: 'tamamlandi'
    };

    const report = buildHomeworkReportData({ student, homework });
    assert.equal(report.studentName, 'Ali Yılmaz');
    assert.equal(report.sinif, 'Belirtilmedi');
    assert.equal(report.correct, 18);
    assert.equal(report.wrong, 2);
    assert.equal(report.emptyCount, 0);
    assert.equal(report.net, 17.33);
    assert.equal(report.successRate, 90);
    assert.equal(report.evalStatus, 'Üstün Başarı');
    assert.equal(report.teacherNote, '');
    assert.deepEqual(report.yanlisKonular, []);
});

test('buildHomeworkReportData handles long fields without throwing (Scenario C)', () => {
    const student = { id: 's3', adSoyad: 'Zeynep Ayşe Fatma Uzunoğlu (8)', sinif: '8' };
    const homework = {
        id: 'h3',
        konu: 'Mevsimler ve İklim / Dünya Hareketleri ve Eksen Eğikliği Kapsamlı Değerlendirme',
        calismaDetayi: 'Bölüm Sonu Tarama Testi 1, 2 ve Beceri Temelli Sorular',
        yayin: 'CanFenci Özel Ders Yayınları Kapsamlı LGS Hazırlık Soru Bankası',
        tur: 'Konu Denemesi',
        dogru: 10,
        yanlis: 10,
        toplamSoru: 20,
        durum: 'tamamlandi',
        ogretmenNotu: 'Öğrencinin eksen eğikliği konusundaki temel kavram yanılgılarını ders sırasında detaylıca ele alacağız.',
        yanlisKonular: [{ konu: 'Mevsimler', altKonu: 'Eksen Eğikliği', adet: 5 }]
    };

    const report = buildHomeworkReportData({ student, homework });
    assert.equal(report.sinif, '8. Sınıf');
    assert.equal(report.evalStatus, 'Geliştirilmeli');
    assert.equal(report.yanlisKonular.length, 1);
});

test('buildWhatsAppReportMessage formats guardian friendly summary', () => {
    const reportData = {
        studentName: 'Yağmur Aydın',
        sinif: '8. Sınıf',
        konu: 'Basınç',
        calismaDetayi: 'Test 1-2',
        correct: 32,
        wrong: 6,
        emptyCount: 2,
        net: 30,
        successRate: 80,
        evalStatus: 'Yeterli / İyi',
        teacherNote: 'Gayet iyi.'
    };

    const msg = buildWhatsAppReportMessage(reportData);
    assert.match(msg, /Yağmur Aydın/);
    assert.match(msg, /Doğru: 32/);
    assert.match(msg, /Yanlış: 6/);
    assert.match(msg, /Boş: 2/);
    assert.match(msg, /Net: 30.00/);
    assert.match(msg, /Başarı Oranı: %80/);
    assert.match(msg, /Gayet iyi/);
});

test('generateHomeworkPdf produces an A4 PDF document using mock jsPDF', () => {
    const reportData = {
        studentName: 'Yağmur Aydın',
        sinif: '8. Sınıf',
        reportDate: '01.09.2026',
        konu: 'Basınç',
        calismaDetayi: 'Test 1-2',
        yayin: 'CanFenci',
        tur: 'Konu Denemesi',
        baslamaTarihi: '2026-08-25',
        bitisTarihi: '2026-09-01',
        isCompleted: true,
        correct: 32,
        wrong: 6,
        emptyCount: 2,
        net: 30,
        successRate: 80,
        evalStatus: 'Yeterli / İyi',
        evalMessage: 'Başarılı çalışma.',
        teacherNote: 'İyi çalışma.',
        yanlisKonular: [{ konu: 'Katı Basıncı', adet: 3 }]
    };

    class MockJsPDF {
        constructor(options) {
            this.options = options;
            this.calls = [];
        }
        setFont() {}
        setFontSize() {}
        setTextColor() {}
        setFillColor() {}
        setDrawColor() {}
        rect() {}
        roundedRect() {}
        line() {}
        text() {}
        splitTextToSize(txt) { return [txt]; }
    }

    const doc = generateHomeworkPdf(reportData, MockJsPDF);
    assert.equal(doc.options.format, 'a4');
    assert.equal(doc.options.orientation, 'portrait');
});

test('generateHomeworkPdf formats multiple error topics and reasons cleanly', () => {
    const reportData = {
        studentName: 'Zeynep Çelik',
        sinif: '8. Sınıf',
        konu: 'Basınç',
        calismaDetayi: 'Kazanım Testi',
        yayin: 'CanFenci Yayınları',
        tur: 'Konu Denemesi',
        reportDate: '01.09.2026',
        isCompleted: true,
        correct: 15,
        wrong: 5,
        emptyCount: 0,
        net: 13.33,
        successRate: 75,
        evalStatus: 'Yeterli / İyi',
        evalMessage: 'Konu pekiştirilmelidir.',
        teacherNote: 'İyi gayret.',
        yanlisKonular: [
            { konu: 'Katı Basıncı', altKonu: 'Piezometre', adet: 3, hataNedenleri: ['Bilgi Eksikliği', 'Dikkatsizlik'] },
            { konu: 'Sıvı Basıncı', altKonu: 'U Borusu', adet: 2, hataNedenleri: ['Soruyu Yanlış Okuma'] }
        ]
    };

    let renderedText = [];
    class MockJsPDF {
        constructor(options) {
            this.options = options;
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
            if (Array.isArray(txt)) renderedText.push(...txt);
            else renderedText.push(txt);
        }
        splitTextToSize(txt) { return [txt]; }
    }

    const doc = generateHomeworkPdf(reportData, MockJsPDF);
    assert.equal(doc.options.format, 'a4');
    const combined = renderedText.join(' ');
    assert.match(combined, /Katı Basıncı/);
    assert.match(combined, /Bilgi Eksikliği/);
    assert.match(combined, /Dikkatsizlik/);
});

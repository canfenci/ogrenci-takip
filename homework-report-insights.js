// ==================== HOMEWORK REPORT INSIGHTS & PDF GENERATION ====================

import { calculateTopicTestNet } from './topic-exam-insights.js';
import { registerTurkishFont } from './homework-report-font.js';

export function normalizeReportFilename({ studentName = 'Ogrenci', homeworkTitle = 'Odev', date = '' }) {
    const trMap = {
        'ç': 'c', 'Ç': 'C',
        'ğ': 'g', 'Ğ': 'G',
        'ı': 'i', 'I': 'I', 'İ': 'I',
        'ö': 'o', 'Ö': 'O',
        'ş': 's', 'Ş': 'S',
        'ü': 'u', 'Ü': 'U'
    };

    const clean = str => (str || '')
        .replace(/[çÇğĞıIİöÖşŞüÜ]/g, m => trMap[m] || m)
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    const safeName = clean(studentName) || 'Ogrenci';
    const safeTitle = clean(homeworkTitle).slice(0, 30) || 'Odev';
    const safeDate = clean(date) || new Date().toISOString().slice(0, 10);

    return `CanFenci_${safeName}_${safeTitle}_Odev-Raporu_${safeDate}.pdf`;
}

export function buildHomeworkReportData({ student, homework }) {
    if (!student || !homework) return null;

    const correct = Number(homework.dogru) || 0;
    const wrong = Number(homework.yanlis) || 0;
    const totalQuestions = Number(homework.toplamSoru) || (correct + wrong) || 0;
    const emptyCount = totalQuestions > (correct + wrong) ? (totalQuestions - (correct + wrong)) : 0;
    
    const isTopicTest = homework.tur === 'Konu Denemesi';
    const net = isTopicTest ? calculateTopicTestNet(correct, wrong) : (correct - (wrong / 3));
    const safeNet = Math.max(0, Number(net.toFixed(2)));

    const effectiveTotal = totalQuestions || (correct + wrong) || 1;
    const successRate = Math.round((correct / effectiveTotal) * 100);

    // Rule-based academic evaluation
    let evalStatus = 'İyi';
    let evalBadgeColor = '#2563EB'; // blue
    let evalMessage = '';

    if (successRate >= 85) {
        evalStatus = 'Üstün Başarı';
        evalBadgeColor = '#16A34A'; // green
        evalMessage = `Öğrenci bu ödevde %${successRate} başarı oranı yakalayarak konuyu kavradığını göstermiştir. Mevcut çalışma temposunun korunması önerilir.`;
    } else if (successRate >= 65) {
        evalStatus = 'Yeterli / İyi';
        evalBadgeColor = '#2563EB'; // blue
        evalMessage = `Öğrenci bu ödevde %${successRate} başarı elde etmiştir. Yanlış yapılan soruların çözümlerinin tekrar incelenmesi konu hakimiyetini pekiştirecektir.`;
    } else {
        evalStatus = 'Geliştirilmeli';
        evalBadgeColor = '#D97706'; // amber
        evalMessage = `Öğrenci bu ödevde %${successRate} başarı oranındadır. Bu konudaki temel kavramların ve yanlış yapılan soruların öğretmen eşliğinde tekrar edilmesi önerilir.`;
    }

    const todayDate = new Date();
    const formattedReportDate = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(todayDate);

    const is8thGrade = String(student.sinif).trim() === "8" || (student.adSoyad && student.adSoyad.includes("(8)"));
    const sinifLabel = is8thGrade ? '8. Sınıf' : (student.sinif ? `${student.sinif}. Sınıf` : 'Belirtilmedi');

    return {
        studentId: student.id,
        studentName: student.adSoyad || 'Öğrenci',
        sinif: sinifLabel,
        veliTel: student.veliTel || '',
        homeworkId: homework.id,
        konu: homework.konu || 'Ödev',
        calismaDetayi: homework.calismaDetayi || '',
        yayin: homework.yayin || 'Belirtilmedi',
        tur: homework.tur || 'Test',
        baslamaTarihi: homework.baslamaTarihi || '',
        bitisTarihi: homework.bitisTarihi || '',
        durum: homework.durum || 'bekliyor',
        isCompleted: homework.durum === 'tamamlandi',
        correct,
        wrong,
        emptyCount,
        totalQuestions,
        net: safeNet,
        successRate,
        evalStatus,
        evalBadgeColor,
        evalMessage,
        teacherNote: homework.ogretmenNotu || homework.not || '',
        yanlisKonular: Array.isArray(homework.yanlisKonular) ? homework.yanlisKonular : [],
        reportDate: formattedReportDate,
        reportDateIso: todayDate.toISOString().slice(0, 10)
    };
}

export function buildWhatsAppReportMessage(reportData) {
    if (!reportData) return '';
    const calismaTxt = reportData.calismaDetayi ? ` · ${reportData.calismaDetayi}` : '';
    let msg = `Merhaba Sayın Velimiz,\n\n`;
    msg += `*${reportData.studentName}* (${reportData.sinif}) isimli öğrencimizin *${reportData.konu}*${calismaTxt} ödev performans değerlendirme raporu hazırlanmıştır.\n\n`;
    msg += `📊 *Performans Özeti:*\n`;
    msg += `• Doğru: ${reportData.correct}\n`;
    msg += `• Yanlış: ${reportData.wrong}\n`;
    if (reportData.emptyCount > 0) {
        msg += `• Boş: ${reportData.emptyCount}\n`;
    }
    msg += `• Net: ${reportData.net.toFixed(2)}\n`;
    msg += `• Başarı Oranı: %${reportData.successRate}\n`;
    msg += `• Durum: ${reportData.evalStatus}\n\n`;
    if (reportData.teacherNote) {
        msg += `📝 *Öğretmen Notu:*\n"${reportData.teacherNote}"\n\n`;
    }
    msg += `📄 Öğrencimizin detaylı CanFenci Performans Raporu (PDF) oluşturulmuştur.\n\n`;
    msg += `İyi çalışmalar dileriz.\n*CanFenci Öğrenci Gelişim ve Rehberlik Sistemi*`;
    return msg;
}

export function generateHomeworkPdf(reportData, jsPDFInstance = null) {
    const JsPDFClass = jsPDFInstance || (window?.jspdf?.jsPDF) || (globalThis?.jspdf?.jsPDF);
    if (!JsPDFClass) {
        throw new Error("jsPDF kütüphanesi yüklenemedi.");
    }

    const doc = new JsPDFClass({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const hasCustomFont = registerTurkishFont(doc);
    const fontName = hasCustomFont ? 'Inter' : 'helvetica';

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 18;
    const contentWidth = pageWidth - (margin * 2);

    const safeText = (str) => {
        if (!str) return '';
        if (hasCustomFont) return String(str);
        const map = {
            'ç': 'c', 'Ç': 'C',
            'ğ': 'g', 'Ğ': 'G',
            'ı': 'i', 'I': 'I', 'İ': 'I',
            'ö': 'o', 'Ö': 'O',
            'ş': 's', 'Ş': 'S',
            'ü': 'u', 'Ü': 'U'
        };
        return String(str).replace(/[çÇğĞıIİöÖşŞüÜ]/g, m => map[m] || m);
    };

    // 1. Top Decorative Brand Bar
    doc.setFillColor(30, 58, 138); // Navy #1E3A8A
    doc.rect(0, 0, pageWidth, 7, 'F');

    // 2. Header Area
    doc.setFont(fontName, 'bold');
    doc.setFontSize(20);
    doc.setTextColor(30, 58, 138);
    doc.text('CanFenci', margin, 20);

    doc.setFontSize(10);
    doc.setFont(fontName, 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(safeText('ÖĞRENCİ PERFORMANS RAPORU'), margin, 26);

    doc.setFontSize(8);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(safeText('Ödev Değerlendirme & Gelişim Çizelgesi'), margin, 30);

    // Header Right Badge (Report Date)
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(pageWidth - margin - 50, 13, 50, 18, 2, 2, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Rapor Tarihi', pageWidth - margin - 46, 19);
    doc.setFontSize(9);
    doc.setFont(fontName, 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(reportData.reportDate, pageWidth - margin - 46, 26);

    // 3. Student Identity Card
    let curY = 36;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, curY, contentWidth, 20, 3, 3, 'FD');

    doc.setFontSize(8);
    doc.setFont(fontName, 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(safeText('ÖĞRENCİ BİLGİLERİ'), margin + 6, curY + 6);

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(safeText(reportData.studentName), margin + 6, curY + 14);

    doc.setFontSize(9);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Seviye: ${safeText(reportData.sinif)}`, margin + 90, curY + 14);

    doc.setFont(fontName, 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text(`Başarı: %${reportData.successRate}`, pageWidth - margin - 32, curY + 14);

    // 4. Homework Metadata Card
    curY = 60;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, curY, contentWidth, 34, 3, 3, 'FD');

    doc.setFontSize(8);
    doc.setFont(fontName, 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(safeText('ÖDEV VE ÇALIŞMA DETAYI'), margin + 6, curY + 7);

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    const titleText = safeText(reportData.konu) + (reportData.calismaDetayi ? ` · ${safeText(reportData.calismaDetayi)}` : '');
    doc.text(titleText.slice(0, 50), margin + 6, curY + 15);

    doc.setFontSize(8.5);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Yayın: ${safeText(reportData.yayin)}`, margin + 6, curY + 23);
    doc.text(`Tür: ${safeText(reportData.tur)}`, margin + 65, curY + 23);

    doc.text(`Veriliş: ${reportData.baslamaTarihi || '—'}`, margin + 6, curY + 29);
    doc.text(`Teslim: ${reportData.bitisTarihi || '—'}`, margin + 65, curY + 29);
    doc.text(`Durum: ${reportData.isCompleted ? 'Tamamlandı' : 'Bekliyor'}`, margin + 120, curY + 29);

    // 5. Performance Summary (4 Metric Cards)
    curY = 99;
    const cardGap = 4;
    const numCards = 4;
    const cardWidth = (contentWidth - ((numCards - 1) * cardGap)) / numCards;
    const cardHeight = 26;

    const metrics = [
        { label: 'DOĞRU', val: reportData.correct, col: [22, 163, 74], bg: [240, 253, 244] },
        { label: 'YANLIŞ', val: reportData.wrong, col: [220, 38, 38], bg: [254, 242, 242] },
        { label: 'BOŞ', val: reportData.emptyCount, col: [100, 116, 139], bg: [248, 250, 252] },
        { label: 'NET', val: reportData.net.toFixed(2), col: [37, 99, 235], bg: [239, 246, 255] }
    ];

    metrics.forEach((m, idx) => {
        const x = margin + (idx * (cardWidth + cardGap));
        doc.setFillColor(m.bg[0], m.bg[1], m.bg[2]);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, curY, cardWidth, cardHeight, 2.5, 2.5, 'FD');

        doc.setFontSize(7.5);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text(safeText(m.label), x + (cardWidth / 2), curY + 7, { align: 'center' });

        doc.setFontSize(14);
        doc.setTextColor(m.col[0], m.col[1], m.col[2]);
        doc.text(String(m.val), x + (cardWidth / 2), curY + 18, { align: 'center' });
    });

    // 6. High-Contrast Progress & Comparison Breakdown Bar
    curY = 130;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, curY, contentWidth, 26, 3, 3, 'FD');

    doc.setFontSize(8);
    doc.setFont(fontName, 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(safeText('SORU DAĞILIM VE BAŞARI ORANI'), margin + 6, curY + 6);

    const totalAns = Math.max(1, reportData.correct + reportData.wrong + reportData.emptyCount);
    const barWidth = contentWidth - 12;
    const barHeight = 7;
    const barX = margin + 6;
    const barY = curY + 10;

    const correctW = (reportData.correct / totalAns) * barWidth;
    const wrongW = (reportData.wrong / totalAns) * barWidth;
    const emptyW = barWidth - correctW - wrongW;

    // Background track
    doc.setFillColor(226, 232, 240);
    doc.rect(barX, barY, barWidth, barHeight, 'F');

    // Correct Bar (Green)
    if (correctW > 0) {
        doc.setFillColor(22, 163, 74);
        doc.rect(barX, barY, correctW, barHeight, 'F');
    }
    // Wrong Bar (Red)
    if (wrongW > 0) {
        doc.setFillColor(220, 38, 38);
        doc.rect(barX + correctW, barY, wrongW, barHeight, 'F');
    }
    // Empty Bar (Gray)
    if (emptyW > 0) {
        doc.setFillColor(148, 163, 184);
        doc.rect(barX + correctW + wrongW, barY, emptyW, barHeight, 'F');
    }

    doc.setFontSize(7.5);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(safeText(`Doğru: %${Math.round((reportData.correct/totalAns)*100)}   |   Yanlış: %${Math.round((reportData.wrong/totalAns)*100)}   |   Başarı Oranı: %${reportData.successRate}`), barX, barY + 12);

    // 7. Academic Rule-Based Assessment Card
    curY = 162;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, curY, contentWidth, 30, 3, 3, 'FD');

    doc.setFontSize(8);
    doc.setFont(fontName, 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(safeText('AKADEMİK DEĞERLENDİRME'), margin + 6, curY + 7);

    doc.setFontSize(9.5);
    doc.setFont(fontName, 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text(safeText(`Sonuç Durumu: ${reportData.evalStatus}`), margin + 6, curY + 14);

    doc.setFontSize(8.5);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(71, 85, 105);
    const splitMsg = doc.splitTextToSize(safeText(reportData.evalMessage), contentWidth - 12);
    doc.text(splitMsg, margin + 6, curY + 20);

    // 8. Wrong Topics / Error Breakdown (if present)
    curY = 197;
    if (reportData.yanlisKonular && reportData.yanlisKonular.length > 0) {
        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(254, 202, 202);
        doc.roundedRect(margin, curY, contentWidth, 22, 3, 3, 'FD');

        doc.setFontSize(8);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(185, 28, 28);
        doc.text(safeText('TEKRAR EDİLMESİ GEREKEN KONULAR'), margin + 6, curY + 6);

        const topicsTxt = reportData.yanlisKonular.map(item => `${safeText(item.konu)}${item.altKonu ? ` > ${safeText(item.altKonu)}` : ''} (${item.adet} Yanlış)`).join(', ');
        doc.setFontSize(8.5);
        doc.setFont(fontName, 'normal');
        doc.setTextColor(153, 27, 27);
        const splitTopics = doc.splitTextToSize(topicsTxt, contentWidth - 12);
        doc.text(splitTopics, margin + 6, curY + 13);
        curY += 26;
    }

    // 9. Teacher Note (if present)
    if (reportData.teacherNote) {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, curY, contentWidth, 22, 3, 3, 'FD');

        doc.setFontSize(8);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text(safeText('ÖĞRETMEN NOTU'), margin + 6, curY + 6);

        doc.setFontSize(8.5);
        doc.setFont(fontName, 'normal');
        doc.setTextColor(51, 65, 85);
        const splitNote = doc.splitTextToSize(`"${safeText(reportData.teacherNote)}"`, contentWidth - 12);
        doc.text(splitNote, margin + 6, curY + 13);
        curY += 26;
    }

    // 10. Corporate Footer
    const footerY = pageHeight - 16;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, footerY, pageWidth - margin, footerY);

    doc.setFontSize(7.5);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(safeText('CanFenci Öğrenci Gelişim ve Koçluk Sistemi · Öğretmen Performans Raporu'), margin, footerY + 6);
    doc.text('Sayfa 1 / 1', pageWidth - margin, footerY + 6, { align: 'right' });

    return doc;
}

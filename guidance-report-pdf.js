/**
 * Student Guidance Progress Report PDF Generator.
 * Creates an elegant, multi-page, printable A4 PDF document with complete Turkish character support.
 */

import { registerTurkishFont } from './homework-report-font.js';
import { normalizeGuidanceReportFilename } from './guidance-report-insights.js';

function safeText(str) {
    if (str === null || str === undefined) return '';
    return String(str);
}

/**
 * Generates the complete printable Student Guidance Progress Report PDF.
 */
export function generateGuidancePdf(reportData, customJsPDF = null) {
    if (!reportData || !reportData.student) {
        throw new Error('Report data with student is required to generate guidance PDF.');
    }

    const JsPDFClass = customJsPDF || (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF);
    if (!JsPDFClass) {
        throw new Error('jsPDF library is not loaded.');
    }

    const doc = new JsPDFClass({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    // Register Inter font for complete Turkish typography
    const fontRegistered = registerTurkishFont(doc);
    const fontName = fontRegistered ? 'Inter' : 'Helvetica';

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 14;
    const contentWidth = pageWidth - (margin * 2);
    let curY = margin;

    const sections = reportData.sections || {};

    // Helper: Check page break and add new page if content exceeds available height
    function checkPageBreak(requiredHeight = 25) {
        if (curY + requiredHeight > pageHeight - 20) {
            doc.addPage();
            curY = margin;
            renderPageHeader();
        }
    }

    function renderPageHeader() {
        // Mini corporate running header on subsequent pages
        doc.setFontSize(7.5);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(79, 70, 229);
        doc.text('CanFenci', margin, curY);

        doc.setFont(fontName, 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(`Öğrenci Rehberlik Gelişim Raporu · ${safeText(reportData.student.name)} (${safeText(reportData.student.sinif)})`, margin + 18, curY);
        doc.text(safeText(reportData.student.reportDate), pageWidth - margin, curY, { align: 'right' });

        doc.setDrawColor(226, 232, 240);
        doc.line(margin, curY + 2.5, pageWidth - margin, curY + 2.5);
        curY += 8;
    }

    // ==================== PAGE 1: HEADER & PROFILE ====================
    // 1. Corporate Brand Banner
    doc.setFillColor(4, 36, 71); // Deep Navy
    doc.roundedRect(margin, curY, contentWidth, 24, 3, 3, 'F');

    doc.setFontSize(15);
    doc.setFont(fontName, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('CanFenci', margin + 7, curY + 9.5);

    doc.setFontSize(7.5);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(255, 159, 28); // Orange accent
    doc.text('ÖĞRENCİ TAKİP & KARAR DESTEK SİSTEMİ', margin + 7, curY + 16);

    doc.setFontSize(10.5);
    doc.setFont(fontName, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('REHBERLİK GELİŞİM RAPORU', pageWidth - margin - 7, curY + 10, { align: 'right' });

    doc.setFontSize(7.5);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`Dönem: ${safeText(reportData.student.periodLabel)}`, pageWidth - margin - 7, curY + 16, { align: 'right' });

    curY += 28;

    // 2. Student Profile Card
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, curY, contentWidth, 22, 2.5, 2.5, 'FD');

    const col1 = margin + 6;
    const col2 = margin + 62;
    const col3 = margin + 120;

    doc.setFontSize(7);
    doc.setFont(fontName, 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('ÖĞRENCİ', col1, curY + 6);
    doc.text('SINIF / OKUL', col2, curY + 6);
    doc.text('HEDEF BİLGİSİ', col3, curY + 6);

    doc.setFontSize(9);
    doc.setFont(fontName, 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(safeText(reportData.student.name), col1, curY + 13);
    doc.text(`${safeText(reportData.student.sinif)}${reportData.student.okul ? ` · ${safeText(reportData.student.okul)}` : ''}`, col2, curY + 13);
    doc.text(`${reportData.student.hedefLise || '—'}${reportData.student.hedefNet ? ` (${reportData.student.hedefNet} Net)` : ''}`, col3, curY + 13);

    doc.setFontSize(7);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Rapor Tarihi: ${safeText(reportData.student.reportDate)}`, col1, curY + 18);

    curY += 26;

    // ==================== SECTION: AKADEMİK DURUM ÖZETİ ====================
    if (sections.academicSummary !== false) {
        checkPageBreak(38);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, curY, contentWidth, 34, 2.5, 2.5, 'FD');

        doc.setFontSize(8);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(79, 70, 229);
        doc.text('1. AKADEMİK DURUM VE TAKİP ÖZETİ', margin + 6, curY + 6.5);

        // 4 mini summary metrics
        const m1 = margin + 6;
        const m2 = margin + 48;
        const m3 = margin + 92;
        const m4 = margin + 136;

        doc.setFontSize(7);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text('TAKİP ÖNCELİĞİ', m1, curY + 14);
        doc.text('SON NET', m2, curY + 14);
        doc.text('ÖDEV DİSİPLİNİ', m3, curY + 14);
        doc.text('BASKIN HATA TÜRÜ', m4, curY + 14);

        doc.setFontSize(9);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(safeText(reportData.academicSummary.priorityLabel || 'İzle'), m1, curY + 20);
        doc.text(reportData.academicSummary.latestNet !== null ? `${reportData.academicSummary.latestNet} Net` : '—', m2, curY + 20);
        doc.text(reportData.academicSummary.disciplineRate !== null ? `%${reportData.academicSummary.disciplineRate}` : '—', m3, curY + 20);
        doc.text(safeText(reportData.academicSummary.dominantError || '—'), m4, curY + 20);

        // Problem summary sentence
        if (reportData.academicSummary.mainProblemSummary) {
            doc.setFontSize(7.5);
            doc.setFont(fontName, 'normal');
            doc.setTextColor(71, 85, 105);
            const splitDiag = doc.splitTextToSize(`Değerlendirme: ${safeText(reportData.academicSummary.mainProblemSummary)}`, contentWidth - 12);
            doc.text(splitDiag, margin + 6, curY + 27);
        }

        curY += 38;
    }

    // ==================== SECTION: DENEME & NET GELİŞİMİ ====================
    if (sections.examTrend !== false) {
        checkPageBreak(36);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, curY, contentWidth, 32, 2.5, 2.5, 'FD');

        doc.setFontSize(8);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(79, 70, 229);
        doc.text('2. DENEME & NET GELİŞİMİ', margin + 6, curY + 6.5);

        if (reportData.examTrend.hasData) {
            const e1 = margin + 6;
            const e2 = margin + 40;
            const e3 = margin + 74;
            const e4 = margin + 108;
            const e5 = margin + 142;

            doc.setFontSize(7);
            doc.setFont(fontName, 'bold');
            doc.setTextColor(100, 116, 139);
            doc.text('SON NET', e1, curY + 13);
            doc.text('ÖNCEKİ NET', e2, curY + 13);
            doc.text('NET DEĞİŞİMİ', e3, curY + 13);
            doc.text('EN YÜKSEK NET', e4, curY + 13);
            doc.text('HEDEFE UZAKLIK', e5, curY + 13);

            doc.setFontSize(8.5);
            doc.setFont(fontName, 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text(reportData.examTrend.latestNet !== null ? `${reportData.examTrend.latestNet}` : '—', e1, curY + 19);
            doc.text(reportData.examTrend.prevNet !== null ? `${reportData.examTrend.prevNet}` : '—', e2, curY + 19);
            
            const deltaTxt = reportData.examTrend.delta !== null ? (reportData.examTrend.delta >= 0 ? `+${reportData.examTrend.delta}` : `${reportData.examTrend.delta}`) : '—';
            doc.setTextColor(reportData.examTrend.delta && reportData.examTrend.delta >= 0 ? 5 : 185, reportData.examTrend.delta && reportData.examTrend.delta >= 0 ? 150 : 28, reportData.examTrend.delta && reportData.examTrend.delta >= 0 ? 105 : 28);
            doc.text(deltaTxt, e3, curY + 19);

            doc.setTextColor(15, 23, 42);
            doc.text(reportData.examTrend.maxNet !== null ? `${reportData.examTrend.maxNet}` : '—', e4, curY + 19);
            doc.text(reportData.examTrend.targetGap !== null ? `${reportData.examTrend.targetGap} Net` : '—', e5, curY + 19);

            // Recent exam list summary
            const recentExamsText = reportData.examTrend.exams.slice(-4).map(e => `${safeText(e.name)}: ${e.net} net (${safeText(e.date)})`).join('   |   ');
            doc.setFontSize(7);
            doc.setFont(fontName, 'normal');
            doc.setTextColor(100, 116, 139);
            const splitExams = doc.splitTextToSize(`Son Denemeler: ${recentExamsText}`, contentWidth - 12);
            doc.text(splitExams, margin + 6, curY + 26);
        } else {
            doc.setFontSize(7.5);
            doc.setFont(fontName, 'normal');
            doc.setTextColor(148, 163, 184);
            doc.text('Seçili dönem için kayıtlı deneme verisi bulunmuyor.', margin + 6, curY + 17);
        }

        curY += 36;
    }

    // ==================== SECTION: ZAYIF KONULAR & HATA NEDENLERİ (2 Columns) ====================
    const showWeak = sections.weakTopics !== false;
    const showError = sections.errorReasons !== false;

    if (showWeak || showError) {
        checkPageBreak(44);
        const colWidth = (contentWidth - 6) / 2;

        // Column 1: Zayıf Ünite ve Konular
        if (showWeak) {
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(margin, curY, colWidth, 40, 2.5, 2.5, 'FD');

            doc.setFontSize(8);
            doc.setFont(fontName, 'bold');
            doc.setTextColor(79, 70, 229);
            doc.text('3. ZAYIF ÜNİTE VE KONULAR', margin + 5, curY + 6.5);

            if (reportData.weakTopics.length > 0) {
                let topicY = curY + 12;
                reportData.weakTopics.slice(0, 4).forEach((t, i) => {
                    doc.setFontSize(7.5);
                    doc.setFont(fontName, 'bold');
                    doc.setTextColor(30, 41, 59);
                    doc.text(`${i + 1}. ${safeText(t.topic)}`, margin + 5, topicY);

                    doc.setFontSize(7);
                    doc.setFont(fontName, 'normal');
                    doc.setTextColor(100, 116, 139);
                    doc.text(`${t.errorCount} Yanlış · ${t.occurrenceCount} Tekrar`, margin + colWidth - 5, topicY, { align: 'right' });
                    topicY += 6.5;
                });
            } else {
                doc.setFontSize(7.5);
                doc.setFont(fontName, 'normal');
                doc.setTextColor(148, 163, 184);
                doc.text('Kritik zayıf konu kaydı tespit edilmedi.', margin + 5, curY + 16);
            }
        }

        // Column 2: Hata Nedenleri Dağılımı
        if (showError) {
            const errX = margin + colWidth + 6;
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(errX, curY, colWidth, 40, 2.5, 2.5, 'FD');

            doc.setFontSize(8);
            doc.setFont(fontName, 'bold');
            doc.setTextColor(79, 70, 229);
            doc.text('4. HATA NEDENLERİ DAĞILIMI', errX + 5, curY + 6.5);

            if (reportData.errorReasons.length > 0) {
                let errY = curY + 12;
                reportData.errorReasons.slice(0, 4).forEach(r => {
                    doc.setFontSize(7.5);
                    doc.setFont(fontName, 'normal');
                    doc.setTextColor(30, 41, 59);
                    doc.text(safeText(r.label), errX + 5, errY);

                    doc.setFontSize(7);
                    doc.setFont(fontName, 'bold');
                    doc.setTextColor(100, 116, 139);
                    doc.text(`${r.count} Soru (%${r.percent})`, errX + colWidth - 5, errY, { align: 'right' });
                    errY += 6.5;
                });
            } else {
                doc.setFontSize(7.5);
                doc.setFont(fontName, 'normal');
                doc.setTextColor(148, 163, 184);
                doc.text('Hata nedeni analizi verisi bulunmuyor.', errX + 5, curY + 16);
            }
        }

        curY += 44;
    }

    // ==================== SECTION: ÖDEV VE ÇALIŞMA DİSİPLİNİ ====================
    if (sections.homeworkSummary !== false) {
        checkPageBreak(30);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, curY, contentWidth, 26, 2.5, 2.5, 'FD');

        doc.setFontSize(8);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(79, 70, 229);
        doc.text('5. ÖDEV VE ÇALIŞMA DİSİPLİNİ', margin + 6, curY + 6.5);

        if (reportData.homeworkSummary.hasData) {
            const h1 = margin + 6;
            const h2 = margin + 44;
            const h3 = margin + 82;
            const h4 = margin + 120;
            const h5 = margin + 158;

            doc.setFontSize(7);
            doc.setFont(fontName, 'bold');
            doc.setTextColor(100, 116, 139);
            doc.text('TOPLAM ÖDEV', h1, curY + 13);
            doc.text('TAMAMLANAN', h2, curY + 13);
            doc.text('EKSİK / DEVAM', h3, curY + 13);
            doc.text('GECİKEN', h4, curY + 13);
            doc.text('TAMAMLAMA ORANI', h5, curY + 13);

            doc.setFontSize(8.5);
            doc.setFont(fontName, 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text(`${reportData.homeworkSummary.total}`, h1, curY + 19);
            doc.text(`${reportData.homeworkSummary.completed}`, h2, curY + 19);
            doc.text(`${reportData.homeworkSummary.incomplete}`, h3, curY + 19);
            doc.text(`${reportData.homeworkSummary.overdue}`, h4, curY + 19);
            doc.text(`%${reportData.homeworkSummary.completionRate}`, h5, curY + 19);
        } else {
            doc.setFontSize(7.5);
            doc.setFont(fontName, 'normal');
            doc.setTextColor(148, 163, 184);
            doc.text('Seçili dönem için kayıtlı ödev bulunmuyor.', margin + 6, curY + 16);
        }

        curY += 30;
    }

    // ==================== SECTION: REHBERLİK MÜDAHALELERİ & SONUÇLARI ====================
    if (sections.guidanceInterventions !== false) {
        checkPageBreak(40);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);

        const records = reportData.guidanceRecords.slice(0, 8);
        const recordHeight = records.length ? (12 + (records.length * 10)) : 26;

        doc.roundedRect(margin, curY, contentWidth, recordHeight, 2.5, 2.5, 'FD');

        doc.setFontSize(8);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(79, 70, 229);
        doc.text(`6. REHBERLİK MÜDAHALELERİ VE TAKİP GÜNLÜĞÜ (${reportData.guidanceRecords.length} Kayıt)`, margin + 6, curY + 6.5);

        if (records.length > 0) {
            let rowY = curY + 12;
            records.forEach(rec => {
                doc.setFontSize(7);
                doc.setFont(fontName, 'bold');
                doc.setTextColor(71, 85, 105);
                doc.text(safeText(rec.date), margin + 6, rowY);

                doc.setTextColor(15, 23, 42);
                doc.text(`[${safeText(rec.typeLabel)}]`, margin + 26, rowY);

                doc.setFont(fontName, 'normal');
                const truncatedIssue = doc.splitTextToSize(`${safeText(rec.issue)} → ${safeText(rec.action)}`, contentWidth - 85);
                doc.text(truncatedIssue[0] || '', margin + 50, rowY);

                // Result Badge
                doc.setFont(fontName, 'bold');
                if (rec.isClosed) {
                    doc.setTextColor(5, 150, 105); // Green
                    doc.text(safeText(rec.resultLabel), pageWidth - margin - 6, rowY, { align: 'right' });
                } else if (rec.isDue) {
                    doc.setTextColor(220, 38, 38); // Red
                    doc.text('Takip Bekliyor', pageWidth - margin - 6, rowY, { align: 'right' });
                } else {
                    doc.setTextColor(100, 116, 139);
                    doc.text(`Takip: ${safeText(rec.followUpDate)}`, pageWidth - margin - 6, rowY, { align: 'right' });
                }

                rowY += 9.5;
            });
        } else {
            doc.setFontSize(7.5);
            doc.setFont(fontName, 'normal');
            doc.setTextColor(148, 163, 184);
            doc.text('Seçili dönem için rehberlik müdahale kaydı bulunmuyor.', margin + 6, curY + 16);
        }

        curY += recordHeight + 4;
    }

    // ==================== SECTION: DEVAM EDEN AÇIK TAKİPLER ====================
    if (sections.openFollowUps !== false && reportData.openFollowUps.length > 0) {
        checkPageBreak(30);
        const openList = reportData.openFollowUps.slice(0, 4);
        const openBoxHeight = 12 + (openList.length * 9);

        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(254, 202, 202);
        doc.roundedRect(margin, curY, contentWidth, openBoxHeight, 2.5, 2.5, 'FD');

        doc.setFontSize(8);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(185, 28, 28);
        doc.text(`7. DEVAM EDEN AÇIK TAKİPLER (${reportData.openFollowUps.length} Takip)`, margin + 6, curY + 6.5);

        let openY = curY + 12;
        openList.forEach(r => {
            doc.setFontSize(7.5);
            doc.setFont(fontName, 'bold');
            doc.setTextColor(153, 27, 27);
            doc.text(`• ${safeText(r.issue)}`, margin + 6, openY);

            doc.setFont(fontName, 'normal');
            const statusTxt = r.overdueDays > 0 ? `${r.overdueDays} gün gecikti (Hedef: ${safeText(r.followUpDate)})` : `Planlanan: ${safeText(r.followUpDate)}`;
            doc.text(statusTxt, pageWidth - margin - 6, openY, { align: 'right' });
            openY += 8.5;
        });

        curY += openBoxHeight + 4;
    }

    // ==================== SECTION: ÖNERİLEN SONRAKİ ADIMLAR ====================
    if (sections.nextActions !== false && reportData.nextActions.length > 0) {
        checkPageBreak(32);
        const actionBoxHeight = 12 + (reportData.nextActions.length * 7.5);

        doc.setFillColor(240, 253, 250);
        doc.setDrawColor(204, 251, 241);
        doc.roundedRect(margin, curY, contentWidth, actionBoxHeight, 2.5, 2.5, 'FD');

        doc.setFontSize(8);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(15, 118, 110);
        doc.text('8. ÖNERİLEN SONRAKİ ÇALIŞMA ADIMLARI', margin + 6, curY + 6.5);

        let actY = curY + 12;
        reportData.nextActions.forEach((act, idx) => {
            doc.setFontSize(7.5);
            doc.setFont(fontName, 'normal');
            doc.setTextColor(19, 78, 74);
            doc.text(`${idx + 1}. ${safeText(act)}`, margin + 6, actY);
            actY += 7.5;
        });

        curY += actionBoxHeight + 4;
    }

    // ==================== SECTION: ÖĞRETMEN NOTU (IF PROVIDED) ====================
    if (sections.teacherNote !== false && reportData.teacherNote) {
        checkPageBreak(28);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, curY, contentWidth, 24, 2.5, 2.5, 'FD');

        doc.setFontSize(8);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text('9. ÖĞRETMEN DEĞERLENDİRMESİ VE NOTU', margin + 6, curY + 6.5);

        doc.setFontSize(7.5);
        doc.setFont(fontName, 'normal');
        doc.setTextColor(30, 41, 59);
        const splitNote = doc.splitTextToSize(`"${safeText(reportData.teacherNote)}"`, contentWidth - 12);
        doc.text(splitNote, margin + 6, curY + 13);

        curY += 28;
    }

    // ==================== SECTION: SONRAKİ KONTROL ====================
    if (reportData.nextFollowUpDate) {
        checkPageBreak(14);
        doc.setFillColor(238, 242, 255);
        doc.setDrawColor(199, 210, 254);
        doc.roundedRect(margin, curY, contentWidth, 11, 2, 2, 'FD');

        doc.setFontSize(7.5);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(67, 56, 202);
        doc.text(`Sonraki Rehberlik Kontrol Tarihi: ${safeText(reportData.nextFollowUpDate)}`, margin + 6, curY + 7);

        curY += 15;
    }

    // ==================== CORPORATE FOOTERS (ON ALL PAGES) ====================
    const totalPages = (typeof doc.getNumberOfPages === 'function') ? doc.getNumberOfPages() : (doc.internal?.pages?.length ? doc.internal.pages.length - 1 : 1);
    
    for (let p = 1; p <= totalPages; p++) {
        if (typeof doc.setPage === 'function') doc.setPage(p);
        const footerY = pageHeight - 12;

        doc.setDrawColor(226, 232, 240);
        doc.line(margin, footerY, pageWidth - margin, footerY);

        doc.setFontSize(7);
        doc.setFont(fontName, 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text('CanFenci • Öğrenci Rehberlik Gelişim Raporu · Bu rapor öğrenci gelişimini desteklemek amacıyla hazırlanmıştır.', margin, footerY + 5);
        doc.text(`Sayfa ${p} / ${totalPages}`, pageWidth - margin, footerY + 5, { align: 'right' });
    }

    return doc;
}

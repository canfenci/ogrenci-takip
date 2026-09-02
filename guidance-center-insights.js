// ==================== GUIDANCE CENTER INSIGHTS MODULE ====================
// Deterministic rule-based decision support for the teacher guidance center.
// Does NOT modify or write any data. Read-only calculations.

import { normalizeHomeworkErrorAnalysis, normalizeHataNedeniLabel, normalizeHataNedeniKey } from './homework-error-topics.js';
import { getStudentOdevler } from './store.js';

function safeNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}

function round(value, digits = 2) {
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function getStudentInitials(name = '') {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length > 1) return `${parts[0][0]}${parts.at(-1)[0]}`.toLocaleUpperCase('tr-TR');
    return (parts[0] || 'Ö').slice(0, 2).toLocaleUpperCase('tr-TR');
}

/**
 * Identifies repeated weak topics across homeworks and topic exams.
 */
export function getRepeatedWeakTopics(student, homeworks = []) {
    const topicStats = {};

    // 1. Analyze homework error topics
    const hwList = (homeworks && homeworks.length) ? homeworks : (student.odevler || []);
    hwList.forEach(hw => {
        const errorList = normalizeHomeworkErrorAnalysis(hw);
        errorList.forEach(err => {
            const topicKey = String(err.konu || err.unite || '').trim();
            if (!topicKey) return;

            if (!topicStats[topicKey]) {
                topicStats[topicKey] = {
                    topic: err.konu || err.unite,
                    unite: err.unite || '',
                    assignmentCount: 0,
                    errorCount: 0,
                    reasons: {}
                };
            }
            topicStats[topicKey].assignmentCount += 1;
            topicStats[topicKey].errorCount += safeNumber(err.adet) || 1;

            (err.hataNedenleriKeys || []).forEach(k => {
                topicStats[topicKey].reasons[k] = (topicStats[topicKey].reasons[k] || 0) + 1;
            });
        });
    });

    // 2. Analyze deneme questions if any
    (student.denemeler || []).forEach(exam => {
        (exam.sorular || []).forEach(q => {
            if (q.durum === 'yanlis' && q.konu) {
                const topicKey = String(q.konu).trim();
                if (!topicStats[topicKey]) {
                    topicStats[topicKey] = {
                        topic: q.konu,
                        unite: q.unite || '',
                        assignmentCount: 0,
                        errorCount: 0,
                        reasons: {}
                    };
                }
                topicStats[topicKey].errorCount += 1;
                if (q.hataKodu) {
                    const key = normalizeHataNedeniKey(q.hataKodu);
                    if (key) topicStats[topicKey].reasons[key] = (topicStats[topicKey].reasons[key] || 0) + 1;
                }
            }
        });
    });

    return Object.values(topicStats)
        .map(t => ({
            ...t,
            isRepeated: t.assignmentCount >= 2 || t.errorCount >= 4,
            isChronic: t.assignmentCount >= 3 || t.errorCount >= 7
        }))
        .sort((a, b) => b.assignmentCount - a.assignmentCount || b.errorCount - a.errorCount);
}

/**
 * Finds dominant error category across homeworks and exams.
 */
export function getDominantErrorType(student, homeworks = []) {
    const countsByKey = {};

    const hwList = (homeworks && homeworks.length) ? homeworks : (student.odevler || []);
    hwList.forEach(hw => {
        const errorList = normalizeHomeworkErrorAnalysis(hw);
        errorList.forEach(err => {
            (err.hataNedenleriKeys || []).forEach(k => {
                countsByKey[k] = (countsByKey[k] || 0) + (safeNumber(err.adet) || 1);
            });
        });
    });

    (student.denemeler || []).forEach(exam => {
        (exam.sorular || []).forEach(q => {
            if (q.durum === 'yanlis' && q.hataKodu) {
                const key = normalizeHataNedeniKey(q.hataKodu);
                if (key) countsByKey[key] = (countsByKey[key] || 0) + 1;
            }
        });
    });

    const entries = Object.entries(countsByKey).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return null;

    return {
        key: entries[0][0],
        label: normalizeHataNedeniLabel(entries[0][0]),
        count: entries[0][1]
    };
}

/**
 * Calculates exam trend over recent general exams.
 */
export function getExamTrendInsight(student) {
    const generalExams = (student.denemeler || [])
        .filter(exam => exam.tip === 'genel' && exam.tarih && Number.isFinite(Number(exam.toplamNet)))
        .sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)));

    if (generalExams.length < 2) return null;

    const recent = generalExams.slice(-3);
    const firstNet = safeNumber(recent[0].toplamNet);
    const lastNet = safeNumber(recent.at(-1).toplamNet);
    const delta = round(lastNet - firstNet);

    let trend = 'stable';
    let label = 'Stabil';
    let detail = 'Net performansı stabil';

    if (delta <= -1.25) {
        trend = 'declining';
        label = 'Düşüş';
        detail = `Son ${recent.length} denemede ${Math.abs(delta).toFixed(2)} net düşüş`;
    } else if (delta >= 1.25) {
        trend = 'improving';
        label = 'Yükseliş';
        detail = `Son ${recent.length} denemede +${delta.toFixed(2)} net artış`;
    }

    return {
        trend,
        label,
        detail,
        delta,
        examCount: recent.length,
        latestNet: lastNet
    };
}

/**
 * Evaluates homework completion discipline.
 */
export function getHomeworkDisciplineInsight(student, homeworks = []) {
    const list = (homeworks && homeworks.length) ? homeworks : (student.odevler || []);
    if (!list.length) return null;

    const total = list.length;
    const completed = list.filter(h => h.durum === 'tamamlandi').length;
    const todayStr = new Date().toISOString().slice(0, 10);
    const overdue = list.filter(h => h.durum !== 'tamamlandi' && h.bitisTarihi && h.bitisTarihi < todayStr).length;
    const pending = total - completed - overdue;
    const completionRate = Math.round((completed / total) * 100);

    const isProblematic = completionRate < 60 || overdue >= 2;

    return {
        total,
        completed,
        overdue,
        pending,
        completionRate,
        isProblematic
    };
}

/**
 * Deterministic rule-based intervention recommendation.
 */
export function getRecommendedIntervention(options = {}) {
    const { dominantError, repeatedTopic, examTrend, discipline, targetGap } = (options && typeof options === 'object') ? options : {};
    if (dominantError?.key === 'bilgi_eksikligi') {
        return {
            title: 'Konu Tekrarı + Temel Soru',
            action: repeatedTopic
                ? `${repeatedTopic.topic} için konu tekrarı + temel seviye hedefli soru çalışması`
                : 'Temel kavram tekrarı + kademeli soru çözümü'
        };
    }

    if (dominantError?.key === 'dikkatsizlik') {
        return {
            title: 'Kontrollü Soru Rutini',
            action: 'Kontrollü soru çözümü + soru kontrol rutini'
        };
    }

    if (dominantError?.key === 'yanlis_okuma') {
        return {
            title: 'Soru Kökü Odak Çalışması',
            action: 'Soru kökü ve öncülleri işaretleyerek okuma rutini'
        };
    }

    if (dominantError?.key === 'sure_yetmedi') {
        return {
            title: 'Süreli Mini Test',
            action: 'Süreli mini deneme ve soru başına zaman yönetimi çalışması'
        };
    }

    if (dominantError?.key === 'islem_hatasi') {
        return {
            title: 'İşlem Basamağı Takibi',
            action: 'Adım adım işlem yazma ve işlem kontrol rutini'
        };
    }

    if (dominantError?.key === 'yorumlama_hatasi') {
        return {
            title: 'Kavram Haritası & Analiz',
            action: 'Kavram haritası çıkarma + çıkarım odaklı soru analizi'
        };
    }

    if (repeatedTopic && repeatedTopic.isRepeated) {
        return {
            title: 'Hedefli Konu Telafisi',
            action: `${repeatedTopic.topic} konu tekrar planı + kısa pekiştirme testi`
        };
    }

    if (discipline && discipline.isProblematic) {
        return {
            title: 'Ödev Takip Rutini',
            action: 'Haftalık küçük soru hedefi + yakın ödev takibi'
        };
    }

    if (examTrend && examTrend.trend === 'declining') {
        return {
            title: 'Deneme Yanlış Analizi',
            action: 'Deneme yanlış analizi + odak ders etüdü'
        };
    }

    if (targetGap && targetGap > 3.0) {
        return {
            title: 'Hedef Net Çalışması',
            action: 'Hedef nete yönelik nokta atışı branş tekrarı'
        };
    }

    return {
        title: 'Çalışma Temposunu Koru',
        action: 'Mevcut çalışma temposunun ve hedeflerin korunması'
    };
}

/**
 * Builds complete priority classification and evidence for a single student.
 */
export function buildGuidancePriority(student, allHomeworks = null, now = new Date()) {
    const homeworks = allHomeworks || (student.odevler || []);
    const repeatedTopics = getRepeatedWeakTopics(student, homeworks);
    const dominantError = getDominantErrorType(student, homeworks);
    const examTrend = getExamTrendInsight(student);
    const discipline = getHomeworkDisciplineInsight(student, homeworks);

    const targetNet = safeNumber(student.hedefNet);
    const targetGap = (targetNet > 0 && examTrend?.latestNet) ? round(targetNet - examTrend.latestNet) : null;

    const activePlan = student.studyPlanProfile ? {
        subject: student.studyPlanProfile.subject || 'Genel',
        stage: student.studyPlanProfile.stage || 'beginner',
        durationWeeks: student.studyPlanProfile.durationWeeks || 1,
        badge: student.studyPlanProfile.badge || 'Çalışma Planı',
        hasPlan: true
    } : (student.studyPlan && Object.keys(student.studyPlan).length ? { subject: 'Genel', hasPlan: true } : null);

    const reasons = [];
    let priorityScore = 0; // 0-100 score for sorting

    // Evaluate signals
    if (examTrend?.trend === 'declining') {
        priorityScore += 40;
        reasons.push(examTrend.detail);
    }

    const chronicTopic = repeatedTopics.find(t => t.isChronic);
    const repeatTopic = repeatedTopics.find(t => t.isRepeated);

    if (chronicTopic) {
        priorityScore += 35;
        reasons.push(`${chronicTopic.topic} ${chronicTopic.assignmentCount > 1 ? `${chronicTopic.assignmentCount} çalışmada tekrar etti` : `${chronicTopic.errorCount} hata ile kronik zayıflık`}`);
    } else if (repeatTopic) {
        priorityScore += 20;
        reasons.push(`${repeatTopic.topic} konusunda tekrar eden eksik (${repeatTopic.errorCount} hata)`);
    }

    if (dominantError && dominantError.count >= 4) {
        priorityScore += 25;
        reasons.push(`En sık hata türü: ${dominantError.label} (${dominantError.count} kez)`);
    }

    if (discipline?.isProblematic) {
        priorityScore += 20;
        reasons.push(`Ödev tamamlama oranı %${discipline.completionRate} (${discipline.overdue} geciken ödev)`);
    }

    if (targetGap !== null && targetGap >= 4.0) {
        priorityScore += 10;
        reasons.push(`Hedef nete ${targetGap.toFixed(2)} net fark var`);
    }

    // Check if student has due/overdue guidance follow-up
    const rawGuidanceRecords = Array.isArray(student.guidanceRecords) ? student.guidanceRecords : (Array.isArray(student.rehberlikKayitlari) ? student.rehberlikKayitlari : []);
    const todayStr = (now instanceof Date && !isNaN(now.getTime())) ? now.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const hasOverdueGuidance = rawGuidanceRecords.some(r => r && (r.status === 'open' || !r.status || r.durum === 'acik') && r.followUpDate && r.followUpDate <= todayStr);

    if (hasOverdueGuidance) {
        priorityScore += 10;
        reasons.push('Takip tarihi gelmiş rehberlik müdahalesi bulunuyor');
    }

    // Determine priority level
    let priority = 'watch';
    let priorityLabel = 'İzle';

    const hasCriticalDecline = examTrend?.trend === 'declining';
    const hasCriticalDiscipline = discipline?.completionRate < 50 || discipline?.overdue >= 3;
    const hasChronicTopic = !!chronicTopic;
    const hasCriticalBilgiEksikligi = dominantError?.key === 'bilgi_eksikligi' && dominantError.count >= 6;

    if (priorityScore >= 55 || hasCriticalDecline || hasCriticalDiscipline || hasChronicTopic || hasCriticalBilgiEksikligi) {
        priority = 'high';
        priorityLabel = 'Yüksek';
    } else if (priorityScore >= 20 || repeatTopic || discipline?.isProblematic || (dominantError && dominantError.count >= 3) || (targetGap !== null && targetGap >= 3.0)) {
        priority = 'medium';
        priorityLabel = 'Orta';
    } else {
        priority = 'watch';
        priorityLabel = 'İzle';
        if (!reasons.length) {
            reasons.push('Genel performans stabil, kritik sinyal yok');
        }
    }

    const recommendation = getRecommendedIntervention({
        dominantError,
        repeatedTopic: chronicTopic || repeatTopic,
        examTrend,
        discipline,
        targetGap
    });

    return {
        studentId: student.id,
        studentName: student.adSoyad,
        sinif: student.sinif || '—',
        okul: student.okul || '',
        veliTel: student.veliTel || '',
        priority,
        priorityLabel,
        priorityScore,
        reasons: reasons.slice(0, 3), // Max 3 concise reasons
        recommendation,
        repeatedTopics,
        dominantError,
        examTrend,
        discipline,
        targetGap,
        activePlan,
        hasOverdueGuidance
    };
}

/**
 * Builds complete Guidance Center dashboard data model.
 */
export function buildGuidanceCenterDashboard(students = [], now = new Date()) {
    const studentPriorities = students.map(student => {
        const homeworks = getStudentOdevler(student);
        return buildGuidancePriority(student, homeworks, now);
    });

    // Sort: High -> Medium -> Watch, then highest priorityScore
    const priorityWeight = { high: 0, medium: 1, watch: 2 };
    studentPriorities.sort((a, b) => {
        const weightDiff = priorityWeight[a.priority] - priorityWeight[b.priority];
        if (weightDiff !== 0) return weightDiff;
        return b.priorityScore - a.priorityScore || a.studentName.localeCompare(b.studentName, 'tr');
    });

    const highCount = studentPriorities.filter(p => p.priority === 'high').length;
    const mediumCount = studentPriorities.filter(p => p.priority === 'medium').length;
    const watchCount = studentPriorities.filter(p => p.priority === 'watch').length;
    const activePlansCount = studentPriorities.filter(p => p.activePlan).length;

    // Contacted this week
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const weekAgoStr = weekAgo.toISOString().slice(0, 10);
    const todayStr = (now instanceof Date && !isNaN(now.getTime())) ? now.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    let contactedCount = 0;
    let dueGuidanceCount = 0;

    students.forEach(s => {
        const hadLesson = (s.dersKayitlari || []).some(d => d.tarih >= weekAgoStr);
        const hadExam = (s.denemeler || []).some(e => e.tarih >= weekAgoStr);
        const hadPlan = s.studyPlanProfile?.generatedAt && s.studyPlanProfile.generatedAt >= weekAgoStr;
        if (hadLesson || hadExam || hadPlan) contactedCount += 1;

        const records = Array.isArray(s.guidanceRecords) ? s.guidanceRecords : (Array.isArray(s.rehberlikKayitlari) ? s.rehberlikKayitlari : []);
        if (records.some(r => r && (r.status === 'open' || !r.status || r.durum === 'acik') && r.followUpDate && r.followUpDate <= todayStr)) {
            dueGuidanceCount += 1;
        }
    });

    const metrics = {
        totalStudents: students.length,
        needIntervention: highCount + mediumCount,
        highPriority: highCount,
        mediumPriority: mediumCount,
        watchPriority: watchCount,
        activePlans: activePlansCount,
        recentContacted: contactedCount,
        dueGuidance: dueGuidanceCount
    };

    // Active study plans list
    const activeInterventions = studentPriorities.filter(p => p.activePlan).map(p => ({
        studentId: p.studentId,
        studentName: p.studentName,
        sinif: p.sinif,
        subject: p.activePlan.subject,
        durationWeeks: p.activePlan.durationWeeks,
        badge: p.activePlan.badge
    }));

    const recentActivities = getRecentStudentActivities(students, 6);

    return {
        studentPriorities,
        metrics,
        activeInterventions,
        recentActivities
    };
}

export function formatActivityDate(dateString) {
    if (!dateString || typeof dateString !== 'string') return '';
    const parts = dateString.slice(0, 10).split('-');
    if (parts.length !== 3) return dateString;
    const [y, m, d] = parts.map(Number);
    const date = new Date(y, m - 1, d);
    if (Number.isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(date);
}

function isValidDateString(str) {
    if (!str || typeof str !== 'string') return false;
    return /^\d{4}-\d{2}-\d{2}$/.test(str.slice(0, 10));
}

/**
 * Returns latest chronological student activities across lessons, exams, study plans, and homeworks.
 */
export function getRecentStudentActivities(students = [], limit = 6) {
    const events = [];

    students.forEach(s => {
        // Study plans
        if (s.studyPlanProfile?.generatedAt && isValidDateString(s.studyPlanProfile.generatedAt)) {
            const dateStr = String(s.studyPlanProfile.generatedAt).slice(0, 10);
            events.push({
                date: dateStr,
                formattedDate: formatActivityDate(dateStr),
                studentId: s.id,
                studentName: s.adSoyad,
                type: 'plan',
                typeLabel: 'Çalışma Planı',
                icon: 'fa-compass',
                detail: `${s.studyPlanProfile.subject || 'Genel Program'} oluşturuldu`
            });
        }

        // Lessons
        (s.dersKayitlari || []).forEach(l => {
            if (isValidDateString(l.tarih)) {
                const dateStr = String(l.tarih).slice(0, 10);
                events.push({
                    date: dateStr,
                    formattedDate: formatActivityDate(dateStr),
                    studentId: s.id,
                    studentName: s.adSoyad,
                    type: 'lesson',
                    typeLabel: 'Ders Kaydı',
                    icon: 'fa-book-open',
                    detail: `${l.konu || (l.dersNo ? `${l.dersNo}. Ders` : 'Ders işlendi')}${l.notlar ? ` · ${l.notlar}` : ''}`
                });
            }
        });

        // Exams
        (s.denemeler || []).forEach(e => {
            if (isValidDateString(e.tarih)) {
                const dateStr = String(e.tarih).slice(0, 10);
                events.push({
                    date: dateStr,
                    formattedDate: formatActivityDate(dateStr),
                    studentId: s.id,
                    studentName: s.adSoyad,
                    type: 'exam',
                    typeLabel: 'Deneme',
                    icon: 'fa-file-lines',
                    detail: `${e.denemeAdi || 'Genel Deneme'} (${Number(e.toplamNet || 0).toFixed(2)} net)`
                });
            }
        });

        // Homeworks
        (s.odevler || []).forEach(hw => {
            const completionDate = hw.tamamlanmaTarihi || hw.completedAt || hw.sonucTarihi;
            if (completionDate && isValidDateString(completionDate)) {
                const dateStr = String(completionDate).slice(0, 10);
                events.push({
                    date: dateStr,
                    formattedDate: formatActivityDate(dateStr),
                    studentId: s.id,
                    studentName: s.adSoyad,
                    type: 'homework',
                    typeLabel: 'Ödev Tamamlandı',
                    icon: 'fa-circle-check',
                    detail: `${hw.konu || 'Ödev'} tamamlandı`
                });
            } else if (hw.baslamaTarihi && isValidDateString(hw.baslamaTarihi)) {
                const dateStr = String(hw.baslamaTarihi).slice(0, 10);
                events.push({
                    date: dateStr,
                    formattedDate: formatActivityDate(dateStr),
                    studentId: s.id,
                    studentName: s.adSoyad,
                    type: 'homework',
                    typeLabel: 'Ödev Verildi',
                    icon: 'fa-list-check',
                    detail: `${hw.konu || 'Ödev'} verildi`
                });
            }
        });
    });

    // Sort descending by ISO date string
    events.sort((a, b) => String(b.date).localeCompare(String(a.date)));

    return events.slice(0, limit);
}

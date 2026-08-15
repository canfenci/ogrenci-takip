// ==================== WORKPLAN & GROWTH TAKIP MODÜLÜ ====================

import { store, loadStudentsData, saveStudentsData, GENEL_DERSLER_KEY, GENEL_DERSLER_GORUNUM, escapeHtml } from './store.js';
import { showSyncStatus } from './ui-helpers.js';

export function addStudyTask(studentId, gun) {
    const input = document.getElementById(`taskInput_${gun}`);
    const val = input ? input.value.trim() : "";
    if (!val) return;
    const students = loadStudentsData();
    const sIdx = students.findIndex(s => s.id === studentId);
    if (sIdx !== -1) {
        const s = students[sIdx];
        if (!s.studyPlan) s.studyPlan = {};
        if (!s.studyPlan[gun]) s.studyPlan[gun] = [];
        s.studyPlan[gun].push(val);
        saveStudentsData(students);
        if (window.renderStudentPanel) {
            window.renderStudentPanel(studentId).then(() => {
                if (window.switchStudentTab) window.switchStudentTab('calisma');
            });
        }
    }
}

export function deleteStudyTask(studentId, gun, taskIdx) {
    if (!confirm("Bu çalışma görevini silmek istediğinize emin misiniz?")) return;
    const students = loadStudentsData();
    const sIdx = students.findIndex(s => s.id === studentId);
    if (sIdx !== -1) {
        const s = students[sIdx];
        if (s.studyPlan && s.studyPlan[gun]) {
            s.studyPlan[gun].splice(taskIdx, 1);
            saveStudentsData(students);
            if (window.renderStudentPanel) {
                window.renderStudentPanel(studentId).then(() => {
                    if (window.switchStudentTab) window.switchStudentTab('calisma');
                });
            }
        }
    }
}

export function buildBranchStudyPlan(subject) {
    return {
        "Pazartesi": [`${subject} - Eksik konu tekrarı`, `${subject} - 30 soru`],
        "Salı": [`${subject} - Konu testi`],
        "Çarşamba": [`${subject} - Yanlış soruların analizi ve tekrar çözümü`],
        "Perşembe": [`${subject} - Kaynak kitaptan çalışma`],
        "Cuma": [`${subject} - Konu denemesi`],
        "Cumartesi": [`${subject} - Haftalık tekrar ve gelişim değerlendirmesi`],
        "Pazar": ["Dinlenme ve Kitap Okuma"]
    };
}

export function autoPopulateStudyPlan(studentId, mode = 'general') {
    const selectedBranch = mode.startsWith('branch:') ? mode.slice('branch:'.length).trim() : '';
    const planName = selectedBranch ? `${selectedBranch} branş programı` : 'genel çalışma programı';
    if (!confirm(`Öğrenci için ${planName} otomatik olarak doldurulacaktır. Mevcut program silinecektir. Emin misiniz?`)) return;
    const students = loadStudentsData();
    const sIdx = students.findIndex(s => s.id === studentId);
    if (sIdx === -1) return;
    
    const s = students[sIdx];
    const denemeler = s.denemeler || [];
    const genelDenemeler = denemeler.filter(d => d.tip === "genel");
    
    // Calculate course success percentages
    const successRates = {};
    GENEL_DERSLER_KEY.forEach(d => {
        successRates[d] = null;
    });
    
    if (genelDenemeler.length > 0) {
        const dersBazliNetler = {};
        GENEL_DERSLER_KEY.forEach(d => dersBazliNetler[d] = { dogru: 0, toplamSoru: 0 });
        
        for (let den of genelDenemeler) {
            if (den.dersSonuclari) {
                for (let d in den.dersSonuclari) {
                    if (dersBazliNetler[d]) {
                        const sc = den.dersSonuclari[d];
                        dersBazliNetler[d].dogru += sc.dogru;
                        dersBazliNetler[d].toplamSoru += (sc.dogru + sc.yanlis + sc.bos);
                    }
                }
            }
        }
        
        GENEL_DERSLER_KEY.forEach(d => {
            const t = dersBazliNetler[d].toplamSoru;
            successRates[d] = t ? (dersBazliNetler[d].dogru / t) * 100 : null;
        });
    }
    
    // Find weakest subjects
    const sortedSubjects = GENEL_DERSLER_KEY.map(d => {
        return { key: d, name: d, success: successRates[d] !== null ? successRates[d] : 100 };
    }).sort((a, b) => a.success - b.success);
    
    const weakest = sortedSubjects[0];
    const secondWeakest = sortedSubjects[1];
    
    // Prepare recommended plan
    const plan = selectedBranch ? buildBranchStudyPlan(selectedBranch) : {
        "Pazartesi": [],
        "Salı": [],
        "Çarşamba": [],
        "Perşembe": [],
        "Cuma": [],
        "Cumartesi": [],
        "Pazar": ["Dinlenme ve Kitap Okuma"]
    };
    
    if (!selectedBranch) {
        // Add weakest subject tasks
        plan["Pazartesi"].push(`${weakest.name} - Konu Çalışması & 40 Soru`);
        plan["Çarşamba"].push(`${weakest.name} - Soru Çözümü (50 Soru)`);
        plan["Cuma"].push(`${weakest.name} - Hata Analizi ve Tekrar`);

        // Add second weakest
        plan["Salı"].push(`${secondWeakest.name} - Konu Tekrarı & 45 Soru`);
        plan["Perşembe"].push(`${secondWeakest.name} - Soru Çözümü (50 Soru)`);

        // Add other subjects or general assignments
        plan["Pazartesi"].push("Türkçe - Paragraf Soru Çözümü (20 Soru)");
        plan["Salı"].push("Kitap Okuma (30 dk)");
        plan["Çarşamba"].push("Türkçe - Paragraf Soru Çözümü (20 Soru)");
        plan["Perşembe"].push("Kitap Okuma (30 dk)");
        plan["Cuma"].push("Türkçe - Dil Bilgisi Tekrarı");
        plan["Cumartesi"].push("Haftalık Genel Deneme Çözümü");
        plan["Cumartesi"].push("Deneme Analizi ve Yanlış Soru Sıfırlama");
    }
    
    s.studyPlan = plan;
    saveStudentsData(students);
    if (window.renderStudentPanel) {
        window.renderStudentPanel(studentId).then(() => {
            if (window.switchStudentTab) window.switchStudentTab('calisma');
        });
    }
}

export function exportStudyPlanToPdf(studentId) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    const denemeler = student.denemeler || [];
    const genelDenemeler = denemeler.filter(d => d.tip === "genel");
    
    const dersBazliNetler = {};
    GENEL_DERSLER_KEY.forEach(d => dersBazliNetler[d] = { dogru: 0, toplamSoru: 0 });
    for(let den of genelDenemeler) {
        if(den.dersSonuclari) {
            for(let d in den.dersSonuclari) {
                if(dersBazliNetler[d]) {
                    const sc = den.dersSonuclari[d];
                    dersBazliNetler[d].dogru += sc.dogru;
                    dersBazliNetler[d].toplamSoru += (sc.dogru + sc.yanlis + sc.bos);
                }
            }
        }
    }
    
    const dersBazliYuzdeler = {};
    for(let i=0; i<GENEL_DERSLER_KEY.length; i++){
        const d = GENEL_DERSLER_KEY[i];
        const t = dersBazliNetler[d].toplamSoru;
        dersBazliYuzdeler[d] = t ? ((dersBazliNetler[d].dogru / t) * 100).toFixed(1) : null;
    }
    
    const adviceList = [];
    for (let i = 0; i < GENEL_DERSLER_KEY.length; i++) {
        const d = GENEL_DERSLER_KEY[i];
        const name = GENEL_DERSLER_GORUNUM[i];
        const pct = dersBazliYuzdeler[d];
        if (pct === null || pct === undefined) {
            adviceList.push(`
                <div class="advice-card empty">
                    <h4>${name}</h4>
                    <p>Veri bulunmamaktadır. Haftalık konu tekrarı ve temel soru çözümleri yapılması önerilir.</p>
                </div>
            `);
        } else {
            const successVal = parseFloat(pct);
            let adviceText = '';
            let cardClass = 'empty';
            if (successVal < 50) {
                cardClass = 'critical';
                adviceText = `Başarı oranı %${pct}. Konu anlatım videoları izlenmeli ve günlük 50+ soru ile eksikler kapatılmalı.`;
            } else if (successVal < 80) {
                cardClass = 'medium';
                adviceText = `Başarı oranı %${pct}. Formül ve kural kartları hazırlanmalı, haftalık soru adedi arttırılmalı.`;
            } else {
                cardClass = 'excellent';
                adviceText = `Başarı oranı %${pct}. Mevcut seviyeyi korumak adına konu denemelerine ve zor seviye sorulara odaklanılmalı.`;
            }
            adviceList.push(`
                <div class="advice-card ${cardClass}">
                    <h4>${name} (%${pct})</h4>
                    <p>${adviceText}</p>
                </div>
            `);
        }
    }
    
    const gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
    const tableHeaders = gunler.map(gun => `<th>${gun}</th>`).join('');
    const tableCells = gunler.map(gun => {
        const tasks = student.studyPlan && student.studyPlan[gun] ? student.studyPlan[gun] : [];
        const tasksHtml = tasks.map(task => `<div class="task-item">${escapeHtml(task)}</div>`).join('') 
            || '<div class="no-tasks">Çalışma planlanmamış.</div>';
        return `<td>${tasksHtml}</td>`;
    }).join('');
    
    const weeklyTarget = student.growthPlan?.weeklyTarget || 500;
    
    const reportContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${student.adSoyad} - Haftalık Çalışma Programı</title>
            <style>
                @media print {
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    @page {
                        size: A4 landscape;
                        margin: 15mm;
                    }
                }
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    color: #333;
                    margin: 0;
                    padding: 10px;
                    background-color: #fff;
                    font-size: 11px;
                }
                .header {
                    text-align: center;
                    margin-bottom: 20px;
                    border-bottom: 3px double #4F46E5;
                    padding-bottom: 10px;
                }
                .header h1 {
                    margin: 0;
                    font-size: 24px;
                    color: #4F46E5;
                    font-weight: 800;
                }
                .header p {
                    margin: 5px 0 0 0;
                    font-size: 12px;
                    color: #6B7280;
                    font-weight: 600;
                }
                .student-info {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 15px;
                    font-size: 12px;
                    background-color: #F3F4F6;
                    padding: 10px 15px;
                    border-radius: 8px;
                }
                .section-title {
                    font-size: 15px;
                    font-weight: bold;
                    border-bottom: 2px solid #E5E7EB;
                    padding-bottom: 4px;
                    margin-top: 20px;
                    margin-bottom: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .weekly-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                    table-layout: fixed;
                }
                .weekly-table th {
                    background-color: #4F46E5;
                    color: white;
                    font-weight: bold;
                    text-align: center;
                    padding: 8px;
                    font-size: 12px;
                    border: 1px solid #4F46E5;
                }
                .weekly-table td {
                    padding: 8px;
                    border: 1px solid #D1D5DB;
                    vertical-align: top;
                    font-size: 11px;
                    height: 140px;
                    background-color: #F9FAFB;
                    word-wrap: break-word;
                }
                .task-item {
                    background-color: #FFF;
                    border-left: 3px solid #6366F1;
                    padding: 4px 6px;
                    margin-bottom: 5px;
                    border-radius: 4px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                    font-weight: 600;
                    color: #374151;
                    font-size: 10.5px;
                }
                .no-tasks {
                    color: #9CA3AF;
                    font-style: italic;
                    font-size: 10px;
                    text-align: center;
                    margin-top: 15px;
                }
                .advice-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                    margin-bottom: 20px;
                }
                .advice-card {
                    border: 1px solid #E5E7EB;
                    border-radius: 8px;
                    padding: 10px;
                    font-size: 11px;
                    background-color: #FFF;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.02);
                }
                .advice-card.critical {
                    border-left: 4px solid #EF4444;
                    background-color: #FEF2F2;
                }
                .advice-card.medium {
                    border-left: 4px solid #F59E0B;
                    background-color: #FFFBEB;
                }
                .advice-card.excellent {
                    border-left: 4px solid #10B981;
                    background-color: #ECFDF5;
                }
                .advice-card.empty {
                    border-left: 4px solid #9CA3AF;
                    background-color: #F9FAFB;
                }
                .advice-card h4 {
                    margin: 0 0 4px 0;
                    font-size: 11.5px;
                    font-weight: bold;
                    color: #1F2937;
                }
                .advice-card p {
                    margin: 0;
                    color: #4B5563;
                    line-height: 1.4;
                }
                .footer {
                    text-align: center;
                    font-size: 10px;
                    color: #9CA3AF;
                    margin-top: 25px;
                    border-top: 1px solid #E5E7EB;
                    padding-top: 12px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Haftalık Ders Çalışma Programı</h1>
                <p>Canfenci Öğrenci Takip Sistemi</p>
            </div>
            
            <div class="student-info">
                <div>
                    <strong>Öğrenci:</strong> ${escapeHtml(student.adSoyad)}<br>
                    <strong>Okul / Sınıf:</strong> ${escapeHtml(student.okul)} / ${student.sinif ? student.sinif + '. Sınıf' : 'Belirtilmemiş'}
                </div>
                <div>
                    <strong>Hedef Lise:</strong> ${escapeHtml(student.hedefLise)} (Hedef Net: ${student.hedefNet})<br>
                    <strong>Haftalık Soru Hedefi:</strong> ${weeklyTarget} Soru
                </div>
            </div>
            
            <div class="section-title">📅 HAFTALIK DERS ÇALIŞMA TAKVİMİ</div>
            <table class="weekly-table">
                <thead>
                    <tr>
                        ${tableHeaders}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        ${tableCells}
                    </tr>
                </tbody>
            </table>
            
            <div class="section-title">💡 DERS BAZLI GELİŞİM ÖNERİLERİ</div>
            <div class="advice-grid">
                ${adviceList.join('')}
            </div>
            
            <div class="footer">
                Rapor Oluşturma Tarihi: ${new Date().toLocaleDateString('tr-TR')} - Canfenci Öğrenci Takip Sistemi &copy; ${new Date().getFullYear()}
            </div>
            
            <script>
                window.onload = function() {
                    window.print();
                };
            <\/script>
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(reportContent);
        printWindow.document.close();
    } else {
        alert("Açılır pencere engellendi! Lütfen izin verin.");
    }
}

export function resetStudentError(studentId, errorKey) {
    const students = loadStudentsData();
    const sIdx = students.findIndex(s => s.id === studentId);
    if (sIdx !== -1) {
        const s = students[sIdx];
        if (!s.errorResets) s.errorResets = {};
        s.errorResets[errorKey] = {
            status: "solved",
            solvedAt: new Date().toISOString().split('T')[0]
        };
        saveStudentsData(students);
        if (window.renderStudentPanel) {
            window.renderStudentPanel(studentId).then(() => {
                if (window.switchStudentTab) window.switchStudentTab('calisma');
            });
        }
    }
}

export function changeGrowthTarget(studentId, newTarget) {
    const parsed = parseInt(newTarget);
    if (isNaN(parsed) || parsed <= 0) return;
    const students = loadStudentsData();
    const sIdx = students.findIndex(s => s.id === studentId);
    if (sIdx !== -1) {
        const s = students[sIdx];
        if (!s.growthPlan) s.growthPlan = { weeklyTarget: 500, logs: [] };
        s.growthPlan.weeklyTarget = parsed;
        saveStudentsData(students);
        showSyncStatus("🎯 Hedef başarıyla güncellendi", false);
    }
}

export function addGrowthLog(studentId) {
    const dateInput = document.getElementById("growthLogDate");
    const countInput = document.getElementById("growthLogCount");
    const date = dateInput ? dateInput.value : "";
    const count = countInput ? parseInt(countInput.value) : 0;
    
    if (!date || isNaN(count) || count <= 0) {
        alert("Geçerli bir tarih ve çözülen soru sayısı giriniz!");
        return;
    }
    
    const students = loadStudentsData();
    const sIdx = students.findIndex(s => s.id === studentId);
    if (sIdx !== -1) {
        const s = students[sIdx];
        if (!s.growthPlan) s.growthPlan = { weeklyTarget: 500, logs: [] };
        if (!s.growthPlan.logs) s.growthPlan.logs = [];
        s.growthPlan.logs.push({ date, count });
        saveStudentsData(students);
        if (window.renderStudentPanel) {
            window.renderStudentPanel(studentId).then(() => {
                if (window.switchStudentTab) window.switchStudentTab('calisma');
            });
        }
    }
}

export function deleteGrowthLog(studentId, logIdx) {
    if (!confirm("Bu soru sayısı kaydını silmek istediğinize emin misiniz?")) return;
    const students = loadStudentsData();
    const sIdx = students.findIndex(s => s.id === studentId);
    if (sIdx !== -1) {
        const s = students[sIdx];
        if (s.growthPlan && s.growthPlan.logs) {
            s.growthPlan.logs.splice(logIdx, 1);
            saveStudentsData(students);
            if (window.renderStudentPanel) {
                window.renderStudentPanel(studentId).then(() => {
                    if (window.switchStudentTab) window.switchStudentTab('calisma');
                });
            }
        }
    }
}

export function setErrorFilter(filterName) {
    window.currentErrorFilter = filterName;
    if (window.renderStudentPanel && store.currentStudentId) {
        window.renderStudentPanel(store.currentStudentId).then(() => {
            if (window.switchStudentTab) window.switchStudentTab('calisma');
        });
    }
}

// Bind to window for global accessibility
window.addStudyTask = addStudyTask;
window.deleteStudyTask = deleteStudyTask;
window.autoPopulateStudyPlan = autoPopulateStudyPlan;
window.exportStudyPlanToPdf = exportStudyPlanToPdf;
window.resetStudentError = resetStudentError;
window.changeGrowthTarget = changeGrowthTarget;
window.addGrowthLog = addGrowthLog;
window.deleteGrowthLog = deleteGrowthLog;
window.setErrorFilter = setErrorFilter;

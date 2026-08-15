// ==================== WORKPLAN & GROWTH TAKIP MODÜLÜ ====================

import { store, loadStudentsData, saveStudentsData, GENEL_DERSLER_KEY, GENEL_DERSLER_GORUNUM, escapeHtml } from './store.js';
import { showSyncStatus } from './ui-helpers.js';
import { STUDY_TECHNIQUES, buildAdaptiveStudyPlan, calculateStudyProfile, getStudyBadge } from './study-plan-engine.js';

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

export function showStudyPlanSetup(studentId) {
    const students = loadStudentsData();
    const student = students.find(item => item.id === studentId);
    if (!student) return;
    document.getElementById('studyPlanSetupModal')?.remove();
    const branches = Array.isArray(store.teacherBranches) ? store.teacherBranches : [];
    const programOptions = branches.map(branch => `<option value="branch:${escapeHtml(branch)}">${escapeHtml(branch)} Branş Programı</option>`).join('');
    const techniqueOptions = Object.entries(STUDY_TECHNIQUES).map(([key, label]) => `
        <label class="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 p-3 cursor-pointer">
            <input type="checkbox" name="studyTechnique" value="${key}" checked class="rounded text-indigo-600">
            <span class="text-sm font-bold">${label}</span>
        </label>`).join('');
    const dayOptions = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map((day, index) => `
        <label class="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="studyDay" value="${day}" ${index < 6 ? 'checked' : ''} class="rounded text-indigo-600">${day}</label>`).join('');
    document.body.insertAdjacentHTML('beforeend', `
        <div id="studyPlanSetupModal" class="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="studyPlanSetupTitle">
            <div class="app-modal max-w-3xl mx-auto my-4 sm:my-8">
                <div class="app-modal-header flex items-start justify-between gap-4">
                    <div><h3 id="studyPlanSetupTitle" class="text-xl font-black">Akıllı Çalışma Programı</h3><p class="text-sm text-gray-500 mt-1">${escapeHtml(student.adSoyad)} için program ölçütlerini belirleyin.</p></div>
                    <button onclick="closeStudyPlanSetup()" class="min-w-[44px] min-h-[44px] text-gray-500" aria-label="Pencereyi kapat"><i class="fas fa-times"></i></button>
                </div>
                <div class="app-modal-body space-y-5">
                    <div class="grid sm:grid-cols-2 gap-4">
                        <label class="text-sm font-bold">Program türü<select id="studySetupMode" onchange="updateStudyPlanPreview('${studentId}')" class="student-form-input mt-1 min-h-[44px]">${programOptions}<option value="general">Genel Çalışma Programı</option></select></label>
                        <label class="text-sm font-bold">Aşama<select id="studySetupStage" onchange="updateStudyPlanPreview('${studentId}')" class="student-form-input mt-1 min-h-[44px]"><option value="auto">Otomatik</option><option value="beginner">Başlangıç</option><option value="intermediate">Orta</option><option value="advanced">İleri</option></select></label>
                        <label class="text-sm font-bold">Yoğunluk<select id="studySetupIntensity" class="student-form-input mt-1 min-h-[44px]"><option value="auto">Otomatik</option><option value="light">Hafif</option><option value="balanced">Dengeli</option><option value="intensive">Yoğun</option></select></label>
                        <label class="text-sm font-bold">Günlük azami süre<select id="studySetupMinutes" class="student-form-input mt-1 min-h-[44px]"><option value="20">20 dakika</option><option value="30" selected>30 dakika</option><option value="45">45 dakika</option><option value="60">60 dakika</option><option value="75">75 dakika</option></select></label>
                        <label class="text-sm font-bold sm:col-span-2">Program süresi<select id="studySetupDuration" class="student-form-input mt-1 min-h-[44px]"><option value="1">1 hafta</option><option value="2">2 hafta</option><option value="4">4 hafta</option></select></label>
                    </div>
                    <div id="studyPlanAutoPreview" class="rounded-xl border border-indigo-100 bg-indigo-50/60 dark:bg-indigo-950/20 dark:border-indigo-900 p-4"></div>
                    <fieldset><legend class="font-black text-sm mb-2">Kullanılacak teknikler</legend><div class="grid sm:grid-cols-2 gap-2">${techniqueOptions}</div></fieldset>
                    <fieldset><legend class="font-black text-sm mb-2">Çalışma günleri</legend><div class="grid grid-cols-2 sm:grid-cols-4 gap-2">${dayOptions}</div></fieldset>
                    <p class="text-xs text-gray-500">2 veya 4 haftalık seçimlerde oluşturulan haftalık düzen belirtilen süre boyunca uygulanır ve sonuçlara göre yeniden değerlendirilebilir.</p>
                </div>
                <div class="app-modal-actions"><button onclick="closeStudyPlanSetup()" class="btn-secondary min-h-[44px]">Vazgeç</button><button onclick="createConfiguredStudyPlan('${studentId}')" class="btn-primary min-h-[44px]"><i class="fas fa-magic mr-1"></i> Programı Oluştur</button></div>
            </div>
        </div>`);
    updateStudyPlanPreview(studentId);
}

export function closeStudyPlanSetup() {
    document.getElementById('studyPlanSetupModal')?.remove();
}

export function updateStudyPlanPreview(studentId) {
    const student = loadStudentsData().find(item => item.id === studentId);
    const mode = document.getElementById('studySetupMode')?.value || 'general';
    const subject = mode.startsWith('branch:') ? mode.slice(7) : '';
    const profile = calculateStudyProfile(student, subject);
    const selectedStage = document.getElementById('studySetupStage')?.value || 'auto';
    const stage = selectedStage === 'auto' ? profile.stage : selectedStage;
    const badge = getStudyBadge(subject || 'general', stage);
    const stageNames = { beginner: 'Başlangıç', intermediate: 'Orta', advanced: 'İleri' };
    const confidenceText = profile.confidence === 'low' ? 'Veri az; başlangıç aşaması önerildi.' : `${profile.dataPoints} kayıt üzerinden hesaplandı.`;
    const preview = document.getElementById('studyPlanAutoPreview');
    if (preview) preview.innerHTML = `<div class="flex items-center justify-between gap-3"><div><p class="text-xs font-black uppercase tracking-wide text-indigo-600">Önerilen rozet</p><p class="text-lg font-black mt-1">🏅 ${escapeHtml(badge)}</p></div><span class="rounded-full bg-white dark:bg-gray-800 px-3 py-1 text-xs font-black">${stageNames[stage]}</span></div><p class="text-xs text-gray-500 mt-2">${confidenceText} · Performans puanı: ${profile.score}/100</p>`;
}

export function createConfiguredStudyPlan(studentId) {
    const mode = document.getElementById('studySetupMode')?.value || 'general';
    const stageChoice = document.getElementById('studySetupStage')?.value || 'auto';
    const intensityChoice = document.getElementById('studySetupIntensity')?.value || 'auto';
    const techniques = [...document.querySelectorAll('input[name="studyTechnique"]:checked')].map(input => input.value);
    const days = [...document.querySelectorAll('input[name="studyDay"]:checked')].map(input => input.value);
    if (!techniques.length) return alert('Lütfen en az bir çalışma tekniği seçin.');
    if (!days.length) return alert('Lütfen en az bir çalışma günü seçin.');
    autoPopulateStudyPlan(studentId, {
        mode,
        stageChoice,
        intensityChoice,
        techniques,
        days,
        dailyMinutes: Number(document.getElementById('studySetupMinutes')?.value || 30),
        durationWeeks: Number(document.getElementById('studySetupDuration')?.value || 1)
    });
}

export function autoPopulateStudyPlan(studentId, configuration = {}) {
    const students = loadStudentsData();
    const sIdx = students.findIndex(s => s.id === studentId);
    if (sIdx === -1) return;
    const student = students[sIdx];
    const mode = typeof configuration === 'string' ? configuration : configuration.mode || 'general';
    const subject = mode.startsWith('branch:') ? mode.slice(7) : '';
    const profile = calculateStudyProfile(student, subject);
    const stage = configuration.stageChoice && configuration.stageChoice !== 'auto' ? configuration.stageChoice : profile.stage;
    const intensity = configuration.intensityChoice && configuration.intensityChoice !== 'auto' ? configuration.intensityChoice : profile.intensity;
    const techniques = configuration.techniques || Object.keys(STUDY_TECHNIQUES);
    const days = configuration.days || ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const dailyMinutes = configuration.dailyMinutes || 30;
    const durationWeeks = configuration.durationWeeks || 1;
    const badge = getStudyBadge(subject || 'general', stage);
    student.studyPlan = buildAdaptiveStudyPlan({ subject, stage, intensity, techniques, days, dailyMinutes });
    student.studyPlanProfile = { mode, subject, stage, intensity, techniques, days, dailyMinutes, durationWeeks, badge, score: profile.score, generatedAt: new Date().toISOString() };
    saveStudentsData(students);
    closeStudyPlanSetup();
    showSyncStatus(`🏅 ${badge} programı oluşturuldu`, false);
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
window.showStudyPlanSetup = showStudyPlanSetup;
window.closeStudyPlanSetup = closeStudyPlanSetup;
window.updateStudyPlanPreview = updateStudyPlanPreview;
window.createConfiguredStudyPlan = createConfiguredStudyPlan;
window.exportStudyPlanToPdf = exportStudyPlanToPdf;
window.resetStudentError = resetStudentError;
window.changeGrowthTarget = changeGrowthTarget;
window.addGrowthLog = addGrowthLog;
window.deleteGrowthLog = deleteGrowthLog;
window.setErrorFilter = setErrorFilter;

// ==================== WORKPLAN & GROWTH TAKIP MODÜLÜ ====================

import {
    store,
    loadStudentsData,
    escapeHtml,
    updateGrowthWeeklyTarget,
    markGrowthErrorSolved,
    addGrowthLogAtomic,
    deleteGrowthLogAtomic,
    addStudyTaskAtomic,
    deleteStudyTaskAtomic,
    replaceStudyPlan
} from './store.js';
import { showSyncStatus } from './ui-helpers.js';
import { STUDY_TECHNIQUES, STUDY_TECHNIQUE_GUIDES, buildAdaptiveStudyPlan, calculateStudyProfile, getStudyBadge } from './study-plan-engine.js';

export async function addStudyTask(studentId, gun, taskText = null) {
    const input = document.getElementById(`taskInput_${gun}`);
    const val = (taskText !== null && taskText !== undefined) ? String(taskText).trim() : (input ? input.value.trim() : "");
    if (!val) return;
    const res = await addStudyTaskAtomic(studentId, gun, val);
    if (res && !res.ok && res.blockedOffline) {
        if (typeof alert === 'function') alert(res.message);
        return;
    }
    if (input) input.value = "";
    if (window.renderStudentPanel) {
        window.renderStudentPanel(studentId).then(() => {
            if (window.switchStudentTab) window.switchStudentTab('calisma');
        });
    }
}

export async function deleteStudyTask(studentId, gun, taskIdxOrText) {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        if (!confirm("Bu çalışma görevini silmek istediğinize emin misiniz?")) return;
    }
    const students = loadStudentsData();
    const s = students.find(item => item.id === studentId);
    let taskText = null;
    let taskIdx = null;
    let occurrence = 0;
    if (typeof taskIdxOrText === 'number') {
        taskIdx = taskIdxOrText;
        const rawTask = s?.studyPlan?.[gun]?.[taskIdx] || null;
        taskText = typeof rawTask === 'string' ? rawTask : (rawTask?.title || null);
        if (s?.studyPlan?.[gun] && taskText) {
            for (let i = 0; i < taskIdx; i++) {
                const prevTask = s.studyPlan[gun][i];
                const prevText = typeof prevTask === 'string' ? prevTask : (prevTask?.title || null);
                if (prevText === taskText) occurrence++;
            }
        }
    } else if (typeof taskIdxOrText === 'string') {
        taskText = taskIdxOrText;
        if (Array.isArray(s?.studyPlan?.[gun])) {
            taskIdx = s.studyPlan[gun].findIndex(t => {
                const tText = typeof t === 'string' ? t : (t?.title || null);
                return tText === taskText;
            });
        }
    }
    const res = await deleteStudyTaskAtomic(studentId, gun, { taskText, taskIdx, occurrence });
    if (res && !res.ok && res.blockedOffline) {
        if (typeof alert === 'function') alert(res.message);
        return;
    }
    if (window.renderStudentPanel) {
        window.renderStudentPanel(studentId).then(() => {
            if (window.switchStudentTab) window.switchStudentTab('calisma');
        });
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
    return autoPopulateStudyPlan(studentId, {
        mode,
        stageChoice,
        intensityChoice,
        techniques,
        days,
        dailyMinutes: Number(document.getElementById('studySetupMinutes')?.value || 30),
        durationWeeks: Number(document.getElementById('studySetupDuration')?.value || 1)
    });
}

export async function autoPopulateStudyPlan(studentId, configuration = {}) {
    const students = loadStudentsData();
    const sIdx = students.findIndex(s => s.id === studentId);
    if (sIdx === -1) return { ok: false, error: 'Student not found' };
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
    const newStudyPlan = buildAdaptiveStudyPlan({ subject, stage, intensity, techniques, days, dailyMinutes });
    const newProfile = { mode, subject, stage, intensity, techniques, days, dailyMinutes, durationWeeks, badge, score: profile.score, generatedAt: new Date().toISOString() };
    const res = await replaceStudyPlan(studentId, {
        studyPlan: newStudyPlan,
        studyPlanProfile: newProfile
    });
    if (!res || !res.ok) {
        if (typeof alert === 'function') {
            alert(res?.error?.message || 'Çalışma planı kaydedilirken bir hata oluştu.');
        }
        return res;
    }
    closeStudyPlanSetup();
    showSyncStatus(`🏅 ${badge} programı oluşturuldu`, false);

    // If on Guidance student detail, maintain/set study tab and rerender
    if (store.currentPage === 'guidance' || store.currentPage === 'guidance-detail' || typeof window.renderGuidanceStudentDetail === 'function') {
        window._guidanceStudentTab = 'study';
        if (typeof window.renderGuidanceStudentDetail === 'function') {
            window.renderGuidanceStudentDetail(studentId);
        }
    }
    if (window.renderStudentPanel) {
        window.renderStudentPanel(studentId).then(() => {
            if (window.switchStudentTab) window.switchStudentTab('calisma');
        });
    }
    return res;
}
export const generateAdaptiveStudyPlan = autoPopulateStudyPlan;

import { createEmptyCoachingPlan, normalizeCoachingPlan, createHistorySnapshot, getWeekStart, getWeekEnd } from './coaching-plan-model.js';
import { saveCoachingPlan } from './store.js';

export async function saveCoachingPlanForStudent(studentId, coachingPlanData) {
    if (!studentId) throw new Error('studentId is required');
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return { ok: false, error: 'Student not found' };

    const plan = normalizeCoachingPlan(coachingPlanData || createEmptyCoachingPlan());
    const res = await saveCoachingPlan(studentId, plan);
    if (!res || !res.ok) {
        if (typeof alert === 'function') {
            alert(res?.error?.message || 'Koçluk planı kaydedilirken bir hata oluştu.');
        }
        return res;
    }
    showSyncStatus('📋 Koçluk planı kaydedildi', false);

    if (store.currentPage === 'guidance' || store.currentPage === 'guidance-detail' || typeof window.renderGuidanceStudentDetail === 'function') {
        window._guidanceStudentTab = 'study';
        if (typeof window.renderGuidanceStudentDetail === 'function') {
            window.renderGuidanceStudentDetail(studentId);
        }
    }
    return res;
}

export async function archiveCoachingPlanForStudent(studentId) {
    if (!studentId) throw new Error('studentId is required');
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return { ok: false, error: 'Student not found' };

    const currentPlan = student.coachingPlan;
    if (!currentPlan || typeof currentPlan !== 'object') return { ok: false, error: 'No active coaching plan' };

    const snapshot = createHistorySnapshot(currentPlan);
    const history = Array.isArray(student.studyPlanHistory) ? [...student.studyPlanHistory] : [];
    if (snapshot) history.push(snapshot);

    const archivedPlan = { ...currentPlan, status: 'archived', updatedAt: new Date().toISOString() };
    const res = await saveCoachingPlan(studentId, archivedPlan, history);
    if (!res || !res.ok) {
        if (typeof alert === 'function') {
            alert(res?.error?.message || 'Plan arşivlenirken bir hata oluştu.');
        }
        return res;
    }
    showSyncStatus('📦 Plan arşivlendi', false);
    return res;
}

let _cpEditorCounter = 0;

export function showCoachingPlanEditor(studentId, existingPlan) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    document.getElementById('coachingPlanEditorModal')?.remove();
    const isEdit = Boolean(existingPlan && existingPlan.id);
    const plan = existingPlan || createEmptyCoachingPlan();
    const wt = plan.weeklyTargets || {};
    const branches = Array.isArray(plan.branchTargets) ? plan.branchTargets : [];
    const topics = Array.isArray(plan.topicTargets) ? plan.topicTargets : [];
    const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
    const branchesJson = JSON.stringify(branches).replace(/"/g, '&quot;');
    const topicsJson = JSON.stringify(topics).replace(/"/g, '&quot;');
    const tasksJson = JSON.stringify(tasks).replace(/"/g, '&quot;');
    const dayOptions = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map(d => `<option value="${d}">${d}</option>`).join('');
    const taskTypeOptions = `<option value="question">Soru</option><option value="exam">Deneme</option><option value="review">Tekrar</option><option value="reading">Okuma</option><option value="custom">Özel</option>`;
    document.body.insertAdjacentHTML('beforeend', `
        <div id="coachingPlanEditorModal" class="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto" role="dialog" aria-modal="true">
            <div class="app-modal max-w-3xl mx-auto my-4 sm:my-8">
                <div class="app-modal-header flex items-start justify-between gap-4">
                    <div><h3 class="text-xl font-black">${isEdit ? 'Koçluk Planını Düzenle' : 'Koçluk Planı Oluştur'}</h3><p class="text-sm text-gray-500 mt-1">${escapeHtml(student.adSoyad)} için plan oluşturun.</p></div>
                    <button onclick="closeCoachingPlanEditor()" class="min-w-[44px] min-h-[44px] text-gray-500" aria-label="Kapat"><i class="fas fa-times"></i></button>
                </div>
                <div class="app-modal-body space-y-6">
                    <input type="hidden" id="cpEditId" value="${isEdit ? escapeHtml(plan.id) : ''}">
                    <input type="hidden" id="cpEditCreatedAt" value="${isEdit ? escapeHtml(plan.createdAt || '') : ''}">
                    <input type="hidden" id="cpBranchesData" value='${branchesJson}'>
                    <input type="hidden" id="cpTopicsData" value='${topicsJson}'>
                    <input type="hidden" id="cpTasksData" value='${tasksJson}'>

                    <section>
                        <h4 class="font-black text-sm mb-3">Genel Hedefler</h4>
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <label class="text-xs font-bold">Haftalık Toplam Soru<input type="number" id="cpTotalQuestions" min="0" step="1" value="${wt.totalQuestions ?? ''}" class="student-form-input mt-1 min-h-[44px]"></label>
                            <label class="text-xs font-bold">Genel Deneme Hedefi<input type="number" id="cpGeneralExams" min="0" step="1" value="${wt.generalExams ?? ''}" class="student-form-input mt-1 min-h-[44px]"></label>
                            <label class="text-xs font-bold">Branş Deneme Hedefi<input type="number" id="cpBranchExams" min="0" step="1" value="${wt.branchExams ?? ''}" class="student-form-input mt-1 min-h-[44px]"></label>
                            <label class="text-xs font-bold">Okuma Hedefi<input type="number" id="cpReadingTarget" min="0" step="1" value="${wt.readingTarget ?? ''}" class="student-form-input mt-1 min-h-[44px]"></label>
                            <label class="text-xs font-bold">Tekrar Oturumu<input type="number" id="cpReviewSessions" min="0" step="1" value="${wt.reviewSessions ?? ''}" class="student-form-input mt-1 min-h-[44px]"></label>
                        </div>
                    </section>

                    <section>
                        <div class="flex items-center justify-between mb-3"><h4 class="font-black text-sm">Branş Hedefleri</h4><button onclick="addCpBranch()" class="btn-secondary min-h-[44px] px-3 text-xs font-bold"><i class="fas fa-plus mr-1"></i>Branş Hedefi</button></div>
                        <div id="cpBranchRows" class="space-y-2"></div>
                    </section>

                    <section>
                        <div class="flex items-center justify-between mb-3"><h4 class="font-black text-sm">Konu Hedefleri</h4><button onclick="addCpTopic()" class="btn-secondary min-h-[44px] px-3 text-xs font-bold"><i class="fas fa-plus mr-1"></i>Konu Hedefi</button></div>
                        <div id="cpTopicRows" class="space-y-2"></div>
                    </section>

                    <section>
                        <div class="flex items-center justify-between mb-3"><h4 class="font-black text-sm">Haftalık Görevler</h4><button onclick="addCpTask()" class="btn-secondary min-h-[44px] px-3 text-xs font-bold"><i class="fas fa-plus mr-1"></i>Görev</button></div>
                        <div id="cpTaskRows" class="space-y-3"></div>
                    </section>
                </div>
                <div class="app-modal-actions">
                    <button onclick="closeCoachingPlanEditor()" class="btn-secondary min-h-[44px]">Vazgeç</button>
                    <button onclick="saveCoachingPlanFromEditor('${studentId}')" class="btn-primary min-h-[44px]"><i class="fas fa-save mr-1"></i>${isEdit ? 'Güncelle' : 'Oluştur'}</button>
                </div>
            </div>
        </div>`);
    _cpEditorCounter = 0;
    renderCpBranchRows();
    renderCpTopicRows();
    renderCpTaskRows(dayOptions, taskTypeOptions);
}

function renderCpBranchRows() {
    const data = JSON.parse(document.getElementById('cpBranchesData').value || '[]');
    const container = document.getElementById('cpBranchRows');
    if (!container) return;
    if (!data.length) { container.innerHTML = '<p class="text-xs text-gray-400 dark:text-gray-500 italic">Henüz branş hedefi eklenmedi.</p>'; return; }
    container.innerHTML = data.map((b, i) => `
        <div class="flex flex-col sm:flex-row gap-2 items-end rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900/50">
            <label class="text-xs font-bold flex-1 w-full">Ders<input type="text" data-cp-branch="${i}" data-field="subject" value="${escapeHtml(b.subject || '')}" class="student-form-input mt-1 min-h-[44px] w-full"></label>
            <label class="text-xs font-bold w-24">Soru Hedefi<input type="number" min="0" step="1" data-cp-branch="${i}" data-field="questionTarget" value="${b.questionTarget ?? ''}" class="student-form-input mt-1 min-h-[44px] w-full"></label>
            <label class="text-xs font-bold w-24">Deneme Hedefi<input type="number" min="0" step="1" data-cp-branch="${i}" data-field="examTarget" value="${b.examTarget ?? ''}" class="student-form-input mt-1 min-h-[44px] w-full"></label>
            <button onclick="removeCpBranch(${i})" class="min-w-[44px] min-h-[44px] text-red-500 hover:text-red-700 flex-shrink-0" title="Sil"><i class="fas fa-trash"></i></button>
        </div>`).join('');
    container.querySelectorAll('input[data-cp-branch]').forEach(el => {
        el.addEventListener('input', () => {
            const arr = JSON.parse(document.getElementById('cpBranchesData').value || '[]');
            const idx = Number(el.dataset.cpBranch);
            const field = el.dataset.field;
            if (field === 'subject') arr[idx].subject = el.value;
            else arr[idx][field] = el.value === '' ? null : Number(el.value);
            document.getElementById('cpBranchesData').value = JSON.stringify(arr);
        });
    });
}

function renderCpTopicRows() {
    const data = JSON.parse(document.getElementById('cpTopicsData').value || '[]');
    const container = document.getElementById('cpTopicRows');
    if (!container) return;
    if (!data.length) { container.innerHTML = '<p class="text-xs text-gray-400 dark:text-gray-500 italic">Henüz konu hedefi eklenmedi.</p>'; return; }
    container.innerHTML = data.map((t, i) => `
        <div class="flex flex-col sm:flex-row gap-2 items-end rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900/50">
            <label class="text-xs font-bold flex-1 w-full">Ders<input type="text" data-cp-topic="${i}" data-field="subject" value="${escapeHtml(t.subject || '')}" class="student-form-input mt-1 min-h-[44px] w-full"></label>
            <label class="text-xs font-bold flex-1 w-full">Konu<input type="text" data-cp-topic="${i}" data-field="topic" value="${escapeHtml(t.topic || '')}" class="student-form-input mt-1 min-h-[44px] w-full"></label>
            <label class="text-xs font-bold w-24">Soru Hedefi<input type="number" min="0" step="1" data-cp-topic="${i}" data-field="questionTarget" value="${t.questionTarget ?? ''}" class="student-form-input mt-1 min-h-[44px] w-full"></label>
            <button onclick="removeCpTopic(${i})" class="min-w-[44px] min-h-[44px] text-red-500 hover:text-red-700 flex-shrink-0" title="Sil"><i class="fas fa-trash"></i></button>
        </div>`).join('');
    container.querySelectorAll('input[data-cp-topic]').forEach(el => {
        el.addEventListener('input', () => {
            const arr = JSON.parse(document.getElementById('cpTopicsData').value || '[]');
            const idx = Number(el.dataset.cpTopic);
            const field = el.dataset.field;
            if (field === 'subject' || field === 'topic') arr[idx][field] = el.value;
            else arr[idx][field] = el.value === '' ? null : Number(el.value);
            document.getElementById('cpTopicsData').value = JSON.stringify(arr);
        });
    });
}

function renderCpTaskRows(dayOptions, taskTypeOptions) {
    const data = JSON.parse(document.getElementById('cpTasksData').value || '[]');
    const container = document.getElementById('cpTaskRows');
    if (!container) return;
    if (!data.length) { container.innerHTML = '<p class="text-xs text-gray-400 dark:text-gray-500 italic">Henüz görev eklenmedi.</p>'; return; }
    if (!dayOptions) dayOptions = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map(d => `<option value="${d}">${d}</option>`).join('');
    if (!taskTypeOptions) taskTypeOptions = '<option value="question">Soru</option><option value="exam">Deneme</option><option value="review">Tekrar</option><option value="reading">Okuma</option><option value="custom">Özel</option>';
    container.innerHTML = data.map((t, i) => `
        <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900/50 space-y-2">
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-gray-500 dark:text-gray-400">Görev #${i + 1}</span>
                <button onclick="removeCpTask(${i})" class="min-w-[44px] min-h-[44px] text-red-500 hover:text-red-700" title="Sil"><i class="fas fa-trash"></i></button>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <label class="text-xs font-bold">Görev<input type="text" data-cp-task="${i}" data-field="title" value="${escapeHtml(t.title || '')}" class="student-form-input mt-1 min-h-[44px] w-full"></label>
                <label class="text-xs font-bold">Tür<select data-cp-task="${i}" data-field="taskType" class="student-form-input mt-1 min-h-[44px] w-full">${taskTypeOptions.replace(`value="${t.taskType || 'question'}"`, `value="${t.taskType || 'question'}" selected`)}</select></label>
                <label class="text-xs font-bold">Ders<input type="text" data-cp-task="${i}" data-field="subject" value="${escapeHtml(t.subject || '')}" class="student-form-input mt-1 min-h-[44px] w-full"></label>
                <label class="text-xs font-bold">Konu<input type="text" data-cp-task="${i}" data-field="topic" value="${escapeHtml(t.topic || '')}" class="student-form-input mt-1 min-h-[44px] w-full"></label>
                <label class="text-xs font-bold">Kaynak<input type="text" data-cp-task="${i}" data-field="resource" value="${escapeHtml(t.resource || '')}" class="student-form-input mt-1 min-h-[44px] w-full"></label>
                <label class="text-xs font-bold">Soru Hedefi<input type="number" min="0" step="1" data-cp-task="${i}" data-field="questionTarget" value="${t.questionTarget ?? ''}" class="student-form-input mt-1 min-h-[44px] w-full"></label>
                <label class="text-xs font-bold">Gün<select data-cp-task="${i}" data-field="dueDay" class="student-form-input mt-1 min-h-[44px] w-full"><option value="">Haftalık</option>${dayOptions.replace(`value="${t.dueDay}"`, `value="${t.dueDay}" selected`)}</select></label>
                <label class="text-xs font-bold">Süre (dk)<input type="number" min="0" step="5" data-cp-task="${i}" data-field="durationMinutes" value="${t.durationMinutes ?? ''}" class="student-form-input mt-1 min-h-[44px] w-full"></label>
            </div>
            <label class="text-xs font-bold w-full">Not<input type="text" data-cp-task="${i}" data-field="notes" value="${escapeHtml(t.notes || '')}" class="student-form-input mt-1 min-h-[44px] w-full"></label>
        </div>`).join('');
    container.querySelectorAll('input[data-cp-task], select[data-cp-task]').forEach(el => {
        el.addEventListener('input', () => {
            const arr = JSON.parse(document.getElementById('cpTasksData').value || '[]');
            const idx = Number(el.dataset.cpTask);
            const field = el.dataset.field;
            const val = el.value;
            if (['title', 'subject', 'topic', 'resource', 'notes', 'dueDay', 'taskType'].includes(field)) arr[idx][field] = val || undefined;
            else arr[idx][field] = val === '' ? undefined : Number(val);
            document.getElementById('cpTasksData').value = JSON.stringify(arr);
        });
    });
}

function _newCpId() { return 'ct_' + Date.now() + '_' + (++_cpEditorCounter); }

if (typeof window !== 'undefined') {
    window.addCpBranch = function() {
        const arr = JSON.parse(document.getElementById('cpBranchesData').value || '[]');
        arr.push({ id: _newCpId(), subject: '', questionTarget: null, examTarget: null });
        document.getElementById('cpBranchesData').value = JSON.stringify(arr);
        renderCpBranchRows();
    };
    window.removeCpBranch = function(idx) {
        const arr = JSON.parse(document.getElementById('cpBranchesData').value || '[]');
        arr.splice(idx, 1);
        document.getElementById('cpBranchesData').value = JSON.stringify(arr);
        renderCpBranchRows();
    };
    window.addCpTopic = function() {
        const arr = JSON.parse(document.getElementById('cpTopicsData').value || '[]');
        arr.push({ id: _newCpId(), subject: '', topic: '', questionTarget: null });
        document.getElementById('cpTopicsData').value = JSON.stringify(arr);
        renderCpTopicRows();
    };
    window.removeCpTopic = function(idx) {
        const arr = JSON.parse(document.getElementById('cpTopicsData').value || '[]');
        arr.splice(idx, 1);
        document.getElementById('cpTopicsData').value = JSON.stringify(arr);
        renderCpTopicRows();
    };
    window.addCpTask = function() {
        const arr = JSON.parse(document.getElementById('cpTasksData').value || '[]');
        arr.push({ id: _newCpId(), title: '', taskType: 'question', subject: '', topic: '', resource: '', questionTarget: null, dueDay: '', durationMinutes: null, notes: '' });
        document.getElementById('cpTasksData').value = JSON.stringify(arr);
        renderCpTaskRows();
    };
    window.removeCpTask = function(idx) {
        const arr = JSON.parse(document.getElementById('cpTasksData').value || '[]');
        arr.splice(idx, 1);
        document.getElementById('cpTasksData').value = JSON.stringify(arr);
        renderCpTaskRows();
    };
    window.closeCoachingPlanEditor = function() { document.getElementById('coachingPlanEditorModal')?.remove(); };
    window.saveCoachingPlanFromEditor = async function(studentId) {
        const val = (id) => { const v = document.getElementById(id)?.value?.trim(); return v === '' || v === null || v === undefined ? null : v; };
        const numVal = (id) => { const v = document.getElementById(id)?.value?.trim(); if (v === '' || v === null || v === undefined) return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; };
        const editId = val('cpEditId') || undefined;
        const createdAt = val('cpEditCreatedAt') || undefined;
        const planData = {
            id: editId || _newCpId(),
            createdAt: createdAt || new Date().toISOString(),
            status: 'draft',
            weeklyTargets: { totalQuestions: numVal('cpTotalQuestions'), generalExams: numVal('cpGeneralExams'), branchExams: numVal('cpBranchExams'), readingTarget: numVal('cpReadingTarget'), reviewSessions: numVal('cpReviewSessions') },
            branchTargets: JSON.parse(document.getElementById('cpBranchesData')?.value || '[]'),
            topicTargets: JSON.parse(document.getElementById('cpTopicsData')?.value || '[]'),
            tasks: JSON.parse(document.getElementById('cpTasksData')?.value || '[]')
        };
        await saveCoachingPlanForStudent(studentId, planData);
        closeCoachingPlanEditor();
    };
}


export function exportStudyPlanToPdf(studentId) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    const planProfile = student.studyPlanProfile || {};
    const stage = planProfile.stage || 'beginner';
    const dailyQuestionCount = stage === 'advanced' ? '40 veya daha fazla' : stage === 'intermediate' ? '25' : '15';
    const stageLabel = stage === 'advanced' ? 'İleri' : stage === 'intermediate' ? 'Orta' : 'Başlangıç';
    const adviceList = [
        `<div class="advice-card medium"><h4>Türkçe · Günlük Paragraf Rutini</h4><p>Her gün ${dailyQuestionCount} paragraf sorusu çöz. Yanlış yaptığın sorularda cevap anahtarına bakmadan önce metne dönüp doğru seçeneğin gerekçesini bul.</p></div>`,
        `<div class="advice-card excellent"><h4>Matematik · Yeni Nesil Soru Rutini</h4><p>Her gün ${dailyQuestionCount} yeni nesil matematik sorusu çöz. Çözemediğin soruyu işaretle, çözümünü öğrendikten sonra aynı soruyu yeniden çöz.</p></div>`
    ];
    const selectedTechniques = Array.isArray(planProfile.techniques) && planProfile.techniques.length ? planProfile.techniques : Object.keys(STUDY_TECHNIQUE_GUIDES);
    const techniqueGuideHtml = selectedTechniques.map(key => STUDY_TECHNIQUE_GUIDES[key]).filter(Boolean).map(guide => `
        <div class="technique-card"><h4>${guide.title}</h4><p>${guide.explanation}</p><p class="example">${guide.example}</p></div>`).join('');
    
    const gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
    const tableHeaders = gunler.map(gun => `<th>${gun}</th>`).join('');
    const tableCells = gunler.map(gun => {
        const tasks = student.studyPlan && student.studyPlan[gun] ? student.studyPlan[gun] : [];
        const tasksHtml = tasks.map(task => {
            const taskTitle = typeof task === 'string' ? task : (task?.title || task?.konu || task?.name || task?.text || 'Görev');
            return `<div class="task-item">${escapeHtml(taskTitle)}</div>`;
        }).join('')
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
                    grid-template-columns: repeat(2, 1fr);
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
                .technique-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
                .technique-card { border: 1px solid #DDE2EA; border-radius: 8px; padding: 10px; background: #F8FAFC; break-inside: avoid; }
                .technique-card h4 { margin: 0 0 5px; color: #394B87; font-size: 12px; }
                .technique-card p { margin: 0; color: #475467; font-size: 10.5px; line-height: 1.45; }
                .technique-card .example { margin-top: 6px; font-weight: 700; color: #182033; }
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
                    <strong>Haftalık Soru Hedefi:</strong> ${weeklyTarget} Soru<br>
                    <strong>Çalışma Aşaması:</strong> ${stageLabel}${planProfile.badge ? ` · ${escapeHtml(planProfile.badge)}` : ''}
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

            <div class="section-title">🧠 ÇALIŞMA TEKNİKLERİ NASIL UYGULANIR?</div>
            <div class="technique-grid">${techniqueGuideHtml}</div>
            
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

export async function resetStudentError(studentId, errorKey) {
    await markGrowthErrorSolved(studentId, errorKey);
    if (window.renderStudentPanel) {
        window.renderStudentPanel(studentId).then(() => {
            if (window.switchStudentTab) window.switchStudentTab('calisma');
        });
    }
}
export const markErrorAsSolved = resetStudentError;

export async function changeGrowthTarget(studentId, newTarget) {
    const parsed = parseInt(newTarget);
    if (isNaN(parsed) || parsed <= 0) return;
    await updateGrowthWeeklyTarget(studentId, parsed);
    showSyncStatus("🎯 Hedef başarıyla güncellendi", false);
}

export async function addGrowthLog(studentId, logData = null) {
    let date = "";
    let count = 0;
    if (logData && typeof logData === 'object') {
        date = logData.date;
        count = parseInt(logData.count);
    } else {
        const dateInput = document.getElementById("growthLogDate");
        const countInput = document.getElementById("growthLogCount");
        date = dateInput ? dateInput.value : "";
        count = countInput ? parseInt(countInput.value) : 0;
    }
    
    if (!date || isNaN(count) || count <= 0) {
        if (typeof alert === 'function') {
            alert("Geçerli bir tarih ve çözülen soru sayısı giriniz!");
        }
        return;
    }

    const res = await addGrowthLogAtomic(studentId, { date, count });
    if (res && !res.ok && res.blockedOffline) {
        if (typeof alert === 'function') alert(res.message);
        return;
    }
    if (window.renderStudentPanel) {
        window.renderStudentPanel(studentId).then(() => {
            if (window.switchStudentTab) window.switchStudentTab('calisma');
        });
    }
}

export async function deleteGrowthLog(studentId, logIdxOrIdentifier) {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        if (!confirm("Bu soru sayısı kaydını silmek istediğinize emin misiniz?")) return;
    }
    const students = loadStudentsData();
    const s = students.find(item => item.id === studentId);
    let logIdentifier = {};
    if (typeof logIdxOrIdentifier === 'number') {
        const targetLog = s?.growthPlan?.logs?.[logIdxOrIdentifier];
        let occurrence = 0;
        if (s?.growthPlan?.logs && targetLog) {
            for (let i = 0; i < logIdxOrIdentifier; i++) {
                const l = s.growthPlan.logs[i];
                if (l && l.date === targetLog.date && Number(l.count) === Number(targetLog.count)) {
                    occurrence++;
                }
            }
        }
        logIdentifier = {
            logId: targetLog?.id,
            date: targetLog?.date,
            count: targetLog?.count,
            index: logIdxOrIdentifier,
            occurrence
        };
    } else if (typeof logIdxOrIdentifier === 'string') {
        logIdentifier = { logId: logIdxOrIdentifier };
    } else if (logIdxOrIdentifier && typeof logIdxOrIdentifier === 'object') {
        logIdentifier = logIdxOrIdentifier;
    }

    const res = await deleteGrowthLogAtomic(studentId, logIdentifier);
    if (res && !res.ok && res.blockedOffline) {
        if (typeof alert === 'function') alert(res.message);
        return;
    }
    if (window.renderStudentPanel) {
        window.renderStudentPanel(studentId).then(() => {
            if (window.switchStudentTab) window.switchStudentTab('calisma');
        });
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
if (typeof window !== 'undefined') {
    window.addStudyTask = addStudyTask;
    window.deleteStudyTask = deleteStudyTask;
    window.autoPopulateStudyPlan = autoPopulateStudyPlan;
    window.generateAdaptiveStudyPlan = generateAdaptiveStudyPlan;
    window.showStudyPlanSetup = showStudyPlanSetup;
    window.closeStudyPlanSetup = closeStudyPlanSetup;
    window.updateStudyPlanPreview = updateStudyPlanPreview;
    window.createConfiguredStudyPlan = createConfiguredStudyPlan;
    window.exportStudyPlanToPdf = exportStudyPlanToPdf;
    window.showCoachingPlanEditor = showCoachingPlanEditor;
    window.resetStudentError = resetStudentError;
    window.markErrorAsSolved = markErrorAsSolved;
    window.changeGrowthTarget = changeGrowthTarget;
    window.addGrowthLog = addGrowthLog;
    window.deleteGrowthLog = deleteGrowthLog;
    window.setErrorFilter = setErrorFilter;
}

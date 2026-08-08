import { loadStudentsData, saveStudentsData, loadSchedule, getStudentOdevler, escapeHtml } from './store.js';
import { buildTodayItems, buildWeeklySummaryMessage, calculateWeeklyGoalProgress, getWeekKey } from './weekly-goal-insights.js';

function normalizePhone(phone) {
    let value = String(phone || '').replace(/\D/g, '');
    if (value.startsWith('0')) value = `90${value.slice(1)}`;
    else if (!value.startsWith('90') && value.length === 10) value = `90${value}`;
    return value.length >= 12 ? value : '';
}

function progressBar(label, value, target, percent, color) {
    return `<div>
        <div class="flex justify-between text-xs font-bold text-gray-600 dark:text-gray-300"><span>${label}</span><span>${value} / ${target}</span></div>
        <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-1"><div class="h-full ${color} rounded-full" style="width:${percent}%"></div></div>
    </div>`;
}

function todayItemHtml(studentId, item) {
    const styles = {
        overdue: ['fa-exclamation-circle', 'text-red-600', 'bg-red-50 dark:bg-red-950/20'],
        homework: ['fa-book', 'text-amber-600', 'bg-amber-50 dark:bg-amber-950/20'],
        lesson: ['fa-clock', 'text-blue-600', 'bg-blue-50 dark:bg-blue-950/20'],
        study: ['fa-check-square', 'text-green-600', 'bg-green-50 dark:bg-green-950/20']
    }[item.type];
    const action = item.type === 'study'
        ? `<button onclick="toggleWeeklyStudyTask('${studentId}', '${encodeURIComponent(item.taskId)}')" class="text-xs font-bold text-green-700 dark:text-green-400 border border-green-300 dark:border-green-800 px-2 py-1 rounded-lg min-h-[36px]">Tamamla</button>`
        : '';
    return `<div class="${styles[2]} rounded-lg p-2.5 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0"><i class="fas ${styles[0]} ${styles[1]}"></i><div class="min-w-0"><p class="text-sm font-bold text-gray-800 dark:text-white truncate">${escapeHtml(item.label)}</p><p class="text-[11px] text-gray-500">${escapeHtml(item.detail)}</p></div></div>${action}
    </div>`;
}

export function renderWeeklyGoalsDashboard(now = new Date()) {
    const students = loadStudentsData();
    if (!students.length) return `<section class="bg-white dark:bg-gray-800 rounded-2xl p-5 border"><h2 class="text-xl font-black"><i class="fas fa-bullseye text-rose-500"></i> Bugün Yapılacaklar</h2><p class="text-sm text-gray-500 mt-2">Haftalık hedefleri görmek için önce öğrenci ekleyin.</p></section>`;
    const cards = students.map(student => {
        const progress = calculateWeeklyGoalProgress(student, now);
        const items = buildTodayItems(student, getStudentOdevler(student), loadSchedule(student.id), now);
        const itemList = items.length ? items.slice(0, 5).map(item => todayItemHtml(student.id, item)).join('') : '<p class="text-sm text-green-700 dark:text-green-400 font-bold bg-green-50 dark:bg-green-950/20 rounded-lg p-3"><i class="fas fa-check-circle"></i> Bugün için bekleyen iş yok.</p>';
        const phone = normalizePhone(student.veliTel);
        return `<article class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm space-y-4">
            <div class="flex items-start justify-between gap-3">
                <div><button onclick="renderStudentPanel('${student.id}')" class="font-black text-left text-gray-800 dark:text-white hover:text-indigo-600">${escapeHtml(student.adSoyad)}</button><p class="text-xs text-gray-500">Haftalık genel ilerleme: %${progress.overallPercent}</p></div>
                <button onclick="showWeeklyGoalModal('${student.id}')" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1.5 rounded-lg min-h-[36px]"><i class="fas fa-sliders-h"></i> Hedefler</button>
            </div>
            <div class="space-y-2">
                ${progressBar('Soru', progress.questionCount, progress.goals.questionTarget, progress.questionPercent, 'bg-indigo-600')}
                ${progressBar('Çalışma görevi', progress.completedTaskCount, progress.goals.taskTarget, progress.taskPercent, 'bg-emerald-600')}
                ${progressBar('Net', progress.latestNet, progress.goals.netTarget, progress.netPercent, 'bg-purple-600')}
            </div>
            <div><h3 class="text-xs font-black uppercase tracking-wide text-gray-500 mb-2">Bugün</h3><div class="space-y-2">${itemList}</div></div>
            <div class="bg-indigo-50 dark:bg-indigo-950/20 rounded-lg p-3 text-xs text-indigo-800 dark:text-indigo-300"><i class="fas fa-lightbulb text-amber-500"></i> ${escapeHtml(progress.recommendation)}</div>
            ${phone ? `<button onclick="shareWeeklySummary('${student.id}')" class="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl py-2.5 text-sm font-bold min-h-[44px]"><i class="fab fa-whatsapp"></i> Haftalık Özeti Veliye Gönder</button>` : '<p class="text-xs text-amber-600 font-semibold">Özet göndermek için geçerli veli telefonu ekleyin.</p>'}
        </article>`;
    }).join('');
    const totalToday = students.reduce((count, student) => count + buildTodayItems(student, getStudentOdevler(student), loadSchedule(student.id), now).length, 0);
    return `<section class="space-y-4" aria-labelledby="todayDashboardHeading">
        <div class="flex items-center justify-between gap-3 flex-wrap"><div><h2 id="todayDashboardHeading" class="text-2xl font-black text-gray-800 dark:text-white"><i class="fas fa-calendar-check text-rose-500"></i> Bugün Yapılacaklar</h2><p class="text-sm text-gray-500">Haftalık hedefler, geciken ödevler, dersler ve çalışma görevleri</p></div><span class="bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300 px-3 py-1.5 rounded-full text-xs font-black">${totalToday} bekleyen iş</span></div>
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">${cards}</div>
    </section>`;
}

export function showWeeklyGoalModal(studentId) {
    const student = loadStudentsData().find(item => item.id === studentId);
    if (!student) return;
    const progress = calculateWeeklyGoalProgress(student);
    const modal = document.createElement('div');
    modal.id = 'weeklyGoalModal';
    modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `<div class="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl" onclick="event.stopPropagation()"><h2 class="text-xl font-black mb-4">🎯 ${escapeHtml(student.adSoyad)} Hedefleri</h2><div class="space-y-3">
        <label class="block text-sm font-bold">Haftalık soru hedefi<input id="weeklyQuestionTarget" type="number" min="1" value="${progress.goals.questionTarget}" class="student-form-input mt-1"></label>
        <label class="block text-sm font-bold">Haftalık çalışma görevi hedefi<input id="weeklyTaskTarget" type="number" min="1" value="${progress.goals.taskTarget}" class="student-form-input mt-1"></label>
        <label class="block text-sm font-bold">Net hedefi<input id="weeklyNetTarget" type="number" min="1" step="0.01" value="${progress.goals.netTarget}" class="student-form-input mt-1"></label>
        <button onclick="saveWeeklyGoals('${studentId}')" class="w-full bg-indigo-600 text-white rounded-xl py-2.5 font-bold min-h-[44px]">Kaydet</button><button onclick="this.closest('.fixed').remove()" class="w-full border rounded-xl py-2.5 font-bold min-h-[44px]">İptal</button>
    </div></div>`;
    modal.addEventListener('click', event => { if (event.target === modal) modal.remove(); });
    document.body.appendChild(modal);
}

export function saveWeeklyGoals(studentId) {
    const students = loadStudentsData();
    const student = students.find(item => item.id === studentId);
    const questionTarget = Number(document.getElementById('weeklyQuestionTarget')?.value);
    const taskTarget = Number(document.getElementById('weeklyTaskTarget')?.value);
    const netTarget = Number(document.getElementById('weeklyNetTarget')?.value);
    if (!student || questionTarget <= 0 || taskTarget <= 0 || netTarget <= 0) return alert('Tüm hedefler sıfırdan büyük olmalıdır.');
    student.weeklyGoals = { questionTarget, taskTarget, netTarget };
    student.growthPlan = { ...(student.growthPlan || {}), weeklyTarget: questionTarget, logs: student.growthPlan?.logs || [] };
    saveStudentsData(students);
    document.getElementById('weeklyGoalModal')?.remove();
    if (window.renderGenelIslemler) window.renderGenelIslemler();
}

export function toggleWeeklyStudyTask(studentId, encodedTaskId) {
    const taskId = decodeURIComponent(encodedTaskId);
    const students = loadStudentsData();
    const student = students.find(item => item.id === studentId);
    if (!student) return;
    const weekKey = getWeekKey();
    student.weeklyGoalProgress = student.weeklyGoalProgress || {};
    const progress = student.weeklyGoalProgress[weekKey] || { completedTasks: [] };
    progress.completedTasks = progress.completedTasks.includes(taskId) ? progress.completedTasks.filter(id => id !== taskId) : [...progress.completedTasks, taskId];
    student.weeklyGoalProgress[weekKey] = progress;
    saveStudentsData(students);
    if (window.renderGenelIslemler) window.renderGenelIslemler();
}

export function shareWeeklySummary(studentId) {
    const student = loadStudentsData().find(item => item.id === studentId);
    const phone = normalizePhone(student?.veliTel);
    if (!student || !phone) return;
    const progress = calculateWeeklyGoalProgress(student);
    const items = buildTodayItems(student, getStudentOdevler(student), loadSchedule(student.id));
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(buildWeeklySummaryMessage(student, progress, items))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}

window.showWeeklyGoalModal = showWeeklyGoalModal;
window.saveWeeklyGoals = saveWeeklyGoals;
window.toggleWeeklyStudyTask = toggleWeeklyStudyTask;
window.shareWeeklySummary = shareWeeklySummary;

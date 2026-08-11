import { loadStudentsData, escapeHtml, store } from './store.js';
import { updateMobileNavActive } from './auth.js';

export function renderGuidancePage(query = '') {
    store.currentPage = 'guidance';
    updateMobileNavActive('mobile-nav-guidance');
    const normalizedQuery = String(query || '').trim().toLocaleLowerCase('tr');
    const students = loadStudentsData().filter(student => !normalizedQuery || student.adSoyad.toLocaleLowerCase('tr').includes(normalizedQuery));
    document.getElementById('dynamic-content').innerHTML = `
        <div class="space-y-5">
            <div class="rounded-2xl bg-gradient-to-r from-violet-700 to-indigo-700 text-white p-6 shadow-xl">
                <h2 class="text-2xl font-black"><i class="fas fa-compass mr-2"></i> Rehberlik</h2>
                <p class="text-sm text-indigo-100 mt-1">Öğrenci gelişimi, analizler, hedefler ve çalışma planları</p>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-2xl border shadow p-4">
                <label for="guidanceSearch" class="block text-sm font-bold mb-2">Öğrenci Seçin</label>
                <div class="relative"><i class="fas fa-search absolute left-3 top-3.5 text-gray-400"></i><input id="guidanceSearch" value="${escapeHtml(query)}" oninput="filterGuidanceStudents(this.value)" class="student-form-input min-h-[44px] pl-10" placeholder="Öğrenci adıyla ara"></div>
            </div>
            <div id="guidanceStudentList" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                ${students.length ? students.map(student => `
                    <button onclick="openGuidanceStudent('${student.id}')" class="text-left bg-white dark:bg-gray-800 rounded-2xl border shadow p-5 hover:-translate-y-0.5 hover:shadow-lg transition min-h-[120px]">
                        <div class="flex items-center justify-between gap-3"><div><h3 class="font-black text-lg text-gray-800 dark:text-white">${escapeHtml(student.adSoyad)}</h3><p class="text-sm text-gray-500">${escapeHtml(student.okul || 'Okul belirtilmemiş')} · ${escapeHtml(student.sinif || '—')}. Sınıf</p></div><span class="w-11 h-11 rounded-full bg-violet-100 dark:bg-violet-950/30 text-violet-600 flex items-center justify-center"><i class="fas fa-arrow-right"></i></span></div>
                        <p class="text-xs text-violet-600 dark:text-violet-300 font-bold mt-4">Rehberlik dosyasını aç</p>
                    </button>`).join('') : '<div class="sm:col-span-2 text-center bg-white dark:bg-gray-800 rounded-2xl p-8 text-gray-500">Aramaya uygun öğrenci bulunamadı.</div>'}
            </div>
        </div>`;
}

export function filterGuidanceStudents(query) {
    renderGuidancePage(query);
    const input = document.getElementById('guidanceSearch');
    input?.focus();
    input?.setSelectionRange(query.length, query.length);
}

export async function openGuidanceStudent(studentId) {
    store.studentPanelOrigin = 'guidance';
    if (window.renderStudentPanel) await window.renderStudentPanel(studentId, 'guidance');
}

window.renderGuidancePage = renderGuidancePage;
window.filterGuidanceStudents = filterGuidanceStudents;
window.openGuidanceStudent = openGuidanceStudent;

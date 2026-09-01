// ==================== GUIDANCE CENTER MODULE ====================
// Karar destek ve önceliklendirme odaklı Premium Rehberlik Merkezi.

import { loadStudentsData, escapeHtml, store } from './store.js';
import { updateMobileNavActive } from './auth.js';
import { buildGuidanceCenterDashboard, getStudentInitials } from './guidance-center-insights.js';

export function renderGuidancePage(options = {}) {
    store.currentPage = 'guidance';
    if (window.currentPage) window.currentPage = 'guidance';
    updateMobileNavActive('mobile-nav-guidance');

    const query = typeof options === 'string' ? options : (options.query || window._guidanceFilters?.query || '');
    const priorityFilter = typeof options === 'object' && options.priority ? options.priority : (window._guidanceFilters?.priority || 'all');
    const gradeFilter = typeof options === 'object' && options.grade ? options.grade : (window._guidanceFilters?.grade || '');

    window._guidanceFilters = { query, priority: priorityFilter, grade: gradeFilter };

    const students = loadStudentsData();
    const dashboard = buildGuidanceCenterDashboard(students);
    const { studentPriorities, metrics, activeInterventions, recentActivities = [] } = dashboard;

    const normalizedQuery = String(query || '').trim().toLocaleLowerCase('tr-TR');

    const filteredStudents = studentPriorities.filter(item => {
        const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
        const matchesGrade = !gradeFilter || String(item.sinif || '') === String(gradeFilter);
        const matchesQuery = !normalizedQuery || item.studentName.toLocaleLowerCase('tr-TR').includes(normalizedQuery);
        return matchesPriority && matchesGrade && matchesQuery;
    });

    const metricCards = [
        ['fa-users', 'Takipteki Öğrenci', metrics.totalStudents, 'Kayıtlı aktif öğrenci'],
        ['fa-triangle-exclamation', 'Müdahale Gereken', metrics.needIntervention, `${metrics.highPriority} Yüksek · ${metrics.mediumPriority} Orta`],
        ['fa-compass', 'Aktif Çalışma Planı', metrics.activePlans, 'Bireysel programı tanımlı'],
        ['fa-calendar-check', 'Bu Hafta Aktif', metrics.recentContacted, 'Son 7 gün etkinlik kaydı']
    ];

    const priorityBadgeStyles = {
        high: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-900/60',
        medium: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900/60',
        watch: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-gray-200 dark:border-gray-700'
    };

    const priorityDotStyles = {
        high: 'bg-rose-500',
        medium: 'bg-amber-500',
        watch: 'bg-slate-400'
    };

    const priorityFilters = [
        ['all', 'Tümü', metrics.totalStudents],
        ['high', 'Yüksek Öncelik', metrics.highPriority],
        ['medium', 'Orta Öncelik', metrics.mediumPriority],
        ['watch', 'İzle / Stabil', metrics.watchPriority]
    ];

    const studentCardsHtml = filteredStudents.length ? filteredStudents.map(item => `
        <article class="app-panel p-5 space-y-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition">
            <!-- Student Header -->
            <div class="flex items-start justify-between gap-3 flex-wrap">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-sm text-slate-700 dark:text-slate-200 shrink-0">
                        ${escapeHtml(getStudentInitials(item.studentName))}
                    </div>
                    <div>
                        <h3 class="font-black text-base text-gray-900 dark:text-white leading-tight">
                            ${escapeHtml(item.studentName)}
                        </h3>
                        <p class="text-xs text-gray-500 mt-0.5">
                            ${escapeHtml(item.sinif ? `${item.sinif}. Sınıf` : 'Sınıf yok')}${item.okul ? ` · ${escapeHtml(item.okul)}` : ''}
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${priorityBadgeStyles[item.priority] || priorityBadgeStyles.watch}">
                    <span class="w-2 h-2 rounded-full ${priorityDotStyles[item.priority] || 'bg-gray-400'}"></span>
                    ${escapeHtml(item.priorityLabel)} Öncelik
                </div>
            </div>

            <!-- Neden? Alanı (Maksimum 3 Neden) -->
            <div class="space-y-1.5 pt-1">
                <p class="text-[11px] font-black uppercase tracking-wider text-gray-400">Neden müdahale gerekiyor?</p>
                <ul class="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                    ${item.reasons.map(r => `
                        <li class="flex items-start gap-2">
                            <span class="text-indigo-500 font-bold mt-0.5">•</span>
                            <span class="font-medium">${escapeHtml(r)}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>

            <!-- Önerilen İlk Adım -->
            <div class="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-1">
                <div class="flex items-center gap-1.5 text-xs font-black text-indigo-900 dark:text-indigo-200">
                    <i class="fas fa-lightbulb text-indigo-600 dark:text-indigo-400"></i>
                    <span>Önerilen İlk Adım: ${escapeHtml(item.recommendation.title)}</span>
                </div>
                <p class="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    ${escapeHtml(item.recommendation.action)}
                </p>
            </div>

            <!-- Aktif Çalışma Planı Bilgisi (Varsa) -->
            ${item.activePlan ? `
                <div class="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 pt-0.5">
                    <i class="fas fa-circle-check"></i>
                    <span>Aktif Plan: ${escapeHtml(item.activePlan.subject)} (${item.activePlan.durationWeeks} haftalık) · Devam ediyor</span>
                </div>
            ` : ''}

            <!-- Aksiyon Butonları -->
            <div class="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 flex-wrap">
                <button onclick="openGuidanceStudent('${item.studentId}')" class="btn-primary min-h-[40px] px-3.5 text-xs font-bold flex items-center gap-1.5">
                    <i class="fas fa-arrow-right"></i> Rehberlik Dosyasını Aç
                </button>
                <div class="flex items-center gap-1.5">
                    <button onclick="showStudyPlanSetup('${item.studentId}')" class="btn-secondary min-h-[40px] px-3 text-xs font-semibold" title="Akıllı Çalışma Planı Oluştur">
                        <i class="fas fa-compass mr-1"></i> Çalışma Planı
                    </button>
                    <button onclick="openCockpitHomework('${item.studentId}')" class="btn-secondary min-h-[40px] px-3 text-xs font-semibold" title="Ödev Ata">
                        <i class="fas fa-plus mr-1"></i> Ödev
                    </button>
                </div>
            </div>
        </article>
    `).join('') : `
        <div class="sm:col-span-2 app-panel p-12 text-center text-gray-500">
            <i class="fas fa-filter text-2xl text-gray-300 dark:text-gray-600 mb-2"></i>
            <p class="font-bold text-gray-800 dark:text-gray-200">Bu filtrelere uygun öğrenci bulunamadı.</p>
            <p class="text-xs text-gray-500 mt-1">Farklı bir öncelik veya arama kriteri seçebilirsiniz.</p>
        </div>
    `;

    const activeInterventionsHtml = activeInterventions.length ? activeInterventions.map(plan => `
        <div class="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200/60 dark:border-gray-800 flex items-center justify-between gap-3">
            <div>
                <p class="font-bold text-sm text-gray-900 dark:text-white">${escapeHtml(plan.studentName)}</p>
                <p class="text-xs text-gray-500 mt-0.5">${escapeHtml(plan.subject)} · ${plan.durationWeeks || 1} haftalık program</p>
            </div>
            <div class="flex items-center gap-1.5">
                <button onclick="exportStudyPlanToPdf('${plan.studentId}')" class="px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 min-h-[36px]" title="PDF İndir">
                    <i class="fas fa-file-pdf text-emerald-600 mr-1"></i> PDF
                </button>
                <button onclick="openGuidanceStudent('${plan.studentId}')" class="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 min-h-[36px]">
                    İncele
                </button>
            </div>
        </div>
    `).join('') : `
        <div class="p-6 text-center text-gray-400 text-xs">
            <i class="fas fa-compass text-lg text-gray-300 dark:text-gray-600 mb-1"></i>
            <p>Henüz aktif çalışma planı tanımlanmış öğrenci yok.</p>
        </div>
    `;

    const recentActivitiesHtml = recentActivities.length ? recentActivities.map((act, index) => `
        <div class="relative flex items-start gap-3 ${index < recentActivities.length - 1 ? 'pb-3' : ''}">
            ${index < recentActivities.length - 1 ? '<span class="absolute left-3.5 top-6 bottom-0 w-px bg-gray-200 dark:bg-gray-700"></span>' : ''}
            <span class="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-[11px] text-slate-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <i class="fas ${act.icon || 'fa-circle-info'}"></i>
            </span>
            <div class="min-w-0 flex-1">
                <div class="flex items-baseline justify-between gap-2">
                    <p class="font-bold text-xs text-gray-900 dark:text-white truncate">
                        ${escapeHtml(act.studentName)}
                    </p>
                    <time class="shrink-0 text-[11px] text-gray-400 font-medium">${escapeHtml(act.formattedDate || act.date)}</time>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">${escapeHtml(act.detail)}</p>
            </div>
        </div>
    `).join('') : `
        <div class="p-4 text-center text-gray-400 text-xs">
            <p>Henüz yakın tarihli hareket bulunmuyor.</p>
        </div>
    `;

    document.getElementById('dynamic-content').innerHTML = `
        <div class="app-page pb-28 sm:pb-8">
            <!-- Header -->
            <header class="app-page-header">
                <div>
                    <span class="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Öğretmen Karar Destek</span>
                    <h2 class="app-page-title">Rehberlik</h2>
                    <p class="app-page-subtitle">Öğrenci önceliklendirme, müdahale analizi ve çalışma planları</p>
                </div>
            </header>

            <!-- 4 Kompakt Üst Metrik -->
            <section class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                ${metricCards.map(([icon, label, value, detail]) => `
                    <article class="app-panel p-4">
                        <div class="flex items-center gap-2 text-gray-400">
                            <i class="fas ${icon} text-xs"></i>
                            <p class="text-[11px] font-black uppercase tracking-[.08em]">${label}</p>
                        </div>
                        <p class="mt-3 text-2xl font-black text-slate-900 dark:text-white">${value}</p>
                        <p class="mt-1 text-xs text-gray-500">${detail}</p>
                    </article>
                `).join('')}
            </section>

            <!-- Filtreler & Arama -->
            <section class="app-panel p-4 mt-3">
                <div class="flex flex-wrap gap-2">
                    ${priorityFilters.map(([key, label, count]) => `
                        <button onclick="updateGuidanceFilters({priority:'${key}'})" class="min-h-[38px] rounded-full border px-3 text-sm font-bold transition ${priorityFilter === key ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 text-gray-600 hover:border-indigo-300 dark:border-gray-700 dark:text-gray-300'}">
                            ${label}${count !== undefined ? ` <span class="ml-1 opacity-75">${count}</span>` : ''}
                        </button>
                    `).join('')}
                </div>
                <div class="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_150px]">
                    <label class="relative">
                        <span class="sr-only">Öğrenci ara</span>
                        <i class="fas fa-search absolute left-3 top-3 text-gray-400"></i>
                        <input id="guidanceSearchInput" value="${escapeHtml(query)}" oninput="updateGuidanceFilters({query:this.value})" class="student-form-input min-h-[40px] pl-10" placeholder="Öğrenci adıyla ara">
                    </label>
                    <select onchange="updateGuidanceFilters({grade:this.value})" class="student-form-input min-h-[40px]">
                        <option value="">Tüm sınıflar</option>
                        ${['5','6','7','8'].map(grade => `<option value="${grade}" ${gradeFilter === grade ? 'selected' : ''}>${grade}. Sınıf</option>`).join('')}
                    </select>
                </div>
            </section>

            <!-- 2-Column Main Content -->
            <section class="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,.75fr)] mt-4">
                <!-- Sol Kolon: Müdahale Gerektiren Öğrenciler -->
                <div class="space-y-3">
                    <div class="flex items-center justify-between px-1">
                        <h3 class="font-black text-lg text-gray-900 dark:text-white flex items-center gap-2">
                            <span>Müdahale Gerektiren Öğrenciler</span>
                            <span class="text-xs font-bold text-gray-400">(${filteredStudents.length} öğrenci)</span>
                        </h3>
                    </div>
                    <div class="grid grid-cols-1 gap-3">
                        ${studentCardsHtml}
                    </div>
                </div>

                <!-- Sağ Kolon: Aktif Çalışma Planları, Son Öğrenci Hareketleri ve Karar İlkeleri -->
                <div class="space-y-4">
                    <!-- Aktif Çalışma Planları -->
                    <article class="app-panel p-4 space-y-3">
                        <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                            <div>
                                <h4 class="font-black text-base text-gray-900 dark:text-white">Aktif Çalışma Planları</h4>
                                <p class="text-xs text-gray-500 mt-0.5">${activeInterventions.length} öğrenci devam ediyor</p>
                            </div>
                            <span class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs">
                                <i class="fas fa-compass"></i>
                            </span>
                        </div>
                        <div class="space-y-2">
                            ${activeInterventionsHtml}
                        </div>
                    </article>

                    <!-- Son Öğrenci Hareketleri -->
                    <article class="app-panel p-4 space-y-3">
                        <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                            <div>
                                <h4 class="font-black text-base text-gray-900 dark:text-white">Son Öğrenci Hareketleri</h4>
                                <p class="text-xs text-gray-500 mt-0.5">${recentActivities.length} yakın etkinlik</p>
                            </div>
                            <span class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs">
                                <i class="fas fa-clock-rotate-left"></i>
                            </span>
                        </div>
                        <div class="pt-1">
                            ${recentActivitiesHtml}
                        </div>
                    </article>

                    <!-- Karar Destek İlkeleri -->
                    <article class="app-panel p-4 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800 space-y-2.5">
                        <div class="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                            <i class="fas fa-shield-halved"></i>
                            <span>Önceliklendirme İlkeleri</span>
                        </div>
                        <ul class="text-xs text-gray-600 dark:text-gray-400 space-y-2 leading-relaxed">
                            <li class="flex items-start gap-2">
                                <span class="w-2 h-2 rounded-full bg-rose-500 mt-1 shrink-0"></span>
                                <div><strong class="text-gray-900 dark:text-white">Yüksek:</strong> Belirgin net düşüşü, kronik zayıf konu veya düşük ödev disiplini.</div>
                            </li>
                            <li class="flex items-start gap-2">
                                <span class="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0"></span>
                                <div><strong class="text-gray-900 dark:text-white">Orta:</strong> Tekil konu eksikliği, dikkatsizlik veya süre yönetimi eksiği.</div>
                            </li>
                            <li class="flex items-start gap-2">
                                <span class="w-2 h-2 rounded-full bg-slate-400 mt-1 shrink-0"></span>
                                <div><strong class="text-gray-900 dark:text-white">İzle:</strong> Performansı hedeflerle uyumlu, stabil ilerleyen öğrenciler.</div>
                            </li>
                        </ul>
                    </article>
                </div>
            </section>
        </div>
    `;
}

export function updateGuidanceFilters(nextFilters = {}) {
    const current = window._guidanceFilters || {};
    const merged = { ...current, ...nextFilters };
    renderGuidancePage(merged);
}

export function filterGuidanceStudents(query) {
    updateGuidanceFilters({ query });
    const input = document.getElementById('guidanceSearchInput');
    input?.focus();
    input?.setSelectionRange(query.length, query.length);
}

export async function openGuidanceStudent(studentId) {
    store.studentPanelOrigin = 'guidance';
    if (window.renderStudentPanel) await window.renderStudentPanel(studentId, 'guidance');
    else if (window.renderStudentCockpit) await window.renderStudentCockpit(studentId, 'guidance');
}

export function openCockpitHomework(studentId) {
    if (window.showOdevAtaModal) {
        window.showOdevAtaModal(studentId);
    }
}

window.renderGuidancePage = renderGuidancePage;
window.updateGuidanceFilters = updateGuidanceFilters;
window.filterGuidanceStudents = filterGuidanceStudents;
window.openGuidanceStudent = openGuidanceStudent;
window.openCockpitHomework = openCockpitHomework;

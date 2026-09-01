// ==================== GUIDANCE CENTER & STUDENT DETAIL MODULE ====================
// Karar destek, önceliklendirme ve öğrenci bazlı derin rehberlik detay analizi.

import { loadStudentsData, escapeHtml, store, getStudentOdevler } from './store.js';
import { updateMobileNavActive } from './auth.js';
import { buildGuidanceCenterDashboard, getStudentInitials } from './guidance-center-insights.js';
import { buildStudentGuidanceDetail } from './guidance-student-insights.js';

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

/**
 * Renders dedicated deep guidance decision report for a single student.
 */
export function renderGuidanceStudentDetail(studentId) {
    store.currentPage = 'guidance-detail';
    if (window.currentPage) window.currentPage = 'guidance-detail';
    updateMobileNavActive('mobile-nav-guidance');

    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return renderGuidancePage();

    const detail = buildStudentGuidanceDetail(student);

    const priorityBadgeStyles = {
        high: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-900/60',
        medium: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900/60',
        watch: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-gray-200 dark:border-gray-700'
    };

    const impactBadgeStyles = {
        positive: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200',
        neutral: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-gray-200',
        negative: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200'
    };

    const topMetrics = [
        ['fa-file-lines', 'Son Net', detail.recentExams.length ? `${detail.recentExams[0].net.toFixed(2)} net` : '—', detail.recentExams[0]?.name || 'Genel deneme kaydı yok'],
        ['fa-bullseye', 'Hedef Durumu', detail.hedefNet ? `${detail.hedefNet} net` : '—', detail.targetGap !== null ? (detail.targetGap <= 0 ? 'Hedefe ulaşıldı' : `${detail.targetGap.toFixed(2)} net fark`) : 'Hedef belirlenmedi'],
        ['fa-list-check', 'Ödev Disiplini', detail.discipline ? `%${detail.discipline.completionRate}` : '—', detail.discipline ? `${detail.discipline.completed} / ${detail.discipline.total} tamamlandı (${detail.discipline.overdue} geciken)` : 'Ödev kaydı yok'],
        ['fa-magnifying-glass', 'Baskın Hata', detail.dominantError ? detail.dominantError.label : '—', detail.dominantError ? `${detail.dominantError.count} hata tespiti` : 'Hata analizi yok']
    ];

    // Weak topics HTML
    const weakTopicsHtml = detail.repeatedTopics.length ? detail.repeatedTopics.map(t => `
        <div class="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200/60 dark:border-gray-800 flex items-center justify-between gap-2">
            <div>
                <p class="font-bold text-xs text-gray-900 dark:text-white">${escapeHtml(t.topic)}</p>
                <p class="text-[11px] text-gray-500 mt-0.5">${t.unite ? `${escapeHtml(t.unite)} · ` : ''}${t.assignmentCount > 1 ? `${t.assignmentCount} çalışmada tekrar etti` : 'Tekil çalışma'}</p>
            </div>
            <span class="px-2 py-1 rounded-md text-[11px] font-bold ${t.isChronic ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'} shrink-0">
                ${t.errorCount} Hata
            </span>
        </div>
    `).join('') : '<p class="text-xs text-gray-400 py-3">Tekrarlayan zayıf konu bulunmuyor.</p>';

    // Error Reasons HTML
    const errorReasonsHtml = detail.errorReasons.length ? detail.errorReasons.map(r => `
        <div class="space-y-1">
            <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-gray-800 dark:text-gray-200">${escapeHtml(r.label)}</span>
                <span class="text-gray-500 font-medium">${r.count} kez (%${r.percentage})</span>
            </div>
            <div class="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div class="h-full bg-indigo-500 rounded-full" style="width: ${r.percentage}%"></div>
            </div>
        </div>
    `).join('') : '<p class="text-xs text-gray-400 py-2">Kayıtlı hata nedeni bulunmuyor.</p>';

    // Recent Lessons HTML
    const recentLessonsHtml = detail.recentLessons.length ? detail.recentLessons.map(l => `
        <div class="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800 flex items-start justify-between gap-2 text-xs">
            <div>
                <p class="font-bold text-gray-900 dark:text-white">${escapeHtml(l.konu)}</p>
                <p class="text-[11px] text-gray-500 mt-0.5">${l.notlar ? escapeHtml(l.notlar) : 'Birebir ders'}</p>
            </div>
            <time class="text-[11px] text-gray-400 shrink-0">${escapeHtml(l.formattedDate || l.date)}</time>
        </div>
    `).join('') : '<p class="text-xs text-gray-400 py-2">Ders kaydı bulunmuyor.</p>';

    // Timeline HTML
    const timelineHtml = detail.timeline.length ? detail.timeline.map((act, index) => `
        <div class="relative flex items-start gap-3 ${index < detail.timeline.length - 1 ? 'pb-3' : ''}">
            ${index < detail.timeline.length - 1 ? '<span class="absolute left-3 top-6 bottom-0 w-px bg-gray-200 dark:bg-gray-700"></span>' : ''}
            <span class="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-[10px] text-slate-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <i class="fas ${act.icon || 'fa-circle-info'}"></i>
            </span>
            <div class="min-w-0 flex-1">
                <div class="flex items-baseline justify-between gap-2">
                    <p class="font-bold text-xs text-gray-900 dark:text-white truncate">
                        ${escapeHtml(act.typeLabel)}
                    </p>
                    <time class="shrink-0 text-[11px] text-gray-400">${escapeHtml(act.formattedDate || act.date)}</time>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">${escapeHtml(act.detail)}</p>
            </div>
        </div>
    `).join('') : '<p class="text-xs text-gray-400 py-4 text-center">Henüz aktivite kaydı yok.</p>';

    // Before / After Study Plan HTML
    let impactSectionHtml = '';
    const impact = detail.interventionImpact;
    if (impact.status === 'measured') {
        impactSectionHtml = `
            <div class="p-4 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200/60 dark:border-gray-800 space-y-3">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-xs font-black uppercase tracking-wider text-gray-400">Çalışma Planı</p>
                        <p class="font-bold text-sm text-gray-900 dark:text-white mt-0.5">${escapeHtml(impact.planSubject)} (${escapeHtml(impact.formattedPlanDate)})</p>
                    </div>
                    <span class="px-2.5 py-1 rounded-full text-xs font-black border ${impactBadgeStyles[impact.impactStatus] || impactBadgeStyles.neutral}">
                        ${escapeHtml(impact.impactLabel)}
                    </span>
                </div>
                <div class="grid grid-cols-3 gap-2 pt-1 border-t border-gray-200 dark:border-gray-800 text-center">
                    <div>
                        <p class="text-[11px] text-gray-400 font-medium">Plan Öncesi</p>
                        <p class="text-base font-black text-gray-800 dark:text-gray-100 mt-0.5">${impact.beforeNet.toFixed(2)} net</p>
                    </div>
                    <div>
                        <p class="text-[11px] text-gray-400 font-medium">Plan Sonrası</p>
                        <p class="text-base font-black text-gray-800 dark:text-gray-100 mt-0.5">${impact.afterNet.toFixed(2)} net</p>
                    </div>
                    <div>
                        <p class="text-[11px] text-gray-400 font-medium">Net Değişimi</p>
                        <p class="text-base font-black ${impact.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} mt-0.5">
                            ${impact.delta >= 0 ? `+${impact.delta.toFixed(2)}` : impact.delta.toFixed(2)}
                        </p>
                    </div>
                </div>
            </div>
        `;
    } else if (impact.status === 'pending_measurement') {
        impactSectionHtml = `
            <div class="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200/60 dark:border-amber-900/40 flex items-start gap-2.5">
                <i class="fas fa-hourglass-half text-amber-600 mt-0.5"></i>
                <div>
                    <p class="font-bold text-xs text-amber-900 dark:text-amber-200">${escapeHtml(impact.planSubject)} (${escapeHtml(impact.formattedPlanDate)})</p>
                    <p class="text-xs text-amber-700 dark:text-amber-300 mt-0.5">${escapeHtml(impact.message)}</p>
                </div>
            </div>
        `;
    } else {
        impactSectionHtml = `
            <div class="p-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800 text-center text-xs text-gray-400">
                <p>Henüz aktif veya tamamlanmış bir çalışma planı kaydı bulunmuyor.</p>
            </div>
        `;
    }

    document.getElementById('dynamic-content').innerHTML = `
        <div class="app-page pb-28 sm:pb-8">
            <!-- Header -->
            <header class="app-page-header">
                <div class="flex items-start justify-between gap-4 flex-wrap w-full">
                    <div class="flex items-center gap-3">
                        <button onclick="renderGuidancePage()" class="btn-secondary min-h-[44px] px-3" aria-label="Rehberlik Merkezine dön">
                            <i class="fas fa-arrow-left"></i>
                        </button>
                        <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-base text-slate-800 dark:text-slate-100 shrink-0">
                            ${escapeHtml(detail.initials)}
                        </div>
                        <div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <h2 class="app-page-title text-xl">${escapeHtml(detail.studentName)}</h2>
                                <span class="px-2.5 py-0.5 rounded-full text-xs font-black border ${priorityBadgeStyles[detail.priority]}">
                                    ${escapeHtml(detail.priorityLabel)} Öncelik
                                </span>
                            </div>
                            <p class="app-page-subtitle mt-0.5">${escapeHtml(detail.sinif ? `${detail.sinif}. Sınıf` : 'Sınıf yok')}${detail.okul ? ` · ${escapeHtml(detail.okul)}` : ''}${detail.hedefLise ? ` · Hedef: ${escapeHtml(detail.hedefLise)}` : ''}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <button onclick="showStudyPlanSetup('${studentId}')" class="btn-primary min-h-[44px] px-4 text-xs font-bold flex items-center gap-1.5">
                            <i class="fas fa-compass"></i> Çalışma Planı Oluştur
                        </button>
                        <button onclick="openCockpitHomework('${studentId}')" class="btn-secondary min-h-[44px] px-3.5 text-xs font-semibold">
                            <i class="fas fa-plus mr-1"></i> Ödev Ata
                        </button>
                        <button onclick="openStudentCockpitDirect('${studentId}')" class="btn-secondary min-h-[44px] px-3.5 text-xs font-semibold" title="Öğrenci Kokpiti">
                            <i class="fas fa-chart-line mr-1"></i> Kokpiti Aç
                        </button>
                    </div>
                </div>
            </header>

            <!-- Akademik Durum Özeti Box -->
            <section class="app-panel p-4 bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/50">
                <div class="flex items-start gap-2.5">
                    <span class="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs shrink-0 mt-0.5">
                        <i class="fas fa-chart-pie"></i>
                    </span>
                    <div>
                        <p class="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-300">Akademik Durum Özeti</p>
                        <p class="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-1 leading-relaxed">
                            ${escapeHtml(detail.mainProblemSummary)}
                        </p>
                    </div>
                </div>
            </section>

            <!-- 4 Kompakt Üst Metrik -->
            <section class="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                ${topMetrics.map(([icon, label, value, detailText]) => `
                    <article class="app-panel p-4">
                        <div class="flex items-center gap-2 text-gray-400">
                            <i class="fas ${icon} text-xs"></i>
                            <p class="text-[11px] font-black uppercase tracking-[.08em]">${label}</p>
                        </div>
                        <p class="mt-3 text-2xl font-black text-slate-900 dark:text-white">${value}</p>
                        <p class="mt-1 text-xs text-gray-500 truncate">${detailText}</p>
                    </article>
                `).join('')}
            </section>

            <!-- Ana 2 Kolonlu Blok: Kanıtlar vs Müdahale -->
            <section class="grid gap-4 lg:grid-cols-2 mt-4">
                <!-- Sol Kolon: Akademik Kanıtlar -->
                <div class="space-y-4">
                    <!-- Deneme Eğilimi & Son Sınavlar -->
                    <article class="app-panel p-5 space-y-3">
                        <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                            <h3 class="font-black text-base text-gray-900 dark:text-white">Deneme Eğilimi</h3>
                            ${detail.examTrend ? `
                                <span class="px-2.5 py-1 rounded-full text-xs font-black border ${detail.examTrend.trend === 'improving' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : (detail.examTrend.trend === 'declining' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-700 border-gray-200')}">
                                    ${escapeHtml(detail.examTrend.label)} (${detail.examTrend.delta >= 0 ? `+${detail.examTrend.delta.toFixed(2)}` : detail.examTrend.delta.toFixed(2)} net)
                                </span>
                            ` : '<span class="text-xs text-gray-400 font-medium">Yeterli deneme yok</span>'}
                        </div>
                        <div class="space-y-2">
                            ${detail.recentExams.length ? detail.recentExams.map(e => `
                                <div class="flex items-center justify-between text-xs p-2 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
                                    <span class="font-bold text-gray-800 dark:text-gray-200">${escapeHtml(e.name)}</span>
                                    <div class="flex items-center gap-3">
                                        <time class="text-gray-400">${escapeHtml(e.formattedDate)}</time>
                                        <span class="font-black text-indigo-600 dark:text-indigo-400">${e.net.toFixed(2)} Net</span>
                                    </div>
                                </div>
                            `).join('') : '<p class="text-xs text-gray-400 py-2">Genel deneme kaydı bulunamadı.</p>'}
                        </div>
                    </article>

                    <!-- Hata Nedenleri Dağılımı -->
                    <article class="app-panel p-5 space-y-3">
                        <h3 class="font-black text-base text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-3">
                            Hata Türleri Dağılımı
                        </h3>
                        <div class="space-y-2.5">
                            ${errorReasonsHtml}
                        </div>
                    </article>

                    <!-- Tekrarlayan Zayıf Konular -->
                    <article class="app-panel p-5 space-y-3">
                        <h3 class="font-black text-base text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-3">
                            Tekrarlayan Zayıf Alanlar
                        </h3>
                        <div class="space-y-2">
                            ${weakTopicsHtml}
                        </div>
                    </article>
                </div>

                <!-- Sağ Kolon: Müdahale ve Sonuç Değerlendirmesi -->
                <div class="space-y-4">
                    <!-- Önerilen İlk Müdahale Eylem Planı -->
                    <article class="app-panel p-5 space-y-4 bg-indigo-50/30 dark:bg-indigo-950/10 border-indigo-200/60 dark:border-indigo-900/50">
                        <div class="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/60 pb-3">
                            <div class="flex items-center gap-2">
                                <span class="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">
                                    <i class="fas fa-lightbulb"></i>
                                </span>
                                <div>
                                    <p class="text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Karar Destek</p>
                                    <h3 class="font-black text-base text-gray-900 dark:text-white">Önerilen Müdahale</h3>
                                </div>
                            </div>
                            <span class="text-xs font-black text-indigo-700 dark:text-indigo-300">
                                ${escapeHtml(detail.recommendation.title)}
                            </span>
                        </div>
                        <div class="space-y-2">
                            <p class="text-xs font-bold text-gray-800 dark:text-gray-200 leading-relaxed">
                                ${escapeHtml(detail.recommendation.action)}
                            </p>
                            <ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1 pt-1">
                                <li class="flex items-center gap-1.5"><i class="fas fa-check text-emerald-500 text-[10px]"></i> 15–20 dk hedefli kavram / ünite tekrarı</li>
                                <li class="flex items-center gap-1.5"><i class="fas fa-check text-emerald-500 text-[10px]"></i> Temel ve orta seviye hedefli soru çözümü</li>
                                <li class="flex items-center gap-1.5"><i class="fas fa-check text-emerald-500 text-[10px]"></i> Süreli mini pekiştirme denemesi</li>
                            </ul>
                        </div>
                        <button onclick="showStudyPlanSetup('${studentId}')" class="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 min-h-[44px]">
                            <i class="fas fa-compass"></i> Çalışma Planı Oluştur
                        </button>
                    </article>

                    <!-- Çalışma Planı Öncesi / Sonrası Karşılaştırması -->
                    <article class="app-panel p-5 space-y-3">
                        <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                            <div>
                                <h3 class="font-black text-base text-gray-900 dark:text-white">Çalışma Planı Öncesi / Sonrası</h3>
                                <p class="text-xs text-gray-500 mt-0.5">Çalışma programı sonrası net değişimi</p>
                            </div>
                            <span class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs">
                                <i class="fas fa-arrows-split-up-and-left"></i>
                            </span>
                        </div>
                        <div>
                            ${impactSectionHtml}
                        </div>
                    </article>

                    <!-- Aktif Çalışma Planı -->
                    ${detail.activePlan ? `
                        <article class="app-panel p-5 space-y-3">
                            <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                                <div>
                                    <h3 class="font-black text-base text-gray-900 dark:text-white">Aktif Çalışma Planı</h3>
                                    <p class="text-xs text-gray-500 mt-0.5">${escapeHtml(detail.activePlan.subject)} · ${detail.activePlan.durationWeeks || 1} haftalık</p>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <button onclick="exportStudyPlanToPdf('${studentId}')" class="btn-secondary min-h-[38px] px-3 text-xs font-bold" title="PDF İndir">
                                        <i class="fas fa-file-pdf text-emerald-600 mr-1"></i> PDF
                                    </button>
                                    <button onclick="showStudyPlanSetup('${studentId}')" class="btn-secondary min-h-[38px] px-3 text-xs font-bold">
                                        Düzenle
                                    </button>
                                </div>
                            </div>
                        </article>
                    ` : ''}
                </div>
            </section>

            <!-- Alt 2 Kolon: Son Dersler & Zaman Çizelgesi -->
            <section class="grid gap-4 lg:grid-cols-2 mt-4">
                <!-- Son Ders Kayıtları -->
                <article class="app-panel p-5 space-y-3">
                    <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                        <h3 class="font-black text-base text-gray-900 dark:text-white">Son Ders Kayıtları</h3>
                        <span class="text-xs font-bold text-gray-400">${detail.recentLessons.length} ders</span>
                    </div>
                    <div class="space-y-2">
                        ${recentLessonsHtml}
                    </div>
                </article>

                <!-- Öğrenci Zaman Çizelgesi -->
                <article class="app-panel p-5 space-y-3">
                    <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                        <h3 class="font-black text-base text-gray-900 dark:text-white">Öğrenci Zaman Çizelgesi</h3>
                        <span class="text-xs font-bold text-gray-400">${detail.timeline.length} hareket</span>
                    </div>
                    <div class="pt-1">
                        ${timelineHtml}
                    </div>
                </article>
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

export function openGuidanceStudent(studentId) {
    renderGuidanceStudentDetail(studentId);
}

export async function openStudentCockpitDirect(studentId) {
    store.studentPanelOrigin = 'guidance';
    if (window.renderStudentCockpit) {
        await window.renderStudentCockpit(studentId, 'guidance');
    }
}

export function openCockpitHomework(studentId) {
    if (window.showOdevAtaModal) {
        window.showOdevAtaModal(studentId);
    }
}

window.renderGuidancePage = renderGuidancePage;
window.renderGuidanceStudentDetail = renderGuidanceStudentDetail;
window.updateGuidanceFilters = updateGuidanceFilters;
window.filterGuidanceStudents = filterGuidanceStudents;
window.openGuidanceStudent = openGuidanceStudent;
window.openStudentCockpitDirect = openStudentCockpitDirect;
window.openCockpitHomework = openCockpitHomework;

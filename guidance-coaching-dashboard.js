/**
 * Monthly Coaching Dashboard Pure UI Engine (UX-GUIDANCE-02C1).
 *
 * Pure, deterministic engine for teacher-facing monthly coaching analytics,
 * KPI metrics, weekly trends, branch/topic realization, context cards,
 * strengths, attention areas, recent focuses, and month helpers.
 *
 * Zero DOM, zero window/document, zero persistence, zero network, zero mutation.
 */

/**
 * Safely parses YYYY and MM from an ISO or YYYY-MM-DD date string without UTC shift.
 */
export function parseYearMonth(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const clean = dateStr.trim();
    const parts = clean.slice(0, 10).split('-');
    if (parts.length < 2) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        return null;
    }
    return { year, month };
}

/**
 * Escapes HTML characters safely.
 */
export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[character]));
}

/**
 * Formats a number cleanly without NaN.
 */
function safeNum(val, fallback = 0) {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * Formats an integer or decimal for display.
 */
function formatNumber(val) {
    if (val === null || val === undefined || !Number.isFinite(Number(val))) return '0';
    const n = Number(val);
    return Number.isInteger(n) ? n.toLocaleString('tr-TR') : n.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

/**
 * Safely formats percentage value. Returns null if invalid or target was <= 0.
 */
function formatPercent(val) {
    if (val === null || val === undefined || !Number.isFinite(Number(val))) return null;
    const n = Number(val);
    return Math.round(n);
}

/**
 * Clamps progress bar width between 0% and 100%.
 */
function getClampedWidth(percent) {
    if (percent === null || percent === undefined || !Number.isFinite(Number(percent))) return 0;
    const p = Number(percent);
    if (p <= 0) return 0;
    return Math.min(100, Math.round(p));
}

/**
 * Gets Tailwind color classes for progress percent.
 */
function getPercentColorClasses(percent) {
    if (percent === null || percent === undefined) {
        return {
            text: 'text-gray-600 dark:text-gray-300',
            bg: 'bg-gray-100 dark:bg-gray-700',
            bar: 'bg-gray-400 dark:bg-gray-500'
        };
    }
    const p = Number(percent);
    if (p >= 80) {
        return {
            text: 'text-emerald-700 dark:text-emerald-300',
            bg: 'bg-emerald-50 dark:bg-emerald-950/40',
            bar: 'bg-emerald-500 dark:bg-emerald-400'
        };
    }
    if (p >= 50) {
        return {
            text: 'text-amber-700 dark:text-amber-300',
            bg: 'bg-amber-50 dark:bg-amber-950/40',
            bar: 'bg-amber-500 dark:bg-amber-400'
        };
    }
    return {
        text: 'text-rose-700 dark:text-rose-300',
        bg: 'bg-rose-50 dark:bg-rose-950/40',
        bar: 'bg-rose-500 dark:bg-rose-400'
    };
}

/**
 * Extracts and deduplicates all available coaching months from student study plan history and active plan.
 * Deterministic: Ordered chronologically ascending [ { year, month }, ... ].
 * Zero mutation, ignores malformed dates and future artificial dates.
 *
 * @param {Object} student - Student entity
 * @returns {Array<{year: number, month: number}>} Available months ascending
 */
export function getAvailableCoachingMonths(student) {
    if (!student || typeof student !== 'object') return [];

    const monthMap = new Map();

    // 1. Study plan history
    const history = Array.isArray(student.studyPlanHistory) ? student.studyPlanHistory : [];
    for (const snapshot of history) {
        if (!snapshot || !snapshot.weekStart) continue;
        const ym = parseYearMonth(snapshot.weekStart);
        if (ym) {
            const key = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
            if (!monthMap.has(key)) {
                monthMap.set(key, ym);
            }
        }
    }

    // 2. Coaching plan (active or draft)
    const plan = student.coachingPlan;
    if (plan && typeof plan === 'object' && plan.weekStart && (plan.status === 'active' || plan.status === 'draft')) {
        const ym = parseYearMonth(plan.weekStart);
        if (ym) {
            const key = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
            if (!monthMap.has(key)) {
                monthMap.set(key, ym);
            }
        }
    }

    // Convert to array and sort ascending chronologically
    const sorted = Array.from(monthMap.values()).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
    });

    return sorted;
}

/**
 * Resolves the default coaching month for a student using deterministic policy.
 *
 * Policy:
 * A. If current month contains archived history in studyPlanHistory -> return current month.
 * B. Else if active/draft coachingPlan.weekStart is in current month -> return current month.
 * C. Else if history exists -> return latest month represented in studyPlanHistory.
 * D. Else -> return current month.
 *
 * @param {Object} student - Student entity
 * @param {Date|string|Object} [now] - Optional reference timestamp (defaults to current date)
 * @returns {{year: number, month: number}} Default { year, month }
 */
export function getDefaultCoachingMonth(student, now = null) {
    let currentYm = null;
    if (now instanceof Date && !isNaN(now.getTime())) {
        currentYm = { year: now.getFullYear(), month: now.getMonth() + 1 };
    } else if (typeof now === 'string') {
        currentYm = parseYearMonth(now);
    } else if (now && typeof now === 'object' && Number.isFinite(now.year) && Number.isFinite(now.month)) {
        currentYm = { year: Number(now.year), month: Number(now.month) };
    }

    if (!currentYm) {
        const d = new Date();
        currentYm = { year: d.getFullYear(), month: d.getMonth() + 1 };
    }

    if (!student || typeof student !== 'object') {
        return currentYm;
    }

    const history = Array.isArray(student.studyPlanHistory) ? student.studyPlanHistory : [];

    // Policy A: Archived history contains current month
    const hasCurrentArchived = history.some(s => {
        if (!s || !s.weekStart) return false;
        const ym = parseYearMonth(s.weekStart);
        return ym && ym.year === currentYm.year && ym.month === currentYm.month;
    });
    if (hasCurrentArchived) {
        return { year: currentYm.year, month: currentYm.month };
    }

    // Policy B: Active/draft coaching plan is in current month
    const plan = student.coachingPlan;
    if (plan && typeof plan === 'object' && plan.weekStart && (plan.status === 'active' || plan.status === 'draft')) {
        const ym = parseYearMonth(plan.weekStart);
        if (ym && ym.year === currentYm.year && ym.month === currentYm.month) {
            return { year: currentYm.year, month: currentYm.month };
        }
    }

    // Policy C: Latest month represented in studyPlanHistory
    let latestHistoryYm = null;
    for (const s of history) {
        if (!s || !s.weekStart) continue;
        const ym = parseYearMonth(s.weekStart);
        if (!ym) continue;
        if (!latestHistoryYm) {
            latestHistoryYm = ym;
        } else if (ym.year > latestHistoryYm.year || (ym.year === latestHistoryYm.year && ym.month > latestHistoryYm.month)) {
            latestHistoryYm = ym;
        }
    }
    if (latestHistoryYm) {
        return latestHistoryYm;
    }

    // Policy D: Fallback to current month
    return { year: currentYm.year, month: currentYm.month };
}

/**
 * Renders the compact Month Selector navigation bar.
 * Pure HTML, no DOM manipulation, no window/document.
 * Supports future month guard (canGoNext = false disables next button).
 */
export function renderMonthSelectorHtml(period = {}, options = {}) {
    const y = safeNum(period.year, 2026);
    const m = safeNum(period.month, 1);
    const label = period.monthLabel || `${y}-${String(m).padStart(2, '0')}`;

    const prevM = m === 1 ? 12 : m - 1;
    const prevY = m === 1 ? y - 1 : y;
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? y + 1 : y;

    // Determine if next month can be navigated to (Future Month Guard)
    let currentYm = null;
    if (options.now instanceof Date && !isNaN(options.now.getTime())) {
        currentYm = { year: options.now.getFullYear(), month: options.now.getMonth() + 1 };
    } else if (typeof options.now === 'string') {
        currentYm = parseYearMonth(options.now);
    } else if (options.now && typeof options.now === 'object' && Number.isFinite(options.now.year) && Number.isFinite(options.now.month)) {
        currentYm = { year: Number(options.now.year), month: Number(options.now.month) };
    }

    if (!currentYm) {
        const d = new Date();
        currentYm = { year: d.getFullYear(), month: d.getMonth() + 1 };
    }

    const isCurrentOrFuture = (y > currentYm.year) || (y === currentYm.year && m >= currentYm.month);
    const canGoNext = options.canGoNext !== undefined ? !!options.canGoNext : !isCurrentOrFuture;

    let canGoPrev = true;
    if (options.canGoPrev !== undefined) {
        canGoPrev = !!options.canGoPrev;
    } else if (Array.isArray(options.availableMonths)) {
        if (options.availableMonths.length === 0) {
            canGoPrev = false;
        } else {
            const earliest = options.availableMonths[0];
            const isEarliestOrBefore = (y < earliest.year) || (y === earliest.year && m <= earliest.month);
            canGoPrev = !isEarliestOrBefore;
        }
    }

    const prevBtnClass = canGoPrev
        ? 'px-3 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-500'
        : 'px-3 py-2 text-sm font-medium rounded-lg text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/60 transition min-h-[44px] min-w-[44px] flex items-center justify-center cursor-not-allowed opacity-50';

    const nextBtnClass = canGoNext
        ? 'px-3 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-500'
        : 'px-3 py-2 text-sm font-medium rounded-lg text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/60 transition min-h-[44px] min-w-[44px] flex items-center justify-center cursor-not-allowed opacity-50';

    const finalizedWeeks = safeNum(period.finalizedWeekCount ?? period.weekCount, 0);
    const hasPreview = !!period.previewWeekIncluded;

    return `
<div class="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-800 p-3.5 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm" data-testid="coaching-month-selector">
    <div class="flex items-center space-x-2">
        <button type="button" class="${prevBtnClass}" data-action="prev-coaching-month" data-year="${prevY}" data-month="${prevM}" aria-label="Önceki Ay"${!canGoPrev ? ' disabled aria-disabled="true"' : ''}>
            <i class="fas fa-chevron-left text-xs"></i>
        </button>
        <span class="text-base font-semibold text-gray-900 dark:text-white px-2 tracking-tight select-none" data-testid="selected-month-label">${escapeHtml(label)}</span>
        <button type="button" class="${nextBtnClass}" data-action="next-coaching-month" data-year="${nextY}" data-month="${nextM}" aria-label="Sonraki Ay"${!canGoNext ? ' disabled aria-disabled="true"' : ''}>
            <i class="fas fa-chevron-right text-xs"></i>
        </button>
    </div>
    <div class="flex items-center flex-wrap gap-2 text-xs">
        <span class="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium" data-testid="finalized-weeks-badge">
            <i class="fas fa-archive mr-1.5 text-[10px]"></i>
            ${finalizedWeeks} Kesinleşmiş Hafta
        </span>
        ${hasPreview ? `
        <span class="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium" data-testid="preview-week-badge">
            <i class="fas fa-clock mr-1.5 text-[10px]"></i>
            +1 Aktif Hafta (Önizleme)
        </span>` : ''}
    </div>
</div>`.trim();
}

/**
 * Renders the 3 core KPI metric cards (Question, Task, Exam).
 * Strict: Uses finalized planMetrics only. Zero active week contamination.
 * Strict: No fake 0/0, NaN%, Infinity%, null%, undefined%.
 * Strict: No raw priorityScore or numeric priority display.
 */
export function renderCoachingKpiCardsHtml(planMetrics = {}, period = {}) {
    // 1. Soru Metriği
    const qActual = safeNum(planMetrics.questionActual, 0);
    const qTarget = (planMetrics.questionTarget != null && Number(planMetrics.questionTarget) > 0)
        ? Number(planMetrics.questionTarget)
        : null;
    const qPercent = formatPercent(planMetrics.questionPercent);
    const qBarWidth = getClampedWidth(planMetrics.questionPercent);
    const qColors = getPercentColorClasses(qPercent);

    // 2. Görev Metriği
    const tCompleted = safeNum(planMetrics.taskCompleted, 0);
    const tTotal = safeNum(planMetrics.taskTotal, 0);
    const tPercent = formatPercent(planMetrics.taskPercent);
    const tBarWidth = getClampedWidth(planMetrics.taskPercent);
    const tColors = getPercentColorClasses(tPercent);

    // 3. Deneme Metriği
    const eActual = safeNum(planMetrics.examActual, 0);
    const eTarget = (planMetrics.examTarget != null && Number(planMetrics.examTarget) > 0)
        ? Number(planMetrics.examTarget)
        : null;
    const ePercent = formatPercent(planMetrics.examPercent);
    const eBarWidth = getClampedWidth(planMetrics.examPercent);
    const eColors = getPercentColorClasses(ePercent);

    return `
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="coaching-kpi-cards">
    <!-- 1. Soru Gerçekleşme Kartı -->
    <div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm flex flex-col justify-between" data-testid="kpi-question-card">
        <div>
            <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">
                <span>AYLIK SORU GERÇEKLEŞME</span>
                <i class="fas fa-tasks text-indigo-500"></i>
            </div>
            <div class="flex items-baseline space-x-2 mt-1">
                <span class="text-2xl font-bold text-gray-900 dark:text-white" data-testid="kpi-question-actual">${formatNumber(qActual)}</span>
                ${qTarget != null ? `<span class="text-xs text-gray-500 dark:text-gray-400">/ ${formatNumber(qTarget)} Hedef</span>` : `<span class="text-xs text-gray-500 dark:text-gray-400">Soru</span>`}
            </div>
        </div>
        <div class="mt-3">
            <div class="flex items-center justify-between text-xs mb-1">
                <span class="text-gray-500 dark:text-gray-400">Gerçekleşme Oranı</span>
                ${qPercent != null ? `
                <span class="px-2 py-0.5 rounded-full font-semibold ${qColors.bg} ${qColors.text}" data-testid="kpi-question-percent">
                    %${qPercent}
                </span>` : `<span class="text-gray-400 dark:text-gray-500">-</span>`}
            </div>
            <div class="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-300 ${qColors.bar}" style="width: ${qBarWidth}%"></div>
            </div>
        </div>
    </div>

    <!-- 2. Görev Tamamlama Kartı -->
    <div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm flex flex-col justify-between" data-testid="kpi-task-card">
        <div>
            <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">
                <span>GÖREV TAMAMLAMA</span>
                <i class="fas fa-check-double text-emerald-500"></i>
            </div>
            <div class="flex items-baseline space-x-2 mt-1">
                <span class="text-2xl font-bold text-gray-900 dark:text-white" data-testid="kpi-task-actual">${formatNumber(tCompleted)}</span>
                ${tTotal > 0 ? `<span class="text-xs text-gray-500 dark:text-gray-400">/ ${formatNumber(tTotal)} Görev</span>` : `<span class="text-xs text-gray-500 dark:text-gray-400">Görev Yok</span>`}
            </div>
        </div>
        <div class="mt-3">
            <div class="flex items-center justify-between text-xs mb-1">
                <span class="text-gray-500 dark:text-gray-400">Tamamlama Oranı</span>
                ${tPercent != null ? `
                <span class="px-2 py-0.5 rounded-full font-semibold ${tColors.bg} ${tColors.text}" data-testid="kpi-task-percent">
                    %${tPercent}
                </span>` : `<span class="text-gray-400 dark:text-gray-500">-</span>`}
            </div>
            <div class="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-300 ${tColors.bar}" style="width: ${tBarWidth}%"></div>
            </div>
        </div>
    </div>

    <!-- 3. Planlanan Deneme Kartı -->
    <div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm flex flex-col justify-between" data-testid="kpi-exam-card">
        <div>
            <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">
                <span>PLANLANAN DENEMELER</span>
                <i class="fas fa-graduation-cap text-indigo-500"></i>
            </div>
            <div class="flex items-baseline space-x-2 mt-1">
                <span class="text-2xl font-bold text-gray-900 dark:text-white" data-testid="kpi-exam-actual">${formatNumber(eActual)}</span>
                ${eTarget != null ? `<span class="text-xs text-gray-500 dark:text-gray-400">/ ${formatNumber(eTarget)} Deneme</span>` : `<span class="text-xs text-gray-500 dark:text-gray-400">Deneme Yok</span>`}
            </div>
        </div>
        <div class="mt-3">
            <div class="flex items-center justify-between text-xs mb-1">
                <span class="text-gray-500 dark:text-gray-400">Uygulama Oranı</span>
                ${ePercent != null ? `
                <span class="px-2 py-0.5 rounded-full font-semibold ${eColors.bg} ${eColors.text}" data-testid="kpi-exam-percent">
                    %${ePercent}
                </span>` : `<span class="text-gray-400 dark:text-gray-500">-</span>`}
            </div>
            <div class="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-300 ${eColors.bar}" style="width: ${eBarWidth}%"></div>
            </div>
        </div>
    </div>
</div>`.trim();
}

/**
 * Formats a short date label from ISO or YYYY-MM-DD.
 */
function formatShortDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return '';
    const parts = dateStr.slice(0, 10).split('-');
    if (parts.length < 3) return dateStr;
    const day = parseInt(parts[2], 10);
    const month = parseInt(parts[1], 10);
    const monthsTr = ['', 'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const mStr = monthsTr[month] || parts[1];
    return `${day} ${mStr}`;
}

/**
 * Renders weekly trend progression list / cards.
 * Visualizes archived weeks with "Tamamlandı" and highlights preview week clearly with "Devam Ediyor".
 */
export function renderWeeklyTrendHtml(weeklyTrend = []) {
    if (!Array.isArray(weeklyTrend) || weeklyTrend.length === 0) {
        return `
<div class="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200/80 dark:border-gray-700 text-center shadow-sm" data-testid="weekly-trend-empty">
    <p class="text-sm text-gray-500 dark:text-gray-400">Bu ay için haftalık çalışma trendi bulunmuyor.</p>
</div>`.trim();
    }

    const cardsHtml = weeklyTrend.map((w, idx) => {
        const isPreview = !!w.isPreview;
        const weekNum = idx + 1;
        const startLabel = formatShortDate(w.weekStart);
        const endLabel = formatShortDate(w.weekEnd);
        const dateRangeStr = (startLabel && endLabel) ? `${startLabel} - ${endLabel}` : (w.weekStart || `Hafta ${weekNum}`);

        const qPercent = formatPercent(w.questionPercent);
        const qBarWidth = getClampedWidth(w.questionPercent);
        const qColors = getPercentColorClasses(qPercent);

        const tPercent = formatPercent(w.taskPercent);

        return `
<div class="p-3.5 rounded-lg border ${isPreview ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' : 'bg-gray-50/60 dark:bg-gray-900/40 border-gray-200/70 dark:border-gray-700/60'} flex flex-col justify-between" data-testid="weekly-trend-card-${idx}" ${isPreview ? 'data-is-preview="true"' : ''}>
    <div class="flex items-center justify-between mb-2">
        <div class="flex items-center space-x-1.5">
            <span class="text-xs font-bold text-gray-800 dark:text-gray-200">${weekNum}. Hafta</span>
            <span class="text-[11px] text-gray-500 dark:text-gray-400">(${escapeHtml(dateRangeStr)})</span>
        </div>
        ${isPreview ? `
        <span class="px-2 py-0.5 text-[10px] rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 font-medium tracking-wide" data-testid="preview-badge">
            Devam Ediyor
        </span>` : `
        <span class="px-2 py-0.5 text-[10px] rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-medium tracking-wide" data-testid="finalized-badge">
            Tamamlandı
        </span>`}
    </div>

    <!-- Soru Satırı -->
    <div class="mt-1">
        <div class="flex items-center justify-between text-xs mb-1">
            <span class="text-gray-600 dark:text-gray-300 font-medium">Soru:</span>
            <span class="font-semibold text-gray-900 dark:text-white">
                ${formatNumber(w.questionActual)}${w.questionTarget != null ? ` / ${formatNumber(w.questionTarget)}` : ''}
                ${qPercent != null ? `<span class="ml-1 text-[11px] ${qColors.text} font-bold">(%${qPercent})</span>` : ''}
            </span>
        </div>
        <div class="w-full bg-gray-200/80 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
            <div class="h-full rounded-full ${qColors.bar}" style="width: ${qBarWidth}%"></div>
        </div>
    </div>

    <!-- Görev ve Deneme Satırı -->
    <div class="mt-2.5 pt-2 border-t border-gray-200/60 dark:border-gray-700/50 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
        <span>
            <i class="fas fa-check-circle text-emerald-500 mr-1"></i>
            ${w.taskCompleted}/${w.taskTotal} Görev
            ${tPercent != null ? `(%${tPercent})` : ''}
        </span>
        ${(w.examActual > 0 || (w.examTarget != null && w.examTarget > 0)) ? `
        <span>
            <i class="fas fa-pen-alt text-indigo-500 mr-1"></i>
            ${w.examActual}${w.examTarget != null ? `/${w.examTarget}` : ''} Deneme
        </span>` : ''}
    </div>
</div>`.trim();
    }).join('\n');

    return `
<div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm" data-testid="coaching-weekly-trend">
    <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-bold text-gray-900 dark:text-white flex items-center">
            <i class="fas fa-chart-line text-indigo-500 mr-2"></i>
            Haftalık İlerleme ve Hedef Trendi
        </h3>
        <span class="text-xs text-gray-500 dark:text-gray-400">${weeklyTrend.length} Hafta</span>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        ${cardsHtml}
    </div>
</div>`.trim();
}

/**
 * Renders branch realization summary (max 5 branches).
 * Deterministic ordering: actual questions solved descending, tie -> Turkish locale compare.
 * Strict: Never displays errorCount.
 */
export function renderBranchSummaryHtml(branchSummary = []) {
    const list = Array.isArray(branchSummary) ? branchSummary : [];
    // Max 5 branches, sorted descending by actual questions solved, tie -> subject.localeCompare('tr')
    const topBranches = list.slice()
        .sort((a, b) => {
            const diff = safeNum(b.actual) - safeNum(a.actual);
            if (diff !== 0) return diff;
            return (a.subject || '').localeCompare(b.subject || '', 'tr');
        })
        .slice(0, 5);

    if (topBranches.length === 0) {
        return `
<div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm" data-testid="coaching-branch-summary">
    <h3 class="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center">
        <i class="fas fa-book-open text-indigo-500 mr-2"></i>
        Branş Bazlı Soru Gerçekleşmesi
    </h3>
    <p class="text-xs text-gray-500 dark:text-gray-400 py-4 text-center">Bu ay kaydedilmiş branş verisi bulunmuyor.</p>
</div>`.trim();
    }

    const rowsHtml = topBranches.map((b, idx) => {
        const percent = formatPercent(b.percent);
        const barWidth = getClampedWidth(b.percent);
        const colors = getPercentColorClasses(percent);
        const hasTarget = b.target != null && Number(b.target) > 0;

        return `
<div class="py-2.5 ${idx !== topBranches.length - 1 ? 'border-b border-gray-100 dark:border-gray-700/60' : ''}" data-testid="branch-row-${idx}">
    <div class="flex items-center justify-between text-xs mb-1">
        <span class="font-semibold text-gray-800 dark:text-gray-200">${escapeHtml(b.subject)}</span>
        <div class="flex items-center space-x-2">
            <span class="text-gray-700 dark:text-gray-300 font-medium">
                ${formatNumber(b.actual)}${hasTarget ? ` / ${formatNumber(b.target)}` : ''} Soru
            </span>
            ${percent != null ? `
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${colors.bg} ${colors.text}">
                %${percent}
            </span>` : ''}
        </div>
    </div>
    <div class="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
        <div class="h-full rounded-full ${colors.bar}" style="width: ${barWidth}%"></div>
    </div>
</div>`.trim();
    }).join('\n');

    return `
<div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm flex flex-col justify-between" data-testid="coaching-branch-summary">
    <div>
        <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-bold text-gray-900 dark:text-white flex items-center">
                <i class="fas fa-book-open text-indigo-500 mr-2"></i>
                Branş Bazlı Soru Gerçekleşmesi
            </h3>
            <span class="text-xs text-gray-400 dark:text-gray-500">İlk 5 Branş</span>
        </div>
        <div class="divide-y divide-gray-100 dark:divide-gray-700/60">
            ${rowsHtml}
        </div>
    </div>
</div>`.trim();
}

/**
 * Renders top focused topics summary (max 5 topics).
 * Deterministic ordering: actual questions solved descending, tie -> subject then topic localeCompare('tr').
 * Strict: Never displays errorCount.
 */
export function renderTopicSummaryHtml(topicSummary = []) {
    const list = Array.isArray(topicSummary) ? topicSummary : [];
    // Max 5 topics, sorted descending by actual questions solved, tie -> subject / topic localeCompare('tr')
    const topTopics = list.slice()
        .sort((a, b) => {
            const diff = safeNum(b.actual) - safeNum(a.actual);
            if (diff !== 0) return diff;
            const subCmp = (a.subject || '').localeCompare(b.subject || '', 'tr');
            if (subCmp !== 0) return subCmp;
            return (a.topic || '').localeCompare(b.topic || '', 'tr');
        })
        .slice(0, 5);

    if (topTopics.length === 0) {
        return `
<div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm" data-testid="coaching-topic-summary">
    <h3 class="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center">
        <i class="fas fa-tags text-indigo-500 mr-2"></i>
        En Çok Odaklanılan Konular
    </h3>
    <p class="text-xs text-gray-500 dark:text-gray-400 py-4 text-center">Bu ay kaydedilmiş konu odağı bulunmuyor.</p>
</div>`.trim();
    }

    const itemsHtml = topTopics.map((t, idx) => {
        return `
<li class="py-2 flex items-center justify-between text-xs ${idx !== topTopics.length - 1 ? 'border-b border-gray-100 dark:border-gray-700/60' : ''}" data-testid="topic-row-${idx}">
    <div class="flex flex-col pr-2">
        <span class="font-medium text-gray-800 dark:text-gray-200 leading-tight">${escapeHtml(t.topic)}</span>
        <span class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">${escapeHtml(t.subject)}</span>
    </div>
    <div class="flex items-center space-x-1.5 flex-shrink-0">
        <span class="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px]">
            ${formatNumber(t.actual)} Soru
        </span>
    </div>
</li>`.trim();
    }).join('\n');

    return `
<div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm flex flex-col justify-between" data-testid="coaching-topic-summary">
    <div>
        <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-bold text-gray-900 dark:text-white flex items-center">
                <i class="fas fa-tags text-indigo-500 mr-2"></i>
                En Çok Odaklanılan Konular
            </h3>
            <span class="text-xs text-gray-400 dark:text-gray-500">İlk 5 Konu</span>
        </div>
        <ul class="divide-y divide-gray-100 dark:divide-gray-700/60">
            ${itemsHtml}
        </ul>
    </div>
</div>`.trim();
}

/**
 * Renders Academic Context, Homework Discipline, and Guidance Follow-ups.
 * Structured metrics only. Privacy-safe: zero internal note texts.
 * Does not infer trend itself: renders trend badge only when trendStatus is valid and not insufficient_data.
 */
export function renderContextCardsHtml(examContext = {}, homeworkContext = {}, guidanceContext = {}) {
    // 1. Deneme Bağlamı
    const examCount = safeNum(examContext.examCount, 0);
    let examTrendLabel = null;
    let examTrendBadge = null;
    if (examContext.trendStatus === 'improving') {
        examTrendLabel = 'Yükseliyor';
        examTrendBadge = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
    } else if (examContext.trendStatus === 'declining') {
        examTrendLabel = 'Düşüyor';
        examTrendBadge = 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300';
    } else if (examContext.trendStatus === 'stable') {
        examTrendLabel = 'Dengeli';
        examTrendBadge = 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300';
    }

    // 2. Ödev Disiplini
    const hwTotal = safeNum(homeworkContext.total, 0);
    const hwCompleted = safeNum(homeworkContext.completed, 0);
    const hwOverdue = safeNum(homeworkContext.overdue, 0);
    const hwRate = homeworkContext.completionRate != null ? Math.round(homeworkContext.completionRate) : null;

    // 3. Rehberlik Takip
    const gIntervention = safeNum(guidanceContext.interventionCount, 0);
    const gFollowUp = safeNum(guidanceContext.followUpCount, 0);
    const gResolved = safeNum(guidanceContext.resolvedCount, 0);

    return `
<div class="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="coaching-context-cards">
    <!-- Deneme Bağlamı -->
    <div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm" data-testid="context-exam-card">
        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">
            <span>RESMİ DENEME BAĞLAMI</span>
            <i class="fas fa-chart-bar text-indigo-500"></i>
        </div>
        ${examCount > 0 ? `
        <div class="space-y-1.5">
            <div class="flex items-baseline justify-between">
                <span class="text-xl font-bold text-gray-900 dark:text-white">${examCount} Deneme</span>
                ${examTrendLabel ? `
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${examTrendBadge}" data-testid="exam-trend-badge">
                    ${examTrendLabel}
                </span>` : ''}
            </div>
            <div class="text-xs text-gray-600 dark:text-gray-300 flex items-center justify-between pt-1">
                <span>Son Net: <strong>${examContext.latestNet != null ? Number(examContext.latestNet).toFixed(2) : '-'}</strong></span>
                ${examContext.netDelta != null ? `
                <span class="${examContext.netDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} font-semibold">
                    ${examContext.netDelta > 0 ? '+' : ''}${Number(examContext.netDelta).toFixed(2)} Net Değişim
                </span>` : ''}
            </div>
        </div>` : `
        <p class="text-xs text-gray-400 dark:text-gray-500 py-3">Bu ay girilmiş genel deneme kaydı yok.</p>`}
    </div>

    <!-- Ödev Disiplini -->
    <div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm" data-testid="context-homework-card">
        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">
            <span>ÖDEV DİSİPLİNİ</span>
            <i class="fas fa-clipboard-check text-indigo-500"></i>
        </div>
        ${hwTotal > 0 ? `
        <div class="space-y-1.5">
            <div class="flex items-baseline justify-between">
                <span class="text-xl font-bold text-gray-900 dark:text-white">${hwCompleted} / ${hwTotal} Ödev</span>
                ${hwRate != null ? `
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${hwRate >= 80 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}">
                    %${hwRate} Tamamlama
                </span>` : ''}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between pt-1">
                <span>Teslim Edilen: ${hwCompleted}</span>
                ${hwOverdue > 0 ? `
                <span class="text-rose-600 dark:text-rose-400 font-medium">
                    ${hwOverdue} Geciken
                </span>` : `<span class="text-emerald-600 dark:text-emerald-400">Gecikme Yok</span>`}
            </div>
        </div>` : `
        <p class="text-xs text-gray-400 dark:text-gray-500 py-3">Bu ay tanımlı ödev bulunmuyor.</p>`}
    </div>

    <!-- Rehberlik Müdahaleleri -->
    <div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm" data-testid="context-guidance-card">
        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">
            <span>REHBERLİK MÜDAHALELERİ</span>
            <i class="fas fa-user-shield text-indigo-500"></i>
        </div>
        <div class="space-y-2">
            <div class="flex items-baseline justify-between">
                <span class="text-xl font-bold text-gray-900 dark:text-white">${gIntervention} Görüşme</span>
                <span class="text-xs text-indigo-600 dark:text-indigo-400 font-medium">${gFollowUp} Aktif Takip</span>
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between pt-0.5">
                <span>Sonuçlanan Takip:</span>
                <span class="font-semibold text-emerald-600 dark:text-emerald-400">${gResolved} Çözümlendi</span>
            </div>
        </div>
    </div>
</div>`.trim();
}

/**
 * Renders Strengths and Attention Areas panels side-by-side.
 * Max 2 strengths, max 2 attention areas.
 * Strict: No clinical / stigmatizing wording.
 */
export function renderStrengthsAndAttentionHtml(strengths = [], attentionAreas = []) {
    const sList = Array.isArray(strengths) ? strengths.filter(s => typeof s === 'string' && s.trim()).slice(0, 2) : [];
    const aList = Array.isArray(attentionAreas) ? attentionAreas.filter(a => typeof a === 'string' && a.trim()).slice(0, 2) : [];

    const strengthsContent = sList.length > 0 ? sList.map(text => `
<li class="flex items-start space-x-2 text-xs text-emerald-900 dark:text-emerald-100">
    <i class="fas fa-check-circle text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0"></i>
    <span class="leading-relaxed font-medium">${escapeHtml(text)}</span>
</li>`).join('') : `
<p class="text-xs text-emerald-700/70 dark:text-emerald-300/70 italic">Bu dönem için henüz belirgin bir güçlü yön sinyali üretilmedi.</p>`;

    const attentionContent = aList.length > 0 ? aList.map(text => `
<li class="flex items-start space-x-2 text-xs text-amber-900 dark:text-amber-100">
    <i class="fas fa-exclamation-triangle text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0"></i>
    <span class="leading-relaxed font-medium">${escapeHtml(text)}</span>
</li>`).join('') : `
<p class="text-xs text-amber-700/70 dark:text-amber-300/70 italic">Bu dönem için dikkat çeken kritik gelişim sinyali bulunmuyor.</p>`;

    return `
<div class="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="coaching-strengths-attention">
    <!-- Güçlü Yönler -->
    <div class="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 p-4 rounded-xl" data-testid="strengths-panel">
        <h4 class="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider mb-2.5 flex items-center">
            <i class="fas fa-award text-emerald-600 dark:text-emerald-400 mr-2"></i>
            Öne Çıkan Güçlü Yönler
        </h4>
        <ul class="space-y-2">
            ${strengthsContent}
        </ul>
    </div>

    <!-- Gelişim Alanları -->
    <div class="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 p-4 rounded-xl" data-testid="attention-panel">
        <h4 class="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-2.5 flex items-center">
            <i class="fas fa-compass text-amber-600 dark:text-amber-400 mr-2"></i>
            Takip Edilecek Gelişim Alanları
        </h4>
        <ul class="space-y-2">
            ${attentionContent}
        </ul>
    </div>
</div>`.trim();
}

/**
 * Renders Recent Teacher/Student Weekly Focuses (max 4).
 * Strict: Only clean focuses, no raw notes.
 */
export function renderRecentFocusesHtml(recentFocuses = []) {
    const list = Array.isArray(recentFocuses)
        ? recentFocuses.filter(f => typeof f === 'string' && f.trim()).slice(0, 4)
        : [];

    if (list.length === 0) {
        return `
<div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm" data-testid="coaching-recent-focuses">
    <h3 class="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center">
        <i class="fas fa-bullseye text-indigo-500 mr-2"></i>
        Haftalık Odak Noktaları
    </h3>
    <p class="text-xs text-gray-500 dark:text-gray-400 py-3 text-center">Kayıtlı haftalık odak bulunmuyor.</p>
</div>`.trim();
    }

    const itemsHtml = list.map((focus, idx) => `
<li class="flex items-start space-x-2.5 text-xs text-gray-700 dark:text-gray-200" data-testid="recent-focus-item-${idx}">
    <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] flex-shrink-0 mt-0.5">
        ${idx + 1}
    </span>
    <span class="leading-relaxed">${escapeHtml(focus)}</span>
</li>`).join('\n');

    return `
<div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm" data-testid="coaching-recent-focuses">
    <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-bold text-gray-900 dark:text-white flex items-center">
            <i class="fas fa-bullseye text-indigo-500 mr-2"></i>
            Haftalık Odak Noktaları
        </h3>
        <span class="text-xs text-gray-400 dark:text-gray-500">Son ${list.length} Odak</span>
    </div>
    <ul class="space-y-2.5">
        ${itemsHtml}
    </ul>
</div>`.trim();
}

/**
 * Renders the clean, informative Empty State when a selected month has 0 data.
 * Strict: No write actions! Read-only informative display.
 */
export function renderCoachingEmptyStateHtml(period = {}, message = null) {
    const monthStr = period.monthLabel ? escapeHtml(period.monthLabel) : 'Seçili Ay';
    const desc = message
        ? escapeHtml(message)
        : `Seçili dönemde (${monthStr}) kaydedilmiş haftalık çalışma planı veya koçluk verisi bulunmamaktadır.`;

    return `
<div class="cf-empty-state bg-white dark:bg-gray-800 p-8 rounded-xl border border-gray-200/80 dark:border-gray-700 text-center shadow-sm my-4" data-testid="coaching-empty-state">
    <div class="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
        <i class="fas fa-calendar-times text-xl"></i>
    </div>
    <h3 class="text-base font-bold text-gray-900 dark:text-white mb-1">Bu Ay İçin Koçluk Planı Bulunmuyor</h3>
    <p class="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">${desc}</p>
</div>`.trim();
}

/**
 * Primary Pure Entry Point: Renders the complete Monthly Coaching Dashboard HTML string.
 *
 * @param {Object} monthlySummary - Contract output from buildMonthlyCoachingSummary
 * @param {Object} [student] - Student entity (optional, for student context)
 * @param {Object} [options] - Optional rendering controls
 * @returns {string} Pure HTML string
 */
export function renderCoachingMonthlyDashboardHtml(monthlySummary, student = {}, options = {}) {
    if (!monthlySummary || typeof monthlySummary !== 'object') {
        const fallbackPeriod = {
            year: (options.now instanceof Date) ? options.now.getFullYear() : 2026,
            month: (options.now instanceof Date) ? (options.now.getMonth() + 1) : 1,
            monthLabel: 'Mevcut Dönem',
            weekCount: 0
        };
        return `
<div class="space-y-4" data-testid="guidance-coaching-dashboard">
    ${renderMonthSelectorHtml(fallbackPeriod, options)}
    ${renderCoachingEmptyStateHtml(fallbackPeriod)}
</div>`.trim();
    }

    const period = monthlySummary.period || {};
    const planMetrics = monthlySummary.planMetrics || {};
    const weeklyTrend = monthlySummary.weeklyTrend || [];
    const branchSummary = monthlySummary.branchSummary || [];
    const topicSummary = monthlySummary.topicSummary || [];
    const examContext = monthlySummary.examContext || {};
    const homeworkContext = monthlySummary.homeworkContext || {};
    const guidanceContext = monthlySummary.guidanceContext || {};
    const strengths = monthlySummary.strengths || [];
    const attentionAreas = monthlySummary.attentionAreas || [];
    const recentFocuses = monthlySummary.recentFocuses || [];

    const availableMonths = options.availableMonths || (student ? getAvailableCoachingMonths(student) : []);
    const selectorOptions = {
        ...options,
        availableMonths,
        studentId: options.studentId || student?.id || ''
    };

    // Determine whether this month has any data at all
    const hasAnyData = (safeNum(period.weekCount) > 0) ||
        (weeklyTrend.length > 0) ||
        (safeNum(planMetrics.questionActual) > 0) ||
        (safeNum(planMetrics.taskCompleted) > 0) ||
        (safeNum(examContext.examCount) > 0) ||
        (safeNum(homeworkContext.total) > 0);

    if (!hasAnyData) {
        return `
<div class="space-y-4" data-testid="guidance-coaching-dashboard">
    ${renderMonthSelectorHtml(period, selectorOptions)}
    ${renderCoachingEmptyStateHtml(period)}
</div>`.trim();
    }

    return `
<div class="space-y-4" data-testid="guidance-coaching-dashboard">
    <!-- 1. Ay Seçici -->
    ${renderMonthSelectorHtml(period, selectorOptions)}

    <!-- 2. Temel Plan KPI Kartları (Finalized Metrics Only) -->
    ${renderCoachingKpiCardsHtml(planMetrics, period)}

    <!-- 3. Haftalık Trend İlerleme Çizelgesi -->
    ${renderWeeklyTrendHtml(weeklyTrend)}

    <!-- 4. Branş & Konu Dağılımı (Max 5, No errorCount) -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        ${renderBranchSummaryHtml(branchSummary)}
        ${renderTopicSummaryHtml(topicSummary)}
    </div>

    <!-- 5. Deneme, Ödev ve Rehberlik Bağlam Kartları -->
    ${renderContextCardsHtml(examContext, homeworkContext, guidanceContext)}

    <!-- 6. Güçlü Yönler ve Takip Edilecek Gelişim Alanları (Max 2 Each) -->
    ${renderStrengthsAndAttentionHtml(strengths, attentionAreas)}

    <!-- 7. Son Haftalık Odaklar (Max 4) -->
    ${renderRecentFocusesHtml(recentFocuses)}
</div>`.trim();
}

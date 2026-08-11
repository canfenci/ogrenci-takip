import { loadStudentsData, loadSchedule, escapeHtml } from './store.js';
import { buildLessonReminderMessage, buildLessonReminders } from './lesson-reminder-insights.js';

export const REMINDER_SETTINGS_KEY = 'lesson_reminder_settings_v1';
export const REMINDER_HISTORY_KEY = 'lesson_reminder_history_v1';

function readJson(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
        return fallback;
    }
}

export function getReminderSettings() {
    return { enabled: false, ...readJson(REMINDER_SETTINGS_KEY, {}) };
}

export function saveReminderSettings(settings) {
    localStorage.setItem(REMINDER_SETTINGS_KEY, JSON.stringify(settings));
}

export function getReminderHistory() {
    return readJson(REMINDER_HISTORY_KEY, {});
}

function updateReminderHistory(id, values) {
    const history = getReminderHistory();
    history[id] = { ...(history[id] || {}), ...values };
    localStorage.setItem(REMINDER_HISTORY_KEY, JSON.stringify(history));
}

export function getCurrentLessonReminders(now = new Date()) {
    const students = loadStudentsData();
    const schedules = Object.fromEntries(students.map(student => [student.id, loadSchedule(student.id)]));
    return buildLessonReminders(students, schedules, now, getReminderHistory());
}

function formatRemaining(reminder, now = new Date()) {
    const minutes = Math.max(0, Math.ceil((reminder.lessonAt - now) / 60000));
    if (minutes < 60) return `${minutes} dakika kaldı`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} saat ${minutes % 60} dakika kaldı`;
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    return `${days} gün ${hours} saat kaldı`;
}

export function renderLessonReminderCenter() {
    const settings = getReminderSettings();
    const reminders = getCurrentLessonReminders().slice(0, 8);
    const permission = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
    const cards = reminders.length ? reminders.map(reminder => {
        const messagePreview = escapeHtml(buildLessonReminderMessage(reminder));
        const stateLabel = reminder.isSent
            ? '<span class="text-green-700 dark:text-green-400 font-bold"><i class="fas fa-check-circle"></i> Gönderildi</span>'
            : reminder.isDue
                ? '<span class="text-red-600 dark:text-red-400 font-black animate-pulse">Şimdi hatırlat</span>'
                : `<span class="text-indigo-600 dark:text-indigo-400 font-bold">${formatRemaining(reminder)}</span>`;
        const whatsappButton = reminder.normalizedPhone
            ? `<div class="flex flex-wrap gap-2">
                <button onclick="openLessonReminderWhatsApp('${encodeURIComponent(reminder.id)}')" class="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-xs font-bold min-h-[40px]" ${!reminder.isDue || reminder.isSent ? 'disabled aria-disabled="true" style="opacity:.55"' : ''}><i class="fab fa-whatsapp"></i> ${reminder.isSent ? 'Gönderildi' : reminder.isDue ? 'WhatsApp’tan Gönder' : 'Henüz Zamanı Değil'}</button>
                ${reminder.isDue && !reminder.isSent ? `<button onclick="markLessonReminderSent('${encodeURIComponent(reminder.id)}')" class="border border-green-600 text-green-700 dark:text-green-400 px-3 py-2 rounded-lg text-xs font-bold min-h-[40px]"><i class="fas fa-check"></i> Gönderildi</button>` : ''}
               </div>`
            : '<span class="text-xs text-amber-700 dark:text-amber-400 font-semibold">Geçerli veli telefonu gerekli</span>';
        return `<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border ${reminder.isDue && !reminder.isSent ? 'border-red-300 bg-red-50 dark:bg-red-950/20' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/20'} p-3">
            <div>
                <p class="font-black text-gray-800 dark:text-white">${escapeHtml(reminder.studentName)} · ${escapeHtml(reminder.lessonName)}</p>
                <p class="text-xs text-gray-500 mt-1">${escapeHtml(reminder.day)} ${escapeHtml(reminder.time)} · ${stateLabel}</p>
                <p class="text-xs text-gray-600 dark:text-gray-300 mt-2 rounded-lg bg-white/70 dark:bg-gray-800/70 px-2 py-1.5"><span class="font-bold">Hazır mesaj:</span> ${messagePreview}</p>
            </div>
            ${whatsappButton}
        </div>`;
    }).join('') : '<p class="text-sm text-gray-500">Planlanmış aktif ders bulunmuyor.</p>';

    return `<section class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-5 border border-gray-100 dark:border-gray-700" aria-labelledby="lessonReminderHeading">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
                <h2 id="lessonReminderHeading" class="text-xl font-black text-gray-800 dark:text-white"><i class="fas fa-bell text-amber-500"></i> Ders Hatırlatmaları</h2>
                <p class="text-sm text-gray-500">Ders başlamadan 2 saat önce otomatik bildirim ve hazır veli mesajı</p>
            </div>
            <div class="flex flex-wrap gap-2">
                <button onclick="toggleLessonReminders()" class="${settings.enabled ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'} text-white px-4 py-2 rounded-xl text-xs font-bold min-h-[44px]"><i class="fas fa-power-off"></i> ${settings.enabled ? 'Hatırlatmalar Açık' : 'Hatırlatmaları Aç'}</button>
                ${permission === 'default' ? '<button onclick="requestLessonNotificationPermission()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold min-h-[44px]"><i class="fas fa-bell"></i> Bildirim İzni</button>' : ''}
            </div>
        </div>
        ${permission === 'denied' ? '<p class="text-xs text-red-600 dark:text-red-400 mb-3">Tarayıcı bildirimleri engellenmiş. Tarayıcı site ayarlarından izin verebilirsiniz.</p>' : ''}
        <div class="space-y-2">${cards}</div>
        <p class="text-[11px] text-gray-400 mt-3">Otomatik kontrol uygulama açıkken çalışır. Güvenlik nedeniyle WhatsApp gönderimi “WhatsApp’tan Gönder” düğmesiyle sizin onayınızdan sonra tamamlanır.</p>
    </section>`;
}

export async function requestLessonNotificationPermission() {
    if (typeof Notification === 'undefined') return;
    await Notification.requestPermission();
    if (window.renderSchedulePage) window.renderSchedulePage();
}

export function toggleLessonReminders() {
    const settings = getReminderSettings();
    saveReminderSettings({ ...settings, enabled: !settings.enabled });
    if (window.renderSchedulePage) window.renderSchedulePage();
    checkLessonReminders();
}

export function openLessonReminderWhatsApp(encodedId) {
    const id = decodeURIComponent(encodedId);
    const reminder = getCurrentLessonReminders().find(item => item.id === id);
    if (!reminder || !reminder.normalizedPhone || reminder.isSent || !reminder.isDue) return;
    const url = `https://api.whatsapp.com/send?phone=${reminder.normalizedPhone}&text=${encodeURIComponent(buildLessonReminderMessage(reminder))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}

export function markLessonReminderSent(encodedId) {
    const id = decodeURIComponent(encodedId);
    const reminder = getCurrentLessonReminders().find(item => item.id === id);
    if (!reminder || reminder.isSent || !reminder.isDue) return;
    updateReminderHistory(id, { sentAt: new Date().toISOString() });
    if (window.renderSchedulePage) window.renderSchedulePage();
}

export function checkLessonReminders(now = new Date()) {
    if (!getReminderSettings().enabled) return [];
    const due = getCurrentLessonReminders(now).filter(reminder => reminder.isDue && !reminder.isSent && !reminder.isNotified);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        due.forEach(reminder => {
            new Notification('Ders hatırlatma mesajı hazır', {
                body: buildLessonReminderMessage(reminder),
                icon: './icons/icon-192x192.png',
                tag: reminder.id
            });
            updateReminderHistory(reminder.id, { notifiedAt: now.toISOString() });
        });
    }
    return due;
}

export function initializeLessonReminders() {
    checkLessonReminders();
    window.setInterval(() => checkLessonReminders(), 60 * 1000);
}

window.requestLessonNotificationPermission = requestLessonNotificationPermission;
window.toggleLessonReminders = toggleLessonReminders;
window.openLessonReminderWhatsApp = openLessonReminderWhatsApp;
window.markLessonReminderSent = markLessonReminderSent;
window.initializeLessonReminders = initializeLessonReminders;

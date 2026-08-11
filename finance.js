// ==================== LESSON LOGS & FINANCE REPORT MODÜLÜ ====================

import { store, loadStudentsData, loadDersKayitlari, saveDersKayitlari, getDersOzet, getKonuListesiBySinif, getKonuListesiBySinifAndDers, getStudentOdevler, escapeHtml } from './store.js';
import { updateMobileNavActive } from './auth.js';
import { ATTENDANCE_LABELS, calculateLessonFinance, normalizeLessonStatus, updateLessonAttendanceState, updateLessonPaymentState } from './lesson-finance-insights.js';
import { formatLessonDateForDisplay, formatLessonDateTyping, parseLessonDateInput } from './lesson-date-utils.js';

export function renderFinanceReport() {
    store.currentPage = "finance";
    const students = loadStudentsData();
    
    let totalRevenueCollected = 0;
    let totalPendingRevenue = 0;
    let totalCompletedLessons = 0;
    let totalPendingLessons = 0;
    let activeFeeStudentsCount = 0;
    
    const studentFinanceRows = students.map(s => {
        const ucret = parseFloat(s.dersUcreti) || parseFloat(s.aylikUcret) || parseFloat(s.ucret) || 0;
        if (ucret > 0) activeFeeStudentsCount++;
        
        const kayitlar = loadDersKayitlari(s.id);
        const finance = calculateLessonFinance(kayitlar, ucret);
        const totalDersCount = finance.totalCount;
        const paidDersCount = finance.paidCount;
        const pendingDersCount = finance.pendingCount;
        const paidAmount = finance.paidAmount;
        const pendingAmount = finance.pendingAmount;
        
        totalRevenueCollected += paidAmount;
        totalPendingRevenue += pendingAmount;
        totalCompletedLessons += paidDersCount;
        totalPendingLessons += pendingDersCount;
        
        return {
            id: s.id,
            adSoyad: s.adSoyad,
            veliTel: s.veliTel,
            ucret: ucret,
            totalDersCount,
            paidDersCount,
            pendingDersCount,
            paidAmount,
            pendingAmount,
            statusCounts: finance.statusCounts
        };
    });
    
    let rowsHtml = '';
    if (studentFinanceRows.length === 0) {
        rowsHtml = `<tr><td colspan="7" class="text-center p-4 text-gray-500">Öğrenci bulunmuyor.</td></tr>`;
    } else {
        rowsHtml = studentFinanceRows.map(row => {
            const whMsg = `Merhaba Sayın Velimiz,\n\n*${row.adSoyad}* isimli öğrencimizin ders ödeme takip detayı aşağıdaki gibidir:\n\n` +
                          `- Birim Ders Ücreti: ${row.ucret} TL\n` +
                          `- Ücretlendirilen Ders: ${row.paidDersCount + row.pendingDersCount} saat\n` +
                          `- Ödenen Ders: ${row.paidDersCount} saat\n` +
                          `- Ödeme Bekleyen Ders: ${row.pendingDersCount} saat\n` +
                          `💸 *Kalan Ödeme Tutarı:* *${row.pendingAmount} TL*\n\n` +
                          `Ödemeyi gerçekleştirdiyseniz lütfen bize bilgi veriniz. İyi çalışmalar dileriz.`;
            
            let phone = row.veliTel ? row.veliTel.replace(/\D/g, '') : '';
            if (phone.startsWith('0')) phone = '90' + phone.substring(1);
            else if (!phone.startsWith('90') && phone.length === 10) phone = '90' + phone;
            const whUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(whMsg)}`;
            
            const whBtn = row.pendingAmount > 0 
                ? `<a href="${whUrl}" target="_blank" class="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-3 py-2 rounded-xl text-sm inline-flex items-center gap-1 font-semibold transition shadow-md min-h-[44px]">
                       <i class="fab fa-whatsapp"></i> Hatırlat
                   </a>`
                : `<span class="text-sm text-green-600 font-bold"><i class="fas fa-check-circle"></i> Borç Yok</span>`;
            
            return `
                <tr class="border-b hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td class="p-4 text-base font-semibold">${escapeHtml(row.adSoyad)}</td>
                    <td class="p-4 text-base">${row.ucret} TL</td>
                    <td class="p-4 text-base">${row.paidDersCount + row.pendingDersCount}<br><span class="text-xs text-gray-400">${row.statusCounts.iptal + row.statusCounts.mazeretli + row.statusCounts.gelmedi} ücret dışı · ${row.statusCounts.planlandi} planlandı</span></td>
                    <td class="p-4 text-base text-green-600 font-bold">${row.paidDersCount} (${row.paidAmount} TL)</td>
                    <td class="p-4 text-base text-yellow-600 dark:text-yellow-400 font-bold">${row.pendingDersCount} (${row.pendingAmount} TL)</td>
                    <td class="p-4 text-base font-bold text-indigo-600 dark:text-indigo-400">${row.paidAmount + row.pendingAmount} TL</td>
                    <td class="p-4 text-base">${whBtn}</td>
                </tr>
            `;
        }).join('');
    }
    
    const html = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-100/20 dark:border-gray-700/50">
            <div class="flex justify-between items-center mb-6 flex-wrap gap-3">
                <div>
                    <h2 class="text-2xl font-black text-gray-800 dark:text-white border-b-2 border-primary/20 pb-2 mb-1">
                        <i class="fas fa-wallet text-amber-500"></i> Finans / Ödeme Raporu
                    </h2>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Tüm öğrencilerin ders ücreti ve ödeme durumlarının toplu raporu.</p>
                </div>
                <button onclick="renderGenelIslemler()" class="bg-gray-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-600 transition flex items-center gap-1 min-h-[44px]">
                    <i class="fas fa-arrow-left"></i> Geri
                </button>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div class="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/20 text-center">
                    <span class="text-xs text-blue-500 dark:text-blue-400 font-bold uppercase tracking-wider">Aktif Ücretli Öğrenci</span>
                    <div class="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">${activeFeeStudentsCount} / ${students.length}</div>
                </div>
                <div class="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/20 text-center">
                    <span class="text-xs text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-wider">Yapılan Toplam Ders</span>
                    <div class="text-2xl font-black text-indigo-700 dark:text-indigo-300 mt-1">${totalCompletedLessons + totalPendingLessons} Saat</div>
                </div>
                <div class="bg-green-50 dark:bg-green-900/10 p-4 rounded-2xl border border-green-100 dark:border-green-900/20 text-center">
                    <span class="text-xs text-green-500 dark:text-green-400 font-bold uppercase tracking-wider">Tahsil Edilen Toplam Tutar</span>
                    <div class="text-2xl font-black text-green-700 dark:text-green-300 mt-1">${totalRevenueCollected} TL</div>
                </div>
                <div class="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-2xl border border-yellow-100 dark:border-yellow-900/20 text-center">
                    <span class="text-xs text-yellow-500 dark:text-yellow-400 font-bold uppercase tracking-wider">Ödeme Bekleyen Tutar</span>
                    <div class="text-2xl font-black text-yellow-700 dark:text-yellow-300 mt-1">${totalPendingRevenue} TL</div>
                </div>
            </div>
            
            <div class="overflow-x-auto">
                <table class="w-full border-collapse border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                    <thead class="bg-gray-800 dark:bg-gray-900 text-white">
                        <tr>
                            <th class="border p-4 text-left text-sm font-bold">Öğrenci</th>
                            <th class="border p-4 text-left text-sm font-bold">Ders Ücreti</th>
                            <th class="border p-4 text-left text-sm font-bold">Toplam Ders</th>
                            <th class="border p-4 text-left text-sm font-bold">Ödenen (Tutar)</th>
                            <th class="border p-4 text-left text-sm font-bold">Bekleyen (Tutar)</th>
                            <th class="border p-4 text-left text-sm font-bold">Genel Toplam</th>
                            <th class="border p-4 text-left text-sm font-bold">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    document.getElementById("dynamic-content").innerHTML = html;
}

export function renderDersKayitlari() {
    store.currentPage = "dersKayitlari";
    updateMobileNavActive('mobile-nav-lessons');
    const students = loadStudentsData();
    if (students.length === 0) {
        document.getElementById("dynamic-content").innerHTML = `<div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 text-center text-gray-500">Henüz öğrenci eklenmemiş. Lütfen önce öğrenci ekleyin.</div>`;
        return;
    }
    
    let cardsHtml = '<div class="grid md:grid-cols-2 gap-5">';
    for (let s of students) {
        const dersUcreti = parseFloat(s.dersUcreti) || parseFloat(s.aylikUcret) || parseFloat(s.ucret) || 0;
        const { toplamDers, ucretlendirilenDersSayisi, odenenDersSayisi, toplamOdeme } = getDersOzet(s.id, dersUcreti);
        cardsHtml += `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-5 border border-gray-100/20 dark:border-gray-700/50 hover:-translate-y-1 hover:shadow-2xl transition duration-300 cursor-pointer" onclick="renderDersDetay('${s.id}')">
                <div class="flex justify-between">
                    <h3 class="text-xl font-bold">${escapeHtml(s.adSoyad)}</h3>
                    <i class="fas fa-chevron-right text-gray-400"></i>
                </div>
                <p class="text-base text-gray-500 dark:text-gray-400 mt-1">${escapeHtml(s.okul)} | 📞 ${escapeHtml(s.veliTel || 'Belirtilmemiş')}</p>
                <p class="text-base text-indigo-600 dark:text-indigo-400 font-semibold mt-1">💰 Bir Ders Ücreti: ${dersUcreti} TL</p>
                <div class="mt-3 flex flex-wrap gap-2 text-sm">
                    <span class="stat-badge text-base">📚 Ders: ${toplamDers}</span>
                    <span class="stat-badge text-base text-purple-600 font-semibold">🧾 Ücretli: ${ucretlendirilenDersSayisi}</span>
                    <span class="stat-badge text-base text-green-600 font-semibold">✅ Ödenen: ${odenenDersSayisi}</span>
                    <span class="stat-badge text-base text-blue-600 font-semibold">💵 Toplam: ${toplamOdeme} TL</span>
                </div>
            </div>`;
    }
    cardsHtml += '</div>';
    
    document.getElementById("dynamic-content").innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-xl mb-4 border border-gray-100/20 dark:border-gray-700/50">
            <h2 class="text-2xl font-black text-gray-800 dark:text-white border-b-2 border-primary/20 pb-2 mb-1">📖 Ders Kayıtları</h2>
            <p class="text-sm text-gray-500">Öğrenci kartına tıklayarak ders kayıtlarını yönetin.</p>
        </div>
        ${cardsHtml}
    `;
}

export function renderDersDetay(studentId) {
    store.currentPage = "dersDetay";
    window._currentDersKayitStudentId = studentId;
    updateMobileNavActive('mobile-nav-lessons');
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) {
        renderDersKayitlari();
        return;
    }
    
    const effectiveSinif = (String(student.sinif).trim() === "8" || (student.adSoyad && student.adSoyad.includes("(8)"))) ? "8" : student.sinif;
    
    let kayitlar = loadDersKayitlari(studentId);
    kayitlar = kayitlar.map((k, idx) => ({
        ...k,
        id: k.id || `lesson_${studentId}_${Date.now()}_${idx}`,
        dersNo: idx + 1
    }));
    saveDersKayitlari(studentId, kayitlar);
    const studentHomeworks = getStudentOdevler(student);
    
    let tableRows = '';
    for (let k of kayitlar) {
        const katilimDurumu = normalizeLessonStatus(k);
        const legacyHomework = Array.isArray(k.odev) ? k.odev : (k.odev ? [k.odev] : []);
        const linkedHomeworks = studentHomeworks.filter(homework => homework.kaynakDers?.lessonId === k.id);
        const completedHomeworkCount = linkedHomeworks.filter(homework => homework.durum === 'tamamlandi').length;
        const homeworkSummary = linkedHomeworks.length > 0
            ? `<button onclick="renderStudentOdevDetay('${studentId}')" class="text-left text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">${linkedHomeworks.length} ödev · ${completedHomeworkCount} tamamlandı</button>`
            : '<span class="text-sm text-gray-400">Ödev atanmadı</span>';
        const legacyHomeworkHtml = legacyHomework.length > 0
            ? `<div class="mt-1 text-xs text-amber-600 dark:text-amber-400" title="Eski ders kaydından korundu">Eski not: ${legacyHomework.map(escapeHtml).join(', ')}</div>`
            : '';
        const lessonBranches = [...new Set([...(store.teacherBranches || []), k.ders].filter(Boolean))];
        const lessonTopics = getKonuListesiBySinifAndDers(effectiveSinif, k.ders);
        const editTopics = lessonTopics.includes(k.konu) ? lessonTopics : [k.konu, ...lessonTopics].filter(Boolean);
        
        tableRows += `
            <tr class="border-b hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                <td class="p-4 text-base">${k.dersNo}</td>
                <td class="p-4 text-base">${formatLessonDateForDisplay(k.tarih)}</td>
                <td class="p-4 text-base font-semibold text-indigo-600 dark:text-indigo-400">${k.konu}</td>
                <td class="p-3 min-w-[210px]">
                    <label class="sr-only" for="attendance-${k.id}">Katılım durumu</label>
                    <select id="attendance-${k.id}" aria-label="${escapeHtml(k.konu)} katılım durumu" onchange="updateDersKatilimDurumu('${studentId}', '${k.id}', this.value)" class="w-full min-h-[44px] rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-sm font-bold text-blue-800 dark:text-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
                        ${Object.entries(ATTENDANCE_LABELS).map(([value, label]) => `<option value="${value}" ${katilimDurumu === value ? 'selected' : ''}>${label}</option>`).join('')}
                    </select>
                </td>
                <td class="p-4 text-base text-gray-600 dark:text-gray-300">${escapeHtml(k.icerik || '')}</td>
                <td class="p-4 text-base">${homeworkSummary}${legacyHomeworkHtml}</td>
                <td class="p-3 min-w-[155px]">
                    <label class="sr-only" for="payment-${k.id}">Ücret durumu</label>
                    <select id="payment-${k.id}" aria-label="${escapeHtml(k.konu)} ücret durumu" onchange="updateDersUcretDurumu('${studentId}', '${k.id}', this.value)" ${katilimDurumu !== 'yapildi' ? 'disabled' : ''} class="w-full min-h-[44px] rounded-xl border px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 transition ${katilimDurumu !== 'yapildi' ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-not-allowed' : k.odendi ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300 focus:ring-green-500' : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 focus:ring-amber-500'}">
                        ${katilimDurumu !== 'yapildi'
                            ? '<option value="not-billable">Ücret Yok</option>'
                            : `<option value="pending" ${!k.odendi ? 'selected' : ''}>Bekliyor</option><option value="paid" ${k.odendi ? 'selected' : ''}>Ödendi</option>`}
                    </select>
                </td>
                <td class="p-4 text-base">
                    <div class="flex gap-2 flex-wrap">
                        <button onclick="openHomeworkForLesson('${studentId}', '${k.id}')" class="text-indigo-600 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-2 text-sm font-semibold min-h-[44px] hover:bg-indigo-50 dark:hover:bg-indigo-950/20" title="Bu derse ödev ata">
                            <i class="fas fa-tasks"></i> Ödev Ata
                        </button>
                        <button id="edit-toggle-${k.id}" onclick="toggleDersKayitEditor('${k.id}')" aria-expanded="false" aria-controls="edit-row-${k.id}" class="text-blue-600 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-sm font-semibold min-h-[44px] hover:bg-blue-50 dark:hover:bg-blue-950/20">
                            <i class="fas fa-edit"></i> Düzenle
                        </button>
                        <button onclick="deleteDersKayit('${studentId}', ${k.dersNo})" class="text-red-500 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center hover:text-red-750">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
            <tr id="edit-row-${k.id}" class="hidden bg-blue-50/60 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900">
                <td colspan="8" class="p-4">
                    <div class="rounded-2xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-850 p-4 shadow-inner">
                        <div class="flex items-center justify-between gap-3 mb-4">
                            <div>
                                <h4 class="font-black text-gray-800 dark:text-white"><i class="fas fa-pen-to-square text-blue-500 mr-1"></i> ${k.dersNo}. Ders Kaydını Düzenle</h4>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Değişiklikleri yaptıktan sonra kaydetmeyi unutmayın.</p>
                            </div>
                            <button type="button" onclick="toggleDersKayitEditor('${k.id}', false)" class="min-w-[44px] min-h-[44px] rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Düzenleme panelini kapat"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div>
                                <label for="edit-date-${k.id}" class="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">Tarih</label>
                                <input id="edit-date-${k.id}" type="text" inputmode="numeric" maxlength="10" value="${formatLessonDateForDisplay(k.tarih)}" oninput="formatLessonDateTyping(this)" class="student-form-input min-h-[44px]" placeholder="GG/AA/YYYY">
                            </div>
                            <div>
                                <label for="edit-subject-${k.id}" class="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">Ders</label>
                                <select id="edit-subject-${k.id}" onchange="updateDersEditTopics('${k.id}', '${effectiveSinif}')" class="student-form-input min-h-[44px]">
                                    ${lessonBranches.map(branch => `<option value="${escapeHtml(branch)}" ${branch === k.ders ? 'selected' : ''}>${effectiveSinif === '8' && branch === 'Sosyal Bilgiler' ? 'İnkılap Tarihi' : escapeHtml(branch)}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label for="edit-topic-${k.id}" class="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">Konu</label>
                                <select id="edit-topic-${k.id}" class="student-form-input min-h-[44px]">
                                    ${editTopics.map(topic => `<option value="${escapeHtml(topic)}" ${topic === k.konu ? 'selected' : ''}>${escapeHtml(topic)}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label for="edit-content-${k.id}" class="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">İçerik / Not</label>
                                <input id="edit-content-${k.id}" type="text" maxlength="300" value="${escapeHtml(k.icerik || '')}" class="student-form-input min-h-[44px]" placeholder="Ders içeriği veya kısa not">
                            </div>
                        </div>
                        <div id="edit-error-${k.id}" role="alert" class="hidden mt-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm font-semibold text-red-700 dark:text-red-300"></div>
                        <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-4">
                            <button type="button" onclick="toggleDersKayitEditor('${k.id}', false)" class="min-h-[44px] px-5 rounded-xl border border-gray-300 dark:border-gray-600 font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Vazgeç</button>
                            <button type="button" onclick="saveDersKayitEditor('${studentId}', '${k.id}')" class="min-h-[44px] px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-md"><i class="fas fa-save mr-1"></i> Değişiklikleri Kaydet</button>
                        </div>
                    </div>
                </td>
            </tr>`;
    }
    
    const html = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-5 border border-gray-100/20 dark:border-gray-700/50">
            <div class="flex justify-between items-center mb-4 flex-wrap gap-2">
                <h2 class="text-2xl font-black text-gray-800 dark:text-white border-b-2 border-primary/20 pb-2 mb-1">📖 Ders Kayıtları - ${escapeHtml(student.adSoyad)}</h2>
                <button onclick="renderDersKayitlari()" class="bg-gray-500 text-white px-4 py-2.5 rounded-xl flex items-center gap-1 font-semibold min-h-[44px]">
                    <i class="fas fa-arrow-left"></i> Geri
                </button>
            </div>
            
            <div class="mb-6 bg-gray-50 dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-700">
                <h3 class="font-bold mb-3 text-lg">➕ Yeni Ders Kaydı Ekle</h3>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input type="text" id="kayitTarih" inputmode="numeric" maxlength="10" placeholder="GG/AA/YYYY" aria-label="Ders tarihi (gün/ay/yıl)" oninput="formatLessonDateTyping(this)" class="student-form-input min-h-[44px]">
                    <select id="kayitDers" onchange="window.onDersKayitSubjectChanged('${effectiveSinif}')" class="student-form-input min-h-[44px]">
                        <option value="">Ders Seçin</option>
                        ${(store.teacherBranches || ["Türkçe", "Matematik", "Fen Bilimleri", "Sosyal Bilgiler"]).map(b => {
                            const displayName = (effectiveSinif === "8" && b === "Sosyal Bilgiler") ? "İnkılap Tarihi" : b;
                            return `<option value="${b}">${displayName}</option>`;
                        }).join('')}
                    </select>
                    <select id="kayitKonu" class="student-form-input min-h-[44px]">
                        <option value="">Konu Seç (Önce Ders Seçin)</option>
                    </select>
                    <input type="text" id="kayitIcerik" placeholder="İçerik" class="student-form-input min-h-[44px]">
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                    <div>
                        <label class="block text-sm font-semibold mb-1">Katılım Durumu</label>
                        <select id="kayitKatilim" class="student-form-input min-h-[44px]">
                            ${Object.entries(ATTENDANCE_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
                        </select>
                        <p class="mt-1 text-xs text-gray-500">Ders önceden giriliyorsa “Planlandı” olarak bırakın; ders sonrasında güncelleyin.</p>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-1">Ödeme Durumu</label>
                        <select id="kayitOdendi" class="student-form-input min-h-[44px]">
                            <option value="true">Ödendi</option>
                            <option value="false" selected>Bekliyor</option>
                        </select>
                    </div>
                    <div class="flex items-end">
                        <button onclick="addDersKayit('${studentId}')" class="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-5 py-3 rounded-xl font-bold min-h-[44px] shadow-lg">Kaydet</button>
                    </div>
                </div>
            </div>
            
            <div class="overflow-x-auto">
                <table class="w-full border-collapse border border-gray-300 dark:border-gray-700 ders-kayitlari-table rounded-xl overflow-hidden">
                    <thead class="bg-gray-800 dark:bg-gray-900 text-white">
                        <tr>
                            <th class="border p-4 text-base font-bold">Ders No</th>
                            <th class="border p-4 text-base font-bold">Tarih</th>
                            <th class="border p-4 text-base font-bold">Konu</th>
                            <th class="border p-4 text-base font-bold">Katılım</th>
                            <th class="border p-4 text-base font-bold">İçerik</th>
                            <th class="border p-4 text-base font-bold">Bağlantılı Ödev</th>
                            <th class="border p-4 text-base font-bold">Durum (Ücret)</th>
                            <th class="border p-4 text-base font-bold">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows || '<tr><td colspan="8" class="text-center p-4 text-base">Henüz ders kaydı yok.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>`;
        
    document.getElementById("dynamic-content").innerHTML = html;
}

export function addDersKayit(studentId) {
    const tarihInput = document.getElementById("kayitTarih").value;
    const tarih = parseLessonDateInput(tarihInput);
    const ders = document.getElementById("kayitDers")?.value || "";
    const konu = document.getElementById("kayitKonu").value;
    const icerik = document.getElementById("kayitIcerik").value;
    const odendi = document.getElementById("kayitOdendi").value === "true";
    const katilimDurumu = document.getElementById("kayitKatilim")?.value || 'yapildi';
    
    if (!tarih || !ders || !konu) {
        alert("Lütfen tarihi GG/AA/YYYY biçiminde, ders ve konu alanlarını eksiksiz giriniz.");
        return;
    }
    
    let kayitlar = loadDersKayitlari(studentId);
    const yeniNo = kayitlar.length + 1;
    kayitlar.push({ id: `lesson_${studentId}_${Date.now()}`, dersNo: yeniNo, tarih, ders, konu, icerik, odendi: katilimDurumu === 'yapildi' ? odendi : false, katilimDurumu });
    saveDersKayitlari(studentId, kayitlar);
    renderDersDetay(studentId);
}

export function toggleDersKayitEditor(lessonId, forceOpen) {
    const row = document.getElementById(`edit-row-${lessonId}`);
    const button = document.getElementById(`edit-toggle-${lessonId}`);
    if (!row) return;
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : row.classList.contains('hidden');

    document.querySelectorAll('[id^="edit-row-"]').forEach(editor => editor.classList.add('hidden'));
    document.querySelectorAll('[id^="edit-toggle-"]').forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
    if (shouldOpen) {
        row.classList.remove('hidden');
        button?.setAttribute('aria-expanded', 'true');
        document.getElementById(`edit-date-${lessonId}`)?.focus();
    }
}

export function updateDersEditTopics(lessonId, sinif) {
    const subject = document.getElementById(`edit-subject-${lessonId}`)?.value || '';
    const topicSelect = document.getElementById(`edit-topic-${lessonId}`);
    if (!topicSelect) return;
    const topics = getKonuListesiBySinifAndDers(sinif, subject);
    topicSelect.replaceChildren(...topics.map(topic => {
        const option = document.createElement('option');
        option.value = topic;
        option.textContent = topic;
        return option;
    }));
}

export function saveDersKayitEditor(studentId, lessonId) {
    const tarih = parseLessonDateInput(document.getElementById(`edit-date-${lessonId}`)?.value || '');
    const ders = document.getElementById(`edit-subject-${lessonId}`)?.value || '';
    const konu = document.getElementById(`edit-topic-${lessonId}`)?.value || '';
    const icerik = document.getElementById(`edit-content-${lessonId}`)?.value.trim() || '';
    const error = document.getElementById(`edit-error-${lessonId}`);

    if (!tarih || !ders || !konu) {
        if (error) {
            error.textContent = 'Tarih, ders ve konu alanlarını eksiksiz doldurun.';
            error.classList.remove('hidden');
        }
        return;
    }

    const kayitlar = loadDersKayitlari(studentId);
    const idx = kayitlar.findIndex(lesson => lesson.id === lessonId);
    if (idx === -1) return;
    kayitlar[idx] = { ...kayitlar[idx], tarih, ders, konu, icerik };
    saveDersKayitlari(studentId, kayitlar);
    renderDersDetay(studentId);
}

export function updateDersKatilimDurumu(studentId, lessonId, attendanceStatus) {
    const kayitlar = loadDersKayitlari(studentId);
    const idx = kayitlar.findIndex(lesson => lesson.id === lessonId);
    if (idx === -1) return;
    kayitlar[idx] = updateLessonAttendanceState(kayitlar[idx], attendanceStatus);
    saveDersKayitlari(studentId, kayitlar);
    renderDersDetay(studentId);
}

export function updateDersUcretDurumu(studentId, lessonId, paymentStatus) {
    const kayitlar = loadDersKayitlari(studentId);
    const idx = kayitlar.findIndex(lesson => lesson.id === lessonId);
    if (idx === -1) return;
    kayitlar[idx] = updateLessonPaymentState(kayitlar[idx], paymentStatus === 'paid');
    saveDersKayitlari(studentId, kayitlar);
    renderDersDetay(studentId);
}

export function deleteDersKayit(studentId, dersNo) {
    if (confirm("Bu ders kaydını silmek istediğinize emin misiniz?")) {
        let kayitlar = loadDersKayitlari(studentId);
        kayitlar = kayitlar.filter(k => k.dersNo !== dersNo);
        kayitlar = kayitlar.map((k, idx) => ({ ...k, dersNo: idx + 1 }));
        saveDersKayitlari(studentId, kayitlar);
        renderDersDetay(studentId);
    }
}

export function onDersKayitSubjectChanged(sinif) {
    const dersSelect = document.getElementById("kayitDers");
    const konuSelect = document.getElementById("kayitKonu");
    if (!dersSelect || !konuSelect) return;
    
    const selectedDers = dersSelect.value;
    if (!selectedDers) {
        konuSelect.innerHTML = '<option value="">Konu Seç (Önce Ders Seçin)</option>';
        return;
    }
    
    const konular = getKonuListesiBySinifAndDers(sinif, selectedDers);
    konuSelect.innerHTML = '<option value="">Konu Seç</option>' + konular.map(k => `<option value="${k}">${k}</option>`).join('');
}

export function openHomeworkForLesson(studentId, lessonId) {
    const lesson = loadDersKayitlari(studentId).find(record => record.id === lessonId);
    if (!lesson || !window.renderOdevAtaModal) return;

    window._geciciOdevListesi = [];
    window.renderOdevAtaModal([studentId], {
        lessonId: lesson.id,
        dersNo: lesson.dersNo,
        tarih: lesson.tarih,
        ders: lesson.ders,
        konu: lesson.konu
    });
}

// Bind to window for global accessibility
window.renderFinanceReport = renderFinanceReport;
window.renderDersKayitlari = renderDersKayitlari;
window.renderDersDetay = renderDersDetay;
window.addDersKayit = addDersKayit;
window.toggleDersKayitEditor = toggleDersKayitEditor;
window.updateDersEditTopics = updateDersEditTopics;
window.saveDersKayitEditor = saveDersKayitEditor;
window.deleteDersKayit = deleteDersKayit;
window.updateDersKatilimDurumu = updateDersKatilimDurumu;
window.updateDersUcretDurumu = updateDersUcretDurumu;
window.onDersKayitSubjectChanged = onDersKayitSubjectChanged;
window.openHomeworkForLesson = openHomeworkForLesson;
window.formatLessonDateTyping = formatLessonDateTyping;

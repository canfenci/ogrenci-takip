// ==================== LESSON LOGS & FINANCE REPORT MODÜLÜ ====================

import { store, loadStudentsData, loadDersKayitlari, saveDersKayitlari, getDersOzet, getKonuListesiBySinif, getKonuListesiBySinifAndDers, escapeHtml } from './store.js';
import { updateMobileNavActive } from './auth.js';

export function renderFinanceReport() {
    store.currentPage = "finance";
    const students = loadStudentsData();
    
    let totalRevenueCollected = 0;
    let totalPendingRevenue = 0;
    let totalCompletedLessons = 0;
    let totalPendingLessons = 0;
    let activeFeeStudentsCount = 0;
    
    const studentFinanceRows = students.map(s => {
        const ucret = parseFloat(s.aylikUcret) || parseFloat(s.ucret) || 0; // Check both legacy and normalized fields
        if (ucret > 0) activeFeeStudentsCount++;
        
        const kayitlar = loadDersKayitlari(s.id);
        const totalDersCount = kayitlar.length;
        const paidDersCount = kayitlar.filter(k => k.odendi === true).length;
        const pendingDersCount = totalDersCount - paidDersCount;
        
        const paidAmount = paidDersCount * ucret;
        const pendingAmount = pendingDersCount * ucret;
        
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
            pendingAmount
        };
    });
    
    let rowsHtml = '';
    if (studentFinanceRows.length === 0) {
        rowsHtml = `<tr><td colspan="7" class="text-center p-4 text-gray-500">Öğrenci bulunmuyor.</td></tr>`;
    } else {
        rowsHtml = studentFinanceRows.map(row => {
            const whMsg = `Merhaba Sayın Velimiz,\n\n*${row.adSoyad}* isimli öğrencimizin ders ödeme takip detayı aşağıdaki gibidir:\n\n` +
                          `- Birim Ders Ücreti: ${row.ucret} TL\n` +
                          `- Yapılan Toplam Ders: ${row.totalDersCount} saat\n` +
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
                    <td class="p-4 text-base">${row.totalDersCount}</td>
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
        const aylikUcret = parseFloat(s.aylikUcret) || parseFloat(s.ucret) || 0;
        const { toplamDers, odenenDersSayisi, toplamOdeme } = getDersOzet(s.id, aylikUcret);
        cardsHtml += `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-5 border border-gray-100/20 dark:border-gray-700/50 hover:-translate-y-1 hover:shadow-2xl transition duration-300 cursor-pointer" onclick="renderDersDetay('${s.id}')">
                <div class="flex justify-between">
                    <h3 class="text-xl font-bold">${escapeHtml(s.adSoyad)}</h3>
                    <i class="fas fa-chevron-right text-gray-400"></i>
                </div>
                <p class="text-base text-gray-500 dark:text-gray-400 mt-1">${escapeHtml(s.okul)} | 📞 ${escapeHtml(s.veliTel || 'Belirtilmemiş')}</p>
                <p class="text-base text-indigo-600 dark:text-indigo-400 font-semibold mt-1">💰 Ders Ücreti: ${aylikUcret} TL</p>
                <div class="mt-3 flex flex-wrap gap-2 text-sm">
                    <span class="stat-badge text-base">📚 Ders: ${toplamDers}</span>
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
    kayitlar = kayitlar.map((k, idx) => ({ ...k, dersNo: idx + 1 }));
    saveDersKayitlari(studentId, kayitlar);
    
    let tableRows = '';
    for (let k of kayitlar) {
        const odevList = Array.isArray(k.odev) ? k.odev : (k.odev ? [k.odev] : []);
        const odevHtml = odevList.map(od => `<div class="inline-block bg-gray-200 dark:bg-gray-700 rounded-full px-2.5 py-1 text-sm mr-1 mb-1 font-semibold">${escapeHtml(od)}</div>`).join('');
        
        tableRows += `
            <tr class="border-b hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                <td class="p-4 text-base">${k.dersNo}</td>
                <td class="p-4 text-base">${k.tarih}</td>
                <td class="p-4 text-base font-semibold text-indigo-600 dark:text-indigo-400">${k.konu}</td>
                <td class="p-4 text-base text-gray-600 dark:text-gray-300">${escapeHtml(k.icerik || '')}</td>
                <td class="p-4 text-base"><div class="flex flex-wrap">${odevHtml || '—'}</div></td>
                <td class="p-4 text-base">
                    <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${k.odendi ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'}">
                        ${k.odendi ? 'Ödendi' : 'Bekliyor'}
                    </span>
                </td>
                <td class="p-4 text-base">
                    <div class="flex gap-2">
                        <button onclick="editDersKayit('${studentId}', ${k.dersNo})" class="text-blue-500 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center hover:text-blue-750">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteDersKayit('${studentId}', ${k.dersNo})" class="text-red-500 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center hover:text-red-750">
                            <i class="fas fa-trash"></i>
                        </button>
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
                    <input type="date" id="kayitTarih" class="student-form-input min-h-[44px]">
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
                        <label class="block text-sm font-semibold mb-1">Ödevler</label>
                        <div class="flex gap-2">
                            <input type="text" id="yeniOdev" placeholder="Ödev metni" class="student-form-input flex-1 min-h-[44px]">
                            <button onclick="addOdevToList()" class="bg-blue-500 text-white px-4 py-2 rounded-xl font-bold min-h-[44px]">Ekle</button>
                        </div>
                        <div id="odevListesi" class="flex flex-wrap gap-1 mt-2"></div>
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
                            <th class="border p-4 text-base font-bold">İçerik</th>
                            <th class="border p-4 text-base font-bold">Ödevler</th>
                            <th class="border p-4 text-base font-bold">Durum</th>
                            <th class="border p-4 text-base font-bold">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows || '<tr><td colspan="7" class="text-center p-4 text-base">Henüz ders kaydı yok.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>`;
        
    document.getElementById("dynamic-content").innerHTML = html;
    window._geciciOdevList = [];
    
    window.addOdevToList = () => {
        const input = document.getElementById("yeniOdev");
        const val = input ? input.value.trim() : "";
        if (val) {
            window._geciciOdevList.push(val);
            input.value = "";
            const container = document.getElementById("odevListesi");
            if (container) {
                container.innerHTML = window._geciciOdevList.map((od, idx) => `
                    <div class="bg-gray-200 dark:bg-gray-700 rounded-full px-2.5 py-1 text-sm flex items-center gap-1 font-semibold">
                        ${escapeHtml(od)}
                        <button onclick="removeOdevFromList(${idx})" class="text-red-500 text-base"><i class="fas fa-times-circle"></i></button>
                    </div>`).join('');
            }
        }
    };
    
    window.removeOdevFromList = (idx) => {
        window._geciciOdevList.splice(idx, 1);
        const container = document.getElementById("odevListesi");
        if (container) {
            container.innerHTML = window._geciciOdevList.map((od, idx) => `
                <div class="bg-gray-200 dark:bg-gray-700 rounded-full px-2.5 py-1 text-sm flex items-center gap-1 font-semibold">
                    ${escapeHtml(od)}
                    <button onclick="removeOdevFromList(${idx})" class="text-red-500 text-base"><i class="fas fa-times-circle"></i></button>
                </div>`).join('');
        }
    };
}

export function addDersKayit(studentId) {
    const tarih = document.getElementById("kayitTarih").value;
    const ders = document.getElementById("kayitDers")?.value || "";
    const konu = document.getElementById("kayitKonu").value;
    const icerik = document.getElementById("kayitIcerik").value;
    const odendi = document.getElementById("kayitOdendi").value === "true";
    const odevler = window._geciciOdevList || [];
    
    if (!tarih || !ders || !konu) {
        alert("Lütfen tarih, ders ve konu alanlarını seçiniz.");
        return;
    }
    
    let kayitlar = loadDersKayitlari(studentId);
    const yeniNo = kayitlar.length + 1;
    kayitlar.push({ dersNo: yeniNo, tarih, ders, konu, icerik, odev: odevler, odendi });
    saveDersKayitlari(studentId, kayitlar);
    renderDersDetay(studentId);
}

export function editDersKayit(studentId, dersNo) {
    let kayitlar = loadDersKayitlari(studentId);
    const idx = kayitlar.findIndex(k => k.dersNo === dersNo);
    if (idx === -1) return;
    
    const k = kayitlar[idx];
    const odevList = Array.isArray(k.odev) ? k.odev : (k.odev ? [k.odev] : []);
    const odevStr = odevList.join(", ");
    
    const yeniTarih = prompt("Tarih (YYYY-MM-DD):", k.tarih);
    const yeniKonu = prompt("Konu:", k.konu);
    const yeniIcerik = prompt("İçerik:", k.icerik);
    const yeniOdevlerStr = prompt("Ödevler (virgülle ayırın):", odevStr);
    const yeniOdendi = confirm("Ödendi mi? (Tamam:Ödendi, İptal:Bekliyor)");
    
    if (yeniTarih && yeniKonu) {
        const yeniOdevler = yeniOdevlerStr ? yeniOdevlerStr.split(",").map(s => s.trim()).filter(s => s) : [];
        kayitlar[idx] = { ...k, tarih: yeniTarih, konu: yeniKonu, icerik: yeniIcerik || '', odev: yeniOdevler, odendi: yeniOdendi };
        saveDersKayitlari(studentId, kayitlar);
        renderDersDetay(studentId);
    }
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

// Bind to window for global accessibility
window.renderFinanceReport = renderFinanceReport;
window.renderDersKayitlari = renderDersKayitlari;
window.renderDersDetay = renderDersDetay;
window.addDersKayit = addDersKayit;
window.editDersKayit = editDersKayit;
window.deleteDersKayit = deleteDersKayit;
window.onDersKayitSubjectChanged = onDersKayitSubjectChanged;


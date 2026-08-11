// ==================== HOMEWORK MANAGEMENT MODULE ====================

import { db, auth, isFirebaseActive } from './firebase-config.js';
import { store, loadStudentsData, saveStudentsData, getStudentOdevler, getKonuListesiBySinifAndDers, escapeHtml } from './store.js';
import { showSyncStatus } from './ui-helpers.js';
import { updateMobileNavActive } from './auth.js';
import { calculateTopicTestNet } from './topic-exam-insights.js';
import { readResourceSelection, resourceOptionsHtml, toggleManualResource } from './resource-books.js';
import { buildHomeworkErrorTopics } from './homework-error-topics.js';

export function hideNavigationElements() {
    const sidebar = document.querySelector('#app-root > div.hidden.md\\:flex');
    if (sidebar) sidebar.style.display = 'none';
    const bottomNav = document.querySelector('#app-root > div.flex.md\\:hidden');
    if (bottomNav) bottomNav.style.display = 'none';
    const mainContent = document.querySelector('#app-root > div.w-full.md\\:w-3\\/4');
    if (mainContent) {
        mainContent.className = "w-full p-6 overflow-y-auto pb-6";
    }
}

export function renderParentHwPasscodeScreen(hwData) {
    store.currentPage = "parentHwPasscode";
    if (window.currentPage) window.currentPage = "parentHwPasscode";
    hideNavigationElements();
    const html = `
        <div class="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border mt-10">
            <div class="text-center border-b pb-4 mb-4">
                <div class="text-2xl font-black text-blue-600 dark:text-blue-400">Canfenci</div>
                <div class="text-sm font-semibold text-gray-500 dark:text-gray-400">Ödev Giriş Doğrulaması</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl mb-4 border text-sm text-center">
                <div class="font-semibold text-gray-700 dark:text-gray-300">Öğrenci: ${escapeHtml(hwData.studentName)}</div>
                <div class="text-xs text-gray-500 mt-1">${escapeHtml(hwData.konu)} (${escapeHtml(hwData.yayin)})</div>
            </div>
            <div id="passcodeError" class="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-xl mb-4 text-xs hidden"></div>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 text-center">🔑 6 Haneli Giriş Şifresi</label>
                    <input type="number" id="hwPasscode" placeholder="••••••" class="student-form-input text-2xl font-bold tracking-widest text-center" oninput="if(this.value.length>6) this.value=this.value.slice(0,6)">
                </div>
                <button onclick="verifyHwPasscode('${hwData.id}')" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow flex items-center justify-center gap-2 min-h-[44px]">Giriş Yap</button>
            </div>
        </div>
    `;
    document.getElementById("dynamic-content").innerHTML = html;
}

export function verifyHwPasscode(hwId) {
    const pin = document.getElementById("hwPasscode").value.trim();
    const errDiv = document.getElementById("passcodeError");
    if (errDiv) errDiv.classList.add("hidden");
    if (pin.length !== 6) {
        if (errDiv) {
            errDiv.textContent = "Lütfen 6 haneli şifrenizi giriniz.";
            errDiv.classList.remove("hidden");
        }
        return;
    }
    db.collection("homeworks").doc(hwId).get().then(doc => {
        if (doc.exists) {
            const hwData = doc.data();
            if (hwData.passcode !== pin) {
                if (errDiv) {
                    errDiv.textContent = "Hatalı şifre! Lütfen öğretmeninizin gönderdiği şifreyi kontrol edin.";
                    errDiv.classList.remove("hidden");
                }
                return;
            }
            const today = new Date().toISOString().slice(0, 10);
            if (today > hwData.bitisTarihi) {
                if (errDiv) {
                    errDiv.textContent = `⚠️ Bu ödevin teslim süresi (${hwData.bitisTarihi}) dolmuştur. Giriş yapılamaz.`;
                    errDiv.classList.remove("hidden");
                }
                return;
            }
            if (hwData.durum === 'tamamlandi') {
                if (errDiv) {
                    errDiv.textContent = "ℹ️ Bu ödev zaten tamamlanmış.";
                    errDiv.classList.remove("hidden");
                }
                return;
            }
            renderParentHwEntry(hwData.studentName, hwData.studentId, hwData.id, hwData.konu, hwData.tur, hwData.yayin);
        } else {
            if (errDiv) {
                errDiv.textContent = "Ödev kaydı bulunamadı.";
                errDiv.classList.remove("hidden");
            }
        }
    }).catch(err => {
        console.error(err);
        if (errDiv) {
            errDiv.textContent = "Bağlantı hatası: " + err.message;
            errDiv.classList.remove("hidden");
        }
    });
}

export function renderParentHwEntry(studentName, studentId, hwId, konu, tur, yayin) {
    store.currentPage = "parentHwEntry";
    if (window.currentPage) window.currentPage = "parentHwEntry";
    hideNavigationElements();
    const isOnline = (store.useFirestore && isFirebaseActive);
    const btnIcon = isOnline ? 'fa-paper-plane' : 'fab fa-whatsapp';
    const btnText = isOnline ? 'Sonucu Gönder' : 'Sonucu Öğretmene Gönder';
    const html = `
        <div class="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border mt-4">
            <div class="text-center border-b pb-4 mb-4">
                <div class="text-2xl font-black text-blue-600 dark:text-blue-400">Canfenci</div>
                <div class="text-sm font-semibold text-gray-500 dark:text-gray-400">Ödev Sonuç Giriş Paneli</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl mb-4 border text-sm">
                <div class="mb-1"><span class="font-bold text-gray-700 dark:text-gray-300">Öğrenci:</span> ${escapeHtml(studentName)}</div>
                <div class="mb-1"><span class="font-bold text-gray-700 dark:text-gray-300">Ödev Konusu:</span> ${escapeHtml(konu)}</div>
                <div class="mb-1"><span class="font-bold text-gray-700 dark:text-gray-300">Tür / Yayın:</span> ${escapeHtml(tur)} / ${escapeHtml(yayin)}</div>
            </div>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">✅ Doğru Sayısı</label>
                    <input type="number" id="parentCorrect" min="0" value="0" class="student-form-input text-lg font-bold text-center min-h-[44px]">
                </div>
                <div>
                    <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">❌ Yanlış Sayısı</label>
                    <input type="number" id="parentWrong" min="0" value="0" class="student-form-input text-lg font-bold text-center min-h-[44px]">
                </div>
                <button onclick="submitParentHwResult('${studentId}', '${hwId}', '${escapeHtml(studentName)}', '${escapeHtml(konu)}', '${escapeHtml(tur)}', '${escapeHtml(yayin)}')" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow flex items-center justify-center gap-2 mt-4 min-h-[44px]">
                    <i class="fas ${btnIcon} text-xl"></i> ${btnText}
                </button>
            </div>
        </div>
    `;
    document.getElementById("dynamic-content").innerHTML = html;
}

export function submitParentHwResult(studentId, hwId, studentName, konu, tur, yayin) {
    const correct = parseInt(document.getElementById('parentCorrect').value) || 0;
    const wrong = parseInt(document.getElementById('parentWrong').value) || 0;
    if (store.useFirestore && isFirebaseActive) {
        showSyncStatus("Kaydediliyor...", false);
        db.collection("homeworks").doc(hwId).update({
            durum: "tamamlandi",
            dogru: correct,
            yanlis: wrong
        }).then(() => {
            showSyncStatus("✅ Başarıyla Kaydedildi!", false);
            document.getElementById("dynamic-content").innerHTML = `
                <div class="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border mt-10 text-center">
                    <div class="text-green-500 text-5xl mb-4"><i class="fas fa-check-circle"></i></div>
                    <h2 class="text-2xl font-bold mb-2">Başarıyla Kaydedildi!</h2>
                    <p class="text-gray-500 text-sm">Girdiğiniz doğru ve yanlış sayıları öğretmen sistemine anlık olarak aktarıldı. Teşekkür ederiz.</p>
                </div>
            `;
        }).catch(err => {
            console.error(err);
            alert("Hata: " + err.message);
        });
    } else {
        const baseUrl = window.location.origin + window.location.pathname;
        let message = `Sayın Canfenci Öğretmenim,\n\n*${studentName}* isimli öğrencimizin *${konu}* (${yayin} - ${tur}) konulu ödev sonucu aşağıdaki gibidir:\n\n`;
        message += `✅ *Doğru:* ${correct}\n`;
        message += `❌ *Yanlış:* ${wrong}\n\n`;
        message += `Sonucu sisteme kaydetmek için lütfen aşağıdaki bağlantıya tıklayın:\n`;
        message += `${baseUrl}?action=teacher-import-hw&studentId=${studentId}&hwId=${hwId}&d=${correct}&y=${wrong}`;
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    }
}

export function importHwResult(studentId, hwId, dogru, yanlis) {
    const students = loadStudentsData();
    const sIdx = students.findIndex(s => s.id === studentId);
    if (sIdx === -1) {
        alert("Öğrenci bulunamadı. Lütfen verilerinizin güncel olduğunu kontrol edin.");
        window.location.href = window.location.origin + window.location.pathname;
        return;
    }
    if (!students[sIdx].odevler) students[sIdx].odevler = [];
    const hwIdx = students[sIdx].odevler.findIndex(h => h.id === hwId);
    if (hwIdx === -1) {
        alert("Ödev kaydı bulunamadı.");
        window.location.href = window.location.origin + window.location.pathname;
        return;
    }
    students[sIdx].odevler[hwIdx].durum = "tamamlandi";
    students[sIdx].odevler[hwIdx].dogru = dogru;
    students[sIdx].odevler[hwIdx].yanlis = yanlis;
    saveStudentsData(students);
    alert(`✅ ${students[sIdx].adSoyad} isimli öğrencinin ödev sonucu başarıyla kaydedildi!\nDoğru: ${dogru}, Yanlış: ${yanlis}`);
    window.location.href = window.location.origin + window.location.pathname + "?page=odevler";
}

export function renderOdevTakibi() {
    store.currentPage = "odevTakibi";
    if (window.currentPage) window.currentPage = "odevTakibi";
    updateMobileNavActive('mobile-nav-homework');
    const students = loadStudentsData();
    if (students.length === 0) {
        document.getElementById("dynamic-content").innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 text-center text-gray-500">
                Henüz öğrenci eklenmemiş. Lütfen önce öğrenci ekleyin.
            </div>
        `;
        return;
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    let cardsHtml = '<div class="grid md:grid-cols-2 gap-5">';
    for (let s of students) {
        const odevler = getStudentOdevler(s);
        const bekleyenCount = odevler.filter(o => o.durum === 'verildi').length;
        const tamamlananCount = odevler.filter(o => o.durum === 'tamamlandi').length;
        const gecikenCount = odevler.filter(o => o.durum === 'verildi' && todayStr > o.bitisTarihi).length;
        
        cardsHtml += `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-5 hover:shadow-lg transition cursor-pointer hover:-translate-y-1" onclick="renderStudentOdevDetay('${s.id}')">
                <div class="flex justify-between items-center mb-1">
                    <h3 class="text-xl font-bold">${escapeHtml(s.adSoyad)}</h3>
                    <i class="fas fa-chevron-right text-gray-400"></i>
                </div>
                <p class="text-sm text-gray-500 mb-3">${escapeHtml(s.okul)} | ${s.sinif ? s.sinif + '. Sınıf' : 'Sınıf belirtilmemiş'}</p>
                <div class="flex gap-2 flex-wrap">
                    <span class="stat-badge text-base bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">⏳ Bekleyen: ${bekleyenCount}</span>
                    <span class="stat-badge text-base bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">✅ Tamamlanan: ${tamamlananCount}</span>
                    ${gecikenCount > 0 ? `<span class="stat-badge text-base bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 font-bold animate-pulse">🚨 Geciken: ${gecikenCount}</span>` : ''}
                </div>
            </div>
        `;
    }
    cardsHtml += '</div>';
    
    const html = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow mb-4 flex justify-between items-center flex-wrap gap-3">
            <div>
                <h2 class="page-heading text-2xl font-bold text-gray-800 dark:text-white">📝 Ödev Takibi</h2>
                <p class="text-sm text-gray-500">Öğrencilerin ödevlerini atayın ve tamamlanma durumlarını takip edin.</p>
            </div>
            <button onclick="showOdevAtaModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow font-semibold transition flex items-center gap-2 min-h-[44px]">
                <i class="fas fa-plus"></i> Ödev Ata
            </button>
        </div>
        ${cardsHtml}
    `;
    document.getElementById("dynamic-content").innerHTML = html;
}

export function renderStudentOdevDetay(studentId) {
    store.currentPage = "studentOdevDetay";
    if (window.currentPage) window.currentPage = "studentOdevDetay";
    window._currentOdevStudentId = studentId;
    updateMobileNavActive('mobile-nav-homework');
    
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) {
        renderOdevTakibi();
        return;
    }
    const odevler = getStudentOdevler(student);
    const todayStr = new Date().toISOString().slice(0, 10);
    let listRows = '';
    
    for (let i = 0; i < odevler.length; i++) {
        const o = odevler[i];
        const isCompleted = o.durum === 'tamamlandi';
        const isOverdue = !isCompleted && todayStr > o.bitisTarihi;
        
        const statusBadge = isCompleted 
            ? `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">✅ Tamamlandı</span>`
            : (isOverdue 
                ? `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 animate-pulse">⚠️ Süresi Geçti</span>`
                : `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">⏳ Bekliyor</span>`);
        
        const resultText = isCompleted
            ? `<div class="text-base text-gray-600 dark:text-gray-400 mt-1 font-semibold">Sonuç: <span class="text-green-600">${o.dogru} Doğru</span> / <span class="text-red-650">${o.yanlis} Yanlış</span>${o.tur === 'Konu Denemesi' ? ` / <span class="text-blue-600">${calculateTopicTestNet(o.dogru, o.yanlis).toFixed(2)} Net</span>` : ''}${(o.yanlisKonular || []).length ? `<div class="mt-1 text-xs text-amber-700 dark:text-amber-300">Yanlış konusu: ${(o.yanlisKonular || []).map(item => `${escapeHtml(item.konu)}${item.altKonu ? ` › ${escapeHtml(item.altKonu)}` : ''} (${item.adet})`).join(', ')}</div>` : ''}</div>`
            : '';
        
        const dateTextClass = isOverdue ? 'text-red-500 font-bold' : 'text-gray-400 dark:text-gray-500';
        
        listRows += `
            <div class="border rounded-xl p-4 bg-white dark:bg-gray-800 flex justify-between items-center gap-3">
                <div class="flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-bold text-base text-gray-800 dark:text-white">${escapeHtml(o.konu)}</span>
                        ${statusBadge}
                    </div>
                    <div class="text-base text-gray-500 dark:text-gray-400 mt-1">📚 Yayın: <span class="font-medium">${escapeHtml(o.yayin)}</span> | Tür: <span class="font-medium">${escapeHtml(o.tur)}</span></div>
                    <div class="text-base ${dateTextClass} mt-0.5">📅 Süre: ${o.baslamaTarihi} / <span>${o.bitisTarihi}</span></div>
                    ${resultText}
                </div>
                <div class="flex gap-2 flex-wrap items-center">
                    ${!isCompleted ? `
                        <button onclick="sendSingleHwReminder('${studentId}', '${o.id}')" class="text-teal-600 hover:text-teal-700 text-sm font-semibold border border-teal-200 dark:border-teal-800 rounded-lg px-3 py-2.5 flex items-center gap-1 min-h-[44px]">
                            <i class="fab fa-whatsapp"></i> Hatırlat
                        </button>
                        <button onclick="showEnterOdevSonucModal('${studentId}', '${o.id}')" class="text-green-500 hover:text-green-600 text-base font-semibold border rounded px-3 py-2.5 min-h-[44px]">
                            D/Y Gir
                        </button>
                    ` : ''}
                    <button onclick="deleteOdev('${studentId}', '${o.id}')" class="text-red-500 hover:text-red-600 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    const html = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 border">
            <div class="flex justify-between items-center mb-4 flex-wrap gap-3">
                <div>
                    <h2 class="page-heading text-2xl font-bold text-gray-800 dark:text-white">${escapeHtml(student.adSoyad)}</h2>
                    <p class="text-sm text-gray-500">Ödev Takip Paneli</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="shareHomeworkWhatsApp('${studentId}')" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl shadow font-semibold transition flex items-center gap-2 min-h-[44px]">
                        <i class="fab fa-whatsapp text-lg"></i> Raporu Veliye Gönder
                    </button>
                    <button onclick="renderOdevTakibi()" class="bg-gray-500 text-white px-4 py-2.5 rounded-xl min-h-[44px]">
                        Geri
                    </button>
                </div>
            </div>
            <div class="space-y-3 mt-4">
                ${listRows || '<div class="text-center text-gray-400 p-4">Henüz atanmış ödev bulunmuyor.</div>'}
            </div>
        </div>
    `;
    document.getElementById("dynamic-content").innerHTML = html;
}

export function deleteOdev(studentId, hwId) {
    if (confirm("Bu ödevi silmek istediğinize emin misiniz?")) {
        if (store.useFirestore && isFirebaseActive) {
            db.collection("homeworks").doc(hwId).delete()
                .then(() => {
                    renderStudentOdevDetay(studentId);
                })
                .catch(err => console.error(err));
        } else {
            const students = loadStudentsData();
            const sIdx = students.findIndex(s => s.id === studentId);
            if (sIdx !== -1) {
                students[sIdx].odevler = (students[sIdx].odevler || []).filter(o => o.id !== hwId);
                saveStudentsData(students);
                renderStudentOdevDetay(studentId);
            }
        }
    }
}

export function sendSingleHwReminder(studentId, hwId) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    if (!student.veliTel) {
        alert("Lütfen bu öğrenci için önce veli telefon numarası giriniz.");
        if (window.editStudent) window.editStudent(studentId);
        return;
    }
    const odevler = getStudentOdevler(student);
    const o = odevler.find(x => x.id === hwId);
    if (!o) return;
    
    let message = `Merhaba Sayın Velimiz,\n\n*${student.adSoyad}* isimli öğrencimize atanan *${o.konu}* (${o.yayin} - ${o.tur}) ödevinin son teslim tarihi *${o.bitisTarihi}* dir.\n\nÖdev sonucunu doğru ve yanlış sayılarıyla bu mesajı yanıtlayarak iletebilirsiniz.\n\nİyi çalışmalar dileriz.`;
    
    let phone = student.veliTel.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '90' + phone.substring(1);
    else if (!phone.startsWith('90') && phone.length === 10) phone = '90' + phone;
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

export function showEnterOdevSonucModal(studentId, hwId) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const odev = getStudentOdevler(student).find(o => o.id === hwId);
    if (!odev) return;
    const isTopicTest = odev.tur === 'Konu Denemesi';
    const availableTopics = getKonuListesiBySinifAndDers(student.sinif, odev.ders || odev.kaynakDers?.ders || '');
    const topicOptions = availableTopics.includes(odev.konu) ? availableTopics : [odev.konu, ...availableTopics].filter(Boolean);
    const modal = document.createElement('div');
    modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4";
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h2 class="text-xl font-bold mb-1">📝 Ödev Sonucu Gir</h2>
            <p class="text-xs text-gray-500 mb-4">${escapeHtml(odev.konu)} (${escapeHtml(odev.yayin)})</p>
            <div class="space-y-3">
                <div>
                    <label class="text-sm font-semibold">Doğru Sayısı</label>
                    <input type="number" id="manualCorrect" min="0" value="0" class="student-form-input min-h-[44px]">
                </div>
                <div>
                    <label class="text-sm font-semibold">Yanlış Sayısı</label>
                    <input type="number" id="manualWrong" min="0" value="0" class="student-form-input min-h-[44px]">
                </div>
                <div class="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/10 p-3 space-y-3">
                    <div>
                        <label class="text-sm font-semibold">Yanlış Yapılan Ana Konu</label>
                        ${isTopicTest
                            ? `<div id="manualWrongTopicFixed" data-topic="${escapeHtml(odev.konu)}" class="mt-1 rounded-xl bg-white dark:bg-gray-800 border px-3 py-2 font-bold">${escapeHtml(odev.konu)} <span class="block text-xs font-normal text-gray-500">Konu denemesinde otomatik belirlenir.</span></div>`
                            : `<select id="manualWrongTopic" class="student-form-input min-h-[44px]"><option value="">Konu seçin</option>${topicOptions.map(topic => `<option value="${escapeHtml(topic)}">${escapeHtml(topic)}</option>`).join('')}</select>`}
                    </div>
                    <div>
                        <label class="text-sm font-semibold">Alt Konu <span class="text-xs font-normal text-gray-500">(isteğe bağlı)</span></label>
                        <input id="manualWrongSubtopicText" class="student-form-input min-h-[44px] mt-1" placeholder="Boş bırakabilir veya örn. Eksen Eğikliği yazabilirsiniz">
                    </div>
                </div>
                <button onclick="saveManualOdevResult('${studentId}', '${hwId}')" class="w-full bg-blue-600 text-white py-2.5 rounded-xl font-semibold mt-2 min-h-[44px]">Kaydet</button>
                <button onclick="this.closest('.fixed').remove()" class="w-full border py-2.5 rounded-xl min-h-[44px]">İptal</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

export function saveManualOdevResult(studentId, hwId) {
    const correct = parseInt(document.getElementById('manualCorrect').value) || 0;
    const wrong = parseInt(document.getElementById('manualWrong').value) || 0;
    const homeworkType = document.getElementById('manualWrongTopicFixed') ? 'Konu Denemesi' : '';
    const subtopic = document.getElementById('manualWrongSubtopicText')?.value.trim() || '';
    const errorTopics = buildHomeworkErrorTopics({
        homeworkType,
        assignedTopic: document.getElementById('manualWrongTopicFixed')?.dataset.topic || '',
        selectedTopic: document.getElementById('manualWrongTopic')?.value || '',
        subtopic,
        wrong
    });
    if (wrong > 0 && errorTopics.length === 0) return alert('Yanlış yapılan ana konuyu seçin.');
    if (store.useFirestore && isFirebaseActive) {
        db.collection("homeworks").doc(hwId).update({
            durum: "tamamlandi",
            dogru: correct,
            yanlis: wrong,
            yanlisKonular: errorTopics
        }).then(() => {
            document.querySelector('.fixed')?.remove();
            renderStudentOdevDetay(studentId);
        }).catch(err => console.error(err));
    } else {
        const students = loadStudentsData();
        const sIdx = students.findIndex(s => s.id === studentId);
        if (sIdx !== -1) {
            const hwIdx = students[sIdx].odevler.findIndex(o => o.id === hwId);
            if (hwIdx !== -1) {
                students[sIdx].odevler[hwIdx].durum = "tamamlandi";
                students[sIdx].odevler[hwIdx].dogru = correct;
                students[sIdx].odevler[hwIdx].yanlis = wrong;
                students[sIdx].odevler[hwIdx].yanlisKonular = errorTopics;
                saveStudentsData(students);
            }
        }
        document.querySelector('.fixed')?.remove();
        renderStudentOdevDetay(studentId);
    }
}

export function shareHomeworkWhatsApp(studentId) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    if (!student.veliTel) {
        alert("Lütfen bu öğrenci için önce veli telefon numarası giriniz.");
        if (window.editStudent) window.editStudent(studentId);
        return;
    }
    const odevler = getStudentOdevler(student);
    if (odevler.length === 0) {
        alert("Atanmış ödev bulunmuyor.");
        return;
    }
    let message = `Merhaba Sayın Velimiz,\n\n*${student.adSoyad}* isimli öğrencimizin aktif ödev takip raporu aşağıdaki gibidir:\n\n`;
    for (let o of odevler) {
        const isCompleted = o.durum === 'tamamlandi';
        if (isCompleted) {
            message += `✅ *${o.konu}* (${o.yayin} - ${o.tur})\n`;
            message += `  - Durum: Tamamlandı\n`;
            message += `  - Sonuç: ${o.dogru} Doğru, ${o.yanlis} Yanlış\n\n`;
        } else {
            message += `⏳ *${o.konu}* (${o.yayin} - ${o.tur})\n`;
            message += `  - Durum: Bekliyor\n`;
            message += `  - Son Teslim: ${o.bitisTarihi}\n`;
            message += `  - Sonucu doğru/yanlış sayılarıyla bu mesajı yanıtlayarak iletebilirsiniz.\n\n`;
        }
    }
    message += `İyi çalışmalar dileriz.`;
    let phone = student.veliTel.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '90' + phone.substring(1);
    else if (!phone.startsWith('90') && phone.length === 10) phone = '90' + phone;
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

export function showOdevAtaModal() {
    window._geciciOdevListesi = [];
    renderOdevAtaModal(null, null);
}

export function renderOdevAtaModal(preSelectedStudentIds = null, lessonContext = null) {
    window._odevDersContext = lessonContext;
    const lessonContextHtml = lessonContext ? `
        <div class="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/20 dark:text-indigo-300">
            <div class="font-bold"><i class="fas fa-link"></i> Ders kaydına bağlı ödev</div>
            <div class="mt-1">${escapeHtml(lessonContext.ders)} · ${escapeHtml(lessonContext.konu)} · ${escapeHtml(lessonContext.tarih)}</div>
        </div>
    ` : '';
    const modalHtml = `
        <div id="odevAtaModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-auto p-4" onclick="if(event.target===this) closeOdevAtaModal()">
            <div class="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 shadow-xl" onclick="event.stopPropagation()">
                <div class="flex justify-between items-center mb-3">
                    <h2 class="text-xl font-bold">📋 Ödev Ata</h2>
                    <button onclick="closeOdevAtaModal()" class="text-gray-500"><i class="fas fa-times text-xl"></i></button>
                </div>
                <div class="space-y-4">
                    ${lessonContextHtml}
                    <div>
                        <label class="block text-sm font-bold mb-1">Sınıf Seviyesi Seçin (Dinamik Filtreleme)</label>
                        <select id="odevGradeSelect" class="student-form-input min-h-[44px]">
                            <option value="" disabled selected>Sınıf Seçiniz</option>
                            <option value="5">5. Sınıf</option>
                            <option value="6">6. Sınıf</option>
                            <option value="7">7. Sınıf</option>
                            <option value="8">8. Sınıf (LGS)</option>
                        </select>
                    </div>
                    <div id="odevDetayForm" class="hidden bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border space-y-3">
                        <h3 class="font-bold text-sm text-gray-700 dark:text-gray-300">Ödev Bilgileri</h3>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 mb-1">Başlama Tarihi</label>
                                <input type="date" id="odevBaslamaTarihi" class="student-form-input min-h-[44px]">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 mb-1">Bitiş Tarihi</label>
                                <input type="date" id="odevBitisTarihi" class="student-form-input min-h-[44px]">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 mb-1">Ders</label>
                            <select id="odevDersSelect" onchange="onOdevSubjectChanged()" class="student-form-input min-h-[44px]">
                                <option value="">Ders seçin</option>
                                ${(store.teacherBranches || []).map(subject => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 mb-1">Ödev Konusu</label>
                            <select id="odevKonuSelect" class="student-form-input min-h-[44px]"></select>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 mb-1">Ödevin Türü</label>
                                <select id="odevTurSelect" class="student-form-input min-h-[44px]">
                                    <option value="Konu Denemesi">Konu Denemesi</option>
                                    <option value="Yaprak Test">Yaprak Test</option>
                                    <option value="Örnek Sınavlar">Örnek Sınavlar</option>
                                    <option value="Soru Bankası" selected>Soru Bankası</option>
                                    <option value="Konu Tekrarı">Konu Tekrarı</option>
                                    <option value="Diğer">Diğer</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 mb-1">Kaynak Kitap / Yayın</label>
                                <select id="odevYayinSelect" onchange="toggleOdevManualResource()" class="student-form-input min-h-[44px]"><option value="">Önce sınıf ve ders seçin</option></select>
                                <div id="odevYayinManualArea" class="hidden mt-2"><input type="text" id="odevYayinInput" placeholder="Kaynak adını manuel girin" class="student-form-input min-h-[44px]"></div>
                            </div>
                        </div>
                        <button onclick="addOdevToGeciciList()" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-semibold transition text-sm flex items-center justify-center gap-1 min-h-[44px]">
                            <i class="fas fa-plus"></i> Listeye Ödev Ekle
                        </button>
                    </div>
                    <div id="geciciOdevListesiArea" class="hidden">
                        <h4 class="font-bold text-sm mb-2">Eklenecek Ödevler:</h4>
                        <div id="geciciOdevListContainer" class="space-y-2 border p-3 rounded-xl bg-gray-50 dark:bg-gray-900/30 max-h-36 overflow-y-auto"></div>
                    </div>
                    <div id="odevOgrenciSecimArea" class="hidden">
                        <label class="block text-sm font-bold mb-1">Öğrenci Seçimi:</label>
                        <div id="odevOgrenciChecklist" class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border p-3 rounded-xl bg-gray-50 dark:bg-gray-900/30"></div>
                    </div>
                    <button id="odevAtaSubmitBtn" class="hidden w-full bg-green-650 hover:bg-green-755 text-white py-3 rounded-xl font-bold transition shadow-lg mt-3 min-h-[44px]">
                        📌 Seçilen Öğrencilere Ata
                    </button>
                </div>
            </div>
        </div>
    `;
    const existing = document.getElementById('odevAtaModal');
    if (existing) existing.remove();
    const modalDiv = document.createElement('div');
    modalDiv.id = 'odevAtaModal';
    modalDiv.innerHTML = modalHtml;
    document.body.appendChild(modalDiv);
    
    const today = new Date().toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    document.getElementById('odevBaslamaTarihi').value = today;
    document.getElementById('odevBitisTarihi').value = nextWeek;
    
    document.getElementById('odevGradeSelect').addEventListener('change', (e) => {
        onOdevGradeChanged(e.target.value);
    });
    document.getElementById('odevAtaSubmitBtn').addEventListener('click', () => submitBatchOdev());

    if (preSelectedStudentIds && preSelectedStudentIds.length > 0) {
        const students = loadStudentsData();
        const firstStudent = students.find(s => s.id === preSelectedStudentIds[0]);
        if (firstStudent) {
            const grade = firstStudent.sinif;
            document.getElementById('odevGradeSelect').value = grade;
            onOdevGradeChanged(grade, preSelectedStudentIds);
            if (lessonContext) {
                document.getElementById('odevTurSelect').value = 'Konu Denemesi';
                document.getElementById('odevBaslamaTarihi').value = lessonContext.tarih;
                document.getElementById('odevDersSelect').value = lessonContext.ders;
                onOdevSubjectChanged();
                if (lessonContext.kaynak) {
                    const resourceSelect = document.getElementById('odevYayinSelect');
                    const hasResource = Array.from(resourceSelect.options).some(option => option.value === lessonContext.kaynak);
                    resourceSelect.value = hasResource ? lessonContext.kaynak : '__manual__';
                    if (!hasResource) document.getElementById('odevYayinInput').value = lessonContext.kaynak;
                    toggleOdevManualResource();
                }
                const topicSelect = document.getElementById('odevKonuSelect');
                const hasLessonTopic = Array.from(topicSelect.options).some(option => option.value === lessonContext.konu);
                if (!hasLessonTopic) topicSelect.add(new Option(lessonContext.konu, lessonContext.konu));
                topicSelect.value = lessonContext.konu;
            }
        }
    }
}

export function closeOdevAtaModal() {
    document.getElementById('odevAtaModal')?.remove();
    window._odevDersContext = null;
}

export function onOdevGradeChanged(grade, preSelectedStudentIds = null) {
    document.getElementById('odevDetayForm').classList.remove('hidden');
    document.getElementById('odevOgrenciSecimArea').classList.remove('hidden');
    document.getElementById('odevAtaSubmitBtn').classList.remove('hidden');
    
    onOdevSubjectChanged();
    
    const students = loadStudentsData();
    const filtered = students.filter(s => s.sinif === grade);
    const checklist = document.getElementById('odevOgrenciChecklist');
    if (filtered.length === 0) {
        checklist.innerHTML = `<span class="text-xs text-gray-500 col-span-2 text-center py-2">Bu sınıf seviyesinde öğrenci bulunmuyor.</span>`;
    } else {
        checklist.innerHTML = filtered.map(s => {
            const isChecked = preSelectedStudentIds && preSelectedStudentIds.includes(s.id) ? 'checked' : '';
            return `
            <label class="flex items-center gap-2 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer transition">
                <input type="checkbox" value="${s.id}" ${isChecked} class="odevStudentCheck rounded border-gray-300 dark:border-gray-600 text-blue-600">
                <span class="text-sm font-medium text-gray-800 dark:text-gray-200">${escapeHtml(s.adSoyad)}</span>
            </label>
            `;
        }).join('');
    }
}

export function onOdevSubjectChanged() {
    const grade = document.getElementById('odevGradeSelect')?.value || '';
    const subject = document.getElementById('odevDersSelect')?.value || '';
    const topicSelect = document.getElementById('odevKonuSelect');
    if (topicSelect) topicSelect.innerHTML = '<option value="">Konu seçin</option>' + getKonuListesiBySinifAndDers(grade, subject).map(topic => `<option value="${escapeHtml(topic)}">${escapeHtml(topic)}</option>`).join('');
    const resourceSelect = document.getElementById('odevYayinSelect');
    if (resourceSelect) resourceSelect.innerHTML = resourceOptionsHtml(grade, subject, escapeHtml);
    toggleManualResource('odevYayinSelect', 'odevYayinManualArea');
}

export function toggleOdevManualResource() {
    toggleManualResource('odevYayinSelect', 'odevYayinManualArea');
}

export function addOdevToGeciciList() {
    const konu = document.getElementById('odevKonuSelect').value;
    const baslama = document.getElementById('odevBaslamaTarihi').value;
    const bitis = document.getElementById('odevBitisTarihi').value;
    const tur = document.getElementById('odevTurSelect').value;
    const ders = document.getElementById('odevDersSelect')?.value || '';
    const yayin = readResourceSelection('odevYayinSelect', 'odevYayinInput');
    if (!ders || !konu || !yayin) {
        alert("Lütfen ders, konu ve kaynak bilgilerini eksiksiz doldurun.");
        return;
    }
    const newHw = {
        id: "hw_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        baslamaTarihi: baslama,
        bitisTarihi: bitis,
        konu: konu,
        ders,
        tur: tur,
        yayin: yayin,
        durum: "verildi",
        dogru: null,
        yanlis: null,
        ...(window._odevDersContext ? { kaynakDers: { ...window._odevDersContext } } : {})
    };
    window._geciciOdevListesi.push(newHw);
    document.getElementById('geciciOdevListesiArea').classList.remove('hidden');
    renderGeciciOdevListUI();
    document.getElementById('odevYayinInput').value = '';
    showSyncStatus("✅ Ödev listeye eklendi", false);
}

export function renderGeciciOdevListUI() {
    const container = document.getElementById('geciciOdevListContainer');
    container.innerHTML = window._geciciOdevListesi.map((o, idx) => `
        <div class="flex justify-between items-center text-xs border-b pb-1">
            <span class="font-medium text-gray-800 dark:text-gray-200">${escapeHtml(o.konu)} (${escapeHtml(o.yayin)} - ${escapeHtml(o.tur)})</span>
            <button onclick="removeOdevFromGeciciList(${idx})" class="text-red-500"><i class="fas fa-times-circle"></i></button>
        </div>
    `).join('');
}

export function removeOdevFromGeciciList(idx) {
    window._geciciOdevListesi.splice(idx, 1);
    renderGeciciOdevListUI();
    if (window._geciciOdevListesi.length === 0) {
        document.getElementById('geciciOdevListesiArea').classList.add('hidden');
    }
}

export function submitBatchOdev() {
    const yayin = readResourceSelection('odevYayinSelect', 'odevYayinInput');
    if (window._geciciOdevListesi.length === 0) {
        if (yayin) {
            addOdevToGeciciList();
        } else {
            alert("Lütfen önce en az bir ödev ekleyin.");
            return;
        }
    }
    const checkedBoxes = document.querySelectorAll('.odevStudentCheck:checked');
    const selectedStudentIds = Array.from(checkedBoxes).map(cb => cb.value);
    if (selectedStudentIds.length === 0) {
        alert("Lütfen ödev atamak için en az bir öğrenci seçin.");
        return;
    }
    if (store.useFirestore && isFirebaseActive) {
        const students = loadStudentsData();
        const user = auth.currentUser;
        const userId = user ? user.uid : null;
        selectedStudentIds.forEach(sid => {
            const student = students.find(s => s.id === sid);
            const studentName = student ? student.adSoyad : "";
            window._geciciOdevListesi.forEach(o => {
                const uniqueId = o.id + "_" + sid;
                const newHw = { ...o, id: uniqueId, studentId: sid, studentName: studentName };
                if (userId) newHw.userId = userId;
                db.collection("homeworks").doc(uniqueId).set(newHw).catch(err => console.error(err));
            });
        });
        showSyncStatus("✅ Ödevler buluta eklendi", false);
    } else {
        const students = loadStudentsData();
        for (let sid of selectedStudentIds) {
            const sIdx = students.findIndex(s => s.id === sid);
            if (sIdx !== -1) {
                if (!students[sIdx].odevler) students[sIdx].odevler = [];
                const clonedList = JSON.parse(JSON.stringify(window._geciciOdevListesi));
                clonedList.forEach(o => {
                    o.id = o.id + "_" + sid;
                    o.studentId = sid;
                    o.studentName = students[sIdx].adSoyad;
                });
                students[sIdx].odevler.push(...clonedList);
            }
        }
        saveStudentsData(students);
    }
    const lessonContext = window._odevDersContext;
    showSyncStatus(`✅ ${selectedStudentIds.length} öğrenciye ${window._geciciOdevListesi.length} ödev atandı`, false);
    closeOdevAtaModal();
    if (lessonContext && selectedStudentIds.length === 1 && window.renderDersDetay) {
        window.renderDersDetay(selectedStudentIds[0]);
    } else {
        renderOdevTakibi();
    }
}

// Global window mappings for compatibility
window.hideNavigationElements = hideNavigationElements;
window.renderParentHwPasscodeScreen = renderParentHwPasscodeScreen;
window.verifyHwPasscode = verifyHwPasscode;
window.renderParentHwEntry = renderParentHwEntry;
window.submitParentHwResult = submitParentHwResult;
window.importHwResult = importHwResult;
window.renderOdevTakibi = renderOdevTakibi;
window.renderStudentOdevDetay = renderStudentOdevDetay;
window.deleteOdev = deleteOdev;
window.sendSingleHwReminder = sendSingleHwReminder;
window.showEnterOdevSonucModal = showEnterOdevSonucModal;
window.saveManualOdevResult = saveManualOdevResult;
window.shareHomeworkWhatsApp = shareHomeworkWhatsApp;
window.showOdevAtaModal = showOdevAtaModal;
window.renderOdevAtaModal = renderOdevAtaModal;
window.closeOdevAtaModal = closeOdevAtaModal;
window.onOdevGradeChanged = onOdevGradeChanged;
window.onOdevSubjectChanged = onOdevSubjectChanged;
window.toggleOdevManualResource = toggleOdevManualResource;
window.addOdevToGeciciList = addOdevToGeciciList;
window.renderGeciciOdevListUI = renderGeciciOdevListUI;
window.removeOdevFromGeciciList = removeOdevFromGeciciList;
window.submitBatchOdev = submitBatchOdev;
window._geciciOdevListesi = [];
window._currentOdevStudentId = null;
window._odevDersContext = null;

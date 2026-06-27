// ==================== EXAM ANALYSIS & MANAGEMENT MODULE ====================

import { db, auth, isFirebaseActive } from './firebase-config.js';
import { store, loadStudentsData, saveStudentsData, getKonuListesiBySinif, GENEL_DERSLER_GORUNUM, GENEL_DERSLER_KEY, HATA_KODLARI, POPULER_LISELER, getErrorColor, calculateNet, escapeHtml, loadSchedule, loadDersKayitlari, getStudentOdevler } from './store.js';
import { showSyncStatus } from './ui-helpers.js';

// Global state for deneme assignment
let denemeAtaMode = "branş";
let batchBransSoruSayisi = 0;
let batchGenelDersSayilari = {};

export function getKonuBazliBasarilar(ogrenci) {
    const konuList = getKonuListesiBySinif(ogrenci.sinif);
    const stats = {};
    konuList.forEach(k => stats[k] = { dogru: 0, toplamSoru: 0 });
    if (!ogrenci.denemeler) return stats;
    for (let den of ogrenci.denemeler) {
        if (den.tip === "genel") continue;
        for (let soru of den.sorular) {
            const konu = soru.konuAdi;
            if (stats[konu]) {
                stats[konu].toplamSoru++;
                if (soru.durum === "dogru") stats[konu].dogru++;
            }
        }
    }
    const basari = {};
    for (let k of konuList) {
        basari[k] = stats[k].toplamSoru ? (stats[k].dogru / stats[k].toplamSoru) * 100 : null;
    }
    return basari;
}

export function getOrtalamaNet(ogrenci) {
    const d = ogrenci.denemeler || [];
    if (!d.length) return 0;
    const toplam = d.reduce((s, e) => s + (e.toplamNet || 0), 0);
    return parseFloat((toplam / d.length).toFixed(2));
}

export function getBransOrtalamaNet(ogrenci) {
    const br = (ogrenci.denemeler || []).filter(d => d.tip === "branş");
    if (!br.length) return null;
    return parseFloat((br.reduce((s, d) => s + d.toplamNet, 0) / br.length).toFixed(2));
}

export function getGenelOrtalamaNet(ogrenci) {
    const gn = (ogrenci.denemeler || []).filter(d => d.tip === "genel");
    if (!gn.length) return null;
    return parseFloat((gn.reduce((s, d) => s + d.toplamNet, 0) / gn.length).toFixed(2));
}

export function getBestWorstTopics(b) {
    const entries = Object.entries(b).filter(([_, v]) => v !== null);
    if (!entries.length) return { zayif: [], guclu: [] };
    const sorted = [...entries].sort((a, b) => a[1] - b[1]);
    return {
        zayif: sorted.slice(0, 3).map(([k, v]) => ({ konu: k, yuzde: v.toFixed(1) })),
        guclu: sorted.slice(-3).reverse().map(([k, v]) => ({ konu: k, yuzde: v.toFixed(1) }))
    };
}

export function getMotivationMessage(s) {
    const d = s.denemeler || [];
    if (!d.length) return "📝 İlk denemeyi ekleyin";
    const sonNet = d[d.length - 1].toplamNet;
    const hedef = parseFloat(s.hedefNet);
    if (isNaN(hedef)) return "🎯 Hedef net belirtilmemiş";
    const fark = hedef - sonNet;
    if (fark <= 0) return "🎉 Hedefine ulaştın!";
    if (fark <= 2) return `🚀 Hedefine ${fark.toFixed(1)} net kaldı`;
    if (fark <= 5) return `💪 ${fark.toFixed(1)} net kaldı`;
    return `📈 Hedefine ${fark.toFixed(1)} net var.`;
}

export function getHataIstatistikleri(ogrenci) {
    const hataSayilari = {};
    HATA_KODLARI.forEach(h => hataSayilari[h.kod] = 0);
    let toplamHata = 0;
    if (!ogrenci.denemeler) return { hataSayilari, toplamHata };
    for (let den of ogrenci.denemeler) {
        if (den.tip === "genel") continue;
        for (let soru of den.sorular) {
            if ((soru.durum === "yanlis" || soru.durum === "bos") && soru.hataKodu) {
                hataSayilari[soru.hataKodu]++;
                toplamHata++;
            }
        }
    }
    return { hataSayilari, toplamHata };
}

export function lgsPuanHesapla(genelDenemeler) {
    if (!genelDenemeler || genelDenemeler.length === 0) return null;
    let toplamPuan = 0;
    for (let den of genelDenemeler) {
        let examPuan = 177.8;
        if (den.dersSonuclari && Object.keys(den.dersSonuclari).length > 0) {
            let netMat = calculateNet(den.dersSonuclari["Matematik"]?.dogru || 0, den.dersSonuclari["Matematik"]?.yanlis || 0);
            let netFen = calculateNet(den.dersSonuclari["Fen Bilimleri"]?.dogru || 0, den.dersSonuclari["Fen Bilimleri"]?.yanlis || 0);
            let netTur = calculateNet(den.dersSonuclari["Türkçe"]?.dogru || 0, den.dersSonuclari["Türkçe"]?.yanlis || 0);
            let netSos = calculateNet(den.dersSonuclari["İnkılap Tarihi ve Sosyal Bilgiler"]?.dogru || 0, den.dersSonuclari["İnkılap Tarihi ve Sosyal Bilgiler"]?.yanlis || 0);
            if (den.dersSonuclari["İnkılap Tarihi / Sosyal Bilgiler"]) {
                netSos = calculateNet(den.dersSonuclari["İnkılap Tarihi / Sosyal Bilgiler"]?.dogru || 0, den.dersSonuclari["İnkılap Tarihi / Sosyal Bilgiler"]?.yanlis || 0);
            }
            let netDin = calculateNet(den.dersSonuclari["Din Kültürü ve Ahlak Bilgisi"]?.dogru || 0, den.dersSonuclari["Din Kültürü ve Ahlak Bilgisi"]?.yanlis || 0);
            let netIng = calculateNet(den.dersSonuclari["Yabancı Dil (İngilizce)"]?.dogru || 0, den.dersSonuclari["Yabancı Dil (İngilizce)"]?.yanlis || 0);
            
            examPuan += (netTur * 4.53) + (netMat * 4.65) + (netFen * 4.12) + (netSos * 1.94) + (netDin * 1.99) + (netIng * 1.69);
        } else {
            examPuan += den.toplamNet * 3.58;
        }
        toplamPuan += examPuan;
    }
    return Math.min(500, Math.max(100, Math.round(toplamPuan / genelDenemeler.length)));
}

export function showDenemeAtaModal() {
    denemeAtaMode = "branş";
    batchBransSoruSayisi = 0;
    batchGenelDersSayilari = {};
    GENEL_DERSLER_KEY.forEach(d => batchGenelDersSayilari[d] = 0);
    renderDenemeAtaModal();
}

export function renderDenemeAtaModal() {
    const students = loadStudentsData();
    const studentCheckboxes = students.map(s => `
        <label class="flex items-center gap-2 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer transition">
            <input type="checkbox" value="${s.id}" class="studentCheck rounded border-gray-300 dark:border-gray-650 text-blue-600">
            <span class="text-sm font-medium text-gray-805 dark:text-gray-200">${escapeHtml(s.adSoyad)} (${escapeHtml(s.okul)}${s.sinif ? ', ' + s.sinif + '. sınıf' : ''})</span>
        </label>
    `).join('');
    
    const bransHtml = `
        <div id="bransSecim" class="${denemeAtaMode === 'branş' ? '' : 'hidden'}">
            <div class="mb-3">
                <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Toplam Soru Sayısı</label>
                <input type="number" id="bransSoruSayisi" min="1" value="${batchBransSoruSayisi || 1}" class="student-form-input min-h-[44px]">
            </div>
        </div>
    `;
    
    let genelDersHtml = `
        <div id="genelSecim" class="${denemeAtaMode === 'genel' ? '' : 'hidden'}">
            <div class="mb-2 font-bold text-sm text-gray-700 dark:text-gray-300">Ders Bazında Soru Sayıları:</div>
    `;
    for (let i = 0; i < GENEL_DERSLER_KEY.length; i++) {
        const dersKey = GENEL_DERSLER_KEY[i];
        const dersGorunum = GENEL_DERSLER_GORUNUM[i];
        genelDersHtml += `
            <div class="mb-2 flex items-center gap-3">
                <label class="w-48 text-sm font-semibold">${dersGorunum}</label>
                <input type="number" min="0" value="${batchGenelDersSayilari[dersKey] || 0}" class="w-24 border-2 rounded-xl p-2 focus:ring-4 focus:ring-indigo-200 outline-none genelDersInput min-h-[44px]" data-ders="${dersKey}">
            </div>
        `;
    }
    genelDersHtml += `</div>`;
    
    const modalHtml = `
        <div id="denemeAtaModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-auto p-4" onclick="if(event.target===this) closeDenemeAtaModal()">
            <div class="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 shadow-xl border" onclick="event.stopPropagation()">
                <div class="flex justify-between items-center mb-3">
                    <h2 class="text-xl font-bold">📋 Deneme Ata</h2>
                    <button onclick="closeDenemeAtaModal()" class="text-gray-500"><i class="fas fa-times text-xl"></i></button>
                </div>
                <div class="mb-4 flex border-b">
                    <button id="tabBransBtn" class="flex-1 py-2 text-center font-bold border-b-2 ${denemeAtaMode === 'branş' ? 'border-blue-600 text-blue-605' : 'border-transparent text-gray-500 hover:text-gray-700'}">🔬 Branş Deneme</button>
                    <button id="tabGenelBtn" class="flex-1 py-2 text-center font-bold border-b-2 ${denemeAtaMode === 'genel' ? 'border-blue-600 text-blue-605' : 'border-transparent text-gray-500 hover:text-gray-700'}">📘 Genel Deneme (Tüm Dersler)</button>
                </div>
                <div class="mb-3">
                    <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Deneme Adı</label>
                    <input id="denemeAtaExamName" class="student-form-input min-h-[44px]" placeholder="Örn: Mart Denemesi">
                </div>
                ${bransHtml}
                ${genelDersHtml}
                <div class="mt-3">
                    <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">👥 Öğrencileri Seç:</label>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-auto border p-3 rounded-xl bg-gray-50 dark:bg-gray-900">${studentCheckboxes}</div>
                </div>
                <button id="saveDenemeAtaBtn" class="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition shadow-lg min-h-[44px]">📌 Seçilen Öğrencilere Ata</button>
            </div>
        </div>
    `;
    
    const existing = document.getElementById('denemeAtaModal');
    if (existing) existing.remove();
    const modalDiv = document.createElement('div');
    modalDiv.id = 'denemeAtaModal';
    modalDiv.innerHTML = modalHtml;
    document.body.appendChild(modalDiv);
    
    document.getElementById('tabBransBtn').addEventListener('click', () => {
        denemeAtaMode = 'branş';
        document.getElementById('bransSecim').classList.remove('hidden');
        document.getElementById('genelSecim').classList.add('hidden');
        document.getElementById('tabBransBtn').className = "flex-1 py-2 text-center font-bold border-b-2 border-blue-600 text-blue-605";
        document.getElementById('tabGenelBtn').className = "flex-1 py-2 text-center font-bold border-b-2 border-transparent text-gray-500 hover:text-gray-700";
    });
    document.getElementById('tabGenelBtn').addEventListener('click', () => {
        denemeAtaMode = 'genel';
        document.getElementById('bransSecim').classList.add('hidden');
        document.getElementById('genelSecim').classList.remove('hidden');
        document.getElementById('tabGenelBtn').className = "flex-1 py-2 text-center font-bold border-b-2 border-blue-600 text-blue-605";
        document.getElementById('tabBransBtn').className = "flex-1 py-2 text-center font-bold border-b-2 border-transparent text-gray-500 hover:text-gray-700";
    });
    document.getElementById('saveDenemeAtaBtn').addEventListener('click', () => saveDenemeAta());
}

export function closeDenemeAtaModal() {
    document.getElementById('denemeAtaModal')?.remove();
}

export function saveDenemeAta() {
    const examName = document.getElementById('denemeAtaExamName')?.value.trim();
    if (!examName) {
        alert("Deneme adı girin");
        return;
    }
    const selectedStudents = Array.from(document.querySelectorAll('.studentCheck:checked')).map(cb => cb.value);
    if (selectedStudents.length === 0) {
        alert("En az bir öğrenci seçin");
        return;
    }
    let sorular = [], tip = "";
    if (denemeAtaMode === 'branş') {
        const soruSayisi = parseInt(document.getElementById('bransSoruSayisi')?.value) || 0;
        if (soruSayisi < 1) {
            alert("En az 1 soru olmalı");
            return;
        }
        for (let i = 0; i < soruSayisi; i++) {
            sorular.push({ soruNo: i + 1, konuAdi: "", durum: "bos", hataKodu: null });
        }
        tip = "branş";
    } else {
        let dersList = [];
        for (let i = 0; i < GENEL_DERSLER_KEY.length; i++) {
            const dersKey = GENEL_DERSLER_KEY[i];
            const adet = parseInt(document.querySelector(`.genelDersInput[data-ders="${dersKey}"]`)?.value) || 0;
            if (adet > 0) dersList.push({ ders: dersKey, adet });
        }
        if (dersList.length === 0) {
            alert("En az bir ders için soru sayısı girin");
            return;
        }
        let soruNo = 1;
        for (let item of dersList) {
            for (let i = 0; i < item.adet; i++) {
                sorular.push({ soruNo: soruNo++, konuAdi: item.ders, durum: "bos", hataKodu: null });
            }
        }
        tip = "genel";
    }
    
    const newExam = {
        id: "ex_" + Date.now(),
        denemeAdi: examName,
        tarih: new Date().toISOString().slice(0, 10),
        tip: tip,
        sorular: sorular,
        toplamDogru: 0,
        toplamYanlis: 0,
        toplamBos: sorular.length,
        toplamNet: 0,
        toplamSoru: sorular.length
    };
    
    if (tip === "genel") {
        newExam.dersBilgileri = [];
        newExam.dersSonuclari = {};
        const dersMap = {};
        for (let s of sorular) dersMap[s.konuAdi] = (dersMap[s.konuAdi] || 0) + 1;
        for (let d in dersMap) {
            newExam.dersBilgileri.push({ ders: d, adet: dersMap[d] });
            newExam.dersSonuclari[d] = { dogru: 0, yanlis: 0, bos: dersMap[d] };
        }
    }
    
    const students = loadStudentsData();
    for (let sid of selectedStudents) {
        const idx = students.findIndex(s => s.id === sid);
        if (idx !== -1) {
            if (!students[idx].denemeler) students[idx].denemeler = [];
            students[idx].denemeler.push(JSON.parse(JSON.stringify(newExam)));
        }
    }
    saveStudentsData(students);
    alert(`${selectedStudents.length} öğrenciye deneme başarıyla eklendi.`);
    closeDenemeAtaModal();
    if (window.renderHomeScreen) window.renderHomeScreen();
}

export function editBransExam(studentId, examId, exam) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const konuList = getKonuListesiBySinif(student.sinif);
    
    function renderBransExamForm() {
        let rows = '';
        for (let i = 0; i < exam.sorular.length; i++) {
            const soru = exam.sorular[i];
            const durum = soru.durum || "bos";
            const hataKodu = soru.hataKodu || "";
            const konuAdi = soru.konuAdi || "";
            const showKonuHata = (durum !== "dogru");
            
            rows += `
                <div class="border rounded-xl p-3 bg-white dark:bg-gray-800 soru-duzenleme-satiri" data-soru-index="${i}">
                    <div class="font-bold mb-1 text-sm">${i + 1}. Soru</div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                        <div>
                            <label class="block text-xs font-semibold text-gray-400 mb-1">Durum</label>
                            <div class="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-650 durum-btn-group" data-index="${i}">
                                <button type="button" onclick="setQuestionStatus(${i}, 'dogru')" class="flex-grow py-2 text-xs font-bold transition-all ${durum === 'dogru' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'} durum-btn-dogru" data-index="${i}">✅ D</button>
                                <button type="button" onclick="setQuestionStatus(${i}, 'yanlis')" class="flex-grow py-2 text-xs font-bold transition-all ${durum === 'yanlis' ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'} durum-btn-yanlis" data-index="${i}">❌ Y</button>
                                <button type="button" onclick="setQuestionStatus(${i}, 'bos')" class="flex-grow py-2 text-xs font-bold transition-all ${durum === 'bos' ? 'bg-gray-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'} durum-btn-bos" data-index="${i}">⬜ B</button>
                                <input type="hidden" class="durum-select" data-index="${i}" value="${durum}">
                            </div>
                        </div>
                        <div class="hata-konu-container" ${!showKonuHata ? 'style="display:none"' : ''}>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block text-xs font-semibold text-gray-400 mb-1">Yapılamayan Konu</label>
                                    <select class="w-full border-2 rounded-xl p-1.5 konu-select min-h-[44px]" data-index="${i}">
                                        <option value="">-- Seçin --</option>
                                        ${konuList.map(k => `<option value="${k}" ${konuAdi === k ? 'selected' : ''}>${k}</option>`).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-gray-400 mb-1">Hata Kodu</label>
                                    <select class="w-full border-2 rounded-xl p-1.5 hata-select min-h-[44px]" data-index="${i}">
                                        <option value="">-- Seçin --</option>
                                        ${HATA_KODLARI.map(h => `<option value="${h.kod}" ${hataKodu === h.kod ? 'selected' : ''}>${h.kod} - ${h.aciklama}</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        const html = `
            <div>
                <button onclick="renderStudentPanel('${studentId}')" class="text-blue-600 mb-2 inline-block font-semibold">← Geri</button>
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 border">
                    <div class="flex justify-between items-center mb-3 flex-wrap gap-2">
                        <h2 class="text-xl font-bold text-gray-800 dark:text-white">Branş Deneme Düzenle - ${escapeHtml(exam.denemeAdi)}</h2>
                        <button onclick="setAllQuestionsCorrect()" class="btn-all-correct bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-405 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm min-h-[44px]"><i class="fas fa-check-double mr-1"></i> Tümünü Doğru Yap</button>
                    </div>
                    <input id="editExamName" class="student-form-input min-h-[44px] mb-3" placeholder="Deneme Adı" value="${escapeHtml(exam.denemeAdi)}">
                    <div class="mb-2 text-sm text-gray-500">Her soru için durumu, konusunu ve hata kodunu girin.</div>
                    <div class="space-y-3 md:max-h-96 md:overflow-auto mb-3">${rows}</div>
                    <div class="sticky-footer p-3.5 bg-gray-100 dark:bg-gray-700 rounded-xl flex justify-between font-bold text-sm" id="editFooter">
                        <span>📊 Toplam: ${exam.toplamSoru} soru | D:${exam.toplamDogru} Y:${exam.toplamYanlis} B:${exam.toplamBos}</span>
                        <span class="text-blue-600">Net: ${exam.toplamNet.toFixed(2)}</span>
                    </div>
                    <button onclick="saveBransExamEdit('${studentId}', '${examId}')" class="mt-4 w-full bg-blue-600 text-white py-3 rounded-xl font-bold min-h-[44px]">Güncelle</button>
                </div>
            </div>
        `;
        document.getElementById("dynamic-content").innerHTML = html;
        
        function updateEditFooter() {
            let totalDogru = 0, totalYanlis = 0, totalBos = 0;
            const soruSayisi = exam.sorular.length;
            for (let i = 0; i < soruSayisi; i++) {
                const durumSelect = document.querySelector(`.durum-select[data-index="${i}"]`);
                if (durumSelect) {
                    const durum = durumSelect.value;
                    if (durum === 'dogru') totalDogru++;
                    else if (durum === 'yanlis') totalYanlis++;
                    else totalBos++;
                } else {
                    const soru = exam.sorular[i];
                    if (soru.durum === 'dogru') totalDogru++;
                    else if (soru.durum === 'yanlis') totalYanlis++;
                    else totalBos++;
                }
            }
            const net = calculateNet(totalDogru, totalYanlis);
            const footer = document.getElementById('editFooter');
            if (footer) footer.innerHTML = `<span>📊 Toplam: ${soruSayisi} soru | D:${totalDogru} Y:${totalYanlis} B:${totalBos}</span><span class="text-blue-600">Net: ${net.toFixed(2)}</span>`;
        }
        
        document.querySelectorAll('.durum-select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const container = sel.closest('.soru-duzenleme-satiri').querySelector('.hata-konu-container');
                if (sel.value === 'dogru') {
                    container.style.display = 'none';
                    const idx = sel.getAttribute('data-index');
                    const konuSelect = document.querySelector(`.konu-select[data-index="${idx}"]`);
                    const hataSelect = document.querySelector(`.hata-select[data-index="${idx}"]`);
                    if (konuSelect) konuSelect.value = "";
                    if (hataSelect) hataSelect.value = "";
                } else {
                    container.style.display = 'block';
                }
                updateEditFooter();
            });
        });
        document.querySelectorAll('.konu-select, .hata-select').forEach(sel => {
            sel.addEventListener('change', () => updateEditFooter());
        });
        updateEditFooter();
    }
    
    window.setQuestionStatus = function (index, status) {
        const hiddenInput = document.querySelector(`.durum-select[data-index="${index}"]`);
        if (hiddenInput) {
            hiddenInput.value = status;
        }
        const group = document.querySelector(`.durum-btn-group[data-index="${index}"]`);
        if (group) {
            const btnDogru = group.querySelector('.durum-btn-dogru');
            const btnYanlis = group.querySelector('.durum-btn-yanlis');
            const btnBos = group.querySelector('.durum-btn-bos');
            btnDogru.className = `flex-grow py-2 text-xs font-bold transition-all ${status === 'dogru' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'} durum-btn-dogru`;
            btnYanlis.className = `flex-grow py-2 text-xs font-bold transition-all ${status === 'yanlis' ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'} durum-btn-yanlis`;
            btnBos.className = `flex-grow py-2 text-xs font-bold transition-all ${status === 'bos' ? 'bg-gray-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'} durum-btn-bos`;
        }
        if (hiddenInput) {
            hiddenInput.dispatchEvent(new Event('change'));
        }
    };
    
    window.setAllQuestionsCorrect = function () {
        if (confirm("Tüm soruları doğru olarak işaretlemek istediğinize emin misiniz? Mevcut konu ve hata bilgileri silinecektir.")) {
            const soruSayisi = exam.sorular.length;
            for (let i = 0; i < soruSayisi; i++) {
                setQuestionStatus(i, 'dogru');
            }
            showSyncStatus("✅ Tüm sorular doğru olarak işaretlendi", false);
        }
    };
    
    renderBransExamForm();
}

export function saveBransExamEdit(studentId, examId) {
    const examName = document.getElementById('editExamName')?.value.trim();
    if (!examName) {
        alert("Deneme adı girin");
        return;
    }
    const students = loadStudentsData();
    const sIdx = students.findIndex(s => s.id === studentId);
    if (sIdx === -1) {
        if (window.renderHomeScreen) window.renderHomeScreen();
        return;
    }
    const examIndex = students[sIdx].denemeler.findIndex(e => e.id === examId);
    if (examIndex === -1) {
        if (window.renderHomeScreen) window.renderHomeScreen();
        return;
    }
    const exam = students[sIdx].denemeler[examIndex];
    const soruSayisi = exam.sorular.length;
    let toplamDogru = 0, toplamYanlis = 0, toplamBos = 0;
    const updatedSorular = [];
    let hataEksik = false;
    
    for (let i = 0; i < soruSayisi; i++) {
        const durumSelect = document.querySelector(`.durum-select[data-index="${i}"]`);
        const konuSelect = document.querySelector(`.konu-select[data-index="${i}"]`);
        const hataSelect = document.querySelector(`.hata-select[data-index="${i}"]`);
        let durum = durumSelect ? durumSelect.value : exam.sorular[i].durum;
        let konu = "";
        let hataKodu = null;
        if (durum === 'dogru') {
            toplamDogru++;
        } else {
            if (konuSelect) konu = konuSelect.value;
            if (hataSelect) hataKodu = hataSelect.value;
            if (!konu) hataEksik = true;
            if (durum === 'yanlis') toplamYanlis++;
            else toplamBos++;
        }
        updatedSorular.push({ soruNo: i + 1, konuAdi: konu || "", durum: durum, hataKodu: hataKodu || null });
    }
    
    if (hataEksik) {
        alert("Lütfen tüm yanlış veya boş sorular için konu seçiniz!");
        return;
    }
    const net = calculateNet(toplamDogru, toplamYanlis);
    students[sIdx].denemeler[examIndex] = { ...exam, denemeAdi: examName, sorular: updatedSorular, toplamDogru, toplamYanlis, toplamBos, toplamNet: net, toplamSoru: soruSayisi };
    saveStudentsData(students);
    if (window.renderStudentPanel) window.renderStudentPanel(studentId);
}

export function editGenelExam(studentId, examId, exam) {
    let dersRows = '';
    const dersBilgileri = exam.dersBilgileri || [];
    const dersSonuclari = exam.dersSonuclari || {};
    
    for (let item of dersBilgileri) {
        const dersKey = item.ders;
        const idx = GENEL_DERSLER_KEY.indexOf(dersKey);
        const dersGorunum = idx !== -1 ? GENEL_DERSLER_GORUNUM[idx] : dersKey;
        const toplamSoru = item.adet;
        const sonuc = dersSonuclari[dersKey] || { dogru: 0, yanlis: 0, bos: toplamSoru };
        
        dersRows += `
            <div class="border rounded-xl p-3 bg-white dark:bg-gray-800">
                <div class="font-bold mb-2 text-sm">${dersGorunum}</div>
                <div class="text-xs text-gray-500 mb-2">Toplam Soru: ${toplamSoru}</div>
                <div class="grid grid-cols-3 gap-3">
                    <div>
                        <label class="block text-xs font-semibold mb-1">Doğru</label>
                        <input type="number" min="0" max="${toplamSoru}" value="${sonuc.dogru}" class="w-full border-2 rounded-xl p-2.5 focus:ring-4 focus:ring-indigo-200 outline-none genel-dogru min-h-[44px]" data-ders="${dersKey}" data-toplam="${toplamSoru}">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold mb-1">Yanlış</label>
                        <input type="number" min="0" max="${toplamSoru}" value="${sonuc.yanlis}" class="w-full border-2 rounded-xl p-2.5 focus:ring-4 focus:ring-indigo-200 outline-none genel-yanlis" data-ders="${dersKey}" data-toplam="${toplamSoru}">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold mb-1">Boş</label>
                        <input type="number" min="0" max="${toplamSoru}" value="${sonuc.bos}" class="w-full border-2 rounded-xl p-2.5 focus:ring-4 focus:ring-indigo-200 outline-none genel-bos bg-gray-50 dark:bg-gray-900/50" data-ders="${dersKey}" data-toplam="${toplamSoru}" readonly>
                    </div>
                </div>
            </div>
        `;
    }
    
    const html = `
        <div>
            <button onclick="renderStudentPanel('${studentId}')" class="text-blue-600 mb-2 inline-block font-semibold">← Geri</button>
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 border">
                <h2 class="text-xl font-bold mb-3 text-gray-800 dark:text-white">Genel Deneme Düzenle - ${escapeHtml(exam.denemeAdi)}</h2>
                <input id="editExamName" class="student-form-input min-h-[44px] mb-3" placeholder="Deneme Adı" value="${escapeHtml(exam.denemeAdi)}">
                <div class="mb-2 text-sm text-gray-500">Her ders için doğru, yanlış ve boş sayılarını girin. Boş sayısı otomatik hesaplanır.</div>
                <div class="space-y-3 md:max-h-96 md:overflow-auto mb-3">${dersRows}</div>
                <div class="sticky-footer p-3.5 bg-gray-100 dark:bg-gray-700 rounded-xl flex justify-between font-bold text-sm" id="editFooter">
                    <span>📊 Toplam: ${exam.toplamSoru} soru | D:${exam.toplamDogru} Y:${exam.toplamYanlis} B:${exam.toplamBos}</span>
                    <span class="text-blue-600">Net: ${exam.toplamNet.toFixed(2)}</span>
                </div>
                <button onclick="saveGenelExamEdit('${studentId}', '${examId}')" class="mt-4 w-full bg-blue-600 text-white py-3 rounded-xl font-bold min-h-[44px]">Güncelle</button>
            </div>
        </div>
    `;
    document.getElementById("dynamic-content").innerHTML = html;
    
    const dogruInputs = document.querySelectorAll('.genel-dogru');
    const yanlisInputs = document.querySelectorAll('.genel-yanlis');
    const bosInputs = document.querySelectorAll('.genel-bos');
    
    function updateDers(dogruInput, yanlisInput, bosInput, toplam) {
        let dogru = parseInt(dogruInput.value) || 0;
        let yanlis = parseInt(yanlisInput.value) || 0;
        if (dogru > toplam) dogru = toplam;
        if (yanlis > toplam - dogru) yanlis = toplam - dogru;
        dogruInput.value = dogru;
        yanlisInput.value = yanlis;
        bosInput.value = toplam - dogru - yanlis;
    }
    
    function updateAll() {
        let totalDogru = 0, totalYanlis = 0, totalBos = 0;
        dogruInputs.forEach((inp, idx) => {
            const toplam = parseInt(inp.getAttribute('data-toplam'));
            const yanlisInp = yanlisInputs[idx];
            const dogru = parseInt(inp.value) || 0;
            const yanlis = parseInt(yanlisInp.value) || 0;
            totalDogru += dogru;
            totalYanlis += yanlis;
            totalBos += toplam - dogru - yanlis;
        });
        const net = calculateNet(totalDogru, totalYanlis);
        const footer = document.getElementById('editFooter');
        if (footer) footer.innerHTML = `<span>📊 Toplam: ${exam.toplamSoru} soru | D:${totalDogru} Y:${totalYanlis} B:${totalBos}</span><span class="text-blue-600">Net: ${net.toFixed(2)}</span>`;
    }
    
    for (let i = 0; i < dogruInputs.length; i++) {
        const toplam = parseInt(dogruInputs[i].getAttribute('data-toplam'));
        const dogruInp = dogruInputs[i];
        const yanlisInp = yanlisInputs[i];
        const bosInp = bosInputs[i];
        
        dogruInp.addEventListener('input', () => {
            updateDers(dogruInp, yanlisInp, bosInp, toplam);
            updateAll();
        });
        yanlisInp.addEventListener('input', () => {
            updateDers(dogruInp, yanlisInp, bosInp, toplam);
            updateAll();
        });
    }
    updateAll();
}

export function saveGenelExamEdit(studentId, examId) {
    const examName = document.getElementById('editExamName')?.value.trim();
    if (!examName) {
        alert("Deneme adı girin");
        return;
    }
    const students = loadStudentsData();
    const sIdx = students.findIndex(s => s.id === studentId);
    if (sIdx === -1) {
        if (window.renderHomeScreen) window.renderHomeScreen();
        return;
    }
    const examIndex = students[sIdx].denemeler.findIndex(e => e.id === examId);
    if (examIndex === -1) {
        if (window.renderHomeScreen) window.renderHomeScreen();
        return;
    }
    const exam = students[sIdx].denemeler[examIndex];
    const dersBilgileri = exam.dersBilgileri || [];
    const dersSonuclari = {};
    let toplamDogru = 0, toplamYanlis = 0, toplamBos = 0;
    
    for (let item of dersBilgileri) {
        const dersKey = item.ders;
        const toplamSoru = item.adet;
        const dogruInput = document.querySelector(`.genel-dogru[data-ders="${dersKey}"]`);
        const yanlisInput = document.querySelector(`.genel-yanlis[data-ders="${dersKey}"]`);
        if (!dogruInput) continue;
        let dogru = parseInt(dogruInput.value) || 0;
        let yanlis = parseInt(yanlisInput.value) || 0;
        if (dogru > toplamSoru) dogru = toplamSoru;
        if (yanlis > toplamSoru - dogru) yanlis = toplamSoru - dogru;
        const bos = toplamSoru - dogru - yanlis;
        dersSonuclari[dersKey] = { dogru, yanlis, bos };
        toplamDogru += dogru;
        toplamYanlis += yanlis;
        toplamBos += bos;
    }
    const net = calculateNet(toplamDogru, toplamYanlis);
    const updatedSorular = [];
    let soruIndex = 0;
    for (let item of dersBilgileri) {
        const dersKey = item.ders;
        const sonuc = dersSonuclari[dersKey];
        const adet = item.adet;
        let dogruKalan = sonuc.dogru;
        let yanlisKalan = sonuc.yanlis;
        let bosKalan = sonuc.bos;
        for (let i = 0; i < adet; i++) {
            let durum = "";
            if (dogruKalan > 0) {
                durum = "dogru";
                dogruKalan--;
            } else if (yanlisKalan > 0) {
                durum = "yanlis";
                yanlisKalan--;
            } else {
                durum = "bos";
                bosKalan--;
            }
            updatedSorular.push({ soruNo: soruIndex + 1, konuAdi: dersKey, durum: durum, hataKodu: null });
            soruIndex++;
        }
    }
    students[sIdx].denemeler[examIndex] = { ...exam, denemeAdi: examName, sorular: updatedSorular, dersSonuclari: dersSonuclari, toplamDogru, toplamYanlis, toplamBos, toplamNet: net, toplamSoru: exam.toplamSoru };
    saveStudentsData(students);
    if (window.renderStudentPanel) window.renderStudentPanel(studentId);
}

export function editExam(studentId, examId) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const exam = student.denemeler.find(e => e.id === examId);
    if (!exam) return;
    if (exam.tip === "genel") {
        editGenelExam(studentId, examId, exam);
    } else {
        editBransExam(studentId, examId, exam);
    }
}

export function viewExam(studentId, examId) {
    const students = loadStudentsData();
    const s = students.find(s => s.id === studentId);
    if (!s) return;
    const ex = s.denemeler.find(e => e.id === examId);
    if (!ex) return;
    let detay = '<div class="space-y-1.5 max-h-80 overflow-y-auto pr-1 text-sm">';
    for (let soru of ex.sorular) {
        const durumEmoji = soru.durum === 'dogru' ? '✅' : (soru.durum === 'yanlis' ? '❌' : '⬜');
        const hataStr = soru.hataKodu ? ` (${soru.hataKodu})` : '';
        const konuStr = soru.konuAdi ? ` (${soru.konuAdi})` : '';
        detay += `<div class="border-b dark:border-gray-700 py-1.5 font-medium">${soru.soruNo}. Soru${konuStr}: ${durumEmoji} ${soru.durum}${hataStr}</div>`;
    }
    detay += '</div>';
    
    const modal = document.createElement('div');
    modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4";
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-xl border">
            <div class="flex justify-between items-center mb-3">
                <h2 class="text-xl font-bold text-gray-805 dark:text-white">Deneme Detayı</h2>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-500"><i class="fas fa-times text-xl"></i></button>
            </div>
            <div class="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl mb-4 border text-sm">
                <p class="font-bold text-base text-indigo-600 dark:text-indigo-400 mb-1">${escapeHtml(ex.denemeAdi)}</p>
                <p class="font-medium text-gray-600 dark:text-gray-300">Tarih: ${ex.tarih} | Net: <span class="font-bold text-blue-600">${ex.toplamNet}</span> | D:${ex.toplamDogru} Y:${ex.toplamYanlis} B:${ex.toplamBos}</p>
            </div>
            <h3 class="font-bold text-sm mb-2 text-gray-750 dark:text-gray-250">Soru Dağılımı</h3>
            ${detay}
            <div class="mt-4 flex gap-2">
                <button onclick="this.closest('.fixed').remove(); editExam('${studentId}','${examId}')" class="flex-grow bg-blue-650 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold transition shadow min-h-[44px]">Düzenle</button>
                <button onclick="this.closest('.fixed').remove()" class="flex-grow border py-2.5 rounded-xl font-bold min-h-[44px]">Kapat</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

export function deleteExam(studentId, examId) {
    if (confirm("Bu denemeyi silmek istediğinize emin misiniz?")) {
        let students = loadStudentsData();
        const sIdx = students.findIndex(s => s.id === studentId);
        if (sIdx !== -1) {
            students[sIdx].denemeler = students[sIdx].denemeler.filter(e => e.id !== examId);
            saveStudentsData(students);
            if (window.renderStudentPanel) window.renderStudentPanel(studentId);
        }
    }
}

export function copyExamToOthers(studentId, examId) {
    // Standard mock alerts as per original code
    alert("Kopyalama işlemi");
}

export function executeCopyExam(sourceStudentId, examId) {
    // Standard mock alerts as per original code
    alert("Kopyalandı");
}

export async function exportReport(format) {
    if (!store.currentStudentId) {
        alert("Önce bir öğrenci seçin");
        return;
    }
    const students = loadStudentsData();
    const student = students.find(s => s.id === store.currentStudentId);
    if (!student) return;
    const denemeler = student.denemeler || [];
    const bransDenemeler = denemeler.filter(d => d.tip === "branş");
    const bransSayisi = bransDenemeler.length;
    const bransOrt = getBransOrtalamaNet(student) || 0;
    const basari = getKonuBazliBasarilar(student);
    const { zayif } = getBestWorstTopics(basari);
    const hataIstat = getHataIstatistikleri(student);
    const hataList = HATA_KODLARI.map(h => ({ kod: h.kod, ad: h.aciklama, adet: hataIstat.hataSayilari[h.kod] || 0 }));
    const genelDenemeler = denemeler.filter(d => d.tip === "genel");
    const genelSayisi = genelDenemeler.length;
    const dersBazliToplam = {};
    GENEL_DERSLER_KEY.forEach(d => dersBazliToplam[d] = { dogru: 0, toplamSoru: 0 });
    for (let den of genelDenemeler) {
        if (den.dersSonuclari) {
            for (let d in den.dersSonuclari) {
                if (dersBazliToplam[d]) {
                    dersBazliToplam[d].dogru += den.dersSonuclari[d].dogru;
                    dersBazliToplam[d].toplamSoru += (den.dersSonuclari[d].dogru + den.dersSonuclari[d].yanlis + den.dersSonuclari[d].bos);
                }
            }
        }
    }
    const dersYuzdeler = [];
    for (let i = 0; i < GENEL_DERSLER_KEY.length; i++) {
        const d = GENEL_DERSLER_KEY[i];
        const t = dersBazliToplam[d].toplamSoru;
        const yuzde = t ? ((dersBazliToplam[d].dogru / t) * 100).toFixed(1) : null;
        dersYuzdeler.push({ ad: GENEL_DERSLER_GORUNUM[i], yuzde: yuzde });
    }

    const is8thGrade = String(student.sinif).trim() === "8" || (student.adSoyad && student.adSoyad.includes("(8)"));

    // 1. Weekly Schedule HTML
    const scheduleList = loadSchedule(student.id) || [];
    const gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
    let scheduleHtml = '';
    if (scheduleList.length === 0) {
        scheduleHtml = '<p style="color: gray; font-style: italic; font-size: 13px;">Ders programı planlanmamış.</p>';
    } else {
        scheduleHtml = `<table style="width:100%; border-collapse:collapse; margin-top:5px; font-size: 13px;">
            <thead>
                <tr style="background:#f3f4f6; border-bottom:1px solid #d1d5db;">
                    <th style="padding:6px; text-align:left; border:1px solid #d1d5db;">Gün</th>
                    <th style="padding:6px; text-align:left; border:1px solid #d1d5db;">Saat</th>
                    <th style="padding:6px; text-align:left; border:1px solid #d1d5db;">Ders</th>
                </tr>
            </thead>
            <tbody>`;
        const sortedSchedule = [...scheduleList].sort((a, b) => {
            const dayDiff = gunler.indexOf(a.gun) - gunler.indexOf(b.gun);
            if (dayDiff !== 0) return dayDiff;
            return a.saat.localeCompare(b.saat);
        });
        sortedSchedule.forEach(item => {
            const dersAdi = (is8thGrade && item.dersAdi === "Sosyal Bilgiler") ? "İnkılap Tarihi" : item.dersAdi;
            scheduleHtml += `<tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:6px; border:1px solid #d1d5db; font-weight:bold;">${item.gun}</td>
                <td style="padding:6px; border:1px solid #d1d5db;">${item.saat}</td>
                <td style="padding:6px; border:1px solid #d1d5db; color:#4f46e5; font-weight:bold;">${dersAdi}</td>
            </tr>`;
        });
        scheduleHtml += `</tbody></table>`;
    }

    // 2. Homework Records HTML (last 5)
    const odevlerList = getStudentOdevler(student) || [];
    let homeworkHtml = '';
    if (odevlerList.length === 0) {
        homeworkHtml = '<p style="color: gray; font-style: italic; font-size: 13px;">Atanmış ödev bulunmamaktadır.</p>';
    } else {
        homeworkHtml = `<table style="width:100%; border-collapse:collapse; margin-top:5px; font-size: 13px;">
            <thead>
                <tr style="background:#f3f4f6; border-bottom:1px solid #d1d5db;">
                    <th style="padding:6px; text-align:left; border:1px solid #d1d5db;">Ödev Konusu</th>
                    <th style="padding:6px; text-align:left; border:1px solid #d1d5db;">Bitiş</th>
                    <th style="padding:6px; text-align:left; border:1px solid #d1d5db;">Durum</th>
                </tr>
            </thead>
            <tbody>`;
        odevlerList.slice(-5).reverse().forEach(o => {
            let statusText = '';
            if (o.durum === "Tamamlandı") {
                statusText = `✅ Yapıldı (${o.dogru}D ${o.yanlis}Y)`;
            } else if (o.durum === "Süresi Geçti") {
                statusText = `❌ Yapılmadı`;
            } else {
                statusText = `⏳ Bekliyor`;
            }
            homeworkHtml += `<tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:6px; border:1px solid #d1d5db; font-weight:semibold;">${escapeHtml(o.konu)} <span style="font-size:11px; color:gray;">(${escapeHtml(o.yayin)})</span></td>
                <td style="padding:6px; border:1px solid #d1d5db; font-size:11px;">${o.bitisTarihi}</td>
                <td style="padding:6px; border:1px solid #d1d5db; font-weight:bold; font-size:11px;">${statusText}</td>
            </tr>`;
        });
        homeworkHtml += `</tbody></table>`;
    }

    // 3. Lesson Records HTML (last 5)
    const dersKayitlariList = loadDersKayitlari(student.id) || [];
    let lessonsHtml = '';
    if (dersKayitlariList.length === 0) {
        lessonsHtml = '<p style="color: gray; font-style: italic; font-size: 13px;">Ders kaydı bulunmamaktadır.</p>';
    } else {
        lessonsHtml = `<table style="width:100%; border-collapse:collapse; margin-top:5px; font-size: 13px;">
            <thead>
                <tr style="background:#f3f4f6; border-bottom:1px solid #d1d5db;">
                    <th style="padding:6px; text-align:left; border:1px solid #d1d5db;">No</th>
                    <th style="padding:6px; text-align:left; border:1px solid #d1d5db;">Tarih</th>
                    <th style="padding:6px; text-align:left; border:1px solid #d1d5db;">Konu</th>
                </tr>
            </thead>
            <tbody>`;
        dersKayitlariList.slice(-5).reverse().forEach(k => {
            lessonsHtml += `<tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:6px; border:1px solid #d1d5db;">${k.dersNo}</td>
                <td style="padding:6px; border:1px solid #d1d5db; font-size:11px;">${k.tarih}</td>
                <td style="padding:6px; border:1px solid #d1d5db; font-weight:bold; color:#0f766e;">${escapeHtml(k.konu)}</td>
            </tr>`;
        });
        lessonsHtml += `</tbody></table>`;
    }

    const reportContent = `
        <div style="font-family: Arial, sans-serif; max-width: 1100px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4f46e5; text-align: center; margin-bottom: 5px;">Canfenci Öğrenci Takip Sistemi Raporu</h1>
            <div style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid #e5e7eb; padding-bottom: 15px;">
                <h2 style="margin: 5px 0; color: #1f2937;">${escapeHtml(student.adSoyad)}</h2>
                <p style="color: #4b5563; margin: 5px 0;">🏫 ${escapeHtml(student.okul)} | 📚 ${student.sinif ? student.sinif + '. Sınıf' : 'Sınıf belirtilmemiş'} | 🎯 Hedef Net: ${student.hedefNet} | 🏫 Hedef Lise: ${escapeHtml(student.hedefLise)}</p>
            </div>
            
            <div style="display: flex; gap: 30px; margin-bottom: 20px;">
                <div style="flex: 1; background: #fafafa; padding: 15px; border-radius: 12px; border: 1px solid #e5e7eb;">
                    <h3 style="background: #0f766e; color: white; padding: 8px 12px; border-radius: 8px; margin-top: 0;">🔬 Branş Deneme Analizi</h3>
                    <p style="margin: 8px 0;"><strong>Toplam Branş Deneme Sayısı:</strong> ${bransSayisi}</p>
                    <p style="margin: 8px 0;"><strong>Ortalama Net:</strong> <span style="color:#0f766e; font-weight:bold;">${bransOrt.toFixed(2)}</span></p>
                    <h4 style="margin: 12px 0 5px 0; color: #374151; border-bottom: 1px solid #e5e7eb; pb: 3px;">📉 En Zayıf 3 Yapılamayan Konu</h4>
                    <ul style="margin: 5px 0; padding-left: 20px;">${zayif.map(z => `<li>${z.konu} (%${z.yuzde})</li>`).join('') || '<li>Veri yok</li>'}</ul>
                    <h4 style="margin: 15px 0 5px 0; color: #374151; border-bottom: 1px solid #e5e7eb; pb: 3px;">⚠️ Hata Kodu Analizi</h4>
                    <ul style="margin: 5px 0; padding-left: 20px; font-size:13px; color:#4b5563;">${hataList.map(h => `<li><strong>${h.kod}</strong> - ${h.ad}: ${h.adet} hata</li>`).join('')}</ul>
                </div>
                
                <div style="flex: 1; background: #fafafa; padding: 15px; border-radius: 12px; border: 1px solid #e5e7eb;">
                    <h3 style="background: #4f46e5; color: white; padding: 8px 12px; border-radius: 8px; margin-top: 0;">📘 Genel Deneme Analizi</h3>
                    <p style="margin: 8px 0;"><strong>Toplam Genel Deneme Sayısı:</strong> ${genelSayisi}</p>
                    <p style="margin: 8px 0;"><strong>Ortalama Net:</strong> <span style="color:#4f46e5; font-weight:bold;">${getGenelOrtalamaNet(student) || 0}</span></p>
                    <p style="margin: 8px 0;"><strong>Tahmini LGS Puanı:</strong> <span style="color:#10b981; font-weight:bold;">${lgsPuanHesapla(genelDenemeler) || '—'}</span></p>
                    <h4 style="margin: 12px 0 5px 0; color: #374151; border-bottom: 1px solid #e5e7eb; pb: 3px;">📚 Ders Bazlı Ortalama Başarı (%)</h4>
                    <ul style="margin: 5px 0; padding-left: 20px; font-size: 13px;">${dersYuzdeler.map(d => `<li><strong>${d.ad}:</strong> ${d.yuzde !== null ? d.yuzde + '%' : '—'}</li>`).join('')}</ul>
                </div>
            </div>

            <div style="display: flex; gap: 30px;">
                <div style="flex: 1; background: #fafafa; padding: 15px; border-radius: 12px; border: 1px solid #e5e7eb;">
                    <h3 style="background: #312e81; color: white; padding: 8px 12px; border-radius: 8px; margin-top: 0;">📅 Haftalık Ders Programı</h3>
                    ${scheduleHtml}
                </div>
                <div style="flex: 1; background: #fafafa; padding: 15px; border-radius: 12px; border: 1px solid #e5e7eb;">
                    <h3 style="background: #0369a1; color: white; padding: 8px 12px; border-radius: 8px; margin-top: 0;">📝 Son Ödevler ve Yapılan Dersler</h3>
                    <h4 style="margin: 5px 0; color: #374151;">📖 Son Dersler</h4>
                    ${lessonsHtml}
                    <h4 style="margin: 15px 0 5px 0; color: #374151;">⏳ Son Atanan Ödevler</h4>
                    ${homeworkHtml}
                </div>
            </div>
            
            <hr style="margin: 30px 0 15px 0; border: 0; border-top: 1px solid #e5e7eb;">
            <p style="text-align: center; font-size: 12px; color: #9ca3af; margin: 0;">Rapor Tarihi: ${new Date().toLocaleDateString()} - Canfenci Öğrenci Takip Sistemi</p>
        </div>
    `;
    if (format === 'pdf') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`<html><head><title>${student.adSoyad} - Deneme Raporu</title><style>body { font-family: Arial; margin: 20px; }</style></head><body>${reportContent}</body></html>`);
            printWindow.document.close();
            printWindow.print();
        } else {
            alert("Açılır pencere engellendi! Lütfen izin verin.");
        }
    } else if (format === 'word') {
        try {
            const blob = new Blob([reportContent], { type: 'application/msword' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${student.adSoyad}_rapor.doc`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            alert("Word raporu oluşturulamadı: " + err.message);
        }
    }
}

// Global window mappings for compatibility
window.showDenemeAtaModal = showDenemeAtaModal;
window.renderDenemeAtaModal = renderDenemeAtaModal;
window.closeDenemeAtaModal = closeDenemeAtaModal;
window.saveDenemeAta = saveDenemeAta;
window.editExam = editExam;
window.viewExam = viewExam;
window.deleteExam = deleteExam;
window.copyExamToOthers = copyExamToOthers;
window.executeCopyExam = executeCopyExam;
window.exportReport = exportReport;
window.lgsPuanHesapla = lgsPuanHesapla;
window.getBransOrtalamaNet = getBransOrtalamaNet;
window.getGenelOrtalamaNet = getGenelOrtalamaNet;
window.getOrtalamaNet = getOrtalamaNet;
window.getKonuBazliBasarilar = getKonuBazliBasarilar;
window.getBestWorstTopics = getBestWorstTopics;
window.getMotivationMessage = getMotivationMessage;
window.getHataIstatistikleri = getHataIstatistikleri;

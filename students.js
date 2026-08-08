// ==================== STUDENTS MANAGEMENT MODULE ====================

import { db, auth, isFirebaseActive } from './firebase-config.js';
import { store, loadStudentsData, saveStudentsData, getStudentOdevler, getKonuListesiBySinif, escapeHtml, POPULER_LISELER, HATA_KODLARI, getErrorColor, GENEL_DERSLER_KEY, GENEL_DERSLER_GORUNUM } from './store.js';
import { showSyncStatus } from './ui-helpers.js';
import { updateMobileNavActive } from './auth.js';
import { getBransOrtalamaNet, getGenelOrtalamaNet, getOrtalamaNet, getKonuBazliBasarilar, getBestWorstTopics, getMotivationMessage, getHataIstatistikleri, lgsPuanHesapla } from './exams.js';

export function onTargetSchoolChanged(selectEl, netInputId, customAreaId) {
    const customArea = document.getElementById(customAreaId);
    const netInput = document.getElementById(netInputId);
    if (selectEl.value === "Diger") {
        if (customArea) customArea.style.display = 'block';
        if (netInput) {
            netInput.value = "";
            netInput.removeAttribute('readonly');
        }
    } else {
        if (customArea) customArea.style.display = 'none';
        const selectedOption = selectEl.options[selectEl.selectedIndex];
        const net = selectedOption.getAttribute('data-net');
        if (netInput) {
            netInput.value = net;
            netInput.setAttribute('readonly', 'true');
        }
    }
}

export function renderHomeScreen() {
    store.currentPage = "home";
    if (window.currentPage) window.currentPage = "home";
    updateMobileNavActive('mobile-nav-home');
    const students = loadStudentsData();
    let filtered = students;
    if (store.activeFilter !== "all") {
        filtered = students.filter(s => s.sinif === store.activeFilter);
    }
    const sorted = getSortedStudents(filtered, store.currentSortOrder);
    
    const filterHtml = `
        <div class="flex gap-2 mb-4 flex-wrap">
            <button onclick="setFilter('all')" class="px-4 py-2.5 rounded-full text-sm font-bold border transition ${store.activeFilter === 'all' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}">Tümü</button>
            <button onclick="setFilter('5')" class="px-4 py-2.5 rounded-full text-sm font-bold border transition ${store.activeFilter === '5' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}">5. Sınıf</button>
            <button onclick="setFilter('6')" class="px-4 py-2.5 rounded-full text-sm font-bold border transition ${store.activeFilter === '6' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}">6. Sınıf</button>
            <button onclick="setFilter('7')" class="px-4 py-2.5 rounded-full text-sm font-bold border transition ${store.activeFilter === '7' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}">7. Sınıf</button>
            <button onclick="setFilter('8')" class="px-4 py-2.5 rounded-full text-sm font-bold border transition ${store.activeFilter === '8' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}">8. Sınıf</button>
        </div>
    `;
    
    const sortHtml = `
        <div class="flex gap-2 mb-4 flex-wrap">
            <button onclick="setSortOrder('default')" class="px-4 py-2.5 rounded-full text-sm font-bold border transition ${store.currentSortOrder === 'default' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}">Varsayılan</button>
            <button onclick="setSortOrder('net-desc')" class="px-4 py-2.5 rounded-full text-sm font-bold border transition ${store.currentSortOrder === 'net-desc' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}">Ort.Net (Yüksek↓)</button>
            <button onclick="setSortOrder('net-asc')" class="px-4 py-2.5 rounded-full text-sm font-bold border transition ${store.currentSortOrder === 'net-asc' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}">Ort.Net (Düşük↑)</button>
        </div>
    `;
    
    const studentsHtml = sorted.length === 0 
        ? '<div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 text-center text-gray-500">Kayıtlı öğrenci bulunmuyor.</div>' 
        : sorted.map(s => {
            const son = s.denemeler?.length ? s.denemeler[s.denemeler.length - 1].toplamNet : null;
            const bransOrt = getBransOrtalamaNet(s);
            const genelOrt = getGenelOrtalamaNet(s);
            const sinifGoster = s.sinif ? `${s.sinif}. Sınıf` : "Sınıf belirtilmemiş";
            
            return `
                <div onclick="selectStudent('${s.id}')" class="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-5 relative cursor-pointer hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
                    <div class="pr-16">
                        <h3 class="text-xl font-bold">${escapeHtml(s.adSoyad)}</h3>
                        <p class="text-base text-gray-600 dark:text-gray-300">${escapeHtml(s.okul)} | ${sinifGoster}</p>
                        <p class="text-blue-600 dark:text-blue-400 font-semibold text-base">🎯 ${s.hedefNet} Net Hedefi</p>
                        <div class="flex flex-wrap gap-2 mt-2">
                            ${bransOrt !== null ? `<span class="stat-badge text-base">🔬 Branş Ort: ${bransOrt}</span>` : ''}
                            ${genelOrt !== null ? `<span class="stat-badge text-base">📘 Genel Ort: ${genelOrt}</span>` : ''}
                            ${son !== null ? `<span class="stat-badge text-base">📈 Son Net: ${son}</span>` : ''}
                        </div>
                    </div>
                    <div class="absolute top-2 right-2 flex gap-1">
                        <button onclick="event.stopPropagation(); editStudent('${s.id}')" class="text-blue-500 hover:text-blue-700 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center" title="Düzenle">✏️</button>
                        <button onclick="event.stopPropagation(); deleteStudent('${s.id}')" class="text-red-500 hover:text-red-700 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center" title="Sil">🗑️</button>
                    </div>
                    <div class="text-sm text-gray-400 dark:text-gray-550 mt-3">📌 ${s.denemeler?.length || 0} deneme</div>
                </div>
            `;
        }).join('');
        
    const shortcutsHtml = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md border border-gray-100/20 dark:border-gray-700/50 mb-4">
            <h3 class="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <i class="fas fa-bolt text-amber-500 animate-pulse"></i> Hızlı İşlemler
            </h3>
            <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                <button onclick="showAddStudentModal()" class="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold transition text-sm whitespace-nowrap min-h-[44px]">
                    <i class="fas fa-user-plus text-base"></i> Yeni Öğrenci Ekle
                </button>
                <button onclick="showDenemeAtaModal()" class="flex items-center gap-2 px-4 py-2 bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-xl font-bold transition text-sm whitespace-nowrap min-h-[44px]">
                    <i class="fas fa-copy text-base"></i> Toplu Deneme Ata
                </button>
            </div>
        </div>
    `;
    
    document.getElementById("dynamic-content").innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow mb-4">
            <h2 class="page-heading text-2xl font-bold text-gray-805 dark:text-white">📋 Öğrenci Listesi</h2>
            <p class="text-sm text-gray-500">Toplam ${sorted.length} öğrenci (${store.activeFilter === 'all' ? 'Tümü' : store.activeFilter + '. sınıf'})</p>
        </div>
        ${shortcutsHtml}
        ${filterHtml}
        ${sortHtml}
        <div class="grid md:grid-cols-2 gap-5">${studentsHtml}</div>
    `;
}

export function getSortedStudents(students, order) {
    if (order === 'default') return [...students];
    const withAvg = students.map(s => ({ ...s, ortalamaNet: getOrtalamaNet(s) }));
    if (order === 'net-desc') return withAvg.sort((a, b) => b.ortalamaNet - a.ortalamaNet);
    if (order === 'net-asc') return withAvg.sort((a, b) => a.ortalamaNet - b.ortalamaNet);
    return students;
}

export function setSortOrder(order) {
    store.currentSortOrder = order;
    renderHomeScreen();
}

export function setFilter(sinif) {
    store.activeFilter = sinif;
    renderHomeScreen();
}

export async function deleteStudent(id) {
    if (confirm("Öğrenciyi tamamen silmek istediğinize emin misiniz?")) {
        if (store.useFirestore && window.isFirebaseActive && window.db) {
            const user = window.auth?.currentUser;
            if (!user) {
                alert("Silme işlemi için yeniden giriş yapmanız gerekiyor.");
                return;
            }

            try {
                if (window.showSyncStatus) window.showSyncStatus("Öğrenci ve bağlı kayıtlar siliniyor...", false);
                const batch = window.db.batch();
                batch.delete(window.db.collection("students").doc(id));
                batch.delete(window.db.collection("schedules").doc(id));
                batch.delete(window.db.collection("lessons").doc(id));

                const homeworkSnapshot = await window.db.collection("homeworks")
                    .where("userId", "==", user.uid)
                    .where("studentId", "==", id)
                    .get();
                homeworkSnapshot.forEach(doc => batch.delete(doc.ref));

                const affectedGroups = (store.globalGroups || []).filter(group =>
                    Array.isArray(group.studentIds) && group.studentIds.includes(id)
                );
                affectedGroups.forEach(group => {
                    batch.update(window.db.collection("groups").doc(group.id), {
                        studentIds: group.studentIds.filter(studentId => studentId !== id)
                    });
                });

                await batch.commit();
                store.globalStudents = store.globalStudents.filter(student => student.id !== id);
                store.globalHomeworks = store.globalHomeworks.filter(homework => homework.studentId !== id);
                delete store.globalSchedules[id];
                delete store.globalLessons[id];
                store.globalGroups = store.globalGroups.map(group => ({
                    ...group,
                    studentIds: Array.isArray(group.studentIds)
                        ? group.studentIds.filter(studentId => studentId !== id)
                        : group.studentIds
                }));
                if (window.showSyncStatus) window.showSyncStatus("✅ Öğrenci ve bağlı kayıtlar silindi", false);
                renderHomeScreen();
            } catch (err) {
                console.error("deleteStudent error", err);
                if (window.handleFirebaseError) window.handleFirebaseError(err);
                else alert("Öğrenci silinemedi: " + err.message);
            }
            return;
        }

        const students = loadStudentsData().filter(s => s.id !== id);
        await saveStudentsData(students);
        renderHomeScreen();
    }
}

export function editStudent(id) {
    const s = loadStudentsData().find(s => s.id === id);
    if (!s) return;
    const sinifOptions = ['5', '6', '7', '8'].map(sinif => `<option value="${sinif}" ${s.sinif === sinif ? 'selected' : ''}>${sinif}. Sınıf</option>`).join('');
    const isPopular = POPULER_LISELER.some(l => l.ad === s.hedefLise);
    const selectedSchoolVal = isPopular ? s.hedefLise : (s.hedefLise ? "Diger" : "");
    const customSchoolStyle = isPopular || !s.hedefLise ? "display:none" : "display:block";
    
    const schoolDropdownOptions = POPULER_LISELER.map(l => `<option value="${l.ad}" data-net="${l.net}" ${s.hedefLise === l.ad ? 'selected' : ''}>${l.ad} (Taban: ${l.tabanPuan}, Net: ${l.net})</option>`).join('');
    
    const modal = document.createElement('div');
    modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4";
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-xl border">
            <h2 class="text-xl font-bold mb-4">✏️ Öğrenci Düzenle</h2>
            <div class="space-y-3">
                <div>
                    <label class="block text-xs font-semibold mb-1">Ad Soyad</label>
                    <input id="editName" class="student-form-input min-h-[44px]" value="${escapeHtml(s.adSoyad)}" placeholder="Ad Soyad" required>
                </div>
                <div>
                    <label class="block text-xs font-semibold mb-1">Okul</label>
                    <input id="editSchool" class="student-form-input min-h-[44px]" value="${escapeHtml(s.okul)}" placeholder="Okul" required>
                </div>
                <div>
                    <label class="block text-xs font-semibold mb-1">Sınıf</label>
                    <select id="editSinif" class="student-form-input min-h-[44px]" required>
                        <option value="" disabled>Sınıf Seçin (zorunlu)</option>
                        ${sinifOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-semibold mb-1">Hedef Lise</label>
                    <select id="editTargetSchool" class="student-form-input min-h-[44px]" onchange="onTargetSchoolChanged(this, 'editTargetNet', 'editCustomSchoolArea')" required>
                        <option value="" disabled ${!selectedSchoolVal ? 'selected' : ''}>Hedef Lise Seçin</option>
                        ${schoolDropdownOptions}
                        <option value="Diger" ${selectedSchoolVal === 'Diger' ? 'selected' : ''}>Diğer (Kendim Gireceğim)</option>
                    </select>
                </div>
                <div id="editCustomSchoolArea" style="${customSchoolStyle}">
                    <input type="text" id="editCustomSchool" placeholder="Hedef Lise Adı" class="student-form-input mt-1 min-h-[44px]" value="${!isPopular ? escapeHtml(s.hedefLise) : ''}">
                </div>
                <div>
                    <label class="block text-xs font-semibold mb-1">Hedef Net</label>
                    <input id="editTargetNet" class="student-form-input min-h-[44px]" value="${s.hedefNet}" placeholder="Hedef Net" ${isPopular ? 'readonly' : ''} required>
                </div>
                <div>
                    <label class="block text-xs font-semibold mb-1">Aylık Ücret (TL)</label>
                    <input id="editUcret" class="student-form-input min-h-[44px]" placeholder="Aylık Ücret (TL)" value="${escapeHtml(s.aylikUcret || s.ucret || '')}">
                </div>
                <div>
                    <label class="block text-xs font-semibold mb-1">Veli Telefonu</label>
                    <input id="editVeliTel" class="student-form-input min-h-[44px]" placeholder="Veli Telefonu" value="${escapeHtml(s.veliTel || '')}">
                </div>
                <button onclick="saveStudentEdit('${id}')" class="bg-blue-600 hover:bg-blue-700 text-white w-full py-2.5 rounded-xl font-bold mt-2 min-h-[44px]">Kaydet</button>
                <button onclick="this.closest('.fixed').remove()" class="w-full border border-gray-300 dark:border-gray-600 py-2.5 rounded-xl mt-2 min-h-[44px]">İptal</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

export function saveStudentEdit(id) {
    const name = document.getElementById('editName')?.value.trim();
    const school = document.getElementById('editSchool')?.value.trim();
    const sinif = document.getElementById('editSinif')?.value;
    let target = document.getElementById('editTargetSchool')?.value;
    if (target === "Diger") {
        target = document.getElementById('editCustomSchool')?.value.trim();
    }
    const net = document.getElementById('editTargetNet')?.value.trim();
    const ucret = document.getElementById('editUcret')?.value.trim();
    const veliTel = document.getElementById('editVeliTel')?.value.trim();
    if (!name || !school || !sinif || !target || !net) {
        alert("Ad, Okul, Sınıf, Hedef Lise ve Hedef Net alanları zorunludur");
        return;
    }
    const students = loadStudentsData();
    const sIdx = students.findIndex(s => s.id === id);
    if (sIdx !== -1) {
        students[sIdx].adSoyad = name;
        students[sIdx].okul = school;
        students[sIdx].sinif = sinif;
        students[sIdx].hedefLise = target;
        students[sIdx].hedefNet = net;
        students[sIdx].aylikUcret = ucret || "";
        students[sIdx].ucret = ucret || "";
        students[sIdx].veliTel = veliTel || "";
        saveStudentsData(students);
        document.querySelector('.fixed')?.remove();
        renderHomeScreen();
    }
}

export function showAddStudentModal() {
    const sinifOptions = ['5', '6', '7', '8'].map(sinif => `<option value="${sinif}">${sinif}. Sınıf</option>`).join('');
    const schoolDropdownOptions = POPULER_LISELER.map(l => `<option value="${l.ad}" data-net="${l.net}">${l.ad} (Taban: ${l.tabanPuan}, Net: ${l.net})</option>`).join('');
    
    const modalHtml = `
        <div id="addStudentModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this) closeAddStudentModal()">
            <div class="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl border" onclick="event.stopPropagation()">
                <h2 class="text-xl font-bold mb-4">➕ Yeni Öğrenci Ekle</h2>
                <div class="space-y-3">
                    <div>
                        <label class="block text-xs font-semibold mb-1">Ad Soyad</label>
                        <input type="text" id="newName" placeholder="Ad Soyad" class="student-form-input min-h-[44px]" required>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold mb-1">Okul</label>
                        <input type="text" id="newSchool" placeholder="Okul" class="student-form-input min-h-[44px]" required>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold mb-1">Sınıf</label>
                        <select id="newSinif" class="student-form-input min-h-[44px]" required>
                            <option value="" disabled selected>Sınıf Seçin (zorunlu)</option>
                            ${sinifOptions}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold mb-1">Hedef Lise</label>
                        <select id="newTargetSchool" class="student-form-input min-h-[44px]" onchange="onTargetSchoolChanged(this, 'newTargetNet', 'newCustomSchoolArea')" required>
                            <option value="" disabled selected>Hedef Lise Seçin (zorunlu)</option>
                            ${schoolDropdownOptions}
                            <option value="Diger">Diğer (Kendim Gireceğim)</option>
                        </select>
                    </div>
                    <div id="newCustomSchoolArea" style="display:none">
                        <input type="text" id="newCustomSchool" placeholder="Hedef Lise Adı" class="student-form-input mt-1 min-h-[44px]">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold mb-1">Hedef Net</label>
                        <input type="text" id="newTargetNet" placeholder="Hedef Net" class="student-form-input min-h-[44px]" required>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold mb-1">Aylık Ücret (TL)</label>
                        <input type="text" id="newUcret" placeholder="Aylık Ücret (TL)" class="student-form-input min-h-[44px]">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold mb-1">Veli Telefonu</label>
                        <input type="text" id="newVeliTel" placeholder="Veli Telefonu" class="student-form-input min-h-[44px]">
                    </div>
                    <button onclick="addStudentFromModal()" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold mt-2 min-h-[44px]">Kaydet</button>
                    <button onclick="closeAddStudentModal()" class="w-full border border-gray-300 dark:border-gray-600 py-2.5 rounded-xl min-h-[44px]">İptal</button>
                </div>
            </div>
        </div>
    `;
    const existing = document.getElementById('addStudentModal');
    if (existing) existing.remove();
    const modalDiv = document.createElement('div');
    modalDiv.id = 'addStudentModal';
    modalDiv.innerHTML = modalHtml;
    document.body.appendChild(modalDiv);
}

export function closeAddStudentModal() {
    document.getElementById('addStudentModal')?.remove();
}

export function addStudentFromModal() {
    const name = document.getElementById('newName')?.value.trim();
    const school = document.getElementById('newSchool')?.value.trim();
    const sinif = document.getElementById('newSinif')?.value;
    let target = document.getElementById('newTargetSchool')?.value;
    if (target === "Diger") {
        target = document.getElementById('newCustomSchool')?.value.trim();
    }
    const net = document.getElementById('newTargetNet')?.value.trim();
    const ucret = document.getElementById('newUcret')?.value.trim();
    const veliTel = document.getElementById('newVeliTel')?.value.trim();
    if (!name || !school || !sinif || !target || !net) {
        alert("Ad, Okul, Sınıf, Hedef Lise ve Hedef Net alanları zorunludur");
        return;
    }
    const students = loadStudentsData();
    students.push({
        id: "std" + Date.now(),
        adSoyad: name,
        sinif: sinif,
        okul: school,
        hedefLise: target,
        hedefNet: net,
        aylikUcret: ucret || "",
        ucret: ucret || "",
        veliTel: veliTel || "",
        denemeler: [],
        studyPlan: {},
        errorResets: {},
        growthPlan: {}
    });
    saveStudentsData(students);
    closeAddStudentModal();
    renderHomeScreen();
}

export function toggleReportMenu() {
    const menu = document.getElementById('reportMenu');
    if (menu) menu.classList.toggle('hidden');
}

export function hideReportMenu() {
    const menu = document.getElementById('reportMenu');
    if (menu) menu.classList.add('hidden');
}

export function switchStudentTab(tabName) {
    const genelBtn = document.getElementById('tabStudentGenelBtn');
    const bransBtn = document.getElementById('tabStudentBransBtn');
    const calismaBtn = document.getElementById('tabStudentCalismaBtn');
    const genelContent = document.getElementById('studentGenelTabContent');
    const bransContent = document.getElementById('studentBransTabContent');
    const calismaContent = document.getElementById('studentCalismaTabContent');
    
    const activeClass = "flex-1 py-2.5 text-center font-bold border-b-2 border-blue-650 text-blue-650 transition-all duration-200 text-sm sm:text-base";
    const inactiveClass = "flex-1 py-2.5 text-center font-bold border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-all duration-200 text-sm sm:text-base";
    
    if (tabName === 'genel') {
        if (genelBtn) genelBtn.className = activeClass;
        if (bransBtn) bransBtn.className = inactiveClass;
        if (calismaBtn) calismaBtn.className = inactiveClass;
        if (genelContent) genelContent.classList.remove('hidden');
        if (bransContent) bransContent.classList.add('hidden');
        if (calismaContent) calismaContent.classList.add('hidden');
    } else if (tabName === 'brans') {
        if (genelBtn) genelBtn.className = inactiveClass;
        if (bransBtn) bransBtn.className = activeClass;
        if (calismaBtn) calismaBtn.className = inactiveClass;
        if (genelContent) genelContent.classList.add('hidden');
        if (bransContent) bransContent.classList.remove('hidden');
        if (calismaContent) calismaContent.classList.add('hidden');
    } else if (tabName === 'calisma') {
        if (genelBtn) genelBtn.className = inactiveClass;
        if (bransBtn) bransBtn.className = inactiveClass;
        if (calismaBtn) calismaBtn.className = activeClass;
        if (genelContent) genelContent.classList.add('hidden');
        if (bransContent) bransContent.classList.add('hidden');
        if (calismaContent) calismaContent.classList.remove('hidden');
    }
}

// Backup & Recovery
export function exportBackup() {
    try {
        const data = loadStudentsData();
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "canfenci_yedek.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSyncStatus("✅ Yedek başarıyla alındı", false);
    } catch (err) {
        console.error("Yedek hatası:", err);
        alert("Yedek alınamadı: " + err.message);
    }
}

export function showImportModal() {
    const modal = document.createElement('div');
    modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4";
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-xl border">
            <h2 class="text-xl font-bold mb-2">📂 Manuel Geri Yükle</h2>
            <p class="text-xs text-gray-500 mb-3">Lütfen daha önce indirdiğiniz JSON yedek dosyasını seçiniz.</p>
            <input type="file" id="restoreFile" accept=".json" class="w-full border p-2.5 rounded my-2 min-h-[44px]">
            <button onclick="importBackup()" class="bg-blue-600 hover:bg-blue-700 text-white w-full py-2.5 rounded-xl font-bold min-h-[44px] mt-2">Yükle</button>
            <button onclick="this.closest('.fixed').remove()" class="mt-2 w-full border rounded-xl py-2.5 min-h-[44px]">İptal</button>
        </div>
    `;
    document.body.appendChild(modal);
}

export function importBackup() {
    const file = document.getElementById('restoreFile').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data)) {
                const normalized = data.map(s => {
                    return {
                        id: s.id || "std" + Date.now() + Math.floor(Math.random() * 100),
                        adSoyad: s.adSoyad || "",
                        okul: s.okul || "",
                        sinif: s.sinif || "8",
                        veliTel: s.veliTel || "",
                        aylikUcret: s.aylikUcret || s.ucret || 0,
                        ucret: s.aylikUcret || s.ucret || 0,
                        hedefLise: s.hedefLise || "",
                        hedefNet: s.hedefNet || 0,
                        denemeler: s.denemeler || [],
                        studyPlan: s.studyPlan || {},
                        errorResets: s.errorResets || {},
                        growthPlan: s.growthPlan || {}
                    };
                });
                saveStudentsData(normalized);
                alert("Veriler başarıyla içe aktarıldı ve yüklendi!");
                document.querySelector('.fixed')?.remove();
                renderHomeScreen();
            } else {
                alert("Geçersiz yedek dosyası formatı!");
            }
        } catch (err) {
            alert("Dosya okuma veya ayrıştırma hatası: " + err.message);
        }
    };
    reader.readAsText(file);
}

export async function renderStudentPanel(id) {
    try {
        store.currentPage = "student";
        if (window.currentPage) window.currentPage = "student";
        updateMobileNavActive('mobile-nav-home');
        const students = loadStudentsData();
        const student = students.find(s => s.id === id);
        if (!student) {
            renderHomeScreen();
            return;
        }
        store.currentStudentId = id;
        
        const denemeler = student.denemeler || [];
        const bransDenemeler = denemeler.filter(d => d.tip === "branş");
        const genelDenemeler = denemeler.filter(d => d.tip === "genel");
        const konuList = getKonuListesiBySinif(student.sinif);
        const hataKonulari = {};
        konuList.forEach(k => hataKonulari[k] = 0);
        let toplamHataSoru = 0;
        
        for (let den of bransDenemeler) {
            for (let soru of den.sorular) {
                if (soru.durum !== "dogru" && soru.konuAdi && konuList.includes(soru.konuAdi)) {
                    hataKonulari[soru.konuAdi]++;
                    toplamHataSoru++;
                }
            }
        }
        const enCokHataYapilan = Object.entries(hataKonulari)
            .filter(([_, a]) => a > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
            
        const { hataSayilari, toplamHata } = getHataIstatistikleri(student);
        const genelOrtalamaNet = genelDenemeler.length 
            ? (genelDenemeler.reduce((sum, d) => sum + d.toplamNet, 0) / genelDenemeler.length).toFixed(2) 
            : 0;
        const lgsPuan = lgsPuanHesapla(genelDenemeler);
        
        const matchedSchool = POPULER_LISELER.find(l => l.ad === student.hedefLise);
        const targetPuan = matchedSchool ? matchedSchool.tabanPuan : Math.round(100 + (parseFloat(student.hedefNet) * 4.44) || 0);
        const matchPercent = targetPuan > 0 && lgsPuan !== null ? Math.min(100, Math.round((lgsPuan / targetPuan) * 100)) : 0;
        
        let targetMatchBadgeClass = "bg-gray-100 text-gray-805 dark:bg-gray-700/50 dark:text-gray-300 border-gray-200";
        let targetMatchBadgeText = "LGS hedef analizi için en az bir Genel Deneme girilmelidir.";
        if (lgsPuan !== null && targetPuan > 0) {
            if (lgsPuan >= targetPuan) {
                targetMatchBadgeClass = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200";
                targetMatchBadgeText = "🎉 Tebrikler, mevcut tahmin puanınız hedef puanın üzerinde!";
            } else if (targetPuan - lgsPuan <= 15) {
                targetMatchBadgeClass = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-450 border-yellow-200 animate-pulse";
                targetMatchBadgeText = `🚀 Hedefe çok yakınsın! Küçük bir gayret daha... (Hedef için son ${targetPuan - lgsPuan} puan)`;
            } else {
                targetMatchBadgeClass = "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border-red-200";
                targetMatchBadgeText = `📈 Çalışmaya devam! Hedefe ulaşmak için +${targetPuan - lgsPuan} puan daha gerekiyor.`;
            }
        }
        
        const dersBazliNetler = {};
        GENEL_DERSLER_KEY.forEach(d => dersBazliNetler[d] = { dogru: 0, yanlis: 0, bos: 0, toplamSoru: 0 });
        for (let den of genelDenemeler) {
            if (den.dersSonuclari) {
                for (let d in den.dersSonuclari) {
                    if (dersBazliNetler[d]) {
                        const s = den.dersSonuclari[d];
                        dersBazliNetler[d].dogru += s.dogru;
                        dersBazliNetler[d].yanlis += s.yanlis;
                        dersBazliNetler[d].bos += s.bos;
                        dersBazliNetler[d].toplamSoru += s.dogru + s.yanlis + s.bos;
                    }
                }
            }
        }
        
        const dersBazliYuzdeler = {};
        for (let i = 0; i < GENEL_DERSLER_KEY.length; i++) {
            const d = GENEL_DERSLER_KEY[i];
            const t = dersBazliNetler[d].toplamSoru;
            dersBazliYuzdeler[d] = t ? ((dersBazliNetler[d].dogru / t) * 100).toFixed(1) : null;
        }
        
        const genelSorted = [...genelDenemeler].sort((a, b) => new Date(a.tarih) - new Date(b.tarih));
        const netChartData = genelSorted.map(e => e.toplamNet);
        const netChartLabels = genelSorted.map(e => e.denemeAdi);
        const motivasyon = getMotivationMessage(student);
        const hedefSayi = parseFloat(student.hedefNet);
        const hedefGecerli = !isNaN(hedefSayi);
        
        const aylikUcretDegeri = student.aylikUcret || student.ucret || '';
        const veliTelDegeri = student.veliTel || '';
        const ekstraBilgiHtml = (aylikUcretDegeri || veliTelDegeri) 
            ? `<div class="flex flex-wrap gap-3 mt-2 text-sm">${aylikUcretDegeri ? `<span class="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full"><i class="fas fa-money-bill-wave"></i> Aylık Ücret: ${escapeHtml(aylikUcretDegeri)} TL</span>` : ''}${veliTelDegeri ? `<span class="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full"><i class="fas fa-phone-alt"></i> Veli: ${escapeHtml(veliTelDegeri)}</span>` : ''}</div>` 
            : '';
            
        const genelExamsHtml = genelDenemeler.length === 0 
            ? '<p class="text-center text-gray-500 py-3">Henüz genel deneme yok.</p>' 
            : genelDenemeler.slice().reverse().map(ex => `
                <div class="border rounded-xl p-3 flex justify-between flex-wrap mb-2 last:mb-0 bg-white dark:bg-gray-800">
                    <div>
                        <span class="font-bold text-gray-805 dark:text-white">${escapeHtml(ex.denemeAdi)}</span> 
                        <span class="text-xs text-gray-400">${ex.tarih}</span> 
                        <span class="text-xs exam-badge bg-blue-50 text-blue-600 dark:bg-gray-600 dark:text-white px-1.5 py-0.5 rounded">📘 Genel</span><br>
                        <span class="text-sm">Net: <strong class="text-blue-600">${ex.toplamNet}</strong> (${ex.toplamDogru}D ${ex.toplamYanlis}Y ${ex.toplamBos}B)</span>
                    </div>
                    <div class="flex gap-2 items-center">
                        <button onclick="viewExam('${id}','${ex.id}')" class="text-blue-500 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center"><i class="fas fa-eye"></i></button>
                        <button onclick="editExam('${id}','${ex.id}')" class="text-green-500 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center"><i class="fas fa-edit"></i></button>
                        <button onclick="copyExamToOthers('${id}','${ex.id}')" class="text-purple-500 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center"><i class="fas fa-copy"></i></button>
                        <button onclick="deleteExam('${id}','${ex.id}')" class="text-red-500 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `).join('');
            
        const bransExamsHtml = bransDenemeler.length === 0 
            ? '<p class="text-center text-gray-500 py-3">Henüz branş denemesi yok.</p>' 
            : bransDenemeler.slice().reverse().map(ex => `
                <div class="border rounded-xl p-3 flex justify-between flex-wrap mb-2 last:mb-0 bg-white dark:bg-gray-800">
                    <div>
                        <span class="font-bold text-gray-805 dark:text-white">${escapeHtml(ex.denemeAdi)}</span> 
                        <span class="text-xs text-gray-400">${ex.tarih}</span> 
                        <span class="text-xs exam-badge bg-emerald-50 text-emerald-600 dark:bg-gray-600 dark:text-white px-1.5 py-0.5 rounded">🔬 Branş</span><br>
                        <span class="text-sm">Net: <strong class="text-blue-600">${ex.toplamNet}</strong> (${ex.toplamDogru}D ${ex.toplamYanlis}Y ${ex.toplamBos}B)</span>
                    </div>
                    <div class="flex gap-2 items-center">
                        <button onclick="viewExam('${id}','${ex.id}')" class="text-blue-500 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center"><i class="fas fa-eye"></i></button>
                        <button onclick="editExam('${id}','${ex.id}')" class="text-green-500 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center"><i class="fas fa-edit"></i></button>
                        <button onclick="copyExamToOthers('${id}','${ex.id}')" class="text-purple-500 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center"><i class="fas fa-copy"></i></button>
                        <button onclick="deleteExam('${id}','${ex.id}')" class="text-red-500 p-2 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `).join('');
            
        // 1. Tavsiye Edilen Ders Çalışma Programı
        const adviceList = [];
        for (let i = 0; i < GENEL_DERSLER_KEY.length; i++) {
            const d = GENEL_DERSLER_KEY[i];
            const name = GENEL_DERSLER_GORUNUM[i];
            const pct = dersBazliYuzdeler[d];
            if (pct === null || pct === undefined) {
                adviceList.push(`
                    <div class="border-b dark:border-gray-700 pb-1.5 mb-1.5 last:border-b-0 text-sm">
                        <span class="font-bold text-gray-700 dark:text-gray-300">${name}:</span> <span class="text-gray-500">Veri yok. Haftalık 2-3 saat çalışma önerilir.</span>
                    </div>
                `);
            } else {
                const successVal = parseFloat(pct);
                let adviceText = '';
                if (successVal < 50) {
                    adviceText = `🔴 <strong class="text-red-650 dark:text-red-400">Kritik:</strong> Başarı oranı %${pct}. Konu anlatım videoları izlenmeli ve günlük 50+ soru ile eksikler kapatılmalı.`;
                } else if (successVal < 80) {
                    adviceText = `🟡 <strong class="text-amber-600 dark:text-amber-450">Orta:</strong> Başarı oranı %${pct}. Formül ve kural kartları hazırlanmalı, haftalık soru adedi arttırılmalı.`;
                } else {
                    adviceText = `🟢 <strong class="text-green-600 dark:text-green-400">Mükemmel:</strong> Başarı oranı %${pct}. Mevcut seviyeyi korumak adına branş denemelerine ve zor seviye sorulara odaklanılmalı.`;
                }
                adviceList.push(`
                    <div class="border-b dark:border-gray-700 pb-1.5 mb-1.5 last:border-b-0 text-sm">
                        <span class="font-bold text-gray-808 dark:text-gray-250">${name}:</span> <span class="text-gray-650 dark:text-gray-300">${adviceText}</span>
                    </div>
                `);
            }
        }
        const studyAdviceHtml = adviceList.join('');
        
        // 2. Haftalık Çalışma Takvimi
        const gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
        const weeklyPlannerHtml = gunler.map(gun => {
            const tasks = student.studyPlan && student.studyPlan[gun] ? student.studyPlan[gun] : [];
            const tasksListHtml = tasks.map((task, idx) => `
                <div class="flex justify-between items-center bg-gray-100 dark:bg-gray-700/60 p-1.5 rounded-lg text-sm border border-gray-200 dark:border-gray-600 mb-1 last:mb-0">
                    <span class="text-gray-700 dark:text-gray-200 font-medium truncate max-w-[80%]" title="${escapeHtml(task)}">${escapeHtml(task)}</span>
                    <button onclick="deleteStudyTask('${id}', '${gun}', ${idx})" class="text-red-500 hover:text-red-750 transition p-1">
                        <i class="fas fa-times-circle"></i>
                    </button>
                </div>
            `).join('') || '<p class="text-sm text-gray-405 text-center italic py-2">Çalışma planlanmamış.</p>';
            
            return `
                <div class="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-3 shadow-sm space-y-2">
                    <h5 class="font-bold text-sm text-indigo-600 dark:text-indigo-400 flex items-center gap-1 border-b dark:border-gray-750 pb-1">
                        <i class="far fa-calendar-check"></i> ${gun}
                    </h5>
                    <div class="space-y-1 max-h-24 overflow-y-auto">${tasksListHtml}</div>
                    <div class="flex gap-1 pt-1">
                        <input type="text" id="taskInput_${gun}" placeholder="Ders/ödev..." class="student-form-input text-sm flex-grow min-w-0" style="padding: 0.5rem 0.6rem; font-size: 14px; min-height: 44px;">
                        <button onclick="addStudyTask('${id}', '${gun}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-sm font-bold transition flex items-center justify-center min-w-[44px] min-h-[44px]">
                            +
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        // 3. Hatalı Soru Sıfırlama Takibi
        const allMistakes = [];
        const denemelerList = student.denemeler || [];
        for (let den of denemelerList) {
            if (den.tip === "genel") continue;
            const sorular = den.sorular || [];
            for (let soru of sorular) {
                if (soru.durum === "yanlis" || soru.durum === "bos") {
                    const key = `${den.id}_${soru.soruNo}`;
                    const status = student.errorResets && student.errorResets[key] ? student.errorResets[key].status : 'pending';
                    allMistakes.push({
                        key,
                        examName: den.denemeAdi,
                        date: den.tarih,
                        topic: soru.konuAdi,
                        errorType: soru.hataKodu || 'Belirtilmemiş',
                        status,
                        solvedAt: student.errorResets && student.errorResets[key] ? student.errorResets[key].solvedAt : null
                    });
                }
            }
        }
        
        const totalErrorsCount = allMistakes.length;
        const solvedErrorsCount = allMistakes.filter(m => m.status === 'solved').length;
        const pendingErrorsCount = totalErrorsCount - solvedErrorsCount;
        const errorResetPercent = totalErrorsCount > 0 ? Math.round((solvedErrorsCount / totalErrorsCount) * 100) : 100;
        
        if (!window.currentErrorFilter) window.currentErrorFilter = 'all';
        const filteredMistakes = allMistakes.filter(m => {
            if (window.currentErrorFilter === 'pending') return m.status === 'pending';
            if (window.currentErrorFilter === 'solved') return m.status === 'solved';
            return true;
        });
        
        let errorsRowsHtml = '';
        if (filteredMistakes.length === 0) {
            errorsRowsHtml = `<tr><td colspan="5" class="text-center p-4 text-gray-500">Kayıtlı hatalı soru bulunmuyor.</td></tr>`;
        } else {
            errorsRowsHtml = filteredMistakes.map(m => {
                const statusBadge = m.status === 'solved'
                    ? `<span class="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2.5 py-0.5 rounded-full font-bold text-xs">✅ Sıfırlandı</span>`
                    : `<span class="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 rounded-full font-bold text-xs">❌ Bekliyor</span>`;
                    
                const actionBtn = m.status === 'pending'
                    ? `<button onclick="resetStudentError('${id}', '${m.key}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1 mx-auto shadow-sm min-h-[44px]">
                           <i class="fas fa-check"></i> Sıfırla
                       </button>`
                    : `<span class="text-gray-500 dark:text-gray-400 text-xs font-semibold">${m.solvedAt || '—'}</span>`;
                    
                return `
                    <tr class="border-b hover:bg-gray-50 dark:hover:bg-gray-750/10 transition text-base">
                        <td class="p-4 border font-medium">${escapeHtml(m.examName)}<br><span class="text-xs text-gray-400">${m.date}</span></td>
                        <td class="p-4 border font-semibold text-indigo-600 dark:text-indigo-400">${escapeHtml(m.topic)}</td>
                        <td class="p-4 border text-center text-gray-600 dark:text-gray-300">${escapeHtml(m.errorType)}</td>
                        <td class="p-4 border text-center">${statusBadge}</td>
                        <td class="p-4 border text-center">${actionBtn}</td>
                    </tr>
                `;
            }).join('');
        }
        
        // 4. Soru Sayısı Gelişim Takip Verileri
        const growthPlan = student.growthPlan || { weeklyTarget: 500, logs: [] };
        const weeklyTarget = growthPlan.weeklyTarget || 500;
        const growthLogs = growthPlan.logs || [];
        
        let weeksSolvedCount = 0;
        const todayObj = new Date();
        const dayOfWeek = todayObj.getDay();
        const difference = todayObj.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const mondayDate = new Date(todayObj.setDate(difference));
        mondayDate.setHours(0, 0, 0, 0);
        
        for (let log of growthLogs) {
            const logDate = new Date(log.date);
            if (logDate >= mondayDate) {
                weeksSolvedCount += parseInt(log.count) || 0;
            }
        }
        
        const weeklyGrowthPercent = weeklyTarget > 0 ? Math.min(100, Math.round((weeksSolvedCount / weeklyTarget) * 100)) : 0;
        const todayDateStr = new Date().toISOString().split('T')[0];
        
        const sortedLogsForList = [...growthLogs].sort((a, b) => b.date.localeCompare(a.date));
        let growthLogsListHtml = '';
        if (sortedLogsForList.length === 0) {
            growthLogsListHtml = '<p class="text-sm text-gray-400 italic text-center py-2">Soru girişi yapılmamış.</p>';
        } else {
            growthLogsListHtml = sortedLogsForList.slice(0, 5).map(log => {
                const origIdx = growthLogs.findIndex(l => l.date === log.date && l.count === log.count);
                return `
                    <div class="flex justify-between items-center bg-white dark:bg-gray-800 p-1.5 rounded border dark:border-gray-700 mb-1 last:mb-0 text-sm">
                        <span>📅 ${log.date}: <strong class="text-indigo-600 dark:text-indigo-400 font-semibold">${log.count} Soru</strong></span>
                        <button onclick="deleteGrowthLog('${id}', ${origIdx})" class="text-red-500 hover:text-red-750 transition p-1">
                            <i class="fas fa-trash-alt text-sm"></i>
                        </button>
                    </div>
                `;
            }).join('');
        }
        
        const html = `
            <div class="pb-28 sm:pb-8 space-y-6">
                <div class="flex flex-wrap justify-between gap-3 mb-4">
                <button onclick="renderHomeScreen()" class="bg-gray-200 dark:bg-gray-700 px-4 py-2.5 rounded-xl min-h-[44px] font-semibold"><i class="fas fa-arrow-left"></i> Öğrenci Listesi</button>
                <div class="flex gap-2">
                    <button onclick="shareReportWhatsApp('${id}')" class="bg-green-600 text-white px-5 py-2.5 rounded-xl shadow font-semibold flex items-center gap-2 min-h-[44px] hover:bg-green-700 transition"><i class="fab fa-whatsapp text-lg"></i> Veli Raporu</button>
                    <div class="relative inline-block">
                        <button onclick="toggleReportMenu()" class="bg-blue-600 text-white px-5 py-2.5 rounded-xl shadow min-h-[44px] font-semibold hover:bg-blue-700 transition"><i class="fas fa-file-alt"></i> Rapor Al</button>
                        <div id="reportMenu" class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-50 hidden border border-gray-150 dark:border-gray-700">
                            <button onclick="exportReport('pdf'); hideReportMenu()" class="block w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 font-semibold"><i class="fas fa-file-pdf mr-1"></i> PDF Kaydet</button>
                            <button onclick="exportReport('word'); hideReportMenu()" class="block w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 font-semibold"><i class="fas fa-file-word mr-1"></i> Word Kaydet</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="bg-gray-50 dark:bg-gray-800 p-5 rounded-2xl border">
                <div class="flex justify-between flex-wrap items-start">
                    <div>
                        <h2 class="page-heading text-2xl font-bold">${escapeHtml(student.adSoyad)}</h2>
                        <p class="text-sm text-gray-500 mt-0.5">🏫 ${escapeHtml(student.okul)} | 🎯 ${escapeHtml(student.hedefLise)} | 📚 ${student.sinif ? student.sinif + '. Sınıf' : 'Sınıf belirtilmemiş'}</p>
                        ${ekstraBilgiHtml}
                    </div>
                    <div class="text-right">
                        <span class="bg-white dark:bg-gray-700 px-3.5 py-1.5 rounded-full shadow border font-bold text-sm">🎯 ${student.hedefNet} Net</span><br>
                        <span class="text-sm font-semibold text-gray-500 mt-1 block">📊 Genel Ort. Net: ${genelOrtalamaNet}</span>
                    </div>
                </div>
                <div class="mt-4 p-3 rounded-xl text-center font-bold border motivation-card text-base bg-white dark:bg-gray-700 shadow-sm">${motivasyon}</div>
            </div>
            
            <!-- LGS Hedef Uyum Analizi -->
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 mt-4 border border-gray-105 dark:border-gray-700">
                <h3 class="section-heading text-indigo-600 dark:text-indigo-400 font-bold text-lg mb-2"><i class="fas fa-graduation-cap"></i> LGS Hedef Uyum Analizi</h3>
                <div class="space-y-3">
                    <div class="flex justify-between items-center flex-wrap gap-2">
                        <div>
                            <span class="text-sm font-semibold text-gray-500 dark:text-gray-400">Hedef Okul:</span> 
                            <span class="font-bold text-gray-800 dark:text-white text-base">${escapeHtml(student.hedefLise)}</span>
                        </div>
                        <div class="text-right">
                            <span class="text-xs bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 px-2.5 py-1 rounded-full font-bold">Hedef: ${targetPuan} Puan / ${student.hedefNet} Net</span>
                        </div>
                    </div>
                    ${lgsPuan === null ? `
                        <p class="text-xs text-gray-500 text-center py-3 bg-gray-50 dark:bg-gray-900/20 rounded-xl border border-dashed">${targetMatchBadgeText}</p>
                    ` : `
                        <div class="space-y-1.5">
                            <div class="flex justify-between text-xs font-bold text-gray-500">
                                <span>Mevcut Ortalama Puan: ${lgsPuan}</span>
                                <span>Uyum: %${matchPercent}</span>
                            </div>
                            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                <div class="bg-indigo-650 h-full rounded-full transition-all duration-500" style="width: ${matchPercent}%"></div>
                            </div>
                        </div>
                        <div class="p-2.5 rounded-xl border text-xs font-semibold text-center ${targetMatchBadgeClass}">${targetMatchBadgeText}</div>
                    `}
                </div>
            </div>
            
            <!-- TAB SEGMENT -->
            <div class="flex border-b border-gray-200 dark:border-gray-700 mt-6 mb-4">
                <button onclick="switchStudentTab('genel')" id="tabStudentGenelBtn" class="flex-1 py-2.5 text-center font-bold border-b-2 border-blue-650 text-blue-650 transition-all duration-200 text-sm sm:text-base">
                    📘 Genel Denemeler
                </button>
                <button onclick="switchStudentTab('brans')" id="tabStudentBransBtn" class="flex-1 py-2.5 text-center font-bold border-b-2 border-transparent text-gray-500 hover:text-gray-705 transition-all duration-200 text-sm sm:text-base">
                    🔬 Branş Denemeleri
                </button>
                <button onclick="switchStudentTab('calisma')" id="tabStudentCalismaBtn" class="flex-1 py-2.5 text-center font-bold border-b-2 border-transparent text-gray-500 hover:text-gray-705 transition-all duration-200 text-sm sm:text-base">
                    🎯 Çalışma & Gelişim Planı
                </button>
            </div>
            
            <!-- GENEL TAB CONTENT -->
            <div id="studentGenelTabContent" class="space-y-4">
                <div class="bg-white dark:bg-gray-800 p-3 rounded-2xl shadow border"><canvas id="netChart" height="150"></canvas></div>
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 border">
                    <h3 class="section-heading text-lg font-bold text-gray-800 dark:text-white border-b pb-2 mb-3">📘 Genel Sınav İstatistikleri</h3>
                    ${genelDenemeler.length === 0 ? '<p class="text-gray-500 text-sm">Henüz genel deneme eklenmemiş.</p>' : `
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div class="border rounded-xl p-3 bg-gray-50 dark:bg-gray-900/10"><span class="font-bold text-sm text-gray-500 dark:text-gray-400 block">Toplam Deneme</span> <strong class="text-base">${genelDenemeler.length}</strong></div>
                            <div class="border rounded-xl p-3 bg-gray-50 dark:bg-gray-900/10"><span class="font-bold text-sm text-gray-500 dark:text-gray-400 block">Ortalama Net</span> <strong class="text-base text-blue-600">${genelOrtalamaNet}</strong></div>
                            <div class="border rounded-xl p-3 bg-gray-50 dark:bg-gray-900/10"><span class="font-bold text-sm text-gray-500 dark:text-gray-400 block">Tahmini LGS Puanı</span> <strong class="text-base text-indigo-605">${lgsPuan !== null ? lgsPuan : '—'}</strong></div>
                        </div>
                        <div class="mt-4">
                            <h4 class="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">Ders Bazlı Ortalama Başarı (%)</h4>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                ${GENEL_DERSLER_KEY.map((d, i) => `
                                    <div class="flex justify-between text-base border-b dark:border-gray-700 pb-1">
                                        <span class="text-gray-600 dark:text-gray-400 font-semibold">${GENEL_DERSLER_GORUNUM[i]}</span>
                                        <span class="font-bold text-indigo-600 dark:text-indigo-400">${dersBazliYuzdeler[d] !== null ? dersBazliYuzdeler[d] + '%' : '—'}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `}
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 border">
                    <h3 class="section-heading text-lg font-bold text-gray-800 dark:text-white border-b pb-2 mb-3">📝 Genel Denemeler</h3>
                    <div class="space-y-2 md:max-h-80 md:overflow-y-auto mt-2">${genelExamsHtml}</div>
                </div>
            </div>
            
            <!-- BRANS TAB CONTENT (HIDDEN BY DEFAULT) -->
            <div id="studentBransTabContent" class="hidden space-y-4">
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 border">
                    <h3 class="section-heading text-lg font-bold text-gray-800 dark:text-white border-b pb-2 mb-3">🔬 Branş Sınav İstatistikleri</h3>
                    ${bransDenemeler.length === 0 ? '<p class="text-gray-500 text-sm">Henüz branş deneme eklenmemiş.</p>' : `
                        <div class="grid grid-cols-2 gap-3">
                            <div class="border rounded-xl p-3 bg-gray-50 dark:bg-gray-900/10"><span class="font-bold text-sm text-gray-500 dark:text-gray-400 block">Toplam Branş Deneme</span> <strong class="text-base">${bransDenemeler.length}</strong></div>
                            <div class="border rounded-xl p-3 bg-gray-50 dark:bg-gray-900/10"><span class="font-bold text-sm text-gray-500 dark:text-gray-400 block">Ortalama Net</span> <strong class="text-base text-blue-600">${(bransDenemeler.reduce((sum, d) => sum + d.toplamNet, 0) / bransDenemeler.length).toFixed(2)}</strong></div>
                        </div>
                        <div class="mt-4 border-t pt-3">
                            <h4 class="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">📉 En Çok Hata Yapılan Konular</h4>
                            <div class="space-y-1.5">
                                ${enCokHataYapilan.length === 0 ? '<p class="text-gray-500 text-sm">Henüz hata kaydı bulunmuyor.</p>' : enCokHataYapilan.map(([konu, adet]) => `
                                    <div class="flex justify-between border-b dark:border-gray-700 py-1.5 text-base">
                                        <span class="font-medium text-gray-700 dark:text-gray-300">${konu}</span>
                                        <span class="font-bold text-red-600">${adet} hata (${toplamHataSoru ? ((adet / toplamHataSoru) * 100).toFixed(1) : 0}%)</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ${toplamHata > 0 ? `
                            <div class="mt-4 border-t pt-3">
                                <h4 class="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">⚠️ Hata Kodu Dağılımı</h4>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                                    <div class="max-h-[140px] flex justify-center">
                                        <canvas id="errorChart"></canvas>
                                    </div>
                                    <div class="space-y-1">
                                        ${HATA_KODLARI.map(h => {
                                            const adet = hataSayilari[h.kod] || 0;
                                            const yuzde = toplamHata ? ((adet / toplamHata) * 100).toFixed(1) : 0;
                                            return `
                                                <div class="flex justify-between text-xs border-b dark:border-gray-700 pb-1">
                                                    <span class="text-gray-650 dark:text-gray-400 font-semibold">
                                                        <span class="inline-block w-2.5 h-2.5 rounded-full mr-1" style="background-color:${getErrorColor(h.kod)}"></span>
                                                        ${h.kod} - ${h.aciklama}
                                                    </span>
                                                    <span class="font-bold text-gray-808 dark:text-white">${adet} adet (%${yuzde})</span>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    `}
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 border">
                    <h3 class="section-heading text-lg font-bold text-gray-800 dark:text-white border-b pb-2 mb-3">📝 Branş Denemeleri</h3>
                    <div class="space-y-2 md:max-h-80 md:overflow-y-auto mt-2">${bransExamsHtml}</div>
                </div>
            </div>
            
            <!-- CALISMA TAB CONTENT (HIDDEN BY DEFAULT) -->
            <div id="studentCalismaTabContent" class="hidden space-y-6">
                <!-- SECTION 1: Ders Çalışma Programı -->
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 border">
                    <div class="flex justify-between items-center mb-4 flex-wrap gap-2 border-b dark:border-gray-750 pb-2">
                        <div>
                            <h3 class="section-heading text-indigo-650 dark:text-indigo-400 font-bold text-lg">
                                <i class="fas fa-calendar-alt"></i> Ders Çalışma Programı
                            </h3>
                            <p class="text-sm text-gray-500">Deneme başarılarına göre önerilen haftalık ders programı.</p>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="exportStudyPlanToPdf('${id}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-1.5 shadow min-h-[44px]">
                                <i class="fas fa-file-pdf text-base"></i> Programı PDF Kaydet
                            </button>
                            <button onclick="autoPopulateStudyPlan('${id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-1.5 shadow min-h-[44px]">
                                <i class="fas fa-magic text-base"></i> Programı Otomatik Doldur
                            </button>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        <!-- Performans Önerileri -->
                        <div class="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border dark:border-gray-700 lg:col-span-1">
                            <h4 class="font-bold text-sm mb-3 text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                <i class="fas fa-lightbulb text-amber-500"></i> Performans Önerileri
                            </h4>
                            <div class="space-y-2.5">
                                ${studyAdviceHtml}
                            </div>
                        </div>
                        
                        <!-- Haftalık Takvim -->
                        <div class="lg:col-span-2 space-y-3">
                            <h4 class="font-bold text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                <i class="fas fa-tasks text-indigo-550"></i> Haftalık Çalışma Takvimi
                            </h4>
                            <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:max-h-[350px] md:overflow-y-auto pr-1">
                                ${weeklyPlannerHtml}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- SECTION 2: Hatalı Soru Sıfırlama Takibi -->
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 border">
                    <div class="mb-4 border-b dark:border-gray-750 pb-2">
                        <h3 class="section-heading text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                            <i class="fas fa-check-double"></i> Hatalı Soru Sıfırlama Takibi
                        </h3>
                        <p class="text-sm text-gray-500">Denemelerde yapılan yanlış ve boş bırakılan soruların analiz edilip sıfırlanma (çözülme) durumu.</p>
                    </div>
                    
                    <!-- İlerleme Özeti -->
                    <div class="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-4 flex-wrap mb-4">
                        <div class="flex-grow min-w-[200px] space-y-1.5">
                            <div class="flex justify-between text-sm font-bold text-emerald-800 dark:text-emerald-300">
                                <span>Hata Sıfırlama Gelişimi: %${errorResetPercent}</span>
                                <span>${solvedErrorsCount} / ${totalErrorsCount} Çözüldü</span>
                            </div>
                            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                <div class="bg-emerald-600 h-full rounded-full transition-all duration-500" style="width: ${errorResetPercent}%"></div>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="setErrorFilter('all')" class="px-3.5 py-2.5 rounded-xl text-sm font-bold border transition ${window.currentErrorFilter === 'all' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'} min-h-[44px]">Tümü (${totalErrorsCount})</button>
                            <button onclick="setErrorFilter('pending')" class="px-3.5 py-2.5 rounded-xl text-sm font-bold border transition ${window.currentErrorFilter === 'pending' ? 'bg-red-600 border-red-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-red-650'} min-h-[44px]">Bekleyen (${pendingErrorsCount})</button>
                            <button onclick="setErrorFilter('solved')" class="px-3.5 py-2.5 rounded-xl text-sm font-bold border transition ${window.currentErrorFilter === 'solved' ? 'bg-green-600 border-green-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-green-650'} min-h-[44px]">Sıfırlanan (${solvedErrorsCount})</button>
                        </div>
                    </div>
                    
                    <!-- Hata Tablosu -->
                    <div class="overflow-x-auto md:max-h-[300px] md:overflow-y-auto border rounded-xl">
                        <table class="w-full border-collapse text-left">
                            <thead class="bg-gray-850 dark:bg-gray-900 text-white sticky top-0 z-10">
                                <tr>
                                    <th class="border-b border-gray-200 dark:border-gray-700 p-4 text-base font-bold bg-gray-800 text-white">Sınav / Tarih</th>
                                    <th class="border-b border-gray-200 dark:border-gray-700 p-4 text-base font-bold bg-gray-800 text-white">Ders / Konu</th>
                                    <th class="border-b border-gray-200 dark:border-gray-700 p-4 text-center text-base font-bold bg-gray-800 text-white">Hata Türü</th>
                                    <th class="border-b border-gray-200 dark:border-gray-700 p-4 text-center text-base font-bold bg-gray-800 text-white">Durum</th>
                                    <th class="border-b border-gray-200 dark:border-gray-700 p-4 text-center text-base font-bold bg-gray-800 text-white">İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${errorsRowsHtml}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- SECTION 3: Soru Sayısı Gelişim Planı -->
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 border">
                    <div class="flex justify-between items-center mb-4 flex-wrap gap-2 border-b dark:border-gray-750 pb-2">
                        <div>
                            <h3 class="section-heading text-indigo-650 dark:text-indigo-400 font-bold text-lg">
                                <i class="fas fa-chart-line"></i> Soru Sayısı Gelişim Planı
                            </h3>
                            <p class="text-sm text-gray-500">Çözülen günlük soru adedi grafiği ve hedefler.</p>
                        </div>
                        <div class="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 p-1.5 rounded-xl border dark:border-gray-600 text-sm">
                            <span class="font-bold text-gray-600 dark:text-gray-400">Haftalık Hedef:</span>
                            <input type="number" id="weeklyTargetInput" value="${weeklyTarget}" onchange="changeGrowthTarget('${id}', this.value)" class="student-form-input text-sm font-bold text-center w-20 min-h-[30px]" style="padding: 2px 4px; display: inline-block;">
                            <span class="font-bold text-gray-500">Soru</span>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <!-- Günlük Soru Kaydet -->
                        <div class="space-y-4">
                            <div class="bg-gray-50 dark:bg-gray-900/30 p-3.5 rounded-xl border dark:border-gray-700 space-y-2.5">
                                <h4 class="font-bold text-sm text-gray-700 dark:text-gray-300"><i class="fas fa-plus"></i> Günlük Çözülen Soru Kaydet</h4>
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="block text-xs font-semibold mb-0.5 text-gray-550">Tarih</label>
                                        <input type="date" id="growthLogDate" value="${todayDateStr}" class="student-form-input text-sm min-h-[44px]" style="padding: 4px;">
                                    </div>
                                    <div>
                                        <label class="block text-xs font-semibold mb-0.5 text-gray-550">Soru Sayısı</label>
                                        <input type="number" id="growthLogCount" placeholder="Örn: 80" class="student-form-input text-sm min-h-[44px]" style="padding: 4px;">
                                    </div>
                                </div>
                                <button onclick="addGrowthLog('${id}')" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-bold transition min-h-[44px]">Kaydet</button>
                            </div>
                            
                            <div class="bg-gray-50 dark:bg-gray-900/30 p-3.5 rounded-xl border dark:border-gray-700">
                                <h4 class="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2"><i class="fas fa-list"></i> Son Soru Kayıtları</h4>
                                <div class="space-y-1.5 md:max-h-[140px] md:overflow-y-auto pr-1 text-sm">
                                    ${growthLogsListHtml}
                                </div>
                            </div>
                        </div>
                        
                        <!-- Günlük Dağılım Grafiği -->
                        <div class="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border dark:border-gray-700 flex flex-col justify-between">
                            <h4 class="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2"><i class="fas fa-chart-bar text-indigo-500"></i> Günlük Dağılım Grafiği (Son 7 Giriş)</h4>
                            <div class="max-h-[180px] min-h-[150px] flex justify-center flex-grow">
                                <canvas id="growthChart"></canvas>
                            </div>
                        </div>
                        
                        <!-- Hedef İlerlemesi -->
                        <div class="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border dark:border-gray-700 flex flex-col justify-between space-y-4">
                            <div>
                                <h4 class="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2"><i class="fas fa-bullseye text-red-500"></i> Bu Haftaki Hedef İlerlemesi</h4>
                                <div class="space-y-1.5 mt-3">
                                    <div class="flex justify-between text-sm font-bold text-indigo-905 dark:text-indigo-300">
                                        <span>Haftalık Uyum: %${weeklyGrowthPercent}</span>
                                        <span>${weeksSolvedCount} / ${weeklyTarget} Soru</span>
                                    </div>
                                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                        <div class="bg-indigo-600 h-full rounded-full transition-all duration-500" style="width: ${weeklyGrowthPercent}%"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="border-t dark:border-gray-700 pt-3 space-y-2">
                                <h4 class="font-bold text-sm text-gray-700 dark:text-gray-300"><i class="fas fa-rocket text-indigo-500"></i> Kademe Gelişim Hedefleri</h4>
                                <div class="grid grid-cols-2 gap-2 text-sm text-gray-650 dark:text-gray-450">
                                    <div class="bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-700">
                                        <span class="font-semibold block text-[11px]">Gelecek Hafta (+%10)</span>
                                        <strong class="text-sm text-indigo-650 dark:text-indigo-400">${Math.round(weeklyTarget * 1.1)} Soru</strong>
                                    </div>
                                    <div class="bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-700">
                                        <span class="font-semibold block text-[11px]">Sonraki Hafta (+%20)</span>
                                        <strong class="text-sm text-indigo-650 dark:text-indigo-400">${Math.round(weeklyTarget * 1.2)} Soru</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
        
        document.getElementById("dynamic-content").innerHTML = html;
        
        setTimeout(() => {
            const ctx = document.getElementById("netChart")?.getContext("2d");
            if (ctx && genelSorted.length) {
                if (store.chartInstance) store.chartInstance.destroy();
                const datasets = [{
                    label: 'Genel Deneme Netleri',
                    data: netChartData,
                    borderColor: '#4F46E5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderWidth: 3,
                    tension: 0.25,
                    fill: true
                }];
                if (hedefGecerli) {
                    datasets.push({
                        label: `Hedef Net (${hedefSayi})`,
                        data: Array(genelSorted.length).fill(hedefSayi),
                        borderColor: '#10B981',
                        borderDash: [5, 5],
                        pointRadius: 0,
                        borderWidth: 2
                    });
                }
                const ChartClass = window.Chart || Chart;
                store.chartInstance = new ChartClass(ctx, {
                    type: 'line',
                    data: { labels: netChartLabels, datasets },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                labels: {
                                    font: { family: 'Outfit, sans-serif', weight: 'bold' }
                                }
                            }
                        }
                    }
                });
            }
            
            const errCtx = document.getElementById("errorChart")?.getContext("2d");
            if (errCtx && toplamHata > 0) {
                if (window.errorChartInstance) window.errorChartInstance.destroy();
                const ChartClass = window.Chart || Chart;
                window.errorChartInstance = new ChartClass(errCtx, {
                    type: 'doughnut',
                    data: {
                        labels: HATA_KODLARI.map(h => h.kod),
                        datasets: [{
                            data: HATA_KODLARI.map(h => hataSayilari[h.kod] || 0),
                            backgroundColor: HATA_KODLARI.map(h => getErrorColor(h.kod)),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        }
                    }
                });
            }
            
            const growthCtx = document.getElementById("growthChart")?.getContext("2d");
            if (growthCtx && growthLogs.length > 0) {
                if (window.growthChartInstance) window.growthChartInstance.destroy();
                const sortedLogsForChart = [...growthLogs]
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .slice(-7);
                    
                const labels = sortedLogsForChart.map(l => {
                    const parts = l.date.split('-');
                    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : l.date;
                });
                const data = sortedLogsForChart.map(l => l.count);
                const ChartClass = window.Chart || Chart;
                window.growthChartInstance = new ChartClass(growthCtx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Çözülen Soru',
                            data: data,
                            backgroundColor: '#7C3AED',
                            borderRadius: 6,
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            y: { beginAtZero: true }
                        }
                    }
                });
            }
        }, 50);
        
    } catch (err) {
        console.error(err);
        alert("Öğrenci paneli açılamadı: " + err.message);
        renderHomeScreen();
    }
}

export function renderGenelIslemler() {
    store.currentPage = "general";
    if (window.currentPage) window.currentPage = "general";
    updateMobileNavActive('mobile-nav-general');
    
    const themeText = store.darkMode ? 'Açık Mod' : 'Koyu Mod';
    const themeIcon = store.darkMode ? 'fa-sun' : 'fa-moon';
    
    const logoutHtml = (window.isFirebaseActive && window.auth && window.auth.currentUser) ? `
        <button onclick="handleLogout()" class="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-xl transition font-medium text-left">
            <i class="fas fa-sign-out-alt text-red-500 text-xl w-8 text-center"></i>
            <div>
                <div class="text-sm text-red-600 dark:text-red-400">Oturumu Kapat</div>
                <div class="text-xs text-red-400">Bulut oturumundan çıkış yap</div>
            </div>
        </button>
    ` : '';
    
    const html = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl max-w-xl mx-auto border border-gray-100/20 dark:border-gray-700/50">
            <h2 class="page-heading text-gray-805 dark:text-white">
                <i class="fas fa-home text-blue-500"></i> Ana Sayfa
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-4 font-semibold">
                Uygulama genel özelliklerini, finans durumunu, veri yedeklerini ve toplu işlemlerinizi buradan yönetebilirsiniz.
            </p>

            <!-- Öğretmen Bilgi Kartı & Branş Seçimi -->
            <div class="mb-6 p-4 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 rounded-xl border border-indigo-100/30 dark:border-indigo-900/30 flex flex-col gap-4">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-650 flex items-center justify-center text-white text-xl font-black shadow-sm">
                        <i class="fas fa-chalkboard-teacher"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <input type="text" id="teacherNameInput" value="${store.teacherName || 'Öğretmen Adı'}" onchange="updateTeacherName()" placeholder="Adınız Soyadınız" class="bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-indigo-500 focus:outline-none text-base font-bold text-gray-800 dark:text-gray-150 py-0.5 px-1 rounded transition w-full">
                        <input type="text" id="teacherSchoolInput" value="${store.teacherSchool || ''}" onchange="updateTeacherSchool()" placeholder="Çalıştığınız Okul / Kurum" class="bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-indigo-500 focus:outline-none text-xs font-semibold text-gray-500 dark:text-gray-400 py-0.5 px-1 rounded transition w-full mt-0.5">
                        <div class="text-xs text-gray-500 dark:text-gray-400 font-semibold flex items-center gap-1.5 mt-1 px-1">
                            <i class="fas fa-envelope"></i> ${window.auth && window.auth.currentUser ? window.auth.currentUser.email : 'Yerel Çevrimdışı Hesap'}
                        </div>
                    </div>
                </div>

                <!-- Branş / Ders Seçimi -->
                <div class="pt-3 border-t border-indigo-150/10 dark:border-indigo-900/25">
                    <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2.5 uppercase tracking-wider">📚 Vereceğiniz Dersler (Çoklu Seçim)</label>
                    <div class="flex flex-wrap gap-2">
                        <label class="flex items-center gap-1.5 cursor-pointer bg-white dark:bg-gray-850 px-3 py-1.5 rounded-xl shadow-sm border border-gray-150/30 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-900 transition">
                            <input type="checkbox" id="settingsBranchTur" value="Türkçe" ${store.teacherBranches.includes("Türkçe") ? "checked" : ""} onchange="updateTeacherBranches()" class="rounded text-indigo-650 focus:ring-indigo-500 w-4 h-4">
                            <span class="text-xs font-bold text-gray-800 dark:text-gray-200">Türkçe</span>
                        </label>
                        <label class="flex items-center gap-1.5 cursor-pointer bg-white dark:bg-gray-850 px-3 py-1.5 rounded-xl shadow-sm border border-gray-150/30 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-900 transition">
                            <input type="checkbox" id="settingsBranchMath" value="Matematik" ${store.teacherBranches.includes("Matematik") ? "checked" : ""} onchange="updateTeacherBranches()" class="rounded text-indigo-650 focus:ring-indigo-500 w-4 h-4">
                            <span class="text-xs font-bold text-gray-800 dark:text-gray-200">Matematik</span>
                        </label>
                        <label class="flex items-center gap-1.5 cursor-pointer bg-white dark:bg-gray-850 px-3 py-1.5 rounded-xl shadow-sm border border-gray-150/30 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-900 transition">
                            <input type="checkbox" id="settingsBranchScience" value="Fen Bilimleri" ${store.teacherBranches.includes("Fen Bilimleri") ? "checked" : ""} onchange="updateTeacherBranches()" class="rounded text-indigo-650 focus:ring-indigo-500 w-4 h-4">
                            <span class="text-xs font-bold text-gray-800 dark:text-gray-200">Fen</span>
                        </label>
                        <label class="flex items-center gap-1.5 cursor-pointer bg-white dark:bg-gray-850 px-3 py-1.5 rounded-xl shadow-sm border border-gray-150/30 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-900 transition">
                            <input type="checkbox" id="settingsBranchSoc" value="Sosyal Bilgiler" ${store.teacherBranches.includes("Sosyal Bilgiler") ? "checked" : ""} onchange="updateTeacherBranches()" class="rounded text-indigo-650 focus:ring-indigo-500 w-4 h-4">
                            <span class="text-xs font-bold text-gray-800 dark:text-gray-200">Sosyal Bilgiler</span>
                        </label>
                    </div>
                    <div id="branchSettingsFeedback" class="text-xs text-green-600 dark:text-green-400 mt-2 font-semibold hidden flex items-center gap-1">
                        <i class="fas fa-check-circle"></i> Branş ayarlarınız güncellendi.
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button onclick="toggleTheme()" class="flex items-center gap-3 p-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition font-medium text-left">
                    <i class="fas ${themeIcon} text-indigo-500 text-xl w-8 text-center"></i>
                    <div>
                        <div class="text-sm font-bold">Görünüm Teması</div>
                        <div class="text-sm text-gray-450">${themeText}'a Geç</div>
                    </div>
                </button>
                <button onclick="renderFinanceReport()" class="flex items-center gap-3 p-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition font-medium text-left">
                    <i class="fas fa-wallet text-amber-500 text-xl w-8 text-center"></i>
                    <div>
                        <div class="text-sm font-bold">Finans / Ödeme Raporu</div>
                        <div class="text-sm text-gray-450">Genel Muhasebe Takibi</div>
                    </div>
                </button>
                <button onclick="showDenemeAtaModal()" class="flex items-center gap-3 p-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition font-medium text-left">
                    <i class="fas fa-copy text-teal-500 text-xl w-8 text-center"></i>
                    <div>
                        <div class="text-sm font-bold">Toplu Deneme Ata</div>
                        <div class="text-sm text-gray-450">Çoklu Öğrenci Seçimi</div>
                    </div>
                </button>
                <button onclick="renderGroupsPage()" class="flex items-center gap-3 p-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition font-medium text-left">
                    <i class="fas fa-users-cog text-purple-500 text-xl w-8 text-center"></i>
                    <div>
                        <div class="text-sm font-bold">Sınıf & Grup Yönetimi</div>
                        <div class="text-sm text-gray-450">Gruplar, Ödevler ve Liderlik</div>
                    </div>
                </button>
                ${logoutHtml}
            </div>

            <div class="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 text-center text-sm text-gray-400">
                <i class="fas fa-flask"></i> Canfenci Öğrenci Takip Sistemi PWA v1.0
            </div>
        </div>
    `;
    document.getElementById("dynamic-content").innerHTML = html;
}

export async function updateTeacherName() {
    const newName = document.getElementById("teacherNameInput")?.value.trim() || "Öğretmen Adı";
    store.teacherName = newName;
    localStorage.setItem('teacher_name_v1', newName);
    
    if (window.isFirebaseActive && window.auth && window.auth.currentUser && window.db) {
        try {
            const uid = window.auth.currentUser.uid;
            await window.db.collection("users").doc(uid).set({
                name: newName,
                email: window.auth.currentUser.email,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (err) {
            console.error("Firestore teacher name update failed:", err);
        }
    }
    
    const fb = document.getElementById("branchSettingsFeedback");
    if (fb) {
        fb.innerHTML = `<i class="fas fa-check-circle"></i> Öğretmen ismi güncellendi.`;
        fb.classList.remove("hidden");
        setTimeout(() => fb.classList.add("hidden"), 3000);
    }
}

export async function updateTeacherBranches() {
    const isTurChecked = document.getElementById("settingsBranchTur")?.checked;
    const isMathChecked = document.getElementById("settingsBranchMath")?.checked;
    const isScienceChecked = document.getElementById("settingsBranchScience")?.checked;
    const isSocChecked = document.getElementById("settingsBranchSoc")?.checked;
    
    const branches = [];
    if (isTurChecked) branches.push("Türkçe");
    if (isMathChecked) branches.push("Matematik");
    if (isScienceChecked) branches.push("Fen Bilimleri");
    if (isSocChecked) branches.push("Sosyal Bilgiler");
    
    if (branches.length === 0) {
        alert("Lütfen en az bir branş seçiniz.");
        const current = store.teacherBranches || ["Türkçe", "Matematik", "Fen Bilimleri", "Sosyal Bilgiler"];
        if (document.getElementById("settingsBranchTur")) {
            document.getElementById("settingsBranchTur").checked = current.includes("Türkçe");
        }
        if (document.getElementById("settingsBranchMath")) {
            document.getElementById("settingsBranchMath").checked = current.includes("Matematik");
        }
        if (document.getElementById("settingsBranchScience")) {
            document.getElementById("settingsBranchScience").checked = current.includes("Fen Bilimleri");
        }
        if (document.getElementById("settingsBranchSoc")) {
            document.getElementById("settingsBranchSoc").checked = current.includes("Sosyal Bilgiler");
        }
        return;
    }
    
    localStorage.setItem('teacher_branches_v1', JSON.stringify(branches));
    store.teacherBranches = branches;
    
    if (window.isFirebaseActive && window.auth && window.auth.currentUser && window.db) {
        try {
            const uid = window.auth.currentUser.uid;
            await window.db.collection("users").doc(uid).set({
                branches: branches,
                email: window.auth.currentUser.email,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (err) {
            console.error("Firestore settings update failed:", err);
        }
    }
    
    const fb = document.getElementById("branchSettingsFeedback");
    if (fb) {
        fb.innerHTML = `<i class="fas fa-check-circle"></i> Branş ayarlarınız güncellendi.`;
        fb.classList.remove("hidden");
        setTimeout(() => fb.classList.add("hidden"), 3000);
    }
}

export async function updateTeacherSchool() {
    const newSchool = document.getElementById("teacherSchoolInput")?.value.trim() || "";
    store.teacherSchool = newSchool;
    localStorage.setItem('teacher_school_v1', newSchool);
    
    if (window.isFirebaseActive && window.auth && window.auth.currentUser && window.db) {
        try {
            const uid = window.auth.currentUser.uid;
            await window.db.collection("users").doc(uid).set({
                school: newSchool,
                email: window.auth.currentUser.email,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (err) {
            console.error("Firestore school update failed:", err);
        }
    }
    
    const fb = document.getElementById("branchSettingsFeedback");
    if (fb) {
        fb.innerHTML = `<i class="fas fa-check-circle"></i> Okul bilginiz güncellendi.`;
        fb.classList.remove("hidden");
        setTimeout(() => fb.classList.add("hidden"), 3000);
    }
}

// Global window mappings for compatibility
window.onTargetSchoolChanged = onTargetSchoolChanged;
window.renderHomeScreen = renderHomeScreen;
window.setSortOrder = setSortOrder;
window.setFilter = setFilter;
window.deleteStudent = deleteStudent;
window.editStudent = editStudent;
window.saveStudentEdit = saveStudentEdit;
window.showAddStudentModal = showAddStudentModal;
window.closeAddStudentModal = closeAddStudentModal;
window.addStudentFromModal = addStudentFromModal;
window.toggleReportMenu = toggleReportMenu;
window.hideReportMenu = hideReportMenu;
window.switchStudentTab = switchStudentTab;
window.exportBackup = exportBackup;
window.showImportModal = showImportModal;
window.importBackup = importBackup;
window.selectStudent = async (id) => { await renderStudentPanel(id); };
window.renderStudentPanel = renderStudentPanel;
window.renderGenelIslemler = renderGenelIslemler;
window.updateTeacherBranches = updateTeacherBranches;
window.updateTeacherName = updateTeacherName;
window.updateTeacherSchool = updateTeacherSchool;


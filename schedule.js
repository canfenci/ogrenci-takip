// ==================== WEEKLY LESSON SCHEDULE MODÜLÜ ====================

import { store, loadStudentsData, loadSchedule, saveSchedule, escapeHtml } from './store.js';
import { updateMobileNavActive } from './auth.js';

export function renderSchedulePage() {
    store.currentPage = "schedule";
    updateMobileNavActive('mobile-nav-schedule');
    const students = loadStudentsData();
    if (students.length === 0) { 
        document.getElementById("dynamic-content").innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 text-center text-gray-500">
                Henüz öğrenci eklenmemiş. Lütfen önce öğrenci ekleyin.
            </div>`; 
        return; 
    }
    
    let viewMode = localStorage.getItem('scheduleViewMode') || 'excel';
    let selectedStudentId = students[0].id;
    let lessons = loadSchedule(selectedStudentId);
    
    function buildUI() {
        const gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
        const student = students.find(s => s.id === selectedStudentId);
        const is8thGrade = student && (String(student.sinif).trim() === "8" || (student.adSoyad && student.adSoyad.includes("(8)")));
        
        const uniqueHoursSelected = [];
        lessons.forEach(l => {
            if (l.saat && !uniqueHoursSelected.includes(l.saat)) {
                uniqueHoursSelected.push(l.saat);
            }
        });
        uniqueHoursSelected.sort((a, b) => a.localeCompare(b));
        
        let studentScheduleHtml = '';
        
        if (viewMode === 'excel') {
            if (uniqueHoursSelected.length === 0) {
                studentScheduleHtml = `
                    <div class="overflow-x-auto rounded-xl border border-gray-300 dark:border-gray-700 shadow-inner">
                        <table class="w-full border-collapse border-spacing-0 text-left">
                            <thead>
                                <tr class="bg-indigo-700 text-white text-base">
                                    <th class="border border-gray-300 dark:border-gray-600 p-3 text-center w-[100px] font-bold text-base">Saat</th>
                                    ${gunler.map(g => `<th class="border border-gray-300 dark:border-gray-600 p-3 text-center font-bold min-w-[130px] text-base">${g}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td colspan="8" class="text-center p-8 text-gray-500 dark:text-gray-400 font-bold text-base bg-gray-50/50 dark:bg-gray-900/10">
                                        📅 Henüz planlanmış ders bulunmamaktadır. Ders eklemek için sağ üstteki butonu kullanabilirsiniz.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                `;
            } else {
                const trs = uniqueHoursSelected.map(saat => {
                    const dayCellsHtml = gunler.map(gun => {
                        const matchingLessonIdx = lessons.findIndex(l => l.gun === gun && l.saat === saat);
                        if (matchingLessonIdx !== -1) {
                            const les = lessons[matchingLessonIdx];
                            return `
                                <td class="border border-gray-400 dark:border-gray-600 p-3 bg-indigo-50 dark:bg-indigo-950/30 text-center vertical-middle min-w-[130px]">
                                    <div class="flex flex-col items-center gap-1.5 justify-center">
                                        <span class="text-base font-bold text-indigo-950 dark:text-indigo-100">${escapeHtml((is8thGrade && les.dersAdi === "Sosyal Bilgiler") ? "İnkılap Tarihi" : les.dersAdi)}</span>
                                        <div class="flex gap-2.5">
                                            <button onclick="editScheduleLesson(${matchingLessonIdx})" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition" title="Düzenle">
                                                <i class="fas fa-edit text-xs"></i>
                                            </button>
                                            <button onclick="deleteScheduleLesson(${matchingLessonIdx})" class="text-red-500 hover:text-red-750 transition" title="Sil">
                                                <i class="fas fa-trash-alt text-xs"></i>
                                            </button>
                                        </div>
                                    </div>
                                </td>
                            `;
                        } else {
                            return `<td class="border border-gray-400 dark:border-gray-600 p-3 text-center min-w-[130px] bg-white dark:bg-gray-800 text-gray-300 dark:text-gray-650 font-bold text-base">—</td>`;
                        }
                    }).join('');
                    
                    return `
                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-750/20 transition">
                            <td class="border border-gray-400 dark:border-gray-600 p-3 font-bold text-center text-base bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-w-[100px]">${saat}</td>
                            ${dayCellsHtml}
                        </tr>
                    `;
                }).join('');
                
                studentScheduleHtml = `
                    <div class="overflow-x-auto rounded-xl border border-gray-400 dark:border-gray-600 shadow-lg">
                        <table class="w-full border-collapse border-spacing-0 text-left weekly-schedule-table">
                            <thead class="bg-gray-800 dark:bg-gray-900 text-white">
                                <tr class="text-white text-base">
                                    <th class="border border-gray-400 dark:border-gray-600 p-3.5 text-center font-bold w-[100px] text-base">Saat</th>
                                    ${gunler.map(g => `<th class="border border-gray-400 dark:border-gray-600 p-3.5 text-center font-bold min-w-[130px] text-base">${g}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody class="text-sm">
                                ${trs}
                            </tbody>
                        </table>
                    </div>
                `;
            }
        } else {
            const cardsHtml = gunler.map(gun => {
                const dayLessons = lessons
                    .filter(l => l.gun === gun)
                    .sort((a, b) => a.saat.localeCompare(b.saat));
                    
                let dayLessonsHtml = '';
                if (dayLessons.length === 0) {
                    dayLessonsHtml = `
                        <div class="text-center py-6 text-gray-400 dark:text-gray-500 text-sm font-semibold">
                            😴 Planlanmış ders yok
                        </div>
                    `;
                } else {
                    dayLessonsHtml = dayLessons.map(les => {
                        const realIdx = lessons.findIndex(l => l.gun === les.gun && l.saat === les.saat && l.dersAdi === les.dersAdi);
                        return `
                            <div class="flex items-center justify-between bg-indigo-50/50 dark:bg-gray-900/40 p-2.5 rounded-xl border border-indigo-100/50 dark:border-gray-700/50">
                                <div class="flex items-center gap-2">
                                    <span class="bg-indigo-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-lg shadow-sm">${les.saat}</span>
                                    <span class="text-sm font-bold text-gray-800 dark:text-gray-200">${escapeHtml((is8thGrade && les.dersAdi === "Sosyal Bilgiler") ? "İnkılap Tarihi" : les.dersAdi)}</span>
                                </div>
                                <div class="flex gap-2">
                                    <button onclick="editScheduleLesson(${realIdx})" class="text-blue-500 hover:text-blue-700 p-1" title="Düzenle">
                                        <i class="fas fa-edit text-xs"></i>
                                    </button>
                                    <button onclick="deleteScheduleLesson(${realIdx})" class="text-red-500 hover:text-red-750 p-1" title="Sil">
                                        <i class="fas fa-trash-alt text-xs"></i>
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
                
                return `
                    <div class="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col gap-2">
                        <div class="flex items-center justify-between border-b dark:border-gray-700 pb-2 mb-1">
                            <h4 class="font-bold text-sm text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                                <i class="fas fa-calendar-day text-xs"></i> ${gun}
                            </h4>
                            <span class="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-black px-1.5 py-0.5 rounded-md">${dayLessons.length} Ders</span>
                        </div>
                        <div class="space-y-2">
                            ${dayLessonsHtml}
                        </div>
                    </div>
                `;
            }).join('');
            
            studentScheduleHtml = `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    ${cardsHtml}
                </div>
            `;
        }
        
        const allSchedules = [];
        for (let s of students) {
            let sch = loadSchedule(s.id);
            for (let item of sch) {
                allSchedules.push({
                    ogrenciAd: s.adSoyad,
                    ogrenciId: s.id,
                    gun: item.gun,
                    saat: item.saat,
                    dersAdi: item.dersAdi,
                    sinif: (String(s.sinif).trim() === "8" || (s.adSoyad && s.adSoyad.includes("(8)"))) ? "8" : s.sinif
                });
            }
        }
        
        const uniqueHoursAll = [];
        allSchedules.forEach(s => {
            if (s.saat && !uniqueHoursAll.includes(s.saat)) {
                uniqueHoursAll.push(s.saat);
            }
        });
        uniqueHoursAll.sort((a, b) => a.localeCompare(b));
        
        let allMatrixHtml = '';
        if (uniqueHoursAll.length === 0) {
            allMatrixHtml = `
                <tr>
                    <td colspan="8" class="text-center p-8 text-gray-500 dark:text-gray-400 font-bold text-base bg-gray-50/50 dark:bg-gray-900/10">
                        📅 Sistemde tanımlı hiçbir ders bulunmamaktadır.
                    </td>
                </tr>
            `;
        } else {
            allMatrixHtml = uniqueHoursAll.map(saat => {
                const dayCellsHtml = gunler.map(gun => {
                    const matchingLessons = allSchedules.filter(l => l.gun === gun && l.saat === saat);
                    if (matchingLessons.length > 0) {
                        const lessonBlocks = matchingLessons.map(les => {
                            const isClash = matchingLessons.length > 1;
                            const bgClass = isClash ? "bg-teal-50/40 dark:bg-teal-950/10 border-teal-100" : "bg-teal-50 dark:bg-teal-950/20 border-teal-200";
                            const textClass = isClash ? "text-sm" : "text-xs";
                            return `
                                <div class="${bgClass} border dark:border-teal-900/30 rounded-lg p-2 text-center flex flex-col gap-1 shadow-sm mb-1 last:mb-0">
                                    <span class="${textClass} font-bold text-teal-850 dark:text-teal-300">🎓 ${escapeHtml(les.ogrenciAd)}</span>
                                    <span class="text-sm font-bold text-gray-900 dark:text-gray-100">${escapeHtml((String(les.sinif).trim() === "8" && les.dersAdi === "Sosyal Bilgiler") ? "İnkılap Tarihi" : les.dersAdi)}</span>
                                </div>
                            `;
                        }).join('');
                        
                        return `
                            <td class="border border-gray-400 dark:border-gray-650 p-2 bg-teal-50/10 dark:bg-teal-950/5 vertical-middle min-w-[150px]">
                                <div class="space-y-1">
                                    ${lessonBlocks}
                                </div>
                            </td>
                        `;
                    } else {
                        return `<td class="border border-gray-400 dark:border-gray-650 p-3 text-center min-w-[150px] bg-white dark:bg-gray-800 text-gray-300 dark:text-gray-600 font-bold text-base">—</td>`;
                    }
                }).join('');
                
                return `
                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-750/20 transition">
                        <td class="border border-gray-400 dark:border-gray-650 p-3 font-bold text-center text-base bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-150 min-w-[100px]">${saat}</td>
                        ${dayCellsHtml}
                    </tr>
                `;
            }).join('');
        }
        
        const html = `
            <div class="space-y-8">
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700">
                    <div class="flex justify-between items-center mb-6 flex-wrap gap-4 border-b dark:border-gray-750 pb-3">
                        <div>
                            <h2 class="text-2xl font-black text-gray-850 dark:text-white flex items-center gap-2">
                                <i class="fas fa-calendar-alt text-indigo-600 dark:text-indigo-400"></i> Ders Programı Düzenle
                            </h2>
                            <p class="text-sm text-gray-500 dark:text-gray-400 font-semibold">Öğrencinin haftalık ders çizelgesini görüntüleyin, ekleyin ve düzenleyin.</p>
                        </div>
                        <div class="flex items-center gap-3 flex-wrap">
                            <div class="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border dark:border-gray-700">
                                <button onclick="setScheduleViewMode('excel')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${viewMode === 'excel' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-750 dark:hover:text-gray-300'}">
                                    <i class="fas fa-table"></i> Excel Çizelgesi
                                </button>
                                <button onclick="setScheduleViewMode('agenda')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${viewMode === 'agenda' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-750 dark:hover:text-gray-300'}">
                                    <i class="fas fa-th-list"></i> Ajanda (Kart)
                                </button>
                            </div>
                            <div class="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-1.5 rounded-xl border dark:border-gray-700">
                                <label class="text-xs font-black text-gray-600 dark:text-gray-450 whitespace-nowrap">Öğrenci:</label>
                                <select id="scheduleStudentSelect" class="student-form-input text-xs font-bold py-1 px-3 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-lg" style="width: auto !important; padding: 4px 10px !important;">
                                    ${students.map(s => `<option value="${s.id}" ${s.id === selectedStudentId ? 'selected' : ''}>${escapeHtml(s.adSoyad)} (${escapeHtml(s.okul)})</option>`).join('')}
                                </select>
                            </div>
                            <button onclick="showAddScheduleModal('${selectedStudentId}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow min-h-[44px]">
                                <i class="fas fa-plus-circle"></i> Ders Ekle
                            </button>
                        </div>
                    </div>
                    
                    ${studentScheduleHtml}
                </div>
                
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700">
                    <div class="mb-6 border-b dark:border-gray-750 pb-3">
                        <h2 class="text-2xl font-black text-gray-850 dark:text-white flex items-center gap-2">
                            <i class="fas fa-users text-purple-600 dark:text-purple-400"></i> Tüm Öğrencilerin Haftalık Ders Programı
                        </h2>
                        <p class="text-sm text-gray-500 dark:text-gray-400 font-semibold">Tüm öğrencilerin haftalık program yoğunluğunu tek bir çizelgede takip edin.</p>
                    </div>
                    
                    <div class="overflow-x-auto rounded-xl border border-gray-400 dark:border-gray-650 shadow-lg">
                        <table class="w-full border-collapse border-spacing-0 text-left">
                            <thead>
                                <tr class="bg-purple-700 text-white text-sm">
                                    <th class="border border-gray-400 dark:border-gray-650 p-3.5 text-center font-bold w-[100px]">Saat</th>
                                    ${gunler.map(g => `<th class="border border-gray-400 dark:border-gray-650 p-3.5 text-center font-bold min-w-[150px]">${g}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody class="text-sm">
                                ${allMatrixHtml}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById("dynamic-content").innerHTML = html;
        
        const selectEl = document.getElementById("scheduleStudentSelect");
        if (selectEl) {
            selectEl.addEventListener("change", (e) => { 
                selectedStudentId = e.target.value; 
                lessons = loadSchedule(selectedStudentId); 
                buildUI(); 
            });
        }
        
        window.editScheduleLesson = (idx) => { 
            const les = lessons[idx]; 
            const yeniGun = prompt("Gün (Pazartesi, Salı...):", les.gun); 
            const yeniSaat = prompt("Saat (HH:MM):", les.saat); 
            const yeniDers = prompt("Ders Adı:", les.dersAdi); 
            if (yeniGun && yeniSaat && yeniDers) { 
                const conflict = lessons.some((l, i) => i !== idx && l.gun === yeniGun && l.saat === yeniSaat); 
                if (conflict) { 
                    alert("Bu gün ve saatte başka bir ders var!"); 
                    return; 
                } 
                lessons[idx] = { gun: yeniGun, saat: yeniSaat, dersAdi: yeniDers }; 
                saveSchedule(selectedStudentId, lessons); 
                buildUI(); 
            } 
        };
        
        window.deleteScheduleLesson = (idx) => { 
            if (confirm("Bu dersi silmek istediğinize emin misiniz?")) { 
                lessons.splice(idx, 1); 
                saveSchedule(selectedStudentId, lessons); 
                buildUI(); 
            } 
        };
        
        window.setScheduleViewMode = (mode) => {
            viewMode = mode;
            localStorage.setItem('scheduleViewMode', mode);
            buildUI();
        };
    }
    buildUI();
}

export function showAddScheduleModal(studentId, defaultDay = "Pazartesi") {
    const gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    const is8thGrade = student && (String(student.sinif).trim() === "8" || (student.adSoyad && student.adSoyad.includes("(8)")));
    const saatler = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            saatler.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
        }
    }
    const modalHtml = `
        <div id="addScheduleModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onclick="if(event.target===this) closeAddScheduleModal()">
            <div class="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 dark:border-gray-700" onclick="event.stopPropagation()">
                <h2 class="text-xl font-bold mb-4">📅 Yeni Ders Ekle</h2>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">Gün</label>
                        <select id="modalScheduleDay" class="student-form-input min-h-[44px]">
                            ${gunler.map(g => `<option value="${g}" ${g === defaultDay ? 'selected' : ''}>${g}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Saat</label>
                        <select id="modalScheduleTime" class="student-form-input min-h-[44px]">
                            ${saatler.map(s => `<option value="${s}">${s}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Ders Adı</label>
                        <select id="modalScheduleLessonName" class="student-form-input min-h-[44px]">
                            ${(store.teacherBranches || ["Türkçe", "Matematik", "Fen Bilimleri", "Sosyal Bilgiler"]).map(b => {
                                const displayName = (is8thGrade && b === "Sosyal Bilgiler") ? "İnkılap Tarihi" : b;
                                return `<option value="${b}">${displayName}</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <button onclick="addScheduleFromModal('${studentId}')" class="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white py-3 rounded-xl font-bold mt-2 shadow-md min-h-[44px]">Ekle</button>
                    <button onclick="closeAddScheduleModal()" class="w-full border border-gray-300 dark:border-gray-600 py-3 rounded-xl font-semibold min-h-[44px]">İptal</button>
                </div>
            </div>
        </div>`;
    const existing = document.getElementById('addScheduleModal');
    if (existing) existing.remove();
    const modalDiv = document.createElement('div');
    modalDiv.id = 'addScheduleModal';
    modalDiv.innerHTML = modalHtml;
    document.body.appendChild(modalDiv);
}

export function closeAddScheduleModal() {
    document.getElementById('addScheduleModal')?.remove();
}

export function addScheduleFromModal(studentId) {
    const gun = document.getElementById('modalScheduleDay')?.value;
    const saat = document.getElementById('modalScheduleTime')?.value;
    const dersAdi = document.getElementById('modalScheduleLessonName')?.value.trim();
    if (!dersAdi) {
        alert("Ders adı giriniz");
        return;
    }
    const lessons = loadSchedule(studentId);
    const conflict = lessons.some(lesson => lesson.gun === gun && lesson.saat === saat);
    if (conflict) {
        alert("Bu gün ve saatte zaten bir ders var!");
        return;
    }
    lessons.push({ gun, saat, dersAdi });
    saveSchedule(studentId, lessons);
    closeAddScheduleModal();
    renderSchedulePage();
}

// Bind to window for global accessibility
window.renderSchedulePage = renderSchedulePage;
window.showAddScheduleModal = showAddScheduleModal;
window.closeAddScheduleModal = closeAddScheduleModal;
window.addScheduleFromModal = addScheduleFromModal;

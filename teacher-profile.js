import { store, escapeHtml } from './store.js';
import { restoreNavigationLayout } from './auth.js';

export const TEACHER_PROFILE_COMPLETED_KEY = 'teacher_profile_completed_v1';
export const TEACHER_BRANCHES = ['Türkçe', 'Matematik', 'Fen Bilimleri', 'Sosyal Bilgiler'];

function getStoredBranches() {
    try {
        const branches = JSON.parse(localStorage.getItem('teacher_branches_v1') || '[]');
        return Array.isArray(branches) ? branches.filter(branch => TEACHER_BRANCHES.includes(branch)) : [];
    } catch (_) {
        return [];
    }
}

export function validateTeacherProfile(profile) {
    const name = String(profile?.name || '').trim().replace(/\s+/g, ' ');
    const school = String(profile?.school || '').trim().replace(/\s+/g, ' ');
    const branches = Array.isArray(profile?.branches)
        ? [...new Set(profile.branches.filter(branch => TEACHER_BRANCHES.includes(branch)))]
        : [];

    if (name === 'Öğretmen Adı' || name.split(' ').filter(Boolean).length < 2) {
        return { valid: false, message: 'Lütfen adınızı ve soyadınızı birlikte yazın.' };
    }
    if (school === 'Belirtilmemiş Okul' || school.length < 2) {
        return { valid: false, message: 'Lütfen çalıştığınız okul veya kurumun adını yazın.' };
    }
    if (branches.length === 0) {
        return { valid: false, message: 'Lütfen verebildiğiniz en az bir dersi seçin.' };
    }
    return { valid: true, profile: { name, school, branches } };
}

export function getTeacherProfile() {
    return {
        name: localStorage.getItem('teacher_name_v1') || '',
        school: localStorage.getItem('teacher_school_v1') || '',
        branches: getStoredBranches()
    };
}

export function hasCompleteTeacherProfile() {
    const result = validateTeacherProfile(getTeacherProfile());
    if (!result.valid) return false;

    // Existing users with complete settings should not be asked for the same data again.
    if (localStorage.getItem(TEACHER_PROFILE_COMPLETED_KEY) !== 'true') {
        localStorage.setItem(TEACHER_PROFILE_COMPLETED_KEY, 'true');
    }
    return true;
}

async function persistTeacherProfile(profile) {
    localStorage.setItem('teacher_name_v1', profile.name);
    localStorage.setItem('teacher_school_v1', profile.school);
    localStorage.setItem('teacher_branches_v1', JSON.stringify(profile.branches));
    localStorage.setItem(TEACHER_PROFILE_COMPLETED_KEY, 'true');
    store.teacherName = profile.name;
    store.teacherSchool = profile.school;
    store.teacherBranches = profile.branches;

    if (window.isFirebaseActive && window.auth?.currentUser && window.db) {
        await window.db.collection('users').doc(window.auth.currentUser.uid).set({
            name: profile.name,
            school: profile.school,
            branches: profile.branches,
            email: window.auth.currentUser.email,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    }
}

function setNavigationVisible(visible) {
    const sidebar = document.querySelector('#app-root > div.hidden.md\\:flex');
    const bottomNav = document.querySelector('#app-root > div.flex.md\\:hidden');
    if (sidebar) sidebar.style.display = visible ? '' : 'none';
    if (bottomNav) bottomNav.style.display = visible ? '' : 'none';
    const mainContent = document.querySelector('#app-root > div.w-full.md\\:w-3\\/4');
    if (mainContent && !visible) mainContent.className = 'w-full p-5 md:p-8 overflow-y-auto';
}

function branchOptions(selectedBranches, prefix) {
    return TEACHER_BRANCHES.map((branch, index) => `
        <label class="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-3 cursor-pointer hover:border-indigo-400 transition">
            <input type="checkbox" id="${prefix}-${index}" name="teacherBranch" value="${branch}" ${selectedBranches.includes(branch) ? 'checked' : ''} class="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500">
            <span class="text-sm font-bold text-gray-700 dark:text-gray-200">${branch}</span>
        </label>
    `).join('');
}

export function renderTeacherProfileSetup() {
    store.currentPage = 'teacherProfileSetup';
    setNavigationVisible(false);
    const current = getTeacherProfile();
    document.getElementById('dynamic-content').innerHTML = `
        <div class="max-w-2xl mx-auto py-4 md:py-10">
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 md:p-8">
                    <div class="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-2xl mb-4"><i class="fas fa-chalkboard-teacher"></i></div>
                    <h1 class="text-2xl font-black">Öğretmen Profilinizi Oluşturun</h1>
                    <p class="text-sm text-indigo-100 mt-2">Canfenci'yi size uygun hazırlamak için bu bilgileri bir kez doldurun. Daha sonra Ayarlar'dan değiştirebilirsiniz.</p>
                </div>
                <form onsubmit="submitTeacherProfile(event)" class="p-6 md:p-8 space-y-6" novalidate>
                    <div>
                        <label for="profileTeacherName" class="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">Ad ve Soyad <span class="text-red-500">*</span></label>
                        <input id="profileTeacherName" type="text" autocomplete="name" maxlength="80" value="${escapeHtml(current.name)}" placeholder="Örneğin: Murat Canbaş" class="student-form-input" required>
                    </div>
                    <div>
                        <label for="profileTeacherSchool" class="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">Çalıştığınız Okul / Kurum <span class="text-red-500">*</span></label>
                        <input id="profileTeacherSchool" type="text" autocomplete="organization" maxlength="120" value="${escapeHtml(current.school)}" placeholder="Okul veya kurum adı" class="student-form-input" required>
                    </div>
                    <fieldset>
                        <legend class="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">Verebildiğiniz Dersler <span class="text-red-500">*</span></legend>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${branchOptions(current.branches, 'profile-branch')}</div>
                    </fieldset>
                    <div id="teacherProfileError" role="alert" class="hidden rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-300"></div>
                    <p class="text-xs text-gray-500 dark:text-gray-400"><i class="fas fa-mobile-alt mr-1"></i> Bu bilgiler şimdilik yalnızca bu cihazda saklanır.</p>
                    <button type="submit" class="w-full min-h-[48px] rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black shadow-lg transition">Profili Kaydet ve Başla</button>
                </form>
            </div>
        </div>`;
    document.getElementById('profileTeacherName')?.focus();
}

function readProfileForm(nameId, schoolId, checkboxSelector) {
    return validateTeacherProfile({
        name: document.getElementById(nameId)?.value,
        school: document.getElementById(schoolId)?.value,
        branches: [...document.querySelectorAll(checkboxSelector)].filter(input => input.checked).map(input => input.value)
    });
}

export async function submitTeacherProfile(event) {
    event?.preventDefault();
    const result = readProfileForm('profileTeacherName', 'profileTeacherSchool', 'input[name="teacherBranch"]');
    const error = document.getElementById('teacherProfileError');
    if (!result.valid) {
        if (error) {
            error.textContent = result.message;
            error.classList.remove('hidden');
        }
        return;
    }

    try {
        await persistTeacherProfile(result.profile);
        restoreNavigationLayout();
        window.renderReminderHome?.();
    } catch (err) {
        if (error) {
            error.textContent = 'Profil kaydedilemedi. Lütfen tekrar deneyin.';
            error.classList.remove('hidden');
        }
        console.error('Teacher profile save failed:', err);
    }
}

export async function saveTeacherProfileFromSettings() {
    const result = readProfileForm('teacherNameInput', 'teacherSchoolInput', 'input[name="settingsTeacherBranch"]');
    const feedback = document.getElementById('branchSettingsFeedback');
    if (!result.valid) {
        if (feedback) {
            feedback.textContent = result.message;
            feedback.className = 'text-xs text-red-600 dark:text-red-400 mt-2 font-semibold';
        }
        return;
    }

    try {
        await persistTeacherProfile(result.profile);
        if (feedback) {
            feedback.innerHTML = '<i class="fas fa-check-circle"></i> Öğretmen profiliniz kaydedildi.';
            feedback.className = 'text-xs text-green-600 dark:text-green-400 mt-2 font-semibold flex items-center gap-1';
        }
    } catch (err) {
        if (feedback) {
            feedback.textContent = 'Profil kaydedilemedi. Lütfen tekrar deneyin.';
            feedback.className = 'text-xs text-red-600 dark:text-red-400 mt-2 font-semibold';
        }
        console.error('Teacher profile settings save failed:', err);
    }
}

export function ensureTeacherProfile() {
    if (hasCompleteTeacherProfile()) return true;
    renderTeacherProfileSetup();
    return false;
}

window.ensureTeacherProfile = ensureTeacherProfile;
window.renderTeacherProfileSetup = renderTeacherProfileSetup;
window.submitTeacherProfile = submitTeacherProfile;
window.saveTeacherProfileFromSettings = saveTeacherProfileFromSettings;

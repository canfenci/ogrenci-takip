import { STORAGE_KEY, SCHEDULE_KEY, DERS_KAYITLARI_KEY, GROUPS_KEY, escapeHtml } from './store.js';

const ACCOUNT_COLLECTIONS = ['homeworks', 'schedules', 'lessons', 'groups', 'resourceBooks', 'students'];

export function showAccountDeletionDialog() {
    const user = window.auth?.currentUser;
    if (!user || window.store?.isGuestMode) return;
    document.getElementById('accountDeletionModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'accountDeletionModal';
    modal.className = 'fixed inset-0 z-[110] bg-gray-950/70 backdrop-blur-sm p-4 flex items-center justify-center';
    modal.innerHTML = `
        <section role="dialog" aria-modal="true" aria-labelledby="accountDeletionTitle" class="app-modal bg-white dark:bg-gray-800 w-full max-w-lg max-h-[92vh] overflow-y-auto border border-red-200 dark:border-red-900 p-5 md:p-6">
            <div class="flex items-start justify-between gap-4">
                <div><p class="text-xs font-black uppercase tracking-wider text-red-600">Geri alınamaz işlem</p><h2 id="accountDeletionTitle" class="text-xl font-black text-gray-900 dark:text-white mt-1">Hesabı ve Bulut Verilerini Sil</h2></div>
                <button type="button" onclick="closeAccountDeletionDialog()" class="min-w-[44px] min-h-[44px] rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Hesap silme penceresini kapat"><i class="fas fa-times"></i></button>
            </div>
            <div class="mt-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/15 p-4 text-sm text-red-800 dark:text-red-200">
                Öğrenciler, ödevler, ders kayıtları, programlar, gruplar, kaynak kitaplar ve öğretmen profili kalıcı olarak silinir. İşlem tamamlandıktan sonra hesap yeniden açılsa bile bu veriler geri getirilemez.
            </div>
            <button type="button" onclick="exportBackup()" class="mt-4 w-full min-h-[44px] rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold"><i class="fas fa-download mr-1"></i> Önce Tam Veri Yedeğini İndir</button>
            <p class="mt-1 text-xs text-gray-500">Yedek; öğrencileri, ödevleri, ders kayıtlarını, programları, grupları, kaynak kitapları ve öğretmen profilini içerir. Kişisel veri içerdiği için dosyayı güvenli bir yerde saklayın.</p>
            <div class="mt-5 space-y-3">
                <div><label for="deleteAccountEmail" class="block text-xs font-bold mb-1">Açık hesabın e-posta adresi</label><input id="deleteAccountEmail" type="email" autocomplete="off" class="student-form-input" placeholder="${escapeHtml(user.email || '')}"></div>
                <div><label for="deleteAccountPassword" class="block text-xs font-bold mb-1">Mevcut şifre</label><input id="deleteAccountPassword" type="password" autocomplete="current-password" class="student-form-input" placeholder="Mevcut şifreniz"></div>
                <div><label for="deleteAccountPhrase" class="block text-xs font-bold mb-1">Onay için <strong>HESABIMI SİL</strong> yazın</label><input id="deleteAccountPhrase" type="text" autocomplete="off" class="student-form-input" placeholder="HESABIMI SİL"></div>
                <label class="flex items-start gap-2 rounded-xl border border-gray-200 dark:border-gray-700 p-3"><input id="deleteAccountIrreversible" type="checkbox" class="mt-0.5 w-5 h-5 rounded text-red-600 focus:ring-red-500"><span class="text-xs leading-5">Bu işlemin geri alınamayacağını ve bulut verilerimin kalıcı olarak silineceğini anlıyorum.</span></label>
            </div>
            <p id="accountDeletionFeedback" class="hidden mt-3 text-sm font-semibold" role="status"></p>
            <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button type="button" onclick="closeAccountDeletionDialog()" class="min-h-[46px] rounded-xl border border-gray-300 dark:border-gray-600 font-bold">Vazgeç</button>
                <button id="confirmAccountDeletionButton" type="button" onclick="deleteCurrentAccountAndData()" class="min-h-[46px] rounded-xl bg-red-600 hover:bg-red-700 text-white font-black"><i class="fas fa-trash-alt mr-1"></i> Kalıcı Olarak Sil</button>
            </div>
        </section>`;
    document.body.appendChild(modal);
    document.getElementById('deleteAccountEmail')?.focus();
}

export function closeAccountDeletionDialog() {
    const button = document.getElementById('confirmAccountDeletionButton');
    if (button?.disabled) return;
    document.getElementById('accountDeletionModal')?.remove();
}

async function deleteOwnedCollection(collectionName, userId) {
    const snapshot = await window.db.collection(collectionName).where('userId', '==', userId).get();
    const documents = snapshot.docs;
    for (let offset = 0; offset < documents.length; offset += 400) {
        const batch = window.db.batch();
        documents.slice(offset, offset + 400).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
    return documents.length;
}

function clearDeletedAccountLocalData() {
    [
        STORAGE_KEY,
        SCHEDULE_KEY,
        DERS_KAYITLARI_KEY,
        GROUPS_KEY,
        'resource_books_v1',
        'teacher_name_v1',
        'teacher_school_v1',
        'teacher_branches_v1',
        'teacher_profile_completed_v1',
        'lesson_reminder_settings_v1',
        'lesson_reminder_history_v1',
        'canfenci_local_data_owner_uid_v1'
    ].forEach(key => localStorage.removeItem(key));
}

export async function deleteCurrentAccountAndData() {
    const user = window.auth?.currentUser;
    const feedback = document.getElementById('accountDeletionFeedback');
    const button = document.getElementById('confirmAccountDeletionButton');
    if (!user || !feedback || !button) return;

    const email = document.getElementById('deleteAccountEmail')?.value.trim();
    const password = document.getElementById('deleteAccountPassword')?.value || '';
    const phrase = document.getElementById('deleteAccountPhrase')?.value.trim().toLocaleUpperCase('tr-TR');
    const irreversible = document.getElementById('deleteAccountIrreversible')?.checked;
    const expectedEmail = String(user.email || '').trim().toLocaleLowerCase('tr-TR');

    if (email.toLocaleLowerCase('tr-TR') !== expectedEmail || !password || phrase !== 'HESABIMI SİL' || !irreversible) {
        feedback.textContent = 'E-posta, mevcut şifre, onay ifadesi ve geri alınamaz işlem kutusunu eksiksiz doğrulayın.';
        feedback.className = 'mt-3 text-sm font-semibold text-red-600 dark:text-red-400';
        return;
    }

    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Silme işlemi yürütülüyor';
    feedback.textContent = 'Kimliğiniz yeniden doğrulanıyor…';
    feedback.className = 'mt-3 text-sm font-semibold text-indigo-600 dark:text-indigo-300';

    try {
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
        await user.reauthenticateWithCredential(credential);
        feedback.textContent = 'Bulut kayıtları güvenli sırayla siliniyor. Bu pencereyi kapatmayın…';

        window.resetFirestoreSync?.();
        for (const collectionName of ACCOUNT_COLLECTIONS) {
            await deleteOwnedCollection(collectionName, user.uid);
        }
        await window.db.collection('users').doc(user.uid).delete();
        await user.delete();
        clearDeletedAccountLocalData();

        feedback.textContent = 'Hesap ve bulut verileri silindi. Giriş ekranına yönlendiriliyorsunuz…';
        feedback.className = 'mt-3 text-sm font-semibold text-green-600 dark:text-green-400';
        setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
        console.error('Account deletion failed:', err);
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            feedback.textContent = 'Mevcut şifre doğru değil. Hiçbir silme işlemi başlatılmadı.';
        } else if (err.code === 'auth/too-many-requests') {
            feedback.textContent = 'Çok fazla doğrulama denemesi yapıldı. Bir süre bekleyip tekrar deneyin.';
        } else {
            feedback.textContent = 'İşlem tamamlanamadı. Hesabın durumunu kontrol edin ve destek için cnmrt84@gmail.com adresine başvurun.';
        }
        feedback.className = 'mt-3 text-sm font-semibold text-red-600 dark:text-red-400';
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-trash-alt mr-1"></i> Kalıcı Olarak Sil';
    }
}

window.showAccountDeletionDialog = showAccountDeletionDialog;
window.closeAccountDeletionDialog = closeAccountDeletionDialog;
window.deleteCurrentAccountAndData = deleteCurrentAccountAndData;

export const RESOURCE_BOOKS_KEY = 'resource_books_v1';
export const MANUAL_RESOURCE_VALUE = '__manual__';

function storageKey() {
    return window.store?.isGuestMode ? `canfenci_guest_v1__${RESOURCE_BOOKS_KEY}` : RESOURCE_BOOKS_KEY;
}

export function loadResourceBooks() {
    if (!window.store?.isGuestMode && window.store?.useFirestore && window.isFirebaseActive) {
        return (window.store.globalResourceBooks || []).map(book => ({ ...book }));
    }
    try {
        const books = JSON.parse(localStorage.getItem(storageKey())) || [];
        return Array.isArray(books) ? books : [];
    } catch {
        return [];
    }
}

export function saveResourceBooks(books) {
    if (!window.store?.isGuestMode && window.store?.useFirestore && window.isFirebaseActive && window.db && window.auth?.currentUser) {
        const user = window.auth.currentUser;
        const previousBooks = window.store.globalResourceBooks || [];
        const nextIds = new Set(books.map(book => book.id));
        window.store.globalResourceBooks = books.map(book => ({ ...book, userId: user.uid }));

        books.forEach(book => {
            const bookData = { ...book, userId: user.uid };
            window.db.collection('resourceBooks').doc(`${user.uid}_${book.id}`).set(bookData).catch(err => {
                console.error('Resource book cloud save failed:', err);
                window.handleFirebaseError?.(err);
            });
        });
        previousBooks.filter(book => !nextIds.has(book.id)).forEach(book => {
            window.db.collection('resourceBooks').doc(`${user.uid}_${book.id}`).delete().catch(err => {
                console.error('Resource book cloud delete failed:', err);
                window.handleFirebaseError?.(err);
            });
        });
        window.showSyncStatus?.('Kaynak kitaplar bulutla eşitlendi.', false);
        return;
    }
    localStorage.setItem(storageKey(), JSON.stringify(books));
}

export function getResourceBooks(grade, subject) {
    return loadResourceBooks()
        .filter(book => String(book.grade) === String(grade) && (!subject || book.subject === subject))
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

export function addResourceBook({ grade, subject, name }) {
    const cleanName = String(name || '').trim();
    if (!grade || !subject || !cleanName) return { ok: false, error: 'Sınıf, ders ve kaynak kitap adı zorunludur.' };
    const books = loadResourceBooks();
    const duplicate = books.some(book => String(book.grade) === String(grade) && book.subject === subject && book.name.toLocaleLowerCase('tr') === cleanName.toLocaleLowerCase('tr'));
    if (duplicate) return { ok: false, error: 'Bu kaynak kitap aynı sınıf ve ders için zaten kayıtlı.' };
    books.push({ id: `resource_${Date.now()}`, grade: String(grade), subject, name: cleanName });
    saveResourceBooks(books);
    return { ok: true };
}

export function deleteResourceBook(id) {
    saveResourceBooks(loadResourceBooks().filter(book => book.id !== id));
}

export function resourceOptionsHtml(grade, subject, escapeHtml, selected = '') {
    const options = getResourceBooks(grade, subject)
        .map(book => `<option value="${escapeHtml(book.name)}" ${book.name === selected ? 'selected' : ''}>${escapeHtml(book.name)}</option>`)
        .join('');
    return `<option value="">Kaynak kitap seçin</option>${options}<option value="${MANUAL_RESOURCE_VALUE}">✍️ Manuel gir</option>`;
}

export function readResourceSelection(selectId, manualInputId) {
    const selected = document.getElementById(selectId)?.value || '';
    return selected === MANUAL_RESOURCE_VALUE ? document.getElementById(manualInputId)?.value.trim() || '' : selected;
}

export function toggleManualResource(selectId, manualAreaId) {
    const isManual = document.getElementById(selectId)?.value === MANUAL_RESOURCE_VALUE;
    document.getElementById(manualAreaId)?.classList.toggle('hidden', !isManual);
}

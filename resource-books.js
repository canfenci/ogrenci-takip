export const RESOURCE_BOOKS_KEY = 'resource_books_v1';
export const MANUAL_RESOURCE_VALUE = '__manual__';

export function loadResourceBooks() {
    try {
        const books = JSON.parse(localStorage.getItem(RESOURCE_BOOKS_KEY)) || [];
        return Array.isArray(books) ? books : [];
    } catch {
        return [];
    }
}

export function saveResourceBooks(books) {
    localStorage.setItem(RESOURCE_BOOKS_KEY, JSON.stringify(books));
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

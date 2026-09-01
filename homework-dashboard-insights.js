// Ödev Panosu için salt-okunur selector ve tarih hesapları.
// Mevcut ödev veri modelini değiştirmez.

function toLocalIsoDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function daysBetween(from, to) {
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    const difference = Math.round((end - start) / 86400000);
    return Number.isFinite(difference) ? difference : null;
}

export function getHomeworkDueState(homework, today = toLocalIsoDate()) {
    const completed = homework?.durum === 'tamamlandi';
    const dueDate = String(homework?.bitisTarihi || '');
    if (completed) return { key: 'completed', label: 'Tamamlandı', daysRemaining: null };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { key: 'active', label: 'Aktif', daysRemaining: null };
    const daysRemaining = daysBetween(today, dueDate);
    if (daysRemaining < 0) return { key: 'overdue', label: 'Gecikti', daysRemaining };
    if (daysRemaining === 0) return { key: 'today', label: 'Bugün teslim', daysRemaining };
    if (daysRemaining <= 3) return { key: 'upcoming', label: daysRemaining === 1 ? 'Yarın teslim' : `${daysRemaining} gün kaldı`, daysRemaining };
    return { key: 'active', label: 'Aktif', daysRemaining };
}

export function buildHomeworkDashboard(students = [], getHomeworks, today = toLocalIsoDate()) {
    const records = students.flatMap(student => (getHomeworks(student) || []).map(homework => ({
        homework,
        student,
        due: getHomeworkDueState(homework, today)
    })));
    const count = key => records.filter(record => record.due.key === key).length;
    const completed = count('completed');
    return {
        records,
        today,
        metrics: {
            total: records.length,
            active: records.filter(record => record.due.key !== 'completed').length,
            overdue: count('overdue'),
            dueToday: count('today'),
            upcoming: count('upcoming'),
            completed,
            completionRate: records.length ? Math.round((completed / records.length) * 100) : null
        }
    };
}

export function filterHomeworkDashboard(records = [], { status = 'all', query = '', grade = '', studentId = '' } = {}) {
    const normalizedQuery = String(query).trim().toLocaleLowerCase('tr-TR');
    return records.filter(record => {
        const matchesStatus = status === 'all' || record.due.key === status || (status === 'active' && ['active', 'today', 'upcoming', 'overdue'].includes(record.due.key));
        const matchesGrade = !grade || String(record.student.sinif || '') === String(grade);
        const matchesStudent = !studentId || record.student.id === studentId;
        const searchable = [record.student.adSoyad, record.homework.konu, record.homework.calismaDetayi, record.homework.yayin, record.homework.tur].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR');
        return matchesStatus && matchesGrade && matchesStudent && (!normalizedQuery || searchable.includes(normalizedQuery));
    }).sort((a, b) => {
        const statusWeight = { overdue: 0, today: 1, upcoming: 2, active: 3, completed: 4 };
        return (statusWeight[a.due.key] ?? 5) - (statusWeight[b.due.key] ?? 5)
            || String(a.homework.bitisTarihi || '9999-12-31').localeCompare(String(b.homework.bitisTarihi || '9999-12-31'));
    });
}

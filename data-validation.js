export function normalizeTurkishPhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (/^0?5\d{9}$/.test(digits)) return digits.startsWith('0') ? digits : `0${digits}`;
    if (/^905\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
    return null;
}

export function validateStudentInput(input) {
    const errors = [];
    const name = String(input.name || '').trim().replace(/\s+/g, ' ');
    const school = String(input.school || '').trim().replace(/\s+/g, ' ');
    const target = String(input.target || '').trim();
    const net = Number(input.net);
    const fee = input.fee === '' ? 0 : Number(input.fee);
    const phone = normalizeTurkishPhone(input.phone);
    if (name.length < 2) errors.push('Ad soyad en az 2 karakter olmalıdır.');
    if (school.length < 2) errors.push('Okul en az 2 karakter olmalıdır.');
    if (!['5', '6', '7', '8'].includes(String(input.grade))) errors.push('Geçerli bir sınıf seçilmelidir.');
    if (!target) errors.push('Hedef lise seçilmelidir.');
    if (!Number.isFinite(net) || net <= 0 || net > 90) errors.push('Hedef net 0 ile 90 arasında olmalıdır.');
    if (!Number.isFinite(fee) || fee < 0) errors.push('Ders ücreti negatif olamaz.');
    if (phone === null) errors.push('Veli telefonu 05xx xxx xx xx biçiminde olmalıdır.');
    return { valid: errors.length === 0, errors, values: { name, school, grade: String(input.grade || ''), target, net, fee: fee || '', phone: phone || '' } };
}

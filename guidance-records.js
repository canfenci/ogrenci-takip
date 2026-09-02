// ==================== GUIDANCE RECORDS & INTERVENTION LOG MODULE ====================
// Pure and reliable guidance record lifecycle, teacher intervention tracking, and status evaluation.
// Compatible with Firestore / LocalStorage student models without schema migration.

import { store, loadStudentsData, saveStudentsData, escapeHtml } from './store.js';
import {
    getRepeatedWeakTopics,
    getDominantErrorType,
    getRecommendedIntervention,
    formatActivityDate
} from './guidance-center-insights.js';

export const GUIDANCE_RECORD_TYPES = {
    academic: 'Akademik',
    discipline: 'Ödev / Çalışma Disiplini',
    performance: 'Sınav / Performans',
    general: 'Genel Takip'
};

export const GUIDANCE_RECORD_STATUSES = {
    open: 'Takipte',
    completed: 'Tamamlandı'
};

export const GUIDANCE_RESULT_OPTIONS = {
    positive: 'Olumlu',
    neutral: 'Değişim Yok',
    negative: 'Gerileme',
    pending: 'Henüz Ölçülmedi'
};

function safeString(val) {
    return (val !== null && val !== undefined) ? String(val).trim() : '';
}

function isValidDateString(str) {
    if (!str || typeof str !== 'string') return false;
    return /^\d{4}-\d{2}-\d{2}$/.test(str.slice(0, 10));
}

function getTodayIsoDate(now = new Date()) {
    const d = (now instanceof Date && !isNaN(now.getTime())) ? now : new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Normalizes a raw guidance record or legacy note object into the canonical schema.
 */
export function normalizeGuidanceRecord(raw, fallbackStudentId = '') {
    if (!raw || typeof raw !== 'object') return null;

    const studentId = safeString(raw.studentId || fallbackStudentId);
    const id = safeString(raw.id) || `gr_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const createdAt = raw.createdAt && !isNaN(new Date(raw.createdAt).getTime())
        ? new Date(raw.createdAt).toISOString()
        : new Date().toISOString();

    const date = isValidDateString(raw.date)
        ? raw.date.slice(0, 10)
        : createdAt.slice(0, 10);

    const typeKey = (raw.type && GUIDANCE_RECORD_TYPES[raw.type]) ? raw.type : 'academic';
    const typeLabel = GUIDANCE_RECORD_TYPES[typeKey] || 'Akademik';

    // Support legacy notes where note text might be in 'not', 'note', 'text', 'aciklama'
    const issue = safeString(raw.issue || raw.sorun || raw.gozlem || raw.problem || raw.text || raw.aciklama || raw.not || 'Gözlem belirtilmedi');
    const action = safeString(raw.action || raw.mudahale || raw.yapilan || raw.plan || 'Müdahale planlandı');
    const followUpDate = isValidDateString(raw.followUpDate || raw.takipTarihi) ? (raw.followUpDate || raw.takipTarihi).slice(0, 10) : null;
    const note = safeString(raw.note || raw.ekNot || '');

    let result = null;
    let resultLabel = null;
    if (raw.result && GUIDANCE_RESULT_OPTIONS[raw.result]) {
        result = raw.result;
        resultLabel = GUIDANCE_RESULT_OPTIONS[result];
    } else if (raw.sonuc && GUIDANCE_RESULT_OPTIONS[raw.sonuc]) {
        result = raw.sonuc;
        resultLabel = GUIDANCE_RESULT_OPTIONS[result];
    }

    // Pending result can NEVER close a record
    const isPending = (result === 'pending');
    const isExplicitCompleted = (raw.status === 'completed' || raw.durum === 'tamamlandi') && !isPending;
    const status = isExplicitCompleted ? 'completed' : 'open';

    const resultNote = safeString(raw.resultNote || raw.sonucNotu || '');
    const closedAt = (status === 'completed')
        ? (raw.closedAt && !isNaN(new Date(raw.closedAt).getTime()) ? new Date(raw.closedAt).toISOString() : (raw.createdAt || new Date().toISOString()))
        : null;

    return {
        id,
        studentId,
        createdAt,
        date,
        formattedDate: formatActivityDate(date),
        type: typeKey,
        typeLabel,
        issue,
        action,
        followUpDate,
        formattedFollowUpDate: followUpDate ? formatActivityDate(followUpDate) : null,
        note,
        status,
        statusLabel: GUIDANCE_RECORD_STATUSES[status] || 'Takipte',
        result,
        resultLabel,
        resultNote,
        closedAt
    };
}

/**
 * Retrieves all guidance records for a student, including legacy note adapters, sorted newest first.
 */
export function getStudentGuidanceRecords(student) {
    if (!student) return [];

    let rawList = [];

    if (Array.isArray(student.guidanceRecords)) {
        rawList.push(...student.guidanceRecords);
    }
    if (Array.isArray(student.rehberlikKayitlari)) {
        rawList.push(...student.rehberlikKayitlari);
    }
    if (Array.isArray(student.guidanceNotes)) {
        rawList.push(...student.guidanceNotes);
    }
    if (student.rehberlikNotu && typeof student.rehberlikNotu === 'object') {
        rawList.push(student.rehberlikNotu);
    } else if (typeof student.rehberlikNotu === 'string' && student.rehberlikNotu.trim()) {
        rawList.push({
            id: `legacy_note_${student.id}`,
            issue: student.rehberlikNotu,
            action: 'Eski Rehberlik Notu',
            type: 'general',
            status: 'completed',
            createdAt: new Date().toISOString()
        });
    }

    // Deduplicate by ID
    const seen = new Set();
    const normalized = [];
    rawList.forEach(item => {
        const norm = normalizeGuidanceRecord(item, student.id);
        if (norm && !seen.has(norm.id)) {
            seen.add(norm.id);
            normalized.push(norm);
        }
    });

    // Sort newest first by date and createdAt
    normalized.sort((a, b) => {
        const dateCmp = String(b.date).localeCompare(String(a.date));
        if (dateCmp !== 0) return dateCmp;
        return String(b.createdAt).localeCompare(String(a.createdAt));
    });

    return normalized;
}

/**
 * Checks if an open guidance record is due or overdue for follow-up.
 */
export function isGuidanceRecordDue(record, now = new Date()) {
    if (!record || record.status !== 'open') return false;
    if (!record.followUpDate || !isValidDateString(record.followUpDate)) return false;

    const today = getTodayIsoDate(now);
    return record.followUpDate <= today;
}

/**
 * Generates rule-based smart prefill suggestions for a new guidance record form.
 */
export function buildSuggestedPrefill(student, homeworks = null, now = new Date()) {
    if (!student) return { type: 'academic', issue: '', action: '', followUpDate: '' };

    const hwList = (homeworks && homeworks.length) ? homeworks : (student.odevler || []);
    const weakTopics = getRepeatedWeakTopics(student, hwList);
    const dominantError = getDominantErrorType(student, hwList);
    const recommendation = getRecommendedIntervention({ dominantError, repeatedTopic: weakTopics[0] });

    let issue = '';
    let type = 'academic';

    const topWeak = weakTopics[0];
    if (topWeak && dominantError) {
        issue = `${topWeak.topic} konusunda tekrar eden ${dominantError.label.toLocaleLowerCase('tr-TR')} tespiti`;
    } else if (topWeak) {
        issue = `${topWeak.topic} konusunda tekrar eden konu eksikliği (${topWeak.errorCount} hata)`;
    } else if (dominantError) {
        issue = `Genel çalışmalarda baskın olarak ${dominantError.label.toLocaleLowerCase('tr-TR')} gözlendi`;
    }

    let action = '';
    if (recommendation && recommendation.action) {
        action = recommendation.action;
    }

    // Default follow-up date: 7 days later
    const d = (now instanceof Date && !isNaN(now.getTime())) ? new Date(now) : new Date();
    d.setDate(d.getDate() + 7);
    const followUpDate = getTodayIsoDate(d);

    return {
        type,
        issue,
        action,
        followUpDate
    };
}

/**
 * Creates and appends a new guidance record to the student without rewriting legacy fields.
 */
export function createGuidanceRecord(student, { type = 'academic', issue, action, followUpDate = null, note = '' }) {
    if (!student) throw new Error('Student required');
    if (!safeString(issue)) throw new Error('Sorun / Gözlem alanı zorunludur');
    if (!safeString(action)) throw new Error('Planlanan / Uygulanan Müdahale alanı zorunludur');

    const newRecord = normalizeGuidanceRecord({
        studentId: student.id,
        type,
        issue,
        action,
        followUpDate: followUpDate ? String(followUpDate).slice(0, 10) : null,
        note,
        status: 'open',
        createdAt: new Date().toISOString()
    }, student.id);

    if (!Array.isArray(student.guidanceRecords)) {
        student.guidanceRecords = [];
    }

    student.guidanceRecords.unshift(newRecord);
    return newRecord;
}

/**
 * Updates an existing guidance record while preserving createdAt and student isolation.
 */
export function updateGuidanceRecord(student, recordId, updates = {}) {
    if (!student) throw new Error('Student required');
    if (!Array.isArray(student.guidanceRecords)) {
        student.guidanceRecords = [];
    }

    let existing = student.guidanceRecords.find(r => r.id === recordId);
    let index = student.guidanceRecords.findIndex(r => r.id === recordId);

    if (!existing) {
        // Check if it was in legacy records to adapt
        const allRecords = getStudentGuidanceRecords(student);
        existing = allRecords.find(r => r.id === recordId);
    }

    if (!existing) throw new Error('Guidance record not found');

    const merged = {
        ...existing,
        ...updates,
        id: existing.id,
        studentId: student.id,
        createdAt: existing.createdAt // Always preserve createdAt
    };

    const normalized = normalizeGuidanceRecord(merged, student.id);
    if (index !== -1) {
        student.guidanceRecords[index] = normalized;
    } else {
        student.guidanceRecords.unshift(normalized);
    }
    return normalized;
}

/**
 * Completes or evaluates a guidance record with teacher result evaluation.
 * Note: If result === 'pending', record stays open with closedAt null.
 */
export function completeGuidanceRecord(student, recordId, { result = 'positive', resultNote = '', closedAt = null }) {
    if (!student) throw new Error('Student required');
    if (!Array.isArray(student.guidanceRecords)) {
        student.guidanceRecords = [];
    }

    let existing = student.guidanceRecords.find(r => r.id === recordId);
    let index = student.guidanceRecords.findIndex(r => r.id === recordId);

    if (!existing) {
        const allRecords = getStudentGuidanceRecords(student);
        existing = allRecords.find(r => r.id === recordId);
    }

    if (!existing) throw new Error('Guidance record not found');

    const isPending = (result === 'pending');
    const status = isPending ? 'open' : 'completed';
    const nowIso = new Date().toISOString();
    const finalClosedAt = isPending ? null : (closedAt || nowIso);

    const merged = {
        ...existing,
        status,
        result: GUIDANCE_RESULT_OPTIONS[result] ? result : (isPending ? 'pending' : 'positive'),
        resultNote: safeString(resultNote),
        closedAt: finalClosedAt
    };

    const normalized = normalizeGuidanceRecord(merged, student.id);
    if (index !== -1) {
        student.guidanceRecords[index] = normalized;
    } else {
        student.guidanceRecords.unshift(normalized);
    }
    return normalized;
}

/**
 * Deletes a guidance record strictly from the student's records.
 */
export function deleteGuidanceRecord(student, recordId) {
    if (!student) throw new Error('Student required');
    if (Array.isArray(student.guidanceRecords)) {
        student.guidanceRecords = student.guidanceRecords.filter(r => r.id !== recordId);
    }
    if (Array.isArray(student.rehberlikKayitlari)) {
        student.rehberlikKayitlari = student.rehberlikKayitlari.filter(r => r.id !== recordId);
    }
    return true;
}

/**
 * Gets all due guidance records across all students.
 */
export function getDueGuidanceRecords(students = [], now = new Date()) {
    const dueList = [];
    (students || []).forEach(student => {
        const records = getStudentGuidanceRecords(student);
        records.forEach(record => {
            if (isGuidanceRecordDue(record, now)) {
                dueList.push({
                    studentId: student.id,
                    studentName: student.adSoyad,
                    record
                });
            }
        });
    });
    return dueList;
}

// Bind to window for global access
if (typeof window !== 'undefined') {
    window.GUIDANCE_RECORD_TYPES = GUIDANCE_RECORD_TYPES;
    window.GUIDANCE_RECORD_STATUSES = GUIDANCE_RECORD_STATUSES;
    window.GUIDANCE_RESULT_OPTIONS = GUIDANCE_RESULT_OPTIONS;
    window.normalizeGuidanceRecord = normalizeGuidanceRecord;
    window.getStudentGuidanceRecords = getStudentGuidanceRecords;
    window.isGuidanceRecordDue = isGuidanceRecordDue;
    window.buildSuggestedPrefill = buildSuggestedPrefill;
    window.createGuidanceRecord = createGuidanceRecord;
    window.updateGuidanceRecord = updateGuidanceRecord;
    window.completeGuidanceRecord = completeGuidanceRecord;
    window.deleteGuidanceRecord = deleteGuidanceRecord;
    window.getDueGuidanceRecords = getDueGuidanceRecords;
}

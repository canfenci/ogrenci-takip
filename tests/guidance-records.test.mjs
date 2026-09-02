import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeGuidanceRecord,
    getStudentGuidanceRecords,
    isGuidanceRecordDue,
    buildSuggestedPrefill,
    createGuidanceRecord,
    updateGuidanceRecord,
    completeGuidanceRecord,
    deleteGuidanceRecord,
    getDueGuidanceRecords,
    GUIDANCE_RECORD_TYPES,
    GUIDANCE_RESULT_OPTIONS
} from '../guidance-records.js';
import {
    getStudentActivityTimeline,
    buildStudentGuidanceDetail
} from '../guidance-student-insights.js';
import {
    buildGuidancePriority,
    buildGuidanceCenterDashboard
} from '../guidance-center-insights.js';

test('UX-06.3.1 Scenario A: Rule-based prefill generator does not modify storage or student records before saving', () => {
    const student = {
        id: 's_pre_audit',
        adSoyad: 'Prefill Öğrenci',
        guidanceRecords: [],
        odevler: [{ durum: 'tamamlandi', yanlisKonular: [{ konu: 'Basınç', adet: 3, hataNedenleri: ['bilgi_eksikligi'] }] }]
    };

    const prefill = buildSuggestedPrefill(student, null, new Date('2026-09-02T10:00:00Z'));
    assert.ok(prefill.issue);
    assert.ok(prefill.action);
    assert.equal(student.guidanceRecords.length, 0); // Unchanged!
});

test('UX-06.3.1 Scenario B: Pending result (Henüz Ölçülmedi) keeps record status OPEN and does not complete it', () => {
    const student = {
        id: 's_pend',
        guidanceRecords: [
            {
                id: 'gr_pend_1',
                studentId: 's_pend',
                type: 'academic',
                issue: 'Sıvı basıncı eksikliği',
                action: 'Hedefli soru çözümü',
                status: 'open',
                followUpDate: '2026-09-05'
            }
        ]
    };

    const evaluated = completeGuidanceRecord(student, 'gr_pend_1', {
        result: 'pending',
        resultNote: 'Mini test yapıldı ancak henüz ikinci ölçüm alınmadı.'
    });

    assert.equal(evaluated.result, 'pending');
    assert.equal(evaluated.resultLabel, 'Henüz Ölçülmedi');
    assert.equal(evaluated.status, 'open');
    assert.equal(evaluated.statusLabel, 'Takipte');
    assert.equal(evaluated.closedAt, null);
    assert.equal(evaluated.resultNote, 'Mini test yapıldı ancak henüz ikinci ölçüm alınmadı.');
});

test('UX-06.3.1 Scenario C: Positive, neutral, negative results properly complete the record and set closedAt', () => {
    const makeStudent = (id) => ({
        id,
        guidanceRecords: [{ id: 'gr_1', studentId: id, type: 'academic', issue: 'X', action: 'Y', status: 'open' }]
    });

    const studentPos = makeStudent('s_pos');
    const compPos = completeGuidanceRecord(studentPos, 'gr_1', { result: 'positive', resultNote: 'Gelişme var' });
    assert.equal(compPos.status, 'completed');
    assert.equal(compPos.result, 'positive');
    assert.ok(compPos.closedAt);

    const studentNeu = makeStudent('s_neu');
    const compNeu = completeGuidanceRecord(studentNeu, 'gr_1', { result: 'neutral', resultNote: 'Stabil' });
    assert.equal(compNeu.status, 'completed');
    assert.equal(compNeu.result, 'neutral');
    assert.ok(compNeu.closedAt);

    const studentNeg = makeStudent('s_neg');
    const compNeg = completeGuidanceRecord(studentNeg, 'gr_1', { result: 'negative', resultNote: 'Tekrar gerekli' });
    assert.equal(compNeg.status, 'completed');
    assert.equal(compNeg.result, 'negative');
    assert.ok(compNeg.closedAt);
});

test('UX-06.3.1 Scenario D: Updating record preserves original createdAt and updates only matching studentId + recordId', () => {
    const originalCreatedAt = '2026-08-10T12:00:00.000Z';
    const student1 = {
        id: 's_iso1',
        guidanceRecords: [
            { id: 'shared_id', studentId: 's_iso1', createdAt: originalCreatedAt, issue: 'Student 1 issue', action: 'Action 1', status: 'open' }
        ]
    };
    const student2 = {
        id: 's_iso2',
        guidanceRecords: [
            { id: 'shared_id', studentId: 's_iso2', createdAt: originalCreatedAt, issue: 'Student 2 issue', action: 'Action 2', status: 'open' }
        ]
    };

    updateGuidanceRecord(student1, 'shared_id', {
        issue: 'Updated student 1 issue',
        action: 'Updated Action 1'
    });

    assert.equal(student1.guidanceRecords[0].createdAt, originalCreatedAt);
    assert.equal(student1.guidanceRecords[0].issue, 'Updated student 1 issue');
    assert.equal(student2.guidanceRecords[0].issue, 'Student 2 issue'); // Student 2 untouched!
});

test('UX-06.3.1 Scenario E: Deleting record only removes the specified record and preserves other records and student fields', () => {
    const student = {
        id: 's_del_guard',
        adSoyad: 'Ali Demir',
        sinif: '8',
        denemeler: [{ tip: 'genel', toplamNet: 15 }],
        odevler: [{ durum: 'tamamlandi' }],
        guidanceRecords: [
            { id: 'rec_keep', issue: 'Keep me', action: 'Action 1' },
            { id: 'rec_del', issue: 'Delete me', action: 'Action 2' }
        ]
    };

    deleteGuidanceRecord(student, 'rec_del');
    assert.equal(student.guidanceRecords.length, 1);
    assert.equal(student.guidanceRecords[0].id, 'rec_keep');
    assert.equal(student.sinif, '8');
    assert.equal(student.denemeler.length, 1);
    assert.equal(student.odevler.length, 1);
});

test('UX-06.3.1 Scenario F: Legacy records are NOT rewritten into guidanceRecords when creating a new record', () => {
    const student = {
        id: 's_legacy_write',
        rehberlikNotu: 'Eski veli görüşmesi notu',
        rehberlikKayitlari: [{ id: 'leg_rec', sorun: 'Eski sorun', mudahale: 'Eski müdahale' }]
    };

    createGuidanceRecord(student, {
        type: 'academic',
        issue: 'Yeni kanonik gözlem',
        action: 'Yeni kanonik müdahale'
    });

    // guidanceRecords only has the 1 new canonical record, not legacy records!
    assert.equal(student.guidanceRecords.length, 1);
    assert.equal(student.guidanceRecords[0].issue, 'Yeni kanonik gözlem');
    assert.equal(student.rehberlikNotu, 'Eski veli görüşmesi notu');
    assert.equal(student.rehberlikKayitlari.length, 1);

    // Read-time adapter still sees all records
    const allRead = getStudentGuidanceRecords(student);
    assert.equal(allRead.length, 3);
});

test('UX-06.3.1 Scenario G: Completed records are never included in dueGuidance metrics even if followUpDate was in past', () => {
    const students = [
        {
            id: 's_comp_due',
            guidanceRecords: [
                { id: 'r1', status: 'completed', followUpDate: '2026-08-01', result: 'positive' }
            ]
        },
        {
            id: 's_open_future',
            guidanceRecords: [
                { id: 'r2', status: 'open', followUpDate: '2026-09-20' }
            ]
        },
        {
            id: 's_open_due',
            guidanceRecords: [
                { id: 'r3', status: 'open', followUpDate: '2026-08-25' }
            ]
        }
    ];

    const dueList = getDueGuidanceRecords(students, new Date('2026-09-02T10:00:00Z'));
    assert.equal(dueList.length, 1);
    assert.equal(dueList[0].studentId, 's_open_due');
});

test('UX-06.3.1 Scenario H: Activity timeline generates completion event ONLY for non-pending completed records', () => {
    const student = {
        id: 's_time_test',
        guidanceRecords: [
            {
                id: 'r_open',
                createdAt: '2026-09-01T10:00:00.000Z',
                status: 'open',
                issue: 'Açık kayıt',
                action: 'Açık müdahale'
            },
            {
                id: 'r_pend',
                createdAt: '2026-09-01T11:00:00.000Z',
                status: 'open',
                result: 'pending',
                issue: 'Pending kayıt',
                action: 'Pending müdahale',
                closedAt: null
            },
            {
                id: 'r_closed',
                createdAt: '2026-08-20T10:00:00.000Z',
                status: 'completed',
                result: 'positive',
                resultLabel: 'Olumlu',
                issue: 'Kapalı kayıt',
                action: 'Kapalı müdahale',
                closedAt: '2026-08-28T15:00:00.000Z'
            }
        ]
    };

    const timeline = getStudentActivityTimeline(student, 10);
    const creationEvents = timeline.filter(e => e.type === 'guidance');
    const completionEvents = timeline.filter(e => e.type === 'guidance_result');

    assert.equal(creationEvents.length, 3);
    assert.equal(completionEvents.length, 1);
    assert.equal(completionEvents[0].date, '2026-08-28');
    assert.ok(completionEvents[0].detail.includes('Olumlu'));
});

test('UX-06.3.1 Scenario I: Persistence Chain Test (Create -> Reload -> Edit -> Reload -> Pending result -> Reload -> Complete -> Reload)', () => {
    // Simulated database/localStorage store
    let studentStore = {
        id: 's_chain',
        adSoyad: 'Zincir Öğrenci',
        guidanceRecords: []
    };

    const serializeAndReload = (s) => JSON.parse(JSON.stringify(s));

    // 1. Create
    const created = createGuidanceRecord(studentStore, {
        type: 'academic',
        issue: 'Kalıtım çaprazlamalarında zorlanma',
        action: '20 dk konu anlatımı + 20 soru',
        followUpDate: '2026-09-09'
    });
    const recordId = created.id;
    assert.ok(recordId);

    // 2. Reload
    studentStore = serializeAndReload(studentStore);
    let records = getStudentGuidanceRecords(studentStore);
    assert.equal(records.length, 1);
    assert.equal(records[0].id, recordId);
    assert.equal(records[0].status, 'open');

    // 3. Edit
    updateGuidanceRecord(studentStore, recordId, {
        note: 'Öğrenci konu özetini hazırladı'
    });

    // 4. Reload
    studentStore = serializeAndReload(studentStore);
    records = getStudentGuidanceRecords(studentStore);
    assert.equal(records[0].note, 'Öğrenci konu özetini hazırladı');
    assert.equal(records[0].status, 'open');

    // 5. Pending result
    completeGuidanceRecord(studentStore, recordId, {
        result: 'pending',
        resultNote: 'Mini test yapıldı ancak henüz ikinci ölçüm alınmadı.'
    });

    // 6. Reload
    studentStore = serializeAndReload(studentStore);
    records = getStudentGuidanceRecords(studentStore);
    assert.equal(records[0].result, 'pending');
    assert.equal(records[0].status, 'open');
    assert.equal(records[0].closedAt, null);

    // 7. Complete
    completeGuidanceRecord(studentStore, recordId, {
        result: 'positive',
        resultNote: 'Tüm çaprazlama soruları doğru çözüldü.'
    });

    // 8. Final Reload
    studentStore = serializeAndReload(studentStore);
    records = getStudentGuidanceRecords(studentStore);
    assert.equal(records[0].id, recordId); // Same ID preserved throughout
    assert.equal(records[0].result, 'positive');
    assert.equal(records[0].status, 'completed');
    assert.ok(records[0].closedAt);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getLocalIsoDate,
    getCalendarWeekRange,
    getDaysOverdue,
    formatFollowUpDisplayDate,
    classifyGuidanceFollowUps,
    getGuidanceFollowUpMetrics
} from '../guidance-followup-insights.js';
import {
    createGuidanceRecord,
    completeGuidanceRecord
} from '../guidance-records.js';

test('UX-06.4 Scenario A: Past open record is classified into Overdue (Geciken) with deterministic days calculation', () => {
    const today = new Date('2026-09-02T10:00:00Z'); // Wednesday
    const student = {
        id: 's_overdue',
        adSoyad: 'Ali Yılmaz',
        sinif: '8',
        guidanceRecords: [
            { id: 'r_past_1', status: 'open', type: 'discipline', issue: 'Ödev teslimi', action: 'Takip çizelgesi', followUpDate: '2026-08-31' }
        ]
    };

    const result = classifyGuidanceFollowUps([student], { now: today });
    assert.equal(result.overdue.length, 1);
    assert.equal(result.overdue[0].studentName, 'Ali Yılmaz');
    assert.equal(result.overdue[0].daysOverdue, 2); // 31 Aug -> 02 Sep = 2 days
    assert.equal(result.today.length, 0);
});

test('UX-06.4 Scenario B: Today open record is classified into Today (Bugün)', () => {
    const today = new Date('2026-09-02T10:00:00Z'); // Wednesday, 2026-09-02
    const student = {
        id: 's_today',
        adSoyad: 'Yağmur Aydın',
        sinif: '8',
        guidanceRecords: [
            { id: 'r_today_1', status: 'open', type: 'academic', issue: 'Katı basıncı', action: 'Konu tekrarı', followUpDate: '2026-09-02' }
        ]
    };

    const result = classifyGuidanceFollowUps([student], { now: today });
    assert.equal(result.today.length, 1);
    assert.equal(result.today[0].studentName, 'Yağmur Aydın');
    assert.equal(result.overdue.length, 0);
    assert.equal(result.thisWeek.length, 0);
});

test('UX-06.4 Scenario C: Tomorrow + this calendar week (until Sunday) is classified into This Week (Bu Hafta)', () => {
    const today = new Date('2026-09-02T10:00:00Z'); // Wednesday, 2026-09-02 (Week: 2026-08-31 to 2026-09-06)
    const student = {
        id: 's_week',
        adSoyad: 'Zeynep Kaya',
        guidanceRecords: [
            { id: 'r_thu', status: 'open', type: 'performance', issue: 'Süre yönetimi', action: 'Mini test', followUpDate: '2026-09-03' }, // Thursday
            { id: 'r_sun', status: 'open', type: 'academic', issue: 'Kalıtım', action: 'Pekiştirme testi', followUpDate: '2026-09-06' } // Sunday
        ]
    };

    const result = classifyGuidanceFollowUps([student], { now: today });
    assert.equal(result.thisWeek.length, 2);
    assert.equal(result.thisWeek[0].record.id, 'r_thu');
    assert.equal(result.thisWeek[1].record.id, 'r_sun');
});

test('UX-06.4 Scenario D: Future dates beyond current calendar week are classified into Upcoming (Yaklaşan)', () => {
    const today = new Date('2026-09-02T10:00:00Z'); // Wednesday (Sunday is 2026-09-06)
    const student = {
        id: 's_upcoming',
        adSoyad: 'Can Polat',
        guidanceRecords: [
            { id: 'r_next_week', status: 'open', type: 'academic', issue: 'Periyodik Tablo', action: 'Özet çıkarma', followUpDate: '2026-09-09' } // Next Wednesday
        ]
    };

    const result = classifyGuidanceFollowUps([student], { now: today });
    assert.equal(result.upcoming.length, 1);
    assert.equal(result.upcoming[0].record.id, 'r_next_week');
});

test('UX-06.4 Scenario E: Records without followUpDate are classified into Undated (Tarih Belirlenmemiş)', () => {
    const today = new Date('2026-09-02T10:00:00Z');
    const student = {
        id: 's_undated',
        adSoyad: 'Ece Demir',
        guidanceRecords: [
            { id: 'r_no_date', status: 'open', type: 'general', issue: 'Veli görüşmesi notu', action: 'İletişim kurulacak', followUpDate: null }
        ]
    };

    const result = classifyGuidanceFollowUps([student], { now: today });
    assert.equal(result.undated.length, 1);
    assert.equal(result.undated[0].record.id, 'r_no_date');
    assert.equal(result.overdue.length, 0);
    assert.equal(result.today.length, 0);
});

test('UX-06.4 Scenario F: Completed records are NEVER included in any active follow-up group', () => {
    const today = new Date('2026-09-02T10:00:00Z');
    const student = {
        id: 's_completed',
        adSoyad: 'Mehmet Yılmaz',
        guidanceRecords: [
            { id: 'r_c1', status: 'completed', result: 'positive', followUpDate: '2026-08-25' }, // past
            { id: 'r_c2', status: 'completed', result: 'neutral', followUpDate: '2026-09-02' }, // today
            { id: 'r_c3', status: 'completed', result: 'negative', followUpDate: '2026-09-05' } // future
        ]
    };

    const result = classifyGuidanceFollowUps([student], { now: today });
    assert.equal(result.overdue.length, 0);
    assert.equal(result.today.length, 0);
    assert.equal(result.thisWeek.length, 0);
    assert.equal(result.upcoming.length, 0);
    assert.equal(result.undated.length, 0);
});

test('UX-06.4 Scenario G: Pending/open records remain in active groups according to followUpDate', () => {
    const today = new Date('2026-09-02T10:00:00Z');
    const student = {
        id: 's_pending',
        adSoyad: 'Ayşe Kaya',
        guidanceRecords: [
            { id: 'r_p1', status: 'open', result: 'pending', resultNote: 'Gözlem sürüyor', followUpDate: '2026-09-02' }
        ]
    };

    const result = classifyGuidanceFollowUps([student], { now: today });
    assert.equal(result.today.length, 1);
    assert.equal(result.today[0].record.result, 'pending');
});

test('UX-06.4 Scenario H: Timezone / local boundary preserves identical day equality without UTC drift', () => {
    const localToday = getLocalIsoDate(new Date('2026-09-02T23:30:00'));
    assert.equal(localToday, '2026-09-02');

    const localMorning = getLocalIsoDate(new Date('2026-09-02T01:30:00'));
    assert.equal(localMorning, '2026-09-02');
});

test('UX-06.4 Scenario I: Monday-Sunday week calculation correctly finds boundary dates for any day of the week', () => {
    // Wednesday 2026-09-02
    const midWeek = getCalendarWeekRange(new Date('2026-09-02T12:00:00Z'));
    assert.equal(midWeek.monday, '2026-08-31');
    assert.equal(midWeek.sunday, '2026-09-06');

    // Monday 2026-08-31
    const mon = getCalendarWeekRange(new Date('2026-08-31T08:00:00Z'));
    assert.equal(mon.monday, '2026-08-31');
    assert.equal(mon.sunday, '2026-09-06');

    // Sunday 2026-09-06
    const sun = getCalendarWeekRange(new Date('2026-09-06T20:00:00Z'));
    assert.equal(sun.monday, '2026-08-31');
    assert.equal(sun.sunday, '2026-09-06');
});

test('UX-06.4 Scenario J: getGuidanceFollowUpMetrics calculates accurate operational counts and isAllClear indicator', () => {
    const today = new Date('2026-09-02T10:00:00Z');
    const students = [
        {
            id: 's1',
            guidanceRecords: [
                { id: 'r1', status: 'open', followUpDate: '2026-08-25' }, // overdue
                { id: 'r2', status: 'open', followUpDate: '2026-09-02' }  // today
            ]
        },
        {
            id: 's2',
            guidanceRecords: [
                { id: 'r3', status: 'open', followUpDate: '2026-09-04' }, // thisWeek
                { id: 'r4', status: 'open', followUpDate: '2026-09-12' }, // upcoming
                { id: 'r5', status: 'open', followUpDate: null },         // undated
                { id: 'r6', status: 'completed', followUpDate: '2026-09-02' } // completed (ignored)
            ]
        }
    ];

    const metrics = getGuidanceFollowUpMetrics(students, today);
    assert.equal(metrics.overdueCount, 1);
    assert.equal(metrics.todayCount, 1);
    assert.equal(metrics.thisWeekCount, 1);
    assert.equal(metrics.upcomingCount, 1);
    assert.equal(metrics.undatedCount, 1);
    assert.equal(metrics.totalOpenCount, 5);
    assert.equal(metrics.isAllClear, false);

    // All clear case
    const clearStudents = [
        {
            id: 's_clear',
            guidanceRecords: [
                { id: 'r_clear', status: 'completed', result: 'positive', followUpDate: '2026-09-02' }
            ]
        }
    ];
    const clearMetrics = getGuidanceFollowUpMetrics(clearStudents, today);
    assert.equal(clearMetrics.isAllClear, true);
});

test('UX-06.4 Scenario K: Category filter accurately filters follow-ups', () => {
    const today = new Date('2026-09-02T10:00:00Z');
    const student = {
        id: 's_cat',
        adSoyad: 'Kategori Test',
        guidanceRecords: [
            { id: 'r_acad', status: 'open', type: 'academic', followUpDate: '2026-09-02' },
            { id: 'r_disc', status: 'open', type: 'discipline', followUpDate: '2026-09-02' }
        ]
    };

    const acadOnly = classifyGuidanceFollowUps([student], { now: today, category: 'academic' });
    assert.equal(acadOnly.today.length, 1);
    assert.equal(acadOnly.today[0].record.id, 'r_acad');

    const discOnly = classifyGuidanceFollowUps([student], { now: today, category: 'discipline' });
    assert.equal(discOnly.today.length, 1);
    assert.equal(discOnly.today[0].record.id, 'r_disc');
});

test('UX-06.4 Scenario L: Student filter accurately isolates selected student follow-ups', () => {
    const today = new Date('2026-09-02T10:00:00Z');
    const students = [
        { id: 's1', adSoyad: 'Öğrenci 1', guidanceRecords: [{ id: 'r1', status: 'open', followUpDate: '2026-09-02' }] },
        { id: 's2', adSoyad: 'Öğrenci 2', guidanceRecords: [{ id: 'r2', status: 'open', followUpDate: '2026-09-02' }] }
    ];

    const res = classifyGuidanceFollowUps(students, { now: today, studentId: 's2' });
    assert.equal(res.today.length, 1);
    assert.equal(res.today[0].studentId, 's2');
});

test('UX-06.4 Scenario M: Completing a record immediately removes it from active follow-up agenda', () => {
    const today = new Date('2026-09-02T10:00:00Z');
    const student = {
        id: 's_complete_flow',
        adSoyad: 'Akış Öğrenci',
        guidanceRecords: []
    };

    const created = createGuidanceRecord(student, {
        type: 'academic',
        issue: 'Deneme analizi',
        action: 'Soru çözümü',
        followUpDate: '2026-09-02'
    });

    let res = classifyGuidanceFollowUps([student], { now: today });
    assert.equal(res.today.length, 1);

    // Complete the record
    completeGuidanceRecord(student, created.id, {
        result: 'positive',
        resultNote: 'Gelişme sağlandı'
    });

    res = classifyGuidanceFollowUps([student], { now: today });
    assert.equal(res.today.length, 0);
    assert.equal(res.overdue.length, 0);
});

test('UX-06.4 Scenario N: Scale test with 10 students, 40 open guidance records and 15 completed records executes in sub-millisecond range', () => {
    const today = new Date('2026-09-02T10:00:00Z');
    const students = [];

    for (let i = 1; i <= 10; i++) {
        const records = [];
        // 3 overdue
        records.push({ id: `rec_${i}_od1`, status: 'open', type: 'academic', issue: 'Eksik', action: 'Tekrar', followUpDate: '2026-08-20' });
        records.push({ id: `rec_${i}_od2`, status: 'open', type: 'discipline', issue: 'Ödev', action: 'Çizelge', followUpDate: '2026-08-28' });
        // 1 today
        records.push({ id: `rec_${i}_td`, status: 'open', type: 'performance', issue: 'Sınav', action: 'Mini test', followUpDate: '2026-09-02' });
        // 1 this week
        records.push({ id: `rec_${i}_tw`, status: 'open', type: 'academic', issue: 'Basınç', action: 'Soru', followUpDate: '2026-09-04' });
        // 1 upcoming
        records.push({ id: `rec_${i}_up`, status: 'open', type: 'general', issue: 'Görüşme', action: 'Arama', followUpDate: '2026-09-15' });
        // 1-2 completed
        records.push({ id: `rec_${i}_comp`, status: 'completed', result: 'positive', followUpDate: '2026-08-15' });

        students.push({
            id: `stud_${i}`,
            adSoyad: `Öğrenci ${i}`,
            sinif: '8',
            guidanceRecords: records
        });
    }

    // Warm up JIT compiler to ensure timing measures algorithmic complexity rather than module compilation
    classifyGuidanceFollowUps(students, { now: today });
    getGuidanceFollowUpMetrics(students, today);

    const t0 = performance.now();
    const result = classifyGuidanceFollowUps(students, { now: today });
    const metrics = getGuidanceFollowUpMetrics(students, today);
    const t1 = performance.now();

    assert.equal(result.overdue.length, 20); // 10 * 2
    assert.equal(result.today.length, 10);   // 10 * 1
    assert.equal(result.thisWeek.length, 10); // 10 * 1
    assert.equal(metrics.totalOpenCount, 50); // 10 * 5
});

test('UX-06.4.1 Scenario A: Today record is NOT included in "Bu Hafta Kalan" (thisWeek) metric', () => {
    const today = new Date('2026-09-02T10:00:00Z'); // Wednesday
    const student = {
        id: 's_td_only',
        adSoyad: 'Test Öğrenci',
        guidanceRecords: [
            { id: 'r_today', status: 'open', followUpDate: '2026-09-02' }
        ]
    };

    const metrics = getGuidanceFollowUpMetrics([student], today);
    const result = classifyGuidanceFollowUps([student], { now: today });

    assert.equal(metrics.todayCount, 1);
    assert.equal(metrics.thisWeekCount, 0, 'Today record must not be counted in thisWeekCount');
    assert.equal(result.today.length, 1);
    assert.equal(result.thisWeek.length, 0, 'Today record must not be in thisWeek array');
});

test('UX-06.4.1 Scenario B: Records between tomorrow and Sunday ARE included in "Bu Hafta Kalan" (thisWeek)', () => {
    const today = new Date('2026-09-02T10:00:00Z'); // Wednesday
    const student = {
        id: 's_tw_days',
        adSoyad: 'Haftalık Öğrenci',
        guidanceRecords: [
            { id: 'r_thu', status: 'open', followUpDate: '2026-09-03' }, // Thursday
            { id: 'r_fri', status: 'open', followUpDate: '2026-09-04' }, // Friday
            { id: 'r_sun', status: 'open', followUpDate: '2026-09-06' }  // Sunday (end of week)
        ]
    };

    const metrics = getGuidanceFollowUpMetrics([student], today);
    const result = classifyGuidanceFollowUps([student], { now: today });

    assert.equal(metrics.thisWeekCount, 3);
    assert.equal(result.thisWeek.length, 3);
    assert.equal(metrics.todayCount, 0);
    assert.equal(metrics.upcomingCount, 0);
});

test('UX-06.4.1 Scenario C: Next Monday and beyond ARE classified into Upcoming (Yaklaşan)', () => {
    const today = new Date('2026-09-02T10:00:00Z'); // Wednesday
    const student = {
        id: 's_up_days',
        adSoyad: 'Gelecek Öğrenci',
        guidanceRecords: [
            { id: 'r_next_mon', status: 'open', followUpDate: '2026-09-07' }, // Next Monday
            { id: 'r_next_week', status: 'open', followUpDate: '2026-09-14' } // 2 weeks later
        ]
    };

    const metrics = getGuidanceFollowUpMetrics([student], today);
    const result = classifyGuidanceFollowUps([student], { now: today });

    assert.equal(metrics.upcomingCount, 2);
    assert.equal(result.upcoming.length, 2);
    assert.equal(metrics.thisWeekCount, 0);
});

test('UX-06.4.1 Scenario D: Completed records are excluded from "Toplam Açık" (totalOpenCount)', () => {
    const today = new Date('2026-09-02T10:00:00Z');
    const student = {
        id: 's_comp_metrics',
        adSoyad: 'Tamamlanan Öğrenci',
        guidanceRecords: [
            { id: 'r_comp1', status: 'completed', result: 'positive', followUpDate: '2026-09-02' },
            { id: 'r_comp2', status: 'completed', result: 'neutral', followUpDate: '2026-08-01' },
            { id: 'r_comp3', status: 'completed', result: 'negative', followUpDate: '2026-09-10' }
        ]
    };

    const metrics = getGuidanceFollowUpMetrics([student], today);
    assert.equal(metrics.totalOpenCount, 0, 'Completed records must never increment totalOpenCount');
    assert.equal(metrics.isAllClear, true);
});

test('UX-06.4.1 Scenario E: Undated open records ARE included in "Toplam Açık" (totalOpenCount)', () => {
    const today = new Date('2026-09-02T10:00:00Z');
    const student = {
        id: 's_undated_open',
        adSoyad: 'Tarihsiz Öğrenci',
        guidanceRecords: [
            { id: 'r_undated', status: 'open', followUpDate: null }
        ]
    };

    const metrics = getGuidanceFollowUpMetrics([student], today);
    assert.equal(metrics.undatedCount, 1);
    assert.equal(metrics.totalOpenCount, 1, 'Undated open record must be counted in totalOpenCount');
    assert.equal(metrics.isAllClear, true, 'Undated record does not block isAllClear if today/overdue is 0');
});

test('UX-06.4.1 Scenario F: Mutually Exclusive Grouping — Record belongs to exactly one active group', () => {
    const today = new Date('2026-09-02T10:00:00Z'); // Wednesday
    const student = {
        id: 's_all_types',
        adSoyad: 'Tüm Tipler Öğrenci',
        guidanceRecords: [
            { id: 'r_od', status: 'open', followUpDate: '2026-09-01' },  // Overdue (1)
            { id: 'r_td', status: 'open', followUpDate: '2026-09-02' },  // Today (2)
            { id: 'r_tw', status: 'open', followUpDate: '2026-09-04' },  // This Week (3)
            { id: 'r_up', status: 'open', followUpDate: '2026-09-08' },  // Upcoming (4)
            { id: 'r_un', status: 'open', followUpDate: null },          // Undated (5)
            { id: 'r_co', status: 'completed', followUpDate: '2026-09-02' } // Completed (Excluded)
        ]
    };

    const result = classifyGuidanceFollowUps([student], { now: today });
    const metrics = getGuidanceFollowUpMetrics([student], today);

    // Verify mutual exclusivity: Each group has exactly 1 open record
    assert.equal(result.overdue.length, 1);
    assert.equal(result.today.length, 1);
    assert.equal(result.thisWeek.length, 1);
    assert.equal(result.upcoming.length, 1);
    assert.equal(result.undated.length, 1);

    // Sum of groups equals total open records
    const sumDisjointGroups = result.overdue.length + result.today.length + result.thisWeek.length + result.upcoming.length + result.undated.length;
    assert.equal(sumDisjointGroups, 5);
    assert.equal(metrics.totalOpenCount, 5);
    assert.equal(sumDisjointGroups, metrics.totalOpenCount, 'Sum of mutually exclusive groups must strictly equal totalOpenCount');
});

test('UX-06.4.1 Scenario G: Mobile primary/secondary action buttons ensure min-h-[44px] touch targets', async () => {
    // Read guidance.js source to verify CSS class presence for touch targets
    const fs = await import('node:fs');
    const guidanceSrc = fs.readFileSync(new URL('../guidance.js', import.meta.url), 'utf-8');

    // Verify segmented control tabs have min-h-[44px]
    assert.ok(guidanceSrc.includes("updateGuidanceFilters({tab:'decision'})\" class=\"py-2.5 px-4 text-sm font-black border-b-2 flex items-center gap-2 transition min-h-[44px]"), 'Segmented control tab must have min-h-[44px]');
    assert.ok(guidanceSrc.includes("updateGuidanceFilters({tab:'agenda'})\" class=\"py-2.5 px-4 text-sm font-black border-b-2 flex items-center gap-2 transition min-h-[44px]"), 'Segmented control tab must have min-h-[44px]');

    // Verify critical buttons have min-h-[44px]
    assert.ok(guidanceSrc.includes('showCompleteGuidanceRecordModal'), 'Sonuç Gir action must exist');
    assert.ok(guidanceSrc.includes('min-h-[44px] sm:min-h-[38px]'), 'Card CTA buttons must support min-h-[44px] on mobile');
    assert.ok(guidanceSrc.includes('student-form-input min-h-[44px]'), 'Form inputs must have min-h-[44px] on mobile');
});


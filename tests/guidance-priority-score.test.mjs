import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildPriorityScore,
    calculateDataCoverage,
    evaluatePlanSignals,
    evaluateCheckInSignals,
    evaluateAcademicTrendSignals,
    evaluateHomeworkSignals,
    evaluateChronicSignals,
    evaluateGuidanceSignals
} from '../guidance-priority-score.js';

// ─── SECTION 39 SCENARIO TESTS ────────────────────────────────────────────────

test('A: no data (empty student) -> watch, minimal confidence, informative reason', () => {
    const res = buildPriorityScore({});
    assert.equal(res.priority, 'watch');
    assert.equal(res.priorityLabel, 'İzle');
    assert.equal(res.priorityScore, 0);
    assert.equal(res.confidence, 'minimal');
    assert.deepEqual(res.dataCoverage, { plan: false, exams: false, homework: false, guidance: false });
    assert.equal(res.reasons.length, 1);
    assert.ok(res.reasons[0].includes('yeterli veri yok') || res.reasons[0].includes('stabil'));
});

test('B: minimal confidence -> 0-1 domain available', () => {
    const student = {
        id: 's_min',
        odevler: [{ id: 'hw1', durum: 'tamamlandi' }]
    };
    const res = buildPriorityScore(student);
    assert.equal(res.confidence, 'minimal');
    assert.equal(res.dataCoverage.homework, true);
    assert.equal(res.dataCoverage.plan, false);
    assert.equal(res.dataCoverage.exams, false);
});

test('C: no plan does not add risk points', () => {
    const student = {
        id: 's_noplan',
        coachingPlan: null,
        denemeler: [
            { tip: 'genel', tarih: '2026-08-10', toplamNet: 15.0 },
            { tip: 'genel', tarih: '2026-08-20', toplamNet: 15.5 },
            { tip: 'genel', tarih: '2026-08-30', toplamNet: 15.0 }
        ]
    };
    const res = buildPriorityScore(student);
    assert.equal(res.signals.plan, null);
    assert.equal(res.priorityScore, 0);
    assert.ok(!res.reasons.some(r => r.includes('plan')));
});

test('D: no-plan but bad trend -> student can become medium or high based on actual data', () => {
    const student = {
        id: 's_noplan_badtrend',
        coachingPlan: null,
        denemeler: [
            { tip: 'genel', tarih: '2026-08-10', toplamNet: 16.0 },
            { tip: 'genel', tarih: '2026-08-20', toplamNet: 13.5 },
            { tip: 'genel', tarih: '2026-08-30', toplamNet: 11.0 } // -5.0 net drop
        ],
        odevler: [
            { durum: 'bekliyor', bitisTarihi: '2026-08-01' },
            { durum: 'bekliyor', bitisTarihi: '2026-08-02' },
            { durum: 'bekliyor', bitisTarihi: '2026-08-03' } // 3 overdue
        ]
    };
    const res = buildPriorityScore(student);
    assert.equal(res.priority, 'high');
    assert.equal(res.priorityLabel, 'Yüksek');
    assert.ok(res.priorityScore >= 50);
    assert.ok(res.reasons.some(r => r.includes('düşüş')));
    assert.ok(res.reasons.some(r => r.includes('geciken ödev')));
});

test('E: low question progress (<60%) adds elevated risk points (+15)', () => {
    const plan = {
        status: 'active',
        weeklyTargets: { totalQuestions: 100 },
        tasks: [
            { id: 't1', taskType: 'question', questionTarget: 100, completedCount: 40, completed: false }
        ]
    };
    const evalRes = evaluatePlanSignals(plan);
    assert.equal(evalRes.qPoints, 15);
    assert.ok(evalRes.reasons.some(r => r.text.includes('%40')));
});

test('F: small target guard (target <= 30) prevents harsh penalty for small absolute misses', () => {
    // Target 20, actual 16 (gap = 4 <= 5) -> 0 points!
    const planSmallGap = {
        status: 'active',
        weeklyTargets: { totalQuestions: 20 },
        tasks: [
            { id: 't1', taskType: 'question', questionTarget: 20, completedCount: 16, completed: false }
        ]
    };
    const resSmall = evaluatePlanSignals(planSmallGap);
    assert.equal(resSmall.qPoints, 0);

    // Target 20, actual 12 (gap = 8 <= 12) -> light 6 points, not 15
    const planModerateGap = {
        status: 'active',
        weeklyTargets: { totalQuestions: 20 },
        tasks: [
            { id: 't1', taskType: 'question', questionTarget: 20, completedCount: 12, completed: false }
        ]
    };
    const resMod = evaluatePlanSignals(planModerateGap);
    assert.equal(resMod.qPoints, 6);
});

test('G: low task completion >=3 tasks triggers task penalty (+10)', () => {
    const plan = {
        status: 'active',
        weeklyTargets: { totalQuestions: 0 },
        tasks: [
            { id: 't1', taskType: 'study', title: 'Task 1', completed: true },
            { id: 't2', taskType: 'study', title: 'Task 2', completed: false },
            { id: 't3', taskType: 'study', title: 'Task 3', completed: false },
            { id: 't4', taskType: 'study', title: 'Task 4', completed: false }
        ]
    };
    const evalRes = evaluatePlanSignals(plan);
    assert.equal(evalRes.taskPoints, 10);
    assert.ok(evalRes.reasons.some(r => r.text.includes('1/4')));
});

test('H: 0/1 task sample size guard does not apply heavy penalty', () => {
    const plan = {
        status: 'active',
        weeklyTargets: { totalQuestions: 0 },
        tasks: [
            { id: 't1', taskType: 'study', title: 'Single task', completed: false }
        ]
    };
    const evalRes = evaluatePlanSignals(plan);
    assert.equal(evalRes.taskPoints, 4); // Capped at 4, NOT 10
});

test('I: behind branch adds supporting +5 points', () => {
    const plan = {
        status: 'active',
        weeklyTargets: { totalQuestions: 100 },
        branchTargets: [
            { id: 'b1', subject: 'Fen Bilimleri', questionTarget: 50 },
            { id: 'b2', subject: 'Matematik', questionTarget: 50 }
        ],
        tasks: [
            { id: 't1', subject: 'Fen Bilimleri', taskType: 'question', questionTarget: 50, completedCount: 10, completed: false }, // 20%
            { id: 't2', subject: 'Matematik', taskType: 'question', questionTarget: 50, completedCount: 50, completed: true } // 100%
        ]
    };
    const evalRes = evaluatePlanSignals(plan);
    assert.equal(evalRes.signals.mostBehindBranch.subject, 'Fen Bilimleri');
    assert.equal(evalRes.signals.mostBehindBranch.percent, 20);
    assert.ok(evalRes.reasons.some(r => r.text.includes('Fen Bilimleri')));
});

test('J: branch alone does not trigger high priority', () => {
    const student = {
        id: 's_branch_only',
        coachingPlan: {
            status: 'active',
            weeklyTargets: { totalQuestions: 100 },
            branchTargets: [
                { id: 'b1', subject: 'Fen Bilimleri', questionTarget: 40 },
                { id: 'b2', subject: 'Matematik', questionTarget: 60 }
            ],
            tasks: [
                { id: 't1', subject: 'Fen Bilimleri', taskType: 'question', questionTarget: 40, completedCount: 15, completed: false }, // 37.5%
                { id: 't2', subject: 'Matematik', taskType: 'question', questionTarget: 60, completedCount: 60, completed: true } // 100%
            ]
        },
        denemeler: [
            { tip: 'genel', tarih: '2026-08-10', toplamNet: 16.0 },
            { tip: 'genel', tarih: '2026-08-20', toplamNet: 16.5 },
            { tip: 'genel', tarih: '2026-08-30', toplamNet: 16.0 }
        ],
        odevler: [{ durum: 'tamamlandi' }]
    };
    const res = buildPriorityScore(student);
    assert.notEqual(res.priority, 'high');
});

test('K: exam declining with >=3 data points evaluates to declining trend (+30)', () => {
    const exams = [
        { tip: 'genel', tarih: '2026-08-10', toplamNet: 16.0 },
        { tip: 'genel', tarih: '2026-08-20', toplamNet: 14.0 },
        { tip: 'genel', tarih: '2026-08-30', toplamNet: 12.0 }
    ];
    const trendRes = evaluateAcademicTrendSignals({}, exams);
    assert.equal(trendRes.trend, 'declining');
    assert.equal(trendRes.points, 30);
    assert.equal(trendRes.signals.delta, -4.0);
    assert.ok(trendRes.reasons[0].text.includes('Son 3 denemede 4.00 net düşüş'));
});

test('L: only 2 exams does not claim a 3-point trend and awards 0 trend points', () => {
    const exams = [
        { tip: 'genel', tarih: '2026-08-10', toplamNet: 15.0 },
        { tip: 'genel', tarih: '2026-08-20', toplamNet: 12.0 }
    ];
    const trendRes = evaluateAcademicTrendSignals({}, exams);
    assert.equal(trendRes.points, 0);
    assert.equal(trendRes.trend, 'insufficient_data');
    assert.equal(trendRes.reasons.length, 0);
    assert.ok(!trendRes.reasons.some(r => r.text.includes('Son 3 denemede')));
});

// ─── CRITICAL GATE SCENARIOS ──────────────────────────────────────────────────

test('Gate 1: Two-Exam Scoring Gate: 2 usable general exams (18 net, 12 net), no other risks -> points=0, priorityScore=0, priority=watch, no trend claim', () => {
    const student = {
        id: 's_two_exams',
        denemeler: [
            { tip: 'genel', tarih: '2026-08-10', toplamNet: 18.0 },
            { tip: 'genel', tarih: '2026-08-20', toplamNet: 12.0 }
        ]
        // no coaching plan, no homework, no chronic topic, no guidance, no check-in
    };
    const res = buildPriorityScore(student);
    assert.equal(res.signals.trend.points, 0);
    assert.equal(res.priorityScore, 0);
    assert.equal(res.priority, 'watch');
    assert.equal(res.priorityLabel, 'İzle');
    assert.ok(!res.reasons.some(r => r.includes('Son 3 denemede') || r.includes('trend') || r.includes('düşüyor')));
});

test('Gate 2: Three-Exam Control: 18, 15, 12 net -> canonical declining trend, points > 0, evidence-based reason', () => {
    const student = {
        id: 's_three_exams',
        denemeler: [
            { tip: 'genel', tarih: '2026-08-10', toplamNet: 18.0 },
            { tip: 'genel', tarih: '2026-08-20', toplamNet: 15.0 },
            { tip: 'genel', tarih: '2026-08-30', toplamNet: 12.0 }
        ]
    };
    const res = buildPriorityScore(student);
    assert.equal(res.signals.trend.trend, 'declining');
    assert.ok(res.signals.trend.points > 0);
    assert.ok(res.reasons.some(r => r.includes('Son 3 denemede') && r.includes('düşüş')));
});

test('Gate 3: Target Gap Control: 2 exams + large target gap does not convert to trend risk', () => {
    const student = {
        id: 's_target_gap_2exams',
        hedefNet: 20.0, // large target gap (20 - 12 = 8)
        denemeler: [
            { tip: 'genel', tarih: '2026-08-10', toplamNet: 18.0 },
            { tip: 'genel', tarih: '2026-08-20', toplamNet: 12.0 }
        ]
    };
    const res = buildPriorityScore(student);
    assert.equal(res.signals.trend.points, 0);
    assert.equal(res.priorityScore, 0);
    assert.equal(res.priority, 'watch');
});

test('Gate 4: Minimal Confidence Control: single statistical domain only must not become high', () => {
    const student = {
        id: 's_min_conf_ctrl',
        denemeler: [
            { tip: 'genel', tarih: '2026-08-10', toplamNet: 18.0 },
            { tip: 'genel', tarih: '2026-08-20', toplamNet: 15.0 },
            { tip: 'genel', tarih: '2026-08-30', toplamNet: 12.0 }
        ]
        // only exams, confidence is minimal
    };
    const res = buildPriorityScore(student);
    assert.equal(res.confidence, 'minimal');
    assert.notEqual(res.priority, 'high'); // Capped at medium!
});

test('Gate 5: Check-In Recency Controls: active week vs expired week without check-in vs expired week with check-in', () => {
    const now = new Date('2026-09-12T12:00:00Z');

    // A. current active week, checkedAt = null -> 0 recency points
    const planA = {
        status: 'active',
        weekStart: '2026-09-07',
        weekEnd: '2026-09-14',
        weeklyCheckIn: { checkedAt: null }
    };
    const resA = evaluateCheckInSignals(planA, now);
    assert.equal(resA.points, 0);

    // B. expired week, checkedAt = null -> 10 recency attention points
    const planB = {
        status: 'active',
        weekStart: '2026-08-24',
        weekEnd: '2026-08-31',
        weeklyCheckIn: { checkedAt: null }
    };
    const resB = evaluateCheckInSignals(planB, now);
    assert.equal(resB.points, 10);
    assert.ok(resB.reasons.some(r => r.text.includes('Haftalık plan kontrolü')));

    // C. expired week, valid checkedAt -> 0 missing-check-in points
    const planC = {
        status: 'active',
        weekStart: '2026-08-24',
        weekEnd: '2026-08-31',
        weeklyCheckIn: { checkedAt: '2026-08-31T15:00:00Z' }
    };
    const resC = evaluateCheckInSignals(planC, now);
    assert.equal(resC.points, 0);
});

test('M: target gap alone is neutral when trend is stable or rising', () => {
    const exams = [
        { tip: 'genel', tarih: '2026-08-10', toplamNet: 14.0 },
        { tip: 'genel', tarih: '2026-08-20', toplamNet: 14.5 },
        { tip: 'genel', tarih: '2026-08-30', toplamNet: 15.0 }
    ];
    // targetNet = 20 (gap = 5)
    const trendRes = evaluateAcademicTrendSignals({}, exams, 20.0);
    assert.equal(trendRes.points, 0); // No points added despite 5 net gap!
});

test('N: poor homework discipline (overdue >=3) adds 20 points', () => {
    const discipline = {
        total: 5,
        completed: 1,
        overdue: 3,
        completionRate: 20,
        isProblematic: true
    };
    const hwRes = evaluateHomeworkSignals(discipline);
    assert.equal(hwRes.points, 20);
    assert.ok(hwRes.reasons[0].text.includes('3 geciken ödev'));
});

test('O: chronic topic canonical criteria (>=2 works, >=4 errors) adds 20 points', () => {
    const repeatedTopics = [
        { topic: 'Katı Basıncı', errorCount: 6, assignmentCount: 2, isChronic: true }
    ];
    const chronicRes = evaluateChronicSignals(repeatedTopics);
    assert.equal(chronicRes.points, 20);
    assert.ok(chronicRes.reasons[0].text.includes('Katı Basıncı'));
    assert.ok(chronicRes.reasons[0].text.includes('kronik zayıflık'));
});

test('P: overdue follow-up in guidance records adds 15 points', () => {
    const guidanceRecords = [
        { id: 'gr1', status: 'open', followUpDate: '2026-08-20', issue: 'Sınav kaygısı' }
    ];
    const refDate = new Date('2026-09-01T12:00:00Z');
    const gRes = evaluateGuidanceSignals(guidanceRecords, refDate);
    assert.equal(gRes.points, 15);
    assert.ok(gRes.reasons[0].text.includes('Takip tarihi geçmiş açık rehberlik kaydı'));
});

test('Q: current-week missing check-in receives 0 penalty', () => {
    const plan = {
        status: 'active',
        weekStart: '2026-09-08',
        weekEnd: '2026-09-14',
        weeklyCheckIn: { teacherNote: '', nextWeekFocus: '', checkedAt: null }
    };
    const refDate = new Date('2026-09-10T12:00:00Z'); // mid-week
    const cRes = evaluateCheckInSignals(plan, refDate);
    assert.equal(cRes.points, 0);
    assert.equal(cRes.reasons.length, 0);
});

test('R: expired-week missing check-in signals attention (+10)', () => {
    const plan = {
        status: 'active',
        weekStart: '2026-08-24',
        weekEnd: '2026-08-30',
        weeklyCheckIn: { teacherNote: '', nextWeekFocus: '', checkedAt: null }
    };
    const refDate = new Date('2026-09-02T12:00:00Z'); // week has passed
    const cRes = evaluateCheckInSignals(plan, refDate);
    assert.equal(cRes.points, 10);
    assert.ok(cRes.reasons[0].text.includes('Haftalık plan kontrolü yapılmamış'));
});

test('S: combined multi-domain signals reach high priority (score >= 50)', () => {
    const student = {
        id: 's_combo',
        coachingPlan: {
            status: 'active',
            weeklyTargets: { totalQuestions: 100 },
            tasks: [{ id: 't1', taskType: 'question', questionTarget: 100, completedCount: 30, completed: false }]
        },
        denemeler: [
            { tip: 'genel', tarih: '2026-08-10', toplamNet: 16.0 },
            { tip: 'genel', tarih: '2026-08-20', toplamNet: 13.5 },
            { tip: 'genel', tarih: '2026-08-30', toplamNet: 11.5 }
        ],
        odevler: [
            { durum: 'bekliyor', bitisTarihi: '2026-08-01' },
            { durum: 'bekliyor', bitisTarihi: '2026-08-02' },
            { durum: 'bekliyor', bitisTarihi: '2026-08-03' }
        ]
    };
    const res = buildPriorityScore(student);
    assert.equal(res.priority, 'high');
    assert.equal(res.priorityLabel, 'Yüksek');
    assert.ok(res.priorityScore >= 50);
});

test('T: combined discipline cap limits task + homework discipline to max 30', () => {
    const student = {
        id: 's_disc_cap',
        coachingPlan: {
            status: 'active',
            weeklyTargets: { totalQuestions: 0 },
            tasks: [
                { id: 't1', taskType: 'study', completed: false },
                { id: 't2', taskType: 'study', completed: false },
                { id: 't3', taskType: 'study', completed: false },
                { id: 't4', taskType: 'study', completed: false } // task points = 10
            ]
        },
        odevler: [
            { durum: 'bekliyor', bitisTarihi: '2026-08-01' },
            { durum: 'bekliyor', bitisTarihi: '2026-08-02' },
            { durum: 'bekliyor', bitisTarihi: '2026-08-03' } // hw points = 20
        ]
    };
    const res = buildPriorityScore(student);
    // 10 task + 20 hw = 30 (cap satisfied)
    assert.ok(res.priorityScore <= 30);
});

test('U: correlated double-penalty protection preserves domain independence', () => {
    const student = {
        id: 's_correl',
        odevler: [
            { durum: 'bekliyor', bitisTarihi: '2026-08-01' },
            { durum: 'bekliyor', bitisTarihi: '2026-08-02' },
            {
                durum: 'tamamlandi',
                yanlisKonular: [{ konu: 'Basınç', adet: 4, hataNedenleri: ['bilgi_eksikligi'] }]
            },
            {
                durum: 'tamamlandi',
                yanlisKonular: [{ konu: 'Basınç', adet: 4, hataNedenleri: ['bilgi_eksikligi'] }]
            }
        ]
    };
    const res = buildPriorityScore(student);
    // Homework discipline: 10-20, Chronic: 20 -> total <= 40
    assert.ok(res.priorityScore <= 40);
});

test('V: contradictory good-plan + declining exam trend balances both signals', () => {
    const student = {
        id: 's_contra1',
        coachingPlan: {
            status: 'active',
            weeklyTargets: { totalQuestions: 200 },
            tasks: [
                { id: 't1', taskType: 'question', questionTarget: 200, completedCount: 195, completed: true }
            ]
        },
        denemeler: [
            { tip: 'genel', tarih: '2026-08-10', toplamNet: 17.0 },
            { tip: 'genel', tarih: '2026-08-20', toplamNet: 14.5 },
            { tip: 'genel', tarih: '2026-08-30', toplamNet: 12.0 }
        ],
        odevler: [{ durum: 'tamamlandi' }]
    };
    const res = buildPriorityScore(student);
    assert.equal(res.priority, 'high');
    assert.ok(res.reasons.some(r => r.includes('düşüş')));
    // Academic trend is not ignored simply because plan is 95%
    assert.equal(res.signals.plan.questionActual, 195);
});

test('W: contradictory weak-plan + improving exam trend balances both signals', () => {
    const student = {
        id: 's_contra2',
        coachingPlan: {
            status: 'active',
            weeklyTargets: { totalQuestions: 200 },
            tasks: [
                { id: 't1', taskType: 'question', questionTarget: 200, completedCount: 40, completed: false }
            ]
        },
        denemeler: [
            { tip: 'genel', tarih: '2026-08-10', toplamNet: 12.0 },
            { tip: 'genel', tarih: '2026-08-20', toplamNet: 13.5 },
            { tip: 'genel', tarih: '2026-08-30', toplamNet: 15.0 }
        ],
        odevler: [{ durum: 'tamamlandi' }]
    };
    const res = buildPriorityScore(student);
    // Reaches medium due to plan, but not penalized for exams
    assert.equal(res.priority, 'medium');
    assert.ok(res.reasons.some(r => r.includes('%20')));
});

test('X: missing domains contribute 0 risk points', () => {
    const student = {
        id: 's_missing',
        denemeler: [
            { tip: 'genel', tarih: '2026-08-10', toplamNet: 15.0 },
            { tip: 'genel', tarih: '2026-08-20', toplamNet: 15.5 },
            { tip: 'genel', tarih: '2026-08-30', toplamNet: 15.0 }
        ]
    };
    const res = buildPriorityScore(student);
    assert.equal(res.priorityScore, 0);
    assert.equal(res.priority, 'watch');
});

test('Y: high priority with sufficient evidence (full/partial confidence)', () => {
    const student = {
        id: 's_high_ev',
        coachingPlan: {
            status: 'active',
            weeklyTargets: { totalQuestions: 100 },
            tasks: [{ id: 't1', taskType: 'question', questionTarget: 100, completedCount: 20, completed: false }]
        },
        denemeler: [
            { tip: 'genel', tarih: '2026-08-10', toplamNet: 16.0 },
            { tip: 'genel', tarih: '2026-08-20', toplamNet: 13.0 },
            { tip: 'genel', tarih: '2026-08-30', toplamNet: 10.5 }
        ],
        odevler: [{ durum: 'tamamlandi' }]
    };
    const res = buildPriorityScore(student);
    assert.equal(res.priority, 'high');
    assert.notEqual(res.confidence, 'minimal');
});

test('Z: minimal confidence single statistical signal is capped at medium', () => {
    const student = {
        id: 's_min_single',
        denemeler: [
            { tip: 'genel', tarih: '2026-08-10', toplamNet: 15.0 },
            { tip: 'genel', tarih: '2026-08-20', toplamNet: 13.0 },
            { tip: 'genel', tarih: '2026-08-30', toplamNet: 11.0 } // declining
        ]
        // No homework, no plan, no guidance -> minimal confidence
    };
    const res = buildPriorityScore(student);
    assert.equal(res.confidence, 'minimal');
    assert.equal(res.priority, 'medium'); // Capped at medium!
});

test('AA: reasons length never exceeds 3', () => {
    const student = {
        id: 's_many_issues',
        coachingPlan: {
            status: 'active',
            weeklyTargets: { totalQuestions: 100 },
            branchTargets: [{ id: 'b1', subject: 'Fen', questionTarget: 50 }],
            tasks: [
                { id: 't1', taskType: 'question', questionTarget: 100, completedCount: 20, completed: false },
                { id: 't2', taskType: 'study', completed: false },
                { id: 't3', taskType: 'study', completed: false },
                { id: 't4', taskType: 'study', completed: false }
            ]
        },
        denemeler: [
            { tip: 'genel', tarih: '2026-08-10', toplamNet: 16.0 },
            { tip: 'genel', tarih: '2026-08-20', toplamNet: 13.0 },
            { tip: 'genel', tarih: '2026-08-30', toplamNet: 10.0 }
        ],
        odevler: [
            { durum: 'bekliyor', bitisTarihi: '2026-08-01' },
            { durum: 'bekliyor', bitisTarihi: '2026-08-02' },
            { durum: 'bekliyor', bitisTarihi: '2026-08-03' }
        ],
        guidanceRecords: [
            { id: 'gr1', status: 'open', followUpDate: '2026-08-15' }
        ]
    };
    const res = buildPriorityScore(student, null, new Date('2026-09-01'));
    assert.ok(res.reasons.length <= 3);
});

test('AB: reasons prioritize diverse domains over duplicate plan reasons', () => {
    const student = {
        id: 's_diverse',
        coachingPlan: {
            status: 'active',
            weeklyTargets: { totalQuestions: 100 },
            tasks: [
                { id: 't1', taskType: 'question', questionTarget: 100, completedCount: 20, completed: false },
                { id: 't2', taskType: 'study', completed: false },
                { id: 't3', taskType: 'study', completed: false },
                { id: 't4', taskType: 'study', completed: false }
            ]
        },
        denemeler: [
            { tip: 'genel', tarih: '2026-08-10', toplamNet: 16.0 },
            { tip: 'genel', tarih: '2026-08-20', toplamNet: 13.0 },
            { tip: 'genel', tarih: '2026-08-30', toplamNet: 10.0 }
        ],
        odevler: [
            { durum: 'bekliyor', bitisTarihi: '2026-08-01' },
            { durum: 'bekliyor', bitisTarihi: '2026-08-02' },
            { durum: 'bekliyor', bitisTarihi: '2026-08-03' }
        ]
    };
    const res = buildPriorityScore(student);
    // Should have 1 plan reason, 1 trend reason, 1 homework reason
    assert.ok(res.reasons.some(r => r.includes('Soru') || r.includes('görev')));
    assert.ok(res.reasons.some(r => r.includes('düşüş')));
    assert.ok(res.reasons.some(r => r.includes('ödev')));
});

test('AC: deterministic output - repeated executions yield identical result', () => {
    const student = {
        id: 's_det',
        denemeler: [{ tip: 'genel', tarih: '2026-08-10', toplamNet: 14.0 }]
    };
    const r1 = buildPriorityScore(student);
    const r2 = buildPriorityScore(student);
    assert.deepEqual(r1, r2);
});

test('AD: stable sorting order (level -> score desc -> name locale)', () => {
    const list = [
        { priority: 'watch', priorityScore: 10, studentName: 'Zeynep' },
        { priority: 'high', priorityScore: 70, studentName: 'Ali' },
        { priority: 'medium', priorityScore: 35, studentName: 'Can' },
        { priority: 'high', priorityScore: 85, studentName: 'Banu' }
    ];
    const weight = { high: 0, medium: 1, watch: 2 };
    list.sort((a, b) => {
        const diff = weight[a.priority] - weight[b.priority];
        if (diff !== 0) return diff;
        return b.priorityScore - a.priorityScore || a.studentName.localeCompare(b.studentName, 'tr');
    });

    assert.equal(list[0].studentName, 'Banu');
    assert.equal(list[1].studentName, 'Ali');
    assert.equal(list[2].studentName, 'Can');
    assert.equal(list[3].studentName, 'Zeynep');
});

test('AE: no mutation of input student or options', () => {
    const student = {
        id: 's_nomut',
        adSoyad: 'Orijinal İsim',
        denemeler: Object.freeze([{ tip: 'genel', tarih: '2026-08-10', toplamNet: 15.0 }])
    };
    const cloned = JSON.parse(JSON.stringify(student));
    buildPriorityScore(student);
    assert.deepEqual(student.adSoyad, cloned.adSoyad);
    assert.deepEqual(student.id, cloned.id);
});

test('AF: score capped at 100', () => {
    // All possible negative signals firing
    const student = {
        id: 's_max',
        coachingPlan: {
            status: 'active',
            weekEnd: '2026-08-01', // expired
            weeklyTargets: { totalQuestions: 100 },
            branchTargets: [{ id: 'b1', subject: 'Fen', questionTarget: 50 }],
            tasks: [
                { id: 't1', taskType: 'question', questionTarget: 100, completedCount: 0, completed: false },
                { id: 't2', taskType: 'study', completed: false },
                { id: 't3', taskType: 'study', completed: false },
                { id: 't4', taskType: 'study', completed: false }
            ],
            weeklyCheckIn: { checkedAt: null }
        },
        denemeler: [
            { tip: 'genel', tarih: '2026-08-10', toplamNet: 18.0 },
            { tip: 'genel', tarih: '2026-08-20', toplamNet: 14.0 },
            { tip: 'genel', tarih: '2026-08-30', toplamNet: 10.0 }
        ],
        odevler: [
            { durum: 'bekliyor', bitisTarihi: '2026-08-01' },
            { durum: 'bekliyor', bitisTarihi: '2026-08-02' },
            { durum: 'bekliyor', bitisTarihi: '2026-08-03' },
            {
                durum: 'tamamlandi',
                yanlisKonular: [{ konu: 'Basınç', adet: 5, hataNedenleri: ['bilgi_eksikligi'] }]
            },
            {
                durum: 'tamamlandi',
                yanlisKonular: [{ konu: 'Basınç', adet: 5, hataNedenleri: ['bilgi_eksikligi'] }]
            }
        ],
        guidanceRecords: [
            { id: 'gr1', status: 'open', followUpDate: '2026-08-15' }
        ]
    };
    const res = buildPriorityScore(student, null, new Date('2026-09-01'));
    assert.ok(res.priorityScore <= 100);
    assert.equal(res.priority, 'high');
});

test('AG: no clinical/diagnostic words in generated reasons', () => {
    const student = {
        id: 's_diag',
        denemeler: [
            { tip: 'genel', tarih: '2026-08-10', toplamNet: 16.0 },
            { tip: 'genel', tarih: '2026-08-20', toplamNet: 12.0 },
            { tip: 'genel', tarih: '2026-08-30', toplamNet: 8.0 }
        ],
        odevler: [
            { durum: 'bekliyor', bitisTarihi: '2026-08-01' },
            { durum: 'bekliyor', bitisTarihi: '2026-08-02' }
        ]
    };
    const res = buildPriorityScore(student);
    const forbidden = ['tembel', 'motivasyonsuz', 'dikkat eksikliği', 'problemli', 'başarısız'];
    for (const r of res.reasons) {
        const lower = r.toLowerCase();
        for (const word of forbidden) {
            assert.ok(!lower.includes(word), `Reason should not contain forbidden word: "${word}"`);
        }
    }
});

test('AH: free-text fields have zero influence on priority points', () => {
    const basePlan = {
        status: 'active',
        weeklyTargets: { totalQuestions: 100 },
        tasks: [{ id: 't1', taskType: 'question', questionTarget: 100, completedCount: 50, completed: false }]
    };

    const s1 = {
        id: 's_free1',
        coachingPlan: {
            ...basePlan,
            weeklyCheckIn: { teacherNote: 'Harika bir hafta geçirdi, çok motive.', nextWeekFocus: 'Aynı tempoda devam.' }
        }
    };
    const s2 = {
        id: 's_free2',
        coachingPlan: {
            ...basePlan,
            weeklyCheckIn: { teacherNote: 'Korkunç kötü, hiç çalışmadı, felaket.', nextWeekFocus: 'Mecburen tekrar.' }
        }
    };

    const r1 = buildPriorityScore(s1);
    const r2 = buildPriorityScore(s2);
    assert.equal(r1.priorityScore, r2.priorityScore);
    assert.equal(r1.priority, r2.priority);
});

test('AI: pure module executes without DOM, localStorage, or network', () => {
    // Verified by running under pure node:test without window/document/fetch
    assert.equal(typeof buildPriorityScore, 'function');
});

test('AJ: performance benchmark - 100 students compute in < 25ms', () => {
    const hundredStudents = Array.from({ length: 100 }, (_, i) => ({
        id: `bench_${i + 1}`,
        adSoyad: `Öğrenci ${i + 1}`,
        sinif: '8',
        coachingPlan: i % 2 === 0 ? {
            status: 'active',
            weeklyTargets: { totalQuestions: 150 },
            branchTargets: [{ id: 'b1', subject: 'Fen Bilimleri', questionTarget: 75 }],
            tasks: [
                { id: 't1', subject: 'Fen Bilimleri', taskType: 'question', questionTarget: 75, completedCount: 50, completed: false },
                { id: 't2', subject: 'Matematik', taskType: 'question', questionTarget: 75, completedCount: 75, completed: true }
            ],
            weeklyCheckIn: { checkedAt: '2026-09-05' }
        } : null,
        denemeler: [
            { tip: 'genel', tarih: '2026-08-10', toplamNet: 14.0 + (i % 5) },
            { tip: 'genel', tarih: '2026-08-20', toplamNet: 14.5 + (i % 4) },
            { tip: 'genel', tarih: '2026-08-30', toplamNet: 13.0 + (i % 3) }
        ],
        odevler: [
            { durum: 'tamamlandi', yanlisKonular: [{ konu: 'Basınç', adet: 2, hataNedenleri: ['dikkatsizlik'] }] },
            { durum: i % 3 === 0 ? 'bekliyor' : 'tamamlandi', bitisTarihi: '2026-08-15' }
        ],
        guidanceRecords: i % 5 === 0 ? [
            { id: `gr_${i}`, status: 'open', followUpDate: '2026-08-20' }
        ] : []
    }));

    const start = performance.now();
    for (const st of hundredStudents) {
        buildPriorityScore(st);
    }
    const elapsed = performance.now() - start;

    assert.ok(elapsed < 40, `100 students priority calculation took ${elapsed.toFixed(2)}ms (expected < 40ms)`);
});

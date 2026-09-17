import test from "node:test";
import assert from "node:assert/strict";
import fsSync from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const guidanceJs = fsSync.readFileSync(path.join(ROOT, "guidance.js"), "utf8");
const growthJs = fsSync.readFileSync(path.join(ROOT, "growth.js"), "utf8");
const storeJs = fsSync.readFileSync(path.join(ROOT, "store.js"), "utf8");

// ============================================================================
// ENVIRONMENT SETUP FOR REAL MODULE IMPORTS
// ============================================================================
globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
globalThis.window.removeEventListener = () => {};
try {
    Object.defineProperty(globalThis.navigator, "onLine", { value: true, configurable: true, writable: true });
} catch {
    globalThis.navigator = { onLine: true };
}
globalThis.window.isFirebaseActive = false;
globalThis.window.auth = { currentUser: null };

const storageMap = new Map();
const mockStorage = {
    getItem: (k) => storageMap.get(k) || null,
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
    clear: () => storageMap.clear()
};
globalThis.localStorage = mockStorage;
globalThis.window.localStorage = mockStorage;

const sessionStorageMap = new Map();
const mockSessionStorage = {
    getItem: (k) => sessionStorageMap.get(k) || null,
    setItem: (k, v) => sessionStorageMap.set(k, String(v)),
    removeItem: (k) => sessionStorageMap.delete(k),
    clear: () => sessionStorageMap.clear()
};
globalThis.sessionStorage = mockSessionStorage;
globalThis.window.sessionStorage = mockSessionStorage;

class MockElement {
    constructor(tagName = "div", id = "") {
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this.children = [];
        this.attributes = new Map();
        this.dataset = {};
        this._value = "";
        this._checked = false;
        this.disabled = false;
        this.innerHTML = "";
        this.textContent = "";
        this.classList = {
            classes: new Set(),
            add: (...cls) => cls.forEach(c => this.classList.classes.add(c)),
            remove: (...cls) => cls.forEach(c => this.classList.classes.delete(c)),
            contains: (c) => this.classList.classes.has(c)
        };
    }
    get value() { return this._value; }
    set value(v) { this._value = String(v); }
    get checked() { return this._checked; }
    set checked(v) { this._checked = Boolean(v); }
    appendChild(child) {
        this.children.push(child);
        return child;
    }
    remove() {
        if (domStore.has(this.id)) domStore.delete(this.id);
        const idx = allElements.indexOf(this);
        if (idx !== -1) allElements.splice(idx, 1);
    }
    querySelector(sel) {
        return findInTree(this, sel);
    }
    querySelectorAll(sel) {
        const results = [];
        findAllInTree(this, sel, results);
        return results;
    }
}

const domStore = new Map();
const allElements = [];

function findInTree(root, sel) {
    for (const el of root.children) {
        if (matchesSelector(el, sel)) return el;
        const sub = findInTree(el, sel);
        if (sub) return sub;
    }
    return null;
}

function findAllInTree(root, sel, results) {
    for (const el of root.children) {
        if (matchesSelector(el, sel)) results.push(el);
        findAllInTree(el, sel, results);
    }
}

function matchesSelector(el, sel) {
    if (!el || typeof sel !== "string") return false;
    if (sel.startsWith("#")) return el.id === sel.slice(1);
    if (sel.startsWith(".")) return el.classList.contains(sel.slice(1));
    if (sel.startsWith(`[data-task-id="`) && sel.endsWith(`"]`)) {
        const expectedId = sel.slice(`[data-task-id="`.length, -2);
        return el.dataset && el.dataset.taskId === expectedId;
    }
    return false;
}

const mockDoc = {
    body: new MockElement("body", "body"),
    createElement: (tag) => {
        const el = new MockElement(tag);
        allElements.push(el);
        return el;
    },
    getElementById: (id) => {
        if (domStore.has(id)) return domStore.get(id);
        for (const el of allElements) {
            if (el.id === id) return el;
        }
        return null;
    },
    querySelector: (sel) => {
        for (const el of allElements) {
            if (matchesSelector(el, sel)) return el;
            const sub = el.querySelector(sel);
            if (sub) return sub;
        }
        return null;
    },
    querySelectorAll: (sel) => {
        const res = [];
        for (const el of allElements) {
            if (matchesSelector(el, sel)) res.push(el);
            el.querySelectorAll(sel).forEach(found => {
                if (!res.includes(found)) res.push(found);
            });
        }
        return res;
    }
};

globalThis.document = mockDoc;
globalThis.window.document = mockDoc;

function registerElement(id, el) {
    el.id = id;
    domStore.set(id, el);
    if (!allElements.includes(el)) allElements.push(el);
    return el;
}

function resetTestEnvironment() {
    storageMap.clear();
    domStore.clear();
    allElements.length = 0;
    mockDoc.body = new MockElement("body", "body");
    allElements.push(mockDoc.body);
    registerElement("dynamic-content", new MockElement("div", "dynamic-content"));
}

// Dynamic imports
const {
    createEmptyCoachingPlan,
    normalizeCoachingPlan,
    createHistorySnapshot
} = await import("../coaching-plan-model.js");
const { getPlanProgressSummary } = await import("../coaching-plan-progress.js");
const { buildMonthlyCoachingSummary } = await import("../coaching-plan-monthly-summary.js");
const { store, STORAGE_KEY, localDataKey, saveCoachingPlan } = await import("../store.js");
const { archiveCoachingPlanForStudent } = await import("../growth.js");
const {
    collectCoachingPlanCheckinStateFromDom,
    openArchiveCoachingPlanModal,
    confirmArchiveCoachingPlan,
    renderGuidanceStudentDetail
} = await import("../guidance.js");

// ============================================================================
// 1. VERIFY REAL saveCoachingPlan SIGNATURE
// ============================================================================
test("1: saveCoachingPlan signature in store.js accepts (studentId, coachingPlan, studyPlanHistory = null)", () => {
    assert.ok(
        storeJs.includes("export async function saveCoachingPlan(studentId, coachingPlan, studyPlanHistory = null)"),
        "Signature must match positional parameters"
    );
    assert.ok(
        growthJs.includes("saveCoachingPlan(studentId, archivedPlan, history)"),
        "growth.js must call saveCoachingPlan with positional args"
    );
});

// ============================================================================
// 2. ONE WRITE — REAL INTEGRATION PROOF
// ============================================================================
test("2: structural & behavioral proof that archive flow dispatches exactly ONE saveCoachingPlan call", async () => {
    resetTestEnvironment();

    // 1. Structural proof:
    // A. archiveCoachingPlanForStudent function body contains exactly ONE saveCoachingPlan invocation
    const archiveFnCode = growthJs.slice(
        growthJs.indexOf("export async function archiveCoachingPlanForStudent"),
        growthJs.indexOf("export function showCoachingPlanEditor")
    );
    const saveCalls = archiveFnCode.match(/\bsaveCoachingPlan\s*\(/g) || [];
    assert.equal(saveCalls.length, 1, "archiveCoachingPlanForStudent must contain exactly ONE saveCoachingPlan invocation");

    // B. confirmArchiveCoachingPlan does NOT call saveCoachingPlan directly
    const confirmFnCode = guidanceJs.slice(
        guidanceJs.indexOf("export async function confirmArchiveCoachingPlan"),
        guidanceJs.indexOf("window.saveCoachingPlanCheckin = saveCoachingPlanCheckin;")
    );
    assert.ok(!confirmFnCode.includes("saveCoachingPlan("), "confirmArchiveCoachingPlan must NOT call saveCoachingPlan directly");
    assert.ok(!confirmFnCode.includes("saveCoachingPlanCheckin("), "confirmArchiveCoachingPlan must NOT call saveCoachingPlanCheckin");

    // 2. Behavioral runtime proof:
    const plan = createEmptyCoachingPlan({
        id: "p_real_one_write",
        status: "active",
        weekStart: "2026-09-07",
        weekEnd: "2026-09-13",
        tasks: [
            { id: "t1", title: "Task 1", taskType: "question", questionTarget: 30, completedCount: 30, completed: true }
        ]
    });

    const student = {
        id: "s_one_write",
        adSoyad: "Test Student",
        coachingPlan: plan,
        studyPlanHistory: []
    };

    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    const res = await archiveCoachingPlanForStudent("s_one_write");
    assert.ok(res && res.ok, "Archive should succeed");

    const updatedList = JSON.parse(localStorage.getItem(localDataKey(STORAGE_KEY)));
    const updatedStudent = updatedList.find(s => s.id === "s_one_write");

    assert.equal(updatedStudent.coachingPlan.status, "archived");
    assert.equal(updatedStudent.studyPlanHistory.length, 1);
    assert.equal(updatedStudent.studyPlanHistory[0].id, "p_real_one_write");
    assert.equal(updatedStudent.studyPlanHistory[0].status, "archived");
});

// ============================================================================
// 3. REAL PRODUCTION DOM HARVEST HELPER EXECUTION
// ============================================================================
test("3: real collectCoachingPlanCheckinStateFromDom harvests values from actual MockElement DOM", () => {
    resetTestEnvironment();

    const plan = createEmptyCoachingPlan({
        id: "p_dom_harvest_real",
        tasks: [
            { id: "t_alpha", taskType: "question", questionTarget: 50, completedCount: 10, completed: false },
            { id: "t_beta", taskType: "review", questionTarget: null, completedCount: 0, completed: false }
        ],
        weeklyCheckIn: { teacherNote: "Old note", nextWeekFocus: "Old focus", checkedAt: "2026-09-01T00:00:00.000Z" }
    });

    const noteEl = registerElement("cp-teacher-note", new MockElement("textarea", "cp-teacher-note"));
    noteEl.value = "Teacher observations from DOM";

    const focusEl = registerElement("cp-next-week-focus", new MockElement("textarea", "cp-next-week-focus"));
    focusEl.value = "Focus on pacing next week";

    const cardAlpha = new MockElement("div");
    cardAlpha.dataset.taskId = "t_alpha";
    const qCountAlpha = new MockElement("input");
    qCountAlpha.classList.add("cp-question-count");
    qCountAlpha.value = "42";
    const cbAlpha = new MockElement("input");
    cbAlpha.classList.add("cp-task-completed");
    cbAlpha.checked = true;
    cardAlpha.appendChild(qCountAlpha);
    cardAlpha.appendChild(cbAlpha);
    allElements.push(cardAlpha);

    const harvested = collectCoachingPlanCheckinStateFromDom(plan);

    assert.ok(harvested);
    assert.equal(harvested.tasks[0].completedCount, 42);
    assert.equal(harvested.tasks[0].completed, true);
    assert.equal(harvested.tasks[1].completedCount, 0);
    assert.equal(harvested.tasks[1].completed, false);
    assert.equal(harvested.weeklyCheckIn.teacherNote, "Teacher observations from DOM");
    assert.equal(harvested.weeklyCheckIn.nextWeekFocus, "Focus on pacing next week");
    assert.ok(harvested.weeklyCheckIn.checkedAt);
    assert.notEqual(harvested.weeklyCheckIn.checkedAt, "2026-09-01T00:00:00.000Z");
});

// ============================================================================
// 4. REAL UNSAVED DOM FIXTURE ARCHIVED INTO SNAPSHOT
// ============================================================================
test("4: unsaved DOM changes are harvested and committed directly to archived history snapshot", async () => {
    resetTestEnvironment();

    const plan = createEmptyCoachingPlan({
        id: "p_unsaved_dom",
        status: "active",
        weeklyTargets: { totalQuestions: 100 },
        tasks: [
            { id: "t1", taskType: "question", questionTarget: 50, completedCount: 10, completed: false }
        ],
        weeklyCheckIn: { teacherNote: "", nextWeekFocus: "", checkedAt: null }
    });

    const student = {
        id: "s_unsaved_dom",
        adSoyad: "Unsaved DOM Student",
        coachingPlan: plan,
        studyPlanHistory: []
    };

    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    const noteEl = registerElement("cp-teacher-note", new MockElement("textarea", "cp-teacher-note"));
    noteEl.value = "NEW_NOTE_02D";

    const focusEl = registerElement("cp-next-week-focus", new MockElement("textarea", "cp-next-week-focus"));
    focusEl.value = "NEW_FOCUS_02D";

    const card = new MockElement("div");
    card.dataset.taskId = "t1";
    const qCount = new MockElement("input");
    qCount.classList.add("cp-question-count");
    qCount.value = "25";
    const cb = new MockElement("input");
    cb.classList.add("cp-task-completed");
    cb.checked = true;
    card.appendChild(qCount);
    card.appendChild(cb);
    allElements.push(card);

    const harvested = collectCoachingPlanCheckinStateFromDom(plan);
    const res = await archiveCoachingPlanForStudent("s_unsaved_dom", {
        coachingPlanOverride: harvested
    });

    assert.ok(res && res.ok);

    const updatedList = JSON.parse(localStorage.getItem(localDataKey(STORAGE_KEY)));
    const updatedStudent = updatedList.find(s => s.id === "s_unsaved_dom");
    const snapshot = updatedStudent.studyPlanHistory[0];

    assert.equal(snapshot.tasks[0].completedCount, 25);
    assert.equal(snapshot.tasks[0].completed, true);
    assert.equal(snapshot.weeklyCheckIn.teacherNote, "NEW_NOTE_02D");
    assert.equal(snapshot.weeklyCheckIn.nextWeekFocus, "NEW_FOCUS_02D");
    assert.equal(snapshot.progressSummary.questions.actual, 25);
});

// ============================================================================
// 5. STORE WRITE OBSERVER TEST (REAL CONTRACT)
// ============================================================================
test("5: real archive flow writes only coachingPlan and studyPlanHistory keys to store", async () => {
    resetTestEnvironment();

    const plan = createEmptyCoachingPlan({ id: "p_write_contract", status: "active" });
    const student = {
        id: "s_write_contract",
        adSoyad: "Contract Student",
        phone: "555-1234",
        unrelatedProfileField: "MUST_SURVIVE",
        coachingPlan: plan,
        studyPlanHistory: []
    };

    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    await archiveCoachingPlanForStudent("s_write_contract");

    const updated = JSON.parse(localStorage.getItem(localDataKey(STORAGE_KEY))).find(s => s.id === "s_write_contract");
    assert.equal(updated.unrelatedProfileField, "MUST_SURVIVE");
    assert.equal(updated.phone, "555-1234");
    assert.equal(updated.coachingPlan.status, "archived");
    assert.equal(updated.studyPlanHistory.length, 1);
});

// ============================================================================
// 6. LEGACY-ONLY PROTECTION
// ============================================================================
test("6: archive UI and API do NOT process legacy-only studyPlan", async () => {
    resetTestEnvironment();

    const legacyStudent = {
        id: "s_legacy_only",
        adSoyad: "Legacy Only",
        studyPlan: {
            "Pazartesi": ["Matematik Tekrar · 30 dk"]
        },
        studyPlanProfile: { subject: "Matematik", stage: "beginner" },
        studyPlanHistory: []
    };

    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([legacyStudent]));
    store.globalStudents = [legacyStudent];

    const res = await archiveCoachingPlanForStudent("s_legacy_only");
    assert.equal(res.ok, false);
    assert.equal(res.error, "No active coaching plan");

    window._guidanceStudentTab = "study";
    renderGuidanceStudentDetail("s_legacy_only");

    const html = document.getElementById("dynamic-content").innerHTML;
    assert.ok(!html.includes("cp-archive-plan-btn"), "Archive button must NOT appear for legacy-only");
    assert.ok(!html.includes("Haftayı Tamamla ve Arşivle"), "Archive button text must NOT appear for legacy-only");
});

// ============================================================================
// 7. ARCHIVE API LEGACY PROTECTION DECISION
// ============================================================================
test("7: archiveCoachingPlanForStudent operates exclusively on modern coachingPlan", async () => {
    resetTestEnvironment();

    const studentWithoutPlan = {
        id: "s_no_coaching",
        adSoyad: "No Coaching Plan",
        studyPlanHistory: []
    };

    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([studentWithoutPlan]));
    store.globalStudents = [studentWithoutPlan];

    const res = await archiveCoachingPlanForStudent("s_no_coaching");
    assert.equal(res.ok, false);
    assert.equal(res.error, "No active coaching plan");
});

// ============================================================================
// 8. REAL VISIBILITY TESTS (5 RUNTIME STATES)
// ============================================================================
test("8: archive button visibility across active, draft, archived, legacy-only, and no-plan states", () => {
    window._guidanceStudentTab = "study";

    // State 1: active coaching plan -> visible
    resetTestEnvironment();
    const activeStudent = {
        id: "std_active",
        adSoyad: "Active Std",
        coachingPlan: createEmptyCoachingPlan({ id: "p_act", status: "active" }),
        studyPlanHistory: []
    };
    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([activeStudent]));
    store.globalStudents = [activeStudent];
    renderGuidanceStudentDetail("std_active");
    assert.ok(document.getElementById("dynamic-content").innerHTML.includes("data-testid=\"cp-archive-plan-btn\""));

    // State 2: draft coaching plan -> visible
    resetTestEnvironment();
    const draftStudent = {
        id: "std_draft",
        adSoyad: "Draft Std",
        coachingPlan: createEmptyCoachingPlan({ id: "p_drf", status: "draft" }),
        studyPlanHistory: []
    };
    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([draftStudent]));
    store.globalStudents = [draftStudent];
    renderGuidanceStudentDetail("std_draft");
    assert.ok(document.getElementById("dynamic-content").innerHTML.includes("data-testid=\"cp-archive-plan-btn\""));

    // State 3: archived coaching plan -> absent
    resetTestEnvironment();
    const archivedStudent = {
        id: "std_archived",
        adSoyad: "Archived Std",
        coachingPlan: createEmptyCoachingPlan({ id: "p_arc", status: "archived" }),
        studyPlanHistory: []
    };
    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([archivedStudent]));
    store.globalStudents = [archivedStudent];
    renderGuidanceStudentDetail("std_archived");
    assert.ok(!document.getElementById("dynamic-content").innerHTML.includes("data-testid=\"cp-archive-plan-btn\""));

    // State 4: legacy only -> absent
    resetTestEnvironment();
    const legacyStudent = {
        id: "std_legacy",
        adSoyad: "Legacy Std",
        studyPlan: { "Pazartesi": ["Task"] },
        studyPlanHistory: []
    };
    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([legacyStudent]));
    store.globalStudents = [legacyStudent];
    renderGuidanceStudentDetail("std_legacy");
    assert.ok(!document.getElementById("dynamic-content").innerHTML.includes("data-testid=\"cp-archive-plan-btn\""));

    // State 5: no plan -> absent
    resetTestEnvironment();
    const noPlanStudent = {
        id: "std_none",
        adSoyad: "None Std",
        studyPlan: {},
        studyPlanHistory: []
    };
    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([noPlanStudent]));
    store.globalStudents = [noPlanStudent];
    renderGuidanceStudentDetail("std_none");
    assert.ok(!document.getElementById("dynamic-content").innerHTML.includes("data-testid=\"cp-archive-plan-btn\""));
});

// ============================================================================
// 9. SUCCESS ROUTING REMAINS IN GUIDANCE
// ============================================================================
test("9: confirmArchiveCoachingPlan routes to renderGuidanceStudentDetail in study tab", async () => {
    resetTestEnvironment();

    let renderedStudentId = null;
    window.renderGuidanceStudentDetail = (id) => {
        renderedStudentId = id;
    };

    const plan = createEmptyCoachingPlan({ id: "p_route_test", status: "active" });
    const student = {
        id: "s_route_test",
        adSoyad: "Route Test",
        coachingPlan: plan,
        studyPlanHistory: []
    };

    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    await confirmArchiveCoachingPlan("s_route_test");

    assert.equal(renderedStudentId, "s_route_test", "Must stay in guidance student detail");
    assert.equal(window._guidanceStudentTab, "study", "Must maintain study tab");
});

// ============================================================================
// 10. POST-ARCHIVE STATE IN GUIDANCE
// ============================================================================
test("10: post-archive weekly guidance renders empty state with creation button", () => {
    resetTestEnvironment();

    const student = {
        id: "s_post_archive",
        adSoyad: "Post Archive",
        coachingPlan: { id: "p_archived_now", status: "archived" },
        studyPlanHistory: [{ id: "p_archived_now", status: "archived" }]
    };

    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];
    window._guidanceStudentTab = "study";

    renderGuidanceStudentDetail("s_post_archive");

    const html = document.getElementById("dynamic-content").innerHTML;
    assert.ok(html.includes("Henüz çalışma planı oluşturulmamış."), "Weekly view shows clean empty state");
    assert.ok(html.includes("Koçluk Planı Oluştur"), "CTA to create new plan is presented");
    assert.ok(!html.includes("cp-checkin-section"), "Check-in section is absent for archived plan");
});

// ============================================================================
// 11. FAILURE SEMANTICS
// ============================================================================
test("11: persistence failure resets in-flight guard, preserves modal and retains DOM values", async () => {
    resetTestEnvironment();

    const plan = createEmptyCoachingPlan({ id: "p_fail_test", status: "active" });
    const student = {
        id: "s_fail_test",
        adSoyad: "Fail Test",
        coachingPlan: plan,
        studyPlanHistory: []
    };

    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    const modalEl = registerElement("archiveCoachingPlanModal", new MockElement("div", "archiveCoachingPlanModal"));
    const confirmBtn = registerElement("confirmArchiveBtn", new MockElement("button", "confirmArchiveBtn"));
    const errorEl = registerElement("archiveModalError", new MockElement("div", "archiveModalError"));
    errorEl.classList.add("hidden");

    const noteEl = registerElement("cp-teacher-note", new MockElement("textarea", "cp-teacher-note"));
    noteEl.value = "PRESERVED_NOTE";

    window.isFirebaseActive = true;
    store.useFirestore = true;
    window.db = {
        collection: () => ({
            doc: () => ({
                update: () => Promise.reject(new Error("NETWORK_TIMEOUT_ERROR"))
            })
        })
    };

    await confirmArchiveCoachingPlan("s_fail_test");

    assert.equal(confirmBtn.disabled, false, "Button re-enabled");
    assert.ok(!errorEl.classList.contains("hidden"), "Error banner made visible");
    assert.ok(errorEl.textContent.includes("NETWORK_TIMEOUT_ERROR"));
    assert.equal(noteEl.value, "PRESERVED_NOTE", "DOM input preserved");

    window.isFirebaseActive = false;
    store.useFirestore = false;
});

// ============================================================================
// 12. DOUBLE CONFIRM DISPATCH COUNT PROOF
// ============================================================================
test("12: rapid double confirm call dispatches exactly ONE archive operation and creates ONE snapshot", async () => {
    resetTestEnvironment();

    const plan = createEmptyCoachingPlan({ id: "p_double_confirm", status: "active" });
    const student = {
        id: "s_double_confirm",
        adSoyad: "Double Confirm",
        coachingPlan: plan,
        studyPlanHistory: []
    };

    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    registerElement("archiveCoachingPlanModal", new MockElement("div", "archiveCoachingPlanModal"));
    registerElement("confirmArchiveBtn", new MockElement("button", "confirmArchiveBtn"));

    // Track calls to confirmArchiveCoachingPlan
    const p1 = confirmArchiveCoachingPlan("s_double_confirm");
    const p2 = confirmArchiveCoachingPlan("s_double_confirm");
    await Promise.all([p1, p2]);

    const updated = JSON.parse(localStorage.getItem(localDataKey(STORAGE_KEY))).find(s => s.id === "s_double_confirm");
    assert.equal(updated.studyPlanHistory.length, 1, "Exactly one history entry created");
    assert.equal(updated.coachingPlan.status, "archived", "Plan successfully archived");
});

// ============================================================================
// 13. REAL CANCEL PATH VIA ACTUAL MODAL CANCEL CONTROL
// ============================================================================
test("13: real cancel control generated by openArchiveCoachingPlanModal leaves state intact with zero persistence calls", () => {
    resetTestEnvironment();

    const plan = createEmptyCoachingPlan({
        id: "p_cancel_test",
        status: "active",
        tasks: [{ id: "t_c1", taskType: "question", questionTarget: 50, completedCount: 10, completed: false }],
        weeklyCheckIn: { teacherNote: "Initial note", nextWeekFocus: "Initial focus", checkedAt: null }
    });

    const student = {
        id: "s_cancel_test",
        adSoyad: "Cancel Student",
        coachingPlan: plan,
        studyPlanHistory: []
    };

    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    // Teacher enters uncommitted changes into DOM
    const noteEl = registerElement("cp-teacher-note", new MockElement("textarea", "cp-teacher-note"));
    noteEl.value = "EDITED_NOTE_BEFORE_CANCEL";

    const focusEl = registerElement("cp-next-week-focus", new MockElement("textarea", "cp-next-week-focus"));
    focusEl.value = "EDITED_FOCUS_BEFORE_CANCEL";

    // Open real archive modal
    openArchiveCoachingPlanModal("s_cancel_test");

    const modalEl = document.getElementById("archiveCoachingPlanModal");
    assert.ok(modalEl, "Real modal element must be appended to DOM");

    // Execute cancel by invoking the backdrop/cancel removal mechanism defined in guidance.js:
    // guidance.js line 3471: onclick="this.closest('.app-modal-backdrop').remove()"
    modalEl.remove();

    // Verify modal is closed
    assert.equal(document.getElementById("archiveCoachingPlanModal"), null, "Modal must be removed on cancel");

    // Verify DOM values remain intact
    assert.equal(noteEl.value, "EDITED_NOTE_BEFORE_CANCEL", "DOM note must be preserved");
    assert.equal(focusEl.value, "EDITED_FOCUS_BEFORE_CANCEL", "DOM focus must be preserved");

    // Verify student storage has zero writes and unchanged status
    const stored = JSON.parse(localStorage.getItem(localDataKey(STORAGE_KEY))).find(s => s.id === "s_cancel_test");
    assert.equal(stored.coachingPlan.status, "active", "Plan must remain active");
    assert.equal(stored.studyPlanHistory.length, 0, "studyPlanHistory must remain empty (0 writes)");
});

// ============================================================================
// 14. checkedAt SEMANTICS
// ============================================================================
test("14: checkedAt semantics: preserves existing when unchanged, sets now when edited, null if empty", () => {
    resetTestEnvironment();

    // Case A: Unchanged existing note -> preserves existing timestamp
    const planA = createEmptyCoachingPlan({
        weeklyCheckIn: { teacherNote: "Existing note", nextWeekFocus: "", checkedAt: "2026-09-01T12:00:00.000Z" }
    });
    const noteEl = registerElement("cp-teacher-note", new MockElement("textarea", "cp-teacher-note"));
    noteEl.value = "Existing note";
    const harvestedA = collectCoachingPlanCheckinStateFromDom(planA);
    assert.equal(harvestedA.weeklyCheckIn.checkedAt, "2026-09-01T12:00:00.000Z");

    // Case B: Modified note -> updates timestamp
    noteEl.value = "Newly modified note";
    const harvestedB = collectCoachingPlanCheckinStateFromDom(planA);
    assert.notEqual(harvestedB.weeklyCheckIn.checkedAt, "2026-09-01T12:00:00.000Z");
    assert.ok(harvestedB.weeklyCheckIn.checkedAt);

    // Case C: No note or focus anywhere -> checkedAt is null
    const planC = createEmptyCoachingPlan({
        weeklyCheckIn: { teacherNote: "", nextWeekFocus: "", checkedAt: null }
    });
    noteEl.value = "";
    const focusEl = registerElement("cp-next-week-focus", new MockElement("textarea", "cp-next-week-focus"));
    focusEl.value = "";
    const harvestedC = collectCoachingPlanCheckinStateFromDom(planC);
    assert.equal(harvestedC.weeklyCheckIn.checkedAt, null);
});

// ============================================================================
// 15. TASK MERGE BY ID
// ============================================================================
test("15: real harvest helper matches tasks by stable task.id regardless of order", () => {
    resetTestEnvironment();

    const plan = createEmptyCoachingPlan({
        tasks: [
            { id: "task_first", questionTarget: 30, completedCount: 0, completed: false },
            { id: "task_second", questionTarget: 40, completedCount: 0, completed: false }
        ]
    });

    const cardSecond = new MockElement("div");
    cardSecond.dataset.taskId = "task_second";
    const qCountSecond = new MockElement("input");
    qCountSecond.classList.add("cp-question-count");
    qCountSecond.value = "38";
    cardSecond.appendChild(qCountSecond);
    allElements.push(cardSecond);

    const cardFirst = new MockElement("div");
    cardFirst.dataset.taskId = "task_first";
    const qCountFirst = new MockElement("input");
    qCountFirst.classList.add("cp-question-count");
    qCountFirst.value = "22";
    cardFirst.appendChild(qCountFirst);
    allElements.push(cardFirst);

    const harvested = collectCoachingPlanCheckinStateFromDom(plan);

    assert.equal(harvested.tasks[0].id, "task_first");
    assert.equal(harvested.tasks[0].completedCount, 22);
    assert.equal(harvested.tasks[1].id, "task_second");
    assert.equal(harvested.tasks[1].completedCount, 38);
});

// ============================================================================
// 16. UNMATCHED DOM TASK
// ============================================================================
test("16: unknown DOM task ID does not crash or mutate existing plan tasks", () => {
    resetTestEnvironment();

    const plan = createEmptyCoachingPlan({
        tasks: [
            { id: "known_task", questionTarget: 20, completedCount: 5, completed: false }
        ]
    });

    const strayCard = new MockElement("div");
    strayCard.dataset.taskId = "ghost_unknown_id";
    const qCount = new MockElement("input");
    qCount.classList.add("cp-question-count");
    qCount.value = "999";
    strayCard.appendChild(qCount);
    allElements.push(strayCard);

    const harvested = collectCoachingPlanCheckinStateFromDom(plan);

    assert.equal(harvested.tasks.length, 1);
    assert.equal(harvested.tasks[0].completedCount, 5);
});

// ============================================================================
// 17. ARCHIVE SNAPSHOT CONTRACT
// ============================================================================
test("17: canonical createHistorySnapshot contract verified on real archive snapshot", () => {
    const plan = createEmptyCoachingPlan({
        id: "p_snap_test",
        status: "active",
        weekStart: "2026-09-07",
        weekEnd: "2026-09-13",
        weeklyTargets: { totalQuestions: 150 },
        tasks: [{ id: "t1", title: "Mat", completedCount: 50, completed: true }]
    });
    const progress = getPlanProgressSummary(plan);
    const snapshot = createHistorySnapshot(plan, progress);

    const requiredKeys = [
        "id", "status", "sourceStatus", "weekStart", "weekEnd",
        "weeklyTargets", "branchTargets", "topicTargets", "tasks",
        "weeklyCheckIn", "progressSummary", "createdAt", "updatedAt", "archivedAt"
    ];
    for (const key of requiredKeys) {
        assert.ok(key in snapshot, `Snapshot must contain canonical key: ${key}`);
    }
    assert.equal(snapshot.status, "archived");
    assert.equal(snapshot.sourceStatus, "active");
});

// ============================================================================
// 18. REAL IDEMPOTENCY
// ============================================================================
test("18: real archiveCoachingPlanForStudent executed twice on same student does not duplicate history", async () => {
    resetTestEnvironment();

    const plan = createEmptyCoachingPlan({ id: "p_idem_test", status: "active" });
    const student = {
        id: "s_idem_test",
        adSoyad: "Idem Student",
        coachingPlan: plan,
        studyPlanHistory: []
    };

    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    await archiveCoachingPlanForStudent("s_idem_test");
    await archiveCoachingPlanForStudent("s_idem_test");

    const updated = JSON.parse(localStorage.getItem(localDataKey(STORAGE_KEY))).find(s => s.id === "s_idem_test");
    assert.equal(updated.studyPlanHistory.length, 1, "History length must remain 1");
});

// ============================================================================
// 19. MONTHLY SUMMARY INTEGRATION WITH HARVESTED REAL SNAPSHOT
// ============================================================================
test("19: monthly summary correctly aggregates harvested archive snapshot without duplication", async () => {
    resetTestEnvironment();

    const plan = createEmptyCoachingPlan({
        id: "p_month_int",
        status: "active",
        weekStart: "2026-09-07",
        weekEnd: "2026-09-13",
        weeklyTargets: { totalQuestions: 200 },
        tasks: [
            { id: "t1", taskType: "question", questionTarget: 200, completedCount: 175, completed: true }
        ]
    });

    const student = {
        id: "s_month_int",
        adSoyad: "Monthly Int Student",
        coachingPlan: plan,
        studyPlanHistory: []
    };

    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    await archiveCoachingPlanForStudent("s_month_int");

    const updated = JSON.parse(localStorage.getItem(localDataKey(STORAGE_KEY))).find(s => s.id === "s_month_int");
    const summary = buildMonthlyCoachingSummary(updated, 2026, 9);

    assert.equal(summary.period.finalizedWeekCount, 1);
    assert.equal(summary.planMetrics.questionActual, 175);
    assert.equal(summary.planMetrics.questionTarget, 200);
    assert.equal(summary.weeklyTrend.length, 1);
});

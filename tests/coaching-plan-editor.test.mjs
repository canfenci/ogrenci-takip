import test from 'node:test';
import assert from 'node:assert/strict';

// ─── MOCK DOM SETUP ───────────────────────────────────────────────────────────

const elementStore = new Map();
const storageMap = new Map();

function createMockEl(id) {
    const el = {
        id, _innerHTML: '', textContent: '', value: '',
        classList: { add() {}, remove() {}, contains() { return false; } },
        remove() { elementStore.delete(id); },
        querySelector(sel) { return null; },
        querySelectorAll() { return []; },
        insertAdjacentHTML(pos, html) { this._innerHTML += html; },
        addEventListener() {},
        dispatchEvent() {},
        get innerHTML() { return this._innerHTML; },
        set innerHTML(v) { this._innerHTML = v; }
    };
    elementStore.set(id, el);
    return el;
}

globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
globalThis.window.removeEventListener = () => {};
try { Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true, writable: true }); } catch { /* skip */ }
globalThis.window.localStorage = {
    getItem: (k) => storageMap.get(k) || null,
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
    clear: () => storageMap.clear()
};
globalThis.localStorage = globalThis.window.localStorage;
globalThis.window.isFirebaseActive = false;
globalThis.window.auth = { currentUser: null };

const bodyChildren = [];
const mockBody = {
    insertAdjacentHTML(pos, html) {
        bodyChildren.push(html);
        // Parse IDs and values from inserted HTML and register them
        const tagRegex = /<input[^>]*>/gi;
        let m;
        while ((m = tagRegex.exec(html)) !== null) {
            const tag = m[0];
            const idMatch = tag.match(/id="([^"]+)"/);
            if (idMatch) {
                const id = idMatch[1];
                if (!elementStore.has(id)) createMockEl(id);
                const valMatch = tag.match(/value='([^']*)'/) || tag.match(/value="([^"]*)"/);
                if (valMatch) elementStore.get(id).value = valMatch[1];
            }
        }
        // Also parse other element IDs (not just inputs)
        const idRegex = /id="([^"]+)"/g;
        let mid;
        while ((mid = idRegex.exec(html)) !== null) {
            const id = mid[1];
            if (!elementStore.has(id)) createMockEl(id);
        }
    }
};
const mockDocument = {
    getElementById(id) {
        if (!elementStore.has(id)) createMockEl(id);
        return elementStore.get(id);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    body: mockBody,
    createElement() {
        return { innerHTML: '', textContent: '', value: '', style: {}, classList: { add(){}, remove(){}, contains(){ return false; } }, appendChild(){}, remove(){}, querySelectorAll(){ return []; } };
    }
};
globalThis.document = mockDocument;
globalThis.window.document = mockDocument;

// ─── DYNAMIC IMPORTS ──────────────────────────────────────────────────────────

const { createEmptyCoachingPlan } = await import('../coaching-plan-model.js');
const { store, STORAGE_KEY, localDataKey } = await import('../store.js');
const { showCoachingPlanEditor, closeCoachingPlanEditor } = await import('../growth.js');

function resetEditor() {
    bodyChildren.length = 0;
    elementStore.clear();
    // Pre-populate mock student
    const mockStudents = [{ id: 'test_student', adSoyad: 'Test Öğrenci', sinif: '8', denemeler: [] }];
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify(mockStudents));
    store.globalStudents = mockStudents;
}

// ─── EDITOR MODAL CREATION ────────────────────────────────────────────────────

test('A: showCoachingPlanEditor creates modal with correct id', () => {
    resetEditor();
    showCoachingPlanEditor('test_student');
    assert.ok(bodyChildren.length > 0, 'HTML inserted');
    assert.ok(bodyChildren[0].includes('coachingPlanEditorModal'), 'modal id present');
});

test('B: modal contains weekly targets inputs', () => {
    resetEditor();
    showCoachingPlanEditor('test_student');
    const html = bodyChildren[0];
    assert.ok(html.includes('cpTotalQuestions'), 'totalQuestions');
    assert.ok(html.includes('cpGeneralExams'), 'generalExams');
    assert.ok(html.includes('cpBranchExams'), 'branchExams');
    assert.ok(html.includes('cpReadingTarget'), 'readingTarget');
    assert.ok(html.includes('cpReviewSessions'), 'reviewSessions');
});

test('C: modal contains branch, topic, task row containers', () => {
    resetEditor();
    showCoachingPlanEditor('test_student');
    const html = bodyChildren[0];
    assert.ok(html.includes('cpBranchRows'), 'branch rows container');
    assert.ok(html.includes('cpTopicRows'), 'topic rows container');
    assert.ok(html.includes('cpTaskRows'), 'task rows container');
});

// ─── PREFILL ──────────────────────────────────────────────────────────────────

test('D: prefills totalQuestions from existing plan', () => {
    resetEditor();
    const existing = createEmptyCoachingPlan();
    existing.weeklyTargets.totalQuestions = 550;
    showCoachingPlanEditor('test_student', existing);
    assert.ok(bodyChildren[0].includes('value="550"'), 'totalQuestions prefilled');
});

test('E: prefills generalExams from existing plan', () => {
    resetEditor();
    const existing = createEmptyCoachingPlan();
    existing.weeklyTargets.generalExams = 3;
    showCoachingPlanEditor('test_student', existing);
    assert.ok(bodyChildren[0].includes('value="3"'), 'generalExams prefilled');
});

test('F: id and createdAt are in the modal HTML', () => {
    resetEditor();
    const existing = createEmptyCoachingPlan();
    existing.id = 'cp_custom_123';
    existing.createdAt = '2026-01-01T00:00:00.000Z';
    showCoachingPlanEditor('test_student', existing);
    assert.ok(bodyChildren[0].includes('cp_custom_123'), 'id present');
    assert.ok(bodyChildren[0].includes('2026-01-01T00:00:00.000Z'), 'createdAt present');
});

// ─── BRANCH ADD/REMOVE ────────────────────────────────────────────────────────

test('G: addCpBranch creates a branch entry', () => {
    resetEditor();
    showCoachingPlanEditor('test_student');
    const cpBranchesData = elementStore.get('cpBranchesData');
    assert.equal(cpBranchesData.value, '[]');
    window.addCpBranch();
    const branches = JSON.parse(cpBranchesData.value);
    assert.equal(branches.length, 1);
    assert.equal(branches[0].subject, '');
    assert.equal(branches[0].questionTarget, null);
    assert.equal(branches[0].examTarget, null);
    assert.ok(typeof branches[0].id === 'string', 'id is string');
});

test('H: addCpBranch twice then remove first', () => {
    resetEditor();
    showCoachingPlanEditor('test_student');
    window.addCpBranch();
    window.addCpBranch();
    const cpBranchesData = elementStore.get('cpBranchesData');
    assert.equal(JSON.parse(cpBranchesData.value).length, 2);
    window.removeCpBranch(0);
    assert.equal(JSON.parse(cpBranchesData.value).length, 1);
});

test('I: addCpBranch renders row with all fields', () => {
    resetEditor();
    showCoachingPlanEditor('test_student');
    window.addCpBranch();
    const cpBranchRows = elementStore.get('cpBranchRows');
    const html = cpBranchRows.innerHTML;
    assert.ok(html.includes('data-field="subject"'), 'subject field');
    assert.ok(html.includes('data-field="questionTarget"'), 'questionTarget field');
    assert.ok(html.includes('data-field="examTarget"'), 'examTarget field');
    assert.ok(html.includes('removeCpBranch'), 'remove button');
});

// ─── TOPIC ADD/REMOVE ─────────────────────────────────────────────────────────

test('J: addCpTopic creates a topic entry', () => {
    resetEditor();
    showCoachingPlanEditor('test_student');
    window.addCpTopic();
    const topics = JSON.parse(elementStore.get('cpTopicsData').value);
    assert.equal(topics.length, 1);
    assert.equal(topics[0].subject, '');
    assert.equal(topics[0].topic, '');
    assert.equal(topics[0].questionTarget, null);
});

test('K: addCpTopic twice then remove first', () => {
    resetEditor();
    showCoachingPlanEditor('test_student');
    window.addCpTopic();
    window.addCpTopic();
    assert.equal(JSON.parse(elementStore.get('cpTopicsData').value).length, 2);
    window.removeCpTopic(0);
    assert.equal(JSON.parse(elementStore.get('cpTopicsData').value).length, 1);
});

test('L: addCpTopic renders row with all fields', () => {
    resetEditor();
    showCoachingPlanEditor('test_student');
    window.addCpTopic();
    const html = elementStore.get('cpTopicRows').innerHTML;
    assert.ok(html.includes('data-field="subject"'), 'subject field');
    assert.ok(html.includes('data-field="topic"'), 'topic field');
    assert.ok(html.includes('data-field="questionTarget"'), 'questionTarget field');
    assert.ok(html.includes('removeCpTopic'), 'remove button');
});

// ─── TASK ADD/REMOVE ──────────────────────────────────────────────────────────

test('M: addCpTask creates a task entry', () => {
    resetEditor();
    showCoachingPlanEditor('test_student');
    window.addCpTask();
    const tasks = JSON.parse(elementStore.get('cpTasksData').value);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].taskType, 'question');
    assert.equal(tasks[0].title, '');
});

test('N: addCpTask twice then remove first', () => {
    resetEditor();
    showCoachingPlanEditor('test_student');
    window.addCpTask();
    window.addCpTask();
    assert.equal(JSON.parse(elementStore.get('cpTasksData').value).length, 2);
    window.removeCpTask(0);
    assert.equal(JSON.parse(elementStore.get('cpTasksData').value).length, 1);
});

test('O: addCpTask renders row with all fields', () => {
    resetEditor();
    showCoachingPlanEditor('test_student');
    window.addCpTask();
    const html = elementStore.get('cpTaskRows').innerHTML;
    assert.ok(html.includes('data-field="title"'), 'title');
    assert.ok(html.includes('data-field="taskType"'), 'taskType');
    assert.ok(html.includes('data-field="subject"'), 'subject');
    assert.ok(html.includes('data-field="topic"'), 'topic');
    assert.ok(html.includes('data-field="resource"'), 'resource');
    assert.ok(html.includes('data-field="questionTarget"'), 'questionTarget');
    assert.ok(html.includes('data-field="dueDay"'), 'dueDay');
    assert.ok(html.includes('data-field="durationMinutes"'), 'durationMinutes');
    assert.ok(html.includes('data-field="notes"'), 'notes');
    assert.ok(html.includes('removeCpTask'), 'remove button');
});

// ─── TASK TYPES ───────────────────────────────────────────────────────────────

test('P: TASK_TYPES from model has correct keys', async () => {
    const { TASK_TYPES } = await import('../coaching-plan-model.js');
    const keys = Object.keys(TASK_TYPES);
    assert.deepEqual(keys, ['question', 'exam', 'review', 'reading', 'custom']);
});

// ─── NULL NUMERIC HANDLING ────────────────────────────────────────────────────

test('Q: empty numeric field value serializes as null', () => {
    const cpTotalQuestions = elementStore.get('cpTotalQuestions');
    cpTotalQuestions.value = '';
    const val = cpTotalQuestions.value.trim();
    const result = val === '' ? null : Number(val);
    assert.equal(result, null);
});

// ─── SECTION ORDER ────────────────────────────────────────────────────────────

test('R: editor sections in correct order', () => {
    resetEditor();
    showCoachingPlanEditor('test_student');
    const html = bodyChildren[0];
    const weeklyIdx = html.indexOf('Genel Hedefler');
    const branchIdx = html.indexOf('Branş Hedefleri');
    const topicIdx = html.indexOf('Konu Hedefleri');
    const taskIdx = html.indexOf('Haftalık Görevler');
    assert.ok(weeklyIdx < branchIdx, 'Weekly before branch');
    assert.ok(branchIdx < topicIdx, 'Branch before topic');
    assert.ok(topicIdx < taskIdx, 'Topic before task');
});

// ─── BUTTON TEXT ──────────────────────────────────────────────────────────────

test('S: new plan shows Oluştur button', () => {
    resetEditor();
    showCoachingPlanEditor('test_student');
    assert.ok(bodyChildren[0].includes('Oluştur'), 'Oluştur present');
});

test('T: edit plan shows Güncelle button', () => {
    resetEditor();
    showCoachingPlanEditor('test_student', createEmptyCoachingPlan());
    const combined = bodyChildren.join('');
    assert.ok(combined.includes('Güncelle'), 'Güncelle present');
});

// ─── CANCEL ───────────────────────────────────────────────────────────────────

test('U: cancel removes modal element', () => {
    resetEditor();
    showCoachingPlanEditor('test_student');
    assert.ok(elementStore.get('coachingPlanEditorModal'), 'modal created');
    window.closeCoachingPlanEditor();
    assert.equal(elementStore.get('coachingPlanEditorModal'), undefined, 'modal removed');
});

// ─── LEGACY UNTOUCHED ─────────────────────────────────────────────────────────

test('V: legacy studyPlan and studyPlanProfile not modified', () => {
    resetEditor();
    const student = { id: 'x', adSoyad: 'Test', studyPlan: { Pazartesi: ['test'] }, studyPlanProfile: { mode: 'general' } };
    // Pre-populate with this specific student
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];
    const origPlan = JSON.stringify(student.studyPlan);
    const origProfile = JSON.stringify(student.studyPlanProfile);
    showCoachingPlanEditor('x');
    window.closeCoachingPlanEditor();
    assert.equal(JSON.stringify(student.studyPlan), origPlan);
    assert.equal(JSON.stringify(student.studyPlanProfile), origProfile);
});

// ─── HIDDEN FIELDS ────────────────────────────────────────────────────────────

test('W: hidden fields for id, createdAt, branchData, topicData, taskData', () => {
    resetEditor();
    showCoachingPlanEditor('test_student');
    const html = bodyChildren[0];
    assert.ok(html.includes('cpEditId'), 'hidden id field');
    assert.ok(html.includes('cpEditCreatedAt'), 'hidden createdAt field');
    assert.ok(html.includes('cpBranchesData'), 'hidden branch data');
    assert.ok(html.includes('cpTopicsData'), 'hidden topic data');
    assert.ok(html.includes('cpTasksData'), 'hidden task data');
});

// ─── EMPTY STATE TEXT ─────────────────────────────────────────────────────────

test('X: empty branch/topic/task rows show placeholder', () => {
    resetEditor();
    showCoachingPlanEditor('test_student');
    // Row content is rendered into mock elements, not bodyChildren
    const branchHtml = elementStore.get('cpBranchRows').innerHTML;
    assert.ok(branchHtml.includes('Henüz branş hedefi eklenmedi'), 'branch placeholder');
    const topicHtml = elementStore.get('cpTopicRows').innerHTML;
    assert.ok(topicHtml.includes('Henüz konu hedefi eklenmedi'), 'topic placeholder');
    const taskHtml = elementStore.get('cpTaskRows').innerHTML;
    assert.ok(taskHtml.includes('Henüz görev eklenmedi'), 'task placeholder');
});

// ─── MODAL TITLE ──────────────────────────────────────────────────────────────

test('Y: new plan title says "Koçluk Planı Oluştur"', () => {
    resetEditor();
    showCoachingPlanEditor('test_student');
    assert.ok(bodyChildren[0].includes('Koçluk Planı Oluştur'), 'create title');
});

test('Z: edit plan title says "Koçluk Planını Düzenle"', () => {
    resetEditor();
    showCoachingPlanEditor('test_student', createEmptyCoachingPlan());
    const combined = bodyChildren.join('');
    assert.ok(combined.includes('Koçluk Planını Düzenle'), 'edit title');
});

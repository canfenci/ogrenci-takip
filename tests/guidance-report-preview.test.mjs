import test from "node:test";
import assert from "node:assert/strict";
import fsSync from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const guidanceJs = fsSync.readFileSync(path.join(ROOT, "guidance.js"), "utf8");

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

// Mock jsPDF on window for generateGuidancePdf in Node test runner
class MockJsPDF {
    static constructorCount = 0;
    static saveCallCount = 0;
    static lastSavedFilename = null;
    static shouldThrowOnConstruct = false;
    static shouldThrowOnOutputBlob = false;

    static reset() {
        MockJsPDF.constructorCount = 0;
        MockJsPDF.saveCallCount = 0;
        MockJsPDF.lastSavedFilename = null;
        MockJsPDF.shouldThrowOnConstruct = false;
        MockJsPDF.shouldThrowOnOutputBlob = false;
    }

    constructor(options) {
        if (MockJsPDF.shouldThrowOnConstruct) {
            throw new Error("MOCK_JSPDF_CONSTRUCTOR_FAILURE");
        }
        MockJsPDF.constructorCount++;
        this.options = options;
        this.pages = [1];
        this.renderedTexts = [];
    }
    addFileToVFS() {}
    addFont() {}
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setFillColor() {}
    setDrawColor() {}
    rect() {}
    roundedRect() {}
    line() {}
    text(txt) {
        if (Array.isArray(txt)) {
            this.renderedTexts.push(...txt);
        } else {
            this.renderedTexts.push(txt);
        }
    }
    splitTextToSize(txt) {
        return [txt];
    }
    addPage() {
        this.pages.push(this.pages.length + 1);
    }
    getNumberOfPages() {
        return this.pages.length;
    }
    setPage() {}
    output(type) {
        if (type === 'blob') {
            if (MockJsPDF.shouldThrowOnOutputBlob) {
                throw new Error("MOCK_JSPDF_OUTPUT_BLOB_FAILURE");
            }
            return { type: 'application/pdf', size: 1024 };
        }
        if (type === 'bloburl') {
            return 'blob:mock-blob-url';
        }
        return '';
    }
    save(fn) {
        MockJsPDF.saveCallCount++;
        MockJsPDF.lastSavedFilename = fn;
    }
}

globalThis.window.jspdf = { jsPDF: MockJsPDF };

const storageMap = new Map();
const mockStorage = {
    getItem: (k) => storageMap.get(k) || null,
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
    clear: () => storageMap.clear()
};
globalThis.localStorage = mockStorage;
globalThis.window.localStorage = mockStorage;

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
        this._innerHTML = "";
        this.textContent = "";
        this.style = {};
        this.classList = {
            classes: new Set(),
            add: (...cls) => cls.forEach(c => this.classList.classes.add(c)),
            remove: (...cls) => cls.forEach(c => this.classList.classes.delete(c)),
            contains: (c) => this.classList.classes.has(c)
        };
        this.parentElement = null;
    }

    get value() { return this._value; }
    set value(v) { this._value = String(v ?? ''); }

    get checked() { return this._checked; }
    set checked(v) { this._checked = Boolean(v); }

    get innerHTML() { return this._innerHTML; }
    set innerHTML(html) {
        this._innerHTML = html;
        this.parseHtmlChildren(html);
    }

    setAttribute(name, val) {
        this.attributes.set(name, String(val));
        if (name === "id") this.id = String(val);
        if (name === "value") this._value = String(val);
    }

    getAttribute(name) {
        return this.attributes.get(name) || null;
    }

    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        if (child.id) domStore.set(child.id, child);
        if (!allElements.includes(child)) allElements.push(child);
        return child;
    }

    removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) {
            this.children.splice(idx, 1);
            child.parentElement = null;
        }
        return child;
    }

    remove() {
        if (this.id && domStore.has(this.id)) domStore.delete(this.id);
        const elIdx = allElements.indexOf(this);
        if (elIdx !== -1) allElements.splice(elIdx, 1);
        if (this.parentElement) {
            this.parentElement.removeChild(this);
        }
    }

    closest(selector) {
        let cur = this;
        while (cur) {
            if (selector.startsWith('.') && cur.classList.contains(selector.slice(1))) return cur;
            if (selector.startsWith('#') && cur.id === selector.slice(1)) return cur;
            cur = cur.parentElement;
        }
        return null;
    }

    querySelector(selector) {
        const results = this.querySelectorAll(selector);
        return results.length ? results[0] : null;
    }

    querySelectorAll(selector) {
        const matches = [];
        const isClass = selector.startsWith('.');
        const isId = selector.startsWith('#');
        const target = isClass || isId ? selector.slice(1) : selector.toUpperCase();

        function traverse(node) {
            for (const child of node.children) {
                if (isClass && child.classList.contains(target)) matches.push(child);
                else if (isId && child.id === target) matches.push(child);
                else if (!isClass && !isId && child.tagName === target) matches.push(child);
                traverse(child);
            }
        }
        traverse(this);
        return matches;
    }

    parseHtmlChildren(html) {
        this.children = [];
        const idRegex = /<([a-zA-Z0-9]+)\b([^>]*\bid=["']([^"']+)["'][^>]*)>/g;
        let match;
        while ((match = idRegex.exec(html)) !== null) {
            const tag = match[1];
            const attrs = match[2];
            const id = match[3];
            const child = new MockElement(tag, id);
            child.parentElement = this;

            if (attrs.includes('checked')) {
                child.checked = true;
            }
            const valueMatch = attrs.match(/\bvalue=["']([^"']*)["']/);
            if (valueMatch) {
                child.value = valueMatch[1];
            }
            const srcMatch = attrs.match(/\bsrc=["']([^"']*)["']/);
            if (srcMatch) {
                child.setAttribute('src', srcMatch[1]);
            }
            this.children.push(child);
            domStore.set(id, child);
            if (!allElements.includes(child)) allElements.push(child);
        }
    }
}

const domStore = new Map();
const allElements = [];

const mockBody = new MockElement("body", "body");
allElements.push(mockBody);

const eventListeners = new Map();

globalThis.document = {
    body: mockBody,
    getElementById: (id) => {
        if (domStore.has(id)) return domStore.get(id);
        function find(node) {
            if (node.id === id) return node;
            for (const child of node.children) {
                const found = find(child);
                if (found) return found;
            }
            return null;
        }
        return find(mockBody);
    },
    createElement: (tag) => {
        const el = new MockElement(tag);
        allElements.push(el);
        return el;
    },
    querySelectorAll: (sel) => mockBody.querySelectorAll(sel),
    querySelector: (sel) => mockBody.querySelector(sel),
    addEventListener: (evt, cb) => {
        if (!eventListeners.has(evt)) eventListeners.set(evt, []);
        eventListeners.get(evt).push(cb);
    },
    removeEventListener: (evt, cb) => {
        if (!eventListeners.has(evt)) return;
        const list = eventListeners.get(evt);
        const idx = list.indexOf(cb);
        if (idx !== -1) list.splice(idx, 1);
    }
};

// URL.createObjectURL and URL.revokeObjectURL tracking
const allocatedUrls = [];
const revokedUrls = [];
let createObjectUrlShouldThrow = false;

globalThis.URL = globalThis.URL || {};
globalThis.URL.createObjectURL = (blob) => {
    if (createObjectUrlShouldThrow) {
        throw new Error("MOCK_URL_CREATE_OBJECT_URL_FAILURE");
    }
    const url = `blob:preview-report-${allocatedUrls.length + 1}`;
    allocatedUrls.push(url);
    return url;
};
globalThis.URL.revokeObjectURL = (url) => {
    revokedUrls.push(url);
};

// Mock File constructor
globalThis.File = class MockFile {
    constructor(parts, filename, options = {}) {
        this.parts = parts;
        this.name = filename;
        this.type = options.type || '';
    }
};

// Import store keys & guidance module dynamically
const { store, STORAGE_KEY, localDataKey } = await import("../store.js");
const guidanceModule = await import("../guidance.js");

// Sample student
const testStudent = {
    id: "student_preview_1",
    adSoyad: "Deniz Kaya",
    sinif: "8",
    okul: "Atatürk Ortaokulu",
    hedefNet: 18,
    hedefLise: "Fen Lisesi",
    denemeler: [
        { id: "e1", tip: "genel", denemeAdi: "1. Deneme", toplamNet: 15.0, tarih: "2026-08-20" }
    ],
    odevler: [
        { id: "h1", konu: "DNA ve Genetik Kod", durum: "tamamlandi", baslamaTarihi: "2026-08-18" }
    ],
    guidanceRecords: [
        { id: "g1", type: "academic", issue: "Soru hedefi", status: "open", followUpDate: "2026-09-10", createdAt: "2026-08-20" }
    ]
};

// Seed store
store.globalStudents = [testStudent];
mockStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([testStudent]));

function resetDom() {
    guidanceModule.closeGuidanceReportPreviewModal(false);
    mockBody.children = [];
    mockBody.innerHTML = "";
    domStore.clear();
    allElements.length = 0;
    allElements.push(mockBody);
    eventListeners.clear();
    MockJsPDF.reset();
    createObjectUrlShouldThrow = false;
}

// ============================================================================
// TESTS
// ============================================================================

test("UX-GUIDANCE-02E Test 1: getGuidanceReportOptionsFromModal accurately harvests form inputs", () => {
    resetDom();
    guidanceModule.openGuidanceReportModal("student_preview_1");

    const modal = document.getElementById("guidanceReportModal");
    assert.ok(modal, "Modal should exist");

    // Change period
    const periodSelect = document.getElementById("reportPeriodSelect");
    assert.ok(periodSelect, "reportPeriodSelect should exist");
    periodSelect.value = "8weeks";

    // Change note
    const noteEl = document.getElementById("reportTeacherNote");
    assert.ok(noteEl, "reportTeacherNote should exist");
    noteEl.value = "VELİ_PREVIEW_TEST_NOTE";

    // Toggle off a couple of sections
    const secExam = document.getElementById("sec_examTrend");
    assert.ok(secExam, "sec_examTrend should exist");
    secExam.checked = false;
    const secWeak = document.getElementById("sec_weakTopics");
    assert.ok(secWeak, "sec_weakTopics should exist");
    secWeak.checked = false;

    const options = guidanceModule.getGuidanceReportOptionsFromModal();
    assert.equal(options.period, "8weeks");
    assert.equal(options.teacherNote, "VELİ_PREVIEW_TEST_NOTE");
    assert.equal(options.sections.examTrend, false);
    assert.equal(options.sections.weakTopics, false);
    assert.equal(options.sections.academicSummary, true);
});

test("UX-GUIDANCE-02E Test 2: previewGuidanceReportPdf generates preview without calling doc.save() (MockJsPDF.saveCallCount === 0)", async () => {
    resetDom();
    guidanceModule.openGuidanceReportModal("student_preview_1");

    MockJsPDF.reset();
    await guidanceModule.previewGuidanceReportPdf("student_preview_1");

    const preview = guidanceModule.getActiveGuidanceReportPreview();
    assert.ok(preview, "Preview state should be active in memory");
    assert.equal(preview.studentId, "student_preview_1");
    assert.ok(preview.blobUrl, "Preview state must have blobUrl");
    assert.ok(preview.filename.includes("deniz-kaya"), "Filename should be normalized with student name");

    // Strictly proven via MockJsPDF instrumentation
    assert.equal(MockJsPDF.saveCallCount, 0, "MockJsPDF.save must NOT be called during preview creation");
});

test("UX-GUIDANCE-02E Test 3: Preview creates exactly ONE jsPDF instance and preview actions reuse it without re-instantiation", async () => {
    resetDom();
    guidanceModule.openGuidanceReportModal("student_preview_1");

    MockJsPDF.reset();
    assert.equal(MockJsPDF.constructorCount, 0);

    // Call preview
    await guidanceModule.previewGuidanceReportPdf("student_preview_1");
    assert.equal(MockJsPDF.constructorCount, 1, "Creating preview must instantiate exactly ONE jsPDF instance");

    // Trigger preview actions
    guidanceModule.downloadActiveGuidanceReportPreview();
    assert.equal(MockJsPDF.constructorCount, 1, "downloadActiveGuidanceReportPreview must NOT instantiate a second jsPDF");

    let openedUrl = null;
    globalThis.window.open = (u) => { openedUrl = u; };
    guidanceModule.printActiveGuidanceReportPreview();
    assert.equal(MockJsPDF.constructorCount, 1, "printActiveGuidanceReportPreview must NOT instantiate a second jsPDF");

    guidanceModule.openPreviewInNewTab();
    assert.equal(MockJsPDF.constructorCount, 1, "openPreviewInNewTab must NOT instantiate a second jsPDF");

    globalThis.navigator.canShare = () => false;
    globalThis.navigator.share = null;
    await guidanceModule.shareActiveGuidanceReportPreview();
    assert.equal(MockJsPDF.constructorCount, 1, "shareActiveGuidanceReportPreview must NOT instantiate a second jsPDF");
});

test("UX-GUIDANCE-02E Test 4: Preview DOM contains iframe and all toolbar actions", async () => {
    resetDom();
    guidanceModule.openGuidanceReportModal("student_preview_1");
    await guidanceModule.previewGuidanceReportPdf("student_preview_1");

    const previewModal = document.getElementById("guidanceReportPreviewModal");
    assert.ok(previewModal, "Preview modal #guidanceReportPreviewModal must exist in DOM");

    const rawHtml = previewModal.innerHTML;

    // Check iframe
    assert.match(rawHtml, /<iframe\b[^>]*id=["']guidanceReportPreviewIframe["']/);
    assert.match(rawHtml, /title=["']Veli Raporu Önizleme["']/);

    // Check actions
    assert.match(rawHtml, /Düzenle/);
    assert.match(rawHtml, /Yeni Sekmede Aç/);
    assert.match(rawHtml, /Yazdır/);
    assert.match(rawHtml, /PDF İndir/);
    assert.match(rawHtml, /Kapat/);

    // Student name
    assert.match(rawHtml, /Deniz Kaya/);
});

test("UX-GUIDANCE-02E Test 5: iframe.src uses the returned blob URL", async () => {
    resetDom();
    guidanceModule.openGuidanceReportModal("student_preview_1");
    await guidanceModule.previewGuidanceReportPdf("student_preview_1");

    const iframe = document.getElementById("guidanceReportPreviewIframe");
    assert.ok(iframe, "Iframe element must be present");
    const preview = guidanceModule.getActiveGuidanceReportPreview();
    assert.equal(iframe.getAttribute("src"), preview.blobUrl, "Iframe src must match active preview blob URL");
});

test("UX-GUIDANCE-02E Test 6: URL revocation cleans up previous URL when regenerating, and on close", async () => {
    allocatedUrls.length = 0;
    revokedUrls.length = 0;

    resetDom();
    guidanceModule.openGuidanceReportModal("student_preview_1");

    // Preview 1
    await guidanceModule.previewGuidanceReportPdf("student_preview_1");
    const url1 = guidanceModule.getActiveGuidanceReportPreview().blobUrl;
    assert.ok(allocatedUrls.includes(url1));

    // Preview 2 (regenerate)
    await guidanceModule.previewGuidanceReportPdf("student_preview_1");
    const url2 = guidanceModule.getActiveGuidanceReportPreview().blobUrl;
    assert.notEqual(url1, url2);
    assert.ok(revokedUrls.includes(url1), "First blob URL must be revoked when second preview is generated");

    // Close preview
    guidanceModule.closeGuidanceReportPreviewModal(false);
    assert.ok(revokedUrls.includes(url2), "Second blob URL must be revoked when preview is closed");
    assert.equal(guidanceModule.getActiveGuidanceReportPreview(), null, "Preview state must be null after close");
});

test("UX-GUIDANCE-02E Test 7: Configuration is preserved when clicking Geri / Düzenle", async () => {
    resetDom();
    guidanceModule.openGuidanceReportModal("student_preview_1");

    const periodSelect = document.getElementById("reportPeriodSelect");
    periodSelect.value = "term";
    const noteEl = document.getElementById("reportTeacherNote");
    noteEl.value = "PRESERVED_NOTE_ABC";
    const secInterventions = document.getElementById("sec_guidanceInterventions");
    secInterventions.checked = false;

    // Open preview
    await guidanceModule.previewGuidanceReportPdf("student_preview_1");

    // Config modal was hidden
    const configModal = document.getElementById("guidanceReportModal");
    assert.equal(configModal.style.display, "none", "Config modal should be hidden during preview");

    // Teacher clicks Geri / Düzenle
    guidanceModule.closeGuidanceReportPreviewModal(true);

    // Preview modal removed
    assert.equal(document.getElementById("guidanceReportPreviewModal"), null);
    // Config modal restored
    assert.equal(configModal.style.display, "", "Config modal should be visible again");

    // Values strictly preserved
    assert.equal(document.getElementById("reportPeriodSelect").value, "term");
    assert.equal(document.getElementById("reportTeacherNote").value, "PRESERVED_NOTE_ABC");
    assert.equal(document.getElementById("sec_guidanceInterventions").checked, false);
});

test("UX-GUIDANCE-02E Test 8: Preview PDF İndir reuses same document instance and calls doc.save with preview filename", async () => {
    resetDom();
    guidanceModule.openGuidanceReportModal("student_preview_1");
    await guidanceModule.previewGuidanceReportPdf("student_preview_1");

    const preview = guidanceModule.getActiveGuidanceReportPreview();
    MockJsPDF.saveCallCount = 0;
    MockJsPDF.lastSavedFilename = null;

    guidanceModule.downloadActiveGuidanceReportPreview();

    assert.equal(MockJsPDF.saveCallCount, 1, "Must call doc.save exactly once");
    assert.equal(MockJsPDF.lastSavedFilename, preview.filename, "Must pass active preview filename");
});

test("UX-GUIDANCE-02E Test 9: Preview Yazdır reuses same blob URL in new tab without regenerating", async () => {
    resetDom();
    guidanceModule.openGuidanceReportModal("student_preview_1");
    await guidanceModule.previewGuidanceReportPdf("student_preview_1");

    const preview = guidanceModule.getActiveGuidanceReportPreview();
    let openedUrl = null;
    let openedTarget = null;
    globalThis.window.open = (url, target) => {
        openedUrl = url;
        openedTarget = target;
    };

    guidanceModule.printActiveGuidanceReportPreview();

    assert.equal(openedUrl, preview.blobUrl, "Print must open existing blobUrl");
    assert.equal(openedTarget, "_blank");
});

test("UX-GUIDANCE-02E Test 10: Mobile fallback 'Yeni Sekmede Aç' opens activeBlobUrl without regeneration and without synchronous revoke", async () => {
    resetDom();
    guidanceModule.openGuidanceReportModal("student_preview_1");
    await guidanceModule.previewGuidanceReportPdf("student_preview_1");

    const preview = guidanceModule.getActiveGuidanceReportPreview();
    let openedUrl = null;
    let openedTarget = null;
    globalThis.window.open = (url, target) => {
        openedUrl = url;
        openedTarget = target;
    };

    guidanceModule.openPreviewInNewTab();

    assert.equal(openedUrl, preview.blobUrl, "Yeni Sekmede Aç must open existing preview.blobUrl");
    assert.equal(openedTarget, "_blank");
    // Verify blob URL was NOT synchronously revoked
    assert.equal(revokedUrls.includes(openedUrl), false, "Blob URL must NOT be revoked synchronously after window.open");
});

test("UX-GUIDANCE-02E Test 11: Preview Share reuses same blob without regenerating PDF", async () => {
    resetDom();
    guidanceModule.openGuidanceReportModal("student_preview_1");
    await guidanceModule.previewGuidanceReportPdf("student_preview_1");

    const preview = guidanceModule.getActiveGuidanceReportPreview();
    let sharePayload = null;
    globalThis.navigator.canShare = () => true;
    globalThis.navigator.share = async (payload) => {
        sharePayload = payload;
    };

    await guidanceModule.shareActiveGuidanceReportPreview();

    assert.ok(sharePayload, "Share must dispatch payload");
    assert.ok(sharePayload.files && sharePayload.files.length === 1);
    assert.equal(sharePayload.files[0].name, preview.filename, "Share must use preview.filename");
});

test("UX-GUIDANCE-02E Test 12: Real PDF generation failure (MockJsPDF throws) cleanly restores state without blank modal", async () => {
    resetDom();
    guidanceModule.openGuidanceReportModal("student_preview_1");

    const periodSelect = document.getElementById("reportPeriodSelect");
    periodSelect.value = "term";
    const noteEl = document.getElementById("reportTeacherNote");
    noteEl.value = "ERROR_TEST_NOTE";

    // Simulate real PDF generator failure for a valid student
    MockJsPDF.shouldThrowOnConstruct = true;

    await guidanceModule.previewGuidanceReportPdf("student_preview_1");

    assert.equal(guidanceModule.getActiveGuidanceReportPreview(), null, "Preview state must be null on failure");
    assert.equal(document.getElementById("guidanceReportPreviewModal"), null, "Preview modal must not open on failure");

    // Config modal and options remain preserved
    const configModal = document.getElementById("guidanceReportModal");
    assert.ok(configModal, "Configuration modal must remain intact in DOM");
    assert.equal(document.getElementById("reportPeriodSelect").value, "term");
    assert.equal(document.getElementById("reportTeacherNote").value, "ERROR_TEST_NOTE");

    // Restore MockJsPDF and retry successfully
    MockJsPDF.shouldThrowOnConstruct = false;
    await guidanceModule.previewGuidanceReportPdf("student_preview_1");
    assert.ok(guidanceModule.getActiveGuidanceReportPreview(), "Retry after failure must succeed");
});

test("UX-GUIDANCE-02E Test 13: Partial blob failure (URL.createObjectURL throws) cleans state and does not leave stale URL", async () => {
    resetDom();
    guidanceModule.openGuidanceReportModal("student_preview_1");

    createObjectUrlShouldThrow = true;

    await guidanceModule.previewGuidanceReportPdf("student_preview_1");

    assert.equal(guidanceModule.getActiveGuidanceReportPreview(), null, "Preview state must be null when URL creation fails");
    assert.equal(document.getElementById("guidanceReportPreviewModal"), null, "Preview modal must not open");

    // Storage remains untouched
    const stored = JSON.parse(mockStorage.getItem(localDataKey(STORAGE_KEY)));
    assert.equal(stored.length, 1);
});

test("UX-GUIDANCE-02E Test 14: Direct download backward compatibility executes doc.save without preview", async () => {
    resetDom();
    guidanceModule.openGuidanceReportModal("student_preview_1");

    MockJsPDF.reset();
    await guidanceModule.downloadGuidanceReportPdf("student_preview_1");

    assert.equal(MockJsPDF.saveCallCount, 1, "Direct download must call doc.save exactly once");
    assert.ok(MockJsPDF.lastSavedFilename.includes("deniz-kaya"), "Saved filename must contain normalized student name");
    assert.equal(document.getElementById("guidanceReportPreviewModal"), null, "Preview modal must NOT be opened during direct download");
});

test("UX-GUIDANCE-02E Test 15: Direct print backward compatibility opens bloburl without preview", async () => {
    resetDom();
    guidanceModule.openGuidanceReportModal("student_preview_1");

    let openedUrl = null;
    let openedTarget = null;
    globalThis.window.open = (u, t) => {
        openedUrl = u;
        openedTarget = t;
    };

    await guidanceModule.printGuidanceReportPdf("student_preview_1");

    assert.equal(openedUrl, 'blob:mock-blob-url', "Direct print must open blob url");
    assert.equal(openedTarget, '_blank');
    assert.equal(document.getElementById("guidanceReportPreviewModal"), null, "Preview modal must NOT be opened during direct print");
});

test("UX-GUIDANCE-02E Test 16: Direct share backward compatibility dispatches navigator.share without preview", async () => {
    resetDom();
    guidanceModule.openGuidanceReportModal("student_preview_1");

    let sharedPayload = null;
    globalThis.navigator.canShare = () => true;
    globalThis.navigator.share = async (p) => { sharedPayload = p; };

    await guidanceModule.shareGuidanceReportPdf("student_preview_1");

    assert.ok(sharedPayload, "Direct share must call navigator.share");
    assert.ok(sharedPayload.files && sharedPayload.files.length === 1);
    assert.ok(sharedPayload.files[0].name.includes("deniz-kaya"));
    assert.equal(document.getElementById("guidanceReportPreviewModal"), null, "Preview modal must NOT be opened during direct share");
});

test("UX-GUIDANCE-02E Test 17: Close paths (Kapat, Geri, Backdrop, Escape) cleanly invoke cleanup", async () => {
    resetDom();
    guidanceModule.openGuidanceReportModal("student_preview_1");

    // 1. Geri/Düzenle closes preview and re-shows config modal
    await guidanceModule.previewGuidanceReportPdf("student_preview_1");
    assert.ok(guidanceModule.getActiveGuidanceReportPreview());
    guidanceModule.closeGuidanceReportPreviewModal(true);
    assert.equal(guidanceModule.getActiveGuidanceReportPreview(), null);
    assert.equal(document.getElementById("guidanceReportModal").style.display, "");

    // 2. Kapat closes both preview and config modal
    await guidanceModule.previewGuidanceReportPdf("student_preview_1");
    assert.ok(guidanceModule.getActiveGuidanceReportPreview());
    guidanceModule.closeGuidanceReportPreviewModal(false);
    assert.equal(guidanceModule.getActiveGuidanceReportPreview(), null);
    assert.equal(document.getElementById("guidanceReportModal"), null);

    // 3. Escape key listener is wired to closeGuidanceReportPreviewModal
    guidanceModule.openGuidanceReportModal("student_preview_1");
    await guidanceModule.previewGuidanceReportPdf("student_preview_1");
    assert.ok(guidanceModule.getActiveGuidanceReportPreview());

    const keyListeners = eventListeners.get('keydown') || [];
    assert.ok(keyListeners.length > 0, "Escape keydown listener must be registered");
    // Trigger Escape
    keyListeners[0]({ key: 'Escape' });
    assert.equal(guidanceModule.getActiveGuidanceReportPreview(), null, "Escape key must invoke preview cleanup");
});

test("UX-GUIDANCE-02E Test 18: Double close safety — calling closeGuidanceReportPreviewModal consecutively is safe no-op", () => {
    resetDom();
    revokedUrls.length = 0;

    // Calling close when no preview is open
    assert.doesNotThrow(() => {
        guidanceModule.closeGuidanceReportPreviewModal(false);
        guidanceModule.closeGuidanceReportPreviewModal(false);
    });

    assert.equal(guidanceModule.getActiveGuidanceReportPreview(), null);
    assert.equal(revokedUrls.length, 0, "Should not attempt to revoke when no URL is active");
});

test("UX-GUIDANCE-02E Test 19: Share fallback — when Web Share is unsupported, falls back to direct download of existing preview doc", async () => {
    resetDom();
    guidanceModule.openGuidanceReportModal("student_preview_1");
    await guidanceModule.previewGuidanceReportPdf("student_preview_1");

    const preview = guidanceModule.getActiveGuidanceReportPreview();
    MockJsPDF.saveCallCount = 0;
    MockJsPDF.lastSavedFilename = null;

    // Simulate completely unsupported Web Share
    globalThis.navigator.canShare = null;
    globalThis.navigator.share = null;

    await guidanceModule.shareActiveGuidanceReportPreview();

    // Must have fallen back to download
    assert.equal(MockJsPDF.saveCallCount, 1, "Fallback must invoke preview doc save");
    assert.equal(MockJsPDF.lastSavedFilename, preview.filename, "Fallback must use existing preview filename");
});

test("UX-GUIDANCE-02E Test 20: Zero data writes — preview execution performs 0 storage or document mutations", async () => {
    const studentBefore = JSON.parse(mockStorage.getItem(localDataKey(STORAGE_KEY)));

    resetDom();
    guidanceModule.openGuidanceReportModal("student_preview_1");
    await guidanceModule.previewGuidanceReportPdf("student_preview_1");
    guidanceModule.closeGuidanceReportPreviewModal(false);

    const studentAfter = JSON.parse(mockStorage.getItem(localDataKey(STORAGE_KEY)));
    assert.deepEqual(studentBefore, studentAfter, "Local storage student data must be completely untouched");
});

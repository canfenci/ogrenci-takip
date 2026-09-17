import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const guidanceJs = fs.readFileSync(path.join(ROOT, 'guidance.js'), 'utf8');

// ============================================================================
// MOCK DOM & BROWSER ENVIRONMENT
// ============================================================================
globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
globalThis.window.removeEventListener = () => {};
try {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true, writable: true });
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

// Set mock students
const mockStudent = {
    id: 'std_ux_02f',
    adSoyad: 'Zeynep Kaya',
    sinif: '8',
    okul: 'Deneme Ortaokulu',
    hedefNet: 18,
    hedefLise: 'Fen Lisesi',
    denemeler: [
        { tip: 'genel', denemeAdi: 'Deneme 1', tarih: '2026-09-01', toplamNet: 15.0 },
        { tip: 'genel', denemeAdi: 'Deneme 2', tarih: '2026-09-10', toplamNet: 13.5 }
    ],
    odevler: [
        {
            id: 'hw1',
            durum: 'tamamlandi',
            yanlisKonular: [
                { unite: 'Basınç', konu: 'Katı Basıncı', adet: 4, hataNedenleri: ['bilgi_eksikligi'] }
            ]
        }
    ],
    guidanceRecords: [
        {
            id: 'gr_1',
            studentId: 'std_ux_02f',
            date: '2026-09-05',
            type: 'academic',
            issue: 'Katı Basıncı kavram eksiği',
            action: '20 dk etüt yapıldı',
            note: 'Öğrencinin konu hakimiyeti iyiye gidiyor.',
            status: 'open'
        }
    ]
};

mockStorage.setItem('lgs_soru_bazli_v6', JSON.stringify([mockStudent]));
mockStorage.setItem('students_data', JSON.stringify([mockStudent]));

// Mock document for DOM tests
const mockElements = new Map();

function createMockElement(tag, id = '') {
    const el = {
        tagName: tag.toUpperCase(),
        id,
        innerHTML: '',
        children: [],
        classList: {
            classes: new Set(),
            add: (...c) => c.forEach(x => el.classList.classes.add(x)),
            remove: (...c) => c.forEach(x => el.classList.classes.delete(x)),
            contains: (c) => el.classList.classes.has(c)
        },
        style: {},
        attributes: new Map(),
        setAttribute: (k, v) => el.attributes.set(k, String(v)),
        getAttribute: (k) => el.attributes.get(k) || null,
        dataset: {},
        remove: () => {
            if (el.id) mockElements.delete(el.id);
            if (el.parentElement) {
                el.parentElement.children = el.parentElement.children.filter(c => c !== el);
            }
        },
        closest: () => el,
        querySelector: () => null,
        querySelectorAll: () => []
    };
    if (id) mockElements.set(id, el);
    return el;
}

const dynamicContent = createMockElement('div', 'dynamic-content');
mockElements.set('dynamic-content', dynamicContent);

globalThis.document = {
    getElementById: (id) => mockElements.get(id) || null,
    createElement: (tag) => createMockElement(tag),
    body: {
        appendChild: (el) => {
            mockElements.set(el.id, el);
            return el;
        }
    },
    querySelector: (sel) => null,
    querySelectorAll: (sel) => []
};

// Import guidance module dynamically
const guidanceModule = await import('../guidance.js');

// ============================================================================
// 1. HEADER CLEANUP & ACTION HIERARCHY TESTS
// ============================================================================

test('02F-1: Header action bar contains exactly the 5 useful distinct actions', () => {
    guidanceModule.renderGuidanceStudentDetail('std_ux_02f');
    const html = dynamicContent.innerHTML;

    // Check header actions container exists
    assert.ok(html.includes('data-testid="student-detail-header-actions"'), 'Header action bar rendered');

    // Check 5 canonical actions exist in the header
    assert.ok(html.includes('data-testid="header-guidance-record-btn"'), 'Rehberlik Kaydı exists');
    assert.ok(html.includes('data-testid="header-parent-report-btn"'), 'Veli Raporu exists');
    assert.ok(html.includes('data-testid="header-study-plan-btn"'), 'Çalışma Planı shortcut exists');
    assert.ok(html.includes('data-testid="header-homework-btn"'), 'Ödev shortcut exists');
    assert.ok(html.includes('data-testid="header-cockpit-btn"'), 'Kokpit shortcut exists');
});

test('02F-2: Header does NOT contain redundant generic "+ Not Ekle" button', () => {
    guidanceModule.renderGuidanceStudentDetail('std_ux_02f');
    const html = dynamicContent.innerHTML;

    // Extract the header actions block
    const headerActionsMatch = html.match(/<div[^>]*data-testid="student-detail-header-actions"[\s\S]*?<\/div>\s*<\/div>\s*<\/header>/);
    assert.ok(headerActionsMatch, 'Header actions section found');
    const headerActionsHtml = headerActionsMatch[0];

    // Assert "Not Ekle" is NOT present in the header actions block
    assert.ok(!headerActionsHtml.includes('Not Ekle'), 'Generic Not Ekle removed from header action toolbar');
});

test('02F-3: Contextual "+ Not Ekle" remains preserved inside Öğretmen Görüşü', () => {
    guidanceModule.switchGuidanceStudentTab('std_ux_02f', 'overview');
    const html = dynamicContent.innerHTML;

    // Must be present in the Overview tab under teacher opinion
    assert.ok(html.includes('data-testid="teacher-opinion"'), 'Teacher opinion card rendered');
    assert.ok(html.includes("showGuidanceRecordModal('std_ux_02f', null, 'general')"), 'Contextual Not Ekle preserved');
    assert.ok(html.includes('Not Ekle'), 'Not Ekle label present in teacher opinion');
});

// ============================================================================
// 2. WEEKLY FOCUS & ACTIONABLE INTERVENTION TESTS
// ============================================================================

test('02F-4: Overview retains "Bu Haftanın Odağı" as concise weekly focus', () => {
    guidanceModule.switchGuidanceStudentTab('std_ux_02f', 'overview');
    const html = dynamicContent.innerHTML;

    assert.ok(html.includes('Bu Haftanın Odağı'), 'Bu Haftanın Odağı card present on Overview');
    assert.ok(html.includes('Konu Tekrarı + Temel Soru'), 'Recommendation title rendered');
    assert.ok(html.includes('Katı Basıncı için konu tekrarı'), 'Recommendation action rendered');
    // Overview action buttons remain intact
    assert.ok(html.includes("showStudyPlanSetup('std_ux_02f')"), 'Plan Oluştur button present');
});

test('02F-5: Interventions tab contains actionable "Önerilen Müdahale" with "Önerilen Müdahaleyi Kaydet" CTA', () => {
    guidanceModule.switchGuidanceStudentTab('std_ux_02f', 'interventions');
    const html = dynamicContent.innerHTML;

    assert.ok(html.includes('Önerilen Müdahale'), 'Önerilen Müdahale title present on Interventions');
    assert.ok(html.includes('data-testid="save-recommended-intervention-btn"'), 'Actionable CTA button present');
    assert.ok(html.includes('Önerilen Müdahaleyi Kaydet'), 'Button text matches specification');
    assert.ok(html.includes("showGuidanceRecordModal('std_ux_02f')"), 'Calls showGuidanceRecordModal');
});

test('02F-6: Interventions tab applies responsive ordering: recommendation first on mobile, left column on desktop', () => {
    guidanceModule.switchGuidanceStudentTab('std_ux_02f', 'interventions');
    const html = dynamicContent.innerHTML;

    // Check responsive ordering classes
    assert.ok(html.includes('order-2 lg:order-1'), 'Journal list has order-2 lg:order-1');
    assert.ok(html.includes('order-1 lg:order-2'), 'Recommendation and sidebar has order-1 lg:order-2');
});

// ============================================================================
// 3. ZERO WRITE ON CTA & CANONICAL PREFILL VERIFICATION
// ============================================================================

test('02F-7: Clicking "Önerilen Müdahaleyi Kaydet" opens modal with canonical prefilled data and performs ZERO writes', () => {
    // Snapshot storage before CTA click
    const rawStorageBeforeV6 = mockStorage.getItem('lgs_soru_bazli_v6');
    const rawStorageBeforeLegacy = mockStorage.getItem('students_data');
    const studentBefore = JSON.parse(rawStorageBeforeV6)[0];
    const initialRecordsCount = studentBefore.guidanceRecords.length;

    // Trigger opening the modal through the CTA
    guidanceModule.showGuidanceRecordModal('std_ux_02f');

    // Verify modal is created and attached to DOM
    const modal = document.getElementById('guidanceRecordModal');
    assert.ok(modal, 'Modal opened in DOM');

    // Assert exact canonical prefill values in the production modal markup
    assert.match(modal.innerHTML, /<option value="academic" selected>/, 'Kayıt türü defaults to academic and is selected');
    assert.ok(modal.innerHTML.includes('Katı Basıncı konusunda tekrar eden bilgi eksikliği tespiti'), 'Sorun/Gözlem prefilled with canonical topic + error label');
    assert.ok(modal.innerHTML.includes('Katı Basıncı için konu tekrarı + temel seviye hedefli soru çalışması'), 'Müdahale prefilled with canonical recommended action');
    assert.match(modal.innerHTML, /id="grFormFollowUpDate"\s+value="\d{4}-\d{2}-\d{2}"/, 'Takip tarihi prefilled with YYYY-MM-DD format (7 days later)');
    assert.ok(modal.innerHTML.includes('Öneri Dolduruldu'), 'Prefill indicator displayed on prefilled fields');

    // Strict zero write verification
    const rawStorageAfterV6 = mockStorage.getItem('lgs_soru_bazli_v6');
    const rawStorageAfterLegacy = mockStorage.getItem('students_data');
    const studentAfter = JSON.parse(rawStorageAfterV6)[0];

    assert.equal(rawStorageBeforeV6, rawStorageAfterV6, 'Zero writes: lgs_soru_bazli_v6 storage string completely unchanged');
    assert.equal(rawStorageBeforeLegacy, rawStorageAfterLegacy, 'Zero writes: students_data storage string completely unchanged');
    assert.equal(studentAfter.guidanceRecords.length, initialRecordsCount, 'Zero writes to student records on CTA click');
    assert.deepEqual(studentAfter.guidanceRecords, studentBefore.guidanceRecords, 'Records array is strictly unmodified');
});

// ============================================================================
// 4. MOBILE LAYOUT & TOUCH TARGET CONTRACT TESTS
// ============================================================================

test('02F-8: All header action buttons satisfy minimum 44px touch target contract', () => {
    guidanceModule.renderGuidanceStudentDetail('std_ux_02f');
    const html = dynamicContent.innerHTML;

    const headerMatch = html.match(/<div[^>]*data-testid="student-detail-header-actions"[\s\S]*?<\/div>\s*<\/div>\s*<\/header>/);
    assert.ok(headerMatch);
    const headerHtml = headerMatch[0];

    const buttons = headerHtml.match(/<button[^>]*>[\s\S]*?<\/button>/g) || [];
    assert.equal(buttons.length, 5, 'Exactly 5 buttons in header');
    buttons.forEach((btn, i) => {
        assert.ok(btn.includes('min-h-[44px]'), `Button ${i} has min-h-[44px] touch target`);
    });
});

test('02F-9: Header action bar is organized into exactly 2 rows on mobile (flex-col sm:flex-row with 2 row containers)', () => {
    guidanceModule.renderGuidanceStudentDetail('std_ux_02f');
    const html = dynamicContent.innerHTML;

    assert.ok(html.includes('class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0"'), 'Header uses 2-row mobile / inline desktop flex layout');
    assert.ok(html.includes('<!-- Primary Actions Row -->'), 'Primary row marked');
    assert.ok(html.includes('<!-- Secondary Shortcuts Row -->'), 'Secondary row marked');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const readProjectFile = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
globalThis.window.removeEventListener = () => {};
globalThis.window.isFirebaseActive = false;
globalThis.window.auth = { currentUser: null };
try {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true, writable: true });
} catch {
    globalThis.navigator = { onLine: true };
}

test('UX-IA-02 Scenario A: Main navigation contains exactly one visible first-level Finance / Payments entry', () => {
    const indexHtml = readProjectFile('index.html');
    const groupMatch = indexHtml.match(/<div[^>]*id="sidebar-workspace-group"[^>]*>([\s\S]*?)<\/div>/);
    assert.ok(groupMatch, 'sidebar-workspace-group must exist');

    const financeButtons = [...groupMatch[1].matchAll(/<button[^>]*id="sidebar-nav-finance"[^>]*>([\s\S]*?)<\/button>/g)];
    assert.equal(financeButtons.length, 1, 'There must be exactly one sidebar-nav-finance button in workspace group');

    const btnHtml = financeButtons[0][0];
    assert.match(btnHtml, /data-app-nav="true"/, 'Finance button must have data-app-nav="true"');
    assert.match(btnHtml, /class="[^"]*sidebar-btn[^"]*"/, 'Finance button must use standard sidebar-btn styling');
    assert.match(btnHtml, /fa-wallet/, 'Finance button must have wallet icon');
    assert.match(btnHtml, /<span>Finans \/ Ödemeler<\/span>/, 'Finance button must show "Finans / Ödemeler" label');
});

test('UX-IA-02 Scenario B: Finance entry is NOT nested under Lessons', () => {
    const financeJs = readProjectFile('finance.js');
    const tabBarMatch = financeJs.match(/export function renderDerslerTabBarHtml[\s\S]*?\n\}/);
    assert.ok(tabBarMatch, 'renderDerslerTabBarHtml must exist');

    const tabBarCode = tabBarMatch[0];
    assert.doesNotMatch(tabBarCode, /renderDerslerPage\('finance'\)/, 'Lessons tab bar must not link to finance');
    assert.doesNotMatch(tabBarCode, /Finans & Ödemeler/, 'Lessons tab bar must not render Finans & Ödemeler button');
    assert.doesNotMatch(tabBarCode, /fa-wallet/, 'Lessons tab bar must not contain wallet icon');
});

test('UX-IA-02 Scenario C: Finance entry invokes the existing canonical finance renderer', () => {
    const indexHtml = readProjectFile('index.html');
    const financeJs = readProjectFile('finance.js');

    assert.match(indexHtml, /id="sidebar-nav-finance"[^>]*onclick="renderFinanceReport\(\)"/, 'Finance sidebar button must call renderFinanceReport()');
    assert.match(financeJs, /export function renderFinanceReport\(\)/, 'finance.js must export renderFinanceReport()');
    assert.match(financeJs, /window\.renderFinanceReport\s*=\s*renderFinanceReport/, 'renderFinanceReport must be exposed on window');
});

test('UX-IA-02 Scenario D: Finance active state is independent from Lessons active state', async () => {
    // Load auth.js with mock DOM to test runtime behavior
    const authJsContent = readProjectFile('auth.js');

    // Create a mock DOM environment
    const elementStore = new Map();
    const createMockBtn = (id, classList = []) => {
        const classes = new Set(classList);
        const el = {
            id,
            classList: {
                add: (...names) => names.forEach(n => classes.add(n)),
                remove: (...names) => names.forEach(n => classes.delete(n)),
                contains: (n) => classes.has(n)
            }
        };
        elementStore.set(id, el);
        return el;
    };

    const sidebarBtns = [
        createMockBtn('sidebar-nav-reminders', ['sidebar-btn']),
        createMockBtn('sidebar-nav-home', ['sidebar-btn']),
        createMockBtn('sidebar-nav-lessons', ['sidebar-btn']),
        createMockBtn('sidebar-nav-homework', ['sidebar-btn']),
        createMockBtn('sidebar-nav-guidance', ['sidebar-btn']),
        createMockBtn('sidebar-nav-finance', ['sidebar-btn']),
        createMockBtn('sidebar-nav-general', ['sidebar-btn'])
    ];

    const mobileBtns = [
        createMockBtn('mobile-nav-reminders', ['mobile-nav-btn']),
        createMockBtn('mobile-nav-home', ['mobile-nav-btn']),
        createMockBtn('mobile-nav-lessons', ['mobile-nav-btn']),
        createMockBtn('mobile-nav-homework', ['mobile-nav-btn']),
        createMockBtn('mobile-nav-guidance', ['mobile-nav-btn'])
    ];

    const topbarSettingsBtn = createMockBtn('topbar-nav-general');

    const originalDoc = globalThis.document;
    globalThis.document = {
        getElementById: (id) => elementStore.get(id) || null,
        querySelectorAll: (selector) => {
            if (selector === '.sidebar-btn') return sidebarBtns;
            if (selector === '.mobile-nav-btn') return mobileBtns;
            return [];
        }
    };

    try {
        // Dynamic import of auth.js
        const authModule = await import('../auth.js');
        const { updateMobileNavActive } = authModule;

        // Activate Finance
        updateMobileNavActive('sidebar-nav-finance');

        const financeBtn = elementStore.get('sidebar-nav-finance');
        const lessonsBtn = elementStore.get('sidebar-nav-lessons');
        const homeBtn = elementStore.get('sidebar-nav-home');
        const generalBtn = elementStore.get('sidebar-nav-general');

        assert.equal(financeBtn.classList.contains('active'), true, 'Finance button must be active');
        assert.equal(lessonsBtn.classList.contains('active'), false, 'Lessons button must NOT be active');
        assert.equal(homeBtn.classList.contains('active'), false, 'Students button must NOT be active');
        assert.equal(generalBtn.classList.contains('active'), false, 'Settings button must NOT be active');

        // Verify mobile bottom bar has no false active button when on Finance
        mobileBtns.forEach(btn => {
            assert.equal(btn.classList.contains('active'), false, `Mobile button ${btn.id} must NOT be active when on Finance`);
        });

        // Activate Lessons
        updateMobileNavActive('mobile-nav-lessons');
        assert.equal(financeBtn.classList.contains('active'), false, 'Finance button must NOT be active when Lessons is activated');
        assert.equal(lessonsBtn.classList.contains('active'), true, 'Lessons button must be active');
    } finally {
        globalThis.document = originalDoc;
    }
});

test('UX-IA-02 Scenario E: Lessons navigation no longer hosts the primary Finance entry', () => {
    const financeJs = readProjectFile('finance.js');
    const tabBarMatch = financeJs.match(/export function renderDerslerTabBarHtml[\s\S]*?\n\}/);
    assert.ok(tabBarMatch);

    // Verify only schedule and lessons buttons exist in tab bar
    const tabButtons = [...tabBarMatch[0].matchAll(/<button[\s\S]*?<\/button>/g)].map(m => m[0]);
    assert.equal(tabButtons.length, 2, 'Dersler tab bar must have exactly 2 tabs (Haftalık Program and Ders Kayıtları)');
    assert.match(tabButtons[0], /renderDerslerPage\('schedule'\)/);
    assert.match(tabButtons[1], /renderDerslerPage\('lessons'\)/);
});

test('UX-IA-02 Scenario F: No duplicate primary Finance entry exists in main navigation', () => {
    const indexHtml = readProjectFile('index.html');
    const sidebarMatch = indexHtml.match(/<nav[^>]*aria-label="Sayfa Navigasyonu"[^>]*>([\s\S]*?)<\/nav>/);
    assert.ok(sidebarMatch, 'Sidebar navigation container must exist');

    const financeMatches = [...sidebarMatch[1].matchAll(/id="sidebar-nav-finance"/g)];
    assert.equal(financeMatches.length, 1, 'Exactly one sidebar-nav-finance button must exist in entire sidebar');

    // Ensure no duplicate buttons mentioning Finans / Ödemeler in sidebar
    const financeTextMatches = [...sidebarMatch[1].matchAll(/Finans/gi)];
    assert.equal(financeTextMatches.length, 1, 'Only one Finans label must exist in sidebar');
});

test('UX-IA-02 Scenario G: Existing navigation items remain present in expected order', () => {
    const indexHtml = readProjectFile('index.html');
    const groupMatch = indexHtml.match(/<div[^>]*id="sidebar-workspace-group"[^>]*>([\s\S]*?)<\/div>/);
    assert.ok(groupMatch);

    const buttonIds = [...groupMatch[1].matchAll(/<button[^>]*id="([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(buttonIds, [
        'sidebar-nav-reminders',
        'sidebar-nav-home',
        'sidebar-nav-lessons',
        'sidebar-nav-homework',
        'sidebar-nav-guidance',
        'sidebar-nav-finance'
    ], 'Workspace navigation order must follow: Bugün, Öğrenciler, Dersler, Ödevler, Rehberlik, Finans / Ödemeler');
});

test('UX-IA-02 Scenario H: Ayarlar remains management-level navigation', () => {
    const indexHtml = readProjectFile('index.html');
    const mgmtMatch = indexHtml.match(/<div[^>]*id="sidebar-management-group"[^>]*>([\s\S]*?)<\/div>/);
    assert.ok(mgmtMatch, 'sidebar-management-group must exist');

    const buttonIds = [...mgmtMatch[1].matchAll(/<button[^>]*id="([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(buttonIds, ['sidebar-nav-general'], 'Management group must contain only sidebar-nav-general');
});

test('UX-IA-02 Scenario I: Mobile navigation remains structurally valid and does not overflow / wrap destructively', () => {
    const indexHtml = readProjectFile('index.html');
    const mobileNavMatch = indexHtml.match(/<div[^>]*class="[^"]*mobile-nav-bar[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    assert.ok(mobileNavMatch, 'Mobile nav bar container must exist');

    const buttonMatches = [...mobileNavMatch[1].matchAll(/<button[^>]*id="(mobile-nav-[^"]+)"[^>]*>/g)];
    assert.equal(buttonMatches.length, 5, 'Mobile bottom bar must remain exactly 5 buttons without cramming a 6th button');

    const buttonIds = buttonMatches.map(m => m[1]);
    assert.deepEqual(buttonIds, [
        'mobile-nav-reminders',
        'mobile-nav-home',
        'mobile-nav-lessons',
        'mobile-nav-homework',
        'mobile-nav-guidance'
    ], 'Mobile navigation items and order must be preserved');
});

test('UX-IA-02 Scenario J: Page header and layout inside Finance view are self-contained', () => {
    const financeJs = readProjectFile('finance.js');
    const renderFinanceMatch = financeJs.match(/export function renderFinanceReport\(\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(renderFinanceMatch, 'renderFinanceReport must exist');

    const code = renderFinanceMatch[1];
    assert.match(code, /<h2 class="app-page-title">Finans \/ Ödemeler<\/h2>/, 'Page title must be "Finans / Ödemeler"');
    assert.doesNotMatch(code, /renderDerslerTabBarHtml\('finance'\)/, 'renderFinanceReport must not include Dersler tab bar');
    assert.match(code, /updateMobileNavActive\(['"]sidebar-nav-finance['"]\)/, 'renderFinanceReport must activate sidebar-nav-finance');
});

test('UX-IA-02B Scenario K: Mobile Finance is reachable through Lessons quick-link without restoring Finance as a Lessons tab.', () => {
    const indexHtml = readProjectFile('index.html');
    const financeJs = readProjectFile('finance.js');

    // 1. Quick-link exists in finance.js and is rendered in lessons
    assert.match(financeJs, /export function renderMobileFinanceQuickLinkHtml/, 'renderMobileFinanceQuickLinkHtml must be exported');
    assert.match(financeJs, /id="mobile-finance-quicklink"/, 'quick-link button ID must exist');
    assert.match(financeJs, /Finans \/ Ödemeler/, 'quick-link must display "Finans / Ödemeler"');
    assert.match(financeJs, /min-h-\[44px\]/, 'quick-link must enforce minimum 44px touch target');

    // 2. Mobile-only class exists (hidden on desktop >= 768px)
    assert.match(financeJs, /class="[^"]*md:hidden[^"]*"[^>]*id="mobile-finance-quicklink-container"/, 'quick-link container must use md:hidden');

    // 3. Onclick calls renderFinanceReport()
    assert.match(financeJs, /id="mobile-finance-quicklink"[^>]*onclick="renderFinanceReport\(\)"/, 'quick-link must call renderFinanceReport()');

    // 4. Finance tab does NOT exist in renderDerslerTabBarHtml()
    const tabBarMatch = financeJs.match(/export function renderDerslerTabBarHtml[\s\S]*?\n\}/);
    assert.ok(tabBarMatch, 'renderDerslerTabBarHtml must exist');
    const tabBarButtons = [...tabBarMatch[0].matchAll(/<button[\s\S]*?<\/button>/g)].map(m => m[0]);
    assert.equal(tabBarButtons.length, 2, 'renderDerslerTabBarHtml must have strictly 2 tabs');
    assert.doesNotMatch(tabBarMatch[0], /Finans & Ödemeler/, 'Finance tab must not exist in tab bar');
    assert.doesNotMatch(tabBarMatch[0], /renderFinanceReport/, 'renderFinanceReport must not be inside tab bar');

    // 5. Desktop sidebar Finance still exists exactly once
    const sidebarMatch = indexHtml.match(/<nav[^>]*aria-label="Sayfa Navigasyonu"[^>]*>([\s\S]*?)<\/nav>/);
    assert.ok(sidebarMatch, 'Sidebar navigation container must exist');
    const financeMatches = [...sidebarMatch[1].matchAll(/id="sidebar-nav-finance"/g)];
    assert.equal(financeMatches.length, 1, 'Exactly one sidebar-nav-finance button must exist in desktop sidebar');
});

test('UX-IA-02B Scenario L: Mobile Finance quick-link HTML structure and accessibility', () => {
    const financeJs = readProjectFile('finance.js');
    const quickLinkMatch = financeJs.match(/export function renderMobileFinanceQuickLinkHtml\(\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(quickLinkMatch, 'renderMobileFinanceQuickLinkHtml must exist');

    const html = quickLinkMatch[1];
    assert.match(html, /id="mobile-finance-quicklink"/, 'must have mobile-finance-quicklink id');
    assert.match(html, /fa-wallet/, 'must have wallet icon');
    assert.match(html, /Finans \/ Ödemeler/, 'must have clear text label');
    assert.match(html, /min-h-\[44px\]/, 'must have min 44px touch target');
    assert.match(html, /md:hidden/, 'must be hidden on tablet/desktop');
});

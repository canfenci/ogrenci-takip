import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const readProjectFile = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

// ============================================================================
// PART 1: TOPBAR TOUCH TARGETS & SIZING CONTRACTS (UX-MOBILE-01 / F-04)
// ============================================================================

test('UX-MOBILE-01 Scenario A: Topbar action buttons satisfy minimum 44×44px touch targets', () => {
    const indexHtml = readProjectFile('index.html');
    const topbarActionsMatch = indexHtml.match(/<div[^>]*class="cf-topbar-actions[^"]*"[^>]*>([\s\S]*?)<\/header>/);
    assert.ok(topbarActionsMatch, 'cf-topbar-actions must exist within header');
    const topbarActionsHtml = topbarActionsMatch[1];

    // Settings button checks
    const settingsBtnMatch = topbarActionsHtml.match(/<button[^>]*id="topbar-nav-general"[^>]*>/);
    assert.ok(settingsBtnMatch, 'topbar-nav-general button must exist');
    const settingsBtn = settingsBtnMatch[0];
    assert.match(settingsBtn, /min-h-\[44px\]/, 'Settings button must have min-h-[44px]');
    assert.match(settingsBtn, /min-w-\[44px\]/, 'Settings button must have min-w-[44px]');

    // Theme toggle button checks
    const themeBtnMatch = topbarActionsHtml.match(/<button[^>]*id="themeToggleBtn"[^>]*>/);
    assert.ok(themeBtnMatch, 'themeToggleBtn must exist');
    const themeBtn = themeBtnMatch[0];
    assert.match(themeBtn, /min-h-\[44px\]/, 'Theme toggle button must have min-h-[44px]');
    assert.match(themeBtn, /min-w-\[44px\]/, 'Theme toggle button must have min-w-[44px]');
    assert.match(themeBtn, /\bw-11\b/, 'Theme toggle button must have width 44px (w-11)');
    assert.match(themeBtn, /\bh-11\b/, 'Theme toggle button must have height 44px (h-11)');
});

test('UX-MOBILE-01 Scenario B: CSS rule enforces minimum 44px on topbar action buttons', () => {
    const indexHtml = readProjectFile('index.html');
    assert.match(
        indexHtml,
        /\.cf-topbar-actions\s+button\s*\{[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px;[\s\S]*?\}/,
        'CSS must define .cf-topbar-actions button with min-width and min-height >= 44px'
    );
});

test('UX-MOBILE-01 Scenario C: Sub-44px regression prevention (no 36px controls in topbar)', () => {
    const indexHtml = readProjectFile('index.html');
    const topbarMatch = indexHtml.match(/<header[^>]*class="cf-topbar[^"]*"[^>]*>([\s\S]*?)<\/header>/);
    assert.ok(topbarMatch, 'cf-topbar must exist');
    const topbarHtml = topbarMatch[1];

    assert.doesNotMatch(topbarHtml, /min-h-\[36px\]/, 'Topbar buttons must not regress to min-h-[36px]');
    assert.doesNotMatch(topbarHtml, /\bw-9\b/, 'Topbar buttons must not regress to w-9 (36px)');
    assert.doesNotMatch(topbarHtml, /\bh-9\b/, 'Topbar buttons must not regress to h-9 (36px)');

    // Verify mobile topbar height is not constrained to 50px
    assert.doesNotMatch(indexHtml, /height:\s*50px;\s*min-height:\s*50px;/, 'Mobile topbar must not restrict height to 50px');
});

// ============================================================================
// PART 2: ACCESSIBILITY & SEMANTICS
// ============================================================================

test('UX-MOBILE-01 Scenario D: Accessible names and titles exist for all topbar controls', () => {
    const indexHtml = readProjectFile('index.html');

    // Settings button accessibility
    const settingsMatch = indexHtml.match(/<button[^>]*id="topbar-nav-general"[^>]*>([\s\S]*?)<\/button>/);
    assert.ok(settingsMatch, 'topbar-nav-general must exist');
    const settingsOpeningTag = settingsMatch[0].match(/<button[^>]*>/)[0];
    assert.match(settingsOpeningTag, /aria-label="Ayarlar"/, 'Settings button must have aria-label');
    assert.match(settingsOpeningTag, /title="[^"]+"/, 'Settings button must have title attribute');
    assert.match(settingsMatch[1], /<span>Ayarlar<\/span>/, 'Settings button must retain visible text label');

    // Theme toggle accessibility (icon-only button)
    const themeMatch = indexHtml.match(/<button[^>]*id="themeToggleBtn"[^>]*>/);
    assert.ok(themeMatch, 'themeToggleBtn must exist');
    const themeOpeningTag = themeMatch[0];
    assert.match(themeOpeningTag, /aria-label="Temayı Değiştir"/, 'Theme toggle must have aria-label');
    assert.match(themeOpeningTag, /title="[^"]+"/, 'Theme toggle must have title attribute');
});

test('UX-MOBILE-01 Scenario E: Behavioral wiring and icons remain intact', () => {
    const indexHtml = readProjectFile('index.html');

    // Settings handler and data-app-nav
    assert.match(indexHtml, /id="topbar-nav-general"[^>]*data-app-nav="true"/, 'Settings must retain data-app-nav="true"');
    assert.match(indexHtml, /id="topbar-nav-general"[^>]*onclick="renderGenelIslemler\(\)"/, 'Settings must retain renderGenelIslemler()');
    assert.match(indexHtml, /id="topbar-nav-general"[\s\S]*?class="fas fa-cog/, 'Settings must retain cog icon');

    // Theme handler
    assert.match(indexHtml, /id="themeToggleBtn"[^>]*onclick="toggleTheme\(\)"/, 'Theme button must retain toggleTheme()');
    assert.match(indexHtml, /id="themeToggleBtn"[\s\S]*?class="fas fa-moon/, 'Theme button must retain moon icon');
});

// ============================================================================
// PART 3: CSS SCOPE & RESPONSIVE SAFETY
// ============================================================================

test('UX-MOBILE-01 Scenario F: CSS scope isolation — no global button inflation', () => {
    const indexHtml = readProjectFile('index.html');

    // Verify 44px rule is scoped to .cf-topbar-actions
    const styleBlock = indexHtml.match(/<style>([\s\S]*?)<\/style>/)[1];
    assert.match(styleBlock, /\.cf-topbar-actions\s+button/, 'Rule must be explicitly scoped to .cf-topbar-actions button');
    assert.doesNotMatch(styleBlock, /(?:^|\n)\s*button\s*\{\s*min-width:\s*44px/m, 'Must not globally set button min-width to 44px');
});

test('UX-MOBILE-01 Scenario G: Mobile layout structure prevents horizontal overflow', () => {
    const indexHtml = readProjectFile('index.html');
    const topbarMatch = indexHtml.match(/<header class="cf-topbar([^"]*)"/);
    assert.ok(topbarMatch, 'cf-topbar header must exist');
    const classes = topbarMatch[1];
    assert.match(classes, /justify-between/, 'Topbar must use justify-between for responsive spacing');
    assert.match(classes, /shrink-0/, 'Topbar must be shrink-0');
});

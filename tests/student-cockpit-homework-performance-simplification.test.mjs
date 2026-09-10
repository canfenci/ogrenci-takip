import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const studentsJsContent = fs.readFileSync(path.join(ROOT, 'students.js'), 'utf8');

// ============================================================================
// PART 1: DATA SAFETY & STATIC AUDIT
// ============================================================================

test('Scenario O: Zero git modifications against HEAD for all protected files', () => {
    const protectedFiles = [
        'store.js',
        'firebase-config.js',
        'firestore.rules',
        'auth.js',
        'index.html',
        'finance.js',
        'schedule.js',
        'homework.js',
        'exams.js'
    ];

    for (const file of protectedFiles) {
        const diff = execSync(`git diff HEAD -- ${file}`, { encoding: 'utf8' }).trim();
        assert.equal(diff, '', `Protected file ${file} must have 0 diff against HEAD`);
    }
});

test('Scenario A & B (Static): Exactly 4 KPI cards and no old 6-KPI patterns', () => {
    // Check 4-column grid layout
    assert.match(studentsJsContent, /grid grid-cols-2 lg:grid-cols-4 gap-3/, 'Must use 4-column responsive grid');
    
    // Check 4 KPI titles in the homework section
    assert.match(studentsJsContent, /Ödev Disiplini/);
    assert.match(studentsJsContent, /Geciken/);
    assert.match(studentsJsContent, /Ortalama Başarı/);
    assert.match(studentsJsContent, /Ortalama Net/);

    // Old cards removed from KPI grid
    assert.doesNotMatch(studentsJsContent, /<p[^>]*>Verilen Ödev<\/p>/);
    assert.doesNotMatch(studentsJsContent, /<p[^>]*>Eksik \/ Yapılmayan<\/p>/);
    
    // Bottom grid has items-start to avoid vertical stretching
    assert.match(studentsJsContent, /grid grid-cols-1 lg:grid-cols-2 gap-4 items-start/);
});

// ============================================================================
// PART 2: RUNTIME DOM SIMULATION SETUP
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

const sessionStorageMap = new Map();
const mockSessionStorage = {
    getItem: (k) => sessionStorageMap.get(k) || null,
    setItem: (k, v) => sessionStorageMap.set(k, String(v)),
    removeItem: (k) => sessionStorageMap.delete(k),
    clear: () => sessionStorageMap.clear()
};
globalThis.sessionStorage = mockSessionStorage;
globalThis.window.sessionStorage = mockSessionStorage;

const elementStore = new Map();
const mockDocument = {
    getElementById: (id) => {
        if (!elementStore.has(id)) {
            elementStore.set(id, {
                innerHTML: '',
                textContent: '',
                id,
                classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
                remove() { elementStore.delete(id); }
            });
        }
        return elementStore.get(id);
    },
    querySelectorAll: () => []
};
globalThis.document = mockDocument;
globalThis.window.document = mockDocument;

const { store, STORAGE_KEY, localDataKey } = await import('../store.js');
const {
    renderStudentCockpit,
    calculateStudentHomeworkPerformance
} = await import('../students.js');

// ============================================================================
// PART 3: RUNTIME SCENARIO TESTS
// ============================================================================

test('Scenario C, D, E, F: Active student homework sub-tab renders 4 KPIs accurately', () => {
    const student = {
        id: 'std_perf_hw_1',
        adSoyad: 'Zeynep Aksoy',
        sinif: '8',
        denemeler: [],
        odevler: [
            {
                id: 'hw_1',
                durum: 'tamamlandi',
                tarih: '2026-09-01',
                bitisTarihi: '2026-09-03',
                unite: 'Mevsimler ve İklim',
                konu: 'Mevsimlerin Oluşumu',
                dogru: 18,
                yanlis: 2,
                toplamSoru: 20,
                yanlisAnalizi: [{ unite: 'Mevsimler ve İklim', konu: 'Mevsimlerin Oluşumu', adet: 2, hataNedenleriKeys: ['dikkatsizlik'] }]
            },
            {
                id: 'hw_2',
                durum: 'tamamlandi',
                tarih: '2026-09-04',
                bitisTarihi: '2026-09-06',
                unite: 'DNA ve Genetik Kod',
                konu: 'DNA Replikasyonu',
                dogru: 15,
                yanlis: 3,
                toplamSoru: 20,
                yanlisAnalizi: [{ unite: 'DNA ve Genetik Kod', konu: 'DNA Replikasyonu', adet: 3, hataNedenleriKeys: ['bilgi_eksikligi'] }]
            },
            {
                id: 'hw_3',
                durum: 'yapilmadi',
                tarih: '2026-09-07',
                bitisTarihi: '2026-09-08', // Overdue relative to current year
                unite: 'Basınç',
                konu: 'Katı Basıncı',
                toplamSoru: 15
            }
        ]
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_perf_hw_1', 'home', 'performance', 'homework');
    const html = document.getElementById('dynamic-content').innerHTML;

    // 1. Ödev Disiplini: 2 completed out of 3 = 67%
    assert.ok(html.includes('Ödev Disiplini'), 'Must show Ödev Disiplini KPI header');
    assert.ok(html.includes('%67'), 'Must show 67% discipline rate');
    assert.ok(html.includes('2 / 3 tamamlandı'), 'Must show 2 / 3 completed');

    // 2. Geciken: 1 overdue homework
    assert.ok(html.includes('Geciken'), 'Must show Geciken KPI header');
    assert.ok(html.includes('Süresi geçen'), 'Must show Süresi geçen badge');

    // 3. Ortalama Başarı & 4. Ortalama Net
    const hwPerf = calculateStudentHomeworkPerformance(student, student.odevler);
    assert.ok(html.includes('Ortalama Başarı'), 'Must show Ortalama Başarı KPI');
    assert.ok(html.includes('Ortalama Net'), 'Must show Ortalama Net KPI');
    assert.ok(html.includes('Tamamlanan ödevler'), 'Must show Tamamlanan ödevler subtitle');

    // D/Y chip in graph strip
    assert.ok(html.includes('Ort. D/Y:'), 'Must show Ort. D/Y chip in header');
    assert.ok(html.includes('Son Başarı:'), 'Must show Son Başarı in header');
    assert.ok(html.includes('En Yüksek:'), 'Must show En Yüksek in header');
});

test('Scenario G & H: Duplicate Ortalama Başarı chip removed from graph strip, D/Y chip added', () => {
    const student = {
        id: 'std_perf_hw_2',
        adSoyad: 'Kerem Yıldız',
        sinif: '8',
        denemeler: [],
        odevler: [
            {
                id: 'hw_k1',
                durum: 'tamamlandi',
                tarih: '2026-09-01',
                bitisTarihi: '2026-09-03',
                dogru: 20,
                yanlis: 0,
                toplamSoru: 20
            },
            {
                id: 'hw_k2',
                durum: 'tamamlandi',
                tarih: '2026-09-04',
                bitisTarihi: '2026-09-06',
                dogru: 18,
                yanlis: 2,
                toplamSoru: 20
            }
        ]
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_perf_hw_2', 'home', 'performance', 'homework');
    const html = document.getElementById('dynamic-content').innerHTML;

    // Check that inside the graph header, there is no duplicate "Ortalama Başarı: %" chip
    assert.doesNotMatch(html, /Ortalama Başarı:\s*%/, 'Must not have duplicate Ortalama Başarı chip in graph header');
    assert.ok(html.includes('Ort. D/Y:'), 'Must have Ort. D/Y chip in graph header');
});

test('Scenario I: Zero homework empty state renders cleanly without errors', () => {
    const emptyStudent = {
        id: 'std_empty_hw',
        adSoyad: 'Ali Vural',
        sinif: '7',
        denemeler: [],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([emptyStudent]));
    store.globalStudents = [emptyStudent];

    renderStudentCockpit('std_empty_hw', 'home', 'performance', 'homework');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('Henüz ödev yok'), 'Must show Henüz ödev yok subtext');
    assert.ok(html.includes('Geciken ödev yok'), 'Must show Geciken ödev yok subtext');
    assert.ok(html.includes('Tamamlanan ödev yok'), 'Must show Tamamlanan ödev yok subtext');
    assert.ok(html.includes('Ödevlerde kaydedilmiş hata konusu bulunmuyor'), 'Must show weak topics empty state');
    assert.ok(html.includes('Hata analizi yapılmış kayıt bulunmuyor'), 'Must show error reasons empty state');
    assert.doesNotMatch(html, /NaN/, 'Must not contain NaN');
    assert.doesNotMatch(html, /undefined/, 'Must not contain undefined');
});

test('Scenario J & K: Challenged topics rendering and error analysis counts', () => {
    const student = {
        id: 'std_topics_hw',
        adSoyad: 'Murat Er',
        sinif: '8',
        denemeler: [],
        odevler: [
            {
                id: 'hw_t1',
                durum: 'tamamlandi',
                tarih: '2026-09-01',
                unite: 'Madde ve Endüstri',
                konu: 'Periyodik Sistem',
                dogru: 14,
                yanlis: 4,
                toplamSoru: 20,
                yanlisAnalizi: [
                    { unite: 'Madde ve Endüstri', konu: 'Periyodik Sistem', adet: 4, hataNedenleriKeys: ['kavram_yanilgisi'] }
                ]
            }
        ]
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_topics_hw', 'home', 'performance', 'homework');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('Periyodik Sistem'), 'Must display topic name');
    assert.ok(html.includes('Madde ve Endüstri'), 'Must display unit name');
    assert.ok(html.includes('4 hata'), 'Must display error count');
    assert.ok(html.includes('1 ödevde tekrar etti'), 'Must display repetition count');
});

test('Scenario N: Action button wiring preserved', () => {
    const student = {
        id: 'std_action_btn',
        adSoyad: 'Selin Yılmaz',
        sinif: '8',
        denemeler: [],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_action_btn', 'home', 'performance', 'homework');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes("openCockpitHomework('std_action_btn')"), 'Must wire button to openCockpitHomework');
    assert.ok(html.includes('Yeni Ödev Ata'), 'Must have action button text');
    assert.ok(html.includes('min-h-[44px]'), 'Must respect accessibility touch target size');
});

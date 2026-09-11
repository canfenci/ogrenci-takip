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
        'firebase-config.js',
        'firestore.rules',
        'auth.js',
        'index.html',
        'finance.js',
        'schedule.js',
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

test('Scenario P: Real student fixture metrics precision (%81,7, 13,86 net, 14,57 / 2,14)', () => {
    // Exact 11 homeworks matching the real student persisted data with canonical totals (102 Doğru, 15 Yanlış)
    const student = {
        id: 'std_real_fixture',
        adSoyad: 'Gerçek Öğrenci',
        sinif: '8',
        denemeler: [],
        odevler: [
            // 7 Completed homeworks: 102 Doğru, 15 Yanlış in total
            { id: 'h1', durum: 'tamamlandi', tarih: '2026-08-10', bitisTarihi: '2026-08-12', dogru: 18, yanlis: 0, toplamSoru: 18 },
            { id: 'h2', durum: 'tamamlandi', tarih: '2026-08-15', bitisTarihi: '2026-08-17', dogru: 15, yanlis: 0, toplamSoru: 15 },
            { id: 'h3', durum: 'tamamlandi', tarih: '2026-08-20', bitisTarihi: '2026-08-22', dogru: 14, yanlis: 0, toplamSoru: 14 },
            { id: 'h4', durum: 'tamamlandi', tarih: '2026-08-25', bitisTarihi: '2026-08-27', dogru: 12, yanlis: 0, toplamSoru: 12 },
            { id: 'h5', durum: 'tamamlandi', tarih: '2026-08-30', bitisTarihi: '2026-09-01', dogru: 15, yanlis: 3, toplamSoru: 19 },
            { id: 'h6', durum: 'tamamlandi', tarih: '2026-09-03', bitisTarihi: '2026-09-05', dogru: 14, yanlis: 6, toplamSoru: 24 },
            { id: 'h7', durum: 'tamamlandi', tarih: '2026-09-07', bitisTarihi: '2026-09-09', dogru: 14, yanlis: 6, toplamSoru: 25 },
            // 3 Overdue
            { id: 'h8', durum: 'verildi', tarih: '2026-08-20', bitisTarihi: '2026-08-25', toplamSoru: 20 },
            { id: 'h9', durum: 'yapilmadi', tarih: '2026-09-01', bitisTarihi: '2026-09-05', toplamSoru: 20 },
            { id: 'h10', durum: 'verildi', tarih: '2026-09-05', bitisTarihi: '2026-09-08', toplamSoru: 20 },
            // 1 Active pending
            { id: 'h11', durum: 'verildi', tarih: '2026-09-10', bitisTarihi: '2026-09-15', toplamSoru: 20 }
        ]
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_real_fixture', 'home', 'performance', 'homework');
    const html = document.getElementById('dynamic-content').innerHTML;

    // 1. Ödev Disiplini: 7/11 = 64%
    assert.ok(html.includes('%64'), 'Must show %64 discipline');
    assert.ok(html.includes('7 / 11 tamamlandı'), 'Must show 7 / 11 completed');

    // 2. Geciken: 3
    assert.ok(html.includes('3') && html.includes('Süresi geçen'), 'Must show 3 overdue');

    // 3. Ortalama Başarı: %81,7
    assert.ok(html.includes('%81,7'), 'Must show %81,7 with 1 decimal place');

    // 4. Ortalama Net: 13,86 net
    assert.ok(html.includes('13,86 net'), 'Must show 13,86 net with 2 decimal places');

    // Graph summary strip: Ort. D/Y: 14,57 / 2,14
    assert.ok(html.includes('Ort. D/Y: 14,57 / 2,14'), 'Must show Ort. D/Y: 14,57 / 2,14 with exact precision');
});

test('Scenario Q: Error reasons bar percentage fidelity without minimum 12% distortion (Small percentage 2%)', () => {
    const student = {
        id: 'std_err_fidelity',
        adSoyad: 'Emir Kaya',
        sinif: '8',
        denemeler: [],
        odevler: [
            {
                id: 'hw_fid_1',
                durum: 'tamamlandi',
                tarih: '2026-09-01',
                bitisTarihi: '2026-09-03',
                dogru: 0,
                yanlis: 50,
                toplamSoru: 50,
                yanlisAnalizi: [
                    { unite: 'Madde', konu: 'Periyodik', adet: 49, hataNedenleri: ['Dikkatsizlik'] },
                    { unite: 'Madde', konu: 'Fiziksel', adet: 1, hataNedenleri: ['İşlem Hatası'] }
                ]
            }
        ]
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_err_fidelity', 'home', 'performance', 'homework');
    const html = document.getElementById('dynamic-content').innerHTML;

    // 49/50 = 98%, 1/50 = 2%
    assert.ok(html.includes('style="width: 98%'), 'Major error must have width: 98%');
    assert.ok(html.includes('style="width: 2%'), 'Minor error must have width: 2%');
    assert.doesNotMatch(html, /style="width:\s*12%/, 'Minor error must NOT be distorted to 12%');
    assert.ok(html.includes('(%98)'), 'Must show %98 text');
    assert.ok(html.includes('(%2)'), 'Must show %2 text');
});

test('Scenario R: Multiple error reasons proportional distribution (53%, 33%, 13%)', () => {
    const student = {
        id: 'std_err_multi',
        adSoyad: 'Gamze Çelik',
        sinif: '8',
        denemeler: [],
        odevler: [
            {
                id: 'hw_multi_1',
                durum: 'tamamlandi',
                tarih: '2026-09-01',
                bitisTarihi: '2026-09-03',
                dogru: 5,
                yanlis: 15,
                toplamSoru: 20,
                yanlisAnalizi: [
                    { unite: 'DNA', konu: 'Replikasyon', adet: 8, hataNedenleri: ['Dikkatsizlik'] },
                    { unite: 'DNA', konu: 'Mutasyon', adet: 5, hataNedenleri: ['Bilgi Eksikliği'] },
                    { unite: 'DNA', konu: 'Modifikasyon', adet: 2, hataNedenleri: ['İşlem Hatası'] }
                ]
            }
        ]
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_err_multi', 'home', 'performance', 'homework');
    const html = document.getElementById('dynamic-content').innerHTML;

    // 8/15 = 53%, 5/15 = 33%, 2/15 = 13%
    assert.ok(html.includes('style="width: 53%'), '8/15 must have width: 53%');
    assert.ok(html.includes('style="width: 33%'), '5/15 must have width: 33%');
    assert.ok(html.includes('style="width: 13%'), '2/15 must have width: 13%');
    assert.ok(html.includes('8 soru (%53)'), 'Must render 8 soru (%53)');
    assert.ok(html.includes('5 soru (%33)'), 'Must render 5 soru (%33)');
    assert.ok(html.includes('2 soru (%13)'), 'Must render 2 soru (%13)');
});

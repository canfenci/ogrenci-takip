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

test('Scenario S (Static): Zero git modifications against HEAD for protected files', () => {
    const protectedFiles = [
        'firebase-config.js',
        'firestore.rules',
        'auth.js',
        'index.html',
        'finance.js',
        'schedule.js',
        'exams.js',
        'student-cockpit-insights.js',
        'guidance-performance-insights.js',
        'homework-error-topics.js'
    ];

    for (const file of protectedFiles) {
        const diff = execSync(`git diff HEAD -- ${file}`, { encoding: 'utf8' }).trim();
        assert.equal(diff, '', `Protected file ${file} must have 0 diff against HEAD`);
    }
});

test('Static: No schema / persistence writes introduced by simplification', () => {
    const perfFnStart = studentsJsContent.indexOf('export function calculateStudentSchoolExamPerformance');
    const perfTabStart = studentsJsContent.indexOf('export function renderCockpitPerformanceTab');
    const perfTabEnd = studentsJsContent.indexOf('export function renderCockpitExamsSection');
    assert.ok(perfFnStart !== -1 && perfTabStart !== -1, 'Performance functions must exist');
    const perfCode = studentsJsContent.slice(perfFnStart, perfTabEnd !== -1 ? perfTabEnd : undefined);
    assert.doesNotMatch(perfCode, /localStorage\.setItem/, 'Performance calc/render must not write to localStorage');
    assert.doesNotMatch(perfCode, /saveStudentsData|setDoc|updateDoc|addDoc|deleteDoc/, 'Performance calc/render must not mutate student/exam data');
});

test('Static: Exam-count-aware KPI strategy present, no triple-duplicate KPI', () => {
    assert.match(studentsJsContent, /completedGenelCount/, 'Must branch KPI set on comparable general exam count');
    assert.match(studentsJsContent, /Son Deneme/, 'Must render Son Deneme KPI for 1-exam state');
    assert.match(studentsJsContent, /Deneme Say.s./, 'Must render Deneme Sayısı KPI for 1-exam state');
    assert.match(studentsJsContent, /Son 5 Ort/, 'Must render Son 5 Ort KPI for 2+ state');
    assert.match(studentsJsContent, /Henüz sonuç yok/, 'Must render compact 0-exam state');
    assert.match(studentsJsContent, /Trend için en az 2 genel deneme gerekir/, 'Must render compact 1-exam chart state');
});

test('Static: Comparability-safe helpers reused, no second engine', () => {
    assert.match(studentsJsContent, /getCockpitExamComparabilityKey/, 'Must reuse canonical comparability helper');
    assert.doesNotMatch(studentsJsContent, /function buildSecondComparability|function getSecondExamKey/, 'Must not create a second comparability engine');
});

test('Static: Mobile-safe + density markers present', () => {
    assert.match(studentsJsContent, /grid-cols-1 lg:grid-cols-2 gap-4 items-start/, 'Lower analysis grid must use items-start');
    assert.match(studentsJsContent, /h-60 sm:h-64/, 'Chart height must be compact (~256px)');
    assert.match(studentsJsContent, /grid-cols-1 sm:grid-cols-3/, 'KPI grid must be responsive');
    assert.match(studentsJsContent, /min-h-\[44px\]/, 'Touch targets must keep 44px minimum');
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
    calculateStudentSchoolExamPerformance
} = await import('../students.js');
const { getCockpitExamComparabilityKey } = await import('../student-cockpit-insights.js');

// ============================================================================
// PART 3: RUNTIME SCENARIO TESTS (A through R)
// ============================================================================

test('Scenario A: Zero general exam renders 2 compact KPIs without canvas', () => {
    const student = {
        id: 'std_exam_zero',
        adSoyad: 'Sifir Denemeli',
        sinif: '8',
        denemeler: [],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    const perf = calculateStudentSchoolExamPerformance(student);
    assert.equal(perf.genelSummary.totalCount, 0);
    assert.equal(perf.genelSummary.completedCount, 0);
    assert.equal(perf.genelSummary.latestNet, null);
    assert.equal(perf.genelSummary.averageNet, null);
    assert.equal(perf.genelSummary.maxNet, null);
    assert.equal(perf.genelSummary.trend, null);

    renderStudentCockpit('std_exam_zero', 'home', 'performance', 'exams');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('Genel Deneme'), 'Must have Genel Deneme KPI');
    assert.ok(html.includes('Henüz sonuç yok'), 'Must show Henuz sonuc yok detail');
    assert.ok(html.includes('Eğilim'), 'Must have Egilim KPI');
    assert.ok(html.includes('En az 2 deneme gerekli'), 'Must show requirement for trend');
    assert.ok(!html.includes('id="cockpitGenelExamChart"'), 'Canvas must NOT render for 0 exams');
    assert.ok(!html.includes('Ortalama Net'), 'Must NOT show redundant Ortalama Net card for 0 exams');
    assert.ok(!html.includes('En Yüksek Net'), 'Must NOT show redundant En Yuksek Net card for 0 exams');
});

test('Scenario B & C: One general exam renders 3 compact KPIs, no duplicate avg/high', () => {
    const student = {
        id: 'std_exam_one',
        adSoyad: 'Tek Denemeli Ogrenci',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_real_1',
                tip: 'genel',
                denemeAdi: 'Yaz Kursu Denemesi',
                tarih: '2026-09-07',
                toplamSoru: 90,
                toplamDogru: 52,
                toplamYanlis: 22,
                toplamBos: 16,
                toplamNet: 44.67
            }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    const perf = calculateStudentSchoolExamPerformance(student);
    assert.equal(perf.genelSummary.completedCount, 1);
    assert.equal(perf.genelSummary.latestNet, 44.67);
    assert.equal(perf.genelSummary.trend, null);

    renderStudentCockpit('std_exam_one', 'home', 'performance', 'exams');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('Son Deneme'), 'Must have Son Deneme KPI');
    assert.ok(html.includes('44,67 net'), 'Must display exact latest net 44,67');
    assert.ok(html.includes('Deneme Sayısı'), 'Must have Deneme Sayisi KPI');
    assert.ok(html.includes('Eğilim'), 'Must have Egilim KPI');
    assert.ok(!html.includes('Ortalama Net'), 'Must NOT show duplicate Ortalama Net card for 1 exam');
    assert.ok(!html.includes('En Yüksek Net'), 'Must NOT show duplicate En Yuksek Net card for 1 exam');
    assert.ok(html.includes('Son sonuç: 44,67 net'), 'Must show compact single result notice');
    assert.ok(html.includes('Trend için en az 2 genel deneme gerekir.'), 'Must show requirement text');
    assert.ok(!html.includes('id="cockpitGenelExamChart"'), 'Canvas must NOT render for 1 exam');
});

test('Scenario D: Two general exams render 4 KPIs and enable chart canvas', () => {
    const student = {
        id: 'std_exam_two',
        adSoyad: 'Iki Denemeli',
        sinif: '8',
        denemeler: [
            { id: 'ex_1', tip: 'genel', denemeAdi: 'Deneme A', tarih: '2026-09-01', toplamSoru: 90, toplamNet: 44.0 },
            { id: 'ex_2', tip: 'genel', denemeAdi: 'Deneme B', tarih: '2026-09-07', toplamSoru: 90, toplamNet: 50.0 }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    const perf = calculateStudentSchoolExamPerformance(student);
    assert.equal(perf.genelSummary.completedCount, 2);
    assert.equal(perf.genelSummary.latestNet, 50.0);
    assert.equal(perf.genelSummary.averageNet, 47.0);
    assert.equal(perf.genelSummary.maxNet, 50.0);
    assert.equal(perf.genelSummary.trendDelta, 6.0);
    assert.equal(perf.genelSummary.trend, 'improving');

    renderStudentCockpit('std_exam_two', 'home', 'performance', 'exams');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('Son Net'), 'Must show Son Net KPI');
    assert.ok(html.includes('47'), 'Must display average net 47');
    assert.ok(html.includes('En Yüksek Net'), 'Must show En Yuksek Net KPI');
    assert.ok(html.includes('Yükseliş'), 'Must show improving trend');
    assert.ok(html.includes('+6'), 'Must show positive delta +6');
    assert.ok(html.includes('id="cockpitGenelExamChart"'), 'Canvas must render for 2+ exams');
});

test('Scenario E: Latest-5 window caps average and trend dataset', () => {
    const student = {
        id: 'std_exam_six',
        adSoyad: 'Alti Denemeli',
        sinif: '8',
        denemeler: [
            { id: 'ex_1', tip: 'genel', denemeAdi: 'E1', tarih: '2026-08-01', toplamSoru: 90, toplamNet: 30.0 },
            { id: 'ex_2', tip: 'genel', denemeAdi: 'E2', tarih: '2026-08-10', toplamSoru: 90, toplamNet: 40.0 },
            { id: 'ex_3', tip: 'genel', denemeAdi: 'E3', tarih: '2026-08-20', toplamSoru: 90, toplamNet: 45.0 },
            { id: 'ex_4', tip: 'genel', denemeAdi: 'E4', tarih: '2026-08-30', toplamSoru: 90, toplamNet: 50.0 },
            { id: 'ex_5', tip: 'genel', denemeAdi: 'E5', tarih: '2026-09-05', toplamSoru: 90, toplamNet: 55.0 },
            { id: 'ex_6', tip: 'genel', denemeAdi: 'E6', tarih: '2026-09-10', toplamSoru: 90, toplamNet: 60.0 }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    const perf = calculateStudentSchoolExamPerformance(student);
    assert.equal(perf.genelSummary.totalCount, 6);
    assert.equal(perf.genelSummary.completedCount, 6);
    assert.equal(perf.genelChronological.length, 5, 'Chronological window must be capped at 5');
    assert.equal(perf.genelSummary.averageNet, 50.0, 'Son 5 Ort must average latest 5 (50.0)');
    assert.equal(perf.genelSummary.latestNet, 60.0);
    assert.equal(perf.genelSummary.maxNet, 60.0);
    assert.equal(perf.genelSummary.trend, 'improving');
});

test('Scenario F: Mixed scale safety keeps 60Q out of 90Q trend', () => {
    const student = {
        id: 'std_mixed_scale',
        adSoyad: 'Farkli Olcekli',
        sinif: '8',
        denemeler: [
            { id: 'ex_old_60', tip: 'genel', denemeAdi: 'Eski 60S', sinif: '7', tarih: '2026-05-01', toplamSoru: 60, toplamNet: 35.0 },
            { id: 'ex_lgs_1', tip: 'genel', denemeAdi: 'LGS 1', sinif: '8', tarih: '2026-09-01', toplamSoru: 90, toplamNet: 44.0 },
            { id: 'ex_lgs_2', tip: 'genel', denemeAdi: 'LGS 2', sinif: '8', tarih: '2026-09-08', toplamSoru: 90, toplamNet: 50.0 }
        ],
        odevler: []
    };

    const perf = calculateStudentSchoolExamPerformance(student);
    assert.equal(perf.genelChronological.length, 2);
    assert.equal(perf.genelChronological[0].toplamNet, 44.0);
    assert.equal(perf.genelChronological[1].toplamNet, 50.0);
    assert.equal(perf.genelSummary.averageNet, 47.0);
});

test('Scenario G: Historical grade safety isolates metadata-less non-90 exam', () => {
    const student = {
        id: 'std_hist_grade',
        adSoyad: 'Gecmis Sinif',
        sinif: '8',
        denemeler: [
            { id: 'ex_unknown_60', tip: 'genel', denemeAdi: 'Deneme 60S', tarih: '2025-10-01', toplamSoru: 60, toplamNet: 30.0 },
            { id: 'ex_curr_90', tip: 'genel', denemeAdi: 'LGS 90S', tarih: '2026-09-05', toplamSoru: 90, toplamNet: 55.0 }
        ],
        odevler: []
    };

    const keyUnknown = getCockpitExamComparabilityKey(student.denemeler[0], student);
    assert.equal(keyUnknown, null, '60-question exam with no grade metadata must have null key');

    const perf = calculateStudentSchoolExamPerformance(student);
    assert.equal(perf.genelChronological.length, 1);
    assert.equal(perf.genelChronological[0].toplamNet, 55.0);
});

test('Scenario H: Compact chart empty states without large canvas', () => {
    const student0 = { id: 's0', sinif: '8', denemeler: [], odevler: [] };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student0]));
    store.globalStudents = [student0];
    renderStudentCockpit('s0', 'home', 'performance', 'exams');
    const html0 = document.getElementById('dynamic-content').innerHTML;
    assert.ok(html0.includes('Henüz genel deneme sonucu yok.'));

    const student1 = { id: 's1', sinif: '8', denemeler: [{ id: 'e1', tip: 'genel', tarih: '2026-09-01', toplamSoru: 90, toplamNet: 45.0 }], odevler: [] };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student1]));
    store.globalStudents = [student1];
    renderStudentCockpit('s1', 'home', 'performance', 'exams');
    const html1 = document.getElementById('dynamic-content').innerHTML;
    assert.ok(html1.includes('Son sonuç: 45 net'));
    assert.ok(html1.includes('Trend için en az 2 genel deneme gerekir.'));
});

test('Scenario I & J: Missing error analysis warning shown only when count > 0', () => {
    const studentWithMissing = {
        id: 'std_missing',
        adSoyad: 'Eksik Analizli',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_1',
                tip: 'branş',
                ders: 'Fen Bilimleri',
                tarih: '2026-09-01',
                sorular: [
                    { soruNo: 1, durum: 'yanlis', konuAdi: 'Mevsimler', hataKodu: null },
                    { soruNo: 2, durum: 'bos', konuAdi: 'Mevsimler', hataKodu: null },
                    { soruNo: 3, durum: 'yanlis', konuAdi: 'Basınç', hataKodu: 'BE' }
                ]
            }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([studentWithMissing]));
    store.globalStudents = [studentWithMissing];

    renderStudentCockpit('std_missing', 'home', 'performance', 'exams');
    let html = document.getElementById('dynamic-content').innerHTML;
    assert.ok(html.includes('Eksik Hata Analizi'), 'Must show warning when missing reasons exist');
    assert.ok(html.includes('2 soru için hata nedeni girilmemiş'), 'Must state exact unassigned count');

    const studentNoMissing = {
        id: 'std_no_missing',
        adSoyad: 'Tam Analizli',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_1',
                tip: 'branş',
                ders: 'Fen Bilimleri',
                tarih: '2026-09-01',
                sorular: [
                    { soruNo: 1, durum: 'yanlis', konuAdi: 'Basınç', hataKodu: 'BE' },
                    { soruNo: 2, durum: 'dogru', konuAdi: 'Basınç', hataKodu: null }
                ]
            }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([studentNoMissing]));
    store.globalStudents = [studentNoMissing];

    renderStudentCockpit('std_no_missing', 'home', 'performance', 'exams');
    html = document.getElementById('dynamic-content').innerHTML;
    assert.ok(!html.includes('Eksik Hata Analizi'), 'Must NOT show warning when count is 0');
});

test('Scenario K: Challenged topics preserve wrong + blank breakdown and frequency', () => {
    const student = {
        id: 'std_topics',
        adSoyad: 'Konu Analizli',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_1',
                tip: 'branş',
                ders: 'Fen Bilimleri',
                tarih: '2026-09-01',
                sorular: [
                    { soruNo: 1, durum: 'yanlis', konuAdi: 'Mevsimlerin Oluşumu', hataKodu: 'BE' },
                    { soruNo: 2, durum: 'yanlis', konuAdi: 'Mevsimlerin Oluşumu', hataKodu: 'D' },
                    { soruNo: 3, durum: 'bos', konuAdi: 'Mevsimlerin Oluşumu', hataKodu: 'ZY' },
                    { soruNo: 4, durum: 'yanlis', konuAdi: 'Basınç', hataKodu: 'BE' }
                ]
            }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_topics', 'home', 'performance', 'exams');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('En Çok Zorlanılan Konular'));
    assert.ok(html.includes('Mevsimlerin Oluşumu'));
    assert.ok(html.includes('2Y'), 'Must show 2 wrong');
    assert.ok(html.includes('1B'), 'Must show 1 blank');
    assert.ok(html.includes('Toplam: 3'), 'Must show total errors 3');
    assert.ok(html.includes('1 farklı denemede tekrar etti'));
});

test('Scenario L & M: Error reasons compact empty state and proportional bars', () => {
    const studentEmpty = {
        id: 'std_err_empty',
        adSoyad: 'Hata Nedensiz',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_1',
                tip: 'branş',
                ders: 'Fen Bilimleri',
                tarih: '2026-09-01',
                sorular: [
                    { soruNo: 1, durum: 'yanlis', konuAdi: 'Basınç', hataKodu: null }
                ]
            }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([studentEmpty]));
    store.globalStudents = [studentEmpty];

    renderStudentCockpit('std_err_empty', 'home', 'performance', 'exams');
    let html = document.getElementById('dynamic-content').innerHTML;
    assert.ok(html.includes('Henüz analiz edilmiş hata kodu bulunmuyor.'));
    assert.ok(html.includes('1 soru için hata analizi bekleniyor.'));

    const studentFilled = {
        id: 'std_err_filled',
        adSoyad: 'Hata Nedenli',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_1',
                tip: 'branş',
                ders: 'Fen Bilimleri',
                tarih: '2026-09-01',
                sorular: [
                    { soruNo: 1, durum: 'yanlis', konuAdi: 'Basınç', hataKodu: 'BE' },
                    { soruNo: 2, durum: 'yanlis', konuAdi: 'Basınç', hataKodu: 'BE' },
                    { soruNo: 3, durum: 'yanlis', konuAdi: 'Basınç', hataKodu: 'BE' },
                    { soruNo: 4, durum: 'yanlis', konuAdi: 'Basınç', hataKodu: 'D' }
                ]
            }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([studentFilled]));
    store.globalStudents = [studentFilled];

    renderStudentCockpit('std_err_filled', 'home', 'performance', 'exams');
    html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('Bilgi Eksikliği'));
    assert.ok(html.includes('3 soru (%75)'));
    assert.ok(html.includes('style="width: 75%;'), 'Must have proportional 75% bar width');
    assert.ok(html.includes('Dikkatsizlik'));
    assert.ok(html.includes('1 soru (%25)'));
    assert.ok(html.includes('style="width: 25%;'), 'Must have proportional 25% bar width');
});

test('Scenario N & O: Compact exam rows preserve Sonucu Gor / Duzenle / Sonuc Gir wiring', () => {
    const student = {
        id: 'std_exam_wiring',
        adSoyad: 'Aksiyonlu',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_done',
                tip: 'genel',
                denemeAdi: 'Tamamlanan LGS 1',
                tarih: '2026-09-05',
                toplamSoru: 90,
                toplamDogru: 60,
                toplamYanlis: 15,
                toplamBos: 15,
                toplamNet: 55.0
            },
            {
                id: 'ex_pend',
                tip: 'branş',
                ders: 'Fen Bilimleri',
                denemeAdi: 'Bekleyen Fen 1',
                tarih: '2026-09-10',
                toplamSoru: 20,
                toplamDogru: 0,
                toplamYanlis: 0,
                toplamBos: 20
            }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_exam_wiring', 'home', 'performance', 'exams');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes("viewExam('std_exam_wiring', 'ex_done')"), 'Must have Sonucu Gor for completed exam');
    assert.ok(html.includes("editExam('std_exam_wiring', 'ex_done')"), 'Must have Duzenle for completed exam');
    assert.ok(html.includes("editExam('std_exam_wiring', 'ex_pend')"), 'Must have Sonuc Gir for pending exam');
    assert.ok(html.includes('Sonuç Bekliyor'), 'Must show pending badge');
    assert.ok(html.includes('Denemeler'), 'Must keep Denemeler panel title');
    assert.ok(html.includes('genel deneme'), 'Must show general-exam secondary count');
});

test('Scenario P: Mobile-safe responsive structure with 44px targets', () => {
    const student = {
        id: 'std_mobile_safe',
        adSoyad: 'Mobil Uyumlu',
        sinif: '8',
        denemeler: [
            { id: 'ex_1', tip: 'genel', denemeAdi: 'Uzun Deneme Basligi LGS Genel Deneme Sinavi', tarih: '2026-09-01', toplamSoru: 90, toplamNet: 44.67 }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_mobile_safe', 'home', 'performance', 'exams');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('min-h-[44px]'), 'Must include 44px min touch targets');
    assert.ok(html.includes('grid-cols-1'), 'Must include responsive 1-column fallback');
    assert.ok(!html.includes('overflow-x-auto') || html.includes('min-w-0') || html.includes('truncate') || html.includes('break-words'), 'Long names must not overflow');
});

test('Scenario Q: Homework performance tab regression intact', () => {
    const student = {
        id: 'std_hw_reg',
        adSoyad: 'Odev Regresyon Test',
        sinif: '8',
        denemeler: [],
        odevler: [
            { id: 'h1', konu: 'Mevsimler', durum: 'tamamlandi', bitisTarihi: '2026-09-01', toplamSoru: 20, dogru: 16, yanlis: 3, bos: 1 },
            { id: 'h2', konu: 'Iklim', durum: 'tamamlandi', bitisTarihi: '2026-09-05', toplamSoru: 20, dogru: 18, yanlis: 1, bos: 1 }
        ]
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_hw_reg', 'home', 'performance', 'homework');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('Ödev Disiplini'), 'Must have Odev Disiplini KPI');
    assert.ok(html.includes('Geciken'), 'Must have Geciken KPI');
    assert.ok(html.includes('Ortalama Başarı'), 'Must have Ortalama Basari KPI');
    assert.ok(html.includes('Ortalama Net'), 'Must have Ortalama Net KPI');
    assert.ok(html.includes('Ödev Performansı'), 'Must have Odev Performansi chart panel');
});

test('Scenario R: Overview tab regression intact', () => {
    const student = {
        id: 'std_overview_reg',
        adSoyad: 'Genel Bakis Regresyon Test',
        sinif: '8',
        hedefNet: 75,
        denemeler: [
            { id: 'e1', tip: 'genel', denemeAdi: 'LGS 1', tarih: '2026-09-01', toplamSoru: 90, toplamNet: 60.0 }
        ],
        odevler: [
            { id: 'h1', konu: 'Mevsimler', durum: 'tamamlandi', bitisTarihi: '2026-09-01', toplamSoru: 20, dogru: 18, yanlis: 2 }
        ]
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_overview_reg', 'home', 'overview');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('Son Deneme'), 'Overview must have Son Deneme KPI');
    assert.ok(html.includes('Ödev Disiplini'), 'Overview must have Odev Disiplini KPI');
    assert.ok(html.includes('Hedefe Kalan'), 'Overview must have Hedefe Kalan KPI');
});

test('Scenario: General vs Fen separation preserved (no cross-contamination)', () => {
    const student = {
        id: 'std_sep',
        adSoyad: 'Ayrim Test',
        sinif: '8',
        denemeler: [
            { id: 'g1', tip: 'genel', denemeAdi: 'LGS 1', tarih: '2026-09-01', toplamSoru: 90, toplamNet: 50.0 },
            {
                id: 'b1',
                tip: 'branş',
                ders: 'Fen Bilimleri',
                denemeAdi: 'Fen 1',
                tarih: '2026-09-02',
                toplamSoru: 20,
                toplamNet: 15.0,
                sorular: [{ soruNo: 1, durum: 'dogru', konuAdi: 'Basınç' }]
            }
        ],
        odevler: []
    };

    const perf = calculateStudentSchoolExamPerformance(student);
    assert.equal(perf.genelSummary.latestNet, 50.0, 'General net must come from genel exam only');
    assert.equal(perf.bransSummary.latestNet, 15.0, 'Branch net must come from brans exam only');
    assert.ok(perf.genelChronological.every(e => e.tip === 'genel'), 'General dataset must contain only genel exams');
    assert.ok(perf.bransChronological.every(e => e.tip === 'branş'), 'Branch dataset must contain only brans exams');
});

// ============================================================================
// PART 4: COMPARABILITY FALLBACK + TREND CONSISTENCY (T1–T7)
// ============================================================================

test('T1: All-null different-scale exams must NOT aggregate into one trend series', () => {
    const student = {
        id: 't1_all_null',
        adSoyad: 'All Null Farkli Olcek',
        sinif: '8',
        denemeler: [
            { id: 'a', tip: 'genel', tarih: '2026-08-01', toplamSoru: 40, toplamNet: 30 },
            { id: 'b', tip: 'genel', tarih: '2026-08-10', toplamSoru: 60, toplamNet: 40 },
            { id: 'c', tip: 'genel', tarih: '2026-08-20', toplamSoru: 75, toplamNet: 50 }
        ],
        odevler: []
    };

    const perf = calculateStudentSchoolExamPerformance(student);
    assert.equal(perf.genelChronological.length, 1, 'All-null scales must produce single-item series (latest only)');
    assert.equal(perf.genelSummary.latestNet, 50, 'Latest exam net preserved');
    assert.equal(perf.genelSummary.trend, null, 'Trend must be null with only 1 comparable exam');
    assert.equal(perf.genelSummary.trendDelta, null, 'Trend delta must be null');
    assert.equal(perf.genelSummary.averageNet, 50, 'Average = that single exam');
    assert.equal(perf.genelSummary.maxNet, 50, 'Max = that single exam');
});

test('T2: Mixed null + known exams isolates null from comparable group', () => {
    const student = {
        id: 't2_mixed',
        adSoyad: 'Karissik Olcek',
        sinif: '8',
        denemeler: [
            { id: 'x', tip: 'genel', tarih: '2026-08-01', toplamSoru: 60, toplamNet: 35 },
            { id: 'y', tip: 'genel', sinif: '8', denemeAdi: 'LGS 1', tarih: '2026-09-01', toplamSoru: 90, toplamNet: 44 },
            { id: 'z', tip: 'genel', sinif: '8', denemeAdi: 'LGS 2', tarih: '2026-09-08', toplamSoru: 90, toplamNet: 50 }
        ],
        odevler: []
    };

    const perf = calculateStudentSchoolExamPerformance(student);
    assert.equal(perf.genelChronological.length, 2, 'Only known-scale exams in comparable set');
    assert.equal(perf.genelChronological[0].toplamNet, 44, 'First comparable = 44');
    assert.equal(perf.genelChronological[1].toplamNet, 50, 'Second comparable = 50');
    assert.equal(perf.genelSummary.averageNet, 47, 'Average of 44+50 = 47');
});

test('T3: Rising contradiction fixture (40→55→50) = Yükseliş +10, NOT Düşüş -5', () => {
    const student = {
        id: 't3_rising',
        adSoyad: 'Yukselen Cakismasi',
        sinif: '8',
        denemeler: [
            { id: 'e1', tip: 'genel', tarih: '2026-08-01', toplamSoru: 90, toplamNet: 40 },
            { id: 'e2', tip: 'genel', tarih: '2026-08-10', toplamSoru: 90, toplamNet: 55 },
            { id: 'e3', tip: 'genel', tarih: '2026-08-20', toplamSoru: 90, toplamNet: 50 }
        ],
        odevler: []
    };

    const perf = calculateStudentSchoolExamPerformance(student);
    assert.equal(perf.genelSummary.trend, 'improving', 'first→last = +10 ≥ 1.25 → improving');
    assert.equal(perf.genelSummary.trendDelta, 10, 'KPI delta must be first→last = +10, NOT last→prev = -5');
    assert.equal(perf.genelSummary.trendLabel, 'Yükseliş', 'Label must match improving trend');
});

test('T4: Falling contradiction fixture (60→48→50) = Düşüş -10, NOT Yükseliş +2', () => {
    const student = {
        id: 't4_falling',
        adSoyad: 'Dusen Cakismasi',
        sinif: '8',
        denemeler: [
            { id: 'f1', tip: 'genel', tarih: '2026-08-01', toplamSoru: 90, toplamNet: 60 },
            { id: 'f2', tip: 'genel', tarih: '2026-08-10', toplamSoru: 90, toplamNet: 48 },
            { id: 'f3', tip: 'genel', tarih: '2026-08-20', toplamSoru: 90, toplamNet: 50 }
        ],
        odevler: []
    };

    const perf = calculateStudentSchoolExamPerformance(student);
    assert.equal(perf.genelSummary.trend, 'declining', 'first→last = -10 ≤ -1.25 → declining');
    assert.equal(perf.genelSummary.trendDelta, -10, 'KPI delta must be first→last = -10, NOT last→prev = +2');
    assert.equal(perf.genelSummary.trendLabel, 'Düşüş', 'Label must match declining trend');
});

test('T5: Stable threshold consistency (50→51→50.8) = Stabil +0,8', () => {
    const student = {
        id: 't5_stable',
        adSoyad: 'Stabil Esik',
        sinif: '8',
        denemeler: [
            { id: 's1', tip: 'genel', tarih: '2026-08-01', toplamSoru: 90, toplamNet: 50 },
            { id: 's2', tip: 'genel', tarih: '2026-08-10', toplamSoru: 90, toplamNet: 51 },
            { id: 's3', tip: 'genel', tarih: '2026-08-20', toplamSoru: 90, toplamNet: 50.8 }
        ],
        odevler: []
    };

    const perf = calculateStudentSchoolExamPerformance(student);
    assert.equal(perf.genelSummary.trend, 'stable', 'first→last = +0.8, within ±1.25 → stable');
    assert.equal(perf.genelSummary.trendDelta, 0.8, 'Delta = first→last = +0.8');
    assert.equal(perf.genelSummary.trendLabel, 'Stabil', 'Label must be Stabil');
});

test('T6: Header/count semantics — totalCount vs completedCount vs comparableCount', () => {
    const student = {
        id: 't6_count',
        adSoyad: 'Sayi Tutarliligi',
        sinif: '8',
        denemeler: [
            { id: 'u1', tip: 'genel', tarih: '2026-05-01', toplamSoru: 60, toplamNet: 35 },
            { id: 'u2', tip: 'genel', sinif: '8', tarih: '2026-09-01', toplamSoru: 90, toplamNet: 44 },
            { id: 'u3', tip: 'genel', sinif: '8', tarih: '2026-09-08', toplamSoru: 90, toplamNet: 50 }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    const perf = calculateStudentSchoolExamPerformance(student);
    assert.equal(perf.genelSummary.totalCount, 3, 'totalCount = all genel exams');
    assert.equal(perf.genelSummary.completedCount, 3, 'completedCount = all completed genel');
    assert.equal(perf.genelSummary.comparableCount, 2, 'comparableCount = only known-scale exams');
    assert.equal(perf.genelChronological.length, 2, 'Chart/KPI window = comparable only');

    renderStudentCockpit('t6_count', 'home', 'performance', 'exams');
    const html = document.getElementById('dynamic-content').innerHTML;
    assert.ok(html.includes('3 kayıt'), 'Mixed-scale header must show total completed count');
    assert.ok(html.includes('2 karşılaştırılabilir'), 'Mixed-scale header must show comparable count');
    assert.ok(!html.includes('>3 Deneme<'), 'Mixed-scale header must NOT show silent "3 Deneme"');
});

test('T7: Branch logic untouched — fen branch data stays separate from genel', () => {
    const student = {
        id: 't7_branch',
        adSoyad: 'Brans Dokunulmazligi',
        sinif: '8',
        denemeler: [
            { id: 'g1', tip: 'genel', tarih: '2026-09-01', toplamSoru: 90, toplamNet: 50 },
            {
                id: 'b1', tip: 'branş', ders: 'Fen Bilimleri', denemeAdi: 'Fen 1',
                tarih: '2026-09-02', toplamSoru: 20, toplamNet: 15,
                sorular: [{ soruNo: 1, durum: 'dogru', konuAdi: 'Basınç' }]
            }
        ],
        odevler: []
    };

    const perf = calculateStudentSchoolExamPerformance(student);
    assert.equal(perf.genelSummary.latestNet, 50, 'Genel latest from genel exam only');
    assert.equal(perf.bransSummary.latestNet, 15, 'Branş latest from brans exam only');
    assert.ok(perf.genelChronological.every(e => e.tip === 'genel'), 'Genel set: genel only');
    assert.ok(perf.bransChronological.every(e => e.tip === 'branş'), 'Branş set: brans only');
    assert.equal(perf.bransSummary.completedCount, 1, 'Branş completedCount unchanged');
    assert.equal(perf.genelSummary.totalCount, 1, 'Genel totalCount unchanged');
});

// ============================================================================
// PART 5: HEADER BADGE SEMANTICS (H1–H5)
// ============================================================================

function getHeaderBadge(student) {
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];
    renderStudentCockpit(student.id, 'home', 'performance', 'exams');
    const html = document.getElementById('dynamic-content').innerHTML;
    const m = html.match(/bg-blue-50[^>]*>([^<]+)/);
    return m ? m[1].trim() : 'NOT FOUND';
}

test('H1: One exam — header badge = "1 Deneme"', () => {
    const badge = getHeaderBadge({
        id: 'h1_one', sinif: '8',
        denemeler: [{ id: 'e1', tip: 'genel', sinif: '8', tarih: '2026-09-01', toplamSoru: 90, toplamNet: 50 }],
        odevler: []
    });
    assert.equal(badge, '1 Deneme');
});

test('H2: All comparable — header badge = "3 Deneme"', () => {
    const badge = getHeaderBadge({
        id: 'h2_all', sinif: '8',
        denemeler: [
            { id: 'e1', tip: 'genel', sinif: '8', tarih: '2026-08-01', toplamSoru: 90, toplamNet: 40 },
            { id: 'e2', tip: 'genel', sinif: '8', tarih: '2026-09-01', toplamSoru: 90, toplamNet: 50 },
            { id: 'e3', tip: 'genel', sinif: '8', tarih: '2026-09-08', toplamSoru: 90, toplamNet: 55 }
        ],
        odevler: []
    });
    assert.equal(badge, '3 Deneme');
});

test('H3: Mixed scale — header badge = "3 kayıt · 2 karşılaştırılabilir"', () => {
    const badge = getHeaderBadge({
        id: 'h3_mixed', sinif: '8',
        denemeler: [
            { id: 'a', tip: 'genel', sinif: '7', tarih: '2026-05-01', toplamSoru: 60, toplamNet: 35 },
            { id: 'b', tip: 'genel', sinif: '8', tarih: '2026-09-01', toplamSoru: 90, toplamNet: 44 },
            { id: 'c', tip: 'genel', sinif: '8', tarih: '2026-09-08', toplamSoru: 90, toplamNet: 50 }
        ],
        odevler: []
    });
    assert.equal(badge, '3 kayıt · 2 karşılaştırılabilir');
});

test('H4: Pending exists, all comparable completed — header badge = "1 / 2 Deneme"', () => {
    const badge = getHeaderBadge({
        id: 'h4_pending', sinif: '8',
        denemeler: [
            { id: 'e1', tip: 'genel', sinif: '8', tarih: '2026-09-01', toplamSoru: 90, toplamNet: 50 },
            { id: 'e2', tip: 'genel', sinif: '8', tarih: '2026-09-08', toplamSoru: 90, toplamDogru: 0, toplamYanlis: 0, toplamBos: 90, toplamNet: 0 }
        ],
        odevler: []
    });
    assert.equal(badge, '1 / 2 Deneme');
});

test('H5: Pending + mixed comparability — header shows both contexts', () => {
    const badge = getHeaderBadge({
        id: 'h5_pending_mixed', sinif: '8',
        denemeler: [
            { id: 'a', tip: 'genel', sinif: '7', tarih: '2026-05-01', toplamSoru: 60, toplamNet: 35 },
            { id: 'b', tip: 'genel', sinif: '8', tarih: '2026-09-01', toplamSoru: 90, toplamNet: 44 },
            { id: 'c', tip: 'genel', sinif: '8', tarih: '2026-09-08', toplamSoru: 90, toplamNet: 50 },
            { id: 'd', tip: 'genel', sinif: '8', tarih: '2026-09-15', toplamSoru: 90, toplamDogru: 0, toplamYanlis: 0, toplamBos: 90, toplamNet: 0 }
        ],
        odevler: []
    });
    assert.equal(badge, '3 / 4 tamamlandı · 2 karşılaştırılabilir');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHomeworkErrorTopics,
  normalizeHomeworkErrorAnalysis,
  validateErrorAnalysisTotal,
  normalizeHataNedeniLabel,
  normalizeHataNedeniKey,
  getUnitsAndTopicsBySinifAndDers,
  getUnitListBySinifAndDers,
  getTopicsForUnit,
  HATA_NEDENLERI
} from '../homework-error-topics.js';
import { getCockpitData } from '../student-cockpit-insights.js';
import { buildHomeworkReportData } from '../homework-report-insights.js';

test('curriculum: returns correct unit list for 8th grade science', () => {
  const units = getUnitListBySinifAndDers('8', 'Fen Bilimleri');
  assert.ok(units.includes('Basınç'));
  assert.ok(units.includes('DNA ve Genetik Kod'));
  assert.ok(units.includes('Mevsimler ve İklim'));
  assert.ok(units.includes('Basit Makineler'));
});

test('curriculum: returns correct topics for a specific unit', () => {
  const topics = getTopicsForUnit('8', 'Fen Bilimleri', 'Basınç');
  assert.deepEqual(topics, ['Katı Basıncı', 'Sıvı Basıncı', 'Gaz Basıncı']);

  const mathTopics = getTopicsForUnit('8', 'Matematik', 'Çarpanlar ve Katlar / Üslü İfadeler');
  assert.ok(mathTopics.includes('Çarpanlar ve Katlar (EBOB-EKOK)'));
});

test('curriculum: grade filter separates 5th, 6th, 7th and 8th grades properly', () => {
  const grade5Units = getUnitListBySinifAndDers('5', 'Fen Bilimleri');
  const grade8Units = getUnitListBySinifAndDers('8', 'Fen Bilimleri');

  assert.ok(grade5Units.includes('Güneş, Dünya ve Ay'));
  assert.ok(!grade5Units.includes('Basınç')); // Grade 5 does not have LGS Basınç unit

  assert.ok(grade8Units.includes('Basınç'));
  assert.ok(!grade8Units.includes('Güneş, Dünya ve Ay'));
});

test('zero wrong answers create no error-topic record', () => {
  assert.deepEqual(buildHomeworkErrorTopics({ homeworkType: 'Konu Denemesi', assignedTopic: 'Basınç', wrong: 0 }), []);
});

test('reads legacy yanlisKonular format safely without errors or migration (Scenario A)', () => {
  const legacyRecord = {
    yanlisKonular: [
      { konu: 'Katı Basıncı', altKonu: 'Piezometre', adet: 3 },
      { topic: 'Sıvı Basıncı', count: 2 }
    ]
  };

  const normalized = normalizeHomeworkErrorAnalysis(legacyRecord);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].unite, 'Katı Basıncı');
  assert.equal(normalized[0].konu, 'Piezometre');
  assert.equal(normalized[0].altKonu, 'Piezometre');
  assert.equal(normalized[0].adet, 3);
  assert.deepEqual(normalized[0].hataNedenleri, []);
  assert.deepEqual(normalized[0].hataNedenleriKeys, []);

  assert.equal(normalized[1].unite, 'Sıvı Basıncı');
  assert.equal(normalized[1].konu, 'Sıvı Basıncı');
  assert.equal(normalized[1].adet, 2);
});

test('reads new rich error format with unite, konu, multiple error causes (Scenario B)', () => {
  const richRecord = {
    yanlisKonular: [
      {
        unite: 'Basınç',
        konu: 'Katı Basıncı',
        adet: 2,
        hataNedenleri: ['bilgi_eksikligi', 'Dikkatsizlik']
      }
    ]
  };

  const normalized = normalizeHomeworkErrorAnalysis(richRecord);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].unite, 'Basınç');
  assert.equal(normalized[0].konu, 'Katı Basıncı');
  assert.equal(normalized[0].adet, 2);
  assert.deepEqual(normalized[0].hataNedenleri, ['Bilgi Eksikliği', 'Dikkatsizlik']);
  assert.deepEqual(normalized[0].hataNedenleriKeys, ['bilgi_eksikligi', 'dikkatsizlik']);
});

test('canonical storage: saves unite, konu and canonical keys in hataNedenleri array', () => {
  const saved = buildHomeworkErrorTopics({
    wrong: 4,
    entries: [
      {
        unite: 'Basınç',
        konu: 'Katı Basıncı',
        adet: 2,
        hataNedenleri: ['Bilgi Eksikliği', 'dikkatsizlik']
      },
      {
        unite: 'Basınç',
        konu: 'Sıvı Basıncı',
        adet: 2,
        hataNedenleri: ['Soruyu Yanlış Okuma']
      }
    ]
  });

  assert.equal(saved.length, 2);
  assert.equal(saved[0].unite, 'Basınç');
  assert.equal(saved[0].konu, 'Katı Basıncı');
  assert.deepEqual(saved[0].hataNedenleri, ['bilgi_eksikligi', 'dikkatsizlik']);

  assert.equal(saved[1].unite, 'Basınç');
  assert.equal(saved[1].konu, 'Sıvı Basıncı');
  assert.deepEqual(saved[1].hataNedenleri, ['yanlis_okuma']);
});

test('mixed data normalization: labels, keys, and short codes normalize to unified keys and labels', () => {
  const mixed = normalizeHomeworkErrorAnalysis([
    {
      unite: 'DNA ve Genetik Kod',
      konu: 'Kalıtım',
      adet: 2,
      hataNedenleri: ['Bilgi Eksikliği', 'dikkatsizlik', 'ZY', 'islem_hatasi']
    }
  ]);

  assert.deepEqual(mixed[0].hataNedenleriKeys, ['bilgi_eksikligi', 'dikkatsizlik', 'sure_yetmedi', 'islem_hatasi']);
  assert.deepEqual(mixed[0].hataNedenleri, ['Bilgi Eksikliği', 'Dikkatsizlik', 'Süre Yetmedi', 'İşlem Hatası']);
});

test('analytics aggregation: label and key aggregate into the same canonical bucket in cockpit', () => {
  const student = {
    id: 's1',
    adSoyad: 'Ali Veli',
    sinif: '8',
    hedefNet: 75,
    denemeler: [
      {
        id: 'd1',
        tur: 'Genel Deneme',
        tarih: '2026-08-20',
        toplamNet: 70,
        sorular: [
          { durum: 'yanlis', hataKodu: 'Bilgi Eksikliği' },
          { durum: 'yanlis', hataKodu: 'BE' }
        ]
      }
    ],
    odevler: [
      {
        id: 'hw1',
        durum: 'tamamlandi',
        dogru: 18,
        yanlis: 2,
        yanlisKonular: [
          { unite: 'Basınç', konu: 'Katı Basıncı', adet: 2, hataNedenleri: ['bilgi_eksikligi'] }
        ]
      }
    ]
  };

  const cockpit = getCockpitData({
    student,
    homeworks: student.odevler,
    summary: { latestNet: 70, upcomingLesson: null, homeworkCompletionRate: 100, homeworkCount: 1, completedHomeworkCount: 1 },
    analysis: { strongestSubject: null, weakestSubject: null, priorityTopics: [] }
  });

  assert.ok(cockpit.mostFrequentError);
  assert.equal(cockpit.mostFrequentError.key, 'bilgi_eksikligi');
  assert.equal(cockpit.mostFrequentError.label, 'Bilgi Eksikliği');
  assert.equal(cockpit.mostFrequentError.count, 4); // 1 + 1 from exam, 2 from homework
});

test('validates error analysis totals against general wrong count', () => {
  const items = [
    { unite: 'Basınç', konu: 'Katı Basıncı', adet: 2 },
    { unite: 'Basınç', konu: 'Sıvı Basıncı', adet: 3 }
  ];

  const valid = validateErrorAnalysisTotal(items, 6);
  assert.equal(valid.isValid, true);
  assert.equal(valid.sum, 5);

  const invalid = validateErrorAnalysisTotal(items, 4);
  assert.equal(invalid.isValid, false);
  assert.equal(invalid.sum, 5);
});

// ==================== UX-05.5 SPECIFIC TESTS ====================

test('UX-05.5 Scenario A: legacy homework without error analysis can have analysis added post-completion', () => {
  const legacyHw = {
    id: 'hw_legacy',
    durum: 'tamamlandi',
    dogru: 32,
    yanlis: 6,
    toplamSoru: 40,
    yanlisKonular: [] // initially empty
  };

  // Normalization on empty returns empty list ready for user to add rows
  const initial = normalizeHomeworkErrorAnalysis(legacyHw);
  assert.deepEqual(initial, []);

  // Teacher adds 2 error rows post-completion
  const updatedErrorTopics = buildHomeworkErrorTopics({
    wrong: 6,
    entries: [
      { unite: 'Basınç', konu: 'Katı Basıncı', adet: 4, hataNedenleri: ['bilgi_eksikligi'] },
      { unite: 'Basınç', konu: 'Sıvı Basıncı', adet: 2, hataNedenleri: ['dikkatsizlik'] }
    ]
  });

  legacyHw.yanlisKonular = updatedErrorTopics;
  const postEdit = normalizeHomeworkErrorAnalysis(legacyHw);
  assert.equal(postEdit.length, 2);
  assert.equal(postEdit[0].unite, 'Basınç');
  assert.equal(postEdit[0].konu, 'Katı Basıncı');
  assert.equal(postEdit[0].adet, 4);
  assert.deepEqual(postEdit[0].hataNedenleriKeys, ['bilgi_eksikligi']);
  assert.equal(postEdit[1].konu, 'Sıvı Basıncı');
  assert.equal(postEdit[1].adet, 2);
  assert.deepEqual(postEdit[1].hataNedenleriKeys, ['dikkatsizlik']);
});

test('UX-05.5 Scenario B: existing analysis is normalized and prefilled for editing', () => {
  const existingHw = {
    id: 'hw_existing',
    durum: 'tamamlandi',
    dogru: 34,
    yanlis: 4,
    yanlisKonular: [
      { unite: 'Basınç', konu: 'Katı Basıncı', adet: 2, hataNedenleri: ['bilgi_eksikligi', 'dikkatsizlik'] },
      { unite: 'Basınç', konu: 'Gaz Basıncı', adet: 2, hataNedenleri: ['islem_hatasi'] }
    ]
  };

  const prefill = normalizeHomeworkErrorAnalysis(existingHw);
  assert.equal(prefill.length, 2);
  assert.equal(prefill[0].unite, 'Basınç');
  assert.equal(prefill[0].konu, 'Katı Basıncı');
  assert.equal(prefill[0].adet, 2);
  assert.deepEqual(prefill[0].hataNedenleriKeys, ['bilgi_eksikligi', 'dikkatsizlik']);
  assert.deepEqual(prefill[0].hataNedenleri, ['Bilgi Eksikliği', 'Dikkatsizlik']);
});

test('UX-05.5 Scenario C: multiple error causes can be edited and stored as canonical keys', () => {
  const editedEntries = [
    {
      unite: 'DNA ve Genetik Kod',
      konu: 'Kalıtım',
      adet: 3,
      hataNedenleri: ['bilgi_eksikligi', 'dikkatsizlik', 'yanlis_okuma']
    }
  ];

  const saved = buildHomeworkErrorTopics({ wrong: 3, entries: editedEntries });
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0].hataNedenleri, ['bilgi_eksikligi', 'dikkatsizlik', 'yanlis_okuma']);
});

test('UX-05.5 Scenario D: validation prevents saving when total analyzed exceeds general wrong count', () => {
  const entries = [
    { unite: 'Basınç', konu: 'Katı Basıncı', adet: 4 },
    { unite: 'Basınç', konu: 'Sıvı Basıncı', adet: 3 } // total = 7
  ];

  const check = validateErrorAnalysisTotal(entries, 6);
  assert.equal(check.isValid, false);
  assert.equal(check.sum, 7);
  assert.equal(check.exceededBy, 1);
});

test('UX-05.5 Scenario E: when wrong count becomes 0, error analysis is cleared', () => {
  const cleared = buildHomeworkErrorTopics({
    wrong: 0,
    entries: [
      { unite: 'Basınç', konu: 'Katı Basıncı', adet: 2, hataNedenleri: ['bilgi_eksikligi'] }
    ]
  });

  assert.deepEqual(cleared, []);
});

test('UX-05.5 Scenario F: PDF report generator reflects edited error topics and reasons', () => {
  const student = { id: 's1', adSoyad: 'Zeynep Kaya', sinif: '8' };
  const homework = {
    id: 'hw1',
    konu: 'Basınç',
    yayin: 'CanFenci',
    durum: 'tamamlandi',
    dogru: 36,
    yanlis: 4,
    yanlisKonular: [
      { unite: 'Basınç', konu: 'Katı Basıncı', adet: 2, hataNedenleri: ['bilgi_eksikligi'] },
      { unite: 'Basınç', konu: 'Sıvı Basıncı', adet: 2, hataNedenleri: ['dikkatsizlik'] }
    ]
  };

  const reportData = buildHomeworkReportData({
    student,
    homework,
    teacherProfile: { name: 'Murat Canbaş', school: 'CanFenci Akademi' }
  });

  assert.equal(reportData.yanlisKonular.length, 2);
  assert.equal(reportData.yanlisKonular[0].unite, 'Basınç');
  assert.equal(reportData.yanlisKonular[0].konu, 'Katı Basıncı');
  assert.deepEqual(reportData.yanlisKonular[0].hataNedenleri, ['Bilgi Eksikliği']);
});

test('UX-05.5 Scenario G: Cockpit mostFrequentError recalculates dynamically after error topic edit', () => {
  const student = {
    id: 's1',
    adSoyad: 'Mert Yılmaz',
    sinif: '8',
    hedefNet: 80,
    denemeler: [],
    odevler: [
      {
        id: 'hw1',
        durum: 'tamamlandi',
        dogru: 30,
        yanlis: 4,
        yanlisKonular: [
          { unite: 'Basınç', konu: 'Katı Basıncı', adet: 4, hataNedenleri: ['dikkatsizlik'] }
        ]
      }
    ]
  };

  let cockpit = getCockpitData({
    student,
    homeworks: student.odevler,
    summary: { latestNet: 75, upcomingLesson: null, homeworkCompletionRate: 100, homeworkCount: 1, completedHomeworkCount: 1 },
    analysis: { strongestSubject: null, weakestSubject: null, priorityTopics: [] }
  });

  assert.equal(cockpit.mostFrequentError.key, 'dikkatsizlik');
  assert.equal(cockpit.mostFrequentError.count, 4);

  // Edit homework errors: change to bilgi_eksikligi
  student.odevler[0].yanlisKonular = [
    { unite: 'Basınç', konu: 'Katı Basıncı', adet: 4, hataNedenleri: ['bilgi_eksikligi'] }
  ];

  cockpit = getCockpitData({
    student,
    homeworks: student.odevler,
    summary: { latestNet: 75, upcomingLesson: null, homeworkCompletionRate: 100, homeworkCount: 1, completedHomeworkCount: 1 },
    analysis: { strongestSubject: null, weakestSubject: null, priorityTopics: [] }
  });

  assert.equal(cockpit.mostFrequentError.key, 'bilgi_eksikligi');
  assert.equal(cockpit.mostFrequentError.count, 4);
});

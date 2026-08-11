import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readProjectFile = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Firestore rules require verified ownership and contain no public homework access', async () => {
  const rules = await readProjectFile('firestore.rules');

  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /request\.resource\.data\.userId == resource\.data\.userId/);
  assert.doesNotMatch(rules, /allow\s+(read|update|write)[^:]*:\s*if\s+true/);
});

test('authentication errors never embed a password in generated HTML', async () => {
  const auth = await readProjectFile('auth.js');

  assert.doesNotMatch(auth, /resendVerificationEmail\([^)]*password/);
  assert.doesNotMatch(auth, /password\.replace/);
});

test('public homework links are disabled and are not included in reminders', async () => {
  const [index, homework] = await Promise.all([
    readProjectFile('index.html'),
    readProjectFile('homework.js')
  ]);

  assert.match(index, /herkese açık ödev sonuç bağlantıları kapatıldı/);
  assert.doesNotMatch(homework, /D\/Y Sonuç Giriş Bağlantısı/);
  assert.doesNotMatch(homework, /aşağıdaki güvenli bağlantıyı kullanabilirsiniz/);
});

test('service worker only runtime-caches same-origin requests without query data', async () => {
  const serviceWorker = await readProjectFile('sw.js');

  assert.match(serviceWorker, /requestUrl\.origin !== self\.location\.origin/);
  assert.match(serviceWorker, /requestUrl\.search/);
  assert.doesNotMatch(serviceWorker, /ASSETS_TO_CACHE[\s\S]*https:\/\//);
});

test('student deletion includes dependent cloud records', async () => {
  const students = await readProjectFile('students.js');

  assert.match(students, /collection\("schedules"\)\.doc\(id\)/);
  assert.match(students, /collection\("lessons"\)\.doc\(id\)/);
  assert.match(students, /collection\("homeworks"\)/);
  assert.match(students, /await batch\.commit\(\)/);
});

test('development builds default to local-only storage', async () => {
  const [firebaseConfig, store] = await Promise.all([
    readProjectFile('firebase-config.js'),
    readProjectFile('store.js')
  ]);

  assert.match(firebaseConfig, /const CLOUD_FEATURES_ENABLED = false/);
  assert.match(firebaseConfig, /if \(!CLOUD_FEATURES_ENABLED \|\| store\.isSyncInitialized/);
  assert.match(store, /useFirestore: false/);
});

test('first use requires a complete local teacher profile that remains editable in settings', async () => {
  const [index, profile, students, serviceWorker] = await Promise.all([
    readProjectFile('index.html'),
    readProjectFile('teacher-profile.js'),
    readProjectFile('students.js'),
    readProjectFile('sw.js')
  ]);

  assert.match(index, /ensureTeacherProfile/);
  assert.match(profile, /Öğretmen Profilinizi Oluşturun/);
  assert.match(profile, /adınızı ve soyadınızı birlikte yazın/);
  assert.match(profile, /çalıştığınız okul veya kurumun adını yazın/);
  assert.match(profile, /en az bir dersi seçin/);
  assert.match(profile, /teacher_profile_completed_v1/);
  assert.match(profile, /name === 'Öğretmen Adı'/);
  assert.match(profile, /school === 'Belirtilmemiş Okul'/);
  assert.match(students, /saveTeacherProfileFromSettings/);
  assert.match(serviceWorker, /teacher-profile\.js/);
});

test('student progress UI includes timeline and upcoming lesson surfaces', async () => {
  const [students, serviceWorker] = await Promise.all([
    readProjectFile('students.js'),
    readProjectFile('sw.js')
  ]);

  assert.match(students, /Öğrenci Gelişim Merkezi/);
  assert.match(students, /Zaman Çizelgesi/);
  assert.match(students, /Yaklaşan ders/);
  assert.match(serviceWorker, /student-insights\.js/);
});

test('student detail includes explainable smart exam analysis', async () => {
  const students = await readProjectFile('students.js');

  assert.match(students, /Akıllı Deneme Analizi/);
  assert.match(students, /Ders Bazlı Son 5 Deneme/);
  assert.match(students, /Öncelikli Konular/);
  assert.match(students, /Veri tutarlılığı uyarıları/);
});

test('student pricing is presented as a per-lesson fee with legacy data fallback', async () => {
  const students = await readProjectFile('students.js');
  const finance = await readProjectFile('finance.js');
  const store = await readProjectFile('store.js');

  assert.doesNotMatch(students, /Aylık Ücret/);
  assert.match(students, /Bir Ders Ücreti/);
  assert.match(finance, /s\.dersUcreti/);
  assert.match(store, /dersUcreti: s\.dersUcreti \|\| s\.aylikUcret \|\| s\.ucret/);
});

test('lesson reminders require user action for WhatsApp and avoid duplicate notifications', async () => {
  const reminders = await readProjectFile('lesson-reminders.js');
  const serviceWorker = await readProjectFile('sw.js');

  assert.match(reminders, /Notification\.permission === 'granted'/);
  assert.match(reminders, /isNotified/);
  assert.match(reminders, /!reminder\.isDue/);
  assert.match(reminders, /markLessonReminderSent/);
  assert.match(reminders, /window\.open\(url, '_blank'/);
  assert.doesNotMatch(reminders, /fetch\([^)]*api\.whatsapp/);
  assert.match(reminders, /WhatsApp’tan Gönder/);
  assert.match(reminders, /Güvenlik nedeniyle WhatsApp gönderimi/);
  assert.match(reminders, /Ders başlamadan 2 saat önce/);
  assert.match(serviceWorker, /lesson-reminders\.js/);
});

test('finance excludes cancelled and excused lessons from billing', async () => {
  const finance = await readProjectFile('finance.js');
  const serviceWorker = await readProjectFile('sw.js');
  assert.match(finance, /calculateLessonFinance/);
  assert.match(finance, /Katılım Durumu/);
  assert.match(finance, /Ücret Yok/);
  assert.match(serviceWorker, /lesson-finance-insights\.js/);
});

test('release hardening adds validation, keyboard navigation and fresh core assets', async () => {
  const index = await readProjectFile('index.html');
  const students = await readProjectFile('students.js');
  const serviceWorker = await readProjectFile('sw.js');
  assert.match(index, /Ana içeriğe geç/);
  assert.match(index, /<main id="dynamic-content"/);
  assert.match(students, /validateStudentInput/);
  assert.match(serviceWorker, /isFreshnessCritical/);
  assert.match(serviceWorker, /data-validation\.js/);
});

test('settings navigation owns the all-student reminder center', async () => {
  const index = await readProjectFile('index.html');
  const students = await readProjectFile('students.js');
  const schedule = await readProjectFile('schedule.js');
  assert.match(index, /sidebar-nav-general[^>]+>[\s\S]*Ayarlar/);
  assert.match(students, /renderLessonReminderCenter/);
  assert.match(students, /> Ayarlar/);
  assert.doesNotMatch(schedule, /renderLessonReminderCenter/);
});

test('home and settings are separate navigation destinations', async () => {
  const index = await readProjectFile('index.html');
  const students = await readProjectFile('students.js');
  assert.match(index, /sidebar-nav-reminders[^>]+renderReminderHome/);
  assert.match(index, /sidebar-nav-general[^>]+renderGenelIslemler/);
  assert.match(students, /function renderReminderHome/);
  assert.match(students, /mobile-nav-reminders/);
  assert.match(students, /<i class="fas fa-cog text-slate-500"><\/i> Ayarlar/);
});

test('lesson records link to the canonical homework workflow without duplicate entry fields', async () => {
  const [finance, homework, store] = await Promise.all([
    readProjectFile('finance.js'),
    readProjectFile('homework.js'),
    readProjectFile('store.js')
  ]);

  assert.match(finance, /openHomeworkForLesson/);
  assert.match(finance, /Bağlantılı Ödev/);
  assert.doesNotMatch(finance, /id="yeniOdev"/);
  assert.doesNotMatch(finance, /window\.addOdevToList/);
  assert.match(homework, /kaynakDers/);
  assert.match(homework, /Ders kaydına bağlı ödev/);
  assert.match(store, /odevler: Array\.isArray\(s\.odevler\) \? s\.odevler : \[\]/);
});

test('future lesson records default to planned attendance and schedule labels omit school names', async () => {
  const [finance, attendance, schedule] = await Promise.all([
    readProjectFile('finance.js'),
    readProjectFile('lesson-finance-insights.js'),
    readProjectFile('schedule.js')
  ]);

  assert.match(attendance, /planlandi: 'Planlandı \/ Henüz İşlenmedi'/);
  assert.match(finance, /Ders önceden giriliyorsa “Planlandı” olarak bırakın/);
  assert.doesNotMatch(schedule, /escapeHtml\(s\.adSoyad\)\} \(\$\{escapeHtml\(s\.okul\)\}\)/);
});

test('lesson attendance and payment statuses are editable with inline dropdowns', async () => {
  const finance = await readProjectFile('finance.js');
  assert.match(finance, /updateDersKatilimDurumu/);
  assert.match(finance, /updateDersUcretDurumu/);
  assert.match(finance, /<select id="attendance-/);
  assert.match(finance, /<select id="payment-/);
  assert.match(finance, /Durum \(Ücret\)/);
  assert.match(finance, />Bekliyor<\/option>/);
  assert.match(finance, />Ödendi<\/option>/);
  assert.doesNotMatch(finance, /confirm\("Ödendi mi\?/);
});

test('lesson editing uses an expandable inline form instead of browser prompts', async () => {
  const finance = await readProjectFile('finance.js');
  assert.match(finance, /toggleDersKayitEditor/);
  assert.match(finance, /saveDersKayitEditor/);
  assert.match(finance, /Değişiklikleri Kaydet/);
  assert.match(finance, /Vazgeç/);
  assert.match(finance, /edit-date-/);
  assert.match(finance, /edit-subject-/);
  assert.match(finance, /edit-topic-/);
  assert.doesNotMatch(finance, /prompt\("Tarih/);
  assert.doesNotMatch(finance, /prompt\("Konu/);
  assert.doesNotMatch(finance, /prompt\("İçerik/);
});

test('lesson-linked topic homework results feed topic exam progress', async () => {
  const [homework, exams, students, serviceWorker] = await Promise.all([
    readProjectFile('homework.js'),
    readProjectFile('exams.js'),
    readProjectFile('students.js'),
    readProjectFile('sw.js')
  ]);
  assert.match(homework, /odevTurSelect'\)\.value = 'Konu Denemesi'/);
  assert.match(homework, /calculateTopicTestNet/);
  assert.match(exams, />🔬 Konu Denemesi<\/button>/);
  assert.match(exams, /bransKonuAdi/);
  assert.match(students, /calculateTopicExamProgress/);
  assert.match(students, /Ort\. Doğru/);
  assert.match(students, /Ort\. Yanlış/);
  assert.match(students, /Ort\. Net/);
  assert.match(serviceWorker, /topic-exam-insights\.js/);
});

test('weekly schedule prevents conflicts across different students', async () => {
  const [schedule, serviceWorker] = await Promise.all([
    readProjectFile('schedule.js'),
    readProjectFile('sw.js')
  ]);
  assert.match(schedule, /findScheduleConflict/);
  assert.match(schedule, /getAllSchedulesByStudent/);
  assert.match(schedule, /buildScheduleConflictMessage/);
  assert.match(serviceWorker, /schedule-conflicts\.js/);
});

test('grade-specific resource books are selectable with a manual fallback', async () => {
  const [students, homework, exams, finance, serviceWorker] = await Promise.all([
    readProjectFile('students.js'), readProjectFile('homework.js'), readProjectFile('exams.js'), readProjectFile('finance.js'), readProjectFile('sw.js')
  ]);
  assert.match(students, /Kaynak Kitaplar/);
  assert.match(homework, /odevYayinSelect/);
  assert.match(exams, /bransKaynak/);
  assert.match(finance, /kayitKaynak/);
  assert.match(serviceWorker, /resource-books\.js/);
});

test('homework results capture main and optional subtopic errors', async () => {
  const [homework, students, serviceWorker] = await Promise.all([
    readProjectFile('homework.js'), readProjectFile('students.js'), readProjectFile('sw.js')
  ]);
  assert.match(homework, /Yanlış Yapılan Ana Konu/);
  assert.match(homework, /Alt Konu/);
  assert.match(homework, /manualWrongSubtopicText/);
  assert.doesNotMatch(homework, /id="manualWrongSubtopic"/);
  assert.match(homework, /yanlisKonular/);
  assert.match(students, /Alt Konu Hataları/);
  assert.match(serviceWorker, /homework-error-topics\.js/);
});

test('homework type separates activity from resource-book identity', async () => {
  const homework = await readProjectFile('homework.js');
  const typeSelect = homework.match(/<select id="odevTurSelect"[\s\S]*?<\/select>/)?.[0] || '';
  assert.doesNotMatch(typeSelect, /Soru Bankası/);
  assert.match(typeSelect, /<option value="Konu Tekrarı" selected>/);
});

test('homework assignment requires a resource work detail', async () => {
  const homework = await readProjectFile('homework.js');
  assert.match(homework, /id="odevCalismaDetayi"/);
  assert.match(homework, /1\. Deneme, Test 24-25 veya Sayfa 40-45/);
  assert.match(homework, /calismaDetayi,/);
  assert.match(homework, /kaynak ve çalışma detayı/);
});

test('homework tracking includes unified test and topic-exam performance chart', async () => {
  const [homework, serviceWorker] = await Promise.all([readProjectFile('homework.js'), readProjectFile('sw.js')]);
  assert.match(homework, /Çalışma Performansı/);
  assert.match(homework, /workPerformanceChart/);
  assert.match(homework, /Ort\. Doğru/);
  assert.match(homework, /Ort\. Yanlış/);
  assert.match(homework, /Ort\. Net/);
  assert.match(serviceWorker, /work-performance-insights\.js/);
});

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

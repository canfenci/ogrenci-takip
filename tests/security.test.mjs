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

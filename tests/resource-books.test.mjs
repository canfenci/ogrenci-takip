import assert from 'node:assert/strict';
import test from 'node:test';

test('resource books are classified by grade and subject and support manual entry', async () => {
  const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('../resource-books.js', import.meta.url), 'utf8'));
  assert.match(source, /RESOURCE_BOOKS_KEY/);
  assert.match(source, /String\(book\.grade\) === String\(grade\)/);
  assert.match(source, /book\.subject === subject/);
  assert.match(source, /MANUAL_RESOURCE_VALUE/);
  assert.match(source, /Manuel gir/);
});

test('settings only lists resource books after selecting their grade', async () => {
  const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('../students.js', import.meta.url), 'utf8'));
  assert.match(source, /selectedSettingsResourceGrade/);
  assert.match(source, /filter\(book => String\(book\.grade\) === selectedSettingsResourceGrade\)/);
  assert.match(source, /Kaynak kitapları görmek için önce sınıf düzeyi seçin/);
  assert.match(source, /onchange="filterSettingsResourceBooks\(this\.value\)"/);
});

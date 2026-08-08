import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTurkishPhone, validateStudentInput } from '../data-validation.js';

test('normalizes supported Turkish mobile phone formats', () => {
  assert.equal(normalizeTurkishPhone('532 111 22 33'), '05321112233');
  assert.equal(normalizeTurkishPhone('+90 532 111 22 33'), '05321112233');
  assert.equal(normalizeTurkishPhone('123'), null);
  assert.equal(normalizeTurkishPhone(''), '');
});

test('validates and normalizes student form values', () => {
  const valid = validateStudentInput({ name: '  Ada   Yılmaz ', school: ' Test Okulu ', grade: '8', target: 'Fen Lisesi', net: '75', fee: '750', phone: '0532 111 22 33' });
  assert.equal(valid.valid, true);
  assert.equal(valid.values.name, 'Ada Yılmaz');
  assert.equal(valid.values.phone, '05321112233');
  const invalid = validateStudentInput({ name: 'A', school: '', grade: '9', target: '', net: '100', fee: '-1', phone: '123' });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.length, 7);
});

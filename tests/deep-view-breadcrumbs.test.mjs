import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const students = fs.readFileSync('students.js', 'utf8');
const guidance = fs.readFileSync('guidance.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
test('UX-NAV-03 A-B/F-G: deep views expose semantic breadcrumbs', () => { assert.match(students, /aria-label="Breadcrumb"/); assert.match(students, /aria-current="page"/); assert.match(guidance, /aria-label="Breadcrumb"/); assert.match(guidance, /aria-current="page"/); });
test('UX-NAV-03 C-E: breadcrumb does not alter primary navigation', () => { assert.match(index, /sidebar-nav-home/); assert.match(index, /mobile-nav-home/); assert.doesNotMatch(index, /Breadcrumb/); });
test('UX-NAV-03 H-I: student name is escaped and breadcrumb is mobile-safe', () => { assert.match(students, /aria-current="page">\$\{escapeHtml\(student\.adSoyad\)\}/); assert.match(students, /overflow-x-auto/); });

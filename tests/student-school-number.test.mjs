import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const studentsRaw = readFileSync(new URL('../students.js', import.meta.url), 'utf-8');

describe('STUDENT-UX-02: School Number (okulNo) Field', () => {

    describe('Create form has okulNo field', () => {
        it('create form contains Okul No label', () => {
            assert.match(studentsRaw, /Okul No/);
        });

        it('create form has newOkulNo input', () => {
            assert.match(studentsRaw, /id="newOkulNo"/);
        });

        it('create form input uses type="text"', () => {
            assert.match(studentsRaw, /type="text"[\s\S]*?id="newOkulNo"/);
        });

        it('create form input uses inputmode="numeric"', () => {
            assert.match(studentsRaw, /inputmode="numeric"[\s\S]*?id="newOkulNo"/);
        });

        it('create form input is not required (optional)', () => {
            const newOkulNoSection = studentsRaw.substring(
                studentsRaw.indexOf('id="newOkulNo"'),
                studentsRaw.indexOf('id="newOkulNo"') + 200
            );
            assert.doesNotMatch(newOkulNoSection, /required/);
        });
    });

    describe('Edit form has okulNo field', () => {
        it('edit form has editOkulNo input', () => {
            assert.match(studentsRaw, /id="editOkulNo"/);
        });

        it('edit form pre-fills existing okulNo', () => {
            assert.match(studentsRaw, /editOkulNo.*value="\$\{escapeHtml\(s\.okulNo \|\| ''\)\}"/);
        });

        it('edit form input uses inputmode="numeric"', () => {
            assert.match(studentsRaw, /id="editOkulNo"[\s\S]*?inputmode="numeric"/);
        });

        it('edit form input is not required (optional)', () => {
            const editOkulNoSection = studentsRaw.substring(
                studentsRaw.indexOf('id="editOkulNo"'),
                studentsRaw.indexOf('id="editOkulNo"') + 200
            );
            assert.doesNotMatch(editOkulNoSection, /required/);
        });
    });

    describe('Create persistence includes okulNo', () => {
        it('addStudentFromModal reads newOkulNo value', () => {
            assert.match(studentsRaw, /getElementById\('newOkulNo'\)\?\.value\.trim\(\)/);
        });

        it('newStudent object includes okulNo property', () => {
            const newStudentMatch = studentsRaw.match(/const newStudent = \{[\s\S]*?\};/);
            assert.ok(newStudentMatch, 'newStudent object exists');
            assert.match(newStudentMatch[0], /okulNo:\s*okulNo/);
        });
    });

    describe('Edit persistence includes okulNo', () => {
        it('saveStudentEdit reads editOkulNo value', () => {
            assert.match(studentsRaw, /getElementById\('editOkulNo'\)\?\.value\.trim\(\)/);
        });

        it('patch object includes okulNo property', () => {
            const patchMatch = studentsRaw.match(/const patch = \{[\s\S]*?\};/);
            assert.ok(patchMatch, 'patch object exists');
            assert.match(patchMatch[0], /okulNo:\s*okulNo/);
        });
    });

    describe('Leading zero preservation', () => {
        it('okulNo is stored as string, not coerced to number', () => {
            const addFn = studentsRaw.substring(studentsRaw.indexOf('export async function addStudentFromModal'));
            assert.match(addFn, /getElementById\('newOkulNo'\)\?\.value\.trim\(\)/);
            assert.doesNotMatch(addFn, /Number.*newOkulNo/);
            assert.doesNotMatch(addFn, /parseInt.*newOkulNo/);
        });

        it('okulNo in patch is string, not coerced to number', () => {
            const editFn = studentsRaw.substring(studentsRaw.indexOf('export async function saveStudentEdit'));
            assert.match(editFn, /getElementById\('editOkulNo'\)\?\.value\.trim\(\)/);
            assert.doesNotMatch(editFn, /Number.*editOkulNo/);
            assert.doesNotMatch(editFn, /parseInt.*editOkulNo/);
        });
    });

    describe('Legacy student compatibility', () => {
        it('edit form defaults to empty string for undefined okulNo', () => {
            assert.match(studentsRaw, /s\.okulNo \|\| ''/);
        });
    });

    describe('No architecture changes to protected modules', () => {
        it('finance.js is not modified', () => {
            const finance = readFileSync(new URL('../finance.js', import.meta.url), 'utf-8');
            assert.ok(!finance.includes('okulNo'), 'finance.js should not contain okulNo');
        });

        it('homework.js is not modified', () => {
            const homework = readFileSync(new URL('../homework.js', import.meta.url), 'utf-8');
            assert.ok(!homework.includes('okulNo'), 'homework.js should not contain okulNo');
        });

        it('guidance.js is not modified', () => {
            const guidance = readFileSync(new URL('../guidance.js', import.meta.url), 'utf-8');
            assert.ok(!guidance.includes('okulNo'), 'guidance.js should not contain okulNo');
        });

        it('schedule.js is not modified', () => {
            const schedule = readFileSync(new URL('../schedule.js', import.meta.url), 'utf-8');
            assert.ok(!schedule.includes('okulNo'), 'schedule.js should not contain okulNo');
        });
    });
});

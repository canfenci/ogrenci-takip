// ==================== HOMEWORK PARENT PIN CLEANUP TESTS ====================
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const homeworkRaw = readFileSync(new URL('../homework.js', import.meta.url), 'utf-8');

describe('TECH-HOMEWORK-03: Dead Parent PIN Cleanup', () => {

    describe('A. Dead PIN UI is absent', () => {
        it('renderParentHwPasscodeScreen function removed', () => {
            assert.ok(!homeworkRaw.includes('renderParentHwPasscodeScreen'), 'renderParentHwPasscodeScreen should be removed');
        });

        it('hwPasscode input removed', () => {
            assert.ok(!homeworkRaw.includes('id="hwPasscode"'), 'hwPasscode input should be removed');
        });

        it('passcodeError div removed', () => {
            assert.ok(!homeworkRaw.includes('id="passcodeError"'), 'passcodeError div should be removed');
        });

        it('6 Haneli Giriş Şifresi label removed', () => {
            assert.ok(!homeworkRaw.includes('6 Haneli Giriş Şifresi'), 'PIN label should be removed');
        });

        it('Ödev Giriş Doğrulaması heading removed', () => {
            assert.ok(!homeworkRaw.includes('Ödev Giriş Doğrulaması'), 'passcode heading should be removed');
        });
    });

    describe('B. Dead PIN functions are absent', () => {
        it('verifyHwPasscode function removed', () => {
            assert.ok(!homeworkRaw.includes('verifyHwPasscode'), 'verifyHwPasscode should be removed');
        });

        it('renderParentHwEntry function removed', () => {
            assert.ok(!homeworkRaw.includes('renderParentHwEntry'), 'renderParentHwEntry should be removed');
        });

        it('submitParentHwResult function removed', () => {
            assert.ok(!homeworkRaw.includes('submitParentHwResult'), 'submitParentHwResult should be removed');
        });

        it('parentHwPasscode page state removed', () => {
            assert.ok(!homeworkRaw.includes('parentHwPasscode'), 'parentHwPasscode page state should be removed');
        });

        it('parentHwEntry page state removed', () => {
            assert.ok(!homeworkRaw.includes('parentHwEntry'), 'parentHwEntry page state should be removed');
        });
    });

    describe('C. No homework active flow depends on PIN', () => {
        it('homework create still exists', () => {
            assert.match(homeworkRaw, /function submitBatchOdev|function addOdevToGeciciList/);
        });

        it('homework edit still exists', () => {
            assert.match(homeworkRaw, /function editHomework/);
        });

        it('homework delete still exists', () => {
            assert.match(homeworkRaw, /function deleteHomeworkFromDashboard|function deleteOdev/);
        });

        it('homework dashboard still exists', () => {
            assert.match(homeworkRaw, /function renderOdevTakibi/);
        });

        it('importHwResult still exists (teacher flow)', () => {
            assert.match(homeworkRaw, /function importHwResult/);
        });
    });

    describe('D. Parent report flow still exists', () => {
        it('homework report insights imported', () => {
            assert.match(homeworkRaw, /homework-report-insights/);
        });

        it('buildHomeworkReportData still used', () => {
            assert.match(homeworkRaw, /buildHomeworkReportData/);
        });
    });

    describe('E. No security rule changed', () => {
        it('firebase-config import unchanged', () => {
            assert.match(homeworkRaw, /import.*firebase-config/);
        });

        it('db access for homeworks still works', () => {
            assert.match(homeworkRaw, /db\.collection\("homeworks"\)/);
        });
    });

    describe('F. No backup schema changed', () => {
        it('store imports unchanged', () => {
            assert.match(homeworkRaw, /import.*store\.js/);
        });
    });

    describe('G. Dead window bindings removed', () => {
        it('window.renderParentHwPasscodeScreen binding removed', () => {
            assert.ok(!homeworkRaw.includes('window.renderParentHwPasscodeScreen'), 'dead binding should be removed');
        });

        it('window.verifyHwPasscode binding removed', () => {
            assert.ok(!homeworkRaw.includes('window.verifyHwPasscode'), 'dead binding should be removed');
        });

        it('window.renderParentHwEntry binding removed', () => {
            assert.ok(!homeworkRaw.includes('window.renderParentHwEntry'), 'dead binding should be removed');
        });

        it('window.submitParentHwResult binding removed', () => {
            assert.ok(!homeworkRaw.includes('window.submitParentHwResult'), 'dead binding should be removed');
        });
    });

    describe('H. Live window bindings preserved', () => {
        it('window.hideNavigationElements still bound', () => {
            assert.match(homeworkRaw, /window\.hideNavigationElements\s*=\s*hideNavigationElements/);
        });

        it('window.importHwResult still bound', () => {
            assert.match(homeworkRaw, /window\.importHwResult\s*=\s*importHwResult/);
        });
    });
});

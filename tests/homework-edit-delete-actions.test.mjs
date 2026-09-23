import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const raw = readFileSync(new URL('../homework.js', import.meta.url), 'utf-8');

describe('UX-HOMEWORK-02: Edit and Delete Actions on Homework Dashboard', () => {

    describe('Function exports exist', () => {
        it('editHomework is exported', () => {
            assert.match(raw, /export function editHomework/);
        });

        it('closeOdevEditModal is exported', () => {
            assert.match(raw, /export function closeOdevEditModal/);
        });

        it('saveHomeworkEdit is exported', () => {
            assert.match(raw, /export function saveHomeworkEdit/);
        });

        it('deleteHomeworkFromDashboard is exported', () => {
            assert.match(raw, /export function deleteHomeworkFromDashboard/);
        });
    });

    describe('Window bindings exist', () => {
        it('editHomework is bound to window', () => {
            assert.match(raw, /window\.editHomework = editHomework/);
        });

        it('closeOdevEditModal is bound to window', () => {
            assert.match(raw, /window\.closeOdevEditModal = closeOdevEditModal/);
        });

        it('saveHomeworkEdit is bound to window', () => {
            assert.match(raw, /window\.saveHomeworkEdit = saveHomeworkEdit/);
        });

        it('deleteHomeworkFromDashboard is bound to window', () => {
            assert.match(raw, /window\.deleteHomeworkFromDashboard = deleteHomeworkFromDashboard/);
        });
    });

    describe('Dashboard renders Edit button', () => {
        it('desktop view has edit button with pen-to-square icon', () => {
            const desktopSection = raw.match(/hidden md:grid[\s\S]*?<\/article>/);
            assert.ok(desktopSection, 'desktop grid section exists');
            assert.match(desktopSection[0], /editHomework/);
            assert.match(desktopSection[0], /fa-pen-to-square/);
        });

        it('desktop edit button has accessible title and aria-label', () => {
            const editBtn = raw.match(/editHomework\('[^']+',\s*'[^']+'\)[^>]*>/g);
            assert.ok(editBtn && editBtn.length > 0, 'edit buttons exist');
            editBtn.forEach(btn => {
                assert.match(btn, /title="Düzenle"/);
                assert.match(btn, /aria-label="Ödevi düzenle"/);
            });
        });

        it('desktop edit button has min-h-[44px] touch target', () => {
            const editBtn = raw.match(/editHomework\('[^']+',\s*'[^']+'\)[^>]*>/g);
            assert.ok(editBtn && editBtn.length > 0);
            editBtn.forEach(btn => {
                assert.match(btn, /min-h-\[44px\]/);
            });
        });

        it('mobile view has edit button', () => {
            const mobileSection = raw.match(/md:hidden[\s\S]*?<\/article>/);
            assert.ok(mobileSection, 'mobile section exists');
            assert.match(mobileSection[0], /editHomework/);
            assert.match(mobileSection[0], /fa-pen-to-square/);
        });

        it('completed homework exposes canonical result edit action without hiding the card', () => {
            const rowsFn = raw.substring(raw.indexOf('const rowsHtml = records.map'), raw.indexOf('const prevWeekNum'));
            assert.match(rowsFn, /const hasResult = homework\.durum === 'tamamlandi'/);
            assert.match(rowsFn, /const resultButtonLabel = hasResult \? 'Sonucu Düzenle' : 'Sonuç Gir'/);
            assert.match(rowsFn, /due\.key === 'completed'\s*\? `[\s\S]*openHomeworkResultFromBoard\('\$\{student\.id\}', '\$\{homework\.id\}'\)[\s\S]*\$\{resultButtonLabel\}/);
            assert.match(rowsFn, /openHomeworkDetailModal\('\$\{student\.id\}', '\$\{homework\.id\}'\)/);
        });

        it('student detail completed homework can reopen the canonical result modal', () => {
            const detailFn = raw.substring(raw.indexOf('export function renderStudentOdevDetay'), raw.indexOf('export function deleteOdev'));
            assert.match(detailFn, /isCompleted \? `[\s\S]*showEnterOdevSonucModal\('\$\{studentId\}', '\$\{o\.id\}'\)[\s\S]*Sonucu Düzenle/);
            assert.match(detailFn, /showEnterOdevSonucModal\('\$\{studentId\}', '\$\{o\.id\}'\)[\s\S]*Sonuç Gir/);
        });
    });

    describe('Dashboard renders Delete button', () => {
        it('desktop view has delete button with trash icon', () => {
            const desktopSection = raw.match(/hidden md:grid[\s\S]*?<\/article>/);
            assert.ok(desktopSection);
            assert.match(desktopSection[0], /deleteHomeworkFromDashboard/);
            assert.match(desktopSection[0], /fa-trash/);
        });

        it('desktop delete button has accessible title and aria-label', () => {
            const delBtn = raw.match(/deleteHomeworkFromDashboard\('[^']+',\s*'[^']+'\)[^>]*>/g);
            assert.ok(delBtn && delBtn.length > 0, 'delete buttons exist');
            delBtn.forEach(btn => {
                assert.match(btn, /title="Sil"/);
                assert.match(btn, /aria-label="Ödevi sil"/);
            });
        });

        it('desktop delete button has min-h-[44px] touch target', () => {
            const delBtn = raw.match(/deleteHomeworkFromDashboard\('[^']+',\s*'[^']+'\)[^>]*>/g);
            assert.ok(delBtn && delBtn.length > 0);
            delBtn.forEach(btn => {
                assert.match(btn, /min-h-\[44px\]/);
            });
        });

        it('mobile view has delete button', () => {
            const mobileSection = raw.match(/md:hidden[\s\S]*?<\/article>/);
            assert.ok(mobileSection);
            assert.match(mobileSection[0], /deleteHomeworkFromDashboard/);
            assert.match(mobileSection[0], /fa-trash/);
        });
    });

    describe('Edit modal structure', () => {
        it('edit modal has odevEditModal id', () => {
            assert.match(raw, /id="odevEditModal"/);
        });

        it('edit modal pre-fills date fields', () => {
            assert.match(raw, /odevEditBaslamaTarihi.*value=.*\$\{baslama\}/);
            assert.match(raw, /odevEditBitisTarihi.*value=.*\$\{bitis\}/);
        });

        it('edit modal pre-fills konu field', () => {
            assert.match(raw, /odevEditKonu.*value=.*\$\{escapeHtml\(konu\)\}/);
        });

        it('edit modal pre-fills yayin field', () => {
            assert.match(raw, /odevEditYayin.*value=.*\$\{escapeHtml\(yayin\)\}/);
        });

        it('edit modal pre-fills calismaDetayi field', () => {
            assert.match(raw, /odevEditCalismaDetayi.*value=.*\$\{escapeHtml\(calismaDetayi\)\}/);
        });

        it('edit modal has ders select with teacherBranches', () => {
            assert.match(raw, /odevEditDersSelect/);
            assert.match(raw, /store\.teacherBranches/);
        });

        it('edit modal has tur select with standard options', () => {
            assert.match(raw, /odevEditTurSelect/);
            assert.match(raw, /Konu Denemesi/);
            assert.match(raw, /Konu Testi/);
            assert.match(raw, /Konu Tekrari/);
        });

        it('edit modal has save button', () => {
            assert.match(raw, /onclick="saveHomeworkEdit\(\)"/);
            assert.match(raw, /Degisiklikleri Kaydet/);
        });
    });

    describe('Delete delegates to canonical deleteOdev', () => {
        it('deleteHomeworkFromDashboard calls deleteOdev with renderOdevTakibi callback', () => {
            const fn = raw.substring(raw.indexOf('export function deleteHomeworkFromDashboard'));
            const fnBody = fn.substring(0, fn.indexOf('\nexport') !== -1 ? fn.indexOf('\nexport') : 200);
            assert.match(fnBody, /deleteOdev\(studentId,\s*hwId,\s*\(\)\s*=>\s*renderOdevTakibi\(\)\)/);
        });

        it('deleteOdev accepts optional onAfterDelete callback', () => {
            const deleteFn = raw.substring(raw.indexOf('export function deleteOdev'));
            const header = deleteFn.substring(0, deleteFn.indexOf('{'));
            assert.match(header, /onAfterDelete/);
        });

        it('deleteOdev defaults to renderStudentOdevDetay when no callback', () => {
            const deleteFn = raw.substring(raw.indexOf('export function deleteOdev'));
            assert.match(deleteFn, /const refresh = onAfterDelete/);
            assert.match(deleteFn, /renderStudentOdevDetay\(studentId\)/);
        });

        it('deleteOdev uses confirm dialog', () => {
            const deleteFn = raw.substring(raw.indexOf('export function deleteOdev'));
            assert.match(deleteFn, /confirm\(/);
        });

        it('no duplicate delete logic exists', () => {
            const deleteHomeworkBody = raw.substring(raw.indexOf('export function deleteHomeworkFromDashboard'));
            assert.doesNotMatch(deleteHomeworkBody, /db\.collection\("homeworks"\)\.doc/);
            assert.doesNotMatch(deleteHomeworkBody, /loadStudentsData/);
            assert.doesNotMatch(deleteHomeworkBody, /saveStudentsData/);
        });
    });

    describe('Edit preserves homework id (no duplicate)', () => {
        it('saveHomeworkEdit updates same record, does not create new id', () => {
            const saveFn = raw.substring(raw.indexOf('export function saveHomeworkEdit'));
            assert.match(saveFn, /\.update\(updates\)/);
            assert.doesNotMatch(saveFn, /id: "hw_"/);
        });

        it('saveHomeworkEdit uses Object.assign for local mode', () => {
            const saveFn = raw.substring(raw.indexOf('export function saveHomeworkEdit'));
            assert.match(saveFn, /Object\.assign\(odevler\[oIdx\], updates\)/);
        });
    });

    describe('Edit does not touch result fields', () => {
        it('updates object contains only metadata fields', () => {
            const saveFn = raw.substring(raw.indexOf('export function saveHomeworkEdit'));
            const updatesMatch = saveFn.match(/const updates = \{([^}]+)\}/);
            assert.ok(updatesMatch, 'updates object found');
            const fields = updatesMatch[1];
            assert.match(fields, /baslamaTarihi/);
            assert.match(fields, /bitisTarihi/);
            assert.match(fields, /ders/);
            assert.match(fields, /konu/);
            assert.match(fields, /tur/);
            assert.match(fields, /yayin/);
            assert.match(fields, /calismaDetayi/);
            assert.doesNotMatch(fields, /durum/);
            assert.doesNotMatch(fields, /dogru/);
            assert.doesNotMatch(fields, /yanlis/);
            assert.doesNotMatch(fields, /studentId/);
            assert.doesNotMatch(fields, /studentName/);
            assert.doesNotMatch(fields, /id/);
        });
    });

    describe('Edit failure safety', () => {
        it('cloud update has catch handler with alert', () => {
            const saveFn = raw.substring(raw.indexOf('export function saveHomeworkEdit'));
            assert.match(saveFn, /\.catch\(err =>/);
            assert.match(saveFn, /alert\(/);
        });

        it('local update validates required fields before save', () => {
            const saveFn = raw.substring(raw.indexOf('export function saveHomeworkEdit'));
            assert.match(saveFn, /if \(!konu \|\| !yayin\)/);
            assert.match(saveFn, /alert\(/);
        });
    });

    describe('Delete failure safety', () => {
        it('deleteOdev cloud path has catch handler with alert', () => {
            const deleteFn = raw.substring(raw.indexOf('export function deleteOdev'));
            assert.match(deleteFn, /\.catch\(err =>/);
            assert.match(deleteFn, /alert\(/);
        });
    });

    describe('No architecture changes to protected modules', () => {
        it('finance.js is not modified', () => {
            const finance = readFileSync(new URL('../finance.js', import.meta.url), 'utf-8');
            assert.ok(!finance.includes('editHomework'), 'finance.js should not contain editHomework');
            assert.ok(!finance.includes('deleteHomeworkFromDashboard'), 'finance.js should not contain deleteHomeworkFromDashboard');
        });

        it('students.js is not modified', () => {
            const students = readFileSync(new URL('../students.js', import.meta.url), 'utf-8');
            assert.ok(!students.includes('editHomework'), 'students.js should not contain editHomework');
        });

        it('guidance.js is not modified', () => {
            const guidance = readFileSync(new URL('../guidance.js', import.meta.url), 'utf-8');
            assert.ok(!guidance.includes('editHomework'), 'guidance.js should not contain editHomework');
        });
    });
});

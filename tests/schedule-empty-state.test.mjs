// ==================== SCHEDULE EMPTY STATE TESTS ====================
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const scheduleRaw = readFileSync(new URL('../schedule.js', import.meta.url), 'utf-8');

describe('SCHEDULE-UX-01: Schedule Empty State', () => {

    describe('A. Empty-state content renders when schedule is empty', () => {
        it('contains empty-state panel markup', () => {
            assert.match(scheduleRaw, /Hen\u00fcz ders program\u0131 olu\u015fturulmad\u0131/);
        });

        it('contains supporting text about adding first lesson', () => {
            assert.match(scheduleRaw, /Haftal\u0131k ders plan\u0131n\u0131 olu\u015fturmak i\u00e7in ilk dersini ekleyebilirsin/);
        });
    });

    describe('B. Title exists', () => {
        it('title text matches specification', () => {
            const title = 'Hen\u00fcz ders program\u0131 olu\u015fturulmad\u0131';
            assert.ok(scheduleRaw.includes(title), 'Title should exist in schedule.js');
        });
    });

    describe('C. Primary action exists', () => {
        it('Ders Ekle button exists in empty state', () => {
            assert.match(scheduleRaw, /Ders Ekle/);
        });

        it('empty state button calls showAddScheduleModal', () => {
            const emptyStateIdx = scheduleRaw.indexOf('totalWeeklyLessons === 0');
            const emptyStateBlock = scheduleRaw.slice(emptyStateIdx, emptyStateIdx + 1500);
            assert.ok(
                emptyStateBlock.includes('showAddScheduleModal'),
                'Empty state Ders Ekle button must call showAddScheduleModal'
            );
        });
    });

    describe('D. Action uses canonical schedule creation path', () => {
        it('showAddScheduleModal is defined in schedule.js', () => {
            assert.match(scheduleRaw, /function showAddScheduleModal/);
        });

        it('showAddScheduleModal is bound to window', () => {
            assert.match(scheduleRaw, /window\.showAddScheduleModal\s*=\s*showAddScheduleModal/);
        });

        it('no duplicate add flow is introduced', () => {
            const addFlowMatches = scheduleRaw.match(/function\s+add\w*Schedule/g);
            assert.ok(addFlowMatches, 'addScheduleFromModal should exist');
            assert.ok(addFlowMatches.length <= 2, 'Should not have more than 2 add schedule functions');
        });
    });

    describe('E. Empty state does NOT render when schedule data exists', () => {
        it('empty state is gated by totalWeeklyLessons === 0', () => {
            assert.match(scheduleRaw, /totalWeeklyLessons\s*===\s*0/);
        });

        it('schedule board renders day columns when data exists', () => {
            assert.match(scheduleRaw, /dayColumnsHtml/);
        });

        it('schedule board renders mobile day cards when data exists', () => {
            assert.match(scheduleRaw, /mobileDayCardsHtml/);
        });
    });

    describe('F. No duplicate add flow', () => {
        it('empty state reuses existing showAddScheduleModal', () => {
            const emptyStateIdx = scheduleRaw.indexOf('totalWeeklyLessons === 0');
            const emptyStateBlock = scheduleRaw.slice(emptyStateIdx, emptyStateIdx + 1500);
            const addCalls = emptyStateBlock.match(/showAddScheduleModal/g);
            assert.ok(addCalls, 'Empty state should reference showAddScheduleModal');
            assert.ok(addCalls.length === 1, 'Empty state should reference showAddScheduleModal exactly once');
        });
    });

    describe('G. Touch target meets minimum', () => {
        it('Ders Ekle button uses min-h-[44px]', () => {
            const emptyStateIdx = scheduleRaw.indexOf('totalWeeklyLessons === 0');
            const emptyStateBlock = scheduleRaw.slice(emptyStateIdx, emptyStateIdx + 1500);
            assert.ok(
                emptyStateBlock.includes('min-h-[44px]'),
                'Empty state Ders Ekle button must have min-h-[44px] touch target'
            );
        });
    });

    describe('H. Visual design consistency', () => {
        it('uses FontAwesome calendar-plus icon', () => {
            const emptyStateIdx = scheduleRaw.indexOf('totalWeeklyLessons === 0');
            const emptyStateBlock = scheduleRaw.slice(emptyStateIdx, emptyStateIdx + 1500);
            assert.ok(
                emptyStateBlock.includes('fa-calendar-plus'),
                'Empty state should use fa-calendar-plus icon'
            );
        });

        it('uses btn-primary class for action button', () => {
            const emptyStateIdx = scheduleRaw.indexOf('totalWeeklyLessons === 0');
            const emptyStateBlock = scheduleRaw.slice(emptyStateIdx, emptyStateIdx + 1500);
            assert.ok(
                emptyStateBlock.includes('btn-primary'),
                'Empty state action should use btn-primary class'
            );
        });

        it('has dark mode support', () => {
            const emptyStateIdx = scheduleRaw.indexOf('totalWeeklyLessons === 0');
            const emptyStateBlock = scheduleRaw.slice(emptyStateIdx, emptyStateIdx + 1500);
            assert.ok(
                emptyStateBlock.includes('dark:'),
                'Empty state should support dark mode'
            );
        });
    });

    describe('I. No data architecture changes', () => {
        it('schedule storage functions preserved', () => {
            assert.match(scheduleRaw, /loadSchedule/);
            assert.match(scheduleRaw, /saveSchedule/);
        });
    });
});

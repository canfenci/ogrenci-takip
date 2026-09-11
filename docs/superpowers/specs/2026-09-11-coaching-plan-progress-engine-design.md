# UX-GUIDANCE-02B2 Progress Engine Design

**Date:** 2026-09-11
**Status:** Draft
**Baseline:** 643194a (coaching-plan-model.js v1)
**Scope:** Progress calculation, weekly check-in, coaching summary integration, parent report data contract

---

## 1. Architecture Decision

**Selected approach: Task-Based Progress (Option A)**

Progress is derived exclusively from `coachingPlan.tasks[].completedCount`. Exam records (`denemeler[]`) and homework records (`odevler[]`) are displayed as read-only context indicators but do NOT feed into progress calculation.

**Rationale:**
- Zero double-counting risk
- No complex subject/topic fuzzy matching
- No race conditions on concurrent writes
- No new schema fields required for progress storage
- Works fully offline
- Simplest write model: teacher updates `task.completedCount` directly

**Trade-off accepted:** Teacher must manually update task counts. Exam/homework auto-counting is explicitly out of scope for 02B2.

---

## 2. Progress Source of Truth

### Canonical source: `task.completedCount`

```
student.coachingPlan.tasks[].completedCount  ->  number (0..infinity)
student.coachingPlan.tasks[].questionTarget  ->  number | null
student.coachingPlan.tasks[].completed       ->  boolean
```

**Rules:**
- `completedCount` is the ONLY input to progress calculation
- `completed = true` means the task is done (boolean, independent of count)
- `questionTarget` is the target for that specific task
- `completedCount > questionTarget` = overachievement (valid, not clamped)

### No other progress sources

| Source | Role | Writes to progress? |
|---|---|---|
| `task.completedCount` | Canonical | YES |
| `task.completed` | Task done flag | YES (task completion %) |
| `denemeler[].toplamNet` | Exam results | NO (display context) |
| `odevler[].dogru/yanlis` | Homework results | NO (display context) |
| `branchTargets[].questionTarget` | Branch goal | NO (target only) |
| `topicTargets[].questionTarget` | Topic goal | NO (target only) |

---

## 3. Progress Calculation Helpers

All pure functions in `coaching-plan-progress.js`. No side effects. No network. No storage writes.

### 3.1 Question Progress

```js
getQuestionProgress(plan) -> { actual, target, percent }
```

- `actual` = `sum(task.completedCount)` for ALL tasks with `taskType = 'question'`
- `target` = `plan.weeklyTargets.totalQuestions`
- `percent` = `target > 0 ? Math.round((actual / target) * 100) : null`
- Returns `{ actual: 0, target: null, percent: null }` if no target

### 3.2 Task Progress

```js
getTaskProgress(plan) -> { total, completed, percent }
```

- `total` = `plan.tasks.length`
- `completed` = `plan.tasks.filter(t => t.completed).length`
- `percent` = `total > 0 ? Math.round((completed / total) * 100) : null`

### 3.3 Branch Progress

```js
getBranchProgress(plan) -> Array<{ subject, actual, target, examActual, examTarget, percent }>
```

- For each `branchTargets[i]`:
  - `actual` = `sum(task.completedCount)` where `task.subject === branchTargets[i].subject` AND `task.taskType = 'question'`
  - `target` = `branchTargets[i].questionTarget`
  - `examActual` = count of completed tasks where `task.subject === branchTargets[i].subject` AND `task.taskType = 'exam'`
  - `examTarget` = `branchTargets[i].examTarget`
  - `percent` = `target > 0 ? Math.round((actual / target) * 100) : null`

**Matching rule:** `task.subject` must match `branchTargets[i].subject` (exact string match, case-sensitive). Teacher is responsible for consistent naming between task.subject and branchTargets.subject.

### 3.4 Topic Progress

```js
getTopicProgress(plan) -> Array<{ subject, topic, actual, target, percent }>
```

- For each `topicTargets[i]`:
  - `actual` = `sum(task.completedCount)` where `task.subject === topicTargets[i].subject` AND `task.topic === topicTargets[i].topic` AND `task.taskType = 'question'`
  - `target` = `topicTargets[i].questionTarget`
  - `percent` = `target > 0 ? Math.round((actual / target) * 100) : null`

### 3.5 Exam Progress

```js
getExamProgress(plan) -> { generalActual, generalTarget, branchActual, branchTarget }
```

- `generalActual` = count of completed tasks where `task.taskType = 'exam'` AND `task.subject` is null/empty (general exams)
- `generalTarget` = `plan.weeklyTargets.generalExams`
- `branchActual` = count of completed tasks where `task.taskType = 'exam'` AND `task.subject` is non-empty (branch exams)
- `branchTarget` = `plan.weeklyTargets.branchExams`

### 3.6 Review Session Progress

```js
getReviewProgress(plan) -> { actual, target, percent }
```

- `actual` = count of completed tasks where `task.taskType = 'review'`
- `target` = `plan.weeklyTargets.reviewSessions`
- `percent` = `target > 0 ? Math.round((actual / target) * 100) : null`

### 3.7 Reading Progress

```js
getReadingProgress(plan) -> { actual, target, percent }
```

- `actual` = count of completed tasks where `task.taskType = 'reading'`
- `target` = `plan.weeklyTargets.readingTarget`
- `percent` = `target > 0 ? Math.round((actual / target) * 100) : null`

**Ambiguity resolved:** `readingTarget` represents task count (not minutes/pages). The `durationMinutes` field on reading tasks is optional supplementary data.

### 3.8 Overall Plan Summary

```js
getPlanProgressSummary(plan) -> {
  questions: { actual, target, percent },
  tasks: { total, completed, percent },
  exams: { generalActual, generalTarget, branchActual, branchTarget },
  review: { actual, target, percent },
  reading: { actual, target, percent },
  branches: [...],
  topics: [...]
}
```

**No single overall percentage.** The summary returns multiple metrics. UI renders them as separate cards. This avoids misleading "79% complete" claims.

---

## 4. Null / Zero Safety

| Input | Behavior |
|---|---|
| `target = null` | `percent = null` -- progress bar hidden, "Hedef belirlenmis" shown |
| `target = 0` | `percent = null` -- avoid division by zero |
| `actual = 0, target = 550` | `percent = 0` -- valid, show 0% |
| `actual = 600, target = 550` | `percent = 109` -- overachievement, bar capped at 100% display, raw text shows "600 / 550" |
| `no tasks` | `actual = 0, total = 0, percent = null` |
| `no branch targets` | `branches = []` |
| `no topic targets` | `topics = []` |

**Display rules:**
- Progress bar: `min(percent, 100)` for visual width
- Text label: raw `actual / target` (no clamping)
- Overachievement: shown as "600 / 550" in green

---

## 5. Weekly Targets Actuals

| Target Field | Actual Derivation | Source |
|---|---|---|
| `totalQuestions` | `sum(task.completedCount)` where `taskType='question'` | task.completedCount |
| `generalExams` | `count(tasks)` where `taskType='exam'` AND `subject` is empty/null AND `completed=true` | task.completed |
| `branchExams` | `count(tasks)` where `taskType='exam'` AND `subject` is non-empty AND `completed=true` | task.completed |
| `readingTarget` | `count(tasks)` where `taskType='reading'` AND `completed=true` | task.completed |
| `reviewSessions` | `count(tasks)` where `taskType='review'` AND `completed=true` | task.completed |

---

## 6. Task Type Completion Semantics

| Type | Completion Criteria | Count Source |
|---|---|---|
| `question` | `completedCount / questionTarget` | completedCount |
| `exam` | `completed = true` (boolean) | completed flag |
| `review` | `completed = true` (boolean) | completed flag |
| `reading` | `completed = true` (boolean) | completed flag |
| `custom` | `completed = true` (boolean) | completed flag |

**For `question` type:** `completedCount` accumulates across check-ins. Teacher can increment partial progress (e.g., 20/50 today, 30/50 tomorrow).

**For non-question types:** Boolean completion. No partial progress.

---

## 7. Weekly Check-In

### 7.1 Purpose

Teacher-facing mechanism to update task progress at end of week. Single write operation that updates `task.completedCount` and optionally `task.completed`.

### 7.2 Location

**Study tab, inline section** -- not a separate modal. The check-in form appears within the existing coaching plan view when the plan is active.

Rationale: Modal adds navigation overhead. Inline keeps context visible.

### 7.3 Check-In Form Fields

```
For each task:
  - task title (read-only)
  - Soru Hedefi: {questionTarget} (read-only)
  - Yapilan: [input number] <- teacher enters completedCount
  - Tamamlandi: [checkbox] <- teacher marks completed

Save button:
  - Updates task.completedCount for each modified task
  - Updates task.completed for each modified task
  - Shows success toast
```

### 7.4 Check-In Write Model

```js
async function saveCheckIn(studentId, updates) {
  // updates = [{ taskId, completedCount, completed }, ...]
  const plan = loadStudent(studentId).coachingPlan;
  for (const update of updates) {
    const task = plan.tasks.find(t => t.id === update.taskId);
    if (task) {
      task.completedCount = Math.max(0, safeNumber(update.completedCount));
      task.completed = Boolean(update.completed);
    }
  }
  plan.updatedAt = new Date().toISOString();
  await saveCoachingPlan(studentId, plan);
}
```

### 7.5 Redundant Data Policy

**branchTargets[].actual** and **topicTargets[].actual** are NOT stored. Progress is always derived from tasks at read time.

Rationale: Avoids dual-write inconsistency. Single source of truth.

### 7.6 Manual Override

**Decision: NO manual override field.**

If teacher knows total questions solved but not per-task breakdown, they should update individual task counts accordingly. The `weeklyCheckIn.completedQuestionsOverride` field was considered but rejected because:

- It would create a second source of truth alongside task.completedCount
- Conflict resolution between override and task-based total adds complexity
- Teachers can simply enter the number in the appropriate task's completedCount field

### 7.7 Next Week Focus

```js
coachingPlan.weeklyCheckIn = {
  teacherNote: string | null,
  nextWeekFocus: string | null,
  checkedAt: string | null  // ISO timestamp
}
```

**Fields:**
- `teacherNote`: Free-text teacher observation for the week
- `nextWeekFocus`: Subject/topic to prioritize next week
- `checkedAt`: When the check-in was saved

These fields are informational. They do not affect progress calculation.

---

## 8. History Snapshot

### 8.1 Snapshot Timing

**Triggered on:** Plan archive (`archiveCoachingPlanForStudent`)

The snapshot is taken when the plan transitions to `archived` status. This is the canonical lifecycle event.

**NOT triggered on:**
- Week end (no automatic weekly close)
- Plan completion (status change to `completed` does not trigger)
- New plan creation

### 8.2 Snapshot Content

```js
{
  id: plan.id,
  weekStart: plan.weekStart,
  weekEnd: plan.weekEnd,
  status: plan.status,
  weeklyTargets: { ...plan.weeklyTargets },
  weeklyActuals: {
    totalQuestions: number,
    generalExams: number,
    branchExams: number,
    readingTarget: number,
    reviewSessions: number
  },
  branchTargets: [{ id, subject, questionTarget, examTarget, actual, examActual }],
  topicTargets: [{ id, subject, topic, questionTarget, actual }],
  tasks: [{ ...task }],  // includes completedCount and completed
  taskSummary: {
    total: number,
    completed: number,
    totalCompletedCount: number
  },
  createdAt: plan.createdAt,
  updatedAt: plan.updatedAt,
  archivedAt: new Date().toISOString(),
  weeklyCheckIn: plan.weeklyCheckIn || null
}
```

**Key addition over v1 snapshot:** `weeklyActuals`, `branchTargets[].actual`, `topicTargets[].actual`, `taskSummary`, `weeklyCheckIn`. These are derived at snapshot time and frozen.

### 8.3 Snapshot Immutability

Once created, snapshots are never modified. They serve as historical records for monthly reporting.

---

## 9. Monthly Reporting Foundation

### 9.1 What Monthly Reports Can Answer

With the snapshot model above, a monthly report can answer:

- Total target questions per week vs actual (weeklyActuals)
- Weekly trend (multiple snapshots)
- Branch performance over time (branchTargets[].actual)
- Topic coverage (topicTargets[].actual)
- Task completion rate (taskSummary)
- Teacher observations (weeklyCheckIn.teacherNote)

### 9.2 What Monthly Reports Cannot Answer (by design)

- Exact questions solved per day (not tracked at that granularity)
- Time spent per task (durationMinutes is optional, not enforced)
- Performance scores (exam net scores are separate from coaching progress)

### 9.3 History Aggregation Helper

```js
getMonthlyProgress(historyArray) -> {
  weeks: number,
  totalTargetQuestions: number,
  totalActualQuestions: number,
  avgWeeklyCompletion: number,
  branchTrends: { [subject]: { target, actual }[] },
  taskCompletionRate: number
}
```

- `weeks` = `historyArray.length`
- `totalTargetQuestions` = `sum(week.weeklyActuals.totalQuestions)`
- `branchTrends` = grouped by subject across weeks

---

## 10. Coaching Summary Integration

### 10.1 buildCoachingSummary Signals

The existing `buildCoachingSummary` function should use these signals from progress helpers:

1. **Low question progress** (< 50%): "Soru hedefinin yarisi tamamlanmamis"
2. **Many incomplete tasks** (> 50% incomplete): "Gorevlerin cogu eksik"
3. **Branch behind** (< 40% on any branch): "{subject} hedefi onemli sekilde geride"
4. **Plan completed** (100% task completion): "Plan basariyla tamamlandi"
5. **Overachievement** (> 120% on questions): "Soru hedefinin ustune cikildi"

**No false certainty:** Each signal includes the raw numbers so the UI can show "435 / 550" rather than just "79%".

### 10.2 Priority Scoring

**Decision: Do NOT include progress signals in priority scoring in 02B2.**

Rationale:
- Priority scoring currently uses exam trends, topic weaknesses, homework discipline
- Adding progress signals would require calibration of weights
- Risk of mis-prioritization if progress data is sparse (new plan, few check-ins)
- Better to add in 02B3 after real-world usage data

---

## 11. Overview KPI

### 11.1 Plan Status KPI (existing)

Current: "Plan Durumu: Aktif Program" (text)

### 11.2 Proposed Enhancement (02B2)

Replace single text with multi-metric display:

```
Soru: 435 / 550
Gorev: 5 / 7
Deneme: 2 / 3
```

**No single percentage.** Three separate metrics. No misleading "79% complete".

### 11.3 Progress Bar Rules

- Bar width: `min(percent, 100)` for visual
- Text: raw `actual / target` (never clamped)
- Color: green (>= 80%), yellow (50-79%), red (< 50%)
- No bar when `target = null` or `target = 0`

---

## 12. Study Tab Target UI

### 12.1 Layout

```
PLAN OZET
+-------------------------------------------+
| Soru: 435 / 550          [=====    ] %79  |
| Gorev:  5 / 7            [======== ] %71  |
| Deneme: 2 / 3            [======== ] %67  |
+-------------------------------------------+

BRANS HEDEFLERI
+-------------------------------------------+
| Fen      85 / 120  [=====    ] %71        |
| Matematik 95 / 150  [=====    ] %63       |
+-------------------------------------------+

KONU HEDEFLERI
+-------------------------------------------+
| Mevsimler  25 / 40  [======   ] %63      |
+-------------------------------------------+

GUNLER
Pazartesi | Sali | Carsamba | ... | Pazar
- task list per day
```

### 12.2 Check-In Section (inline, below plan summary)

```
HAFTALIK KONTROL
+-------------------------------------------+
| gorev adi       | hedef | yapilan | durum  |
| Soru cozum 1    |  50   |   35    | [ ]    |
| Deneme cosu     |   -   |    -    | [x]    |
| Tekrar oturumu  |   -   |    -    | [ ]    |
+-------------------------------------------+
| [Kaydet]                                   |
| Not: [_______________]                     |
| Gelecek hafta: [_______________]           |
+-------------------------------------------+
```

---

## 13. Date Range Filtering

### 13.1 Week Boundary Helper

```js
isDateInRange(dateStr, weekStart, weekEnd) -> boolean
```

- `dateStr`: ISO date string (YYYY-MM-DD)
- Compares using local date components (no timezone issues)
- `weekStart <= dateStr <= weekEnd` (inclusive)

### 13.2 Usage

For 02B2, this helper exists but is NOT actively used because:
- Task progress is not filtered by date (tasks are weekly by design)
- Exam/homework auto-filtering is out of scope

The helper is available for future use (e.g., weekly exam filtering).

---

## 14. Homework / Exam Integration

### 14.1 Homework

**Decision: NO automatic merge.**

Homework records (`odevler[]`) are displayed as context in the coaching plan view but do not update task progress. Risk of double-counting (same questions solved via homework and coaching task).

### 14.2 Exams

**Decision: NO automatic merge.**

Exam records (`denemeler[]`) are displayed as context indicators (e.g., "2 genel deneme bu hafta") but do not update task progress. Exam counts for weekly targets are derived from tasks with `taskType='exam'`.

---

## 15. Module Architecture

### 15.1 New File: `coaching-plan-progress.js`

Pure helper module. No side effects. All functions take a normalized plan object and return derived metrics.

**Exports:**
- `getQuestionProgress(plan)`
- `getTaskProgress(plan)`
- `getBranchProgress(plan)`
- `getTopicProgress(plan)`
- `getExamProgress(plan)`
- `getReviewProgress(plan)`
- `getReadingProgress(plan)`
- `getPlanProgressSummary(plan)`
- `getMonthlyProgress(historyArray)`
- `isDateInRange(dateStr, weekStart, weekEnd)`

### 15.2 Existing File Changes

**`growth.js`:**
- Add `saveCheckIn(studentId, updates)` function
- Add `renderCheckInSection(plan)` function for inline check-in UI
- Export to window for onclick handlers

**`guidance.js`:**
- Import progress helpers
- Replace static plan summary with progress-aware rendering
- Add progress bars to study tab

**`coaching-plan-model.js`:**
- Add `weeklyCheckIn` field to `normalizeCoachingPlan()`
- Update `createHistorySnapshot()` with actuals and summary
- No other changes

**`store.js`:**
- Add `saveCheckIn()` to export list
- No schema changes

---

## 16. Write Strategy

### 16.1 Progress Updates

**Reuse `saveCoachingPlan()`.** Progress is stored as `task.completedCount` within the plan object. No separate progress write path.

### 16.2 Concurrent Edit Risk

**Risk:** Teacher opens same plan in two tabs, edits different tasks, saves. Second save overwrites first.

**MVP Acceptance:** This is acceptable for MVP. The write is fast (single student document), and concurrent editing by the same teacher on two devices is rare.

**Mitigation (optional, not for 02B2):** Field-level update with merge semantics in `saveCoachingPlan`.

### 16.3 Offline Safety

Progress updates work offline via local fallback. Same as existing `saveCoachingPlan` behavior. Sync conflict on reconnect is handled by the existing merge strategy (latest write wins).

---

## 17. Test Strategy

### 17.1 Progress Helper Tests (coaching-plan-progress.test.mjs)

- Question progress: actual, target, percent
- Overachievement: 600/550 = 109%
- Null target: percent = null
- Zero target: percent = null (no division by zero)
- Task progress: total, completed, percent
- Branch aggregation: matching by subject
- Branch progress: actual, target, percent
- Topic aggregation: matching by subject+topic
- Topic progress: actual, target, percent
- Exam actual: general vs branch separation
- Mixed task types: correct type filtering
- No mutation of input
- No NaN in any output
- No Infinity in any output
- Empty plan: all zeros/nulls
- Plan summary: complete structure

### 17.2 Check-In Tests (coaching-plan-checkin.test.mjs)

- Save check-in updates task completedCount
- Save check-in updates task completed
- Save check-in updates plan updatedAt
- Check-in with null completedCount treated as 0
- Check-in with negative completedCount clamped to 0
- Check-in preserves other plan fields
- Check-in on non-existent taskId: no crash

### 17.3 History Snapshot Tests (update to coaching-plan-model.test.mjs)

- Snapshot includes weeklyActuals
- Snapshot includes branch actuals
- Snapshot includes topic actuals
- Snapshot includes taskSummary
- Snapshot includes weeklyCheckIn
- Snapshot is immutable (no mutation)

### 17.4 Monthly Aggregation Tests (coaching-plan-progress.test.mjs)

- Single week history
- Multi-week history
- Empty history
- Branch trends across weeks

---

## 18. Data Safety

- Legacy `studyPlan` and `studyPlanProfile` untouched
- No migration of existing data
- No destructive history rewrite
- No duplicate counting
- No external AI API
- No report binary storage
- `weeklyCheckIn` field is additive (existing plans get null)

---

## 19. Build Phasing

### 02B2A: Progress Helpers + UI

**Scope:**
- `coaching-plan-progress.js` (new module)
- Progress helper tests
- Study tab progress rendering (progress bars, metrics)
- KPI enhancement

**Estimated tests:** ~30

### 02B2B: Weekly Check-In + History

**Scope:**
- Check-in form (inline in study tab)
- `saveCheckIn()` function
- Check-in tests
- History snapshot update (actuals + summary)
- Monthly aggregation foundation
- Coaching summary signal integration

**Estimated tests:** ~25

**Total 02B2:** ~55 new tests
**Baseline:** 845
**Expected final:** ~900

---

## 20. Verdict

**ARCHITECTURE READY -- PROGRESS ENGINE SAFE TO BUILD**

Key decisions:
1. Task-based progress (single source of truth)
2. No exam/homework auto-merge (zero double-counting risk)
3. No single overall percentage (multi-metric display)
4. Inline check-in (no modal)
5. History snapshot on archive (not weekly)
6. No progress in priority scoring (02B3 scope)
7. Separate module (`coaching-plan-progress.js`)

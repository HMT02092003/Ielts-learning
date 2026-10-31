# Answer Editor (split view) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `/admin/tests/[id]`, replace the flat question list with a split view — passage/transcript left, per-question correct answer + accepted answers + explanation right — editing the test document instead of raw JSON.

**Architecture:** Frontend only. A pure helper module reads a (possibly invalid, draft) `TestImportDoc` loosely into view models with JSON paths, and writes edits back immutably. The page keeps the JSON string as the single source of truth: the answer view parses it, every edit re-stringifies it, and "Lưu" uses the existing `testsAdminApi.replaceContent`. Published/locked tests use the existing `testsAdminApi.hotfix` per question.

**Tech Stack:** Next.js 16 (client component), React Query, Tailwind with `tokens.css`, Vitest 4 (`tests/**/*.test.ts`, node env), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-10-31-answer-editor-design.md`

## Global Constraints

- No backend, DB or `src/shared` changes (shared is a synced copy — never edit it in `frontend/`).
- UI copy in Vietnamese, in `src/i18n/vi-admin.ts` under `viAdmin.tests`; identifiers in English.
- Colours/radii only via tokens (`scripts/check-tokens.mjs`); hover backgrounds `surface-muted`, never `bg-accent`.
- **No git commits** (CLAUDE.md) — leave changes in the working tree.
- Done = `yarn run check` passes in `frontend/` and the admin e2e passes.

## Review Focus

- Draft JSON that does not parse → answer view shows a notice ("JSON đang lỗi — sửa ở mục JSON nâng cao"), no crash. Test in Task 1 (`answerParts` on `null`/garbage returns `[]`) and Task 2 manual check.
- Draft doc missing pieces (group without `questions`, question without `answer`) → row renders with empty answer, no throw. Task 1 test.
- Matching Headings with an `example` → the example's heading key is not offered as a choice (mirrors `allowedKeys`). Task 1 test.
- WORD_BANK / OPTIONS answer modes show key buttons; WORDS mode shows a text input. Task 1 test.
- Editing in the answer view then opening the JSON editor shows the same change (single source of truth). Task 3 e2e.

---

### Task 1: Doc read/write helpers

**Files:**
- Create: `frontend/src/lib/answer-doc.ts`
- Test: `frontend/tests/answer-doc.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type DocPath = (string | number)[];
  export interface Choice { key: string; text: string }        // TFNG/YNNG text = Vietnamese-free label: 'TRUE','FALSE','NOT GIVEN'
  export interface AnswerQuestionView { path: DocPath; number: number; label: string; answer: string; accepted: string[]; explanation: string }
  export interface AnswerGroupView {
    path: DocPath; type: string; from: number; to: number; instructions: string;
    choices: Choice[] | null;                                  // null = free text answer
    perQuestionChoices: boolean;                               // MC single: choices come from each question's own options
    multi: { chooseCount: number; answer: string[] } | null;   // MC multi only (group-level answer)
    questions: (AnswerQuestionView & { choices?: Choice[] })[];
  }
  export interface AnswerPart { skill: 'READING' | 'LISTENING'; index: number; title: string;
    paragraphs: { label: string | null; text: string }[];      // reading; [] for listening
    transcript: string | null;                                 // listening; null for reading
    groups: AnswerGroupView[] }
  export function answerParts(doc: unknown): AnswerPart[];
  export function setAt(doc: unknown, path: DocPath, value: unknown): unknown; // immutable; value undefined deletes the key
  ```
- Paths: reading `['reading','passages',pi]`, listening `['listening','parts',pi]`; group `[...part,'groups',gi]`; question `[...group,'questions',qi]`. Edits: question `answer` / `accepted` / `explanation`, MC multi `[...group,'answer']`.
- `label`: `prompt` truncated to 80 chars; Matching Headings `Đoạn ${paragraphLabel}`; no prompt → `''`.
- Choices per type: MC single → each question's `options`; MC multi → group `options`; TFNG/YNNG → `TFNG_KEYS`/`YNNG_KEYS` from `@/shared/question-types` (text = key with `_`→space); Headings → `headings` minus `example.headingKey`; Matching Information → `paragraphLabels` (text = key); Features → `features`; Summary/Note → `wordBank.options` if `answerMode==='WORD_BANK'` else null; Map → `options` if `answerMode==='OPTIONS'` else null; Sentence/Short → null.
- Reading is loose: never throws; non-objects/missing arrays become empty; unknown group types get `choices: null`.

- [ ] **Step 1: Write failing tests** in `tests/answer-doc.test.ts`, loading `../../backend/prisma/seed/fixtures/dummy-reading.json` via `fs.readFileSync` + `JSON.parse`:
  - `answerParts(fixture)` → 3 parts, skill READING, part 0 title `'Rooftop Beekeeping in Northbridge'`, 5 paragraphs.
  - part 0 group 0: type `TRUE_FALSE_NOT_GIVEN`, from 1, to 5, choices keys `['TRUE','FALSE','NOT_GIVEN']`, question 0 answer `'FALSE'`.
  - part 0 group 1 (Sentence completion 6–9): `choices === null`, question 0 answer `'harbour district'`.
  - part 1 group 0 (Headings): no choice equals the fixture's `example.headingKey` (if the fixture has one; else build a doc with `example`).
  - part 1 group 3 (MC multi 25–26): `multi` equals `{ chooseCount: <fixture>, answer: ['A','C'] }`.
  - part 2 group 1 (MC single): `perQuestionChoices === true`, question 0 `choices` length = that question's options length.
  - part 2 group 2 (Summary 35–38, WORD_BANK): choices = word bank keys.
  - `answerParts(null)`, `answerParts('x')`, `answerParts({ reading: { passages: [{ groups: [{ type: 'SHORT_ANSWER' }] }] } })` → no throw; last one gives a group with `questions: []`.
  - Listening: `{ listening: { parts: [{ title: 'P1', audio: { transcript: 'hello' }, groups: [] }] } }` → skill LISTENING, transcript `'hello'`, paragraphs `[]`.
  - `setAt`: setting `['reading','passages',0,'groups',0,'questions',0,'answer']` to `'TRUE'` returns a new doc with that value, original unchanged (`toBe` identity differs on the path, equal elsewhere); `setAt(d, [...,'accepted'], undefined)` removes the key.
- [ ] **Step 2: Run** `yarn vitest run tests/answer-doc.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** `src/lib/answer-doc.ts` per Interfaces (small `obj()/arr()/str()` guards for loose reading; `setAt` recursive copy of arrays/objects along the path).
- [ ] **Step 4: Run** the same command → PASS.

### Task 2: Answer editor component

**Files:**
- Create: `frontend/src/components/admin/answer-editor.tsx`
- Modify: `frontend/src/i18n/vi-admin.ts` (add keys under `tests`)

**Interfaces:**
- Consumes: Task 1 exports.
- Produces:
  ```tsx
  export function AnswerEditor(props: {
    doc: unknown | undefined;            // undefined = JSON doesn't parse → show t.answerJsonBroken
    editable: boolean;                   // draft without attempts
    onChange: (doc: unknown) => void;    // editable mode: called on every edit
    hotfix?: {                           // locked mode
      questions: AdminQuestion[];        // match by skill + number
      save: (q: AdminQuestion, body: { acceptedAnswers?: string[]; explanation: string | null }) => void;
      saving: boolean;
    };
  }): JSX.Element
  ```
- New i18n keys (`viAdmin.tests`): `answers: 'Đáp án'`, `answersHelp`, `answerJsonBroken: 'JSON đang lỗi — sửa ở mục “Sửa JSON nâng cao” bên dưới.'`, `noAnswerParts: 'Đề chưa có Reading/Listening.'`, `correct: 'Đáp án đúng'`, `noTranscript: 'Chưa có transcript.'`, `advancedJson: 'Sửa JSON nâng cao'`, `chooseN: (n: number) => \`Chọn ${n} đáp án\``, `questionN: (n: number) => \`Câu ${n}\``, `range: (a: number, b: number) => \`Câu ${a}–${b}\``. Reuse existing `accepted`, `explanation`.

Behaviour:
- Part switcher: a row of `Button size="sm"` (variant `primary` for current, `secondary` otherwise) labelled `Reading 1`… / `Listening 1`…; state = selected index into `answerParts(doc)`.
- Layout: `grid gap-5 lg:grid-cols-2`; each column `lg:max-h-[75vh] lg:overflow-y-auto`. Left: title (`font-display`), paragraphs with bold label prefix, or transcript (`whitespace-pre-wrap`) / `t.noTranscript`.
- Right: per group a header (`QUESTION_TYPE_LABEL[type]` from `@/i18n/vi-exam`, falling back to the raw type for unknown types; `t.range`; instructions in `text-ink-muted`), then rows:
  - `t.questionN(number)` + label.
  - Choices → `role="radiogroup"` of small toggle buttons (`aria-pressed`), each `aria-label` = `${t.questionN(n)}: ${key}`, `title` = choice text. MC multi: one toggle group on the group header allowing exactly `chooseCount` selections (clicking a selected key removes it; clicking when full is ignored).
  - Free text → `Input` `aria-label={\`${t.correct} ${n}\`}` + accepted `Textarea` (one per line, `aria-label={\`${t.accepted} ${n}\`}`).
  - Explanation `Textarea` (`aria-label={\`${t.explanation} ${n}\`}`).
  - Editable mode: every change calls `onChange(setAt(doc, path, value))`; accepted saved as trimmed non-empty lines; empty explanation → `undefined`.
  - Locked mode: answer controls disabled; accepted/explanation are local state seeded from the matched `AdminQuestion` with a per-row "Lưu" button calling `hotfix.save`. Rows without a match render read-only.

- [ ] **Step 1: Add i18n keys and implement the component.**
- [ ] **Step 2: Run** `yarn run check` in `frontend/` → all steps pass (tokens, prettier, eslint, tsc, vitest).

### Task 3: Wire into the test page + e2e

**Files:**
- Modify: `frontend/src/app/(study)/(app)/admin/tests/[id]/page.tsx`
- Modify: `frontend/e2e/admin.spec.ts`

**Interfaces:**
- Consumes: `AnswerEditor` (Task 2). The page itself only parses the JSON string; it does not call `answerParts`.

Changes:
- Remove `QuestionRow` and the "Câu hỏi" card; its hotfix mutation moves into the page and is passed as `hotfix.save` (toast `t.saved` on success, `errMsg` on error).
- New "Đáp án" `Card` placed before the JSON card: `<AnswerEditor doc={parsed} editable={editable} onChange={(d) => setJson(JSON.stringify(d, null, 2))} hotfix={editable ? undefined : {...}} />`, where `editable = test.status === 'DRAFT' && test.attemptCount === 0` and `parsed` = `useMemo` try/`JSON.parse(json)` → `undefined` on error. In editable mode a "Lưu" button under the editor runs the existing `saveContent` flow (same as the JSON save button).
- JSON card wrapped in `<details>` with `<summary>` = `t.advancedJson` (closed by default; open it automatically when `issues.length > 0`).

- [ ] **Step 1: Update e2e.** In `admin: import JSON … → publish`, before publishing: open `t.advancedJson` summary where the test currently asserts the JSON value; add a new test `admin: answer editor edits the draft doc`: import the fixture as in the existing test, then
  - expect text `Rooftop Beekeeping in Northbridge` visible;
  - click button with name `Câu 1: TRUE`; click `Lưu` in the Đáp án card; expect toast `t.saved`;
  - click summary `Sửa JSON nâng cao`; expect `getByLabel('Nội dung (JSON)')` toHaveValue matching `/"number": 1,[\s\S]*?"answer": "TRUE"/`.
- [ ] **Step 2: Implement** the page changes.
- [ ] **Step 3: Run** `yarn run check` → PASS; `yarn run test:e2e e2e/admin.spec.ts` → PASS.
- [ ] **Step 4: Manual check** with `npm run dev`: draft test (edit, save, reload persists), published test (answer locked, accepted hotfix saves), break JSON → notice shown. Screenshot for the owner.
- [ ] **Step 5: Do not commit** — report changed files to the owner.

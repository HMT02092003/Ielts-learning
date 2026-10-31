# Answer editor (split view) — design

## Intent
Admins currently set answers by editing raw JSON on `/admin/tests/[id]`. The owner wants a split screen:
passage on one side, and on the other side each question with its name, the correct answer and the accepted answers,
edited through a form instead of JSON.

## Goals / non-goals
- Goal: enter and correct answers for Reading and Listening while reading the passage/transcript.
- Non-goal: authoring question bodies (prompts, options, headings, groups) — those still come from JSON / import / OCR.
- Non-goal: "context"/evidence highlighting (owner dropped it).
- Anti-goal: any backend or DB change; bypassing the existing server validation.

## Approaches
- **A (chosen): frontend only.** Read `data.doc` (TestImportDoc), edit answers in that object, save with the existing
  `replaceContent` API (server validates as today). Published tests: correct answer read-only, accepted variants +
  explanation via the existing hotfix API (M1).
- B: new backend per-question answer endpoint — more work, must keep draft JSON and DB rows in sync; rejected.

## Decided behaviour
- Layout (lg+): two columns, each scrolling on its own. Left: passage (title + paragraphs with labels) for Reading,
  transcript for Listening (or "no transcript" note). Part switcher above both columns: Reading P1–P3, Listening P1–P4.
  Below lg: stacked (passage, then questions).
- Right column: questions grouped by group (type label + "Câu x–y" + instructions), one row per question:
  - name: number + short prompt (or paragraph label for Matching Headings, "gap" for completion types).
  - correct answer control by type: buttons for TFNG / YNNG / MC single / matching (options from the group:
    option keys, headings, paragraph labels, features, word-bank keys, placed options); text input for WORDS mode.
  - MC multi: one shared "choose N" control on the group (answer is group-level in the schema).
  - accepted answers: one-per-line textarea, only for text-answer questions.
  - explanation textarea (already supported, kept).
- Draft without attempts: everything editable; one "Lưu" button saves the whole doc; server issues shown as today.
  JSON editor stays on the page, collapsed under "Sửa JSON nâng cao", and both views edit the same state.
- Published / has attempts: correct answer read-only; accepted + explanation saved per question via hotfix
  (matched by section + number to `/questions`).
- Writing/Speaking: not shown in the answer view.

## Left to the builder
Component split (e.g. `components/admin/answer-editor/*`), exact labels in `i18n/vi-admin.ts`, styling within tokens,
unit tests for the doc read/write helpers, an e2e check that an answer change saves.

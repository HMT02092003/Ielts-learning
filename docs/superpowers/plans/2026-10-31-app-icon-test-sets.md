# App icon · Test sets · Zip import/export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BandUp opens from a desktop icon as an app window; tests are grouped into book sets (source + bookNumber) for admins and students; a test or a whole set can be exported to / imported from a `.zip`.

**Architecture:** No schema change. A pure `setKeyOf()` in `backend/src/shared/test-sets.ts` defines sets; `test-sets.service.ts` groups `Test` rows for the admin and catalog APIs. Zip export wraps the existing `exportTest()` (rewriting `{fileId}` → `{path}` + streaming files from `storage`); zip import extracts to a temp dir and feeds each test through the existing `testsService.importNew()`. A Node launcher (`scripts/app.mjs`) runs the same stack as `npm run dev` hidden and opens `msedge --app`.

**Tech Stack:** Express 5, Prisma 7, Zod 4, Vitest 4 + supertest, Next.js 16, TanStack Query, `yazl@3.3.1` / `yauzl@3.4.0` (+ `@types/yazl@3.3.1`, `@types/yauzl@3.4.0`), `@napi-rs/canvas` (already a backend dep) for icon generation.

**Spec:** `docs/superpowers/specs/2026-10-31-app-icon-test-sets-design.md`

## Global Constraints

- No Prisma schema change. Set = `(source, bookNumber)`; `bookNumber = null` → set key `<SOURCE>-none`.
- `TestImportDoc` unchanged. Imports always create a **new DRAFT version** (never overwrite, never auto-publish).
- Students only ever see `PUBLISHED` tests.
- Backend: every route uses `validate({...})`; errors are `AppError(code)`; only `*.service.ts` imports `config/prisma`.
- Frontend: colours/fonts only via `src/styles/tokens.css`; Vietnamese copy in `src/i18n/vi.ts` / `vi-admin.ts`; UI from `components/ui`.
- Shared Zod lives in `backend/src/shared`; run `yarn run sync-shared` in `frontend/` after changing it.
- Yarn 1, exact versions (`save-exact`). Always `yarn run <script>`.
- Zip limits: `UPLOAD_MAX_ZIP_MB` default **1024**, max **2000** entries, entries only `.json`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.mp3`, `.m4a`, `.wav`, `.ogg`; reject absolute paths and `..`.
- Zip layout: `bandup-export.json` `{ format: "bandup-tests", formatVersion: 1, exportedAt, tests: ["<seriesKey>/test.json", …] }`, `<seriesKey>/test.json`, `<seriesKey>/assets/<fileId first 8 chars>-<originalName>`.
- Set titles: `CAM`→`Cambridge {n}`, `VOL`→`Volume {n}`, `PRE_IELTS`→`Pre-IELTS {n}`, `CUSTOM`→`Tự soạn {n}`; null book → `{Cambridge|Volume|Pre-IELTS|Tự soạn} — đề lẻ`.
- Download names: `BandUp-<setKey>-<YYYY-MM-DD>.zip`, `BandUp-<seriesKey>-v<version>.zip`.
- App window: Edge `--app=http://localhost:30000 --user-data-dir=<repo>/data/edge-profile`; logs in `data/logs/app-<YYYY-MM-DD>.log`.
- Commit per task on the branch the owner confirms at handoff (proposed: `local-setup`); never push without the owner asking.

## Review Focus

1. **Two tests in one zip with the same asset file name** (e.g. both have `part1.mp3`) → each test gets its own file. Test in Task 4 (`keeps assets of different tests apart`).
2. **Importing a zip whose seriesKey already exists (incl. PUBLISHED)** → new DRAFT version, published one untouched. Test in Task 4 (`imports as a new draft version`).
3. **BandUp already running when the icon is clicked** → launcher only opens a window and must not kill the servers it did not start when that window closes. Covered by Task 8 step "already running" manual check + `ownsStack` flag.
4. **Edge missing / server fails to start** → Windows message box with the log path instead of a silent nothing. Task 8 manual check.
5. **A set mixing PUBLISHED, DRAFT and ARCHIVED versions** → admin row shows latest + published; student sees only the published one; set with no published test hidden for students. Test in Task 2 (`groups versions per series`).

---

### Task 1: Shared set contracts

**Files:**
- Create: `backend/src/shared/test-sets.ts`
- Modify: `backend/src/shared/index.ts` (re-export)
- Test: `backend/tests/unit/shared.test.ts` (new `describe('test sets')`)

**Interfaces:**
- Produces:
  - `setKeyOf(source: TestSource, bookNumber: number | null): string` → `"CAM-18"` / `"CAM-none"`
  - `parseSetKey(key: string): { source: TestSource; bookNumber: number | null } | null`
  - `setTitleOf(source: TestSource, bookNumber: number | null): string`
  - `SetKeyParams = z.strictObject({ setKey: z.string().regex(/^(CAM|VOL|PRE_IELTS|CUSTOM)-(none|[1-9]\d{0,3})$/) })`
  - `AdminSetTestDto = { seriesKey, testNumber: number|null, title, type: TestType, latest: { id, status: TestStatus, version, skills: Skill[] }, published: { id, version } | null }`
  - `AdminTestSetDto = { setKey, source, bookNumber: number|null, title, tests: AdminSetTestDto[], counts: { draft: number, published: number } }`
  - `StudentTestSetDto = { setKey, source, bookNumber, title, tests: TestCardDto[] }`
  - `ListSetsQuery = z.object({ q: z.string().trim().max(100).optional(), source: TestSource.optional() })`
  - `ZipImportItemDto = { seriesKey: string | null, file: string, ok: boolean, testId?: Uuid, issues?: Issue[] }` (reuse the issue shape `IMPORT_INVALID` already returns); `ZipImportResultDto = { items: ZipImportItemDto[] }`
  - `PublishSetResultDto = { published: { seriesKey, testId }[], skipped: { seriesKey, reason: string, issues?: Issue[] }[] }`

- [ ] **Step 1: Write failing tests** — `setKeyOf('CAM', 18) === 'CAM-18'`, `setKeyOf('VOL', null) === 'VOL-none'`, `parseSetKey('PRE_IELTS-3')` → `{source:'PRE_IELTS', bookNumber:3}`, `parseSetKey('CAM-0')`/`'XYZ-1'`/`'CAM-../x'` → `null`, `setTitleOf('CAM', 18) === 'Cambridge 18'`, `setTitleOf('CUSTOM', null) === 'Tự soạn — đề lẻ'`.
- [ ] **Step 2:** `cd backend && yarn vitest run tests/unit/shared.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement the module (DTOs as Zod objects + inferred types, matching existing style in `shared/admin.ts`).
- [ ] **Step 4:** Same command → PASS. `cd frontend && yarn run sync-shared`.
- [ ] **Step 5:** Commit `feat(shared): test set keys and DTOs`.

### Task 2: Set listing APIs (admin + student)

**Files:**
- Create: `backend/src/modules/tests/test-sets.service.ts`, `backend/src/modules/tests/test-sets.routes.ts`
- Modify: `backend/src/app.ts` (mount `/api/v1/admin/test-sets` next to admin tests, same admin guard), `backend/src/modules/catalog/catalog.routes.ts` (add `GET /sets` **before** `/:id`), `backend/src/modules/catalog/catalog.service.ts` (export the existing `toCards` for reuse)
- Test: `backend/tests/api/test-sets.api.test.ts`

**Interfaces:**
- Consumes: Task 1 DTOs.
- Produces: `testSetsService.listAdmin(q: ListSetsQuery): Promise<AdminTestSetDto[]>`, `testSetsService.listStudent(userId: string, q: ListSetsQuery): Promise<StudentTestSetDto[]>`, `testSetsService.testsInSet(setKey: string, include: 'latest' | 'published'): Promise<{ id: string; seriesKey: string; version: number }[]>` (used by Tasks 3 and 5).

- [ ] **Step 1: Write failing API tests** (import fixtures via `/admin/tests/import` as in `admin-content.api.test.ts`, then `PATCH` meta to set `source`/`bookNumber`/`testNumber`):
  - `groups versions per series`: series A v1 PUBLISHED + v2 DRAFT, series B DRAFT only, both `CAM` book 18 → admin `GET /api/v1/admin/test-sets` returns one set `CAM-18` with 2 tests; A has `latest.version === 2`, `published.version === 1`; `counts` `{draft: 2, published: 1}`.
  - student `GET /api/v1/catalog/sets` returns `CAM-18` with only series A (published id); a set containing only drafts is absent.
  - null book → set `CAM-none`, title `Cambridge — đề lẻ`; sets sorted by source then bookNumber desc, `none` last; tests by `testNumber` (nulls last).
  - student calling the admin route → 403.
- [ ] **Step 2:** `yarn vitest run tests/api/test-sets.api.test.ts` → FAIL (404).
- [ ] **Step 3:** Implement: one `prisma.test.findMany` (filters `q` on title/seriesKey, `source`) selecting summary fields + sections' skills, group in memory by `setKeyOf`, then by `seriesKey`. Student path filters `status: 'PUBLISHED'` and maps with `toCards(rows, userId)`.
- [ ] **Step 4:** Test → PASS; `yarn run check` → green.
- [ ] **Step 5:** Commit `feat(api): list tests grouped by book set`.

### Task 3: Zip export

**Files:**
- Create: `backend/src/modules/tests/zip-export.service.ts`
- Modify: `backend/package.json` (add `yazl@3.3.1`, `yauzl@3.4.0`, dev `@types/yazl@3.3.1`, `@types/yauzl@3.4.0`), `tests.routes.ts` (`GET /:id/export.zip`), `test-sets.routes.ts` (`GET /:setKey/export.zip?include=latest|published`)
- Test: `backend/tests/api/test-zip.api.test.ts`, `backend/tests/helpers/zip.ts` (`readZip(buf: Buffer): Promise<Map<string, Buffer>>` via yauzl)

**Interfaces:**
- Consumes: `exportTest(testId)` (`export.service.ts`), `storage.getStream(key)`, `testSetsService.testsInSet`.
- Produces: `zipExportService.streamZip(testIds: string[], out: Writable): Promise<void>`; `docWithAssetPaths(doc: TestImportDoc, files: Map<string, { name: string }>): TestImportDoc` (pure: every `{ fileId }` → `{ path: "assets/<id8>-<name>" }`).

- [ ] **Step 1: Failing tests:**
  - export of the seeded-style listening fixture (has audio) → zip contains `bandup-export.json` with `format: 'bandup-tests'`, `formatVersion: 1`, `tests: ['<seriesKey>/test.json']`; `test.json` contains no `"fileId"`; every `"path"` in it exists as an entry; response `Content-Type: application/zip`, `Content-Disposition` filename `BandUp-<seriesKey>-v1.zip`.
  - set export with 2 tests → 2 folders, filename matches `/^BandUp-CAM-18-\d{4}-\d{2}-\d{2}\.zip$/`; `include=published` leaves out a draft-only series.
  - unknown id / setKey → 404 `NOT_FOUND`; bad setKey format → 400.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Look up `StoredFile` (`storageKey`, `originalName`) for every fileId in the doc; sanitize `originalName` to `[A-Za-z0-9._-]` (fallback `file`). Stream: `yazl.ZipFile` → `addReadStream(await storage.getStream(key), path)`; pipe `outputStream` to `res`. Headers set before streaming.
- [ ] **Step 4:** PASS; `yarn run check` green.
- [ ] **Step 5:** Commit `feat(api): export a test or a set as zip`.

### Task 4: Zip import

**Files:**
- Create: `backend/src/modules/tests/zip-import.service.ts`
- Modify: `backend/src/config/env.ts` (`UPLOAD_MAX_ZIP_MB: int(1024, 1)`), `backend/.env.example` (document it), `tests.routes.ts` (`POST /import-zip/validate`, `POST /import-zip`; field `file`, 1 file, `maxBytes` from env — register **before** `/:id` routes), `tests.controller.ts`
- Test: `backend/tests/api/test-zip.api.test.ts` (extend), helper `makeZip(entries: Record<string, Buffer | string>): Promise<Buffer>` in `tests/helpers/zip.ts`

**Interfaces:**
- Consumes: `testsService.importNew(raw, assets, actorId)`, `testsService.validate(raw)`, Task 3 export (round trip).
- Produces: `zipImportService.extract(zipPath: string): Promise<{ dir: string; tests: { file: string; jsonPath: string; assets: UploadedAsset[] }[] }>`, `zipImportService.importZip(zipPath, actorId, dryRun: boolean): Promise<ZipImportResultDto>`.

- [ ] **Step 1: Failing tests:**
  - `round-trips a test with media`: export listening test → import zip → 201, one item `ok: true`; `exportTest(new)` equals `exportTest(old)` after replacing fileIds with the referenced files' sha256 (compare `StoredFile.sha256` or file bytes) and ignoring `version`.
  - `imports as a new draft version`: publish original, import its export → new test `status: 'DRAFT'`, `version: 2`; original still `PUBLISHED`.
  - `keeps assets of different tests apart`: hand-made zip with `a/test.json` and `b/test.json`, each referencing `assets/part1.mp3` with **different** bytes → the two imported tests reference different files with matching bytes.
  - `one bad test does not block the others`: zip with one valid and one invalid `test.json` → items `[ok:true, ok:false with issues[].path]`; one new test in DB.
  - zip without `bandup-export.json` but with `x/test.json` + root `y.json` → both imported.
  - rejected (400 `IMPORT_INVALID`, nothing imported, temp dir removed): entry `../evil.json`; entry `/abs.json`; entry `notes.exe`; more than 2000 entries; declared uncompressed total > limit.
  - `/import-zip/validate` → same result shape, no new `Test` rows.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement with `yauzl.open(path, { lazyEntries: true, validateEntrySizes: true })`; check all entry names/extensions/sizes **before** writing anything; extract under `UPLOAD_TMP_DIR/<uuid>/`; per test folder, assets = files under `<folder>/assets/` with `originalname` = base name; each test imported independently (catch `AppError` → item with `issues` from `details.issues`); `finally` → `fs.rm(dir, { recursive: true, force: true })` and remove the upload.
- [ ] **Step 4:** PASS; `yarn run check` green.
- [ ] **Step 5:** Commit `feat(api): import tests from zip`.

### Task 5: Publish a whole set

**Files:**
- Modify: `test-sets.routes.ts` (`POST /:setKey/publish`, body `Empty`), `test-sets.service.ts`
- Test: `backend/tests/api/test-sets.api.test.ts` (extend)

**Interfaces:**
- Consumes: `testSetsService.testsInSet(setKey, 'latest')`, `testsService.publish(id, actorId)`.
- Produces: `testSetsService.publishSet(setKey, actorId): Promise<PublishSetResultDto>`.

- [ ] **Step 1: Failing test:** set with one publishable draft (full reading fixture) and one draft missing passages → `published` has the first; `skipped` has the second with `reason: 'Đề chưa đủ điều kiện xuất bản'` and `issues`; already-published latest versions are neither published again nor skipped.
- [ ] **Step 2:** FAIL. **Step 3:** Implement: loop latest DRAFT versions, call `testsService.publish`, catch `AppError('TEST_NOT_PUBLISHABLE')` into `skipped`. **Step 4:** PASS + `yarn run check`. **Step 5:** Commit `feat(api): publish all drafts of a set`.

### Task 6: Admin UI — set view, export, zip import

**Files:**
- Create: `frontend/src/components/admin/test-sets-view.tsx`, `frontend/src/lib/test-sets.ts` (pure helpers)
- Modify: `frontend/src/services/admin.service.ts` (`testSetsAdminApi.list(q)`, `.publish(setKey)`, `testsAdminApi.importZip(file, dryRun)`, `exportUrl.test(id)` / `exportUrl.set(setKey, include)` returning `/api/v1/...` URLs used as `<a href download>`), `frontend/src/app/(study)/(app)/admin/tests/page.tsx` (toggle **Theo bộ | Danh sách**, remembered in `localStorage` key `bandup.admin.tests.view` with try/catch, default `sets`), `.../admin/tests/import/page.tsx` (accept `.zip`; show per-item results; button "Xuất bản các đề hợp lệ" calls publish for ok items), `.../admin/tests/[id]/page.tsx` (button "Xuất .zip"), `frontend/src/i18n/vi-admin.ts`
- Test: `frontend/src/lib/test-sets.test.ts` (the frontend has no DOM test library — Vitest covers pure logic; the UI is covered by Task 9 E2E)

**Interfaces:**
- Consumes: Task 1 DTOs (via `@/shared`), Tasks 2–5 endpoints.
- Produces: `skillMatrix(set: AdminTestSetDto): { seriesKey: string; id: string; title: string; status: TestStatus; skills: Record<Skill, boolean> }[]`; `nextTestNumber(set): number` (max testNumber + 1, or 1); `readViewPref(key: string, fallback: 'sets' | 'list'): 'sets' | 'list'` / `writeViewPref(key, v)` (try/catch around `localStorage`); `<TestSetsView q source />` — one card per set: title, counts, a table rows = tests, columns = R/L/W/S (tick if `latest.skills` contains it) + status badge (`StatusBadge`); card actions **Xuất bộ (.zip)**, **Xuất bản cả bộ** (toast listing skipped + reasons), **Thêm Test** → `/admin/tests/import?source=…&bookNumber=…&testNumber=<max+1>` (import page shows these as a hint to use in the JSON); row click → `/admin/tests/<latest.id>`.

- [ ] **Step 1: Failing tests:** `skillMatrix` on a set with two tests, the first `skills: ['READING','LISTENING']` → row 1 `READING`/`LISTENING` true, `WRITING`/`SPEAKING` false; row 2 all false; `nextTestNumber` with testNumbers `[1, 3, null]` → 4, empty → 1; `readViewPref` when `localStorage.getItem` throws → fallback.
- [ ] **Step 2:** `cd frontend && yarn vitest run src/lib/test-sets.test.ts` → FAIL.
- [ ] **Step 3:** Implement the view and wire the pages.
- [ ] **Step 4:** PASS; `yarn run check` green (contract, tokens, lint, typecheck, tests).
- [ ] **Step 5:** Commit `feat(admin): test sets view, zip export and import`.

### Task 7: Student practice — by set

**Files:**
- Create: `frontend/src/components/study/test-set-card.tsx`
- Modify: `frontend/src/services/exam.service.ts` (`catalogApi.sets(q)`), `frontend/src/app/(study)/(app)/practice/page.tsx` (toggle **Theo bộ | Danh sách** using `readViewPref`/`writeViewPref` from Task 6, default `sets`, key `bandup.practice.view`; search box applies to both), `frontend/src/i18n/vi.ts`, `frontend/src/lib/test-sets.ts`
- Test: `frontend/src/lib/test-sets.test.ts` (extend)

**Interfaces:**
- Consumes: `GET /catalog/sets` (`StudentTestSetDto[]`); existing per-test card/skill-start UI on `/practice` (reuse its skill buttons component; extract it if it is inline).
- Produces: `setProgress(set: StudentTestSetDto): { total: number; done: number }`; `<TestSetCard set />` — collapsed: coloured block + set title + "{done}/{total} đề đã làm"; expanded: one row per test with skill buttons (same actions as the list view) and a done tick when `done`.

- [ ] **Step 1: Failing test:** `setProgress` on a set with 3 tests, one `done: true` → `{ total: 3, done: 1 }`; empty → `{ total: 0, done: 0 }`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS + `yarn run check`. **Step 5:** Commit `feat(practice): browse tests by book set`.

### Task 8: App icon, hidden launcher, desktop shortcut

**Files:**
- Create: `scripts/stack.mjs` (extracted from `dev.mjs`), `scripts/app.mjs`, `scripts/shortcut.mjs`, `scripts/make-icons.mjs`, `BandUp.vbs`, `BandUp.ico`, `frontend/public/icons/icon-192.png`, `frontend/public/icons/icon-512.png`, `frontend/src/app/manifest.ts`
- Modify: `scripts/dev.mjs` (use `stack.mjs`), `package.json` (scripts `app`, `shortcut`, `icons`), `.gitignore` (`data/*` already covers logs and edge-profile — verify), `.gitattributes` (`*.vbs text eol=crlf`, `*.ico binary`), `README.md` (section "Mở như app"), `CLAUDE.md` (Commands line)

**Interfaces:**
- Produces:
  - `stack.mjs`: `startStack({ log }: { log: (tag: string, line: string) => void }): Promise<{ children: ChildProcess[]; stop: () => void }>` — the PostgreSQL check, `db:setup`, LanguageTool, API, web exactly as `dev.mjs` does today; throws `Error` with a Vietnamese message instead of `process.exit`. `dev.mjs` becomes a thin wrapper printing prefixed lines.
  - `app.mjs`: if `portBusy(30000) && portBusy(40000)` → `ownsStack = false`, else `startStack` with log → `data/logs/app-<date>.log`; wait for `GET http://localhost:30000/login` 200 (timeout 180 s); spawn Edge (`%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe`, then `%ProgramFiles%\…`) with `--app=… --user-data-dir=<repo>/data/edge-profile --no-first-run`; on Edge exit → `if (ownsStack) stop()`; any failure → `mshta`/PowerShell `MessageBox` "BandUp không khởi động được. Xem log: <path>" and exit 1.
  - `BandUp.vbs`: `CreateObject("WScript.Shell").Run "cmd /c cd /d ""<dir>"" && npm run app", 0, False` with `<dir>` = script folder.
  - `shortcut.mjs`: creates `<Desktop>/BandUp.lnk` (target `wscript.exe`, args `"<repo>\BandUp.vbs"`, icon `<repo>\BandUp.ico`, working dir repo) via `powershell -NoProfile -Command` + `WScript.Shell.CreateShortcut`; prints the path.
  - `make-icons.mjs`: renders `frontend/src/app/icon.svg` with `@napi-rs/canvas` (run from `backend/` node_modules via `createRequire`) to PNG 16/32/48/192/256/512; writes the two public PNGs and `BandUp.ico` (PNG-compressed ICO with 16/32/48/256 entries). Outputs are committed; script is re-runnable.
  - `manifest.ts`: `name: 'BandUp'`, `short_name: 'BandUp'`, `start_url: '/'`, `display: 'standalone'`, `theme_color: '#1F5E4B'` (logo fill), `background_color` = the light page background value from `tokens.css`; manifest needs literal hex, so mark those lines with `// check-tokens: allow` (the existing per-line opt-out in `scripts/check-tokens.mjs`); icons `/icons/icon-192.png`, `/icons/icon-512.png`.
- [ ] **Step 1:** `npm run icons` → the PNGs/ICO exist; open `BandUp.ico` in Explorer preview → logo visible at 16 and 256.
- [ ] **Step 2:** `npm run dev` still works (regression after extracting `stack.mjs`): `/login` 200, API login 200.
- [ ] **Step 3:** `npm run shortcut` → `BandUp.lnk` on Desktop with the logo. Double-click → no console window; app window without address bar opens within ~30 s; taskbar shows the logo.
- [ ] **Step 4:** Close the window → within 5 s ports 30000, 40000, 8010 are free (`Get-NetTCPConnection`).
- [ ] **Step 5 (already running):** start `npm run dev` in a terminal, double-click the icon → only a window opens; close it → `npm run dev` servers still answer.
- [ ] **Step 6 (failure):** stop the PostgreSQL service is not possible without admin — instead temporarily set `DATABASE_URL` port to 5999 in `backend/.env`, double-click → message box with log path; restore `.env`.
- [ ] **Step 7:** `npm run check` green. Commit `feat: desktop app launcher with icon`.

### Task 9: End-to-end and wrap-up

**Files:**
- Create: `frontend/e2e/test-sets.spec.ts`
- Modify: `README.md` (Trạng thái + Lệnh hay dùng: `npm run app`, `npm run shortcut`, zip import/export), `docs/import-guide.md` (section "3. Nhập/xuất .zip")

- [ ] **Step 1: E2E:** admin opens `/admin/tests` (set view default) → sees the seeded set → "Xuất bộ" downloads a zip → `/admin/tests/import` uploads it → result list all ok → list shows new Nháp versions. Student `/practice` → opens the set → starts Reading of a published test (attempt page loads).
- [ ] **Step 2:** `cd frontend && yarn test:e2e` (stop the dev frontend first) → PASS.
- [ ] **Step 3:** `npm run check` at root → green.
- [ ] **Step 4:** Commit `test(e2e): sets, zip round trip; docs`; push `local-setup`.

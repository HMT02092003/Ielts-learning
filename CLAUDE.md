# CLAUDE.md — BandUp (IELTS Internal Practice System)

The product spec is in [docs/spec.md](docs/spec.md) (owner's original instructions, Vietnamese). The decisions
below were approved by the owner in Phase 0 and **override the spec** where they differ.

## Working rules (from the owner)

- Reply in **Vietnamese**; code, identifiers and commit messages in English.
- Only build the phase the owner asks for. Plan first, wait for "OK", then code.
- **Do not create git commits** until the owner names the target branch. Leave changes in the working tree.
- Ask at most 3 grouped questions at a time. Never invent libraries, APIs or numbers; verify versions on npm.

## Approved decisions (override spec)

| # | Decision |
|---|---|
| D1 | Runs on the machine's **Node 20.20** (nvm-windows). Package manager: **Yarn 1.22.22** (owner's choice; `.yarnrc` has `ignore-engines` + `save-exact`). Use `yarn run <script>` — `yarn check` is a Yarn built-in. Vitest 4 (v5 needs Node 22). |
| D2 | **Next.js 16.4.x** (not 15): `src/proxy.ts` instead of middleware, ESLint CLI instead of `next lint`. |
| D3 | **No MinIO** (image no longer published). Files go through the `Storage` interface → `LocalDiskStorage` (`data/storage`). |
| D4 | **No web-highlighter**; Phase 3 builds its own highlighter (offset anchors + CSS Custom Highlight API). |
| D5 | Folder kept as `D:\Src\IELTS Learning` (owner declined the rename). |
| D6 | Exam: timer starts at "Bắt đầu" (CREATED→IN_PROGRESS), keeps running when the browser is closed, 30 s grace, server auto-submit. EXAM per whole section or per part; one open attempt per (section, scope), auto-resume; PRACTICE untimed, no per-question answer check. |
| D7 | Localhost only for now: `COOKIE_SECURE=false`, API on 127.0.0.1. |
| D8 | Screens missing from `design/` are built by us from `design/design-system.md`; owner reviews via `/dev/styleguide` + screenshots. |
| D9 | Visual direction "lặng" accepted as-is (cool background, no resting shadows, Lexend). Dark mode only in the Study shell; Exam/Admin always light. |
| D10 | Exam shell follows the design: no passage tabs (part buttons in the bottom nav), Select-first matching + @dnd-kit as an extra, timer states at 5 min **and** 1 min. |
| D11 | **Two independent projects** `backend/` (Express, `src/modules/<feature>/`) and `frontend/` (Next.js) — not the spec's pnpm/Turborepo monorepo. Shared Zod contracts live in `backend/src/shared` and are copied to `frontend/src/shared` by `yarn run sync-shared`. |
| M1–M11 | Defaults: published tests immutable (hotfix answers + rescore, else clone), band tables JSON→DB versioned, keep jsonwebtoken, never delete users, OCR publish creates DRAFT, generated dummy audio, nullable-unique "only one" columns, practice-by-type within one test, W/S stats use admin bands only, no personal data on the login page, no login lockout (owner removed it; global 600 req/min limit remains), app name **"BandUp"** (owner renamed it 2026-10-30; "lặng" is only the design handoff name) in `i18n/vi.ts` (`vi.app.name`), logo `components/common/brand-mark.tsx` + `app/icon.svg`. |

## Ports

FE dev **30000**, FE build/`next start`/Docker **31000**, BE API **40000** (owner's choice, 2026-10-30). Docker containers still listen on 3000/4000 internally; only the published host ports changed. `WEB_ORIGIN` is a comma-separated list (both FE ports).

## Commands

- Root (no deps, plain npm): `npm run setup` (env files + installs), `npm run dev` (Docker DB → migrate/seed →
  API + web in one terminal), `npm run check`, `npm run docker:up|down|logs` (full stack in Docker, profile `app`).
- Full Docker on any machine: `cp .env.example .env` then `docker compose --profile app up -d --build`
  (the API container runs migrate deploy + idempotent seed on start; web image bakes `API_ORIGIN=http://backend:4000`).
- Infra only: `docker compose up -d` (Postgres on **127.0.0.1:5434**, LanguageTool on 8010).
- Backend (`backend/`): `yarn dev`, `yarn run check | db:setup | db:migrate | backup | restore`.
- Frontend (`frontend/`): `yarn dev`, `yarn run check | test:e2e | sync-shared`.

## Conventions

- Backend: only `*.service.ts` may import `config/prisma` (ESLint). Every route uses `validate({...})`; errors are
  `AppError(code)` from `src/shared/errors.ts` → `{ error: { code, message, details? } }`.
- Frontend: colours/fonts/radii/shadows only via `src/styles/tokens.css` (checked by `scripts/check-tokens.mjs`).
  In this design `accent` is the brand colour — shadcn hover backgrounds use `surface-muted`, never `bg-accent`.
- `argon2` is pinned to **0.44.0**: the 0.45.x win32-x64 prebuild segfaults on load.
- Prisma blocks `migrate reset` when run by an AI agent; tests/e2e empty `*_test` databases with TRUNCATE instead.

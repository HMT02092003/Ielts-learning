# Kiến trúc (Giai đoạn 1)

## Tổng thể

```
Trình duyệt ──► frontend (Next.js :30000 dev / :31000 build) ──rewrite /api/v1/*──► backend (Express :40000) ──► Postgres (:5434)
                    │ proxy.ts: chỉ kiểm có cookie phiên                    ├─► LanguageTool (:8010, từ P5)
                    │ trang Study/Exam shell                                └─► Storage (data/storage)
```

- Trình duyệt **chỉ gọi web origin** (`/api/v1/...`); Next rewrite sang backend. Cookie httpOnly vì thế là
  same-origin, không cần CORS (CORS chỉ allowlist `WEB_ORIGIN`).
- `API_ORIGIN` được đóng băng lúc `next build` — đổi thì phải build lại.

## Backend (`backend/`)

```
src/
  server.ts, app.ts              composition root; createApp() dùng cho Supertest
  config/                        env (Zod), logger (pino + redact), prisma (adapter-pg, omit passwordHash)
  middlewares/                   validate, authenticate/requireRole, origin-guard, rate-limit, error-handler
  modules/<feature>/             <feature>.routes.ts → .controller.ts → .service.ts (chỉ service gọi Prisma)
  lib/                           errors (AppError), cookies, clock, storage/, scoring/
  shared/                        HỢP ĐỒNG Zod dùng chung (chỉ phụ thuộc zod) — chép sang frontend
prisma/                          schema.prisma, migrations/, seed/ (users, fixtures CC0, assets sinh bằng code)
tests/                           unit/ + api/ (Supertest), DB ielts_test (guard tên *_test)
```

- Mọi route đi qua `validate({ params, query, body })`; dữ liệu đã parse nằm ở `res.locals.validated`.
- Lỗi luôn là `{ error: { code, message, details? } }`; mã lỗi và HTTP status ở `src/shared/errors.ts`.
- Express 5 tự chuyển Promise bị reject tới error handler — không cần wrapper async.

## Auth

| | Access | Refresh |
|---|---|---|
| Dạng | JWT HS256 (jsonwebtoken), 15 phút | 32 byte ngẫu nhiên; DB chỉ lưu sha256 |
| Cookie | `ielts_at`, path `/`, `HttpOnly; SameSite=Lax` | `ielts_rt`, path `/api/v1/auth`, `HttpOnly; SameSite=Strict` |
| Hạn | Cookie sống bằng refresh (JWT bên trong vẫn hết sau 15') | trượt 30 ngày, tuyệt đối 90 ngày |

- Xoay vòng mỗi lần refresh; token vừa bị xoay vẫn được nhận lại trong 30 giây (hai tab cùng refresh).
- "Ghi nhớ đăng nhập" không tick → cookie phiên (mất khi đóng trình duyệt).
- Refresh thất bại → API xóa cả hai cookie → web về `/login`, không lặp chuyển hướng.
- Client: gặp `AUTH_TOKEN_EXPIRED` thì refresh một lần (single-flight) rồi thử lại.
- CSRF: SameSite + `originGuard` (Origin/Sec-Fetch-Site) + body JSON bắt buộc.
- Mật khẩu: argon2id (m=64 MiB, t=3, p=4), email không tồn tại vẫn verify hash giả (chống dò email).

## Frontend (`frontend/`)

```
src/app/(study)/login                 Đăng nhập (C-Login)
src/app/(study)/(app)/…               Study shell: dashboard, admin (guard UX), dev/styleguide
src/app/(exam)/…                      Exam shell (.exam-mode: luôn sáng, không animation): preview
src/components/{ui,layout,common,exam}
src/lib/api-client.ts                 fetch có kiểu, refresh single-flight, ApiError
src/shared/                           BẢN SINH từ backend/src/shared (yarn run sync-shared) — không sửa tay
src/styles/tokens.css                 nguồn token duy nhất (xem design-tokens.md)
```

## Dữ liệu

Schema Prisma Giai đoạn 1 tạo **đủ mọi enum** cho các phase sau (tránh `ALTER TYPE` giữa chừng) và các bảng:
User, RefreshToken, StoredFile, Test → Section → Part → (Passage/Paragraph | Audio | WritingTask | SpeakingPart),
QuestionGroup, Question, BandTable, Attempt, AttemptPart, Answer, Annotation. Bảng OCR (P2), Writing/Speaking (P5),
từ vựng/thống kê (P6) thêm bằng migration cộng thêm. Bất biến "chỉ một" dùng cột nullable + unique
(`Test.publishedSeriesKey`, `BandTable.activeKind`, `Attempt.activeScopeKey`) và CHECK viết tay trong migration.

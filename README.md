# lặng — IELTS Practice (nội bộ)

Web app luyện thi IELTS dùng nội bộ (1–5 người). Hai dự án độc lập:

| Thư mục | Công nghệ | Cổng |
|---|---|---|
| `backend/` | Node.js 20 + Express 5 + Prisma 7 (PostgreSQL) + Zod | 4000 |
| `frontend/` | Next.js 16 (App Router) + Tailwind CSS v4 + shadcn/ui (Radix) + TanStack Query | 3000 |
| `docker-compose.yml` | PostgreSQL 17 (cổng **5434**) + LanguageTool | — |

Spec gốc: [docs/spec.md](docs/spec.md). Quyết định đã duyệt (ghi đè spec): [CLAUDE.md](CLAUDE.md).

## Chạy từ máy sạch (Windows 11)

Yêu cầu: **Node 20.19+** (máy hiện dùng 20.20 qua nvm-windows), **Docker Desktop**, Git.
pnpm 10 được gọi qua **corepack** (đi kèm Node), không cần cài riêng — mọi lệnh bên dưới viết `corepack pnpm …`
(nếu đã chạy `corepack enable` thì gõ `pnpm …` là đủ).

```powershell
# 1) Hạ tầng (Postgres + LanguageTool)
copy .env.example .env
docker compose up -d

# 2) Backend
cd backend
copy .env.example .env          # đổi JWT_ACCESS_SECRET và mật khẩu seed
corepack pnpm install           # tự sinh Prisma Client (postinstall)
corepack pnpm db:setup          # migrate + seed (2 tài khoản + 4 đề mẫu)
corepack pnpm dev               # http://127.0.0.1:4000/api/v1/health

# 3) Frontend (terminal khác)
cd frontend
copy .env.example .env.local
corepack pnpm install
corepack pnpm dev               # http://localhost:3000
```

Đăng nhập bằng tài khoản trong `backend/.env` (`SEED_ADMIN_*`, `SEED_STUDENT_*`).

> Máy đã có Postgres riêng ở cổng 5432 nên compose dùng **5434**. Đổi bằng `POSTGRES_PORT` trong `.env` gốc
> và `DATABASE_URL` trong `backend/.env`.

## Lệnh thường dùng

| Nơi | Lệnh | Việc |
|---|---|---|
| backend | `pnpm dev` | API, tự reload |
| backend | `pnpm check` | format + lint + typecheck + test (Vitest + Supertest, DB `ielts_test`) |
| backend | `pnpm db:migrate` / `db:seed` / `db:setup` | migration dev / seed (idempotent) / deploy + seed |
| backend | `pnpm backup` / `pnpm restore [tên] [--yes]` | sao lưu / khôi phục DB + `data/storage` → [docs/backup-restore.md](docs/backup-restore.md) |
| frontend | `pnpm dev` | web app |
| frontend | `pnpm check` | đồng bộ hợp đồng + kiểm token + format + lint + typecheck + test |
| frontend | `pnpm test:e2e` | Playwright (tự chạy backend :4100 + web :3100 trên DB `ielts_e2e_test`) |
| frontend | `pnpm sync-shared` | chép `backend/src/shared` → `frontend/src/shared` sau khi sửa hợp đồng Zod |

Lần đầu chạy e2e: `corepack pnpm exec playwright install chromium` (trong `frontend/`).

## Trạng thái — Giai đoạn 1 (Nền tảng)

**Đã xong**
- Hai dự án độc lập, pin version chính xác; Docker Compose (Postgres 17 + LanguageTool 6.8).
- Prisma 7: schema Giai đoạn 1 (enum đầy đủ cho mọi phase, auth, file, nội dung đề 4 kỹ năng, bảng band,
  attempt/answer/annotation) + migration `init` kèm CHECK constraint viết tay (đã kiểm không drift).
- Seed idempotent: admin + học viên từ env; 4 đề mẫu tự viết (CC0) đi qua importer thật, đủ 12 dạng câu hỏi;
  audio/ảnh sinh bằng code.
- Hợp đồng Zod dùng chung (`backend/src/shared`): enum, 12 loại câu hỏi, tài liệu nhập đề có lỗi theo đường dẫn field.
- API: Express 5 theo module (`routes → controller → service`, chỉ service gọi Prisma), `validate(zod)` cho mọi
  route, lỗi thống nhất `{ error: { code, message, details? } }`, helmet, CORS allowlist, origin guard (CSRF),
  rate limit (login theo IP + email), pino có redact, request id.
- Auth: argon2id, JWT access 15 phút + refresh token opaque xoay vòng (grace 30s) trong cookie httpOnly,
  "Ghi nhớ đăng nhập", đăng xuất, đổi mật khẩu, phân quyền ADMIN/STUDENT.
- Web: token thiết kế "lặng" từ `design/` (sáng/tối), font tự host (Be Vietnam Pro, Lexend, Newsreader),
  Study shell (header, theme, menu tài khoản), trang Đăng nhập, Tổng quan (rỗng), Quản trị (chặn quyền),
  Exam shell tĩnh `/preview` (đồng hồ 5/1 phút, cỡ chữ, thanh câu hỏi), `/dev/styleguide`.
- Test: backend 63, frontend 39, e2e 6 — đều xanh. Sao lưu/khôi phục chạy được trên Windows.

**Chưa làm (theo kế hoạch các phase sau)**
- P2: quản lý người dùng/đề qua UI, import JSON qua UI, upload file, OCR.
- P3: làm bài Reading/Listening thật (autosave, deadline server, highlight…).
- P4: chấm điểm + bảng band (chưa seed bảng quy đổi — sẽ điền bảng tham khảo ở P4).
- P5: Writing/Speaking. P6: dashboard, từ vựng, hoàn thiện.

Nợ kỹ thuật: [docs/tech-debt.md](docs/tech-debt.md).

## Tài liệu

- [docs/architecture.md](docs/architecture.md) — kiến trúc, luồng auth, cấu trúc thư mục
- [docs/design-tokens.md](docs/design-tokens.md) — cách thay token thiết kế
- [docs/windows-setup.md](docs/windows-setup.md) — lưu ý riêng cho Windows
- [docs/backup-restore.md](docs/backup-restore.md) — sao lưu/khôi phục
- [docs/adr/](docs/adr/) — các quyết định kiến trúc

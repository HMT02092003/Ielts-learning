# BandUp — Luyện thi IELTS (nội bộ)

Web app luyện thi IELTS dùng nội bộ (1–5 người). Gồm hai dự án độc lập, mỗi dự án tự cài và tự chạy bằng **Yarn**:

| Thư mục | Công nghệ | Địa chỉ |
|---|---|---|
| `backend/` | Node.js 20 + Express 5 + Prisma 7 + Zod | http://127.0.0.1:40000/api/v1 |
| `frontend/` | Next.js 16 + Tailwind CSS v4 + shadcn/ui | dev **http://localhost:30000** · bản build http://localhost:31000 |
| `docker-compose.yml` | PostgreSQL 17 (cổng **5434**) + LanguageTool | — |

## Cổng

| Thành phần | Cổng |
|---|---|
| Frontend — dev (`yarn dev`) | **30000** |
| Frontend — bản build (`yarn build` + `yarn start`, hoặc Docker) | **31000** |
| Backend API — dev (`yarn dev`) | **40000** |
| Backend API — bản Docker (để không tranh cổng với dev) | 41000 |
| Postgres (Docker) | 5434 |
| LanguageTool (Docker) | 8010 |

Frontend gọi backend qua `API_ORIGIN` trong `frontend/.env.local`; backend chỉ nhận request từ các địa chỉ trong
`WEB_ORIGIN` (`backend/.env`, nhiều địa chỉ ngăn bằng dấu phẩy).

## Tài khoản đăng nhập

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | `admin@ielts.local` | `123456789` |
| Học viên | `dat@ielts.local` | `123456789` |

Đây là tài khoản mẫu (khai báo trong `backend/.env`, mục `SEED_*`), chỉ dùng nội bộ trên máy.

## Chạy trên máy (cách dùng hằng ngày)

**Cần có:** Node 20.19+, Yarn 1.22 (`npm i -g yarn`), Docker Desktop.

### Lần đầu

```powershell
docker compose up -d                 # bật database (Postgres) + LanguageTool trong Docker

cd backend
copy .env.example .env               # Linux/macOS: cp
yarn install
yarn run db:setup                    # tạo bảng + dữ liệu mẫu (2 tài khoản, 4 đề mẫu)

cd ..\frontend
copy .env.example .env.local
yarn install
```

### Mỗi lần làm việc

Mở Docker Desktop (database tự chạy lại), rồi mở **2 terminal**:

```powershell
# Terminal 1
cd backend
yarn dev

# Terminal 2
cd frontend
yarn dev
```

Mở **http://localhost:30000** và đăng nhập. Dừng bằng `Ctrl+C` trong từng terminal.

> Muốn gọn hơn: `npm run dev` ở thư mục gốc chạy cả database, backend và frontend trong một cửa sổ.
> Lần đầu trên máy mới có thể dùng `npm run setup` (tạo các file `.env` + `yarn install` cho cả hai).

### Dùng Postgres có sẵn trên máy (cổng 5432) thay cho Docker

1. Tạo 3 database: `ielts_learning`, `ielts_learning_test`, `ielts_learning_e2e_test`
   (tên dùng cho test **phải kết thúc bằng `_test`**).
2. Sửa `backend/.env`:
   ```
   DATABASE_URL=postgresql://USER:PASS@127.0.0.1:5432/ielts_learning
   TEST_DATABASE_URL=postgresql://USER:PASS@127.0.0.1:5432/ielts_learning_test
   E2E_DATABASE_URL=postgresql://USER:PASS@127.0.0.1:5432/ielts_learning_e2e_test
   ```
3. `yarn run db:setup` trong `backend/`, rồi chạy như trên.

LanguageTool (chấm Writing, Giai đoạn 5) vẫn cần Docker: `docker compose up -d languagetool`.

## Chạy toàn bộ bằng Docker (máy khác, không cần cài Node)

```powershell
copy .env.example .env                           # Linux/macOS: cp
docker compose --profile app up -d --build       # build + chạy database, LanguageTool, API, web
```

Mở **http://localhost:31000**, đăng nhập bằng tài khoản ở trên. Lần đầu build mất vài phút (cần Internet).
Container API tự migrate + nạp dữ liệu mẫu mỗi lần khởi động (không tạo trùng, không đổi mật khẩu đã có).

- Xem log: `docker compose --profile app logs -f backend frontend`
- Dừng: `docker compose --profile app down` (dữ liệu vẫn được giữ)

**Không chạy cùng lúc với `yarn dev` của backend** — cả hai cùng dùng cổng 40000 cho API.

### Mở ra Internet bằng Cloudflare Tunnel

1. Trong `.env` ở thư mục gốc, đặt hai biến:
   - `CLOUDFLARE_TUNNEL_TOKEN=` lấy từ Cloudflare Zero Trust → Networks → Tunnels. Đây là bí mật, chỉ để trong `.env`.
   - `PUBLIC_ORIGIN=https://<tên miền của bạn>`
2. Chạy: `docker compose --profile app --profile tunnel up -d`.
3. Trên Cloudflare, ở mục **Public Hostname** của tunnel, chọn Service `HTTP`, URL `frontend:3000`. Không dùng `localhost` vì cloudflared chạy trong Docker.

Mỗi lần đổi `PUBLIC_ORIGIN`, chạy lại lệnh ở bước 2 để backend nhận địa chỉ mới.

## Lệnh hay dùng

| Ở đâu | Lệnh | Việc |
|---|---|---|
| backend | `yarn dev` | Chạy API, tự reload khi sửa code |
| backend | `yarn run db:setup` | Áp migration + nạp dữ liệu mẫu (chạy lại thoải mái) |
| backend | `yarn run db:migrate` | Tạo migration mới khi sửa `prisma/schema.prisma` |
| backend | `yarn run check` | Format + lint + typecheck + test |
| backend | `yarn run backup` / `yarn run restore` | Sao lưu / khôi phục DB + file → [docs/backup-restore.md](docs/backup-restore.md) |
| frontend | `yarn dev` | Chạy web |
| frontend | `yarn run check` | Kiểm hợp đồng + token màu + format + lint + typecheck + test |
| frontend | `yarn test:e2e` | Test trình duyệt (tắt `yarn dev` của frontend trước) |
| frontend | `yarn run sync-shared` | Chép `backend/src/shared` sang frontend sau khi sửa schema Zod dùng chung |
| gốc | `npm run check` | `yarn run check` cho cả hai dự án |

> Luôn gõ `yarn run check`, **không** phải `yarn check` (đó là lệnh có sẵn của Yarn, làm việc khác).
> Lần đầu chạy e2e: `yarn playwright install chromium` trong `frontend/`.

**Đặt lại mật khẩu tài khoản mẫu** theo `backend/.env`:
`SEED_ADMIN_RESET_PASSWORD=true` trong `backend/.env` → `yarn run db:seed` → đổi lại `false`.

## Gặp lỗi

| Hiện tượng | Cách xử lý |
|---|---|
| `yarn install` báo `packageManager … pnpm` | Bạn đang ở code cũ — pull bản mới (đã chuyển sang Yarn) |
| Trang báo "Không kết nối được máy chủ" | Terminal backend chưa chạy hoặc đã dừng |
| Backend lỗi kết nối database | Docker Desktop chưa mở, hoặc chưa `docker compose up -d` |
| `Port 30000 is in use` / `EADDRINUSE :40000` | Một bản cũ vẫn đang chạy (hoặc bản Docker) — tắt nó trước |

## Trạng thái

Đã làm xong Giai đoạn 1–6. Lần kiểm tra cuối: backend 133 test, frontend 39 unit test, e2e 12 kịch bản, tất cả đều xanh.

| Giai đoạn | Nội dung chính | Đường dẫn |
|---|---|---|
| 1. Nền tảng | Đăng nhập/phân quyền, dữ liệu mẫu (4 đề tự viết), giao diện "lặng" + logo BandUp, sao lưu, Docker | `/login`, `/preview`, `/dev/styleguide` |
| 2. Nhập đề | Quản lý tài khoản, CRUD đề (form + JSON báo lỗi theo đường dẫn), import JSON, upload, OCR ảnh/PDF + màn review | `/admin/users`, `/admin/tests`, `/admin/ocr` |
| 3. Làm bài R/L | Thư viện đề, chế độ thi/luyện (cả bài · một part · theo dạng câu), split view kéo được, 12 dạng câu, highlight + ghi chú, tự lưu, đồng hồ theo giờ server, tự nộp khi hết giờ, audio Listening | `/practice`, `/attempts/[id]` |
| 4. Chấm + kết quả | Chấm 12 dạng, bảng band tham khảo (admin sửa, có phiên bản), trang kết quả, xem lại bài, làm lại câu sai, lịch sử | `/results/[id]`, `/history`, `/admin/band-tables` |
| 5. Writing + Speaking | Viết bài (đếm từ, tự lưu, chặn dán khi thi), **ước lượng** Lexical/Grammar bằng LanguageTool + compromise, checklist TR/CC, so sánh bài; ghi âm Speaking; admin chấm tay | `/admin/grading` |
| 6. Tiến độ + từ vựng | Tổng quan (band 4 kỹ năng, xu hướng, dạng yếu, chuỗi ngày học, đề gợi ý), radar, sổ từ + flashcard SM-2, tra từ điển, lưu từ ngay trong bài đọc, cài đặt | `/dashboard`, `/vocabulary`, `/settings` |

**Lưu ý:**

- Band Writing do máy tính ra chỉ là **ước lượng, không thay thế giám khảo**. Biểu đồ tiến độ chỉ dùng band do giám khảo (admin) chấm.
- Bảng quy đổi band là bảng **tham khảo**, không phải bảng chính thức.
- Tra từ điển gọi `dictionaryapi.dev`, nên máy cần có Internet. Kết quả được lưu cache trong database.
- Chưa có AI chấm bài. Cách gắn bộ chấm AI sau này xem ở [docs/adding-ai-evaluator.md](docs/adding-ai-evaluator.md).

Nợ kỹ thuật: [docs/tech-debt.md](docs/tech-debt.md).

## Tài liệu

- [CLAUDE.md](CLAUDE.md) — các quyết định đã duyệt (ghi đè spec)
- [docs/spec.md](docs/spec.md) — spec gốc
- [docs/architecture.md](docs/architecture.md) — kiến trúc, luồng đăng nhập
- [docs/design-tokens.md](docs/design-tokens.md) — thay token thiết kế
- [docs/windows-setup.md](docs/windows-setup.md) — lưu ý riêng cho Windows
- [docs/backup-restore.md](docs/backup-restore.md) — sao lưu/khôi phục
- [docs/test-schema.md](docs/test-schema.md) — định dạng JSON của đề
- [docs/import-guide.md](docs/import-guide.md) — nhập đề bằng JSON / OCR
- [docs/adding-ai-evaluator.md](docs/adding-ai-evaluator.md) — gắn bộ chấm AI sau này

# BandUp — Luyện thi IELTS (nội bộ)

Web app luyện thi IELTS dùng nội bộ (1–5 người). Gồm hai dự án độc lập, mỗi dự án tự cài và tự chạy bằng **Yarn**:

| Thư mục | Công nghệ | Địa chỉ |
|---|---|---|
| `backend/` | Node.js 20 + Express 5 + Prisma 7 + Zod | http://127.0.0.1:40000/api/v1 |
| `frontend/` | Next.js 16 + Tailwind CSS v4 + shadcn/ui | dev **http://localhost:30000** · bản build http://localhost:31000 |
| PostgreSQL 17 cài trên máy | dịch vụ Windows `postgresql-x64-17`, cổng **5432** | — |
| `.tools/` (không commit) | Java 21 + LanguageTool 6.6, `npm run dev` tự bật | http://127.0.0.1:8010 |

## Cổng

| Thành phần | Cổng |
|---|---|
| Frontend — dev (`yarn dev`) | **30000** |
| Frontend — bản build (`yarn build` + `yarn start`, hoặc Docker) | **31000** |
| Backend API — dev (`yarn dev`) | **40000** |
| Backend API — bản Docker (để không tranh cổng với dev) | 41000 |
| PostgreSQL trên máy | 5432 |
| Postgres (chỉ khi chạy toàn bộ bằng Docker) | 5434 |
| LanguageTool | 8010 |

Frontend gọi backend qua `API_ORIGIN` trong `frontend/.env.local`; backend chỉ nhận request từ các địa chỉ trong
`WEB_ORIGIN` (`backend/.env`, nhiều địa chỉ ngăn bằng dấu phẩy).

## Tài khoản đăng nhập

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | `admin@ielts.local` | `123456789` |
| Học viên | `dat@ielts.local` | `123456789` |

Đây là tài khoản mẫu (khai báo trong `backend/.env`, mục `SEED_*`), chỉ dùng nội bộ trên máy.

## Chạy trên máy (cách dùng hằng ngày)

**Cần có:** Node 20.19+, Yarn 1.22 (`npm i -g yarn`), PostgreSQL 17 (không cần Docker).

### Lần đầu

1. Cài PostgreSQL 17 (bộ cài EnterpriseDB, cổng 5432). Tạo user + 3 database (tên test **phải kết thúc bằng `_test`**):
   ```sql
   CREATE ROLE ielts LOGIN PASSWORD 'ielts_dev_password' CREATEDB;
   CREATE DATABASE ielts OWNER ielts;
   CREATE DATABASE ielts_test OWNER ielts;
   CREATE DATABASE ielts_e2e_test OWNER ielts;
   ```
   Khớp sẵn với `backend/.env.example`; đổi mật khẩu thì sửa cả ba `*_DATABASE_URL`.
2. LanguageTool (ước lượng Writing, tuỳ chọn): giải nén một JRE 17+ (vd. Temurin 21) vào `.tools/jre` và
   [LanguageTool-6.6.zip](https://languagetool.org/download/LanguageTool-6.6.zip) vào `.tools/languagetool`
   (phải có `.tools/languagetool/languagetool-server.jar`). Thiếu thư mục này thì app vẫn chạy, chỉ phần ước lượng
   Writing tắt.
3. Ở thư mục gốc: `npm run setup` (tạo các file `.env` + `yarn install` cho cả hai dự án).

### Mỗi lần làm việc

Bấm đúp **`BandUp.bat`** (hoặc `npm run dev` ở thư mục gốc): migrate + seed, bật LanguageTool, backend và frontend
trong một cửa sổ, rồi tự mở **http://localhost:30000**. Đóng cửa sổ (hoặc `Ctrl+C`) để dừng. PostgreSQL là dịch vụ
Windows nên tự chạy cùng máy.

Muốn chạy riêng từng phần: `yarn dev` trong `backend/` và trong `frontend/` (2 terminal).

### Mở như app

`npm run shortcut` (một lần) tạo icon **BandUp** trên Desktop. Bấm đúp icon: BandUp chạy ngầm (không có cửa sổ
console) và mở trong một cửa sổ Edge riêng, không thanh địa chỉ. Chuột phải icon → *Ghim vào thanh tác vụ* nếu muốn.
Đóng cửa sổ là tắt luôn server. Nếu đang chạy sẵn `npm run dev` thì icon chỉ mở cửa sổ, không đụng tới server đó.
Log ở `data/logs/app-<ngày>.log`; khởi động lỗi thì hiện hộp thoại kèm đường dẫn log. Không có icon thì gõ `npm run app`.

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
| gốc | `npm run app` / `npm run shortcut` | Mở BandUp như app / tạo icon trên Desktop |
| gốc | `npm run icons` | Vẽ lại icon (PNG + `BandUp.ico`) từ `frontend/src/app/icon.svg` |

> Luôn gõ `yarn run check`, **không** phải `yarn check` (đó là lệnh có sẵn của Yarn, làm việc khác).
> Lần đầu chạy e2e: `yarn playwright install chromium` trong `frontend/`.

**Đặt lại mật khẩu tài khoản mẫu** theo `backend/.env`:
`SEED_ADMIN_RESET_PASSWORD=true` trong `backend/.env` → `yarn run db:seed` → đổi lại `false`.

## Gặp lỗi

| Hiện tượng | Cách xử lý |
|---|---|
| `yarn install` báo `packageManager … pnpm` | Bạn đang ở code cũ — pull bản mới (đã chuyển sang Yarn) |
| Trang báo "Không kết nối được máy chủ" | Terminal backend chưa chạy hoặc đã dừng |
| Backend lỗi kết nối database | Dịch vụ `postgresql-x64-17` chưa chạy — mở `services.msc` và bật nó |
| `Port 30000 is in use` / `EADDRINUSE :40000` | Một bản cũ vẫn đang chạy (hoặc bản Docker) — tắt nó trước |

## Trạng thái

Đã làm xong Giai đoạn 1–6, cùng với bộ đề, nhập/xuất .zip và mở như app. Lần kiểm tra cuối: backend 155 test,
frontend 46 unit test, e2e 14 kịch bản, tất cả đều xanh.

| Giai đoạn | Nội dung chính | Đường dẫn |
|---|---|---|
| 1. Nền tảng | Đăng nhập/phân quyền, dữ liệu mẫu (4 đề tự viết), giao diện "lặng" + logo BandUp, sao lưu, Docker | `/login`, `/preview`, `/dev/styleguide` |
| 2. Nhập đề | Quản lý tài khoản, CRUD đề (form + JSON báo lỗi theo đường dẫn), import JSON, upload, OCR ảnh/PDF + màn review | `/admin/users`, `/admin/tests`, `/admin/ocr` |
| 3. Làm bài R/L | Thư viện đề, chế độ thi/luyện (cả bài · một part · theo dạng câu), split view kéo được, 12 dạng câu, highlight + ghi chú, tự lưu, đồng hồ theo giờ server, tự nộp khi hết giờ, audio Listening | `/practice`, `/attempts/[id]` |
| 4. Chấm + kết quả | Chấm 12 dạng, bảng band tham khảo (admin sửa, có phiên bản), trang kết quả, xem lại bài, làm lại câu sai, lịch sử | `/results/[id]`, `/history`, `/admin/band-tables` |
| 5. Writing + Speaking | Viết bài (đếm từ, tự lưu, chặn dán khi thi), **ước lượng** Lexical/Grammar bằng LanguageTool + compromise, checklist TR/CC, so sánh bài; ghi âm Speaking; admin chấm tay | `/admin/grading` |
| 6. Tiến độ + từ vựng | Tổng quan (band 4 kỹ năng, xu hướng, dạng yếu, chuỗi ngày học, đề gợi ý), radar, sổ từ + flashcard SM-2, tra từ điển, lưu từ ngay trong bài đọc, cài đặt | `/dashboard`, `/vocabulary`, `/settings` |
| Bộ đề + .zip | Gom đề theo bộ sách (Cambridge 18…), bảng Test × kỹ năng, xuất bản cả bộ, xuất/nhập .zip (một đề hoặc cả bộ, kèm ảnh/audio); học viên luyện theo bộ → [docs/import-guide.md](docs/import-guide.md) | `/admin/tests`, `/practice` |

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

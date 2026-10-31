# Thiết kế: Icon app · Bộ đề theo sách · Nhập/xuất .zip

Ngày: 2026-10-31 · Trạng thái: chờ chủ dự án duyệt · Làm **trước** trình soạn đề
([2026-10-31-test-composer-design.md](2026-10-31-test-composer-design.md)).

## 1. Mục đích

Chủ dự án muốn BandUp **dùng như một app**: bấm một icon là mở, không thấy cửa sổ đen hay thanh địa chỉ; và **quản
lý đề theo bộ sách** (Cambridge 18 → Test 1–4) dễ dàng, kể cả **xuất/nhập** cả bộ để mang sang máy khác hoặc cất giữ.

Thành công =
- Bấm icon BandUp trên Desktop/taskbar → vài giây sau hiện cửa sổ app BandUp (logo đúng), đóng cửa sổ là tắt hẳn.
- Admin nhìn trang Đề thi là thấy ngay bộ nào đủ/thiếu Test/kỹ năng nào, xuất một bộ ra 1 file `.zip`, nhập file đó
  ở máy khác ra đúng các đề (Nháp).
- Học viên vào Luyện tập thấy các bộ sách, bấm vào bộ → Test 1–4 → chọn kỹ năng.

## 2. Mục tiêu / Không làm / Không được xảy ra

**Mục tiêu**
1. Icon + cửa sổ app (Edge chế độ app) + server chạy ẩn.
2. Gom đề theo **nguồn + số sách** (không thêm bảng); xem theo bộ ở admin và ở trang Luyện tập.
3. Xuất 1 đề hoặc cả bộ ra `.zip` (JSON + ảnh + audio); nhập `.zip` (1 hoặc nhiều đề) qua luồng nhập sẵn có.
4. Thao tác cả bộ: Xuất bộ, Xuất bản cả bộ, Thêm Test mới vào bộ.

**Không làm**
- Bộ đề tự đặt tên / một đề thuộc nhiều bộ (chủ dự án chọn "theo sách").
- Đóng gói Electron/Tauri, trình cài đặt `.exe`, tự cập nhật.
- Xuất bài làm/kết quả học viên (đã có `yarn run backup` cho việc sao lưu toàn bộ).
- Trình soạn đề (dự án riêng; nút "Thêm Test mới vào bộ" tạm mở màn Nhập JSON với thông tin bộ điền sẵn).

**Không được xảy ra**
- Nhập `.zip` ghi đè/xoá đề đang có hoặc tự xuất bản (luôn ra **phiên bản Nháp mới**, đúng luật M1).
- Học viên thấy đề Nháp/Lưu trữ trong trang theo bộ.
- File `.zip` lạ (đường dẫn `../`, file quá lớn, zip bomb) làm hỏng máy chủ.
- Đóng cửa sổ app mà server vẫn chạy ngầm chiếm cổng.

## 3. Ràng buộc

- Không đổi schema Prisma. Bộ = `(source, bookNumber)`; đề không có `bookNumber` → nhóm **"Đề lẻ"** theo nguồn.
- `TestImportDoc` giữ nguyên. Export dùng `exportTest()` có sẵn (trả `{ fileId }`); import dùng `testsService.importNew`
  + `adminFileResolver` có sẵn (khớp `{ path }` theo **tên file gốc**).
- Backend: route dùng `validate`, lỗi `AppError`, chỉ `*.service.ts` import prisma. Thư viện mới phải kiểm phiên bản
  trên npm (CLAUDE.md), `save-exact`.
- Frontend: token màu qua `tokens.css`; chữ trong `i18n/vi*.ts`; component `components/ui`.
- Máy chủ nhà: Windows 11, Edge có sẵn, Node 20.20, PostgreSQL dịch vụ Windows (xem README).

## 4. Các cách đã cân nhắc (chủ dự án chọn theo đề xuất)

| Việc | Đã chọn | Đã loại |
|---|---|---|
| Icon/cửa sổ | **Shortcut có icon → launcher chạy server ẩn → Edge `--app`** + web manifest | PWA thuần (server không tự bật); Electron/Tauri (nặng, phức tạp, không đáng cho app nội bộ 1 máy) |
| Zip | **Backend đóng/giải nén** rồi đi luồng nhập sẵn có | Đóng zip trong trình duyệt (phải tải audio về trình duyệt, chậm/tốn RAM) |
| Gom bộ | **API backend trả danh sách bộ** dùng chung admin + học viên | Gom ở trình duyệt (danh sách đang phân trang → gom thiếu) |

## 5. Thiết kế

### 5.1 Icon và cửa sổ app

- **Web manifest** `frontend/src/app/manifest.ts` (Next.js App Router): `name: "BandUp"`, `display: "standalone"`,
  `start_url: "/"`, màu nền/theme lấy từ token; icon PNG 192/512 + `apple-icon` sinh từ `app/icon.svg` (đặt trong
  `src/app/`, không vẽ lại logo).
- **`BandUp.ico`** (16–256 px) sinh từ cùng logo, đặt ở gốc repo cho shortcut.
- **Launcher** `scripts/app.mjs` (`npm run app`):
  1. Nếu cổng 30000 và 40000 đã có BandUp chạy → chỉ mở cửa sổ app.
  2. Ngược lại chạy như `npm run dev` (dùng lại logic `dev.mjs`, tách thành hàm dùng chung) nhưng **không in ra
     console**, ghi log vào `data/logs/app-<ngày>.log`.
  3. Chờ `http://localhost:30000/login` trả 200 → mở `msedge --app=http://localhost:30000 --user-data-dir=<data/edge-profile>`
     (profile riêng để biết chắc cửa sổ nào là của app và đóng là thoát).
  4. Khi tiến trình Edge đó thoát → tắt LanguageTool, API, web (killTree) rồi thoát.
  5. Server lỗi khi khởi động → hiện hộp thoại Windows báo lỗi + đường dẫn file log.
- **`BandUp.vbs`** (gốc repo): chạy `npm run app` không hiện cửa sổ console. **`BandUp.bat`** giữ nguyên cho ai muốn xem
  log trực tiếp.
- **Tạo shortcut**: `npm run shortcut` tạo `BandUp.lnk` trên Desktop (target `wscript BandUp.vbs`, icon `BandUp.ico`);
  người dùng tự ghim vào taskbar. Chạy theo yêu cầu, không tự cài vào khởi động Windows.
- Ở chế độ dev, lần mở đầu tiên Next.js biên dịch chậm (~10–20 s): cửa sổ app chỉ mở khi `/login` đã sẵn sàng.

### 5.2 Bộ đề

**Khoá bộ**: `setKey = "<source>-<bookNumber>"` (vd. `CAM-18`), hoặc `"<source>-none"` cho đề lẻ. Tên hiển thị:
`CAM` → "Cambridge {n}", `VOL` → "Volume {n}", `PRE_IELTS` → "Pre-IELTS {n}", `CUSTOM` → "Tự soạn {n}"; đề lẻ →
"{Nguồn} — đề lẻ".

**API admin** `GET /admin/test-sets?q=&source=` → danh sách bộ, mỗi bộ:
```
{ setKey, source, bookNumber, title, tests: [ { seriesKey, testNumber, title, type,
  latest: { id, status, version, skills[] }, published?: { id, version } } ] , counts: { draft, published } }
```
Mỗi `seriesKey` hiện **một dòng** (bản mới nhất + bản đang xuất bản nếu khác). Sắp xếp bộ: nguồn, rồi số sách giảm dần;
trong bộ theo `testNumber`.

**API học viên** `GET /catalog/sets` → chỉ đề **PUBLISHED**, mỗi Test kèm các kỹ năng và trạng thái đã làm (dùng lại
dữ liệu "đã làm" mà `/catalog` đang trả). Bộ không có đề đã xuất bản thì không hiện.

**Admin `/admin/tests`**: công tắc **Theo bộ | Danh sách** (nhớ lựa chọn trong `localStorage`). Theo bộ: mỗi bộ một thẻ
có bảng Test × kỹ năng (ô R/L/W/S có/không), huy hiệu trạng thái; nút trên thẻ: **Xuất bộ (.zip)**, **Xuất bản cả bộ**
(xuất bản các bản Nháp mới nhất đủ điều kiện, báo đề nào bị bỏ qua và lý do), **Thêm Test** (mở Nhập JSON với
`source`/`bookNumber`/`testNumber` kế tiếp điền sẵn; sau này mở trình soạn đề). Bấm dòng Test → trang đề như hiện nay.

**Học viên `/practice`**: mặc định **Theo bộ** (thẻ bìa từng bộ → mở bộ thấy Test 1–4, mỗi Test có nút kỹ năng
Listening/Reading/Writing/Speaking + dấu đã làm); vẫn giữ ô tìm kiếm và chế độ danh sách hiện tại.

### 5.3 Xuất `.zip`

- `GET /admin/tests/:id/export.zip` (1 đề) và `GET /admin/test-sets/:setKey/export.zip` (cả bộ; tham số
  `?include=latest|published`, mặc định `latest`).
- Cấu trúc file:
  ```
  bandup-export.json            # { format: "bandup-tests", formatVersion: 1, exportedAt, tests: ["cam18-t1-ac/test.json", …] }
  cam18-t1-ac/test.json         # TestImportDoc; mọi file tham chiếu dạng { "path": "assets/<tên>" }
  cam18-t1-ac/assets/<tên>      # ảnh/audio gốc
  ```
- `exportTest()` trả `{ fileId }`; bước đóng zip đổi thành `{ path: "assets/<fileId-8>-<tên gốc>" }` (tiền tố id để
  hai file trùng tên không đè nhau) và chép file từ Storage vào zip (stream, không đọc hết vào RAM).
- Tên file tải về: `BandUp-CAM-18-2026-10-31.zip` / `BandUp-cam18-t1-ac-v3.zip`.

### 5.4 Nhập `.zip`

- Màn **Nhập** hiện có nhận thêm `.zip` (kéo thả). `POST /admin/tests/import-zip` (+ `/validate` để kiểm trước).
- Server: giải nén vào thư mục tạm, đọc `bandup-export.json` (không có → coi mọi `*/test.json` và `*.json` ở gốc là đề),
  với **mỗi đề**: `parseTestImport` → `importNew` với assets của riêng thư mục đề đó (resolver khớp tên như hiện nay).
  Mỗi đề trong **transaction riêng**: đề lỗi không chặn đề khác; kết quả trả danh sách `{ seriesKey, ok, testId? ,
  issues? }`. Xoá thư mục tạm sau cùng.
- An toàn: từ chối entry có đường dẫn tuyệt đối/`..`; giới hạn tổng dung lượng giải nén (cấu hình `UPLOAD_MAX_ZIP_MB`,
  mặc định 1024) và số entry (2000); chỉ nhận đuôi json/ảnh/audio (kiểu file vẫn kiểm bằng magic bytes như hiện nay).
- Kiểm trước (`validate`) chỉ parse, không lưu, trả cùng định dạng kết quả.
- Đề nhập luôn là **Nháp phiên bản mới**; giao diện kết quả có nút "Xuất bản các đề hợp lệ".

### 5.5 Thư viện

Cần một thư viện zip chạy được với Node 20 cho cả ghi (stream) và đọc. Người làm chọn và **kiểm phiên bản trên npm**
(ứng viên: `yazl` + `yauzl`, hoặc `archiver` + `yauzl`); không dùng thư viện cần build native.

## 6. Kiểm thử

- Backend unit/integration (DB `*_test`): gom bộ (đề lẻ, nhiều phiên bản, chỉ PUBLISHED cho học viên); export → import
  **khứ hồi** cho đề có ảnh + audio ra cùng nội dung (so `exportTest` trước/sau, bỏ qua fileId); zip độc (`../`, quá
  dung lượng) bị từ chối; zip 2 đề, 1 đề lỗi → đề còn lại vẫn vào.
- Frontend unit: chuyển công tắc Theo bộ/Danh sách; hiển thị bảng Test × kỹ năng.
- E2E: admin xuất bộ mẫu → nhập lại → thấy phiên bản Nháp mới; học viên mở bộ → làm Test.
- Thủ công: bấm shortcut → cửa sổ app có logo; đóng → cổng 30000/40000/8010 được giải phóng.
- `npm run check` xanh cả hai dự án.

## 7. Phần để người làm tự quyết

- Thư viện zip cụ thể (sau khi kiểm npm), công cụ sinh PNG/ICO từ SVG (một lần, commit kết quả).
- Bố cục thẻ bộ theo `design/design-system.md` (D8); ảnh "bìa" bộ = khối màu + tên bộ (không dùng ảnh bìa sách thật).
- Tách logic khởi động dùng chung giữa `dev.mjs` và `app.mjs`.

## 8. Quyết định do Claude đưa ra (chủ dự án kiểm lại)

- Một Test = một `seriesKey`; nếu một bộ có cả bản AC và GT cùng số Test thì hiện thành 2 dòng.
- Xuất mặc định **bản mới nhất** (kể cả Nháp); có tuỳ chọn chỉ bản đã xuất bản.
- "Xuất bản cả bộ" bỏ qua đề chưa đủ điều kiện và liệt kê lý do, không dừng cả loạt.
- Cửa sổ app dùng **Edge** (luôn có trên Windows 11) với profile riêng trong `data/edge-profile` (không commit).
- Shortcut tạo bằng lệnh `npm run shortcut` do người dùng chạy, không tự thêm vào khởi động Windows.

# Thiết kế: Trình soạn đề trên web (Listening · Reading · Writing)

Ngày: 2026-10-31 · Trạng thái: chờ chủ dự án duyệt

## 1. Mục đích

Admin muốn **chép lại đề IELTS có sẵn** (Cambridge, đề free trên mạng) vào BandUp ngay trên web, không phải tự viết
file JSON hay chạy OCR. Hiện tại `/admin/tests` chỉ có **Nhập OCR** và **Nhập từ JSON**; sửa nội dung đề chỉ có một ô
JSON thô — admin phải thuộc cấu trúc `TestImportDoc`.

Thành công = admin mở trang, dán/điền một đề Reading 40 câu (3 passage) từ một trang web đề free, thấy ngay giao diện
học viên sẽ thấy, điền đáp án, xuất bản — không chạm vào JSON.

## 2. Mục tiêu / Không làm / Không được xảy ra

**Mục tiêu**
- Soạn đủ **Reading, Listening, Writing** bằng form; đủ **12 dạng câu hỏi** chuẩn IELTS.
- **Xem trước** trực tiếp đúng giao diện làm bài của học viên.
- **Dán nhanh**: dán một khối chữ chép từ web → tự tách thành nhóm câu, đoán dạng, tách câu/phương án.
- Upload ảnh (biểu đồ Writing Task 1, map/diagram, figure) và audio Listening ngay trong form.

**Không làm (đợt này)**
- Speaking: vẫn sửa bằng ô JSON như hiện nay (chủ dự án chỉ yêu cầu L/R/W).
- Không đổi định dạng `TestImportDoc`, database hay luật xuất bản/phiên bản hiện có.
- Không tải đề tự động từ URL (chỉ dán chữ người dùng tự copy).
- Không cộng tác nhiều người cùng sửa một đề.

**Không được xảy ra**
- Form sinh ra JSON khác với những gì backend chấp nhận (mọi lưu đều qua bộ kiểm Zod hiện có).
- Mất bài đang soạn khi lỡ đóng tab / bấm sang trang khác.
- Đáp án/transcript lộ ra trong khung xem trước giống như học viên (xem trước dùng DTO không chứa đáp án).

## 3. Ràng buộc (từ CLAUDE.md và code hiện có)

- Một định dạng duy nhất: `TestImportDoc` (`backend/src/shared/test-import.ts`, `question-types.ts`), đã chép sang
  `frontend/src/shared` bằng `yarn run sync-shared`. Form chỉnh **chính object này**.
- API có sẵn, đủ dùng cho tạo/sửa:
  - Tạo đề: `POST /admin/tests/import` (multipart) — gửi JSON dưới dạng một file `test.json`.
  - Sửa nội dung đề Nháp: `PUT /admin/tests/:id/content` `{ doc }` → trả lỗi theo đường dẫn field.
  - Upload file: `POST /admin/files` (`TEST_IMAGE` / `TEST_AUDIO`) → `fileId`; trong doc dùng `{ "fileId": "…" }`.
- Đề **đã xuất bản không sửa nội dung** (M1): trình soạn chỉ đọc với đề Đã xuất bản/Lưu trữ, kèm nút "Nhân bản thành
  bản mới" sẵn có.
- Frontend: màu/font chỉ qua `src/styles/tokens.css` (bị `check-tokens` kiểm); dùng các component `components/ui` sẵn có;
  chữ tiếng Việt đặt trong `i18n/vi-admin.ts`.
- Backend: route mới phải dùng `validate({...})`, lỗi `AppError`; chỉ `*.service.ts` được import prisma.
- Exam shell luôn giao diện sáng (D9).

## 4. Các cách đã cân nhắc

| Cách | Mô tả | Đánh đổi |
|---|---|---|
| A | Form theo cây Passage/Part → Nhóm → Câu, 12 form dạng câu, đồng bộ 2 chiều với JSON | Chắc, dễ bảo trì; chép đề vẫn phải dán từng câu |
| B | A + khung xem trước bằng component làm bài thật | +20–30% công; thấy ngay sai lệch với bản gốc |
| **C (đã chọn)** | B + **Dán nhanh** dùng lại bộ đoán dạng của OCR | Nhanh nhất khi chép đề online; cần 1 endpoint backend nhỏ; kết quả đoán không đúng 100% |

Chủ dự án chọn **C** vì việc chính là chép đề từ web — dán từng câu cho 40 câu × 3 kỹ năng quá chậm.

## 5. Thiết kế

### 5.1 Lối vào

- `/admin/tests`: thêm nút **"Soạn đề mới"** (cạnh Nhập OCR / Nhập từ JSON) → `/admin/tests/new`.
- `/admin/tests/new`: nhập thông tin đề (seriesKey, nguồn, loại AC/GT, tiêu đề, sourceRef, sách/test) + chọn kỹ năng
  sẽ soạn → mở trình soạn với doc rỗng. Lần **Lưu nháp** đầu tiên gọi import → chuyển sang `/admin/tests/[id]/compose`.
- `/admin/tests/[id]`: thêm nút **"Soạn bằng form"** → `/admin/tests/[id]/compose`. Ô JSON hiện có giữ nguyên.
- `seriesKey` tự gợi ý từ tiêu đề (vd. "Cambridge 18 – Test 2" → `cambridge-18-test-2`), sửa được.

### 5.2 Bố cục trang soạn (`/compose`)

```
┌ Thanh trên: tên đề · trạng thái · [Lưu nháp] [Xuất bản] · chỉ báo "Chưa lưu" ───────────────┐
├ Tab kỹ năng: Reading | Listening | Writing | JSON ─────────────────────────────────────────────┤
│ Cột trái (cây)          │ Cột giữa (form)                   │ Cột phải (xem trước)           │
│ Passage 1               │ form của mục đang chọn            │ giao diện học viên của          │
│   Nhóm 1–7  TFNG        │                                   │ passage/part đang chọn          │
│   Nhóm 8–13 Sentence    │                                   │                                 │
│ Passage 2 …             │                                   │ [Ẩn/hiện xem trước]             │
│ [+ Passage] [Dán nhanh] │                                   │                                 │
└─────────────────────────┴───────────────────────────────────┴─────────────────────────────────┘
```
- Màn hẹp (< 1280px): xem trước thành tab thứ ba thay vì cột.
- Cây: thêm/xoá/kéo đổi thứ tự passage/part và nhóm; mỗi mục hiện số câu + chấm đỏ nếu có lỗi.
- Tab **JSON**: dùng lại `JsonEditor` hiện có trên cùng object; sửa JSON hợp lệ → form cập nhật; JSON chưa parse được →
  khoá các tab form và báo lỗi cho đến khi sửa xong.

### 5.3 Trạng thái & lưu

- Một store (zustand, giống `exam-store`) giữ `doc` đang soạn + `dirty` + danh sách lỗi.
- **Kiểm lỗi trực tiếp** ở trình duyệt bằng chính schema Zod `TestImportDoc` (đã có trong `frontend/src/shared`), debounce
  ~300 ms; lỗi gắn vào ô theo đường dẫn field (cùng cơ chế `issuesOf` của `json-editor`). Lỗi "đủ điều kiện xuất bản"
  (đủ 40 câu, đủ passage/part/task) hiện thành danh sách ở thanh trên, bấm vào để nhảy tới.
- **Lưu nháp** thủ công (nút + Ctrl+S) — backend là nơi quyết định cuối cùng; lỗi backend trả về cũng gắn vào ô.
- **Bản nháp cục bộ**: mỗi thay đổi ghi `doc` vào `localStorage` theo khoá đề; mở lại trang mà bản cục bộ mới hơn bản
  server → hỏi "Khôi phục bản đang soạn dở?". Chặn rời trang khi `dirty` (beforeunload + chặn điều hướng nội bộ).
- Đánh số câu: thêm câu/nhóm tự lấy số tiếp theo; có nút **"Đánh số lại 1–40"** cho cả kỹ năng.

### 5.4 Form theo kỹ năng

**Reading — passage**: tiêu đề, hướng dẫn, phút gợi ý, danh sách đoạn (nhãn A/B/…, loại BODY/HEADING/SUBHEADING/
FIGURE+ảnh/FOOTNOTE). Ô "Dán cả bài đọc" tách đoạn theo dòng trống, tự gán nhãn A, B, C… nếu dòng bắt đầu bằng chữ cái
đơn (dùng lại `LABELLED_PARAGRAPH_RE`).

**Listening — part**: tiêu đề, audio (upload + nghe thử; `durationMs` tự đọc từ file), transcript (tuỳ chọn), nhóm câu.

**Writing — task**: Task 1 (kind ACADEMIC_REPORT / GT letter, đề bài, ảnh biểu đồ, loại biểu đồ `visual`, số từ tối
thiểu 150, phút 20) và Task 2 (ESSAY, đề bài, 250 từ, 40 phút); giá trị mặc định điền sẵn theo chuẩn.

### 5.5 Form 12 dạng câu hỏi

Phần chung mọi nhóm: dạng câu (đổi dạng → giữ lại hướng dẫn và số câu, xoá trường riêng sau khi xác nhận), hướng dẫn,
từ câu – đến câu (tự tính từ danh sách câu). Mỗi câu: giải thích (tuỳ chọn), bằng chứng (đoạn + trích dẫn, kiểm trích dẫn
có thật trong bài đọc), đáp án.

| Dạng | Form riêng |
|---|---|
| MULTIPLE_CHOICE_SINGLE | mỗi câu: câu hỏi + phương án A–D (thêm/bớt) + chọn đáp án bằng radio |
| MULTIPLE_CHOICE_MULTI | stem, phương án, `chooseCount`, tick các đáp án đúng; số câu tự = chooseCount |
| TRUE_FALSE_NOT_GIVEN / YES_NO_NOT_GIVEN | mỗi câu: phát biểu + 3 nút đáp án |
| MATCHING_HEADINGS | danh sách heading (i, ii, iii… tự đánh), ví dụ; mỗi câu: chọn đoạn + chọn heading |
| MATCHING_INFORMATION | nhãn đoạn lấy từ passage (tick chọn), cho dùng lại; mỗi câu: nội dung + chọn đoạn |
| MATCHING_FEATURES | biến thể (Features/Classification/Sentence endings), danh sách lựa chọn A–…; mỗi câu: nội dung + chọn |
| SENTENCE_COMPLETION | giới hạn từ; mỗi câu: câu có ô trống |
| SUMMARY_COMPLETION | đoạn tóm tắt; chế độ Từ (giới hạn từ) hoặc Ngân hàng từ (danh sách A–…) |
| NOTE_TABLE_FLOWCHART_COMPLETION | mẫu Notes / Table / Flowchart; chế độ trả lời như trên |
| SHORT_ANSWER | giới hạn từ; mỗi câu: câu hỏi |
| MAP_DIAGRAM_LABELLING | ảnh; chế độ Phương án (đặt ghim A–… bằng cách **bấm lên ảnh** để lấy toạ độ `at`) hoặc Từ; mỗi câu: nhãn/ghim |

**Ô trống `{{n}}`**: trong ô soạn câu/tóm tắt/notes, nút **"Chèn ô trống"** (và gõ `___` hoặc `…` rồi bấm chuyển) chèn
`{{n}}` với số câu kế tiếp; danh sách câu của nhóm tự sinh theo các `{{n}}` có trong văn bản.

**Table**: lưới ô sửa trực tiếp (thêm/bớt hàng, cột) sinh ra cấu trúc `template` TABLE; **Flowchart**: danh sách bước
theo thứ tự. (Cấu trúc chính xác của `template` theo `question-types.ts`.)

**Đáp án dạng chữ**: ô đáp án chuẩn (hỗ trợ `(the) museum`) + các biến thể chấp nhận (mỗi dòng một biến thể); cảnh báo
ngay nếu biến thể vượt giới hạn từ.

### 5.6 Xem trước

- Chuyển `doc` của passage/part đang chọn thành `ContentPart`/`ContentGroup` (DTO học viên, **không có đáp án**) bằng một
  hàm ở frontend `docToPreviewContent()`; id câu/đoạn tạm sinh ổn định từ số câu/vị trí.
- Render bằng component làm bài thật: `QuestionGroupView`, phần bài đọc, `PracticeListeningStrip`, phần Writing.
  `PassagePane` hiện phụ thuộc `attemptId` + API ghi chú → tách phần hiển thị đoạn văn ra component dùng chung (hoặc thêm
  chế độ `preview` không gọi API).
- `useExamStore` là store toàn cục: xem trước chạy trong một store **riêng** (provider/instance tách) để gõ thử đáp án
  trong xem trước không đụng bài thi thật. Nút "Xoá câu trả lời thử".
- Tuỳ chọn **"Hiện đáp án"** trong xem trước để đối chiếu với answer key gốc.

### 5.7 Dán nhanh

- Nút **Dán nhanh** trên cây (Reading: theo passage; Listening: theo part). Hộp thoại có ô dán lớn + chọn "Bài đọc" /
  "Câu hỏi" / "Cả hai".
- Backend: endpoint mới `POST /admin/tests/parse-text` `{ skill: 'READING' | 'LISTENING', text, firstQuestion? }` →
  `{ paragraphs?, groups[], warnings[] }`. Cài bằng cách tách khối theo dòng trống, chạy `guessTags` + phần dựng nhóm của
  `assembleDoc` trong `modules/ocr/assemble.ts` (tách phần dùng chung ra hàm thuần, OCR vẫn gọi như cũ). Không lưu gì.
- Kết quả hiện dạng **xem lại trước khi thêm**: danh sách nhóm đoán được (dạng, câu từ–đến, số phương án), sửa dạng nếu
  đoán sai, rồi "Thêm vào passage". Đáp án để trống → được đánh dấu "chưa có đáp án" trong cây.
- Thêm **Dán đáp án**: dán answer key kiểu `1 TRUE 2 FALSE 3 iv 14 (the) museum …` → điền vào các câu tương ứng; dòng nào
  không khớp số câu/dạng thì báo.
- Cải tiến bộ đoán (dùng chung cho OCR): nhận dạng thêm định dạng hay gặp trên web (số câu `1.`/`1)`/`Question 1`,
  ô trống `……`/`____`/`(1) ……`).

## 6. Kiểm thử

- Unit (frontend, Vitest): `docToPreviewContent`, chèn/đánh số `{{n}}`, parse answer key, đồng bộ form ↔ JSON cho từng
  dạng (mỗi dạng: dựng bằng form → `TestImportDoc.safeParse` thành công).
- Unit (backend): `parse-text` với các mẫu dán thật (đặt fixture chữ tự viết, không chép đề có bản quyền vào repo).
- E2E (Playwright): soạn một đề Reading ngắn từ đầu bằng form + Dán nhanh → lưu → xuất bản → học viên thấy đề ở
  `/practice`.
- `yarn run check` cả hai dự án phải xanh.

## 7. Phần để người làm tự quyết

- Chia component/thư mục (`components/admin/composer/…`), tên route nội bộ.
- Thư viện kéo-thả trong cây: dùng `@dnd-kit` đã có.
- Chi tiết UI từng form theo `design/design-system.md` (D8).
- Thứ tự làm đề xuất: (1) khung trang + store + Writing, (2) Reading + 12 form, (3) Listening + audio, (4) xem trước,
  (5) Dán nhanh + Dán đáp án.

## 8. Quyết định do Claude đưa ra (chủ dự án kiểm lại)

- Lưu **thủ công** + bản nháp cục bộ, không tự lưu lên server (tránh tạo lỗi validate liên tục trên đề Nháp).
- Speaking không có form đợt này.
- Đề đã xuất bản: trình soạn chỉ đọc + "Nhân bản thành bản mới".
- Tạo đề mới bằng endpoint import sẵn có (gửi JSON như một file), không thêm endpoint tạo riêng.
- Endpoint mới duy nhất: `parse-text`.

# Spec gốc — IELTS Internal Practice System

> Bản spec chủ dự án đưa ra lúc bắt đầu (giữ nguyên văn). Các quyết định đã duyệt ở Giai đoạn 0 ghi đè một số
> điểm (Node 20/Next 16/không MinIO/hai dự án độc lập…) — xem [CLAUDE.md](../CLAUDE.md).

## 0. VAI TRÒ & CÁCH LÀM VIỆC
Bạn là senior full-stack engineer (TypeScript). Hãy xây dựng web app luyện thi IELTS lưu hành NỘI BỘ (1–5 người dùng, không public, không thương mại hóa) cho một học viên (em Đạt).

Quy tắc làm việc (bắt buộc):
1. Luôn lên KẾ HOẠCH trước (cấu trúc thư mục, schema, danh sách việc, rủi ro, câu hỏi cần tôi quyết), chờ tôi trả lời "OK" rồi mới code.
2. Chỉ làm đúng giai đoạn tôi yêu cầu. Không tự làm lan sang giai đoạn sau.
3. Cuối mỗi giai đoạn: chạy được bằng `docker compose up -d` + `pnpm dev`; test xanh; cập nhật README; liệt kê rõ cái gì đã xong / chưa xong / nợ kỹ thuật.
4. Không bịa thư viện, API hay số liệu. Không chắc thì nói rõ và đề xuất cách kiểm chứng. Trước khi thêm dependency, kiểm tra nó còn được bảo trì và license cho phép.
5. TypeScript `strict: true`, không dùng `any` trừ khi có lý do ghi chú. ESLint + Prettier. Commit nhỏ, theo Conventional Commits.
6. Khi gặp quyết định thiết kế mơ hồ, hỏi tôi tối đa 3 câu gộp một lần, đừng hỏi lắt nhắt.

## 1. MỤC TIÊU SẢN PHẨM
- Làm đề IELTS Reading / Listening / Writing với giao diện mô phỏng bài thi IELTS trên máy tính (computer-delivered); Speaking giai đoạn đầu chỉ ghi âm.
- Tự chấm Reading/Listening, quy ra band.
- Writing: hỗ trợ chấm bằng thư viện (CHƯA dùng AI/LLM), thiết kế sẵn interface để cắm AI sau này.
- Theo dõi tiến độ, sổ từ vựng.
- Nhập đề từ ảnh/PDF bằng OCR, có màn hình admin review và sửa trước khi lưu.
- Nguồn đề theo thứ tự ưu tiên: CAM → VOL → Pre-IELTS (lưu ở trường `source`, lọc được).

## 2. TECH STACK (CỐ ĐỊNH)
Monorepo: pnpm workspaces + Turborepo.

```
apps/web            Next.js 15 (App Router) + TypeScript
apps/api            Node.js + Express 5 + TypeScript
packages/shared     Zod schema + type dùng chung web/api
packages/scoring    Chấm điểm + quy đổi band (TS thuần, test bằng Vitest)
packages/ocr-import Pipeline OCR → JSON đề
design/             Thiết kế từ Claude Design (xem mục 4)
```

Frontend: Tailwind CSS v4, shadcn/ui (Radix), Motion (framer-motion), Zustand, TanStack Query, TanStack Table (chỉ cho admin), Recharts, Sonner, Lucide, react-resizable-panels (qua shadcn Resizable), @dnd-kit, web-highlighter. KHÔNG dùng Ant Design hay UI kit kiểu admin-template.

Backend: Express 5, zod, helmet, cors, express-rate-limit, pino, multer, argon2, jsonwebtoken. Cấu trúc theo module: routes → controller → service → Prisma. Chỉ service được gọi Prisma. Mọi request đi qua middleware `validate(zodSchema)`. Error handler tập trung, trả lỗi dạng thống nhất `{ error: { code, message, details? } }`.

DB: PostgreSQL + Prisma. Khung đề dùng bảng quan hệ; phần đặc thù từng loại câu hỏi dùng cột `Json` được validate bằng Zod discriminated union ở `packages/shared`.

Auth: JWT access + refresh trong cookie httpOnly, argon2, role `ADMIN` / `STUDENT`. KHÔNG có đăng ký công khai; admin tạo tài khoản hoặc seed.

Hạ tầng: Docker Compose gồm `postgres`, `languagetool` (image `erikvl87/languagetool`), `minio` (tùy chọn; mặc định lưu file ở local volume qua interface `Storage`).

Test: Vitest (scoring + service), Supertest (API), Playwright (luồng: đăng nhập → làm đề mẫu → nộp → xem kết quả).

Ngôn ngữ: UI app bằng tiếng Việt; nội dung bài thi tiếng Anh. Chuẩn bị i18n tối thiểu (file chuỗi tách riêng).

## 3. QUY TẮC PHÁP LÝ & NỘI DUNG
- KHÔNG đưa nội dung đề có bản quyền (Cambridge, v.v.) vào repo. Chỉ seed MỖI KỸ NĂNG một đề mẫu tự viết (dummy) để chạy thử. Ghi `data/` vào `.gitignore` cho đề thật.
- Tách phần mềm khỏi nội dung: đề nhập qua JSON/OCR vào DB, không hard-code trong code.
- Giao diện thi mô phỏng theo bố cục của bài thi IELTS máy thật; TỰ viết toàn bộ CSS/icon/asset. Không copy code, logo, hình, text của website thương mại nào.
- Mọi code tham khảo từ repo mã nguồn mở khác phải kiểm tra license và ghi nguồn trong comment; mặc định hãy tự viết lại.

## 4. THIẾT KẾ GIAO DIỆN & HANDOFF TỪ CLAUDE DESIGN
Thiết kế đang được làm riêng bằng Claude Design và sẽ được thả vào `design/` (ảnh các màn hình, design tokens, ghi chú, có thể kèm file HTML/CSS tham chiếu). Cho tới khi thư mục này có nội dung:
- Dùng token TẠM, tập trung hoàn toàn ở một nơi (CSS variables trong `apps/web/src/styles/tokens.css` + Tailwind theme). KHÔNG hard-code màu/font/radius/shadow ở component. Nhờ vậy khi có thiết kế thật chỉ cần thay token và tinh chỉnh component.
- Tạm dùng: font UI Be Vietnam Pro, serif cho bài đọc Newsreader, nền ấm, một màu nhấn (đặt tên token theo vai trò: `--accent`, `--surface`, `--ink`, không đặt theo tên màu).

Khi `design/` có nội dung: đọc kỹ ảnh và tokens, bám sát thiết kế; nếu thiết kế mâu thuẫn với khả năng của Tailwind/shadcn hoặc với quy tắc bên dưới, báo tôi thay vì tự ý bỏ.

Nguyên tắc giao diện (áp dụng dù thiết kế ra sao):
- Hai vùng: **Exam shell** (Reading/Listening/Writing: bám bố cục và hành vi thi máy thật, tinh tế, ít phân tâm, KHÔNG animation trang trí) và **Study shell** (đăng nhập, dashboard, kết quả, từ vựng: đẹp, có cá tính, bento grid, thẻ bo lớn, bóng mềm).
- Light/dark cho Study shell. Responsive tốt trên laptop, dùng được trên tablet.
- Tương phản WCAG AA, focus rõ, tôn trọng `prefers-reduced-motion`.
- Component điểm nhấn tự viết: thẻ band score có animation đếm số, radar chart 4 kỹ năng, heatmap streak, flashcard lật, thanh điều hướng câu hỏi dưới cùng của Exam shell.
- Font tự host qua `next/font`, hỗ trợ tiếng Việt.

## 5. MÔ HÌNH DỮ LIỆU (Prisma + Zod)
Thiết kế chi tiết trong Giai đoạn 0, tối thiểu phải mô tả được:
- `User` (role, targetBand, examDate), `Test` (source, title, type ACADEMIC/GENERAL, version, status DRAFT/PUBLISHED).
- `Section` theo kỹ năng: READING (3 passage, 60 phút), LISTENING (4 part, ~30 phút), WRITING (Task 1 + Task 2, 60 phút), SPEAKING (Part 1–3).
- `Passage` (tiêu đề, các đoạn có nhãn A, B, C…), `Audio` (file, part, thời lượng).
- `QuestionGroup` (loại, hướng dẫn, phạm vi số câu, `config Json`) với các loại: MULTIPLE_CHOICE_SINGLE, MULTIPLE_CHOICE_MULTI, TRUE_FALSE_NOT_GIVEN, YES_NO_NOT_GIVEN, MATCHING_HEADINGS, MATCHING_INFORMATION, MATCHING_FEATURES, SENTENCE_COMPLETION, SUMMARY_COMPLETION (có/không word bank), NOTE_TABLE_FLOWCHART_COMPLETION, SHORT_ANSWER, MAP_DIAGRAM_LABELLING.
- `Question` (số thứ tự, nội dung, đáp án đúng, danh sách đáp án chấp nhận như `["colour","color"]`, giới hạn từ, giải thích).
- `Attempt` (mode EXAM/PRACTICE, startedAt, deadline theo giờ server, status), `Answer`, `Annotation` (highlight/note gắn theo vị trí văn bản), `WritingSubmission`, `SpeakingRecording`, `Vocabulary` (+ trạng thái SM-2), `StudyStat`.
- `OcrJob` (file gốc, text thô, trạng thái, kết quả review).
- Mọi bảng có `createdAt/updatedAt`; index cho truy vấn thường dùng (theo user, theo test, theo thời gian).

## 6. CÁC GIAI ĐOẠN

### Giai đoạn 0 — Kế hoạch (CHƯA CODE)
Trả về: cây thư mục, schema Prisma + Zod đầy đủ, danh sách endpoint, chiến lược auth/cookie, chiến lược lưu file, rủi ro, và các điểm cần tôi quyết. Chờ "OK".

### Giai đoạn 1 — Nền tảng
Monorepo, Docker Compose, Prisma + migration + seed, auth + phân quyền, middleware chung, logging, token giao diện tạm + layout shell (Exam shell / Study shell rỗng), CI cơ bản (lint, typecheck, test), README.

### Giai đoạn 2 — Admin nhập đề
- CRUD đề theo schema; import đề từ file JSON (validate bằng Zod, báo lỗi rõ theo đường dẫn field).
- OCR (`packages/ocr-import`): ảnh → `sharp` tiền xử lý → `tesseract.js` (tiếng Anh); PDF có text → `pdfjs-dist`/`pdf-parse` lấy trực tiếp, PDF scan → OCR. OCR chạy ở background job (hàng đợi đơn giản trong process hoặc bảng `OcrJob`), không chặn request.
- Kết quả OCR KHÔNG tự vào DB. Màn hình review: ảnh gốc bên trái, text sửa được bên phải, chọn đoạn text → gán thành passage / câu hỏi / lựa chọn; nhập answer key dạng danh sách 1–40; bấm Publish thì mới tạo `Test` hợp lệ.
- Upload: giới hạn loại và dung lượng file, kiểm tra magic bytes.

### Giai đoạn 3 — Exam shell: Reading + Listening
- Header: tên bài, đồng hồ đếm ngược (đổi màu còn 5 phút/1 phút), ẩn/hiện đồng hồ, chỉnh cỡ chữ.
- Reading: chia đôi (passage trái, câu hỏi phải), kéo thanh chia, mỗi passage một tab; mọi loại câu hỏi ở mục 5 đều có component riêng; kéo thả dùng @dnd-kit và có cách click-chọn thay thế.
- Highlight + note gắn với đoạn chọn, lưu theo attempt, khôi phục được khi tải lại.
- Thanh điều hướng dưới: nút 1–40 gom theo passage/part, trạng thái answered / unanswered / flagged / current; Next/Previous; đánh dấu review.
- Listening: Exam mode (phát một lần, không tua/pause) và Practice mode (tua/lặp tự do); preload audio; chỉnh âm lượng.
- Trạng thái làm bài lưu liên tục (autosave debounce + khi đổi câu); refresh không mất bài; deadline tính theo giờ SERVER; hết giờ tự nộp; xác nhận khi nộp sớm.
- Chế độ luyện: cả đề, từng passage/part, hoặc theo loại câu hỏi.

### Giai đoạn 4 — Chấm điểm + kết quả
- `packages/scoring`: chấm theo đáp án; chuẩn hóa (trim, không phân biệt hoa/thường, khoảng trắng thừa); đáp án chấp nhận được nhiều biến thể; multi-select so theo tập hợp; kiểm tra giới hạn số từ và cảnh báo khi vượt.
- Bảng quy đổi raw → band nằm trong file cấu hình JSON, tách Academic Reading / General Reading / Listening; KHÔNG hard-code trong logic. Điền bảng tham khảo phổ biến và ghi chú rõ đây là bảng tham khảo, admin chỉnh được (tôi sẽ tự đối chiếu nguồn chính thức).
- Unit test đầy đủ cho từng loại câu hỏi và các ca biên.
- Màn kết quả (Study shell): band + raw score có animation đếm số, đúng/sai từng câu (đáp án của em vs đáp án đúng, giải thích), độ chính xác theo loại câu hỏi, thời gian từng passage, xem lại bài kèm highlight/note.

### Giai đoạn 5 — Writing + Speaking (chưa AI)
Writing:
- Giao diện soạn bài giống thi máy: đề trái (Task 1 có hình), editor phải, đếm từ realtime, đồng hồ, cảnh báo thiếu từ (Task 1 < 150, Task 2 < 250), autosave. Chặn paste là tùy chọn trong Exam mode.
- Interface `WritingEvaluator` (input: đề, bài viết, loại task; output: danh sách lỗi, chỉ số, band ước lượng theo 4 tiêu chí, nhận xét). Cài đặt `LibraryWritingEvaluator`; thiết kế để thêm `LlmWritingEvaluator` sau mà không phải sửa UI.
- `LibraryWritingEvaluator`: gọi LanguageTool (en-GB/en-US cấu hình được) lấy lỗi ngữ pháp/chính tả/văn phong, gạch chân lỗi và gợi ý sửa; chỉ số bằng `wink-nlp` hoặc `compromise` (số từ, số câu, độ dài câu TB, type-token ratio, tỉ lệ từ lặp, số từ nối, xấp xỉ câu phức/ghép); band ước lượng theo heuristic đơn giản.
- BẮT BUỘC hiển thị nhãn "ƯỚC LƯỢNG, không thay thế giám khảo" và nêu chỉ số dẫn tới kết quả. Task Response và Coherence không thể chấm đúng bằng thư viện nên chỉ có checklist để người học/người dạy tự tick.
- Admin nhập nhận xét và band thủ công; lưu lịch sử, so sánh các lần viết.

Speaking:
- Hiển thị đề Part 1/2/3; Part 2 có 1 phút chuẩn bị + 2 phút nói; ghi âm bằng `MediaRecorder`, upload, nghe lại, admin nhận xét thủ công. Chừa interface `SpeakingEvaluator`, chưa cài AI.

### Giai đoạn 6 — Tiến độ & từ vựng & hoàn thiện
- Dashboard: band theo thời gian cho từng kỹ năng, điểm yếu theo loại câu hỏi, streak, mục tiêu band + đếm ngược ngày thi, "tiếp tục bài đang dở", gợi ý đề tiếp theo, lọc theo nguồn (CAM/VOL/Pre-IELTS) và đánh dấu đã làm.
- Sổ từ vựng: chọn từ trong passage để lưu (từ, nghĩa, câu ví dụ từ ngữ cảnh gốc), flashcard + SM-2 đơn giản; tra nghĩa bằng free dictionary API có cache (không bắt buộc).
- Hoàn thiện giao diện theo `design/`, trang đăng nhập, trạng thái rỗng/lỗi/loading, e2e test, tài liệu.

## 7. YÊU CẦU PHI CHỨC NĂNG
- Bảo mật: argon2, rate limit đăng nhập, validate mọi input bằng Zod, CORS cấu hình rõ, cookie httpOnly + SameSite, helmet, không log dữ liệu nhạy cảm, upload an toàn.
- Mọi dịch vụ ngoài (LanguageTool, OCR, Storage, evaluator AI) nằm sau interface để thay thế được; cấu hình bằng biến môi trường, có `.env.example`.
- Hiệu năng: autosave debounce, không chặn UI; phân trang cho danh sách; tránh N+1 query (dùng `include/select` có chủ đích).
- Sao lưu: script `pg_dump` đơn giản + hướng dẫn restore.
- Tài liệu: README gốc, tài liệu schema đề, hướng dẫn nhập đề (JSON/OCR), hướng dẫn thêm evaluator AI về sau, hướng dẫn thay token thiết kế.

## 8. NGOÀI PHẠM VI
Thanh toán, đăng ký công khai, mạng xã hội, huấn luyện/fine-tune model, nội dung đề bản quyền trong repo. Phần AI chấm điểm làm ở giai đoạn sau, hiện chỉ chừa interface.

## 9. ĐỊNH NGHĨA "XONG" CHO MỖI GIAI ĐOẠN
- Chạy được từ máy sạch bằng README.
- Lint, typecheck, test đều xanh.
- Không còn TODO không có ghi chú; nợ kỹ thuật được liệt kê.
- Có demo bằng đề mẫu (dummy) đi trọn luồng của giai đoạn đó.

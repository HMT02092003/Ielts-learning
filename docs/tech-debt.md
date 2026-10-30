# Nợ kỹ thuật (cập nhật cuối Giai đoạn 6 — 30/10/2026)

| # | Nợ | Lý do / kế hoạch |
|---|---|---|
| 1 | Backend chạy bằng `tsx` cả khi chạy thật, không build/bundle | Đơn giản cho app nội bộ; thêm build (tsc/tsdown) khi cần triển khai |
| 2 | Node 20 đã hết hỗ trợ bảo mật (EOL 30/04/2026); vì vậy pdfjs-dist 4, file-type 21, music-metadata 11, Vitest 4 | Nâng Node 22/24 rồi nâng các gói này |
| 3 | `argon2` pin 0.44.0 (0.45.x lỗi prebuild Windows) | Thử lại khi có 0.45.2+ |
| 4 | Next.js 16.4.3 — có đợt vá bảo mật công bố 03/11/2026 | Nâng bản vá ngay sau ngày đó |
| 5 | Chặn trang /admin phía server dựa vào GET /auth/me; nếu access token vừa hết hạn thì để lớp kiểm tra phía client xử lý (vẫn ra 404) | Đủ dùng; API luôn chặn thật |
| 6 | CI GitHub Actions có sẵn nhưng chưa chạy trên remote | Chờ chủ dự án chỉ định nhánh |
| 7 | `next/font/google` tải font lúc build (cần mạng) | Nếu build offline: chuyển `next/font/local` |
| 8 | `LISTENING_REVIEW_SEC=120` chưa đối chiếu nguồn chính thức | Kiểm và sửa trong `.env` |
| 9 | Bảng band là bảng tham khảo (IDP + magoosh), dưới band 2.5 đặt 0 | Admin đối chiếu và sửa ở `/admin/band-tables` |
| 10 | Listening EXAM phát audio stream (Range), chưa preload toàn bộ thành Blob trước khi bắt đầu | Mạng chậm có thể giật; thêm preload nếu cần |
| 11 | Highlight chỉ trong một đoạn văn (không kéo chọn qua nhiều đoạn), chỉ cho passage — chưa cho đề câu hỏi | Mở rộng `targetKind` QUESTION/GROUP (schema đã có) |
| 12 | Luyện "theo dạng câu" chỉ trong một đề (M8) | Thêm luyện xuyên nhiều đề |
| 13 | Band Lexical/Grammar ước lượng là heuristic tự đặt (ngưỡng trong `library-evaluator.ts`), không phải band descriptor | Luôn gắn nhãn "ƯỚC LƯỢNG"; hiệu chỉnh khi có dữ liệu admin chấm |
| 14 | Đánh giá Writing chạy nền trong process (không qua hàng đợi); restart giữa chừng để lại dòng `RUNNING` | Học viên bấm "Phân tích lại"; có thể chuyển sang `PollingWorker` |
| 15 | Ghi âm Speaking: file trùng nội dung (sha256) được dùng lại kể cả giữa hai người | Gần như không xảy ra với ghi âm thật; tách theo người nếu cần |
| 16 | `StudyStat` chỉ tính lại khi nộp bài / ôn thẻ / mở Tổng quan; thời gian học = thời gian đo trong bài làm | Đủ cho heatmap/streak; thêm tính lại định kỳ nếu cần |
| 17 | Đổi theme trong `/settings` lưu vào hồ sơ nhưng nút Giao diện ở header vẫn dùng cookie riêng | Đồng bộ hai nơi |
| 18 | Tra từ phụ thuộc `dictionaryapi.dev` (cần Internet), không có nghĩa tiếng Việt | Nghĩa tiếng Việt học viên tự nhập |
| 19 | CSS `::highlight()` bị Lightning CSS cảnh báo lúc build (vẫn giữ trong bản build) | Bỏ qua cảnh báo; hết khi Lightning CSS hỗ trợ |
| 20 | Màn hình P2–P6 thiếu trong `design/` | Dựng từ design-system (D8); chờ chủ dự án duyệt qua ảnh chụp |

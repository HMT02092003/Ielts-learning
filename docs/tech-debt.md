# Nợ kỹ thuật (cập nhật cuối Giai đoạn 1)

| # | Nợ | Lý do / kế hoạch |
|---|---|---|
| 1 | Backend chạy bằng `tsx` cả khi chạy thật, không build/bundle | Đơn giản cho app nội bộ; thêm build (tsc/tsdown) khi cần triển khai |
| 2 | Node 20 đã hết hỗ trợ bảo mật (EOL 30/04/2026) | Chủ dự án chọn giữ Node của máy; nâng Node 22/24 khi tiện (đổi pnpm 11, Vitest 5) |
| 3 | `argon2` pin 0.44.0 (0.45.x lỗi prebuild Windows) | Thử lại khi có 0.45.2+ |
| 4 | Next.js 16.4.3 — có đợt vá bảo mật công bố 03/11/2026 | Nâng bản vá ngay sau ngày đó |
| 5 | Chưa seed bảng quy đổi band | Giai đoạn 4 điền bảng tham khảo (ghi rõ là tham khảo) |
| 6 | Guard trang Admin ở web chỉ phía client (API đã chặn thật bằng 404) | Đủ cho P1; có thể chuyển sang server component ở P6 |
| 7 | CI GitHub Actions có sẵn nhưng repo chưa có remote/commit | Chờ chủ dự án chỉ định nhánh |
| 8 | `next/font/google` tải font lúc build (cần mạng) | Nếu build offline: chuyển `next/font/local` + file Fontsource |
| 9 | Màn hình P2–P6 thiếu trong `design/` | Dựng từ design-system, duyệt qua `/dev/styleguide` (quyết định D8) |
| 10 | `LISTENING_REVIEW_SEC=120` (thời gian review cuối Listening) chưa đối chiếu nguồn chính thức | Kiểm ở P3 |

# Token thiết kế — cách thay đổi

Nguồn thiết kế: `design/design-system.md` (hướng C · "lặng", v1.0). Trong code, **mọi** màu, font, bo góc,
bóng và thời gian chuyển động chỉ nằm ở một chỗ:

| File | Vai trò |
|---|---|
| `frontend/src/styles/tokens.css` | Giá trị token theo **vai trò** (`--surface`, `--ink`, `--accent`…), sáng + tối |
| `frontend/src/styles/globals.css` | Map token → class Tailwind v4 (`@theme inline`), thang chữ, bo góc |
| `frontend/src/styles/fonts.ts` | Font tự host qua `next/font` (Be Vietnam Pro, Lexend, Newsreader — subset vietnamese) |

## Đổi màu / font

1. Sửa giá trị trong `tokens.css` (khối sáng **và** khối `.dark`). Không đổi tên token.
2. `corepack pnpm check` trong `frontend/` — test `tokens-contrast.test.ts` kiểm lại tương phản WCAG AA.
3. Mở `/dev/styleguide` để duyệt bằng mắt (cả sáng/tối).

## Quy tắc

- Component **không** viết mã màu/rgb (script `scripts/check-tokens.mjs` chặn trong `pnpm check`).
- Tailwind palette mặc định bị tắt (`--color-*: initial`) nên `bg-red-500` không tồn tại.
- Exam shell (`.exam-mode`) và Admin (`.force-light`) luôn dùng bộ token sáng, kể cả khi `<html class="dark">`.
  Vì thế token dẫn xuất (alias shadcn, `--ring-focus`, `color-mix`) được khai báo lại ở mọi scope.
- **Xung đột với shadcn (đã báo chủ dự án):** shadcn dùng `--accent`/`bg-accent` cho *nền hover*, còn thiết kế này
  dùng `--accent` cho *màu thương hiệu*. Sau mỗi lần thêm component shadcn, đổi `hover:/focus:/data-[highlighted]:bg-accent`
  thành `bg-surface-muted` (check-tokens sẽ báo nếu quên).
- Chuyển động: chỉ Study shell; `prefers-reduced-motion` được tôn trọng; Exam shell tắt hoàn toàn.

## Điểm lệch giữa thiết kế và spec đã chốt

Xem bảng 25 mục trong kế hoạch Giai đoạn 0 (mục 9.1). Tóm tắt: theo thiết kế về màu/font/bóng; theo spec về
font tự host, dark mode chỉ Study shell, mốc đồng hồ 5 **và** 1 phút, Login không lộ dữ liệu cá nhân.

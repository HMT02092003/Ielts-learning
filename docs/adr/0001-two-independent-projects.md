# ADR 0001 — Hai dự án độc lập thay cho monorepo

**Trạng thái:** đã chấp nhận (29/10/2026, quyết định D11 của chủ dự án)

**Bối cảnh.** Spec ghi monorepo pnpm workspaces + Turborepo (`apps/*`, `packages/*`). Chủ dự án yêu cầu cấu trúc
"đúng kiểu một dự án backend Node.js và một dự án Next.js", chọn hai dự án độc lập, backend chia theo module.

**Quyết định.** `backend/` và `frontend/` là hai dự án riêng (package.json, lockfile, cấu hình, test riêng).
Phần dùng chung (`packages/shared`, `packages/scoring`, `packages/ocr-import` trong spec) chuyển thành:
- `backend/src/shared/` — hợp đồng Zod + type (chỉ phụ thuộc `zod`), **nguồn duy nhất**;
- `frontend/src/shared/` — bản sinh bằng `pnpm sync-shared`, `pnpm check` báo lỗi nếu lệch;
- `backend/src/lib/scoring/`, `backend/src/lib/ocr/` (P2) — thư viện nội bộ của backend.

**Hệ quả.** Không cần workspace/turbo; mỗi dự án chạy `pnpm dev` riêng (hai terminal). Đổi lại phải nhớ chạy
`sync-shared` sau khi sửa hợp đồng (đã có kiểm tra tự động).

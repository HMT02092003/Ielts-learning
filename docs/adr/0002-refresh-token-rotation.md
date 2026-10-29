# ADR 0002 — Refresh token opaque, xoay vòng có grace window

**Trạng thái:** đã chấp nhận (Giai đoạn 1)

**Quyết định.**
- Refresh token là 32 byte ngẫu nhiên (không phải JWT); DB chỉ lưu sha256 (`RefreshToken.tokenHash`).
- Mỗi lần refresh: đánh dấu token cũ `rotatedAt` bằng compare-and-set, cấp token mới cùng `familyId`.
- Token đã xoay vẫn được chấp nhận lại trong `REFRESH_ROTATION_GRACE_SECONDS` (30s) → cấp token "anh em".
  Xử lý trường hợp hai tab refresh cùng lúc hoặc response bị mất.
- **Không** có reuse detection (không revoke cả family khi thấy token cũ) — đánh đổi chấp nhận được cho app
  nội bộ 1–5 người; token bị lộ chỉ dùng được tới khi bị xoay.
- Hạn trượt 30 ngày, hạn tuyệt đối của family 90 ngày. Logout revoke family hiện tại; logout-all / đổi mật khẩu /
  vô hiệu hóa tài khoản revoke các family khác hoặc tất cả.
- Access JWT 15 phút, nhưng cookie access sống bằng refresh để web không đá người dùng ra khi JWT vừa hết;
  client refresh trong suốt khi nhận `AUTH_TOKEN_EXPIRED`.

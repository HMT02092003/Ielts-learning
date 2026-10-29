# Sao lưu & khôi phục

Chạy trong `backend/` (Docker Compose phải đang chạy):

```powershell
corepack pnpm backup                    # → data/backups/<thời-điểm>/
corepack pnpm restore                   # khôi phục bản mới nhất (hỏi xác nhận)
corepack pnpm restore 2026-10-29T09-58-40-064Z --yes   # bản cụ thể, không hỏi
```

Mỗi bản sao lưu gồm:
- `db.dump` — `pg_dump -Fc` của database `POSTGRES_DB` (lấy qua `docker compose exec`, ghi bằng Node nên
  PowerShell không làm hỏng file nhị phân);
- `storage/` — bản sao `data/storage` (audio, ảnh, bản ghi Speaking…);
- `manifest.json` — thời điểm, kích thước, sha256 của dump, số file.

Khôi phục kiểm sha256 trước, rồi `pg_restore --clean --if-exists` và chép lại `data/storage`.
**Khôi phục ghi đè dữ liệu hiện tại** — chỉ làm khi chắc chắn.

`data/` không nằm trong git. Nên chép `data/backups` sang ổ khác/đám mây định kỳ.

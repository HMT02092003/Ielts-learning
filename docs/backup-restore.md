# Sao lưu & khôi phục

Chạy trong `backend/` (dịch vụ PostgreSQL trên máy phải đang chạy). Dùng `pg_dump`/`pg_restore` trong
`C:\Program Files\PostgreSQL\17\bin`, hoặc thư mục đặt ở `PG_BIN` trong `backend/.env`:

```powershell
yarn run backup                    # → data/backups/<thời-điểm>/
yarn run restore                   # khôi phục bản mới nhất (hỏi xác nhận)
yarn run restore 2026-10-29T09-58-40-064Z --yes   # bản cụ thể, không hỏi
```

Mỗi bản sao lưu gồm:
- `db.dump` — `pg_dump -Fc` của database trong `DATABASE_URL` (ghi bằng Node nên
  PowerShell không làm hỏng file nhị phân);
- `storage/` — bản sao `data/storage` (audio, ảnh, bản ghi Speaking…);
- `manifest.json` — thời điểm, kích thước, sha256 của dump, số file.

Khôi phục kiểm sha256 trước, rồi `pg_restore --clean --if-exists` và chép lại `data/storage`.
**Khôi phục ghi đè dữ liệu hiện tại** — chỉ làm khi chắc chắn.

`data/` không nằm trong git. Nên chép `data/backups` sang ổ khác/đám mây định kỳ.

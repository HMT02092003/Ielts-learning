# Hướng dẫn nhập đề

Hai cách, đều ra **đề Nháp** để kiểm tra trước khi học viên thấy. Đề thật (CAM/VOL…) chỉ để trên máy / trong DB —
**không** commit vào git (thư mục `data/` đã bị bỏ qua).

## 1. Nhập từ JSON (nhanh, chính xác nhất)

1. Soạn file theo [test-schema.md](test-schema.md) (mẫu: `backend/prisma/seed/fixtures/*.json`).
2. **Quản trị → Đề thi → Nhập JSON / .zip**, chọn file `.json` cùng các ảnh/audio mà JSON tham chiếu
   (`"path": "assets/part1.mp3"` ↔ file tên `part1.mp3`).
3. **Kiểm tra trước** (không lưu gì): lỗi hiện kèm đường dẫn field. Sửa đến khi "File hợp lệ".
4. **Nhập đề** → **Mở đề** → xem "Đủ điều kiện xuất bản" → **Xuất bản**.

Sửa đề Nháp: ô **Nội dung (JSON)** trên trang đề — bấm vào một lỗi để nhảy tới vị trí đó.

## 2. Nhập từ ảnh / PDF (OCR)

1. **Quản trị → Nhập OCR**: tải lên **1 PDF** hoặc **tối đa 30 ảnh** (đặt tên theo thứ tự trang, vd. `p01.jpg`,
   `p02.jpg`). OCR chạy nền (offline, tiếng Anh); danh sách tự cập nhật. PDF có sẵn chữ được lấy chữ trực tiếp
   (chính xác 100%); PDF scan và ảnh chụp đi qua OCR.
2. **Review** từng trang:
   - ảnh gốc bên trái, khung màu = nhãn của khối (xanh lá Bài đọc, xanh dương Câu hỏi/Phương án, cam Đáp án);
   - sửa chữ trong khối; đổi nhãn (phím 1–6), chuyển khối (J/K);
   - **tách** (✂): đặt con trỏ để tách đôi, hoặc bôi đen một đoạn để tách đoạn đó thành khối riêng;
   - **gộp** với khối dưới; trang bị nghiêng → **Xoay 90° và OCR lại**;
   - từ được đánh dấu "độ tin cậy thấp" nên đọc lại kỹ. **Lưu nháp** (Ctrl+S).
3. **Đáp án 1–40**: điền tay, hoặc gắn nhãn "Đáp án" cho trang answer key rồi bấm **Lấy đáp án từ các khối "Đáp án"**.
   Nhiều biến thể: `colour/color`.
4. **Dựng đề**: nhập mã series + tên đề → hệ thống ghép các khối thành tài liệu đề (đoán dạng câu hỏi từ câu hướng
   dẫn kiểu "Write TRUE, FALSE or NOT GIVEN"). Kết quả là bản nháp: sửa phần còn thiếu trong ô JSON theo danh sách lỗi
   (Listening cần thêm file audio, MCQ cần kiểm phương án…).
5. **Tạo đề** → mở trang đề để kiểm và xuất bản.

Mẹo chất lượng OCR: chụp thẳng, đủ sáng, mỗi ảnh một trang; bố cục 2 cột nên chụp/tách từng cột.

## 3. Nhập/xuất .zip (chuyển đề sang máy khác, sao lưu một bộ)

Đề được gom thành **bộ** theo `source` + `bookNumber` (vd. `CAM` + `18` → "Cambridge 18"; không có số sách →
"… — đề lẻ"). Trang **Quản trị → Đề thi** mặc định hiện **Theo bộ**: mỗi bộ một bảng Test × kỹ năng (R/L/W/S).

- **Xuất**: nút **Xuất bộ (.zip)** trên thẻ bộ (bản mới nhất của mỗi đề), hoặc **Xuất .zip** trên trang một đề.
  File tên `BandUp-<bộ>-<ngày>.zip` / `BandUp-<series>-v<phiên bản>.zip`, gồm JSON đề + toàn bộ ảnh/audio.
- **Nhập**: **Nhập JSON / .zip** → chọn **một** file `.zip` → **Kiểm tra trước** hoặc **Nhập đề**. Kết quả hiện
  từng đề (✓/✗ kèm lỗi); một đề lỗi không chặn các đề còn lại. Mỗi đề nhập vào thành **bản Nháp mới** (series đã có
  thì thành phiên bản tiếp theo, bản đã xuất bản không bị đụng tới). Bấm **Xuất bản các đề hợp lệ** nếu muốn.
- **Xuất bản cả bộ**: trên thẻ bộ; đề chưa đủ điều kiện được bỏ qua và báo lý do.
- **Thêm Test** vào bộ: mở trang nhập kèm gợi ý `source` / `bookNumber` / `testNumber` cần điền trong JSON.

Zip tự soạn cũng nhập được: mỗi đề một thư mục `<tên>/test.json` + `<tên>/assets/…` (`bandup-export.json` là tuỳ chọn).
Giới hạn: tối đa `UPLOAD_MAX_ZIP_MB` (mặc định 1024 MB), 2000 file; chỉ nhận `.json`, ảnh `.png/.jpg/.jpeg/.webp`,
audio `.mp3/.m4a/.wav/.ogg`.

# Lưu ý riêng cho Windows

1. **Node 20.20** (nvm-windows) + **Yarn 1.22.22** (`npm i -g yarn`). Script trùng tên lệnh có sẵn của Yarn
   (vd. `check`) phải gọi bằng `yarn run check` — `yarn check` là lệnh khác của Yarn.
2. **Cổng Postgres:** máy đã có Postgres riêng ở 5432 (và một container khác giữ 5433), nên compose dùng **5434**.
   Kiểm cổng bị chiếm: `Get-NetTCPConnection -State Listen -LocalPort 5434`.
3. **argon2 pin 0.44.0:** bản 0.45.x có prebuild win32-x64 bị lỗi (segfault khi load).
4. **Line endings:** `.gitattributes` ép LF (trừ `.ps1`). Đã đặt `git config core.autocrlf false`.
5. **Docker Desktop:** LanguageTool cần ~1 GB RAM (`Java_Xmx=1g`). Nếu máy chậm, giới hạn WSL trong
   `%UserProfile%\.wslconfig` (`[wsl2] memory=6GB`).
6. **Next 16 chỉ cho một `next dev` mỗi thư mục:** tắt `yarn dev` của frontend trước khi chạy `yarn test:e2e`.
7. **Playwright:** lần đầu `yarn playwright install chromium` trong `frontend/`.
8. Đường dẫn repo có dấu cách (`D:\Src\IELTS Learning`): các script đều gọi CLI qua `process.execPath` nên không
   bị ảnh hưởng; nếu tự viết script, luôn đặt đường dẫn trong ngoặc kép.

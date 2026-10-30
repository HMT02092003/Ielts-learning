# Thêm bộ chấm AI cho Writing / Speaking

Hiện tại hệ thống **không** dùng AI để chấm bài (spec §8). Writing chỉ có bộ ước lượng bằng thư viện, Speaking chỉ có giám khảo chấm tay. Tài liệu này mô tả chỗ cần cắm khi muốn thêm bộ chấm AI sau này, để không phải sửa API hay giao diện.

## Writing

- **Interface:** `WritingEvaluator`, khai báo trong [backend/src/lib/writing/evaluator.ts](../backend/src/lib/writing/evaluator.ts).
- **Bản đang dùng:** `createLibraryWritingEvaluator()`, nằm trong [library-evaluator.ts](../backend/src/lib/writing/library-evaluator.ts). Bộ này dùng LanguageTool để tìm lỗi và compromise để tách câu, rồi tính một nhóm chỉ số.
  - Nó chỉ ước lượng band **Lexical Resource** và **Grammatical Range & Accuracy**, theo heuristic. Heuristic này không phải band descriptor chính thức.
  - **Task Response** và **Coherence & Cohesion** không có band từ máy (`band: null`, `checklistOnly: true`). Học viên tự đánh giá hai tiêu chí này bằng checklist.
- **Kết quả lưu ở đâu:** mỗi lần chấm thêm một dòng mới vào bảng `WritingEvaluation` (chỉ thêm, không sửa dòng cũ):
  - `evaluator`: `LIBRARY`, `LLM` hoặc `HUMAN`;
  - `evaluatorVersion`, `status`, `isEstimate`;
  - 5 cột band;
  - `result` (JSON đúng schema `WritingEvaluationResult` trong `backend/src/shared/writing.ts`).

### Các bước thêm `LlmWritingEvaluator`

1. Tạo `backend/src/lib/writing/llm-evaluator.ts`, viết một hàm trả về đối tượng `WritingEvaluator`:
   - `kind: 'LLM'`;
   - `evaluate()` trả về `{ evaluatorVersion, result, bands }`.
2. Đổi phần `result` cho hợp với AI:
   - `method: 'LLM'`;
   - giữ `isEstimate: true` và `disclaimer: ESTIMATE_DISCLAIMER` (nhãn "ƯỚC LƯỢNG" bắt buộc theo spec).
   - Có thể điền band cho cả 4 tiêu chí. Khi đó cần nới schema `criteria.taskResponse` / `criteria.coherence` trong `shared/writing.ts`, chạy `yarn run sync-shared` ở `frontend/`, và cho UI hiện band nếu khác `null`.
3. Truyền bộ chấm mới vào `createWritingService(evaluator)` trong [writing.service.ts](../backend/src/modules/writing/writing.service.ts). Nên bật/tắt bằng biến môi trường, ví dụ `WRITING_EVALUATOR=library|llm`, khai báo trong `config/env.ts`.
4. Đặt timeout và retry. Khi bộ chấm lỗi, dòng đánh giá chuyển sang `FAILED` và có `error`; học viên bấm "Phân tích lại" (`POST /writing-submissions/:id/evaluate`) để chạy lại.
5. Thống kê **không** dùng band máy. Writing/Speaking chỉ lấy band giám khảo `HUMAN` (quy tắc M9), nên thêm AI không làm lệch biểu đồ tiến độ.

**Lưu ý:** đừng gửi bài của học viên ra dịch vụ bên ngoài khi chưa được chủ hệ thống đồng ý, và nhớ ghi rõ điều này trong README.

## Speaking

- **Interface:** `SpeakingEvaluator`, cùng file `evaluator.ts`. Hiện mới chỉ khai báo, chưa có bản cài đặt nào.
- **Bảng `SpeakingEvaluation`:** đã có các cột `evaluator`, `evaluatorVersion`, `status`, `isEstimate`, `result`, `error`, nên thêm bộ chấm AI không phải đổi schema.
- **Cách cắm:**
  1. Sau `speakingService.upload` hoặc sau khi nộp bài, xếp một job chấm vào hàng đợi.
  2. Job đọc file ghi âm qua `Storage`, gọi bộ chấm, rồi ghi một dòng `SpeakingEvaluation` với `evaluator: 'LLM'` và `isEstimate: true`.
  3. Nên dùng `PollingWorker` có sẵn ([backend/src/lib/jobs/polling-worker.ts](../backend/src/lib/jobs/polling-worker.ts)) để không chặn request.

# Định dạng tài liệu đề (TestImportDoc)

Mọi đề đi vào hệ thống qua **một** định dạng JSON: nhập file JSON, màn sửa JSON của admin, dựng đề từ OCR và
seed đều dùng nó. Nguồn chuẩn (Zod) nằm ở `backend/src/shared/test-import.ts` và `question-types.ts`; ví dụ đầy đủ
cho cả 12 dạng câu hỏi: `backend/prisma/seed/fixtures/dummy-reading.json` và `dummy-listening.json`.

Lỗi luôn được báo theo **đường dẫn field**, ví dụ `reading.passages[2].groups[1].questions[0].answer`.

## Khung đề

```jsonc
{
  "schemaVersion": 1,
  "seriesKey": "cam18-t2-ac",        // mã ổn định qua các phiên bản: chữ thường, số, '-' (3–64 ký tự)
  "source": "CAM",                    // CAM | VOL | PRE_IELTS | CUSTOM
  "type": "ACADEMIC",                 // ACADEMIC | GENERAL
  "title": "Cambridge 18 – Test 2",
  "sourceRef": "Cambridge IELTS 18",  // tùy chọn, chỉ ghi chú (không chứa nội dung)
  "bookNumber": 18, "testNumber": 2,  // tùy chọn
  "reading":   { "passages": [ /* 1–3 passage */ ] },
  "listening": { "parts":    [ /* 1–4 part */ ] },
  "writing":   { "tasks":    [ /* Task 1, Task 2 */ ] },
  "speaking":  { "parts":    [ /* Part 1, 2, 3 */ ] }
}
```

Có ít nhất một kỹ năng. **Lưu nháp** chỉ cần đúng cấu trúc; **xuất bản** còn đòi: Reading đủ 3 passage và câu 1–40,
Listening đủ 4 part và câu 1–40, Writing đủ Task 1 + 2, Speaking đủ Part 1–3.

### Reading passage

```jsonc
{
  "title": "Rooftop Beekeeping in Northbridge",
  "instructions": "You should spend about 20 minutes on Questions 1–13…", // tùy chọn (dải hướng dẫn trong bài thi)
  "suggestedMinutes": 20,                                                  // tùy chọn, mặc định 20
  "paragraphs": [ { "label": "A", "text": "…" }, { "label": "B", "text": "…" } ],
  "groups": [ /* nhóm câu hỏi */ ]
}
```

`paragraphs[].kind`: `BODY` (mặc định) | `HEADING` | `SUBHEADING` | `FIGURE` (kèm `image`) | `FOOTNOTE`.

### Listening part

```jsonc
{
  "title": "Part 1",
  "audio": { "file": { "path": "assets/part1.mp3" }, "durationMs": 380000, "transcript": "…" },
  "groups": [ /* nhóm câu hỏi */ ]
}
```

`transcript` không bao giờ gửi cho học viên trước khi nộp bài.

### Writing task / Speaking part

```jsonc
{ "task": 1, "kind": "ACADEMIC_REPORT", "prompt": "…", "image": { "path": "assets/chart.png" },
  "visual": "BAR", "minWords": 150, "suggestedMinutes": 20 }
{ "task": 2, "kind": "ESSAY", "prompt": "…", "minWords": 250, "suggestedMinutes": 40 }

{ "part": 1, "topic": "Hometown", "questions": ["…", "…"] }
{ "part": 2, "cueCard": { "topic": "Describe a tool you use often", "bullets": ["what it is", "…"] },
  "prepSeconds": 60, "speakSeconds": 120, "followUps": ["…"] }
{ "part": 3, "topic": "Technology", "questions": ["…"] }
```

### File (ảnh, audio)

`{ "path": "assets/<tên-file>" }` — upload file cùng JSON (màn Nhập JSON so khớp theo tên file), hoặc
`{ "fileId": "<uuid>" }` — file đã có trong hệ thống (bản JSON xuất từ màn sửa đề dùng dạng này).
Chỉ nhận PNG/JPG/WebP và MP3/M4A/WAV/OGG; kiểu file được kiểm bằng magic bytes, không theo đuôi tên.

## Nhóm câu hỏi

Trường chung: `type`, `instructions`, `questionFrom`, `questionTo`, `questions[]`. Mỗi câu: `number` (1–40, liên tục
trong nhóm), `explanation` (tùy chọn), `evidence: { "paragraphLabel": "B", "quote": "…" }` (tùy chọn — đoạn trích phải
có thật trong bài đọc; màn kết quả dùng để chỉ chỗ đáp án).

Đáp án dạng **chữ** (`answer` + `accepted`): `answer` là đáp án chuẩn, có thể viết `(the) museum` để chấp nhận cả
"the museum" lẫn "museum"; `accepted` là các biến thể khác (`["colour", "color"]`). Mọi biến thể đều phải nằm trong giới
hạn số từ (`wordLimit: { "maxWords": 2, "allowNumber": true }` = "NO MORE THAN TWO WORDS AND/OR A NUMBER").

| `type` | Trường riêng của nhóm | Mỗi câu |
|---|---|---|
| `MULTIPLE_CHOICE_SINGLE` | — | `prompt`, `options: [{key, text}]`, `answer: "B"` |
| `MULTIPLE_CHOICE_MULTI` | `stem`, `options`, `chooseCount`, `answer: ["B","D"]` | chỉ `number` (số câu = `chooseCount`) |
| `TRUE_FALSE_NOT_GIVEN` | — | `prompt`, `answer: "TRUE" \| "FALSE" \| "NOT GIVEN"` |
| `YES_NO_NOT_GIVEN` | — | `prompt`, `answer: "YES" \| "NO" \| "NOT GIVEN"` |
| `MATCHING_HEADINGS` | `headings: [{key: "iv", text}]`, `example?` | `paragraphLabel`, `answer: "iv"` |
| `MATCHING_INFORMATION` | `paragraphLabels: ["A","B",…]`, `allowReuse` | `prompt`, `answer: "C"` |
| `MATCHING_FEATURES` | `variant` (`FEATURES`/`CLASSIFICATION`/`SENTENCE_ENDINGS`), `features`, `allowReuse` | `prompt`, `answer` |
| `SENTENCE_COMPLETION` | `wordLimit` | `prompt` chứa `{{n}}`, `answer`, `accepted` |
| `SUMMARY_COMPLETION` | `text` chứa `{{n}}`, `answerMode` `WORDS` + `wordLimit` hoặc `WORD_BANK` + `wordBank` | `answer` (chữ hoặc key), `accepted` |
| `NOTE_TABLE_FLOWCHART_COMPLETION` | `template` (`NOTES` / `TABLE` / `FLOWCHART`) chứa `{{n}}`, `answerMode`, … | `answer`, `accepted` |
| `SHORT_ANSWER` | `wordLimit` | `prompt`, `answer`, `accepted` |
| `MAP_DIAGRAM_LABELLING` | `variant`, `image`, `answerMode` `OPTIONS` + `options` (kèm toạ độ `at`) hoặc `WORDS` + `wordLimit` | `prompt?`, `pin?`, `answer` |

`{{14}}` là ô trống của câu 14: các số trong `{{…}}` phải khớp đúng số câu của nhóm.

## Phiên bản đề

Mỗi lần nhập tạo một **phiên bản** mới cùng `seriesKey` ở trạng thái **Nháp**. Đề **đã xuất bản không sửa nội dung**:
sửa đáp án chấp nhận / giải thích bằng "Đáp án (sửa nhanh)", còn thay đổi khác thì "Nhân bản thành bản mới" → sửa →
xuất bản (bản cũ tự chuyển Lưu trữ, kết quả bài làm cũ giữ nguyên).

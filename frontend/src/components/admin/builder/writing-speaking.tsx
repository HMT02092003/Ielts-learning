'use client';

// Writing tasks and Speaking parts.
import { Button } from '@/components/ui/button';
import { countWords } from '@/shared/primitives';
import { VISUAL_LABEL, WRITING_PROMPT_STARTERS } from '@/lib/builder/templates';
import type { SpeakingPart, WritingTask } from '@/lib/builder/types';
import { useBuilder } from './context';
import { FilePicker } from './file-picker';
import { AreaField, NumberField, SectionTitle, SelectField, StringList, TextField } from './fields';

const ESSAY_STARTERS: { key: string; label: string }[] = [
  { key: 'OPINION', label: 'Opinion (agree / disagree)' },
  { key: 'DISCUSSION', label: 'Discuss both views' },
  { key: 'ADV_DISADV', label: 'Advantages / disadvantages' },
  { key: 'PROBLEM_SOLUTION', label: 'Problem / solution' },
  { key: 'TWO_PART', label: 'Two-part question' },
];

export function WritingEditor({ i }: { i: number }) {
  const { doc, update, readOnly } = useBuilder();
  const task = doc.writing?.tasks[i];
  if (!task) return null;
  const edit = (fn: (t: WritingTask) => void) =>
    update((d) => {
      const t = d.writing?.tasks[i];
      if (t) fn(t);
    });
  const starter = (key: string) => {
    if (task.prompt.trim() && !window.confirm('Thay đề bài hiện tại bằng mẫu?')) return;
    edit((t) => (t.prompt = WRITING_PROMPT_STARTERS[key] ?? ''));
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>
        Writing Task {task.task}
        {task.kind === 'ACADEMIC_REPORT'
          ? ' · Academic report'
          : task.kind === 'GENERAL_LETTER'
            ? ' · Letter'
            : ' · Essay'}
      </SectionTitle>
      <p className="-mt-3 text-caption text-ink-subtle">
        {task.task === 1
          ? task.kind === 'GENERAL_LETTER'
            ? 'GT Task 1: viết thư (trang trọng / bán trang trọng / thân mật) theo 3 gạch đầu dòng, tối thiểu 150 từ, 20 phút.'
            : 'AC Task 1: mô tả biểu đồ/bảng/bản đồ/quy trình, nêu overview và so sánh, tối thiểu 150 từ, 20 phút. Không nêu ý kiến cá nhân.'
          : 'Task 2: bài luận tối thiểu 250 từ, 40 phút; chiếm khoảng 2/3 điểm Writing.'}
      </p>

      {task.task === 1 && task.kind === 'ACADEMIC_REPORT' && (
        <>
          <SelectField
            label="Loại hình"
            value={task.visual}
            options={Object.entries(VISUAL_LABEL).map(([value, label]) => ({
              value: value as NonNullable<WritingTask['visual']>,
              label,
            }))}
            onChange={(v) => edit((t) => (t.visual = v))}
          />
          <FilePicker
            kind="image"
            label="Ảnh biểu đồ"
            optional
            value={task.image}
            onChange={(ref) => edit((t) => (t.image = ref))}
          />
        </>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label text-ink-muted">Mẫu đề bài:</span>
          {task.task === 1 ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => starter(task.kind)}>
              {task.kind === 'GENERAL_LETTER' ? 'Thư (GT)' : 'Báo cáo biểu đồ (AC)'}
            </Button>
          ) : (
            ESSAY_STARTERS.map((s) => (
              <Button key={s.key} type="button" variant="secondary" size="sm" onClick={() => starter(s.key)}>
                {s.label}
              </Button>
            ))
          )}
        </div>
      )}

      <AreaField
        label="Đề bài"
        rows={10}
        value={task.prompt}
        hint={`${countWords(task.prompt)} từ`}
        onChange={(v) => edit((t) => (t.prompt = v))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Số từ tối thiểu"
          min={1}
          value={task.minWords}
          onChange={(v) => edit((t) => (t.minWords = v))}
        />
        <NumberField
          label="Thời gian gợi ý (phút)"
          min={1}
          value={task.suggestedMinutes}
          onChange={(v) => edit((t) => (t.suggestedMinutes = v))}
        />
      </div>
    </div>
  );
}

export function SpeakingEditor({ i }: { i: number }) {
  const { doc, update } = useBuilder();
  const part = doc.speaking?.parts[i];
  if (!part) return null;
  const edit = (fn: (p: SpeakingPart) => void) =>
    update((d) => {
      const p = d.speaking?.parts[i];
      if (p) fn(p);
    });

  if (part.part === 2) {
    return (
      <div className="flex flex-col gap-6">
        <SectionTitle>Speaking Part 2 · Cue card</SectionTitle>
        <p className="-mt-3 text-caption text-ink-subtle">
          Thí sinh có 1 phút chuẩn bị và nói 1–2 phút theo thẻ đề. Thẻ gồm chủ đề “Describe …”, 3–4 gợi ý “You
          should say:” và một dòng kết “and explain …”.
        </p>
        <TextField
          label="Chủ đề"
          lang="en"
          value={part.cueCard.topic}
          onChange={(v) => edit((p) => p.part === 2 && (p.cueCard.topic = v))}
        />
        <StringList
          label="You should say:"
          items={part.cueCard.bullets}
          minItems={1}
          addLabel="Thêm gợi ý"
          onChange={(items) => edit((p) => p.part === 2 && (p.cueCard.bullets = items.slice(0, 6)))}
        />
        <TextField
          label="Dòng kết (tùy chọn)"
          lang="en"
          placeholder="and explain why you like it."
          value={part.cueCard.closing}
          onChange={(v) => edit((p) => p.part === 2 && (p.cueCard.closing = v || undefined))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Thời gian chuẩn bị (giây)"
            min={0}
            value={part.prepSeconds ?? 60}
            onChange={(v) => edit((p) => p.part === 2 && (p.prepSeconds = v))}
          />
          <NumberField
            label="Thời gian nói (giây)"
            min={1}
            value={part.speakSeconds ?? 120}
            onChange={(v) => edit((p) => p.part === 2 && (p.speakSeconds = v))}
          />
        </div>
        <StringList
          label="Câu hỏi nối tiếp (tùy chọn)"
          items={part.followUps ?? []}
          addLabel="Thêm câu hỏi"
          onChange={(items) => edit((p) => p.part === 2 && (p.followUps = items))}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>Speaking Part {part.part}</SectionTitle>
      <p className="-mt-3 text-caption text-ink-subtle">
        {part.part === 1
          ? 'Part 1 (4–5 phút): câu hỏi quen thuộc về bản thân — quê quán, công việc/học tập, sở thích — thường 2–3 chủ đề.'
          : 'Part 3 (4–5 phút): câu hỏi trừu tượng, mở rộng từ chủ đề Part 2; yêu cầu so sánh, đánh giá, dự đoán.'}
      </p>
      <TextField
        label="Chủ đề (tùy chọn)"
        lang="en"
        value={part.topic}
        onChange={(v) => edit((p) => p.part !== 2 && (p.topic = v || undefined))}
      />
      <StringList
        label="Câu hỏi"
        items={part.questions}
        minItems={1}
        addLabel="Thêm câu hỏi"
        placeholder={part.part === 1 ? 'Do you work or are you a student?' : 'Why do you think …?'}
        onChange={(items) => edit((p) => p.part !== 2 && (p.questions = items))}
      />
    </div>
  );
}

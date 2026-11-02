'use client';

// Reading passage and Listening part editors.
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { countWords } from '@/shared/primitives';
import { splitParagraphs } from '@/lib/builder/paste';
import { newGroup } from '@/lib/builder/templates';
import type { Group, Paragraph, QSkill } from '@/lib/builder/types';
import { useBuilder } from './context';
import { fileIdOf, FilePicker } from './file-picker';
import {
  AddButton,
  AreaField,
  NumberField,
  PasteButton,
  RowControls,
  SectionTitle,
  TextField,
  move,
} from './fields';
import { SHORT_TYPE } from './outline';

const KIND_LABEL: Record<NonNullable<Paragraph['kind']>, string> = {
  BODY: 'Đoạn văn',
  HEADING: 'Tiêu đề',
  SUBHEADING: 'Tiêu đề phụ',
  FIGURE: 'Hình',
  FOOTNOTE: 'Chú thích',
};

function GroupList({ skill, i, groups }: { skill: QSkill; i: number; groups: Group[] }) {
  const { select, update } = useBuilder();
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Nhóm câu hỏi</SectionTitle>
      <ul className="flex flex-col gap-2">
        {groups.map((g, gi) => (
          <li key={gi}>
            <button
              type="button"
              onClick={() => select({ kind: 'group', skill, i, g: gi })}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left outline-none hover:border-border-strong focus-visible:shadow-focus"
            >
              <span className="text-body font-medium">{SHORT_TYPE[g.type]}</span>
              <span className="font-mono text-label text-ink-muted">
                Câu {g.questionFrom}–{g.questionTo}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <AddButton
        onClick={() => {
          update((d) => {
            const sec = skill === 'reading' ? d.reading?.passages[i] : d.listening?.parts[i];
            if (!sec) return;
            const labels =
              'paragraphs' in sec ? sec.paragraphs.flatMap((p) => (p.label ? [p.label] : [])) : [];
            sec.groups.push(
              newGroup(skill === 'reading' ? 'TRUE_FALSE_NOT_GIVEN' : 'SENTENCE_COMPLETION', skill, labels),
            );
          });
          select({ kind: 'group', skill, i, g: groups.length });
        }}
      >
        Thêm nhóm câu hỏi
      </AddButton>
    </section>
  );
}

export function PassageEditor({ i }: { i: number }) {
  const { doc, update, readOnly } = useBuilder();
  const p = doc.reading?.passages[i];
  if (!p) return null;
  const words = p.paragraphs.reduce((n, para) => n + countWords(para.text), 0);
  const edit = (fn: (para: Paragraph[]) => void) =>
    update((d) => {
      const passage = d.reading?.passages[i];
      if (passage) fn(passage.paragraphs);
    });

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <SectionTitle>Passage {i + 1}</SectionTitle>
        <div className="grid gap-4 md:grid-cols-[1fr_140px]">
          <TextField
            label="Tiêu đề bài đọc"
            lang="en"
            value={p.title}
            onChange={(v) => update((d) => d.reading && (d.reading.passages[i]!.title = v))}
          />
          <NumberField
            label="Thời gian gợi ý (phút)"
            min={1}
            max={60}
            value={p.suggestedMinutes}
            onChange={(v) =>
              update((d) => d.reading && (d.reading.passages[i]!.suggestedMinutes = v || undefined))
            }
          />
          <TextField
            className="md:col-span-2"
            label="Tiêu đề phụ (tùy chọn)"
            lang="en"
            value={p.subtitle}
            onChange={(v) => update((d) => d.reading && (d.reading.passages[i]!.subtitle = v || undefined))}
          />
          <AreaField
            className="md:col-span-2"
            label="Dải hướng dẫn đầu bài (tùy chọn)"
            rows={2}
            placeholder="You should spend about 20 minutes on Questions 1–13, which are based on Reading Passage 1 below."
            value={p.instructions}
            onChange={(v) =>
              update((d) => d.reading && (d.reading.passages[i]!.instructions = v || undefined))
            }
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle
          actions={
            <>
              <PasteButton
                label="Dán cả bài"
                title="Dán bài đọc"
                description="Mỗi đoạn cách nhau một dòng trống. Nếu đầu đoạn có nhãn (A, [A], A.) sẽ giữ nguyên, nếu không sẽ tự đánh A, B, C… Dòng bị ngắt giữa đoạn (copy từ PDF) được tự nối lại. Nội dung cũ sẽ bị thay thế."
                placeholder={'A  The first paragraph…\n\nB  The second paragraph…'}
                onApply={(text) => {
                  const paras = splitParagraphs(text);
                  if (!paras.length) return 'Chưa có nội dung.';
                  edit((list) => {
                    list.splice(
                      0,
                      list.length,
                      ...paras.map((x) => ({ label: x.label, kind: 'BODY' as const, text: x.text })),
                    );
                  });
                  return null;
                }}
              />
              {!readOnly && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    edit((list) => {
                      let k = 0;
                      for (const para of list) {
                        if ((para.kind ?? 'BODY') === 'BODY') para.label = String.fromCharCode(65 + k++);
                        else delete para.label;
                      }
                    })
                  }
                >
                  Đánh lại nhãn A, B, C
                </Button>
              )}
            </>
          }
        >
          Nội dung bài đọc
        </SectionTitle>
        <p className="-mt-2 text-caption text-ink-subtle">
          {p.paragraphs.length} đoạn · {words} từ. Nhãn đoạn dùng cho Matching headings / information và chỗ
          chứa đáp án.
        </p>
        <ol className="flex flex-col gap-3">
          {p.paragraphs.map((para, pi) => (
            <li key={pi} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label={`Nhãn đoạn ${pi + 1}`}
                  placeholder="Nhãn"
                  className="h-9 w-16 text-center font-mono"
                  value={para.label ?? ''}
                  readOnly={readOnly}
                  maxLength={2}
                  onChange={(e) =>
                    edit((list) => {
                      const v = e.target.value.toUpperCase();
                      list[pi]!.label = v || undefined;
                    })
                  }
                />
                <NativeSelect
                  aria-label={`Loại đoạn ${pi + 1}`}
                  className="w-40"
                  disabled={readOnly}
                  value={para.kind ?? 'BODY'}
                  onChange={(e) => edit((list) => (list[pi]!.kind = e.target.value as Paragraph['kind']))}
                >
                  {Object.entries(KIND_LABEL).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </NativeSelect>
                <span className="flex-1" />
                <span className="text-caption text-ink-subtle">{countWords(para.text)} từ</span>
                <RowControls
                  index={pi}
                  length={p.paragraphs.length}
                  minLength={1}
                  noun="đoạn"
                  onMove={(from, to) => edit((list) => move(list, from, to))}
                  onRemove={() => edit((list) => list.splice(pi, 1))}
                />
              </div>
              <Textarea
                lang="en"
                aria-label={`Nội dung đoạn ${para.label ?? pi + 1}`}
                rows={para.kind === 'HEADING' || para.kind === 'SUBHEADING' ? 1 : 5}
                className="min-h-0 font-reading"
                value={para.text}
                readOnly={readOnly}
                onChange={(e) => edit((list) => (list[pi]!.text = e.target.value))}
              />
              {para.kind === 'FIGURE' && (
                <FilePicker
                  kind="image"
                  label="Ảnh minh họa"
                  optional
                  value={para.image}
                  onChange={(ref) => edit((list) => (list[pi]!.image = ref))}
                />
              )}
            </li>
          ))}
        </ol>
        <AddButton
          onClick={() =>
            edit((list) => {
              const next = String.fromCharCode(65 + list.filter((x) => (x.kind ?? 'BODY') === 'BODY').length);
              list.push({ label: next, kind: 'BODY', text: '' });
            })
          }
        >
          Thêm đoạn
        </AddButton>
      </section>

      <GroupList skill="reading" i={i} groups={p.groups} />
    </div>
  );
}

const fmtDuration = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function ListeningPartEditor({ i }: { i: number }) {
  const { doc, update } = useBuilder();
  const part = doc.listening?.parts[i];
  if (!part) return null;
  const edit = (fn: (p: NonNullable<typeof part>) => void) =>
    update((d) => {
      const x = d.listening?.parts[i];
      if (x) fn(x);
    });
  const hasAudio = Boolean(fileIdOf(part.audio.file) ?? (part.audio.file && 'path' in part.audio.file));

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <SectionTitle>Listening · Part {i + 1}</SectionTitle>
        <p className="-mt-2 text-caption text-ink-subtle">
          Chuẩn IELTS: Part 1 hội thoại đời sống (thường là form/note completion), Part 2 độc thoại (map/plan,
          MCQ), Part 3 thảo luận học thuật (MCQ, matching), Part 4 bài giảng (note/summary completion).
        </p>
        <TextField
          label="Tiêu đề"
          value={part.title}
          onChange={(v) => edit((p) => (p.title = v || undefined))}
        />
        <AreaField
          label="Hướng dẫn chung (tùy chọn)"
          rows={2}
          value={part.instructions}
          onChange={(v) => edit((p) => (p.instructions = v || undefined))}
        />
        <FilePicker
          kind="audio"
          label="Audio của part"
          value={part.audio.file}
          onChange={(ref, durationMs) =>
            edit((p) => {
              if (ref) p.audio.file = ref;
              if (durationMs) p.audio.durationMs = durationMs;
            })
          }
        />
        {hasAudio && (
          <p className="text-caption text-ink-muted">
            Thời lượng:{' '}
            {part.audio.durationMs ? fmtDuration(part.audio.durationMs) : 'chưa đọc được — nhập tay bên dưới'}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            label="Thời lượng (giây)"
            min={1}
            value={part.audio.durationMs ? Math.round(part.audio.durationMs / 1000) : undefined}
            onChange={(v) => edit((p) => (p.audio.durationMs = v * 1000))}
          />
          <NumberField
            label="Bắt đầu từ giây (tùy chọn)"
            min={0}
            value={part.audio.startMs !== undefined ? Math.round(part.audio.startMs / 1000) : undefined}
            hint="Khi nhiều part dùng chung một file."
            onChange={(v) => edit((p) => (p.audio.startMs = v > 0 ? v * 1000 : undefined))}
          />
          <NumberField
            label="Kết thúc ở giây (tùy chọn)"
            min={1}
            value={part.audio.endMs !== undefined ? Math.round(part.audio.endMs / 1000) : undefined}
            onChange={(v) => edit((p) => (p.audio.endMs = v > 0 ? v * 1000 : undefined))}
          />
        </div>
        <AreaField
          label="Transcript (tùy chọn)"
          hint="Chỉ hiện cho học viên sau khi nộp bài."
          rows={6}
          value={part.audio.transcript}
          onChange={(v) => edit((p) => (p.audio.transcript = v || undefined))}
        />
      </section>
      <GroupList skill="listening" i={i} groups={part.groups} />
    </div>
  );
}

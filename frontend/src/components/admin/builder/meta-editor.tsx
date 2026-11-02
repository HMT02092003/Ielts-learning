'use client';

// Test metadata + which skills the test contains. Turning a skill on creates the full IELTS skeleton
// (3 passages / 4 parts / Task 1 + 2 / Part 1–3) so the author only fills content in.
import { Headphones, BookOpen, Mic, PenLine } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { viAdmin } from '@/i18n/vi-admin';
import { newListeningPart, newPassage, newSpeakingPart, newWritingTask } from '@/lib/builder/templates';
import type { Doc } from '@/lib/builder/types';
import { TestSource } from '@/shared/enums';
import { useBuilder } from './context';
import { AreaField, NumberField, SectionTitle, SelectField, TextField } from './fields';

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

type SkillKey = 'reading' | 'listening' | 'writing' | 'speaking';

const SKILLS: { key: SkillKey; label: string; icon: ReactNode; what: string }[] = [
  {
    key: 'reading',
    label: 'Reading',
    icon: <BookOpen className="size-5" aria-hidden />,
    what: '3 passage · 40 câu · 60 phút',
  },
  {
    key: 'listening',
    label: 'Listening',
    icon: <Headphones className="size-5" aria-hidden />,
    what: '4 part · 40 câu · audio',
  },
  {
    key: 'writing',
    label: 'Writing',
    icon: <PenLine className="size-5" aria-hidden />,
    what: 'Task 1 + Task 2 · 60 phút',
  },
  {
    key: 'speaking',
    label: 'Speaking',
    icon: <Mic className="size-5" aria-hidden />,
    what: 'Part 1, 2 (cue card), 3',
  },
];

function addSkill(d: Doc, key: SkillKey) {
  if (key === 'reading') d.reading = { passages: [newPassage(), newPassage(), newPassage()] };
  if (key === 'listening') d.listening = { parts: [1, 2, 3, 4].map(newListeningPart) };
  if (key === 'writing') d.writing = { tasks: [newWritingTask(1, d.type), newWritingTask(2, d.type)] };
  if (key === 'speaking')
    d.speaking = { parts: [newSpeakingPart(1), newSpeakingPart(2), newSpeakingPart(3)] };
}

export function MetaEditor({ isNew }: { isNew: boolean }) {
  const { doc, update, readOnly, select } = useBuilder();
  const autoKey = slugify(doc.title);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <SectionTitle>Thông tin đề</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            className="md:col-span-2"
            label="Tên đề"
            placeholder="Cambridge 18 – Test 2"
            value={doc.title}
            onChange={(v) =>
              update((d) => {
                // keep the series key in sync with the title until the author edits it (new tests only)
                if (isNew && (d.seriesKey === '' || d.seriesKey === slugify(d.title)))
                  d.seriesKey = slugify(v);
                d.title = v;
              })
            }
          />
          <TextField
            label="Mã series"
            hint={
              isNew
                ? 'Mã cố định qua các phiên bản: chữ thường, số, dấu "-". Tự tạo từ tên đề.'
                : 'Mã series của đề đã tạo không đổi được ở đây.'
            }
            value={doc.seriesKey}
            disabled={!isNew}
            placeholder={autoKey || 'cam18-t2-ac'}
            onChange={(v) => update((d) => (d.seriesKey = v.toLowerCase().replace(/[^a-z0-9-]/g, '-')))}
          />
          <SelectField
            label="Loại đề"
            value={doc.type}
            options={[
              { value: 'ACADEMIC', label: 'Academic' },
              { value: 'GENERAL', label: 'General Training' },
            ]}
            onChange={(v) =>
              update((d) => {
                d.type = v;
                const t1 = d.writing?.tasks.find((t) => t.task === 1);
                if (t1) {
                  t1.kind = v === 'GENERAL' ? 'GENERAL_LETTER' : 'ACADEMIC_REPORT';
                  if (v === 'GENERAL') delete t1.visual;
                }
              })
            }
          />
          <SelectField
            label="Nguồn"
            value={doc.source}
            options={TestSource.options.map((s) => ({ value: s, label: viAdmin.source[s] }))}
            onChange={(v) => update((d) => (d.source = v))}
          />
          <TextField
            label="Ghi chú nguồn"
            placeholder="Cambridge IELTS 18"
            value={doc.sourceRef}
            onChange={(v) => update((d) => (d.sourceRef = v || undefined))}
          />
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Cuốn số"
              min={1}
              value={doc.bookNumber}
              onChange={(v) => update((d) => (d.bookNumber = v > 0 ? v : undefined))}
            />
            <NumberField
              label="Test số"
              min={1}
              value={doc.testNumber}
              onChange={(v) => update((d) => (d.testNumber = v > 0 ? v : undefined))}
            />
          </div>
          <AreaField
            className="md:col-span-2"
            label="Mô tả (tùy chọn)"
            lang="vi"
            rows={2}
            value={doc.description}
            onChange={(v) => update((d) => (d.description = v || undefined))}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle>Kỹ năng trong đề</SectionTitle>
        <p className="-mt-2 text-body text-ink-muted">
          Bật kỹ năng sẽ tạo sẵn khung chuẩn IELTS. Đề có thể chỉ gồm một kỹ năng (ví dụ đề Reading lẻ).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SKILLS.map((s) => {
            const on = Boolean(doc[s.key]);
            return (
              <div
                key={s.key}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4"
              >
                <span className={on ? 'text-accent' : 'text-ink-subtle'}>{s.icon}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body font-semibold">{s.label}</span>
                  <span className="text-caption text-ink-muted">{s.what}</span>
                </div>
                {!readOnly &&
                  (on ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Bỏ ${s.label}`}
                      onClick={() => {
                        if (window.confirm(`Bỏ ${s.label} khỏi đề? Toàn bộ nội dung ${s.label} sẽ bị xóa.`))
                          update((d) => delete d[s.key]);
                      }}
                    >
                      Bỏ
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      aria-label={`Thêm ${s.label}`}
                      onClick={() => {
                        update((d) => addSkill(d, s.key));
                        select(
                          s.key === 'reading'
                            ? { kind: 'passage', i: 0 }
                            : s.key === 'listening'
                              ? { kind: 'lpart', i: 0 }
                              : s.key === 'writing'
                                ? { kind: 'writing', i: 0 }
                                : { kind: 'speaking', i: 0 },
                        );
                      }}
                    >
                      Thêm
                    </Button>
                  ))}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

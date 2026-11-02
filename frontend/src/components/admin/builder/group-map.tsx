'use client';

// Map / plan / diagram labelling: upload the picture, then click on it to place the letters (OPTIONS mode) or the
// question pins (WORDS mode).
import { Crosshair } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';
import { parseLines } from '@/lib/builder/paste';
import type { GroupOf } from '@/lib/builder/types';
import { fileUrl } from '@/services/admin.service';
import { useBuilder } from './context';
import { fileIdOf, FilePicker } from './file-picker';
import type { EditorProps } from './group-choice';
import {
  AddButton,
  AreaField,
  KeyPicker,
  PasteButton,
  RowControls,
  SectionTitle,
  SelectField,
  WordLimitField,
  move,
} from './fields';
import { QuestionCard, QuestionExtras, TextAnswer } from './question-parts';

type G = GroupOf<'MAP_DIAGRAM_LABELLING'>;
type Target = { kind: 'option' | 'question'; i: number } | null;

export function MapEditor({ group, edit, paragraphs }: EditorProps<G>) {
  const { readOnly } = useBuilder();
  const [placing, setPlacing] = useState<Target>(null);
  const imageId = fileIdOf(group.image);
  const options = group.options ?? [];
  const byOptions = group.answerMode === 'OPTIONS';

  const markers = byOptions
    ? options.flatMap((o, i) =>
        o.at
          ? [{ id: `o${i}`, label: o.key, at: o.at, active: placing?.kind === 'option' && placing.i === i }]
          : [],
      )
    : group.questions.flatMap((q, i) =>
        q.pin
          ? [
              {
                id: `q${i}`,
                label: String(q.number),
                at: q.pin,
                active: placing?.kind === 'question' && placing.i === i,
              },
            ]
          : [],
      );

  function place(x: number, y: number) {
    if (!placing) return;
    const at = { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
    edit((g) => {
      if (placing.kind === 'option' && g.options?.[placing.i]) g.options[placing.i]!.at = at;
      if (placing.kind === 'question' && g.questions[placing.i]) g.questions[placing.i]!.pin = at;
    });
    // move on to the next item without a position
    const list = placing.kind === 'option' ? options.map((o) => o.at) : group.questions.map((q) => q.pin);
    const next = list.findIndex((p, k) => k > placing.i && !p);
    setPlacing(next >= 0 ? { kind: placing.kind, i: next } : null);
  }

  const placeButton = (target: NonNullable<Target>, has: boolean) =>
    readOnly || !imageId ? null : (
      <Button
        type="button"
        size="sm"
        variant={placing?.kind === target.kind && placing.i === target.i ? 'primary' : 'secondary'}
        onClick={() => setPlacing(placing?.kind === target.kind && placing.i === target.i ? null : target)}
      >
        <Crosshair className="size-4" aria-hidden /> {has ? 'Đặt lại vị trí' : 'Đặt vị trí'}
      </Button>
    );

  return (
    <section className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Loại hình"
          value={group.variant}
          options={[
            { value: 'MAP', label: 'Bản đồ (map)' },
            { value: 'PLAN', label: 'Sơ đồ mặt bằng (plan)' },
            { value: 'DIAGRAM', label: 'Hình vẽ / thiết bị (diagram)' },
          ]}
          onChange={(v) => edit((g) => (g.variant = v))}
        />
        <SelectField
          label="Cách trả lời"
          value={group.answerMode}
          options={[
            { value: 'OPTIONS', label: 'Chọn chữ cái in trên ảnh (A, B, C…)' },
            { value: 'WORDS', label: 'Tự điền nhãn (giới hạn số từ)' },
          ]}
          onChange={(v) =>
            edit((g) => {
              g.answerMode = v;
              if (v === 'OPTIONS') {
                delete g.wordLimit;
                g.options ??= ['A', 'B', 'C', 'D', 'E'].map((key) => ({ key, text: key }));
              } else {
                delete g.options;
                g.wordLimit ??= { maxWords: 2, allowNumber: false };
              }
              g.questions.forEach((q) => {
                q.answer = '';
                q.accepted = [];
              });
            })
          }
        />
      </div>
      {!byOptions && (
        <WordLimitField value={group.wordLimit} onChange={(wl) => edit((g) => (g.wordLimit = wl))} />
      )}

      <FilePicker
        kind="image"
        label="Ảnh bản đồ / sơ đồ"
        value={group.image}
        onChange={(ref) => ref && edit((g) => (g.image = ref))}
      />

      {imageId && (
        <div className="flex flex-col gap-2">
          <p className={cn('text-caption', placing ? 'font-medium text-accent' : 'text-ink-subtle')}>
            {placing
              ? `Bấm lên ảnh để đặt vị trí ${placing.kind === 'option' ? `chữ ${options[placing.i]?.key}` : `câu ${group.questions[placing.i]?.number}`} (Esc để thôi).`
              : byOptions
                ? 'Vị trí chữ cái giúp học viên thấy lựa chọn ngay trên ảnh. Bỏ qua nếu ảnh đã in sẵn chữ cái.'
                : 'Đặt vị trí ô trống cho từng câu trên ảnh.'}
          </p>
          <div
            role="presentation"
            tabIndex={-1}
            onKeyDown={(e) => e.key === 'Escape' && setPlacing(null)}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              place((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
            }}
            className={cn(
              'relative w-fit max-w-full overflow-hidden rounded-lg border border-border',
              placing && 'cursor-crosshair ring-2 ring-accent',
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API file */}
            <img
              src={fileUrl(imageId)}
              alt="Ảnh của nhóm câu hỏi"
              className="block max-h-[480px] max-w-full select-none"
              draggable={false}
            />
            {markers.map((m) => (
              <span
                key={m.id}
                className={cn(
                  'pointer-events-none absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-caption font-bold',
                  m.active
                    ? 'border-accent bg-accent text-accent-foreground'
                    : 'border-accent bg-surface text-accent',
                )}
                style={{ left: `${m.at.x * 100}%`, top: `${m.at.y * 100}%` }}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {byOptions && (
        <>
          <SectionTitle>Các chữ cái trên ảnh</SectionTitle>
          <ol className="flex flex-col gap-2">
            {options.map((o, oi) => (
              <li key={oi} className="flex flex-wrap items-center gap-1.5">
                <span className="w-8 shrink-0 text-center font-mono text-label font-semibold">{o.key}</span>
                <Input
                  lang="en"
                  aria-label={`Mô tả chữ ${o.key}`}
                  className="h-9 min-w-40 flex-1"
                  value={o.text}
                  readOnly={readOnly}
                  onChange={(e) => edit((g) => g.options && (g.options[oi]!.text = e.target.value))}
                />
                {placeButton({ kind: 'option', i: oi }, Boolean(o.at))}
                <RowControls
                  index={oi}
                  length={options.length}
                  minLength={2}
                  noun="chữ cái"
                  onMove={(a, b) =>
                    edit((g) => {
                      if (!g.options) return;
                      move(g.options, a, b);
                      g.options = g.options.map((x, k) => ({ ...x, key: String.fromCharCode(65 + k) }));
                    })
                  }
                  onRemove={() =>
                    edit((g) => {
                      if (!g.options) return;
                      g.options.splice(oi, 1);
                      g.options = g.options.map((x, k) => ({ ...x, key: String.fromCharCode(65 + k) }));
                    })
                  }
                />
              </li>
            ))}
          </ol>
          <p className="-mt-1 text-caption text-ink-subtle">
            Mô tả có thể để chính chữ cái nếu ảnh không cần chú thích.
          </p>
          {options.length < 15 && (
            <AddButton
              onClick={() =>
                edit((g) => {
                  const key = String.fromCharCode(65 + (g.options?.length ?? 0));
                  g.options = [...(g.options ?? []), { key, text: key }];
                })
              }
            >
              Thêm chữ cái
            </AddButton>
          )}
        </>
      )}

      <SectionTitle
        actions={
          <PasteButton
            label="Dán tên các vị trí"
            title="Dán tên các vị trí cần nối"
            description="Mỗi dòng một vị trí (ví dụ: Café, Car park…)."
            placeholder={'11 Café\n12 Toilets\n13 Gift shop'}
            onApply={(text) => {
              const lines = parseLines(text);
              if (!lines.length) return 'Chưa có nội dung.';
              edit((g) => {
                g.questions = lines.map((prompt, k) => ({
                  ...(g.questions[k] ?? { number: 0, answer: '', accepted: [] }),
                  prompt,
                }));
              });
              return null;
            }}
          />
        }
      >
        Câu hỏi
      </SectionTitle>
      <ol className="flex flex-col gap-3">
        {group.questions.map((q, qi) => (
          <QuestionCard
            key={qi}
            q={q}
            index={qi}
            length={group.questions.length}
            onMove={(a, b) => edit((g) => move(g.questions, a, b))}
            onRemove={() => edit((g) => g.questions.splice(qi, 1))}
            extras={
              <QuestionExtras
                q={q}
                paragraphs={paragraphs}
                onChange={(patch) => edit((g) => Object.assign(g.questions[qi]!, patch))}
              />
            }
          >
            <AreaField
              label={byOptions ? 'Tên vị trí / bộ phận' : 'Gợi ý (tùy chọn)'}
              rows={1}
              value={q.prompt}
              onChange={(v) => edit((g) => (g.questions[qi]!.prompt = v || undefined))}
            />
            {byOptions ? (
              <div className="flex flex-col gap-1.5">
                <Label>Đáp án đúng</Label>
                <KeyPicker
                  label={`Đáp án câu ${q.number}`}
                  value={q.answer.toUpperCase()}
                  choices={options.map((o) => ({ key: o.key, label: o.key }))}
                  onChange={(k) => edit((g) => (g.questions[qi]!.answer = k))}
                />
              </div>
            ) : (
              <>
                <TextAnswer
                  answer={q.answer}
                  accepted={q.accepted}
                  wordLimit={group.wordLimit}
                  onChange={(answer, accepted) =>
                    edit((g) => {
                      g.questions[qi]!.answer = answer;
                      g.questions[qi]!.accepted = accepted;
                    })
                  }
                />
                <div>{placeButton({ kind: 'question', i: qi }, Boolean(q.pin))}</div>
              </>
            )}
          </QuestionCard>
        ))}
      </ol>
      <AddButton
        onClick={() => edit((g) => g.questions.push({ number: 0, prompt: '', answer: '', accepted: [] }))}
      >
        Thêm câu
      </AddButton>
    </section>
  );
}

'use client';

// Per-question building blocks: question card, text answer with word-limit check, explanation + evidence.
import { ChevronDown, Quote, X } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { wordLimitText } from '@/lib/builder/templates';
import { useBuilder } from './context';
import { IconButton, RowControls } from './fields';

type Q = { number: number; explanation?: string; evidence?: { paragraphLabel?: string; quote: string } };

/** Card around one question: number badge, controls, body, and a collapsible "explanation & evidence" area. */
export function QuestionCard({
  q,
  index,
  length,
  onMove,
  onRemove,
  minLength = 1,
  children,
  extras,
  canReorder = true,
}: {
  q: Q;
  index: number;
  length: number;
  onMove?: (from: number, to: number) => void;
  onRemove?: () => void;
  minLength?: number;
  children: ReactNode;
  extras?: ReactNode;
  canReorder?: boolean;
}) {
  return (
    <li
      id={`builder-q-${q.number}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3"
    >
      <div className="flex items-start gap-3">
        <span className="mt-1.5 inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md bg-surface-muted px-1.5 font-mono text-label font-semibold">
          {q.number}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
        {canReorder && onMove && onRemove && (
          <RowControls
            index={index}
            length={length}
            minLength={minLength}
            noun="câu"
            onMove={onMove}
            onRemove={onRemove}
          />
        )}
      </div>
      {extras}
    </li>
  );
}

/** Words that count against the limit; "AND/OR A NUMBER" allows one extra number. */
export function overLimit(
  text: string,
  wl: { maxWords: number; allowNumber?: boolean } | undefined,
): boolean {
  if (!wl || !text.trim()) return false;
  const tokens = text.replace(/[()]/g, ' ').trim().split(/\s+/).filter(Boolean);
  const numbers = tokens.filter((t) => /^[\d.,:/%-]+$/.test(t));
  const words = tokens.length - numbers.length;
  if (wl.allowNumber) return words > wl.maxWords || numbers.length > 1;
  return tokens.length > wl.maxWords;
}

const splitAcc = (s: string) =>
  s
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean);

export function TextAnswer({
  answer,
  accepted,
  onChange,
  wordLimit,
}: {
  answer: string;
  accepted: string[] | undefined;
  onChange: (answer: string, accepted: string[]) => void;
  wordLimit?: { maxWords: number; allowNumber?: boolean };
}) {
  const id = useId();
  const { readOnly } = useBuilder();
  const acc = accepted ?? [];
  const joined = acc.join('; ');
  const [accText, setAccText] = useState(joined);
  const [prev, setPrev] = useState(joined);
  if (prev !== joined) {
    // accepted answers changed from outside (pasted answer key) → refresh the text box
    setPrev(joined);
    if (splitAcc(accText).join('; ') !== joined) setAccText(joined);
  }
  const bad = [answer, ...acc].filter((a) => overLimit(a, wordLimit));
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-a`} className="text-label-sm">
          Đáp án đúng
        </Label>
        <Input
          id={`${id}-a`}
          lang="en"
          value={answer}
          readOnly={readOnly}
          placeholder="vd. (the) museum"
          aria-invalid={overLimit(answer, wordLimit) || undefined}
          onChange={(e) => onChange(e.target.value, acc)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-acc`} className="text-label-sm">
          Chấp nhận thêm <span className="font-normal text-ink-subtle">(cách nhau bằng ;)</span>
        </Label>
        <Input
          id={`${id}-acc`}
          lang="en"
          value={accText}
          readOnly={readOnly}
          placeholder="vd. colour; color"
          onChange={(e) => {
            setAccText(e.target.value);
            const list = splitAcc(e.target.value);
            setPrev(list.join('; '));
            onChange(answer, list);
          }}
        />
      </div>
      {bad.length > 0 && (
        <p className="text-caption text-danger sm:col-span-2">
          Vượt giới hạn “{wordLimitText(wordLimit)}”: {bad.join(', ')}
        </p>
      )}
    </div>
  );
}

/** Collapsible explanation + evidence (evidence only for Reading, where a passage exists). */
export function QuestionExtras({
  q,
  onChange,
  paragraphs,
}: {
  q: Q;
  onChange: (patch: Partial<Pick<Q, 'explanation' | 'evidence'>>) => void;
  paragraphs?: { label?: string; text: string }[];
}) {
  const { readOnly } = useBuilder();
  const has = Boolean(q.explanation || q.evidence);
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="border-t border-divider pt-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-label-sm text-ink-muted outline-none hover:text-ink focus-visible:shadow-focus"
      >
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
        Giải thích & chỗ chứa đáp án
        {has && <span className="ml-1 size-1.5 rounded-full bg-accent" aria-label="đã có" />}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={id} className="text-label-sm">
              Giải thích (hiện ở màn kết quả)
            </Label>
            <Textarea
              id={id}
              rows={2}
              className="min-h-0"
              value={q.explanation ?? ''}
              readOnly={readOnly}
              onChange={(e) => onChange({ explanation: e.target.value || undefined })}
            />
          </div>
          {paragraphs && (
            <EvidenceField
              evidence={q.evidence}
              paragraphs={paragraphs}
              onChange={(evidence) => onChange({ evidence })}
            />
          )}
        </div>
      )}
    </div>
  );
}

function EvidenceField({
  evidence,
  paragraphs,
  onChange,
}: {
  evidence: Q['evidence'];
  paragraphs: { label?: string; text: string }[];
  onChange: (e: Q['evidence']) => void;
}) {
  const { readOnly } = useBuilder();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  function take() {
    const sel = window.getSelection();
    const quote = sel?.toString().replace(/\s+/g, ' ').trim() ?? '';
    if (quote.length < 3) return setError('Hãy bôi đen ít nhất vài từ trong bài đọc.');
    const node = sel?.anchorNode;
    const el = (node instanceof Element ? node : node?.parentElement)?.closest('[data-para]');
    if (!el || !box.current?.contains(el)) return setError('Hãy bôi đen trong khung bài đọc bên dưới.');
    const label = el.getAttribute('data-label') || undefined;
    onChange({ paragraphLabel: label, quote: quote.slice(0, 1000) });
    setError(null);
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-label-sm font-medium">Chỗ chứa đáp án trong bài</span>
      {evidence ? (
        <div className="flex items-start gap-2 rounded-lg bg-surface-muted p-2.5">
          <Quote className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
          <p lang="en" className="flex-1 text-label text-ink-secondary">
            {evidence.paragraphLabel && <strong className="mr-1">[{evidence.paragraphLabel}]</strong>}
            {evidence.quote}
          </p>
          {!readOnly && (
            <IconButton label="Bỏ chỗ chứa đáp án" onClick={() => onChange(undefined)}>
              <X className="size-4" aria-hidden />
            </IconButton>
          )}
        </div>
      ) : (
        <p className="text-caption text-ink-subtle">
          Chưa gắn. Màn kết quả sẽ tô sáng đoạn này cho học viên.
        </p>
      )}
      {!readOnly && (
        <Dialog open={open} onOpenChange={setOpen}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => setOpen(true)}
          >
            <Quote className="size-4" aria-hidden /> {evidence ? 'Chọn lại' : 'Chọn trong bài đọc'}
          </Button>
          <DialogContent
            title="Bôi đen câu chứa đáp án"
            description="Kéo chuột chọn đúng câu / cụm từ trong bài, rồi bấm “Dùng đoạn đã chọn”."
            className="max-w-3xl"
          >
            <div
              ref={box}
              className="flex max-h-[55dvh] flex-col gap-3 overflow-y-auto rounded-lg border border-border p-4"
            >
              {paragraphs.map((p, i) => (
                <p
                  key={i}
                  data-para
                  data-label={p.label ?? ''}
                  lang="en"
                  className="font-reading text-body-lg"
                >
                  {p.label && <strong className="mr-2 font-sans select-none">{p.label}</strong>}
                  {p.text}
                </p>
              ))}
            </div>
            {error && <p className="text-body text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Hủy
              </Button>
              <Button type="button" onMouseDown={(e) => e.preventDefault()} onClick={take}>
                Dùng đoạn đã chọn
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

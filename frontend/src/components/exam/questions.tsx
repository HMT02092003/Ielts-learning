'use client';

// Question components for the 12 IELTS types (spec §5/§6 P3). Exam shell: no animation, state changes are instant.
// Matching uses a Select as the primary input (also the keyboard/click alternative to drag & drop, D10);
// headings/features can additionally be dragged onto a question slot (@dnd-kit/react).
import { DragDropProvider, useDraggable, useDroppable } from '@dnd-kit/react';
import { Flag } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { fileUrl } from '@/services/admin.service';
import type { ContentGroup, ContentQuestion } from '@/shared/attempt';
import type { AnswerValue } from '@/shared/question-types';
import { useExamStore } from '@/stores/exam-store';

type Opt = { key: string; text: string; at?: { x: number; y: number } };

const keyOf = (v: AnswerValue | null | undefined) => (v?.kind === 'KEY' ? v.key : '');
const textOf = (v: AnswerValue | null | undefined) => (v?.kind === 'TEXT' ? v.text : '');
const opts = (v: unknown): Opt[] => (Array.isArray(v) ? (v as Opt[]) : []);

function useAnswer(q: { id: string }) {
  const value = useExamStore((s) => s.answers[q.id] ?? null);
  const setAnswer = useExamStore((s) => s.setAnswer);
  return [value, (v: AnswerValue | null) => setAnswer(q.id, v)] as const;
}

/** Question wrapper: number, flag toggle, anchor for the bottom navigator. */
function QuestionShell({
  q,
  children,
  inline,
}: {
  q: ContentQuestion;
  children: ReactNode;
  inline?: boolean;
}) {
  const current = useExamStore((s) => s.current === q.number);
  const flagged = useExamStore((s) => Boolean(s.flagged[q.id]));
  const toggleFlag = useExamStore((s) => s.toggleFlag);
  const goTo = useExamStore((s) => s.goTo);
  return (
    <div
      id={`q-${q.number}`}
      data-question={q.number}
      onFocusCapture={() => goTo(q.number)}
      className={cn(
        'scroll-mt-4 rounded-xl border p-4',
        current ? 'border-ink' : 'border-border',
        inline ? 'flex flex-wrap items-center gap-3' : 'flex flex-col gap-3',
      )}
    >
      {children}
      <button
        type="button"
        aria-pressed={flagged}
        aria-label={`Đánh dấu câu ${q.number} để xem lại`}
        onClick={() => toggleFlag(q.id)}
        className={cn(
          'flex items-center gap-1.5 self-start rounded-md px-2 py-1 text-label-sm outline-none focus-visible:shadow-focus',
          flagged ? 'bg-warning-soft text-warning-ink' : 'text-ink-subtle hover:text-ink-muted',
        )}
      >
        <Flag className="size-3.5" aria-hidden /> {flagged ? 'Đã đánh dấu' : 'Đánh dấu'}
      </button>
    </div>
  );
}

const Num = ({ n }: { n: number }) => <strong className="mr-2 font-sans text-body font-semibold">{n}</strong>;

/** TFNG / YNNG / MCQ single: radio pills inside a fieldset (design: h36 pills, selected = accent-soft). */
function RadioPills({
  q,
  choices,
  name,
}: {
  q: ContentQuestion;
  choices: { key: string; label: ReactNode }[];
  name: string;
}) {
  const [value, set] = useAnswer(q);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">{name}</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => {
          const checked = keyOf(value) === c.key;
          return (
            <label
              key={c.key}
              className={cn(
                'flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3.5 py-1.5 text-body focus-within:shadow-focus',
                checked
                  ? 'border-accent bg-accent-soft font-semibold text-accent'
                  : 'border-border-strong bg-surface text-ink',
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name={`q${q.id}`}
                checked={checked}
                onChange={() => set({ kind: 'KEY', key: c.key })}
              />
              {c.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Judgement({ group }: { group: ContentGroup }) {
  const keys =
    group.type === 'TRUE_FALSE_NOT_GIVEN' ? ['TRUE', 'FALSE', 'NOT_GIVEN'] : ['YES', 'NO', 'NOT_GIVEN'];
  return (
    <>
      {group.questions.map((q) => (
        <QuestionShell key={q.id} q={q}>
          <p className="text-reading-q">
            <Num n={q.number} />
            {q.prompt}
          </p>
          <RadioPills
            q={q}
            name={`Câu ${q.number}`}
            choices={keys.map((k) => ({ key: k, label: k.replace('_', ' ') }))}
          />
        </QuestionShell>
      ))}
    </>
  );
}

function McSingle({ group }: { group: ContentGroup }) {
  return (
    <>
      {group.questions.map((q) => (
        <QuestionShell key={q.id} q={q}>
          <p className="text-reading-q">
            <Num n={q.number} />
            {q.prompt}
          </p>
          <div className="flex flex-col gap-1.5">
            <RadioPills
              q={q}
              name={`Câu ${q.number}`}
              choices={opts(q.content.options).map((o) => ({
                key: o.key,
                label: (
                  <span className="text-left">
                    <strong className="mr-2">{o.key}</strong>
                    {o.text}
                  </span>
                ),
              }))}
            />
          </div>
        </QuestionShell>
      ))}
    </>
  );
}

/** "Choose TWO letters": checkboxes; picked letters (A→Z) are assigned to the group's questions in order. */
function McMulti({ group }: { group: ContentGroup }) {
  const answers = useExamStore((s) => s.answers);
  const setAnswers = useExamStore((s) => s.setAnswers);
  const options = opts(group.config.options);
  const chooseCount = Number(group.config.chooseCount ?? group.questions.length);
  const picked = group.questions.map((q) => keyOf(answers[q.id])).filter(Boolean);
  const toggle = (key: string) => {
    const next = picked.includes(key) ? picked.filter((k) => k !== key) : [...picked, key];
    if (next.length > chooseCount) return;
    const sorted = [...next].sort();
    setAnswers(
      Object.fromEntries(
        group.questions.map((q, i) => [
          q.id,
          sorted[i] ? ({ kind: 'KEY', key: sorted[i] } as AnswerValue) : null,
        ]),
      ),
    );
  };
  const first = group.questions[0];
  if (!first) return null;
  return (
    <QuestionShell q={first}>
      <p className="text-reading-q">
        <Num n={group.questionFrom} />– {group.questionTo} · {String(group.config.stem ?? '')}
      </p>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="sr-only">Chọn {chooseCount} đáp án</legend>
        {options.map((o) => {
          const checked = picked.includes(o.key);
          return (
            <label
              key={o.key}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-md border px-3.5 py-2 text-reading-q focus-within:shadow-focus',
                checked ? 'border-accent bg-accent-soft' : 'border-border-strong bg-surface',
              )}
            >
              <input
                type="checkbox"
                className="mt-1 accent-[var(--accent)]"
                checked={checked}
                onChange={() => toggle(o.key)}
              />
              <span>
                <strong className="mr-2 font-sans">{o.key}</strong>
                {o.text}
              </span>
            </label>
          );
        })}
      </fieldset>
      <p className="text-caption text-ink-muted">
        Đã chọn {picked.length}/{chooseCount}
      </p>
    </QuestionShell>
  );
}

/** Native select in the exam style (w200). Options already used elsewhere are struck through (design §6). */
function KeySelect({
  q,
  options,
  used,
  label,
}: {
  q: ContentQuestion;
  options: Opt[];
  used?: ReadonlySet<string>;
  label: string;
}) {
  const [value, set] = useAnswer(q);
  return (
    <select
      aria-label={label}
      value={keyOf(value)}
      onChange={(e) => set(e.target.value ? { kind: 'KEY', key: e.target.value } : null)}
      className={cn(
        'h-9 w-52 max-w-full rounded-sm border bg-surface px-2 text-body text-ink outline-none focus:border-accent focus:shadow-halo',
        keyOf(value) ? 'border-accent' : 'border-border-strong',
      )}
    >
      <option value="">—</option>
      {options.map((o) => (
        <option
          key={o.key}
          value={o.key}
          className={used?.has(o.key) && keyOf(value) !== o.key ? 'line-through' : ''}
        >
          {o.key} {o.text ? `— ${o.text.slice(0, 60)}` : ''}
        </option>
      ))}
    </select>
  );
}

function DraggableOption({ o, used }: { o: Opt; used: boolean }) {
  const { ref, isDragging } = useDraggable({ id: `opt-${o.key}`, data: { key: o.key } });
  return (
    <li
      ref={ref}
      className={cn(
        'flex cursor-grab items-start gap-2 rounded-md border bg-surface px-3 py-2 text-reading-q',
        isDragging ? 'border-accent' : 'border-border',
        used && 'text-ink-subtle line-through',
      )}
    >
      <strong className="font-sans">{o.key}</strong>
      <span>{o.text}</span>
    </li>
  );
}

function DropSlot({ q, children }: { q: ContentQuestion; children: ReactNode }) {
  const { ref, isDropTarget } = useDroppable({ id: `slot-${q.id}`, data: { questionId: q.id } });
  return (
    <div
      ref={ref}
      className={cn('rounded-lg', isDropTarget && 'bg-accent-soft outline-2 outline-accent outline-dashed')}
    >
      {children}
    </div>
  );
}

/** Matching headings / information / features (+ sentence endings, classification). */
function Matching({ group, paragraphLabels }: { group: ContentGroup; paragraphLabels: string[] }) {
  const answers = useExamStore((s) => s.answers);
  const setAnswer = useExamStore((s) => s.setAnswer);
  const isHeadings = group.type === 'MATCHING_HEADINGS';
  const isInfo = group.type === 'MATCHING_INFORMATION';
  const options: Opt[] = isHeadings
    ? opts(group.config.headings)
    : isInfo
      ? (Array.isArray(group.config.paragraphLabels)
          ? (group.config.paragraphLabels as string[])
          : paragraphLabels
        ).map((k) => ({ key: k, text: '' }))
      : opts(group.config.features);
  const used = new Set(group.questions.map((q) => keyOf(answers[q.id])).filter(Boolean));
  const listTitle = isHeadings ? 'List of Headings' : String(group.config.listTitle ?? '');

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        const { source, target, canceled } = event.operation;
        if (canceled || !source || !target) return;
        const key = (source.data as { key?: string } | undefined)?.key;
        const questionId = (target.data as { questionId?: string } | undefined)?.questionId;
        if (key && questionId) setAnswer(questionId, { kind: 'KEY', key });
      }}
    >
      <div className="flex flex-col gap-3">
        {!isInfo && options.length > 0 && (
          <section className="rounded-xl bg-surface-muted p-4">
            {listTitle && <h4 className="mb-2 text-label font-semibold">{listTitle}</h4>}
            <ul className="flex flex-col gap-1.5" aria-label="Kéo một mục vào câu hỏi, hoặc chọn trong ô">
              {options.map((o) => (
                <DraggableOption key={o.key} o={o} used={used.has(o.key)} />
              ))}
            </ul>
          </section>
        )}
        {group.questions.map((q) => {
          const label = isHeadings ? `Paragraph ${String(q.content.paragraphLabel ?? '')}` : (q.prompt ?? '');
          return (
            <QuestionShell key={q.id} q={q} inline>
              <DropSlot q={q}>
                <div className="flex flex-wrap items-center gap-3 p-1">
                  <p className="text-reading-q">
                    <Num n={q.number} />
                    {label}
                  </p>
                  <KeySelect q={q} options={options} used={used} label={`Câu ${q.number}`} />
                </div>
              </DropSlot>
            </QuestionShell>
          );
        })}
      </div>
    </DragDropProvider>
  );
}

/** Inline blank (design: h34, radius-sm, w160 growing to fit, accent border once answered). */
function Blank({ q }: { q: ContentQuestion }) {
  const [value, set] = useAnswer(q);
  const text = textOf(value);
  const goTo = useExamStore((s) => s.goTo);
  return (
    <input
      id={`q-${q.number}`}
      aria-label={`Question ${q.number}`}
      value={text}
      onFocus={() => goTo(q.number)}
      onChange={(e) => set(e.target.value ? { kind: 'TEXT', text: e.target.value } : null)}
      autoComplete="off"
      spellCheck={false}
      style={{ width: `${Math.max(10, text.length + 2)}ch` }}
      placeholder={String(q.number)}
      className={cn(
        'mx-1 inline-block h-[34px] max-w-full min-w-40 rounded-sm border bg-surface px-2 align-middle font-sans text-[0.9375rem] text-ink outline-none placeholder:text-ink-subtle focus:border-accent focus:shadow-halo',
        text ? 'border-accent' : 'border-border-strong',
      )}
    />
  );
}

function BankBlank({ q, bank }: { q: ContentQuestion; bank: Opt[] }) {
  return (
    <span className="mx-1 inline-block align-middle">
      <KeySelect q={q} options={bank} label={`Question ${q.number}`} />
    </span>
  );
}

/** Replace every {{n}} in a text with the blank of question n. */
function WithBlanks({
  text,
  byNumber,
  bank,
}: {
  text: string;
  byNumber: Map<number, ContentQuestion>;
  bank?: Opt[];
}) {
  const parts = text.split(/\{\{(\d{1,2})\}\}/g);
  return (
    <>
      {parts.map((p, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{p}</Fragment>;
        const q = byNumber.get(Number(p));
        if (!q) return <Fragment key={i}>____</Fragment>;
        return bank ? <BankBlank key={i} q={q} bank={bank} /> : <Blank key={i} q={q} />;
      })}
    </>
  );
}

function Completion({ group }: { group: ContentGroup }) {
  const byNumber = new Map(group.questions.map((q) => [q.number, q]));
  const bank =
    group.config.answerMode === 'WORD_BANK'
      ? opts((group.config.wordBank as { options?: unknown } | undefined)?.options)
      : undefined;
  const title = typeof group.config.title === 'string' ? group.config.title : null;

  if (group.type === 'SENTENCE_COMPLETION' || group.type === 'SHORT_ANSWER') {
    return (
      <>
        {group.questions.map((q) => (
          <QuestionShell key={q.id} q={q}>
            <p className="text-reading-q leading-loose">
              <Num n={q.number} />
              {q.prompt?.includes('{{') ? (
                <WithBlanks text={q.prompt} byNumber={byNumber} />
              ) : (
                <>
                  {q.prompt} <Blank q={q} />
                </>
              )}
            </p>
          </QuestionShell>
        ))}
      </>
    );
  }

  const tpl = group.config.template as
    | { layout: 'NOTES'; lines: { style: string; indent?: number; text: string }[] }
    | { layout: 'TABLE'; columns: string[]; rows: { cells: string[] }[] }
    | { layout: 'FLOWCHART'; steps: { text: string }[] }
    | undefined;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
      {title && <h4 className="text-center text-reading-q font-semibold">{title}</h4>}
      {group.type === 'SUMMARY_COMPLETION' && typeof group.config.text === 'string' && (
        <p className="text-reading-q leading-loose">
          <WithBlanks text={group.config.text} byNumber={byNumber} bank={bank} />
        </p>
      )}
      {tpl?.layout === 'NOTES' && (
        <div className="flex flex-col gap-1 text-reading-q leading-loose">
          {tpl.lines.map((l, i) => (
            <p
              key={i}
              style={{ paddingLeft: `${(l.indent ?? 0) * 1.5}rem` }}
              className={cn(
                l.style === 'HEADING' && 'font-semibold',
                l.style === 'BULLET' && 'before:mr-2 before:content-["•"]',
              )}
            >
              <WithBlanks text={l.text} byNumber={byNumber} bank={bank} />
            </p>
          ))}
        </div>
      )}
      {tpl?.layout === 'TABLE' && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-reading-q">
            <thead>
              <tr>
                {tpl.columns.map((c, i) => (
                  <th
                    key={i}
                    className="border border-border-strong bg-surface-muted px-3 py-2 text-left font-semibold"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tpl.rows.map((r, i) => (
                <tr key={i}>
                  {r.cells.map((c, j) => (
                    <td key={j} className="border border-border-strong px-3 py-2 align-top leading-loose">
                      <WithBlanks text={c} byNumber={byNumber} bank={bank} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tpl?.layout === 'FLOWCHART' && (
        <ol className="flex flex-col items-center gap-2 text-reading-q">
          {tpl.steps.map((s, i) => (
            <Fragment key={i}>
              {i > 0 && (
                <li aria-hidden className="text-ink-muted">
                  ↓
                </li>
              )}
              <li className="w-full max-w-xl rounded-lg border border-border-strong px-4 py-2 text-center leading-loose">
                <WithBlanks text={s.text} byNumber={byNumber} bank={bank} />
              </li>
            </Fragment>
          ))}
        </ol>
      )}
      {bank && (
        <ul className="grid grid-cols-2 gap-1.5 rounded-lg bg-surface-muted p-3 text-reading-q sm:grid-cols-3">
          {bank.map((o) => (
            <li key={o.key}>
              <strong className="mr-2 font-sans">{o.key}</strong>
              {o.text}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {group.questions.map((q) => (
          <FlagChip key={q.id} q={q} />
        ))}
      </div>
    </div>
  );
}

function FlagChip({ q }: { q: ContentQuestion }) {
  const flagged = useExamStore((s) => Boolean(s.flagged[q.id]));
  const toggleFlag = useExamStore((s) => s.toggleFlag);
  return (
    <button
      type="button"
      aria-pressed={flagged}
      aria-label={`Đánh dấu câu ${q.number}`}
      onClick={() => toggleFlag(q.id)}
      className={cn(
        'flex items-center gap-1 rounded-md px-2 py-1 text-label-sm outline-none focus-visible:shadow-focus',
        flagged ? 'bg-warning-soft text-warning-ink' : 'text-ink-subtle hover:text-ink-muted',
      )}
    >
      <Flag className="size-3" aria-hidden /> {q.number}
    </button>
  );
}

function MapDiagram({ group }: { group: ContentGroup }) {
  const options = opts(group.config.options);
  const byOptions = group.config.answerMode === 'OPTIONS';
  return (
    <div className="flex flex-col gap-3">
      {group.imageId && (
        <div className="relative overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API image */}
          <img src={fileUrl(group.imageId)} alt="Map / diagram" className="block h-auto w-full" />
          {byOptions &&
            options.map(
              (o) =>
                o.at && (
                  <span
                    key={o.key}
                    className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-ink bg-surface text-label-sm font-semibold"
                    style={{ left: `${o.at.x * 100}%`, top: `${o.at.y * 100}%` }}
                  >
                    {o.key}
                  </span>
                ),
            )}
          {!byOptions &&
            group.questions.map((q) => {
              const pin = q.content.pin as { x: number; y: number } | undefined;
              return pin ? (
                <span
                  key={q.id}
                  className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ink text-label-sm font-semibold text-ink-inverse"
                  style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
                >
                  {q.number}
                </span>
              ) : null;
            })}
        </div>
      )}
      {group.questions.map((q) => (
        <QuestionShell key={q.id} q={q} inline>
          <p className="text-reading-q">
            <Num n={q.number} />
            {q.prompt}
          </p>
          {byOptions ? <KeySelect q={q} options={options} label={`Câu ${q.number}`} /> : <Blank q={q} />}
        </QuestionShell>
      ))}
    </div>
  );
}

export function QuestionGroupView({
  group,
  paragraphLabels,
}: {
  group: ContentGroup;
  paragraphLabels: string[];
}) {
  let body: ReactNode;
  switch (group.type) {
    case 'TRUE_FALSE_NOT_GIVEN':
    case 'YES_NO_NOT_GIVEN':
      body = <Judgement group={group} />;
      break;
    case 'MULTIPLE_CHOICE_SINGLE':
      body = <McSingle group={group} />;
      break;
    case 'MULTIPLE_CHOICE_MULTI':
      body = <McMulti group={group} />;
      break;
    case 'MATCHING_HEADINGS':
    case 'MATCHING_INFORMATION':
    case 'MATCHING_FEATURES':
      body = <Matching group={group} paragraphLabels={paragraphLabels} />;
      break;
    case 'MAP_DIAGRAM_LABELLING':
      body = <MapDiagram group={group} />;
      break;
    default:
      body = <Completion group={group} />;
  }
  return (
    <section
      lang="en"
      aria-label={`Questions ${group.questionFrom}–${group.questionTo}`}
      className="flex flex-col gap-3"
    >
      <h3 className="font-sans text-h3 font-semibold">
        Questions {group.questionFrom}
        {group.questionTo !== group.questionFrom ? `–${group.questionTo}` : ''}
      </h3>
      <p className="whitespace-pre-line text-reading-q text-ink-muted">{group.instructions}</p>
      {body}
    </section>
  );
}

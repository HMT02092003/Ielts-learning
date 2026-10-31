'use client';

// Split view for setting answers: passage/transcript on the left, questions with their answers on the right.
// Editable mode writes into the test document; locked mode (published / has attempts) only hotfixes
// accepted variants and explanations per question.
import { useState, type ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { viAdmin } from '@/i18n/vi-admin';
import { QUESTION_TYPE_LABEL } from '@/i18n/vi-exam';
import {
  answerParts,
  setAt,
  syncLines,
  toLines,
  type AnswerGroupView,
  type AnswerPart,
  type AnswerQuestionView,
  type Choice,
} from '@/lib/answer-doc';
import { cn } from '@/lib/cn';
import type { AdminQuestion } from '@/services/admin.service';

const t = viAdmin.tests;

type HotfixBody = { acceptedAnswers?: string[]; explanation: string | null };
export interface AnswerEditorProps {
  /** undefined = the JSON does not parse. */
  doc: unknown;
  editable: boolean;
  onChange: (doc: unknown) => void;
  hotfix?: {
    questions: AdminQuestion[];
    save: (q: AdminQuestion, body: HotfixBody, done: () => void) => void;
    /** Id of the question being saved. */
    savingId: string | null;
  };
}

type Field = 'answer' | 'accepted' | 'explanation';
type Edit = [AnswerQuestionView['path'], unknown];

/** One-variant-per-line textarea that keeps the raw text while typing (blank lines, trailing newline). */
function LinesTextarea({
  value,
  onChange,
  ...props
}: { value: string[]; onChange: (v: string[]) => void } & Omit<
  ComponentProps<'textarea'>,
  'value' | 'onChange'
>) {
  const [state, setState] = useState(() => ({ key: value.join('\n'), text: value.join('\n') }));
  // Resync when the value changed from outside (e.g. the JSON editor); settles in one extra render.
  const next = syncLines(state, value);
  if (next) setState(next);
  return (
    <Textarea
      {...props}
      value={(next ?? state).text}
      onChange={(e) => {
        const lines = toLines(e.target.value);
        setState({ key: lines.join('\n'), text: e.target.value });
        onChange(lines);
      }}
    />
  );
}

function ChoiceButtons({
  name,
  choices,
  selected,
  onToggle,
  disabled,
  full = false,
  labelFor,
}: {
  name: string;
  choices: Choice[];
  selected: string[];
  onToggle: (key: string) => void;
  disabled: boolean;
  /** MC multi with every slot taken: only selected keys stay clickable. */
  full?: boolean;
  labelFor: (key: string) => string;
}) {
  // Option text is listed unless it only repeats the key (TFNG/YNNG, paragraph letters).
  const legend = choices.filter((c) => c.text && c.text !== c.key.replace(/_/g, ' '));
  return (
    <div className="flex flex-col gap-1.5">
      {legend.length > 0 && (
        <ul className="text-caption text-ink-muted">
          {legend.map((c) => (
            <li key={c.key}>
              {c.key} — {c.text}
            </li>
          ))}
        </ul>
      )}
      <div
        role="group"
        aria-label={disabled ? `${name} (${t.locked})` : name}
        className="flex flex-wrap gap-1.5"
      >
        {choices.map((c) => {
          const on = selected.includes(c.key);
          const off = disabled || (full && !on);
          return (
            <Button
              key={c.key}
              type="button"
              size="sm"
              variant={on ? 'primary' : 'secondary'}
              aria-pressed={on}
              aria-disabled={off || undefined}
              aria-label={labelFor(c.key)}
              title={c.text}
              className={cn(off && 'cursor-default', off && !disabled && 'text-ink-subtle')}
              onClick={() => !off && onToggle(c.key)}
            >
              {c.key.replace(/_/g, ' ')}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function QuestionRow({
  q,
  choices,
  editable,
  set,
  hotfix,
  match,
}: {
  q: AnswerQuestionView;
  /** null = free text; [] = the answer is set on the group (MC multi). */
  choices: Choice[] | null;
  editable: boolean;
  set: (patch: Partial<Record<Field, unknown>>) => void;
  hotfix: AnswerEditorProps['hotfix'];
  match: AdminQuestion | undefined;
}) {
  const [accepted, setAccepted] = useState(match ? match.acceptedAnswers : q.accepted);
  const [explanation, setExplanation] = useState(match ? (match.explanation ?? '') : q.explanation);
  const n = q.number;
  const locked = !editable;
  const ownAnswer = choices === null || choices.length > 0;
  return (
    <div className="flex flex-col gap-2 border-b border-divider py-3 last:border-b-0">
      <p className="text-body">
        <span className="font-semibold">{t.questionN(n)}</span>
        {q.label && <span className="text-ink-muted"> · {q.label}</span>}
      </p>
      {choices ? (
        <ChoiceButtons
          name={t.questionN(n)}
          choices={choices}
          selected={[q.answer]}
          disabled={locked}
          onToggle={(key) => set({ answer: key })}
          labelFor={(key) => `${t.questionN(n)}: ${key}`}
        />
      ) : (
        <>
          <Input
            aria-label={`${t.correct} ${n}`}
            placeholder={t.correct}
            value={q.answer}
            readOnly={locked}
            onChange={(e) => set({ answer: e.target.value })}
          />
          <LinesTextarea
            aria-label={`${t.accepted} ${n}`}
            placeholder={t.accepted}
            className="min-h-16"
            value={locked ? accepted : q.accepted}
            readOnly={locked && !match}
            onChange={(v) => (locked ? setAccepted(v) : set({ accepted: v.length ? v : undefined }))}
          />
        </>
      )}
      {editable && ownAnswer && !q.answer.trim() && <p className="text-caption text-danger">{t.noAnswer}</p>}
      <Textarea
        aria-label={`${t.explanation} ${n}`}
        placeholder={t.explanation}
        className="min-h-16"
        value={locked ? explanation : q.explanation}
        readOnly={locked && !match}
        onChange={(e) =>
          locked ? setExplanation(e.target.value) : set({ explanation: e.target.value || undefined })
        }
      />
      {locked && match && hotfix && (
        <div>
          <Button
            variant="secondary"
            size="sm"
            aria-label={t.saveRow(n)}
            loading={hotfix.savingId === match.id}
            onClick={() => {
              const text = explanation.trim();
              hotfix.save(
                match,
                { ...(choices ? {} : { acceptedAnswers: accepted }), explanation: text || null },
                // Mirror the saved values into the (read-only) JSON view.
                () =>
                  set({
                    ...(choices ? {} : { accepted: accepted.length ? accepted : undefined }),
                    explanation: text || undefined,
                  }),
              );
            }}
          >
            {t.save}
          </Button>
        </div>
      )}
    </div>
  );
}

function GroupBlock({
  g,
  part,
  editable,
  update,
  hotfix,
}: {
  g: AnswerGroupView;
  part: AnswerPart;
  editable: boolean;
  update: (edits: Edit[]) => void;
  hotfix: AnswerEditorProps['hotfix'];
}) {
  const multi = g.multi;
  const range = t.range(g.from, g.to);
  return (
    <section className="flex flex-col gap-1 rounded-xl border border-border p-4">
      <p className="text-label font-medium">
        {QUESTION_TYPE_LABEL[g.type as keyof typeof QUESTION_TYPE_LABEL] ?? g.type} · {range}
      </p>
      {g.instructions && <p className="text-caption text-ink-muted">{g.instructions}</p>}
      {multi && g.choices && (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-body">
            {t.chooseN(multi.chooseCount)} ·{' '}
            <span className={cn(editable && multi.answer.length < multi.chooseCount && 'text-danger')}>
              {t.chosen(multi.answer.length, multi.chooseCount)}
            </span>
          </p>
          <ChoiceButtons
            name={range}
            choices={g.choices}
            selected={multi.answer}
            disabled={!editable}
            full={multi.answer.length >= multi.chooseCount}
            labelFor={(key) => `${range}: ${key}`}
            onToggle={(key) =>
              update([
                [
                  [...g.path, 'answer'],
                  multi.answer.includes(key)
                    ? multi.answer.filter((k) => k !== key)
                    : [...multi.answer, key].sort(),
                ],
              ])
            }
          />
        </div>
      )}
      {g.questions.map((q) => {
        const match = hotfix?.questions.find((x) => x.skill === part.skill && x.number === q.number);
        return (
          <QuestionRow
            // Re-seed the hotfix fields once the DB question has loaded.
            key={`${q.path.join('.')}:${match?.id ?? ''}`}
            q={multi ? { ...q, label: q.label || t.chooseN(multi.chooseCount) } : q}
            choices={multi ? [] : g.perQuestionChoices ? (q.choices ?? []) : g.choices}
            editable={editable}
            set={(patch) =>
              update(Object.entries(patch).map(([field, value]): Edit => [[...q.path, field], value]))
            }
            hotfix={hotfix}
            match={match}
          />
        );
      })}
    </section>
  );
}

export function AnswerEditor({ doc, editable, onChange, hotfix }: AnswerEditorProps) {
  const [current, setCurrent] = useState(0);
  if (doc === undefined) return <p className="text-body text-danger">{t.answerJsonBroken}</p>;
  const parts = answerParts(doc);
  if (!parts.length) return <p className="text-body text-ink-muted">{t.noAnswerParts}</p>;
  const part = parts[Math.min(current, parts.length - 1)]!;
  const update = (edits: Edit[]) =>
    onChange(edits.reduce<unknown>((d, [path, value]) => setAt(d, path, value), doc));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {parts.map((p, i) => (
          <Button
            key={`${p.skill}-${p.index}`}
            type="button"
            size="sm"
            variant={p === part ? 'primary' : 'secondary'}
            aria-pressed={p === part}
            onClick={() => setCurrent(i)}
          >
            {p.skill === 'READING' ? 'Reading' : 'Listening'} {p.index + 1}
          </Button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <article className="flex flex-col gap-3 lg:max-h-[75vh] lg:overflow-y-auto lg:pr-2">
          {part.title && <h2 className="font-display text-title-sm">{part.title}</h2>}
          {part.skill === 'READING' ? (
            part.paragraphs.map((para, i) => (
              <p key={i} className="text-body">
                {para.label && <span className="mr-2 font-semibold">{para.label}</span>}
                {para.text}
              </p>
            ))
          ) : part.transcript ? (
            <p className="text-body whitespace-pre-wrap">{part.transcript}</p>
          ) : (
            <p className="text-body text-ink-muted">{t.noTranscript}</p>
          )}
        </article>
        <div className="flex flex-col gap-3 lg:max-h-[75vh] lg:overflow-y-auto lg:pr-2">
          {part.groups.map((g) => (
            <GroupBlock
              key={g.path.join('.')}
              g={g}
              part={part}
              editable={editable}
              update={update}
              hotfix={hotfix}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

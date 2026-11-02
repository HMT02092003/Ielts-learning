'use client';

// Editors for choice-style groups: multiple choice (single / multi), TFNG / YNNG, matching headings /
// information / features (incl. classification and sentence endings).
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { parseLines, parseMcBlock, parseOptions } from '@/lib/builder/paste';
import type { GroupOf, Paragraph } from '@/lib/builder/types';
import { useBuilder } from './context';
import {
  AddButton,
  AreaField,
  KeyPicker,
  OptionList,
  PasteButton,
  SectionTitle,
  SelectField,
  Toggle,
  move,
} from './fields';
import { QuestionCard, QuestionExtras } from './question-parts';

export type Edit<G> = (fn: (g: G) => void) => void;
export interface EditorProps<G> {
  group: G;
  edit: Edit<G>;
  /** Reading only: the passage paragraphs (labels for matching, evidence picking). */
  paragraphs?: Paragraph[];
}

const labelsOf = (paragraphs: Paragraph[] | undefined) =>
  (paragraphs ?? []).flatMap((p) => (p.label ? [p.label] : []));

/** Replace prompts from pasted lines, keeping existing answers by position. */
function linesToQuestions<T extends { number: number; prompt: string; answer: string }>(
  current: T[],
  lines: string[],
  blank: (n: number) => T,
): T[] {
  return lines.map((prompt, k) => ({ ...(current[k] ?? blank(k + 1)), prompt }));
}

const PASTE_LINES_HELP =
  'Mỗi dòng một câu. Số thứ tự đầu dòng (14., 14)) được tự bỏ. Đáp án đã nhập được giữ theo thứ tự.';

// ───── Multiple choice: one answer ─────
export function McSingleEditor({ group, edit, paragraphs }: EditorProps<GroupOf<'MULTIPLE_CHOICE_SINGLE'>>) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle
        actions={
          <PasteButton
            label="Dán câu hỏi"
            title="Dán câu hỏi trắc nghiệm"
            description="Mỗi câu bắt đầu bằng số thứ tự, các lựa chọn bắt đầu bằng A, B, C, D (mỗi lựa chọn một dòng hoặc cùng một dòng). Danh sách câu hiện tại sẽ được thay thế."
            placeholder={
              '1 What is the writer’s main point?\nA …\nB …\nC …\nD …\n2 According to the writer, …\nA …'
            }
            onApply={(text) => {
              const qs = parseMcBlock(text).filter((q) => q.options.length >= 2);
              if (!qs.length) return 'Không nhận ra câu hỏi nào có từ 2 lựa chọn trở lên.';
              edit((g) => {
                g.questions = qs.map((q, k) => ({
                  ...(g.questions[k] ?? { number: k + 1, answer: '' }),
                  prompt: q.prompt,
                  options: q.options,
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
              label="Câu hỏi"
              rows={2}
              value={q.prompt}
              onChange={(v) => edit((g) => (g.questions[qi]!.prompt = v))}
            />
            <OptionList
              label="Các lựa chọn"
              options={q.options}
              min={2}
              max={8}
              onChange={(options) => edit((g) => (g.questions[qi]!.options = options))}
            />
            <div className="flex flex-col gap-1.5">
              <Label>Đáp án đúng</Label>
              <KeyPicker
                label={`Đáp án câu ${q.number}`}
                value={q.answer}
                choices={q.options.map((o) => ({ key: o.key, label: o.key }))}
                onChange={(k) => edit((g) => (g.questions[qi]!.answer = k))}
              />
            </div>
          </QuestionCard>
        ))}
      </ol>
      <AddButton
        onClick={() =>
          edit((g) =>
            g.questions.push({
              number: 0,
              prompt: '',
              options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: '' })),
              answer: '',
            }),
          )
        }
      >
        Thêm câu
      </AddButton>
    </section>
  );
}

// ───── Multiple choice: choose N ─────
export function McMultiEditor({ group, edit, paragraphs }: EditorProps<GroupOf<'MULTIPLE_CHOICE_MULTI'>>) {
  const { readOnly } = useBuilder();
  const chosen = new Set(group.answer);
  return (
    <section className="flex flex-col gap-4">
      <SectionTitle>Câu dẫn & lựa chọn</SectionTitle>
      <AreaField
        label="Câu dẫn"
        rows={2}
        placeholder="Which TWO advantages of … does the writer mention?"
        value={group.stem}
        onChange={(v) => edit((g) => (g.stem = v))}
      />
      <SelectField
        label="Số đáp án phải chọn"
        hint="Mỗi đáp án đúng tính 1 câu, nên nhóm sẽ chiếm đúng ngần ấy số câu."
        value={String(group.chooseCount)}
        options={[2, 3, 4, 5].map((n) => ({ value: String(n), label: `Chọn ${n}` }))}
        onChange={(v) =>
          edit((g) => {
            const n = Number(v);
            g.chooseCount = n;
            g.questions = Array.from({ length: n }, (_, k) => g.questions[k] ?? { number: 0 });
            g.answer = g.answer.slice(0, n);
          })
        }
      />
      <OptionList
        label="Các lựa chọn"
        options={group.options}
        min={3}
        max={10}
        onChange={(options) =>
          edit((g) => {
            g.options = options;
            g.answer = g.answer.filter((a) => options.some((o) => o.key === a));
          })
        }
        extra={
          <PasteButton
            label="Dán lựa chọn"
            title="Dán các lựa chọn"
            description="Mỗi lựa chọn một dòng (A …, B …) hoặc cùng một dòng."
            placeholder={'A …\nB …\nC …\nD …\nE …'}
            onApply={(text) => {
              const options = parseOptions(text);
              if (options.length < 3) return 'Cần ít nhất 3 lựa chọn.';
              edit((g) => {
                g.options = options.slice(0, 10);
                g.answer = [];
              });
              return null;
            }}
          />
        }
      />
      <div className="flex flex-col gap-1.5">
        <Label>
          Đáp án đúng ({group.answer.length}/{group.chooseCount})
        </Label>
        <div role="group" aria-label="Đáp án đúng" className="flex flex-wrap gap-1.5">
          {group.options.map((o) => {
            const on = chosen.has(o.key);
            return (
              <button
                key={o.key}
                type="button"
                aria-pressed={on}
                disabled={readOnly || (!on && group.answer.length >= group.chooseCount)}
                onClick={() =>
                  edit((g) => {
                    g.answer = on ? g.answer.filter((a) => a !== o.key) : [...g.answer, o.key].sort();
                  })
                }
                className={
                  on
                    ? 'min-h-8 rounded-md border border-accent bg-accent-soft px-3 text-label font-semibold text-accent outline-none focus-visible:shadow-focus'
                    : 'min-h-8 rounded-md border border-border-strong bg-surface px-3 text-label text-ink-secondary outline-none hover:border-ink-muted focus-visible:shadow-focus disabled:opacity-40'
                }
              >
                {o.key}
              </button>
            );
          })}
        </div>
        <p className="text-caption text-ink-subtle">
          Thứ tự đáp án không quan trọng; học viên chọn đúng bao nhiêu được bấy nhiêu câu.
        </p>
      </div>
      <ol className="flex flex-col gap-2">
        {group.questions.map((q, qi) => (
          <QuestionCard key={qi} q={q} index={qi} length={group.questions.length} canReorder={false}>
            <p className="text-body text-ink-muted">Câu {q.number} — một trong các đáp án đúng.</p>
            <QuestionExtras
              q={q}
              paragraphs={paragraphs}
              onChange={(patch) => edit((g) => Object.assign(g.questions[qi]!, patch))}
            />
          </QuestionCard>
        ))}
      </ol>
    </section>
  );
}

// ───── TRUE/FALSE/NOT GIVEN and YES/NO/NOT GIVEN ─────
export function JudgementEditor({
  group,
  edit,
  paragraphs,
}: EditorProps<GroupOf<'TRUE_FALSE_NOT_GIVEN'> | GroupOf<'YES_NO_NOT_GIVEN'>>) {
  const keys =
    group.type === 'TRUE_FALSE_NOT_GIVEN'
      ? [
          { key: 'TRUE', label: 'TRUE' },
          { key: 'FALSE', label: 'FALSE' },
          { key: 'NOT_GIVEN', label: 'NOT GIVEN' },
        ]
      : [
          { key: 'YES', label: 'YES' },
          { key: 'NO', label: 'NO' },
          { key: 'NOT_GIVEN', label: 'NOT GIVEN' },
        ];
  const norm = (a: string) => a.trim().toUpperCase().replace(/\s+/g, '_');
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle
        actions={
          <PasteButton
            label="Dán các nhận định"
            title="Dán các nhận định"
            description={PASTE_LINES_HELP}
            placeholder={'1 The study was funded by the government.\n2 …'}
            onApply={(text) => {
              const lines = parseLines(text);
              if (!lines.length) return 'Chưa có nội dung.';
              edit((g) => {
                (g as { questions: { number: number; prompt: string; answer: string }[] }).questions =
                  linesToQuestions(
                    g.questions as { number: number; prompt: string; answer: string }[],
                    lines,
                    (n) => ({ number: n, prompt: '', answer: '' }),
                  );
              });
              return null;
            }}
          />
        }
      >
        Nhận định
      </SectionTitle>
      <p className="-mt-1 text-caption text-ink-subtle">
        {group.type === 'TRUE_FALSE_NOT_GIVEN'
          ? 'Nhận định về THÔNG TIN trong bài. Cẩn thận phân biệt FALSE (bài nói ngược lại) với NOT GIVEN (bài không nói tới).'
          : 'Nhận định về QUAN ĐIỂM/LẬP LUẬN của tác giả. NOT GIVEN khi không thể biết tác giả nghĩ gì về điều đó.'}
      </p>
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
              label="Nhận định"
              rows={2}
              value={q.prompt}
              onChange={(v) => edit((g) => (g.questions[qi]!.prompt = v))}
            />
            <KeyPicker
              label={`Đáp án câu ${q.number}`}
              value={norm(String(q.answer ?? ''))}
              choices={keys}
              onChange={(k) => edit((g) => ((g.questions[qi] as { answer: string }).answer = k))}
            />
          </QuestionCard>
        ))}
      </ol>
      <AddButton
        onClick={() =>
          edit((g) =>
            (g.questions as { number: number; prompt: string; answer: string }[]).push({
              number: 0,
              prompt: '',
              answer: '',
            }),
          )
        }
      >
        Thêm nhận định
      </AddButton>
    </section>
  );
}

// ───── Matching headings ─────
export function HeadingsEditor({ group, edit, paragraphs }: EditorProps<GroupOf<'MATCHING_HEADINGS'>>) {
  const { readOnly } = useBuilder();
  const labels = labelsOf(paragraphs);
  const used = new Set(
    [...group.questions.map((q) => q.paragraphLabel), group.example?.paragraphLabel].filter(Boolean),
  );
  const unused = labels.filter((l) => !used.has(l));
  const headingChoices = group.headings.map((h) => ({ key: h.key, label: h.key }));
  return (
    <section className="flex flex-col gap-4">
      <SectionTitle>Danh sách tiêu đề</SectionTitle>
      <OptionList
        label="List of Headings"
        keyStyle="roman"
        hint="Thường nhiều hơn số đoạn cần nối 2–3 tiêu đề (gây nhiễu)."
        options={group.headings}
        min={2}
        max={15}
        onChange={(headings) =>
          edit((g) => {
            g.headings = headings;
            const keys = new Set(headings.map((h) => h.key));
            g.questions.forEach((q) => !keys.has(q.answer) && (q.answer = ''));
          })
        }
        extra={
          <PasteButton
            label="Dán tiêu đề"
            title="Dán danh sách tiêu đề"
            description="Mỗi tiêu đề một dòng, có hoặc không có số La Mã (i, ii, iii…)."
            placeholder={'i The origins of …\nii A surprising discovery\niii …'}
            onApply={(text) => {
              const headings = parseOptions(text, 'roman');
              if (headings.length < 2) return 'Cần ít nhất 2 tiêu đề.';
              edit((g) => (g.headings = headings.slice(0, 15)));
              return null;
            }}
          />
        }
      />

      <div className="flex flex-col gap-2 rounded-xl bg-surface-muted p-3">
        <Toggle
          label="Có câu ví dụ (Example) đã làm sẵn"
          checked={Boolean(group.example)}
          onChange={(on) =>
            edit((g) => {
              g.example = on
                ? { paragraphLabel: unused[0] ?? labels[0] ?? 'A', headingKey: g.headings[0]?.key ?? 'i' }
                : null;
            })
          }
        />
        {group.example && (
          <div className="flex flex-wrap items-center gap-2 text-body">
            Đoạn
            <NativeSelect
              aria-label="Đoạn ví dụ"
              className="w-24"
              disabled={readOnly}
              value={group.example.paragraphLabel}
              onChange={(e) => edit((g) => g.example && (g.example.paragraphLabel = e.target.value))}
            >
              {labels.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </NativeSelect>
            → tiêu đề
            <NativeSelect
              aria-label="Tiêu đề ví dụ"
              className="w-24"
              disabled={readOnly}
              value={group.example.headingKey}
              onChange={(e) => edit((g) => g.example && (g.example.headingKey = e.target.value))}
            >
              {group.headings.map((h) => (
                <option key={h.key}>{h.key}</option>
              ))}
            </NativeSelect>
          </div>
        )}
      </div>

      <SectionTitle
        actions={
          !readOnly &&
          unused.length > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                edit((g) => {
                  for (const l of unused) g.questions.push({ number: 0, paragraphLabel: l, answer: '' });
                })
              }
            >
              Thêm câu cho đoạn {unused.join(', ')}
            </Button>
          )
        }
      >
        Câu hỏi (mỗi câu = một đoạn)
      </SectionTitle>
      <ol className="flex flex-col gap-2">
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
            <div className="flex flex-wrap items-center gap-2 text-body">
              <Label htmlFor={`h-${qi}`}>Đoạn</Label>
              {labels.length ? (
                <NativeSelect
                  id={`h-${qi}`}
                  className="w-24"
                  disabled={readOnly}
                  value={q.paragraphLabel}
                  onChange={(e) => edit((g) => (g.questions[qi]!.paragraphLabel = e.target.value))}
                >
                  {!labels.includes(q.paragraphLabel) && (
                    <option value={q.paragraphLabel}>{q.paragraphLabel || '—'}</option>
                  )}
                  {labels.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </NativeSelect>
              ) : (
                <Input
                  id={`h-${qi}`}
                  className="h-9 w-20"
                  value={q.paragraphLabel}
                  readOnly={readOnly}
                  onChange={(e) =>
                    edit((g) => (g.questions[qi]!.paragraphLabel = e.target.value.toUpperCase()))
                  }
                />
              )}
              <span className="text-ink-muted">→ tiêu đề đúng</span>
            </div>
            <KeyPicker
              label={`Đáp án câu ${q.number}`}
              value={q.answer}
              choices={headingChoices}
              onChange={(k) => edit((g) => (g.questions[qi]!.answer = k))}
            />
            {q.answer && (
              <p lang="en" className="text-caption text-ink-muted">
                {group.headings.find((h) => h.key === q.answer)?.text}
              </p>
            )}
          </QuestionCard>
        ))}
      </ol>
      <AddButton
        onClick={() =>
          edit((g) => g.questions.push({ number: 0, paragraphLabel: unused[0] ?? '', answer: '' }))
        }
      >
        Thêm câu
      </AddButton>
    </section>
  );
}

// ───── Matching information (which paragraph contains…) ─────
export function MatchingInfoEditor({
  group,
  edit,
  paragraphs,
}: EditorProps<GroupOf<'MATCHING_INFORMATION'>>) {
  const { readOnly } = useBuilder();
  const labels = labelsOf(paragraphs);
  return (
    <section className="flex flex-col gap-4">
      <SectionTitle
        actions={
          !readOnly &&
          labels.length >= 2 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => edit((g) => (g.paragraphLabels = [...labels]))}
            >
              Lấy nhãn từ bài đọc ({labels.join(', ')})
            </Button>
          )
        }
      >
        Các đoạn được chọn
      </SectionTitle>
      <Input
        aria-label="Nhãn đoạn, cách nhau bằng dấu phẩy"
        value={group.paragraphLabels.join(', ')}
        readOnly={readOnly}
        onChange={(e) =>
          edit(
            (g) =>
              (g.paragraphLabels = e.target.value
                .toUpperCase()
                .split(/[\s,]+/)
                .filter(Boolean)),
          )
        }
      />
      <Toggle
        label="Một đoạn có thể dùng nhiều lần (NB You may use any letter more than once)"
        checked={group.allowReuse ?? true}
        onChange={(v) => edit((g) => (g.allowReuse = v))}
      />
      <SectionTitle
        actions={
          <PasteButton
            label="Dán các câu"
            title="Dán các chi tiết cần tìm"
            description={PASTE_LINES_HELP}
            placeholder={'1 a reference to …\n2 an example of …'}
            onApply={(text) => {
              const lines = parseLines(text);
              if (!lines.length) return 'Chưa có nội dung.';
              edit(
                (g) =>
                  (g.questions = linesToQuestions(g.questions, lines, (n) => ({
                    number: n,
                    prompt: '',
                    answer: '',
                  }))),
              );
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
              label="Chi tiết"
              rows={1}
              value={q.prompt}
              onChange={(v) => edit((g) => (g.questions[qi]!.prompt = v))}
            />
            <KeyPicker
              label={`Đáp án câu ${q.number}`}
              value={q.answer}
              choices={group.paragraphLabels.map((l) => ({ key: l, label: l }))}
              onChange={(k) => edit((g) => (g.questions[qi]!.answer = k))}
            />
          </QuestionCard>
        ))}
      </ol>
      <AddButton onClick={() => edit((g) => g.questions.push({ number: 0, prompt: '', answer: '' }))}>
        Thêm câu
      </AddButton>
    </section>
  );
}

// ───── Matching features / classification / sentence endings ─────
const VARIANT_HELP: Record<string, { list: string; item: string; placeholder: string }> = {
  FEATURES: {
    list: 'List of people / options',
    item: 'Nhận định',
    placeholder: 'A Dr Smith\nB Prof. Lee\nC …',
  },
  CLASSIFICATION: {
    list: 'Categories',
    item: 'Mục cần phân loại',
    placeholder: 'A before 1900\nB between 1900 and 1950\nC after 1950',
  },
  SENTENCE_ENDINGS: {
    list: 'Endings',
    item: 'Vế đầu của câu',
    placeholder: 'A … because of rising costs.\nB … in the 19th century.\nC …',
  },
};

export function FeaturesEditor({ group, edit, paragraphs }: EditorProps<GroupOf<'MATCHING_FEATURES'>>) {
  const variant = group.variant ?? 'FEATURES';
  const help = VARIANT_HELP[variant]!;
  return (
    <section className="flex flex-col gap-4">
      <SectionTitle>Danh sách để nối</SectionTitle>
      <SelectField
        label="Kiểu"
        value={variant}
        options={[
          { value: 'FEATURES', label: 'Matching features (người, tổ chức, mốc thời gian…)' },
          { value: 'CLASSIFICATION', label: 'Classification (phân loại vào nhóm)' },
          { value: 'SENTENCE_ENDINGS', label: 'Matching sentence endings (hoàn thành câu)' },
        ]}
        onChange={(v) => edit((g) => (g.variant = v))}
      />
      <AreaField
        label="Tiêu đề danh sách (tùy chọn)"
        rows={1}
        placeholder={help.list}
        value={group.listTitle}
        onChange={(v) => edit((g) => (g.listTitle = v || undefined))}
      />
      <OptionList
        label="Các mục"
        options={group.features}
        min={2}
        max={12}
        onChange={(features) =>
          edit((g) => {
            g.features = features;
            const keys = new Set(features.map((f) => f.key));
            g.questions.forEach((q) => !keys.has(q.answer) && (q.answer = ''));
          })
        }
        extra={
          <PasteButton
            label="Dán danh sách"
            title="Dán danh sách để nối"
            description="Mỗi mục một dòng (A …, B …)."
            placeholder={help.placeholder}
            onApply={(text) => {
              const features = parseOptions(text);
              if (features.length < 2) return 'Cần ít nhất 2 mục.';
              edit((g) => (g.features = features.slice(0, 12)));
              return null;
            }}
          />
        }
      />
      <Toggle
        label="Một mục có thể dùng nhiều lần"
        checked={group.allowReuse ?? false}
        onChange={(v) => edit((g) => (g.allowReuse = v))}
      />
      <SectionTitle
        actions={
          <PasteButton
            label="Dán các câu"
            title={`Dán ${help.item.toLowerCase()}`}
            description={PASTE_LINES_HELP}
            placeholder={'1 …\n2 …'}
            onApply={(text) => {
              const lines = parseLines(text);
              if (!lines.length) return 'Chưa có nội dung.';
              edit(
                (g) =>
                  (g.questions = linesToQuestions(g.questions, lines, (n) => ({
                    number: n,
                    prompt: '',
                    answer: '',
                  }))),
              );
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
              label={help.item}
              rows={1}
              value={q.prompt}
              onChange={(v) => edit((g) => (g.questions[qi]!.prompt = v))}
            />
            <KeyPicker
              label={`Đáp án câu ${q.number}`}
              value={q.answer}
              choices={group.features.map((f) => ({ key: f.key, label: f.key }))}
              onChange={(k) => edit((g) => (g.questions[qi]!.answer = k))}
            />
            {q.answer && (
              <p lang="en" className="text-caption text-ink-muted">
                {group.features.find((f) => f.key === q.answer)?.text}
              </p>
            )}
          </QuestionCard>
        ))}
      </ol>
      <AddButton onClick={() => edit((g) => g.questions.push({ number: 0, prompt: '', answer: '' }))}>
        Thêm câu
      </AddButton>
    </section>
  );
}

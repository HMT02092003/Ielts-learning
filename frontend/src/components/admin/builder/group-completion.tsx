'use client';

// Editors for gap-fill groups: sentence completion, short answer, summary completion and
// note / form / table / flow-chart completion. Gaps are {{n}} markers; "Chèn ô trống" inserts one and the
// builder numbers it. In summary / note groups each gap IS a question.
import { Plus, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { blankify, parseLines, parseNoteLines, parseOptions, parseTable } from '@/lib/builder/paste';
import type { GroupOf } from '@/lib/builder/types';
import { useBuilder } from './context';
import { FilePicker } from './file-picker';
import type { EditorProps } from './group-choice';
import {
  AddButton,
  AreaField,
  BlankArea,
  IconButton,
  KeyPicker,
  OptionList,
  PasteButton,
  RowControls,
  SectionTitle,
  SelectField,
  TextField,
  Toggle,
  WordLimitField,
  move,
} from './fields';
import { QuestionCard, QuestionExtras, TextAnswer } from './question-parts';

/** One-line input with a small "insert gap" button (table cells, note lines, flow-chart steps). */
function GapInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const { readOnly } = useBuilder();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <Input
        ref={ref}
        lang="en"
        aria-label={label}
        className="h-9"
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
      />
      {!readOnly && (
        <IconButton
          label="Chèn ô trống"
          onClick={() => {
            const el = ref.current;
            const s = el?.selectionStart ?? value.length;
            const e = el?.selectionEnd ?? value.length;
            const before = value.slice(0, s);
            onChange(`${before}${before && !/\s$/.test(before) ? ' ' : ''}{{0}}${value.slice(e)}`);
          }}
        >
          <span className="font-mono text-caption font-semibold">[ ]</span>
        </IconButton>
      )}
    </div>
  );
}

const GAP_HINT = (
  <>
    Ô trống hiển thị dạng <code className="font-mono">{'{{14}}'}</code> = câu 14. Bấm “Chèn ô trống” tại vị
    trí con trỏ; số câu tự đánh lại.
  </>
);

// ───── Sentence completion & short answer ─────
export function SentenceEditor({
  group,
  edit,
  paragraphs,
}: EditorProps<GroupOf<'SENTENCE_COMPLETION'> | GroupOf<'SHORT_ANSWER'>>) {
  const sentence = group.type === 'SENTENCE_COMPLETION';
  return (
    <section className="flex flex-col gap-4">
      <WordLimitField value={group.wordLimit} onChange={(wl) => edit((g) => (g.wordLimit = wl))} />
      <SectionTitle
        actions={
          <PasteButton
            label={sentence ? 'Dán các câu' : 'Dán câu hỏi'}
            title={sentence ? 'Dán các câu cần hoàn thành' : 'Dán câu hỏi ngắn'}
            description={
              sentence
                ? 'Mỗi dòng một câu. Chỗ trống in trong sách (……, ____, (14) ……) được tự đổi thành ô trống; dòng không có chỗ trống sẽ được thêm ô trống ở cuối.'
                : 'Mỗi dòng một câu hỏi. Số thứ tự đầu dòng được tự bỏ.'
            }
            placeholder={
              sentence
                ? '1 The museum was opened in ……\n2 Visitors must book ______ in advance.'
                : '1 What did the researchers use to …?\n2 …'
            }
            onApply={(text) => {
              const lines = sentence
                ? text
                    .replace(/\r\n?/g, '\n')
                    .split('\n')
                    .map((l) => blankify(l.replace(/^\s*\d{1,2}[.)]?\s+/, '').trim()))
                    .filter(Boolean)
                    .map((l) => (l.includes('{{') ? l : `${l} {{0}}`))
                : parseLines(text);
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
        {sentence ? 'Các câu' : 'Câu hỏi'}
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
            {sentence ? (
              <BlankArea
                label="Câu (có ô trống)"
                single
                value={q.prompt}
                onChange={(v) => edit((g) => (g.questions[qi]!.prompt = v))}
              />
            ) : (
              <AreaField
                label="Câu hỏi"
                rows={1}
                value={q.prompt}
                onChange={(v) => edit((g) => (g.questions[qi]!.prompt = v))}
              />
            )}
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
          </QuestionCard>
        ))}
      </ol>
      {sentence && <p className="-mt-2 text-caption text-ink-subtle">{GAP_HINT}</p>}
      <AddButton
        onClick={() =>
          edit((g) =>
            g.questions.push({ number: 0, prompt: sentence ? '{{0}}' : '', answer: '', accepted: [] }),
          )
        }
      >
        Thêm câu
      </AddButton>
    </section>
  );
}

// ───── Answer mode (words from the text / word bank) shared by summary + notes ─────
type BlankGroup = GroupOf<'SUMMARY_COMPLETION'> | GroupOf<'NOTE_TABLE_FLOWCHART_COMPLETION'>;

function AnswerModeFields({ group, edit }: EditorProps<BlankGroup>) {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-surface-muted p-3">
      <SelectField
        label="Cách trả lời"
        value={group.answerMode}
        options={[
          { value: 'WORDS', label: 'Tự điền từ trong bài' },
          { value: 'WORD_BANK', label: 'Chọn từ hộp từ (A, B, C…)' },
        ]}
        onChange={(v) =>
          edit((g) => {
            g.answerMode = v;
            if (v === 'WORDS') {
              delete g.wordBank;
              g.wordLimit ??= { maxWords: 2, allowNumber: false };
            } else {
              delete g.wordLimit;
              g.wordBank ??= {
                options: ['A', 'B', 'C', 'D', 'E', 'F'].map((key) => ({ key, text: '' })),
                allowReuse: false,
              };
            }
            g.questions.forEach((q) => {
              q.answer = '';
              q.accepted = [];
            });
          })
        }
      />
      {group.answerMode === 'WORDS' ? (
        <WordLimitField value={group.wordLimit} onChange={(wl) => edit((g) => (g.wordLimit = wl))} />
      ) : (
        <>
          <OptionList
            label="Hộp từ"
            hint="Thường nhiều hơn số ô trống (có từ gây nhiễu)."
            options={group.wordBank?.options ?? []}
            min={2}
            max={15}
            onChange={(options) =>
              edit((g) => {
                g.wordBank = { options, allowReuse: g.wordBank?.allowReuse ?? false };
                const keys = new Set(options.map((o) => o.key));
                g.questions.forEach((q) => !keys.has(q.answer.toUpperCase()) && (q.answer = ''));
              })
            }
            extra={
              <PasteButton
                label="Dán hộp từ"
                title="Dán hộp từ"
                description="Mỗi từ một dòng (A …, B …) hoặc cùng một dòng."
                placeholder={'A cost\nB safety\nC speed\nD comfort'}
                onApply={(text) => {
                  const options = parseOptions(text);
                  if (options.length < 2) return 'Cần ít nhất 2 từ.';
                  edit(
                    (g) =>
                      (g.wordBank = {
                        options: options.slice(0, 15),
                        allowReuse: g.wordBank?.allowReuse ?? false,
                      }),
                  );
                  return null;
                }}
              />
            }
          />
          <Toggle
            label="Một từ có thể dùng nhiều lần"
            checked={group.wordBank?.allowReuse ?? false}
            onChange={(v) => edit((g) => g.wordBank && (g.wordBank.allowReuse = v))}
          />
        </>
      )}
    </div>
  );
}

/** Answers for each gap of a summary / notes group. */
function GapAnswers({ group, edit, paragraphs }: EditorProps<BlankGroup>) {
  if (!group.questions.length)
    return (
      <p className="text-body text-ink-muted">Chưa có ô trống nào — chèn ô trống vào nội dung phía trên.</p>
    );
  return (
    <ol className="flex flex-col gap-3">
      {group.questions.map((q, qi) => (
        <QuestionCard
          key={qi}
          q={q}
          index={qi}
          length={group.questions.length}
          canReorder={false}
          extras={
            <QuestionExtras
              q={q}
              paragraphs={paragraphs}
              onChange={(patch) => edit((g) => Object.assign(g.questions[qi]!, patch))}
            />
          }
        >
          {group.answerMode === 'WORD_BANK' ? (
            <div className="flex flex-col gap-1.5">
              <Label>Đáp án đúng</Label>
              <KeyPicker
                label={`Đáp án câu ${q.number}`}
                value={q.answer.toUpperCase()}
                choices={(group.wordBank?.options ?? []).map((o) => ({
                  key: o.key,
                  label: `${o.key} · ${o.text || '…'}`,
                }))}
                onChange={(k) => edit((g) => (g.questions[qi]!.answer = k))}
              />
            </div>
          ) : (
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
          )}
        </QuestionCard>
      ))}
    </ol>
  );
}

// ───── Summary completion ─────
export function SummaryEditor({ group, edit, paragraphs }: EditorProps<GroupOf<'SUMMARY_COMPLETION'>>) {
  return (
    <section className="flex flex-col gap-4">
      <AnswerModeFields group={group} edit={edit as EditorProps<BlankGroup>['edit']} />
      <SectionTitle
        actions={
          <PasteButton
            label="Dán đoạn tóm tắt"
            title="Dán đoạn tóm tắt"
            description="Chỗ trống in trong sách (……, ____, (14) ……) được tự đổi thành ô trống và đánh số."
            placeholder="The first settlers arrived in (14) …… and built houses from (15) …… ."
            onApply={(text) => {
              const t = blankify(text.replace(/\r\n?/g, '\n').trim());
              if (!t.includes('{{')) return 'Không thấy chỗ trống nào (……, ____).';
              edit((g) => (g.text = t));
              return null;
            }}
          />
        }
      >
        Đoạn tóm tắt
      </SectionTitle>
      <TextField
        label="Tiêu đề (tùy chọn)"
        lang="en"
        value={group.title}
        onChange={(v) => edit((g) => (g.title = v || undefined))}
      />
      <BlankArea
        label="Nội dung"
        rows={7}
        value={group.text}
        hint={GAP_HINT}
        onChange={(v) => edit((g) => (g.text = v))}
      />
      <SectionTitle>Đáp án từng ô</SectionTitle>
      <GapAnswers group={group} edit={edit as EditorProps<BlankGroup>['edit']} paragraphs={paragraphs} />
    </section>
  );
}

// ───── Note / form / table / flow-chart completion ─────
type Tpl = GroupOf<'NOTE_TABLE_FLOWCHART_COMPLETION'>['template'];

const LAYOUT_STARTER: Record<Tpl['layout'], Tpl> = {
  NOTES: {
    layout: 'NOTES',
    lines: [
      { style: 'HEADING', indent: 0, text: '' },
      { style: 'BULLET', indent: 0, text: '{{0}}' },
    ],
  },
  TABLE: {
    layout: 'TABLE',
    columns: ['', '', ''],
    rows: [{ cells: ['', '{{0}}', ''] }, { cells: ['', '', '{{0}}'] }],
  },
  FLOWCHART: { layout: 'FLOWCHART', steps: [{ text: '{{0}}' }, { text: '' }, { text: '{{0}}' }] },
};

export function NoteTableEditor({
  group,
  edit,
  paragraphs,
}: EditorProps<GroupOf<'NOTE_TABLE_FLOWCHART_COMPLETION'>>) {
  const { readOnly } = useBuilder();
  const tpl = group.template;
  const editTpl = <T extends Tpl>(fn: (t: T) => void) => edit((g) => fn(g.template as T));
  return (
    <section className="flex flex-col gap-4">
      <SelectField
        label="Dạng trình bày"
        hint="Form completion (Listening Part 1) dùng dạng Ghi chú với các dòng “Name: …”."
        value={tpl.layout}
        options={[
          { value: 'NOTES', label: 'Ghi chú / biểu mẫu (notes, form)' },
          { value: 'TABLE', label: 'Bảng (table)' },
          { value: 'FLOWCHART', label: 'Sơ đồ quy trình (flow-chart)' },
        ]}
        onChange={(v) => {
          if (v === tpl.layout) return;
          if (!window.confirm('Đổi dạng trình bày sẽ xóa nội dung mẫu hiện tại. Tiếp tục?')) return;
          edit((g) => (g.template = structuredClone(LAYOUT_STARTER[v])));
        }}
      />
      <AnswerModeFields group={group} edit={edit as EditorProps<BlankGroup>['edit']} />
      <TextField
        label="Tiêu đề (tùy chọn)"
        lang="en"
        value={group.title}
        onChange={(v) => edit((g) => (g.title = v || undefined))}
      />

      {tpl.layout === 'NOTES' && (
        <>
          <SectionTitle
            actions={
              <PasteButton
                label="Dán ghi chú"
                title="Dán ghi chú / biểu mẫu"
                description="Dòng bắt đầu bằng • hoặc - thành gạch đầu dòng; dòng ngắn không có chỗ trống thành tiêu đề. Thụt lề 2 dấu cách = 1 cấp. Chỗ trống (……, ____) tự đổi thành ô trống."
                placeholder={'Customer details\nName: Sarah ……\n• Address: …… Street\n  – Postcode: ……'}
                onApply={(text) => {
                  const lines = parseNoteLines(text).slice(0, 60);
                  if (!lines.length) return 'Chưa có nội dung.';
                  editTpl<Extract<Tpl, { layout: 'NOTES' }>>((t) => (t.lines = lines));
                  return null;
                }}
              />
            }
          >
            Các dòng ghi chú
          </SectionTitle>
          <ol className="flex flex-col gap-2">
            {tpl.lines.map((l, li) => (
              <li
                key={li}
                className="flex flex-wrap items-center gap-1.5"
                style={{ paddingLeft: `${(l.indent ?? 0) * 16}px` }}
              >
                <NativeSelect
                  aria-label={`Kiểu dòng ${li + 1}`}
                  className="w-32"
                  disabled={readOnly}
                  value={l.style}
                  onChange={(e) =>
                    editTpl<Extract<Tpl, { layout: 'NOTES' }>>(
                      (t) => (t.lines[li]!.style = e.target.value as typeof l.style),
                    )
                  }
                >
                  <option value="HEADING">Tiêu đề</option>
                  <option value="BULLET">• Gạch đầu dòng</option>
                  <option value="TEXT">Văn bản</option>
                </NativeSelect>
                <NativeSelect
                  aria-label={`Thụt lề dòng ${li + 1}`}
                  className="w-20"
                  disabled={readOnly}
                  value={String(l.indent ?? 0)}
                  onChange={(e) =>
                    editTpl<Extract<Tpl, { layout: 'NOTES' }>>(
                      (t) => (t.lines[li]!.indent = Number(e.target.value)),
                    )
                  }
                >
                  {[0, 1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      ↦{n}
                    </option>
                  ))}
                </NativeSelect>
                <GapInput
                  label={`Dòng ${li + 1}`}
                  value={l.text}
                  onChange={(v) => editTpl<Extract<Tpl, { layout: 'NOTES' }>>((t) => (t.lines[li]!.text = v))}
                />
                <RowControls
                  index={li}
                  length={tpl.lines.length}
                  minLength={1}
                  noun="dòng"
                  onMove={(a, b) => editTpl<Extract<Tpl, { layout: 'NOTES' }>>((t) => move(t.lines, a, b))}
                  onRemove={() => editTpl<Extract<Tpl, { layout: 'NOTES' }>>((t) => t.lines.splice(li, 1))}
                />
              </li>
            ))}
          </ol>
          {tpl.lines.length < 60 && (
            <AddButton
              onClick={() =>
                editTpl<Extract<Tpl, { layout: 'NOTES' }>>((t) =>
                  t.lines.push({ style: 'BULLET', indent: 0, text: '' }),
                )
              }
            >
              Thêm dòng
            </AddButton>
          )}
        </>
      )}

      {tpl.layout === 'TABLE' && (
        <>
          <SectionTitle
            actions={
              <PasteButton
                label="Dán bảng"
                title="Dán bảng"
                description="Copy từ Excel/Word (các ô cách nhau bằng Tab) hoặc dùng dấu |. Dòng đầu là tiêu đề cột. Tối đa 6 cột, 20 dòng."
                placeholder={'Event\tDate\tCost\nOpening talk\t……\t£5\nWorkshop\t12 May\t……'}
                onApply={(text) => {
                  const t = parseTable(text);
                  if (!t) return 'Cần ít nhất một dòng tiêu đề và một dòng dữ liệu.';
                  edit(
                    (g) =>
                      (g.template = {
                        layout: 'TABLE',
                        columns: t.columns,
                        rows: t.rows.map((cells) => ({ cells })),
                      }),
                  );
                  return null;
                }}
              />
            }
          >
            Bảng
          </SectionTitle>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full border-collapse text-body">
              <thead>
                <tr className="bg-surface-muted">
                  {tpl.columns.map((c, ci) => (
                    <th key={ci} className="min-w-40 border-b border-border p-1.5 align-top">
                      <div className="flex items-center gap-1">
                        <GapInput
                          label={`Tiêu đề cột ${ci + 1}`}
                          value={c}
                          onChange={(v) =>
                            editTpl<Extract<Tpl, { layout: 'TABLE' }>>((t) => (t.columns[ci] = v))
                          }
                        />
                        {!readOnly && tpl.columns.length > 1 && (
                          <IconButton
                            label={`Xóa cột ${ci + 1}`}
                            danger
                            onClick={() =>
                              editTpl<Extract<Tpl, { layout: 'TABLE' }>>((t) => {
                                t.columns.splice(ci, 1);
                                t.rows.forEach((r) => r.cells.splice(ci, 1));
                              })
                            }
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </IconButton>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="w-10 border-b border-border" />
                </tr>
              </thead>
              <tbody>
                {tpl.rows.map((r, ri) => (
                  <tr key={ri}>
                    {tpl.columns.map((_, ci) => (
                      <td key={ci} className="border-b border-border p-1.5 align-top">
                        <GapInput
                          label={`Ô dòng ${ri + 1} cột ${ci + 1}`}
                          value={r.cells[ci] ?? ''}
                          onChange={(v) =>
                            editTpl<Extract<Tpl, { layout: 'TABLE' }>>((t) => {
                              const row = t.rows[ri]!;
                              while (row.cells.length < t.columns.length) row.cells.push('');
                              row.cells[ci] = v;
                            })
                          }
                        />
                      </td>
                    ))}
                    <td className="border-b border-border p-1 align-top">
                      {!readOnly && tpl.rows.length > 1 && (
                        <IconButton
                          label={`Xóa dòng ${ri + 1}`}
                          danger
                          onClick={() =>
                            editTpl<Extract<Tpl, { layout: 'TABLE' }>>((t) => t.rows.splice(ri, 1))
                          }
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </IconButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              {tpl.rows.length < 20 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    editTpl<Extract<Tpl, { layout: 'TABLE' }>>((t) =>
                      t.rows.push({ cells: t.columns.map(() => '') }),
                    )
                  }
                >
                  <Plus className="size-4" aria-hidden /> Thêm dòng
                </Button>
              )}
              {tpl.columns.length < 6 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    editTpl<Extract<Tpl, { layout: 'TABLE' }>>((t) => {
                      t.columns.push('');
                      t.rows.forEach((r) => r.cells.push(''));
                    })
                  }
                >
                  <Plus className="size-4" aria-hidden /> Thêm cột
                </Button>
              )}
            </div>
          )}
          <p className="text-caption text-ink-subtle">
            Ô trống trong bảng: bấm nút [ ] trong ô. Chưa hỗ trợ gộp ô.
          </p>
        </>
      )}

      {tpl.layout === 'FLOWCHART' && (
        <>
          <SectionTitle
            actions={
              <PasteButton
                label="Dán các bước"
                title="Dán các bước của quy trình"
                description="Mỗi dòng một bước (2–15 bước). Chỗ trống (……, ____) tự đổi thành ô trống."
                placeholder={'Raw materials are collected\nThey are heated to ……\n……'}
                onApply={(text) => {
                  const steps = text
                    .replace(/\r\n?/g, '\n')
                    .split('\n')
                    .map((l) => blankify(l.replace(/^\s*[↓→\-•]\s*/, '').trim()))
                    .filter(Boolean)
                    .slice(0, 15);
                  if (steps.length < 2) return 'Cần ít nhất 2 bước.';
                  edit((g) => (g.template = { layout: 'FLOWCHART', steps: steps.map((s) => ({ text: s })) }));
                  return null;
                }}
              />
            }
          >
            Các bước (theo thứ tự, mũi tên ↓)
          </SectionTitle>
          <ol className="flex flex-col gap-2">
            {tpl.steps.map((s, si) => (
              <li key={si} className="flex items-center gap-1.5">
                <span className="w-6 shrink-0 text-right text-label-sm text-ink-subtle">{si + 1}.</span>
                <GapInput
                  label={`Bước ${si + 1}`}
                  value={s.text}
                  onChange={(v) =>
                    editTpl<Extract<Tpl, { layout: 'FLOWCHART' }>>((t) => (t.steps[si]!.text = v))
                  }
                />
                <RowControls
                  index={si}
                  length={tpl.steps.length}
                  minLength={2}
                  noun="bước"
                  onMove={(a, b) =>
                    editTpl<Extract<Tpl, { layout: 'FLOWCHART' }>>((t) => move(t.steps, a, b))
                  }
                  onRemove={() =>
                    editTpl<Extract<Tpl, { layout: 'FLOWCHART' }>>((t) => t.steps.splice(si, 1))
                  }
                />
              </li>
            ))}
          </ol>
          {tpl.steps.length < 15 && (
            <AddButton
              onClick={() =>
                editTpl<Extract<Tpl, { layout: 'FLOWCHART' }>>((t) => t.steps.push({ text: '' }))
              }
            >
              Thêm bước
            </AddButton>
          )}
        </>
      )}

      <FilePicker
        kind="image"
        label="Ảnh kèm theo (tùy chọn)"
        optional
        value={group.image}
        onChange={(ref) => edit((g) => (g.image = ref))}
      />
      <p className="-mt-2 text-caption text-ink-subtle">{GAP_HINT}</p>
      <SectionTitle>Đáp án từng ô</SectionTitle>
      <GapAnswers group={group} edit={edit as EditorProps<BlankGroup>['edit']} paragraphs={paragraphs} />
    </section>
  );
}

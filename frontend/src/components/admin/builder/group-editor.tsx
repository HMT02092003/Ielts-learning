'use client';

// One question group: type (with the IELTS explanation), standard instructions, pasted answer key,
// the issues of this group, and the type-specific editor.
import { ArrowDown, ArrowUp, Copy, Info, KeyRound, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { applyAnswerKey } from '@/lib/builder/answers';
import { parseAnswerKey } from '@/lib/builder/paste';
import { defaultInstructions, newGroup, QUESTION_TYPES, TYPE_INFO } from '@/lib/builder/templates';
import { selectionPath, type Group, type GroupOf, type QSkill } from '@/lib/builder/types';
import { humanPath, issuesUnder } from '@/lib/builder/validate';
import type { QuestionType } from '@/shared/enums';
import { useBuilder, useGroupEdit } from './context';
import { AreaField, PasteButton } from './fields';
import {
  FeaturesEditor,
  HeadingsEditor,
  JudgementEditor,
  MatchingInfoEditor,
  McMultiEditor,
  McSingleEditor,
  type Edit,
} from './group-choice';
import { NoteTableEditor, SentenceEditor, SummaryEditor } from './group-completion';
import { MapEditor } from './group-map';

function hasContent(g: Group): boolean {
  return g.questions.some((q) => {
    const x = q as { prompt?: string; answer?: string | string[] };
    return Boolean(
      x.prompt?.replace(/\{\{\d+\}\}/g, '').trim() || (typeof x.answer === 'string' && x.answer),
    );
  });
}

export function GroupEditor({ skill, i, g }: { skill: QSkill; i: number; g: number }) {
  const { doc, update, select, readOnly, issues } = useBuilder();
  const edit = useGroupEdit(skill, i, g);
  const sections = skill === 'reading' ? doc.reading?.passages : doc.listening?.parts;
  const section = sections?.[i];
  const group = section?.groups[g];
  if (!section || !group) return <p className="text-body text-ink-muted">Nhóm câu hỏi không còn tồn tại.</p>;

  const paragraphs = 'paragraphs' in section ? section.paragraphs : undefined;
  const labels = (paragraphs ?? []).flatMap((p) => (p.label ? [p.label] : []));
  const info = TYPE_INFO[group.type];
  const types = QUESTION_TYPES.filter((t) => TYPE_INFO[t].skills.includes(skill) || t === group.type);
  const groupIssues = issuesUnder(issues, selectionPath({ kind: 'group', skill, i, g }));
  const std = defaultInstructions(group, skill);
  const sectionName = skill === 'reading' ? `Passage ${i + 1}` : `Part ${i + 1}`;

  const editSection = (fn: (groups: Group[]) => void) =>
    update((d) => {
      const s = skill === 'reading' ? d.reading?.passages[i] : d.listening?.parts[i];
      if (s) fn(s.groups);
    });

  function changeType(type: QuestionType) {
    if (type === group!.type) return;
    if (
      hasContent(group!) &&
      !window.confirm('Đổi dạng câu hỏi sẽ xóa các câu và đáp án đã nhập trong nhóm này. Tiếp tục?')
    )
      return;
    editSection((groups) => {
      const fresh = newGroup(type, skill, labels);
      groups[g] = fresh;
    });
  }

  const props = { paragraphs };
  let body;
  switch (group.type) {
    case 'MULTIPLE_CHOICE_SINGLE':
      body = (
        <McSingleEditor group={group} edit={edit as Edit<GroupOf<'MULTIPLE_CHOICE_SINGLE'>>} {...props} />
      );
      break;
    case 'MULTIPLE_CHOICE_MULTI':
      body = <McMultiEditor group={group} edit={edit as Edit<GroupOf<'MULTIPLE_CHOICE_MULTI'>>} {...props} />;
      break;
    case 'TRUE_FALSE_NOT_GIVEN':
    case 'YES_NO_NOT_GIVEN':
      body = <JudgementEditor group={group} edit={edit as Edit<typeof group>} {...props} />;
      break;
    case 'MATCHING_HEADINGS':
      body = <HeadingsEditor group={group} edit={edit as Edit<GroupOf<'MATCHING_HEADINGS'>>} {...props} />;
      break;
    case 'MATCHING_INFORMATION':
      body = (
        <MatchingInfoEditor group={group} edit={edit as Edit<GroupOf<'MATCHING_INFORMATION'>>} {...props} />
      );
      break;
    case 'MATCHING_FEATURES':
      body = <FeaturesEditor group={group} edit={edit as Edit<GroupOf<'MATCHING_FEATURES'>>} {...props} />;
      break;
    case 'SENTENCE_COMPLETION':
    case 'SHORT_ANSWER':
      body = <SentenceEditor group={group} edit={edit as Edit<typeof group>} {...props} />;
      break;
    case 'SUMMARY_COMPLETION':
      body = <SummaryEditor group={group} edit={edit as Edit<GroupOf<'SUMMARY_COMPLETION'>>} {...props} />;
      break;
    case 'NOTE_TABLE_FLOWCHART_COMPLETION':
      body = (
        <NoteTableEditor
          group={group}
          edit={edit as Edit<GroupOf<'NOTE_TABLE_FLOWCHART_COMPLETION'>>}
          {...props}
        />
      );
      break;
    case 'MAP_DIAGRAM_LABELLING':
      body = <MapEditor group={group} edit={edit as Edit<GroupOf<'MAP_DIAGRAM_LABELLING'>>} {...props} />;
      break;
  }

  const count = section.groups.length;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-caption font-semibold tracking-wide text-ink-subtle uppercase">
            {skill === 'reading' ? 'Reading' : 'Listening'} · {sectionName} · Nhóm {g + 1}
          </span>
          <h2 className="font-display text-h3 font-light">
            Questions {group.questionFrom}
            {group.questionTo !== group.questionFrom ? `–${group.questionTo}` : ''}
          </h2>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={g === 0}
              aria-label="Đưa nhóm lên"
              onClick={() => {
                editSection((groups) => groups.splice(g - 1, 0, ...groups.splice(g, 1)));
                select({ kind: 'group', skill, i, g: g - 1 });
              }}
            >
              <ArrowUp className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={g === count - 1}
              aria-label="Đưa nhóm xuống"
              onClick={() => {
                editSection((groups) => groups.splice(g + 1, 0, ...groups.splice(g, 1)));
                select({ kind: 'group', skill, i, g: g + 1 });
              }}
            >
              <ArrowDown className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                editSection((groups) => groups.splice(g + 1, 0, structuredClone(group)));
                select({ kind: 'group', skill, i, g: g + 1 });
              }}
            >
              <Copy className="size-4" aria-hidden /> Nhân bản
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={count <= 1}
              title={count <= 1 ? `${sectionName} cần ít nhất một nhóm câu hỏi` : undefined}
              onClick={() => {
                if (!window.confirm(`Xóa nhóm câu ${group.questionFrom}–${group.questionTo}?`)) return;
                editSection((groups) => groups.splice(g, 1));
                select(skill === 'reading' ? { kind: 'passage', i } : { kind: 'lpart', i });
              }}
            >
              <Trash2 className="size-4" aria-hidden /> Xóa nhóm
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="group-type" className="text-label font-medium">
          Dạng câu hỏi
        </label>
        <NativeSelect
          id="group-type"
          value={group.type}
          disabled={readOnly}
          onChange={(e) => changeType(e.target.value as QuestionType)}
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {TYPE_INFO[t].label}
            </option>
          ))}
        </NativeSelect>
        <p className="flex items-start gap-2 rounded-lg bg-info-soft px-3 py-2 text-label text-ink-secondary">
          <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
          {info.hint}
        </p>
      </div>

      <AreaField
        label="Hướng dẫn (instructions)"
        rows={Math.min(6, Math.max(2, group.instructions.split('\n').length))}
        value={group.instructions}
        hint="Câu chữ chuẩn IELTS được điền sẵn và tự cập nhật theo cài đặt của nhóm, cho tới khi bạn tự sửa."
        onChange={(v) => edit((x) => (x.instructions = v))}
        actions={
          !readOnly &&
          group.instructions.trim() !== std.trim() && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => edit((x) => (x.instructions = std))}
            >
              <RotateCcw className="size-4" aria-hidden /> Dùng câu chữ chuẩn
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <PasteButton
          label="Dán đáp án"
          title={`Dán đáp án câu ${group.questionFrom}–${group.questionTo}`}
          description={
            <>
              Dạng “số + đáp án”, mỗi câu một dòng hoặc nhiều câu trên một dòng:{' '}
              <code className="font-mono">14 TRUE 15 NG</code>, <code className="font-mono">21 B</code>,{' '}
              <code className="font-mono">27 (the) museum / museums</code>. Dấu “/” hoặc “;” tách các đáp án
              được chấp nhận. Câu ngoài nhóm này được bỏ qua.
            </>
          }
          placeholder={`${group.questionFrom} …\n${group.questionFrom + 1} …`}
          onApply={(text) => {
            const key = parseAnswerKey(text);
            if (!key.size) return 'Không đọc được đáp án nào (cần dạng “14 TRUE”).';
            let res = { applied: 0, rejected: [] as string[] };
            edit((x) => {
              res = applyAnswerKey(x, key);
            });
            if (!res.applied)
              return `Không có đáp án nào thuộc câu ${group.questionFrom}–${group.questionTo}.`;
            toast.success(
              `Đã điền ${res.applied} đáp án${res.rejected.length ? `, bỏ qua: ${res.rejected.join(', ')}` : ''}`,
            );
            return null;
          }}
        />
        <span className="flex items-center gap-1 text-caption text-ink-subtle">
          <KeyRound className="size-3.5" aria-hidden /> Nhanh hơn khi chép đáp án từ answer key cuối sách.
        </span>
      </div>

      {groupIssues.length > 0 && (
        <ul
          className="flex flex-col gap-1 rounded-lg border border-danger-border bg-danger-soft px-3 py-2"
          aria-label="Lỗi của nhóm"
        >
          {groupIssues.slice(0, 8).map((iss, k) => (
            <li key={k} className="text-label text-danger">
              {humanPath(
                iss.path.replace(selectionPath({ kind: 'group', skill, i, g }), '').replace(/^\./, ''),
              ) || 'Nhóm'}
              : {iss.message}
            </li>
          ))}
          {groupIssues.length > 8 && (
            <li className="text-label text-danger">… và {groupIssues.length - 8} lỗi khác</li>
          )}
        </ul>
      )}

      {body}
    </div>
  );
}

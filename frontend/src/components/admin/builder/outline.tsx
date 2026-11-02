'use client';

// Left column: the test outline (skills → passages / parts → question groups). Click to edit; groups can be
// dragged to reorder inside their passage / part (numbers follow automatically).
import { arrayMove } from '@dnd-kit/helpers';
import { DragDropProvider } from '@dnd-kit/react';
import { isSortable, useSortable } from '@dnd-kit/react/sortable';
import { GripVertical, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { questionCount } from '@/lib/builder/numbering';
import { newGroup, newListeningPart, newPassage } from '@/lib/builder/templates';
import { sameSelection, selectionPath, type Group, type QSkill, type Selection } from '@/lib/builder/types';
import { issuesUnder } from '@/lib/builder/validate';
import type { QuestionType } from '@/shared/enums';
import { useBuilder } from './context';

export const SHORT_TYPE: Record<QuestionType, string> = {
  MULTIPLE_CHOICE_SINGLE: 'Multiple choice',
  MULTIPLE_CHOICE_MULTI: 'Choose N letters',
  TRUE_FALSE_NOT_GIVEN: 'True/False/NG',
  YES_NO_NOT_GIVEN: 'Yes/No/NG',
  MATCHING_HEADINGS: 'Matching headings',
  MATCHING_INFORMATION: 'Matching information',
  MATCHING_FEATURES: 'Matching features',
  SENTENCE_COMPLETION: 'Sentence completion',
  SUMMARY_COMPLETION: 'Summary completion',
  NOTE_TABLE_FLOWCHART_COMPLETION: 'Note/Table/Flow-chart',
  SHORT_ANSWER: 'Short answer',
  MAP_DIAGRAM_LABELLING: 'Map/Diagram labelling',
};

const range = (g: Group) =>
  g.questions.length === 0
    ? '—'
    : g.questionFrom === g.questionTo
      ? `${g.questionFrom}`
      : `${g.questionFrom}–${g.questionTo}`;

function Node({
  sel,
  children,
  depth = 0,
  handle,
  nodeRef,
}: {
  sel: Selection;
  children: ReactNode;
  depth?: number;
  handle?: ReactNode;
  nodeRef?: (el: Element | null) => void;
}) {
  const { sel: current, select, issues } = useBuilder();
  const active = sameSelection(sel, current);
  const count =
    sel.kind === 'meta'
      ? issues.filter((i) => !/^(reading|listening|writing|speaking)/.test(i.path)).length
      : issuesUnder(issues, selectionPath(sel)).length;
  return (
    <li ref={nodeRef} className="flex items-center">
      {handle}
      <button
        type="button"
        onClick={() => select(sel)}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'flex min-h-9 flex-1 items-center justify-between gap-2 rounded-md px-2 text-left text-label outline-none transition-colors focus-visible:shadow-focus',
          depth === 1 && 'pl-4',
          depth === 2 && 'pl-7 text-label-sm',
          active ? 'bg-accent-soft font-semibold text-accent' : 'text-ink-secondary hover:bg-surface-muted',
        )}
      >
        <span className="min-w-0 truncate">{children}</span>
        {count > 0 && (
          <span
            className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-danger-soft px-1.5 text-caption font-semibold text-danger"
            aria-label={`${count} lỗi`}
          >
            {count}
          </span>
        )}
      </button>
    </li>
  );
}

function SortableGroup({ skill, i, g, group }: { skill: QSkill; i: number; g: number; group: Group }) {
  const { readOnly } = useBuilder();
  const { ref, handleRef } = useSortable({
    id: `${skill}-${i}-${g}`,
    index: g,
    group: `${skill}-${i}`,
    disabled: readOnly,
  });
  return (
    <Node
      sel={{ kind: 'group', skill, i, g }}
      depth={2}
      nodeRef={ref}
      handle={
        !readOnly && (
          <span
            ref={handleRef}
            aria-hidden
            className="ml-3 flex size-6 cursor-grab items-center justify-center text-ink-subtle active:cursor-grabbing"
          >
            <GripVertical className="size-3.5" />
          </span>
        )
      }
    >
      <span className="font-mono">Q{range(group)}</span> · {SHORT_TYPE[group.type]}
    </Node>
  );
}

function AddRow({
  onClick,
  children,
  depth = 1,
}: {
  onClick: () => void;
  children: ReactNode;
  depth?: number;
}) {
  const { readOnly } = useBuilder();
  if (readOnly) return null;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex min-h-8 w-full items-center gap-1.5 rounded-md px-2 text-label-sm text-accent outline-none hover:bg-accent-soft focus-visible:shadow-focus',
          depth === 1 && 'pl-4',
          depth === 2 && 'pl-7',
        )}
      >
        <Plus className="size-3.5" aria-hidden /> {children}
      </button>
    </li>
  );
}

function SkillHeading({ children, meta }: { children: ReactNode; meta?: ReactNode }) {
  return (
    <li className="mt-3 flex items-baseline justify-between px-2 pb-1 text-caption font-semibold tracking-wide text-ink-subtle uppercase">
      <span>{children}</span>
      {meta && <span className="font-normal normal-case">{meta}</span>}
    </li>
  );
}

export function Outline() {
  const { doc, update, select } = useBuilder();
  const passages = doc.reading?.passages;
  const parts = doc.listening?.parts;

  function addGroup(skill: QSkill, i: number) {
    let g = 0;
    update((d) => {
      const sec = skill === 'reading' ? d.reading?.passages[i] : d.listening?.parts[i];
      if (!sec) return;
      const labels = 'paragraphs' in sec ? sec.paragraphs.flatMap((p) => (p.label ? [p.label] : [])) : [];
      sec.groups.push(
        newGroup(skill === 'reading' ? 'TRUE_FALSE_NOT_GIVEN' : 'SENTENCE_COMPLETION', skill, labels),
      );
      g = sec.groups.length - 1;
    });
    select({ kind: 'group', skill, i, g });
  }

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        const { source, canceled } = event.operation;
        if (canceled || !isSortable(source)) return;
        const { initialIndex, index, initialGroup, group } = source;
        if (initialGroup !== group || initialIndex === index) return;
        const [skill, i] = String(group).split('-') as [QSkill, string];
        update((d) => {
          const sec = skill === 'reading' ? d.reading?.passages[Number(i)] : d.listening?.parts[Number(i)];
          if (sec) sec.groups = arrayMove(sec.groups, initialIndex, index);
        });
      }}
    >
      <nav aria-label="Dàn ý đề">
        <ul className="flex flex-col gap-0.5">
          <Node sel={{ kind: 'meta' }}>Thông tin đề & kỹ năng</Node>

          {passages && (
            <>
              <SkillHeading meta={`${questionCount(passages)}/40 câu`}>Reading</SkillHeading>
              {passages.map((p, i) => (
                <li key={`p${i}`}>
                  <ul className="flex flex-col gap-0.5">
                    <Node sel={{ kind: 'passage', i }} depth={1}>
                      Passage {i + 1}
                      {p.title ? ` · ${p.title}` : ''}
                    </Node>
                    {p.groups.map((g, gi) => (
                      <SortableGroup key={`${i}-${gi}`} skill="reading" i={i} g={gi} group={g} />
                    ))}
                    <AddRow depth={2} onClick={() => addGroup('reading', i)}>
                      Thêm nhóm câu hỏi
                    </AddRow>
                  </ul>
                </li>
              ))}
              {passages.length < 3 && (
                <AddRow
                  onClick={() => {
                    update((d) => d.reading?.passages.push(newPassage()));
                    select({ kind: 'passage', i: passages.length });
                  }}
                >
                  Thêm passage
                </AddRow>
              )}
            </>
          )}

          {parts && (
            <>
              <SkillHeading meta={`${questionCount(parts)}/40 câu`}>Listening</SkillHeading>
              {parts.map((p, i) => (
                <li key={`l${i}`}>
                  <ul className="flex flex-col gap-0.5">
                    <Node sel={{ kind: 'lpart', i }} depth={1}>
                      {p.title || `Part ${i + 1}`}
                    </Node>
                    {p.groups.map((g, gi) => (
                      <SortableGroup key={`${i}-${gi}`} skill="listening" i={i} g={gi} group={g} />
                    ))}
                    <AddRow depth={2} onClick={() => addGroup('listening', i)}>
                      Thêm nhóm câu hỏi
                    </AddRow>
                  </ul>
                </li>
              ))}
              {parts.length < 4 && (
                <AddRow
                  onClick={() => {
                    update((d) => d.listening?.parts.push(newListeningPart(parts.length + 1)));
                    select({ kind: 'lpart', i: parts.length });
                  }}
                >
                  Thêm part
                </AddRow>
              )}
            </>
          )}

          {doc.writing && (
            <>
              <SkillHeading>Writing</SkillHeading>
              {doc.writing.tasks.map((t, i) => (
                <Node key={`w${i}`} sel={{ kind: 'writing', i }} depth={1}>
                  Task {t.task}
                  {t.kind === 'GENERAL_LETTER'
                    ? ' · Letter'
                    : t.kind === 'ACADEMIC_REPORT'
                      ? ' · Report'
                      : ' · Essay'}
                </Node>
              ))}
            </>
          )}

          {doc.speaking && (
            <>
              <SkillHeading>Speaking</SkillHeading>
              {doc.speaking.parts.map((p, i) => (
                <Node key={`s${i}`} sel={{ kind: 'speaking', i }} depth={1}>
                  Part {p.part}
                  {p.part === 2 ? ' · Cue card' : p.topic ? ` · ${p.topic}` : ''}
                </Node>
              ))}
            </>
          )}
        </ul>
      </nav>
    </DragDropProvider>
  );
}

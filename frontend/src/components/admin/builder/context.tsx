'use client';

// Builder state shared by the outline, the editors and the preview. Every edit goes through `update`, which
// clones the doc, applies the change and renumbers all questions (numbers are never typed by the author).
import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { renumberDoc } from '@/lib/builder/numbering';
import { defaultInstructions } from '@/lib/builder/templates';
import type { Doc, Group, QSkill, Selection } from '@/lib/builder/types';
import type { BuilderIssue } from '@/lib/builder/validate';

interface BuilderCtx {
  doc: Doc;
  update: (fn: (d: Doc) => void) => void;
  readOnly: boolean;
  sel: Selection;
  select: (s: Selection) => void;
  issues: BuilderIssue[];
}

const Ctx = createContext<BuilderCtx | null>(null);

export function BuilderProvider({
  doc,
  setDoc,
  readOnly,
  sel,
  select,
  issues,
  children,
}: {
  doc: Doc;
  setDoc: (d: Doc) => void;
  readOnly: boolean;
  sel: Selection;
  select: (s: Selection) => void;
  issues: BuilderIssue[];
  children: ReactNode;
}) {
  const update = useCallback(
    (fn: (d: Doc) => void) => {
      if (readOnly) return;
      const next = structuredClone(doc);
      fn(next);
      renumberDoc(next);
      setDoc(next);
    },
    [doc, readOnly, setDoc],
  );
  return <Ctx.Provider value={{ doc, update, readOnly, sel, select, issues }}>{children}</Ctx.Provider>;
}

export function useBuilder(): BuilderCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBuilder outside BuilderProvider');
  return ctx;
}

export function getGroup(d: Doc, skill: QSkill, i: number, g: number): Group | undefined {
  const sections = skill === 'reading' ? d.reading?.passages : d.listening?.parts;
  return sections?.[i]?.groups[g];
}

/** Edit one group. If its instructions were still the standard wording, they follow the new settings. */
export function useGroupEdit(skill: QSkill, i: number, g: number) {
  const { update } = useBuilder();
  return useCallback(
    <G extends Group>(fn: (group: G) => void) =>
      update((d) => {
        const group = getGroup(d, skill, i, g);
        if (!group) return;
        const before = group.instructions;
        const wasDefault = before.trim() === defaultInstructions(group, skill).trim();
        fn(group as G);
        if (wasDefault && group.instructions === before)
          group.instructions = defaultInstructions(group, skill);
      }),
    [update, skill, i, g],
  );
}

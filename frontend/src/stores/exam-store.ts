// Client state of one exam session (Zustand). Server data (content, saved state) comes from TanStack Query;
// this store holds what the student is changing right now, plus the autosave bookkeeping.
import { create } from 'zustand';
import type { AnswerValue } from '@/shared/question-types';

export type ReadingSize = 'sm' | 'md' | 'lg';

export interface ExamState {
  attemptId: string;
  answers: Record<string, AnswerValue | null>;
  flagged: Record<string, true>;
  current: number;
  /** Monotonic save counter (server ignores anything not newer than its lastClientSeq). */
  seq: number;
  /** Bumped on every change; autosave compares it with the last saved revision. */
  revision: number;
  savedRevision: number;
  lastSavedAt: number | null;
  saveError: string | null;
  timeByPart: Record<string, number>;
  readingSize: ReadingSize;
  timerHidden: boolean;
  activePartId: string | null;

  init(s: {
    attemptId: string;
    answers: Record<string, AnswerValue>;
    flagged: string[];
    current: number;
    seq: number;
    timeByPart: Record<string, number>;
    readingSize?: ReadingSize;
    timerHidden?: boolean;
  }): void;
  setAnswer(questionId: string, value: AnswerValue | null): void;
  setAnswers(values: Record<string, AnswerValue | null>): void;
  toggleFlag(questionId: string): void;
  goTo(n: number): void;
  addTime(partId: string, ms: number): void;
  nextSeq(): number;
  markSaved(revision: number, at: number): void;
  markSaveError(msg: string | null): void;
  setReadingSize(s: ReadingSize): void;
  toggleTimer(): void;
  setActivePart(id: string): void;
}

export const useExamStore = create<ExamState>()((set, get) => ({
  attemptId: '',
  answers: {},
  flagged: {},
  current: 1,
  seq: 0,
  revision: 0,
  savedRevision: 0,
  lastSavedAt: null,
  saveError: null,
  timeByPart: {},
  readingSize: 'md',
  timerHidden: false,
  activePartId: null,

  init: (s) =>
    set({
      attemptId: s.attemptId,
      answers: s.answers,
      flagged: Object.fromEntries(s.flagged.map((id) => [id, true as const])),
      current: s.current,
      seq: s.seq,
      revision: 0,
      savedRevision: 0,
      lastSavedAt: null,
      saveError: null,
      timeByPart: s.timeByPart,
      readingSize: s.readingSize ?? 'md',
      timerHidden: s.timerHidden ?? false,
    }),
  setAnswer: (questionId, value) =>
    set((st) => ({ answers: { ...st.answers, [questionId]: value }, revision: st.revision + 1 })),
  setAnswers: (values) => set((st) => ({ answers: { ...st.answers, ...values }, revision: st.revision + 1 })),
  toggleFlag: (questionId) =>
    set((st) => {
      const flagged = { ...st.flagged };
      if (flagged[questionId]) delete flagged[questionId];
      else flagged[questionId] = true;
      return { flagged, revision: st.revision + 1 };
    }),
  goTo: (n) => set((st) => (st.current === n ? st : { current: n, revision: st.revision + 1 })),
  addTime: (partId, ms) =>
    set((st) => ({ timeByPart: { ...st.timeByPart, [partId]: (st.timeByPart[partId] ?? 0) + ms } })),
  nextSeq: () => {
    const seq = get().seq + 1;
    set({ seq });
    return seq;
  },
  markSaved: (revision, at) =>
    set((st) => ({ savedRevision: Math.max(st.savedRevision, revision), lastSavedAt: at, saveError: null })),
  markSaveError: (msg) => set({ saveError: msg }),
  setReadingSize: (readingSize) => set((st) => ({ readingSize, revision: st.revision + 1 })),
  toggleTimer: () => set((st) => ({ timerHidden: !st.timerHidden, revision: st.revision + 1 })),
  setActivePart: (activePartId) => set({ activePartId }),
}));

/** Snapshot sent to POST /autosave (full answers map, flags, position, time per part, UI prefs). */
export function snapshot(st: ExamState) {
  return {
    answers: st.answers,
    flagged: Object.keys(st.flagged),
    currentQuestionNumber: st.current,
    timeByPart: Object.fromEntries(Object.entries(st.timeByPart).map(([k, v]) => [k, Math.round(v)])),
    uiState: { readingSize: st.readingSize, timerHidden: st.timerHidden },
  };
}

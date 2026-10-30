// WritingEvaluator interface (spec §6 P5). LibraryWritingEvaluator is the only implementation today; a future
// LlmWritingEvaluator returns the same WritingEvaluationResult shape, so neither the API nor the UI changes
// (docs/adding-ai-evaluator.md).
import type { WritingEvaluationResult } from '../../shared/writing';
import type { WritingTaskKind } from '../../shared/enums';

export interface WritingEvaluationInput {
  text: string;
  task: { kind: WritingTaskKind; minWords: number; prompt: string };
  language?: 'en-GB' | 'en-US';
}

export interface WritingEvaluationOutput {
  evaluatorVersion: string;
  result: WritingEvaluationResult;
  bands: {
    taskResponse: number | null;
    coherence: number | null;
    lexical: number | null;
    grammar: number | null;
    overall: number | null;
  };
}

export interface WritingEvaluator {
  readonly kind: 'LIBRARY' | 'LLM';
  evaluate(input: WritingEvaluationInput): Promise<WritingEvaluationOutput>;
}

/** Speaking: interface only (spec §8 — no AI grading yet). */
export interface SpeakingEvaluator {
  readonly kind: 'LLM';
  evaluate(input: { audioFileId: string; partNumber: number; questions: string[] }): Promise<{
    evaluatorVersion: string;
    bands: { fluency: number; lexical: number; grammar: number; pronunciation: number; overall: number };
    comment: string;
  }>;
}

// Answer scoring for the 12 question types (spec §6 P4). Pure functions: no DB.
import type { QuestionType } from '../../shared/enums';
import type { AnswerValue, CorrectAnswer } from '../../shared/question-types';
import { fitsWordLimit, normalizeForCompare } from './text';

export const SCORING_VERSION = 'scoring@1';

export interface ScorableQuestion {
  id: string;
  number: number;
  groupId: string;
  type: QuestionType;
  correctAnswer: CorrectAnswer;
  acceptedAnswers: string[];
  /** Max words for text answers (from the group's word limit). */
  wordLimit: number | null;
  allowNumber: boolean;
}

export interface QuestionResult {
  questionId: string;
  isCorrect: boolean;
  /** Shown on the result screen. */
  notes: { blank?: true; wordLimitExceeded?: true };
}

/** Keys compare case-insensitively ("not given" == "NOT_GIVEN", "b" == "B"). */
const normKey = (k: string) => k.trim().toUpperCase().replace(/\s+/g, '_');

function scoreText(q: ScorableQuestion, text: string): QuestionResult {
  const given = normalizeForCompare(text);
  if (!given) return { questionId: q.id, isCorrect: false, notes: { blank: true } };
  const accepted = new Set(
    [...q.acceptedAnswers, ...(q.correctAnswer.kind === 'TEXT' ? [q.correctAnswer.display] : [])].map(
      normalizeForCompare,
    ),
  );
  const over =
    q.wordLimit !== null && !fitsWordLimit(text, { maxWords: q.wordLimit, allowNumber: q.allowNumber });
  // IELTS: an answer over the word limit is wrong even if it contains the right words.
  return {
    questionId: q.id,
    isCorrect: !over && accepted.has(given),
    notes: over ? { wordLimitExceeded: true } : {},
  };
}

/** Score every question of one attempt. Answers are keyed by question id; missing = blank. */
export function scoreQuestions(
  questions: ScorableQuestion[],
  answers: ReadonlyMap<string, AnswerValue | null>,
): QuestionResult[] {
  const results = new Map<string, QuestionResult>();

  // MULTIPLE_CHOICE_MULTI is scored per group as a set: k right letters → the first k questions are correct,
  // whatever order the letters were picked in (each correct letter is worth one mark).
  const multiGroups = new Map<string, ScorableQuestion[]>();
  for (const q of questions) {
    if (q.type === 'MULTIPLE_CHOICE_MULTI')
      multiGroups.set(q.groupId, [...(multiGroups.get(q.groupId) ?? []), q]);
  }
  for (const group of multiGroups.values()) {
    group.sort((a, b) => a.number - b.number);
    const correct = new Set(
      group[0]?.correctAnswer.kind === 'KEYS' ? group[0].correctAnswer.keys.map(normKey) : [],
    );
    const picked = new Set(
      group.flatMap((q) => {
        const v = answers.get(q.id);
        return v?.kind === 'KEY' ? [normKey(v.key)] : [];
      }),
    );
    const hits = [...picked].filter((k) => correct.has(k)).length;
    group.forEach((q, i) => {
      const blank = answers.get(q.id) == null;
      results.set(q.id, {
        questionId: q.id,
        isCorrect: i < hits,
        notes: blank && i >= hits ? { blank: true } : {},
      });
    });
  }

  for (const q of questions) {
    if (results.has(q.id)) continue;
    const v = answers.get(q.id) ?? null;
    if (v === null) {
      results.set(q.id, { questionId: q.id, isCorrect: false, notes: { blank: true } });
      continue;
    }
    if (q.correctAnswer.kind === 'TEXT') {
      results.set(q.id, scoreText(q, v.kind === 'TEXT' ? v.text : v.key));
      continue;
    }
    if (q.correctAnswer.kind === 'KEY') {
      const given = v.kind === 'KEY' ? v.key : v.text;
      results.set(q.id, {
        questionId: q.id,
        isCorrect: normKey(given) !== '' && normKey(given) === normKey(q.correctAnswer.key),
        notes: normKey(given) === '' ? { blank: true } : {},
      });
      continue;
    }
    results.set(q.id, { questionId: q.id, isCorrect: false, notes: {} });
  }
  return questions.map(
    (q) => results.get(q.id) ?? { questionId: q.id, isCorrect: false, notes: { blank: true } },
  );
}

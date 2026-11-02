// Apply a pasted answer key ("14 TRUE 15 FALSE …") to one group, per question type.
import { normalizeJudgement, parseLetterSet, splitAlternatives } from './paste';
import type { Group } from './types';

export interface ApplyResult {
  applied: number;
  /** Question numbers in the key that could not be used (not in this group, or an invalid value). */
  rejected: string[];
}

export function applyAnswerKey(g: Group, key: Map<number, string>): ApplyResult {
  const result: ApplyResult = { applied: 0, rejected: [] };

  if (g.type === 'MULTIPLE_CHOICE_MULTI') {
    // Any line of the group's range carries the letter set ("21–22 B, D" or "21 B 22 D").
    const letters = new Set<string>();
    for (const q of g.questions) {
      const v = key.get(q.number);
      if (v) parseLetterSet(v).forEach((l) => letters.add(l));
    }
    if (letters.size) {
      g.answer = [...letters].slice(0, g.chooseCount);
      result.applied = g.answer.length;
    }
    return result;
  }

  for (const [n, raw] of key) {
    const q = g.questions.find((x) => x.number === n);
    if (!q) continue; // belongs to another group
    let value: string | null = raw.trim();
    switch (g.type) {
      case 'TRUE_FALSE_NOT_GIVEN':
        value = normalizeJudgement(raw, 'TFNG');
        break;
      case 'YES_NO_NOT_GIVEN':
        value = normalizeJudgement(raw, 'YNNG');
        break;
      case 'MATCHING_HEADINGS':
        value = raw.trim().toLowerCase();
        if (!g.headings.some((h) => h.key === value)) value = null;
        break;
      case 'MULTIPLE_CHOICE_SINGLE':
      case 'MATCHING_INFORMATION':
      case 'MATCHING_FEATURES':
        value = raw.trim().toUpperCase();
        if (!/^[A-Z]$/.test(value)) value = null;
        break;
      case 'MAP_DIAGRAM_LABELLING':
        if (g.answerMode === 'OPTIONS') {
          value = raw.trim().toUpperCase();
          if (!/^[A-Z]$/.test(value)) value = null;
        }
        break;
      default:
        break;
    }
    if (value === null) {
      result.rejected.push(`${n}: ${raw}`);
      continue;
    }
    const textual =
      g.type === 'SENTENCE_COMPLETION' ||
      g.type === 'SHORT_ANSWER' ||
      ((g.type === 'SUMMARY_COMPLETION' || g.type === 'NOTE_TABLE_FLOWCHART_COMPLETION') &&
        g.answerMode === 'WORDS') ||
      (g.type === 'MAP_DIAGRAM_LABELLING' && g.answerMode === 'WORDS');
    const target = q as { answer?: string; accepted?: string[] };
    if (textual) {
      const { answer, accepted } = splitAlternatives(value);
      target.answer = answer;
      target.accepted = accepted;
    } else {
      target.answer =
        g.type === 'SUMMARY_COMPLETION' || g.type === 'NOTE_TABLE_FLOWCHART_COMPLETION'
          ? value.toUpperCase()
          : value;
    }
    result.applied++;
  }
  return result;
}

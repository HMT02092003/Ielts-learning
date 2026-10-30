// LibraryWritingEvaluator: LanguageTool (grammar/spelling issues) + compromise (sentence split) + plain counting.
// The two bands it produces (Lexical Resource, Grammatical Range & Accuracy) are HEURISTICS built from the
// metrics below — not the IELTS band descriptors — and are always labelled "ƯỚC LƯỢNG, không thay thế giám khảo".
// Task Response and Coherence & Cohesion are never machine-banded (self checklist only).
import nlp from 'compromise';
import { checkText, LanguageToolUnavailable, type LtMatch } from '../languagetool/client';
import { ESTIMATE_DISCLAIMER, type WritingIssue, type WritingMetrics } from '../../shared/writing';
import { countWords } from '../../shared/primitives';
import type { WritingEvaluationInput, WritingEvaluationOutput, WritingEvaluator } from './evaluator';

export const LIBRARY_EVALUATOR_VERSION = 'library@1';

const LINKERS = [
  'however',
  'moreover',
  'furthermore',
  'in addition',
  'additionally',
  'therefore',
  'thus',
  'consequently',
  'as a result',
  'on the other hand',
  'in contrast',
  'by contrast',
  'nevertheless',
  'nonetheless',
  'for example',
  'for instance',
  'such as',
  'firstly',
  'secondly',
  'finally',
  'in conclusion',
  'to conclude',
  'overall',
  'although',
  'even though',
  'whereas',
  'while',
  'similarly',
  'likewise',
  'meanwhile',
  'in particular',
  'as well as',
];

const SUBORDINATORS = new Set([
  'because',
  'although',
  'though',
  'whereas',
  'while',
  'which',
  'who',
  'whom',
  'whose',
  'that',
  'when',
  'whenever',
  'if',
  'unless',
  'since',
  'until',
  'after',
  'before',
  'once',
]);

const STOP = new Set(
  'the a an and or but of to in on at for with by from as is are was were be been being it its this that these those there their they them he she his her we our you your i my me not no do does did have has had can could will would should may might must than then so such also very more most into about over under between which who what when where why how all any some each other'.split(
    ' ',
  ),
);

const tokensOf = (text: string) =>
  (text.toLowerCase().match(/[\p{L}]+(?:['’-][\p{L}]+)*/gu) ?? []).map((t) => t.replace(/’/g, "'"));

const roundHalf = (x: number) => Math.round(x * 2) / 2;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const pct = (x: number) => `${Math.round(x * 100)}%`;

function categoryOf(m: LtMatch): WritingIssue['category'] {
  const c = m.rule.category.id.toUpperCase();
  const t = (m.rule.issueType ?? '').toLowerCase();
  if (c === 'TYPOS' || t === 'misspelling') return 'SPELLING';
  if (c === 'PUNCTUATION' || c === 'TYPOGRAPHY' || t === 'typographical') return 'PUNCTUATION';
  if (c === 'GRAMMAR' || t === 'grammar') return 'GRAMMAR';
  if (c === 'STYLE' || c === 'REDUNDANCY' || t === 'style') return 'STYLE';
  return 'OTHER';
}

export function computeMetrics(text: string, issues: WritingIssue[]): WritingMetrics {
  const words = countWords(text);
  const tokens = tokensOf(text);
  const sentences = nlp(text).sentences().out('array') as string[];
  const nonEmpty = sentences.filter((s) => s.trim().length > 0);
  const paragraphs = text.split(/\n\s*\n|\n/).filter((p) => p.trim().length > 0).length;

  // TTR on the first 250 tokens so long and short essays are comparable.
  const window = tokens.slice(0, 250);
  const ttr = window.length ? new Set(window).size / window.length : 0;

  const content = tokens.filter((t) => t.length > 3 && !STOP.has(t));
  const freq = new Map<string, number>();
  for (const t of content) freq.set(t, (freq.get(t) ?? 0) + 1);
  const repeated = [...freq.values()].filter((n) => n >= 4).reduce((a, n) => a + n, 0);

  const lower = ` ${text.toLowerCase().replace(/\s+/g, ' ')} `;
  let linking = 0;
  const distinct = new Set<string>();
  for (const l of LINKERS) {
    const hits = lower.split(new RegExp(`[^\\p{L}]${l}[^\\p{L}]`, 'u')).length - 1;
    if (hits > 0) {
      linking += hits;
      distinct.add(l);
    }
  }

  const complex = nonEmpty.filter((s) => tokensOf(s).some((t) => SUBORDINATORS.has(t))).length;
  const errors = issues.filter((i) => i.category === 'GRAMMAR' || i.category === 'SPELLING').length;

  return {
    words,
    sentences: nonEmpty.length,
    paragraphs,
    avgSentenceLength: nonEmpty.length ? Math.round((words / nonEmpty.length) * 10) / 10 : 0,
    typeTokenRatio: Math.round(ttr * 1000) / 1000,
    repetitionRate: content.length ? Math.round((repeated / content.length) * 1000) / 1000 : 0,
    linkingWords: linking,
    distinctLinkingWords: distinct.size,
    complexSentenceRatio: nonEmpty.length ? Math.round((complex / nonEmpty.length) * 100) / 100 : 0,
    longWordRatio: tokens.length
      ? Math.round((tokens.filter((t) => t.length >= 7).length / tokens.length) * 1000) / 1000
      : 0,
    errorsPer100Words: words ? Math.round((errors / words) * 1000) / 10 : 0,
  };
}

/** Heuristic Lexical Resource estimate (4.0–8.0): variety, word length, spelling, repetition. */
export function lexicalEstimate(m: WritingMetrics, spellingPer100: number | null) {
  const evidence: string[] = [];
  let b = 5;
  if (m.typeTokenRatio >= 0.55) {
    b += 1;
    evidence.push(`Độ đa dạng từ (TTR) ${m.typeTokenRatio} ≥ 0.55: +1`);
  }
  if (m.typeTokenRatio >= 0.65) {
    b += 0.5;
    evidence.push('TTR ≥ 0.65: +0.5');
  }
  if (m.longWordRatio >= 0.2) {
    b += 0.5;
    evidence.push(`Tỉ lệ từ dài (≥ 7 chữ cái) ${pct(m.longWordRatio)} ≥ 20%: +0.5`);
  }
  if (m.longWordRatio >= 0.28) {
    b += 0.5;
    evidence.push('Tỉ lệ từ dài ≥ 28%: +0.5');
  }
  if (m.repetitionRate > 0.25) {
    b -= 0.5;
    evidence.push(`Lặp từ nhiều (${pct(m.repetitionRate)} từ nội dung lặp ≥ 4 lần): −0.5`);
  }
  if (spellingPer100 !== null && spellingPer100 > 3) {
    b -= 1;
    evidence.push(`Lỗi chính tả ${spellingPer100}/100 từ > 3: −1`);
  } else if (spellingPer100 !== null && spellingPer100 > 1.5) {
    b -= 0.5;
    evidence.push(`Lỗi chính tả ${spellingPer100}/100 từ > 1.5: −0.5`);
  }
  return { band: clamp(roundHalf(b), 4, 8), evidence };
}

/** Heuristic Grammatical Range & Accuracy estimate (4.0–8.0): error density + sentence complexity. */
export function grammarEstimate(m: WritingMetrics, grammarPer100: number) {
  const evidence: string[] = [];
  let b = 5;
  if (grammarPer100 <= 0.5) {
    b += 1.5;
    evidence.push(`Lỗi ngữ pháp ${grammarPer100}/100 từ ≤ 0.5: +1.5`);
  } else if (grammarPer100 <= 1.5) {
    b += 1;
    evidence.push(`Lỗi ngữ pháp ${grammarPer100}/100 từ ≤ 1.5: +1`);
  } else if (grammarPer100 > 5) {
    b -= 1;
    evidence.push(`Lỗi ngữ pháp ${grammarPer100}/100 từ > 5: −1`);
  } else evidence.push(`Lỗi ngữ pháp ${grammarPer100}/100 từ: ±0`);
  if (m.complexSentenceRatio >= 0.4) {
    b += 1;
    evidence.push(`Câu phức ${pct(m.complexSentenceRatio)} ≥ 40%: +1`);
  } else if (m.complexSentenceRatio >= 0.25) {
    b += 0.5;
    evidence.push(`Câu phức ${pct(m.complexSentenceRatio)} ≥ 25%: +0.5`);
  }
  if (m.avgSentenceLength > 0 && m.avgSentenceLength < 10) {
    b -= 0.5;
    evidence.push(`Câu trung bình ${m.avgSentenceLength} từ < 10: −0.5`);
  }
  return { band: clamp(roundHalf(b), 4, 8), evidence };
}

export function createLibraryWritingEvaluator(
  check: (text: string, language?: string) => Promise<LtMatch[]> = (t, l) => checkText(t, { language: l }),
): WritingEvaluator {
  return {
    kind: 'LIBRARY',
    async evaluate(input: WritingEvaluationInput): Promise<WritingEvaluationOutput> {
      const warnings: string[] = [];
      let degraded = false;
      let issues: WritingIssue[] = [];
      if (input.text.trim()) {
        try {
          issues = (await check(input.text, input.language)).map((m) => ({
            offset: m.offset,
            length: m.length,
            category: categoryOf(m),
            message: m.message,
            replacements: m.replacements.slice(0, 5).map((r) => r.value),
            ruleId: m.rule.id,
          }));
        } catch (e) {
          if (!(e instanceof LanguageToolUnavailable)) throw e;
          degraded = true;
          warnings.push(
            'Không kết nối được LanguageTool — chưa kiểm lỗi ngữ pháp/chính tả, không ước lượng band Grammar.',
          );
        }
      }
      const metrics = computeMetrics(input.text, issues);
      if (metrics.words < input.task.minWords)
        warnings.push(
          `Bài có ${metrics.words} từ, ít hơn yêu cầu ${input.task.minWords} từ (bị trừ điểm Task Response khi thi thật).`,
        );
      if (metrics.paragraphs < 2 && metrics.words > 80) warnings.push('Bài chưa chia đoạn.');

      const per100 = (cat: WritingIssue['category']) =>
        metrics.words
          ? Math.round((issues.filter((i) => i.category === cat).length / metrics.words) * 1000) / 10
          : 0;
      const tooShort = metrics.words < 50;
      const lexical = tooShort
        ? { band: null, evidence: ['Bài quá ngắn để ước lượng.'] }
        : lexicalEstimate(metrics, degraded ? null : per100('SPELLING'));
      const grammar =
        tooShort || degraded
          ? {
              band: null,
              evidence: [tooShort ? 'Bài quá ngắn để ước lượng.' : 'Thiếu dữ liệu LanguageTool.'],
            }
          : grammarEstimate(metrics, per100('GRAMMAR'));

      return {
        evaluatorVersion: LIBRARY_EVALUATOR_VERSION,
        bands: {
          taskResponse: null,
          coherence: null,
          lexical: lexical.band,
          grammar: grammar.band,
          overall: null,
        },
        result: {
          method: 'HEURISTIC',
          isEstimate: true,
          disclaimer: ESTIMATE_DISCLAIMER,
          degraded,
          warnings,
          issues,
          metrics,
          criteria: {
            taskResponse: { band: null, checklistOnly: true },
            coherence: { band: null, checklistOnly: true },
            lexical,
            grammar,
          },
        },
      };
    },
  };
}

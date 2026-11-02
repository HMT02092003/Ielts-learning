// IELTS knowledge used by the builder: what each question type is, the standard rubric wording, and starter
// content for new groups / passages / parts / tasks.
import type { QuestionType, TestType } from '@/shared/enums';
import type { WordLimit } from '@/shared/primitives';
import type { Doc, Group, ListeningPart, Passage, QSkill, SpeakingPart, WritingTask } from './types';

export interface TypeInfo {
  label: string;
  /** One-line "how it works in the real test", shown when choosing a type. */
  hint: string;
  skills: QSkill[];
}

export const TYPE_INFO: Record<QuestionType, TypeInfo> = {
  MULTIPLE_CHOICE_SINGLE: {
    label: 'Multiple choice (1 đáp án)',
    hint: 'Mỗi câu một câu hỏi + 3–4 lựa chọn A–D, chọn 1. Đáp án thường diễn đạt lại (paraphrase) ý trong bài.',
    skills: ['reading', 'listening'],
  },
  MULTIPLE_CHOICE_MULTI: {
    label: 'Multiple choice (chọn nhiều)',
    hint: '"Choose TWO letters A–E": một câu dẫn chung, chọn đủ N đáp án; mỗi đáp án đúng tính 1 câu.',
    skills: ['reading', 'listening'],
  },
  TRUE_FALSE_NOT_GIVEN: {
    label: 'True / False / Not Given',
    hint: 'Đối chiếu THÔNG TIN: TRUE = khớp, FALSE = trái ngược, NOT GIVEN = bài không đề cập.',
    skills: ['reading'],
  },
  YES_NO_NOT_GIVEN: {
    label: 'Yes / No / Not Given',
    hint: 'Đối chiếu QUAN ĐIỂM tác giả: YES = tác giả đồng ý, NO = phản đối, NOT GIVEN = không nêu quan điểm.',
    skills: ['reading'],
  },
  MATCHING_HEADINGS: {
    label: 'Matching headings',
    hint: 'Danh sách tiêu đề i, ii, iii… (nhiều hơn số đoạn); mỗi câu là một đoạn, chọn tiêu đề nêu ý chính.',
    skills: ['reading'],
  },
  MATCHING_INFORMATION: {
    label: 'Matching information',
    hint: '"Which paragraph contains…": mỗi câu là một chi tiết, chọn đoạn A–G chứa nó; một đoạn có thể dùng nhiều lần.',
    skills: ['reading'],
  },
  MATCHING_FEATURES: {
    label: 'Matching features / classification / sentence endings',
    hint: 'Nối câu với danh sách (người, mốc thời gian, nhóm phân loại) hoặc chọn vế sau để hoàn thành câu.',
    skills: ['reading', 'listening'],
  },
  SENTENCE_COMPLETION: {
    label: 'Sentence completion',
    hint: 'Mỗi câu là một câu có ô trống; điền từ lấy nguyên văn từ bài, đúng giới hạn số từ.',
    skills: ['reading', 'listening'],
  },
  SUMMARY_COMPLETION: {
    label: 'Summary completion',
    hint: 'Một đoạn tóm tắt có nhiều ô trống: điền từ trong bài, hoặc chọn từ hộp từ (word bank) A–H.',
    skills: ['reading', 'listening'],
  },
  NOTE_TABLE_FLOWCHART_COMPLETION: {
    label: 'Note / form / table / flow-chart completion',
    hint: 'Ghi chú, biểu mẫu (Listening Part 1), bảng hoặc sơ đồ quy trình có ô trống.',
    skills: ['reading', 'listening'],
  },
  SHORT_ANSWER: {
    label: 'Short-answer questions',
    hint: 'Câu hỏi Wh- ngắn; trả lời bằng từ trong bài, không quá giới hạn số từ.',
    skills: ['reading', 'listening'],
  },
  MAP_DIAGRAM_LABELLING: {
    label: 'Map / plan / diagram labelling',
    hint: 'Ảnh bản đồ, sơ đồ mặt bằng hoặc hình vẽ: chọn chữ cái in trên ảnh, hoặc tự điền nhãn.',
    skills: ['reading', 'listening'],
  },
};

export const QUESTION_TYPES = Object.keys(TYPE_INFO) as QuestionType[];

// ───── Word limits ─────
const NUM_WORDS = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'];

export function wordLimitText(wl: { maxWords: number; allowNumber?: boolean } | undefined): string {
  if (!wl) return '';
  if (wl.maxWords === 0) return 'A NUMBER';
  if (wl.maxWords === 1) return wl.allowNumber ? 'ONE WORD AND/OR A NUMBER' : 'ONE WORD ONLY';
  const base = `NO MORE THAN ${NUM_WORDS[wl.maxWords]} WORDS`;
  return wl.allowNumber ? `${base} AND/OR A NUMBER` : base;
}

export const WORD_LIMIT_PRESETS: WordLimit[] = [
  { maxWords: 1, allowNumber: false },
  { maxWords: 1, allowNumber: true },
  { maxWords: 2, allowNumber: false },
  { maxWords: 2, allowNumber: true },
  { maxWords: 3, allowNumber: false },
  { maxWords: 3, allowNumber: true },
  { maxWords: 0, allowNumber: true },
];

// ───── Standard instructions (no question numbers: the "Questions x–y" heading is rendered separately) ─────
function chooseWords(g: Group, skill: QSkill): string {
  const wl = 'wordLimit' in g ? g.wordLimit : undefined;
  const limit = wordLimitText(wl);
  if (!limit) return '';
  if (skill === 'listening') return `Write ${limit} for each answer.`;
  return `Choose ${limit} from the passage for each answer.`;
}

const LETTERS = (n: number) => String.fromCharCode(64 + Math.max(1, n));

export function defaultInstructions(g: Group, skill: QSkill): string {
  switch (g.type) {
    case 'MULTIPLE_CHOICE_SINGLE':
      return 'Choose the correct letter, A, B, C or D.';
    case 'MULTIPLE_CHOICE_MULTI': {
      const n = NUM_WORDS[g.chooseCount] ?? String(g.chooseCount);
      return `Choose ${n} letters, A–${LETTERS(g.options.length)}.`;
    }
    case 'TRUE_FALSE_NOT_GIVEN':
      return [
        'Do the following statements agree with the information given in the reading passage?',
        'Write',
        'TRUE        if the statement agrees with the information',
        'FALSE       if the statement contradicts the information',
        'NOT GIVEN   if there is no information on this',
      ].join('\n');
    case 'YES_NO_NOT_GIVEN':
      return [
        'Do the following statements agree with the claims of the writer in the reading passage?',
        'Write',
        'YES         if the statement agrees with the claims of the writer',
        'NO          if the statement contradicts the claims of the writer',
        'NOT GIVEN   if it is impossible to say what the writer thinks about this',
      ].join('\n');
    case 'MATCHING_HEADINGS':
      return 'The reading passage has several paragraphs.\nChoose the correct heading for each paragraph from the list of headings below.';
    case 'MATCHING_INFORMATION': {
      const labels = g.paragraphLabels;
      const range = labels.length ? `${labels[0]}–${labels[labels.length - 1]}` : 'A–G';
      return `The reading passage has paragraphs, ${range}.\nWhich paragraph contains the following information?\nNB You may use any letter more than once.`;
    }
    case 'MATCHING_FEATURES': {
      const range = `A–${LETTERS(g.features.length)}`;
      if (g.variant === 'SENTENCE_ENDINGS')
        return `Complete each sentence with the correct ending, ${range}, below.`;
      if (g.variant === 'CLASSIFICATION')
        return `Classify the following as relating to one of the categories below.\nChoose the correct letter, ${range}.`;
      return `Look at the following statements and the list below.\nMatch each statement with the correct option, ${range}.${g.allowReuse ? '\nNB You may use any letter more than once.' : ''}`;
    }
    case 'SENTENCE_COMPLETION':
      return `Complete the sentences below.\n${chooseWords(g, skill)}`;
    case 'SUMMARY_COMPLETION':
      return g.answerMode === 'WORD_BANK'
        ? `Complete the summary using the list of words, A–${LETTERS(g.wordBank?.options.length ?? 0)}, below.`
        : `Complete the summary below.\n${chooseWords(g, skill)}`;
    case 'NOTE_TABLE_FLOWCHART_COMPLETION': {
      const what =
        g.template.layout === 'TABLE' ? 'table' : g.template.layout === 'FLOWCHART' ? 'flow-chart' : 'notes';
      return g.answerMode === 'WORD_BANK'
        ? `Complete the ${what} using the list of words, A–${LETTERS(g.wordBank?.options.length ?? 0)}, below.`
        : `Complete the ${what} below.\n${chooseWords(g, skill)}`;
    }
    case 'SHORT_ANSWER':
      return `Answer the questions below.\n${chooseWords(g, skill)}`;
    case 'MAP_DIAGRAM_LABELLING': {
      const what = g.variant === 'DIAGRAM' ? 'diagram' : g.variant === 'PLAN' ? 'plan' : 'map';
      return g.answerMode === 'OPTIONS'
        ? `Label the ${what} below.\nChoose the correct letter, A–${LETTERS(g.options?.length ?? 0)}.`
        : `Label the ${what} below.\n${chooseWords(g, skill)}`;
    }
  }
}

// ───── Factories ─────
const opts = (keys: string[]) => keys.map((key) => ({ key, text: '' }));
const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv'];
export const romanKey = (i: number) => ROMAN[i] ?? String(i + 1);
export const letterKey = (i: number) => String.fromCharCode(65 + i);

const tq = (n: number) => ({ number: n, answer: '', accepted: [] as string[] });

/** A new group of `type` with starter content; numbers are fixed by renumberDoc afterwards. */
export function newGroup(type: QuestionType, skill: QSkill, paragraphLabels: string[] = []): Group {
  const base = { instructions: '', questionFrom: 1, questionTo: 1 };
  const wordLimit = { maxWords: 2, allowNumber: skill === 'listening' };
  let g: Group;
  switch (type) {
    case 'MULTIPLE_CHOICE_SINGLE':
      g = {
        ...base,
        type,
        questions: [1, 2, 3].map((n) => ({
          number: n,
          prompt: '',
          options: opts(['A', 'B', 'C', 'D']),
          answer: '',
        })),
      };
      break;
    case 'MULTIPLE_CHOICE_MULTI':
      g = {
        ...base,
        type,
        stem: '',
        options: opts(['A', 'B', 'C', 'D', 'E']),
        chooseCount: 2,
        answer: [],
        questions: [{ number: 1 }, { number: 2 }],
      };
      break;
    case 'TRUE_FALSE_NOT_GIVEN':
    case 'YES_NO_NOT_GIVEN':
      g = {
        ...base,
        type,
        questions: [1, 2, 3].map((n) => ({ number: n, prompt: '', answer: '' })),
      } as Group;
      break;
    case 'MATCHING_HEADINGS': {
      const labels = paragraphLabels.length ? paragraphLabels : ['A', 'B', 'C'];
      g = {
        ...base,
        type,
        headings: Array.from({ length: labels.length + 2 }, (_, i) => ({ key: romanKey(i), text: '' })),
        example: null,
        questions: labels.map((l, i) => ({ number: i + 1, paragraphLabel: l, answer: '' })),
      };
      break;
    }
    case 'MATCHING_INFORMATION':
      g = {
        ...base,
        type,
        paragraphLabels: paragraphLabels.length >= 2 ? paragraphLabels : ['A', 'B', 'C', 'D'],
        allowReuse: true,
        questions: [1, 2, 3].map((n) => ({ number: n, prompt: '', answer: '' })),
      };
      break;
    case 'MATCHING_FEATURES':
      g = {
        ...base,
        type,
        variant: 'FEATURES',
        features: opts(['A', 'B', 'C']),
        allowReuse: false,
        questions: [1, 2, 3].map((n) => ({ number: n, prompt: '', answer: '' })),
      };
      break;
    case 'SENTENCE_COMPLETION':
      g = {
        ...base,
        type,
        wordLimit,
        questions: [1, 2, 3].map((n) => ({ ...tq(n), prompt: `{{${n}}}` })),
      };
      break;
    case 'SUMMARY_COMPLETION':
      g = {
        ...base,
        type,
        text: '… {{1}} … {{2}} …',
        answerMode: 'WORDS',
        wordLimit,
        questions: [tq(1), tq(2)],
      };
      break;
    case 'NOTE_TABLE_FLOWCHART_COMPLETION':
      g = {
        ...base,
        type,
        template: {
          layout: 'NOTES',
          lines: [
            { style: 'HEADING', indent: 0, text: '' },
            { style: 'BULLET', indent: 0, text: '… {{1}}' },
            { style: 'BULLET', indent: 0, text: '… {{2}}' },
          ],
        },
        answerMode: 'WORDS',
        wordLimit,
        questions: [tq(1), tq(2)],
      };
      break;
    case 'SHORT_ANSWER':
      g = { ...base, type, wordLimit, questions: [1, 2, 3].map((n) => ({ ...tq(n), prompt: '' })) };
      break;
    case 'MAP_DIAGRAM_LABELLING':
      g = {
        ...base,
        type,
        variant: skill === 'listening' ? 'PLAN' : 'DIAGRAM',
        answerMode: skill === 'listening' ? 'OPTIONS' : 'WORDS',
        ...(skill === 'listening'
          ? { options: ['A', 'B', 'C', 'D', 'E'].map((key) => ({ key, text: key })) }
          : { wordLimit }),
        image: undefined as never, // set by the image picker; validation flags it until then
        questions: [1, 2, 3].map((n) => ({ ...tq(n), prompt: '' })),
      } as Group;
      break;
  }
  g.instructions = defaultInstructions(g, skill);
  return g;
}

export function newPassage(): Passage {
  return {
    title: '',
    suggestedMinutes: 20,
    paragraphs: [{ label: 'A', kind: 'BODY', text: '' }],
    groups: [newGroup('TRUE_FALSE_NOT_GIVEN', 'reading', ['A'])],
  };
}

export function newListeningPart(n: number): ListeningPart {
  return {
    title: `Part ${n}`,
    audio: { file: undefined as never, durationMs: 0, transcript: '' },
    groups: [newGroup(n === 1 ? 'NOTE_TABLE_FLOWCHART_COMPLETION' : 'MULTIPLE_CHOICE_SINGLE', 'listening')],
  };
}

export function newWritingTask(task: 1 | 2, type: TestType): WritingTask {
  if (task === 2) return { task: 2, kind: 'ESSAY', prompt: '', minWords: 250, suggestedMinutes: 40 };
  return type === 'GENERAL'
    ? { task: 1, kind: 'GENERAL_LETTER', prompt: '', minWords: 150, suggestedMinutes: 20 }
    : { task: 1, kind: 'ACADEMIC_REPORT', prompt: '', visual: 'BAR', minWords: 150, suggestedMinutes: 20 };
}

export function newSpeakingPart(part: 1 | 2 | 3): SpeakingPart {
  if (part === 2) {
    return {
      part: 2,
      cueCard: { topic: 'Describe …', bullets: ['what …', 'when …', 'who …', 'and explain why …'] },
      prepSeconds: 60,
      speakSeconds: 120,
      followUps: [],
    };
  }
  return { part, topic: '', questions: [''] };
}

export function emptyDoc(): Doc {
  return { schemaVersion: 1, seriesKey: '', source: 'CUSTOM', type: 'ACADEMIC', title: '' };
}

/** Writing Task 1 prompt templates (AC report / GT letter) and Task 2 essay kinds — a starting point only. */
export const WRITING_PROMPT_STARTERS: Record<string, string> = {
  ACADEMIC_REPORT:
    'The chart below shows …\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.',
  GENERAL_LETTER:
    'You recently …\n\nWrite a letter to … In your letter\n• …\n• …\n• …\n\nBegin your letter as follows:\nDear …,',
  OPINION:
    '… \n\nTo what extent do you agree or disagree?\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.',
  DISCUSSION:
    'Some people believe that … Others, however, think that …\n\nDiscuss both these views and give your own opinion.\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.',
  ADV_DISADV:
    '…\n\nDo the advantages of this outweigh the disadvantages?\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.',
  PROBLEM_SOLUTION:
    '…\n\nWhat problems does this cause? What measures could be taken to solve them?\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.',
  TWO_PART:
    '…\n\nWhy is this the case? Is this a positive or negative development?\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.',
};

export const VISUAL_LABEL: Record<string, string> = {
  LINE: 'Biểu đồ đường (line graph)',
  BAR: 'Biểu đồ cột (bar chart)',
  PIE: 'Biểu đồ tròn (pie chart)',
  TABLE: 'Bảng số liệu (table)',
  MAP: 'Bản đồ (map)',
  PROCESS: 'Quy trình (process diagram)',
  MIXED: 'Kết hợp nhiều biểu đồ',
};

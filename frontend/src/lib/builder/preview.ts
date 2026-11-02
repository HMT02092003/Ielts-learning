// Builder doc → the student-facing content shape, so the preview reuses the real exam components.
// Mirrors backend import.service configOf/contentOf (answers never reach the preview).
import type { ContentGroup } from '@/shared/attempt';
import type { Group } from './types';

export function toContentGroup(g: Group, idPrefix: string): ContentGroup {
  const { instructions, questionFrom, questionTo, questions, ...rest } = g as Group & Record<string, unknown>;
  const config: Record<string, unknown> = { ...rest };
  delete config.answer;
  delete config.image;
  const image = (g as { image?: { fileId?: string } }).image;
  return {
    id: `${idPrefix}`,
    type: g.type,
    instructions,
    questionFrom,
    questionTo,
    config,
    imageId: image && 'fileId' in image && image.fileId ? image.fileId : null,
    questions: questions.map((q) => {
      const content: Record<string, unknown> = {};
      if (g.type === 'MULTIPLE_CHOICE_SINGLE' && 'options' in q) content.options = q.options;
      if (g.type === 'MATCHING_HEADINGS' && 'paragraphLabel' in q) content.paragraphLabel = q.paragraphLabel;
      if (g.type === 'MAP_DIAGRAM_LABELLING' && 'pin' in q && q.pin) content.pin = q.pin;
      return {
        id: `${idPrefix}-q${q.number}`,
        number: q.number,
        prompt: 'prompt' in q && typeof q.prompt === 'string' ? q.prompt : null,
        content,
      };
    }),
  };
}

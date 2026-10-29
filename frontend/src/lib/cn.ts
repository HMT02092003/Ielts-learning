import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Teach tailwind-merge our custom type scale so `text-body` and `text-ink` are not treated as conflicts.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'display-2xl',
            'display-xl',
            'display-hero',
            'h1',
            'display-lg',
            'h2',
            'h3',
            'body-lg',
            'title-sm',
            'body',
            'label',
            'label-sm',
            'caption',
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

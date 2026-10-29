import type { ReactNode } from 'react';

/**
 * Exam shell: full viewport, always light (`.exam-mode` re-declares the light tokens even under html.dark)
 * and no motion at all (globals.css). Exam content containers set lang="en".
 */
export default function ExamLayout({ children }: { children: ReactNode }) {
  return <div className="exam-mode flex h-dvh flex-col bg-background text-ink">{children}</div>;
}

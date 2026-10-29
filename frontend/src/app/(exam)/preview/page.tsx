'use client';

// Phase 1: static Exam shell preview with placeholder data (no attempt, nothing saved). ?t=<seconds> sets the
// starting time to check the 5-minute / 1-minute timer states.
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { ExamTimer } from '@/components/exam/exam-timer';
import { ExamTopBar, InstructionStrip, type ReadingSize } from '@/components/exam/exam-top-bar';
import { QuestionNavBar, type NavPart } from '@/components/exam/question-nav';
import { useSession } from '@/hooks/use-session';
import { vi } from '@/i18n/vi';

const PARAGRAPHS = [
  [
    'A',
    'When the city of Northbridge relaxed its building rules in 2009, a handful of office owners began placing beehives on their flat roofs.',
  ],
  [
    'B',
    'Supporters argue that city bees are healthier than their rural relatives, because parks, gardens and street trees flower at different times.',
  ],
  [
    'C',
    'The honey itself has become a small local industry. Each rooftop produces a slightly different flavour depending on the nearest trees.',
  ],
] as const;

const PARTS: NavPart[] = [
  { part: 1, numbers: Array.from({ length: 13 }, (_, i) => i + 1) },
  { part: 2, numbers: Array.from({ length: 13 }, (_, i) => i + 14) },
  { part: 3, numbers: Array.from({ length: 14 }, (_, i) => i + 27) },
];

function Preview() {
  const params = useSearchParams();
  const { data: user } = useSession();
  const start = Number(params.get('t') ?? 38 * 60);
  const [secondsLeft, setSecondsLeft] = useState(Number.isFinite(start) ? start : 38 * 60);
  const [hidden, setHidden] = useState(false);
  const [readingSize, setReadingSize] = useState<ReadingSize>('md');
  const [current, setCurrent] = useState(4);
  const answered = useMemo(() => new Set([1, 2, 3, 15]), []);
  const flagged = useMemo(() => new Set([3, 4]), []);

  useEffect(() => {
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex h-full flex-col" data-reading-size={readingSize}>
      <ExamTopBar
        source="CUSTOM"
        title="Đề mẫu Reading (dummy)"
        candidate={user?.displayName ?? ''}
        timer={<ExamTimer secondsLeft={secondsLeft} hidden={hidden} onToggle={() => setHidden((h) => !h)} />}
        readingSize={readingSize}
        onReadingSize={setReadingSize}
        onSubmit={() => {}}
      />
      <InstructionStrip>Part 1 — Read the text and answer questions 1–13.</InstructionStrip>
      <p className="shrink-0 bg-warning-soft px-5 py-1.5 text-caption text-warning-ink">
        {vi.exam.previewNote}
      </p>
      <div className="grid min-h-0 flex-1 grid-cols-2 max-md:grid-cols-1">
        <section
          lang="en"
          aria-label={vi.exam.passage}
          className="overflow-y-auto border-r border-border bg-surface p-10 max-lg:p-5"
        >
          <h2 className="mb-6 font-reading text-[1.75rem] leading-tight font-semibold">
            Rooftop Beekeeping in Northbridge
          </h2>
          <div className="flex max-w-[640px] flex-col gap-5">
            {PARAGRAPHS.map(([label, text]) => (
              <div key={label} className="grid grid-cols-[28px_1fr] gap-2">
                <span className="pt-1 text-[0.9375rem] font-semibold text-ink">{label}</span>
                <p className="text-reading">{text}</p>
              </div>
            ))}
          </div>
        </section>
        <section
          lang="en"
          aria-label={vi.exam.questions}
          className="overflow-y-auto bg-surface p-10 max-lg:p-5"
        >
          <h3 className="mb-2 text-h3 font-semibold">Questions 1–5</h3>
          <p className="mb-6 text-reading-q text-ink-muted">
            Do the following statements agree with the information given in Reading Passage 1?
          </p>
          <fieldset className="rounded-xl border border-border p-5">
            <legend className="px-1 text-reading-q">
              <strong>{current}</strong> The first rooftop hives were set up before the building rules
              changed.
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {['TRUE', 'FALSE', 'NOT GIVEN'].map((o, i) => (
                <label
                  key={o}
                  className={
                    i === 1
                      ? 'flex h-9 items-center rounded-md border border-accent bg-accent-soft px-4 text-body font-semibold text-accent'
                      : 'flex h-9 items-center rounded-md border border-border-strong bg-surface px-4 text-body text-ink'
                  }
                >
                  <input type="radio" name={`q${current}`} className="sr-only" defaultChecked={i === 1} />
                  {o}
                </label>
              ))}
            </div>
          </fieldset>
        </section>
      </div>
      <QuestionNavBar
        parts={PARTS}
        current={current}
        answered={answered}
        flagged={flagged}
        onSelect={setCurrent}
      />
    </div>
  );
}

export default function ExamPreviewPage() {
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}

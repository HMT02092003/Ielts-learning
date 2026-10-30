'use client';

// Flashcard session (C-Flashcard): front = word, back = meaning + definition + example. Space flips, 1–4 grade
// (Lại / Khó / Được / Dễ) with the next-gap label on each button. Learning steps (< 1 day) come back this session.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { vi } from '@/i18n/vi';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { vocabApi } from '@/services/study.service';
import type { ReviewCardDto, ReviewGrade } from '@/shared/study';

const GRADES: { grade: ReviewGrade; label: string; key: string; className: string }[] = [
  { grade: 'AGAIN', label: 'Lại', key: '1', className: 'border-danger-border text-danger' },
  { grade: 'HARD', label: 'Khó', key: '2', className: 'border-border-control text-ink' },
  { grade: 'GOOD', label: 'Được', key: '3', className: 'border-accent text-accent' },
  { grade: 'EASY', label: 'Dễ', key: '4', className: 'border-border-control text-ink' },
];

export default function ReviewPage() {
  const qc = useQueryClient();
  const reduce = useReducedMotion();
  const queue = useQuery({
    queryKey: ['vocabulary', 'queue'],
    queryFn: () => vocabApi.queue(),
    refetchOnWindowFocus: false,
  });
  const [cards, setCards] = useState<ReviewCardDto[] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const list = cards ?? queue.data?.cards ?? null;
  const card = list?.[0];

  const grade = useMutation({
    mutationFn: (v: { card: ReviewCardDto; grade: ReviewGrade }) =>
      vocabApi.review(v.card.id, v.grade, crypto.randomUUID()),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Không lưu được kết quả ôn'),
  });

  const answer = useCallback(
    (g: ReviewGrade) => {
      if (!card || !flipped || !list) return;
      grade.mutate(
        { card, grade: g },
        {
          onSuccess: (updated) => {
            const rest = list.slice(1);
            // Still due within this session (learning step)? Put it back at the end.
            const soon = new Date(updated.dueAt).getTime() - Date.now() < 20 * 60_000;
            setCards(soon ? [...rest, { ...card, ...updated, preview: card.preview }] : rest);
            setDone((n) => n + 1);
            setFlipped(false);
            if (soon) void qc.invalidateQueries({ queryKey: ['vocabulary', 'queue'] });
          },
        },
      );
    },
    [card, flipped, grade, list, qc],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ') {
        e.preventDefault();
        setFlipped((f) => !f);
      }
      const g = GRADES.find((x) => x.key === e.key);
      if (g) answer(g.grade);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer]);

  if (!list) return <p className="pt-8 text-body text-ink-muted">{vi.common.loading}</p>;
  if (!card)
    return (
      <div className="flex flex-col items-start gap-4 pt-8">
        <h1 className="font-display text-h1 font-extralight">Xong phiên ôn 🎉</h1>
        <p className="text-body text-ink-muted">
          Đã ôn {done} thẻ
          {queue.data
            ? ` · hôm nay ${queue.data.progress.reviewedToday + done}/${queue.data.progress.dailyLimit}`
            : ''}
          .
        </p>
        <Link href="/vocabulary" className={buttonVariants({ variant: 'secondary' })}>
          Về sổ từ
        </Link>
      </div>
    );

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 pt-8 pb-12">
      <div className="flex items-center justify-between text-label-sm text-ink-muted">
        <Link href="/vocabulary" className="hover:underline">
          ← Sổ từ
        </Link>
        <span>
          Còn {list.length} thẻ · đã ôn {done}
        </span>
      </div>
      <div className="[perspective:1200px]">
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.4, ease: [0.2, 0, 0, 1] }}
          className="relative h-80 [transform-style:preserve-3d]"
        >
          <Card
            className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2 [backface-visibility:hidden]"
            onClick={() => setFlipped(true)}
            aria-hidden={flipped}
          >
            <p lang="en" className="font-reading text-display-lg">
              {card.term}
            </p>
            {card.phonetic && <p className="text-body text-ink-muted">{card.phonetic}</p>}
            <p className="mt-6 text-label-sm text-ink-subtle">Bấm hoặc nhấn Space để lật</p>
          </Card>
          <Card
            className="absolute inset-0 flex cursor-pointer flex-col gap-3 overflow-y-auto [backface-visibility:hidden] [transform:rotateY(180deg)]"
            onClick={() => setFlipped(false)}
            aria-hidden={!flipped}
          >
            <p lang="en" className="font-reading text-h2">
              {card.term}{' '}
              {card.partOfSpeech && <em className="text-body text-ink-muted">{card.partOfSpeech}</em>}
            </p>
            {card.meaning && <p className="text-title-sm font-semibold">{card.meaning}</p>}
            {card.definition && (
              <p lang="en" className="text-body text-ink-secondary">
                {card.definition}
              </p>
            )}
            {card.exampleSentence && (
              <blockquote
                lang="en"
                className="border-l-2 border-border-strong pl-3 font-reading text-body italic"
              >
                {card.exampleSentence}
              </blockquote>
            )}
          </Card>
        </motion.div>
      </div>
      {flipped ? (
        <div className="grid grid-cols-4 gap-2" role="group" aria-label="Mức độ nhớ">
          {GRADES.map((g) => (
            <button
              key={g.grade}
              type="button"
              disabled={grade.isPending}
              onClick={() => answer(g.grade)}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-xl border bg-surface py-2.5 text-label font-semibold outline-none focus-visible:shadow-focus disabled:opacity-60',
                g.className,
              )}
            >
              {g.label}
              <span className="text-caption font-normal text-ink-muted">
                {card.preview[g.grade]} · <kbd>{g.key}</kbd>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Button size="lg" onClick={() => setFlipped(true)}>
          Lật thẻ <kbd className="ml-1 text-caption opacity-80">Space</kbd>
        </Button>
      )}
    </div>
  );
}

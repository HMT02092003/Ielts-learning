'use client';

// Exam runner (spec §6 P3, D6/D10): start screen (CREATED) → "Bắt đầu" (server sets the deadline) → split view
// Reading / audio strip Listening, autosave, server-clock timer, submit + auto-submit at time-up.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { ErrorState } from '@/components/common/error-state';
import { ExamTimer } from '@/components/exam/exam-timer';
import { ExamTopBar, InstructionStrip } from '@/components/exam/exam-top-bar';
import { ExamListeningStrip, PracticeListeningStrip } from '@/components/exam/listening-strip';
import { PassagePane } from '@/components/exam/passage';
import { QuestionNavBar, type NavPart } from '@/components/exam/question-nav';
import { QuestionGroupView } from '@/components/exam/questions';
import { SaveIndicator } from '@/components/exam/save-indicator';
import { SpeakingRunner } from '@/components/exam/speaking-runner';
import { WritingRunner } from '@/components/exam/writing-runner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useAutosave } from '@/hooks/use-autosave';
import { useSession } from '@/hooks/use-session';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { serverNow, syncServerClock } from '@/lib/server-clock';
import { attemptsApi } from '@/services/exam.service';
import type { AttemptContentDto, AttemptStateDto } from '@/shared/attempt';
import { snapshot, useExamStore, type ReadingSize } from '@/stores/exam-store';

const SKILL_LABEL = {
  READING: 'Reading',
  LISTENING: 'Listening',
  WRITING: 'Writing',
  SPEAKING: 'Speaking',
} as const;

export default function AttemptPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [clockReady, setClockReady] = useState(false);
  const state = useQuery({
    queryKey: ['attempt', id, 'state'],
    queryFn: () => attemptsApi.state(id),
    refetchOnWindowFocus: false,
  });
  const content = useQuery({
    queryKey: ['attempt', id, 'content'],
    queryFn: () => attemptsApi.content(id),
    staleTime: Infinity,
  });

  useEffect(() => {
    void syncServerClock().finally(() => setClockReady(true));
  }, []);

  const status = state.data?.status;
  useEffect(() => {
    if (status === 'SUBMITTED' || status === 'EXPIRED') router.replace(`/results/${id}`);
    if (status === 'ABANDONED') router.replace('/practice');
  }, [status, id, router]);

  const begin = useMutation({
    mutationFn: () => attemptsApi.begin(id),
    onSuccess: (s) => qc.setQueryData(['attempt', id, 'state'], s),
  });

  if (state.isError || content.isError)
    return <ErrorState onRetry={() => void Promise.all([state.refetch(), content.refetch()])} />;
  if (!state.data || !content.data || !clockReady)
    return <p className="m-auto text-body text-ink-muted">{vi.common.loading}</p>;
  if (state.data.status === 'CREATED')
    return (
      <StartScreen s={state.data} c={content.data} onBegin={() => begin.mutate()} pending={begin.isPending} />
    );
  if (state.data.status !== 'IN_PROGRESS')
    return <p className="m-auto text-body text-ink-muted">Đang chuyển tới kết quả…</p>;
  return <Runner key={id} s={state.data} c={content.data} />;
}

function StartScreen({
  s,
  c,
  onBegin,
  pending,
}: {
  s: AttemptStateDto;
  c: AttemptContentDto;
  onBegin: () => void;
  pending: boolean;
}) {
  const questions = c.parts.reduce((n, p) => n + p.groups.reduce((m, g) => m + g.questions.length, 0), 0);
  const exam = s.mode === 'EXAM';
  return (
    <main className="m-auto flex w-full max-w-xl flex-col gap-5 rounded-2xl border border-border bg-surface p-8">
      <div className="flex flex-col gap-1">
        <p className="text-label text-ink-muted">
          {SKILL_LABEL[s.skill]} · {exam ? 'Chế độ thi' : 'Luyện tập'}
        </p>
        <h1 className="text-h2 font-semibold">{s.testTitle}</h1>
        <p className="text-body text-ink-muted">{s.scopeLabel}</p>
      </div>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-body">
        {questions > 0 && (
          <li>
            {questions} câu hỏi trong {c.parts.length} phần.
          </li>
        )}
        {exam ? (
          <>
            <li>Đồng hồ bắt đầu chạy khi bấm “Bắt đầu” và vẫn chạy nếu đóng trình duyệt.</li>
            <li>Hết giờ hệ thống tự nộp bài. Bài được lưu tự động.</li>
            {s.skill === 'LISTENING' && (
              <li>Audio phát một lần, không tạm dừng hay tua. Hãy kiểm tra loa trước.</li>
            )}
          </>
        ) : (
          <>
            <li>Không giới hạn thời gian. Bài được lưu tự động, có thể quay lại làm tiếp.</li>
            {s.skill === 'LISTENING' && <li>Có thể tạm dừng, tua ±5 giây và đổi tốc độ phát.</li>}
          </>
        )}
      </ul>
      <div className="flex gap-3">
        <Button size="lg" onClick={onBegin} disabled={pending}>
          {pending ? vi.common.loading : 'Bắt đầu'}
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/practice">{vi.common.back}</Link>
        </Button>
      </div>
    </main>
  );
}

function Runner({ s, c }: { s: AttemptStateDto; c: AttemptContentDto }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: user } = useSession();
  // Initialise the store once per attempt (Runner is keyed by attempt id) before anything reads it.
  const [ready] = useState(() => {
    const ui = s.uiState as { readingSize?: ReadingSize; timerHidden?: boolean };
    const first = c.parts[0]?.groups[0]?.questions[0]?.number ?? 1;
    useExamStore.getState().init({
      attemptId: s.id,
      answers: s.answers,
      flagged: s.flagged,
      current: s.currentQuestionNumber ?? first,
      seq: s.lastClientSeq,
      timeByPart: s.timeByPart,
      readingSize: ui.readingSize,
      timerHidden: ui.timerHidden,
    });
    return true;
  });
  const st = useExamStore();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [mobilePane, setMobilePane] = useState<'passage' | 'questions'>('passage');
  const submitting = useRef(false);

  const numberToPart = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of c.parts) for (const g of p.groups) for (const q of g.questions) m.set(q.number, p.id);
    return m;
  }, [c.parts]);
  const idToNumber = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of c.parts) for (const g of p.groups) for (const q of g.questions) m.set(q.id, q.number);
    return m;
  }, [c.parts]);
  const navParts: NavPart[] = useMemo(
    () =>
      c.parts
        .map((p) => ({ part: p.number, numbers: p.groups.flatMap((g) => g.questions.map((q) => q.number)) }))
        .filter((p) => p.numbers.length > 0),
    [c.parts],
  );

  const activePartId = numberToPart.get(st.current) ?? st.activePartId ?? c.parts[0]?.id ?? null;
  const part = c.parts.find((p) => p.id === activePartId) ?? c.parts[0];

  const finish = useCallback(
    async (auto: boolean) => {
      if (submitting.current) return;
      submitting.current = true;
      if (auto) setTimeUp(true);
      const cur = useExamStore.getState();
      try {
        await attemptsApi.submit(s.id, { clientSeq: cur.nextSeq(), ...snapshot(cur) });
      } catch {
        // The server finalises overdue attempts on its own (sweeper); the result page reads the final state.
      }
      // Drop in-exam caches (writing drafts, recordings, state) so the result screen reads fresh data.
      qc.removeQueries({ queryKey: ['attempt', s.id] });
      router.replace(`/results/${s.id}`);
    },
    [qc, router, s.id],
  );

  const onDeadline = useCallback(() => void finish(true), [finish]);
  useAutosave(s.id, ready, onDeadline);

  // Server-clock countdown + time per part (only while the tab is visible).
  const deadline = s.deadlineAt ? Date.parse(s.deadlineAt) : null;
  const [secondsLeft, setSecondsLeft] = useState(() => (deadline ? (deadline - serverNow()) / 1000 : 0));
  useEffect(() => {
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const st2 = useExamStore.getState();
      const pid = numberToPart.get(st2.current) ?? st2.activePartId;
      if (pid && document.visibilityState === 'visible') st2.addTime(pid, now - last);
      last = now;
      if (deadline) {
        const left = (deadline - serverNow()) / 1000;
        setSecondsLeft(left);
        if (left <= 0) void finish(true);
      }
    }, 500);
    return () => clearInterval(id);
  }, [deadline, finish, numberToPart]);

  const answered = useMemo(() => {
    const set = new Set<number>();
    for (const [qid, v] of Object.entries(st.answers)) {
      const n = idToNumber.get(qid);
      if (n !== undefined && v && (v.kind === 'KEY' ? v.key : v.text.trim())) set.add(n);
    }
    return set;
  }, [st.answers, idToNumber]);
  const flagged = useMemo(() => {
    const set = new Set<number>();
    for (const qid of Object.keys(st.flagged)) {
      const n = idToNumber.get(qid);
      if (n !== undefined) set.add(n);
    }
    return set;
  }, [st.flagged, idToNumber]);

  const select = (n: number) => {
    st.goTo(n);
    setMobilePane('questions');
    requestAnimationFrame(() => {
      const el = document.getElementById(`q-${n}`);
      el?.scrollIntoView({ block: 'start' });
      el?.querySelector<HTMLElement>('input, select, button, textarea')?.focus({ preventScroll: true });
    });
  };

  const onListeningPart = useCallback(
    (partNumber: number) => {
      const p = c.parts.find((x) => x.number === partNumber);
      const first = p?.groups[0]?.questions[0]?.number;
      if (p) useExamStore.getState().setActivePart(p.id);
      if (first !== undefined) {
        useExamStore.getState().goTo(first);
        document.getElementById(`q-${first}`)?.scrollIntoView({ block: 'start' });
      }
    },
    [c.parts],
  );

  if (!ready || !part) return null;
  const total = navParts.reduce((n, p) => n + p.numbers.length, 0);
  const isReading = c.skill === 'READING';
  const isListening = c.skill === 'LISTENING';

  if (c.skill === 'WRITING' || c.skill === 'SPEAKING') {
    const Comp = c.skill === 'WRITING' ? WritingRunner : SpeakingRunner;
    return (
      <Comp
        s={s}
        c={c}
        candidate={user?.displayName ?? ''}
        secondsLeft={deadline ? secondsLeft : null}
        onSubmit={() => void finish(false)}
      />
    );
  }

  const paragraphLabels = part.passage?.paragraphs.map((p) => p.label).filter((l): l is string => !!l) ?? [];
  const questions = (
    <div lang="en" className="flex flex-col gap-8">
      {part.groups.map((g) => (
        <QuestionGroupView key={g.id} group={g} paragraphLabels={paragraphLabels} />
      ))}
    </div>
  );

  return (
    <div className="flex h-full flex-col" data-reading-size={st.readingSize}>
      <ExamTopBar
        source={c.test.source}
        title={`${c.test.title} · ${SKILL_LABEL[c.skill]}`}
        candidate={user?.displayName ?? ''}
        timer={
          deadline ? (
            <ExamTimer secondsLeft={secondsLeft} hidden={st.timerHidden} onToggle={st.toggleTimer} />
          ) : (
            <span className="text-label text-ink-muted">Luyện tập · không giới hạn giờ</span>
          )
        }
        readingSize={st.readingSize}
        onReadingSize={st.setReadingSize}
        onSubmit={() => setConfirmOpen(true)}
      />
      <InstructionStrip>
        <div className="flex items-center gap-3">
          <span className="flex-1">
            <strong className="font-semibold">Part {part.number}</strong>
            {part.instructions ? ` — ${part.instructions}` : part.title ? ` — ${part.title}` : ''}
          </span>
          <SaveIndicator />
          {s.mode === 'PRACTICE' && (
            <Link
              href="/practice"
              className="text-label-sm text-ink-muted underline-offset-2 hover:underline"
            >
              Lưu &amp; thoát
            </Link>
          )}
        </div>
      </InstructionStrip>
      {isListening && s.mode === 'EXAM' && s.startedAt && (
        <ExamListeningStrip parts={c.parts} startedAt={s.startedAt} onPart={onListeningPart} />
      )}
      {isListening && s.mode === 'PRACTICE' && <PracticeListeningStrip part={part} />}

      {isReading && part.passage ? (
        <>
          <div
            role="tablist"
            aria-label="Chế độ xem"
            className="flex shrink-0 gap-1 border-b border-border bg-surface p-1 lg:hidden"
          >
            {(['passage', 'questions'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={mobilePane === k}
                onClick={() => setMobilePane(k)}
                className={cn(
                  'h-10 flex-1 rounded-md text-label',
                  mobilePane === k ? 'bg-ink text-ink-inverse' : 'text-ink-muted',
                )}
              >
                {k === 'passage' ? vi.exam.passage : vi.exam.questions}
              </button>
            ))}
          </div>
          <div className="hidden min-h-0 flex-1 lg:flex">
            <Group orientation="horizontal" className="min-h-0 flex-1">
              <Panel defaultSize="50" minSize="25" className="overflow-y-auto bg-surface p-10">
                <section lang="en" aria-label={vi.exam.passage}>
                  <PassagePane attemptId={s.id} part={part} allowSaveWord={s.mode === 'PRACTICE'} />
                </section>
              </Panel>
              <Separator
                aria-label="Kéo để đổi độ rộng"
                className="w-1.5 bg-border outline-none hover:bg-border-strong focus-visible:shadow-focus"
              />
              <Panel minSize="25" className="overflow-y-auto bg-background p-8">
                <section aria-label={vi.exam.questions}>{questions}</section>
              </Panel>
            </Group>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5 lg:hidden">
            {mobilePane === 'passage' ? (
              <section lang="en" aria-label={vi.exam.passage} className="bg-surface">
                <PassagePane attemptId={s.id} part={part} allowSaveWord={s.mode === 'PRACTICE'} />
              </section>
            ) : (
              <section aria-label={vi.exam.questions}>{questions}</section>
            )}
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto bg-background p-8 max-lg:p-5">
          <div className="mx-auto max-w-3xl">{questions}</div>
        </div>
      )}

      <QuestionNavBar
        parts={navParts}
        current={st.current}
        answered={answered}
        flagged={flagged}
        onSelect={select}
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          title="Nộp bài?"
          description={`Đã trả lời ${answered.size}/${total} câu${flagged.size ? `, còn ${flagged.size} câu đánh dấu xem lại` : ''}.`}
        >
          {total - answered.size > 0 && (
            <p className="rounded-lg bg-warning-soft px-3 py-2 text-body text-warning-ink">
              Còn {total - answered.size} câu bỏ trống. Sau khi nộp sẽ không sửa được nữa.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Làm tiếp
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                void finish(false);
              }}
            >
              Nộp bài
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={timeUp}>
        <DialogContent
          title="Hết giờ"
          description="Bài của bạn đang được nộp tự động…"
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <p className="text-body text-ink-muted">Chuyển tới trang kết quả ngay sau khi nộp xong.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

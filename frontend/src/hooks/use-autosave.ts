'use client';

// Autosave for an exam session (spec §6 P3, design conflict #12): debounce ~1 s after a change, immediately when
// the current question changes, every 10 s while something is unsaved, and a keepalive save on pagehide.
// Every save sends the full snapshot + a monotonic clientSeq; the server drops anything older (CAS).
import { useEffect, useRef } from 'react';
import { ApiError } from '@/lib/api-client';
import { noteServerTime } from '@/lib/server-clock';
import { attemptsApi, autosaveKeepalive } from '@/services/exam.service';
import { snapshot, useExamStore } from '@/stores/exam-store';

const DEBOUNCE_MS = 1000;
const SAFETY_MS = 10_000;

export function useAutosave(attemptId: string, enabled: boolean, onDeadlinePassed: () => void) {
  const deadlineCb = useRef(onDeadlinePassed);
  useEffect(() => {
    deadlineCb.current = onDeadlinePassed;
  }, [onDeadlinePassed]);

  useEffect(() => {
    if (!enabled) return;
    let inflight = false;
    let again = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const save = async (): Promise<void> => {
      const st = useExamStore.getState();
      if (st.attemptId !== attemptId || st.revision === st.savedRevision) return;
      if (inflight) {
        again = true;
        return;
      }
      inflight = true;
      const revision = st.revision;
      try {
        const res = await attemptsApi.autosave(attemptId, { clientSeq: st.nextSeq(), ...snapshot(st) });
        noteServerTime(res.serverNow);
        useExamStore.getState().markSaved(revision, Date.now());
      } catch (e) {
        if (e instanceof ApiError && e.code === 'ATTEMPT_DEADLINE_PASSED') deadlineCb.current();
        else useExamStore.getState().markSaveError(e instanceof Error ? e.message : 'Lỗi lưu bài');
      } finally {
        inflight = false;
        if (again) {
          again = false;
          void save();
        }
      }
    };

    // Debounce on every change; save at once when the current question changes.
    const unsub = useExamStore.subscribe((cur, prev) => {
      if (cur.revision === prev.revision) return;
      clearTimeout(timer);
      if (cur.current !== prev.current) void save();
      else timer = setTimeout(() => void save(), DEBOUNCE_MS);
    });
    const safety = setInterval(() => void save(), SAFETY_MS);
    return () => {
      unsub();
      clearTimeout(timer);
      clearInterval(safety);
    };
  }, [attemptId, enabled]);

  // Closing / hiding the tab: fire-and-forget keepalive request.
  useEffect(() => {
    if (!enabled) return;
    const flush = () => {
      const st = useExamStore.getState();
      if (st.attemptId !== attemptId) return;
      if (st.revision === st.savedRevision) return;
      autosaveKeepalive(attemptId, { clientSeq: st.nextSeq(), ...snapshot(st) });
      st.markSaved(st.revision, Date.now());
    };
    const onVisibility = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [attemptId, enabled]);
}

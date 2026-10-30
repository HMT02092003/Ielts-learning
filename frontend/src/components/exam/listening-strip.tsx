'use client';

// Listening audio (spec §6 P3, D6). EXAM: one play only, no pause/seek — the position always comes from the server
// clock (serverNow − startedAt), so a refresh resumes where the recording "is" now and missed audio stays missed.
// PRACTICE: per-part player with pause, ±5 s and speed 0.75–1.25×.
import { Pause, Play, RotateCcw, RotateCw, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { serverNow } from '@/lib/server-clock';
import { fileUrl } from '@/services/admin.service';
import type { ContentPart } from '@/shared/attempt';

interface Segment {
  partNumber: number;
  fileId: string;
  startMs: number;
  lenMs: number;
  /** Offset of this segment from the start of the whole recording sequence. */
  atMs: number;
}

function segmentsOf(parts: ContentPart[]): Segment[] {
  const out: Segment[] = [];
  let at = 0;
  for (const p of parts) {
    if (!p.audio) continue;
    const startMs = p.audio.startMs ?? 0;
    const lenMs = (p.audio.endMs ?? p.audio.durationMs) - startMs;
    out.push({ partNumber: p.number, fileId: p.audio.fileId, startMs, lenMs, atMs: at });
    at += lenMs;
  }
  return out;
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function Volume({ onVolume }: { onVolume: (v: number) => void }) {
  const [v, setV] = useState(80);
  return (
    <label className="flex items-center gap-2 text-label-sm text-ink-muted">
      <Volume2 className="size-4" aria-hidden />
      <span className="sr-only">Âm lượng</span>
      <input
        type="range"
        min={0}
        max={100}
        value={v}
        onChange={(e) => {
          setV(Number(e.target.value));
          onVolume(Number(e.target.value) / 100);
        }}
        className="w-24 accent-[var(--accent)]"
      />
    </label>
  );
}

export function ExamListeningStrip({
  parts,
  startedAt,
  onPart,
}: {
  parts: ContentPart[];
  startedAt: string;
  onPart: (partNumber: number) => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const segments = useMemo(() => segmentsOf(parts), [parts]);
  const [playing, setPlaying] = useState(false);
  const [label, setLabel] = useState('');
  const [finished, setFinished] = useState(false);
  const current = useRef<Segment | null>(null);
  const total = segments.reduce((s, x) => s + x.lenMs, 0);

  /** Seek to where the recording should be right now (server clock). */
  const sync = useCallback(() => {
    const el = audio.current;
    if (!el) return false;
    const elapsed = serverNow() - Date.parse(startedAt);
    const seg = segments.find((s) => elapsed < s.atMs + s.lenMs);
    if (!seg) {
      el.pause();
      setPlaying(false);
      setLabel('Đã hết phần nghe — dùng thời gian còn lại để kiểm tra đáp án.');
      return false;
    }
    const target = (seg.startMs + Math.max(0, elapsed - seg.atMs)) / 1000;
    if (current.current !== seg) {
      current.current = seg;
      el.src = fileUrl(seg.fileId);
      onPart(seg.partNumber);
    }
    if (Math.abs(el.currentTime - target) > 1.5) el.currentTime = target;
    return true;
  }, [startedAt, onPart, segments]);

  const start = () => {
    if (!sync()) return;
    void audio.current?.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  };

  // Keep in step with the server clock: next segment, drift correction, end of recording.
  useEffect(() => {
    const id = setInterval(() => {
      const el = audio.current;
      if (!el) return;
      const elapsed = serverNow() - Date.parse(startedAt);
      setFinished(elapsed >= total);
      setLabel(`Đang phát · ${mmss(Math.min(elapsed, total))} / ${mmss(total)}`);
      if (!playing) return;
      const seg = current.current;
      if (
        !seg ||
        elapsed >= seg.atMs + seg.lenMs ||
        Math.abs(el.currentTime * 1000 - (seg.startMs + elapsed - seg.atMs)) > 2000
      ) {
        if (sync()) void el.play().catch(() => setPlaying(false));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [playing, startedAt, sync, total]);

  return (
    <div className="flex shrink-0 items-center gap-4 border-b border-border bg-surface px-5 py-2">
      <audio ref={audio} preload="auto" onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
      {!playing && !finished ? (
        <Button size="sm" onClick={start}>
          <Play className="size-4" aria-hidden /> Bấm để nghe
        </Button>
      ) : null}
      <span className="text-label-sm text-ink-muted" aria-live="off">
        {finished
          ? 'Đã hết phần nghe — dùng thời gian còn lại để kiểm tra đáp án.'
          : label || 'Audio phát một lần, không tua được.'}
      </span>
      <div className="ml-auto">
        <Volume onVolume={(x) => audio.current && (audio.current.volume = x)} />
      </div>
    </div>
  );
}

export function PracticeListeningStrip({ part }: { part: ContentPart }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [rate, setRate] = useState(1);
  const startS = (part.audio?.startMs ?? 0) / 1000;
  const endS = part.audio ? (part.audio.endMs ?? part.audio.durationMs) / 1000 : 0;

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = rate;
  }, [rate]);

  if (!part.audio) return null;
  const seek = (d: number) => {
    const el = audio.current;
    if (el) el.currentTime = Math.min(endS, Math.max(startS, el.currentTime + d));
  };
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-surface px-5 py-2">
      <audio
        key={part.id}
        ref={audio}
        src={fileUrl(part.audio.fileId)}
        preload="auto"
        onLoadedMetadata={(e) => {
          e.currentTarget.currentTime = startS;
          e.currentTarget.playbackRate = rate;
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setPos(t - startS);
          if (t >= endS) e.currentTarget.pause();
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />
      <span className="text-label font-semibold">Part {part.number}</span>
      <Button variant="secondary" size="icon" aria-label="Lùi 5 giây" onClick={() => seek(-5)}>
        <RotateCcw className="size-4" aria-hidden />
      </Button>
      <Button
        size="icon"
        aria-label={playing ? 'Tạm dừng' : 'Phát'}
        onClick={() => (playing ? audio.current?.pause() : void audio.current?.play())}
      >
        {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
      </Button>
      <Button variant="secondary" size="icon" aria-label="Tới 5 giây" onClick={() => seek(5)}>
        <RotateCw className="size-4" aria-hidden />
      </Button>
      <span className="font-tabular text-label-sm text-ink-muted">
        {mmss(pos * 1000)} / {mmss((endS - startS) * 1000)}
      </span>
      <label className="flex items-center gap-1.5 text-label-sm text-ink-muted">
        Tốc độ
        <select
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          className="h-8 rounded-md border border-border-control bg-surface px-1.5 text-ink"
        >
          {[0.75, 0.9, 1, 1.1, 1.25].map((r) => (
            <option key={r} value={r}>
              {r}×
            </option>
          ))}
        </select>
      </label>
      <div className="ml-auto">
        <Volume onVolume={(x) => audio.current && (audio.current.volume = x)} />
      </div>
    </div>
  );
}

'use client';

import { useSyncExternalStore } from 'react';
import { cn } from '@/lib/cn';
import { readViewPref, writeViewPref, type ViewMode } from '@/lib/test-sets';

// The choice also lives in memory so the switch works when localStorage is blocked.
const chosen = new Map<string, ViewMode>();
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** Remembered "Theo bộ | Danh sách" choice of one page (server render uses the fallback). */
export function useViewPref(key: string, fallback: ViewMode): [ViewMode, (v: ViewMode) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => chosen.get(key) ?? readViewPref(key, fallback),
    () => fallback,
  );
  const set = (v: ViewMode) => {
    chosen.set(key, v);
    writeViewPref(key, v);
    for (const l of listeners) l();
  };
  return [value, set];
}

/** "Theo bộ | Danh sách" switch for the test list pages. */
export function ViewToggle({
  value,
  onChange,
  labels,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
  labels: Record<ViewMode, string>;
}) {
  return (
    <div className="flex gap-1" role="radiogroup">
      {(['sets', 'list'] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            'flex h-10 items-center rounded-md border px-4 text-label outline-none focus-visible:shadow-focus',
            value === v
              ? 'border-accent bg-accent-soft font-semibold text-accent'
              : 'border-border-control bg-surface text-ink',
          )}
        >
          {labels[v]}
        </button>
      ))}
    </div>
  );
}

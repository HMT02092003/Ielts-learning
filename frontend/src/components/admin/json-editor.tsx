'use client';

// Plain-textarea JSON editor with line numbers and a clickable issue list (path → jumps to the matching key).
import { useRef } from 'react';
import { cn } from '@/lib/cn';

export interface Issue {
  path: string;
  code?: string;
  message: string;
}

/** Best-effort: find the character offset of a path like "reading.passages[2].groups[1].answer" in the text. */
function locate(text: string, path: string): number {
  const keys = path.split(/\.|\[|\]/).filter((k) => k && !/^\d+$/.test(k));
  let from = 0;
  for (const k of keys) {
    const at = text.indexOf(`"${k}"`, from);
    if (at < 0) break;
    from = at + 1;
  }
  return Math.max(0, from - 1);
}

export function JsonEditor({
  value,
  onChange,
  issues,
  readOnly,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  issues: Issue[];
  readOnly?: boolean;
  label: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const lines = value.split('\n').length;

  function jump(path: string) {
    const el = ref.current;
    if (!el) return;
    const pos = locate(value, path);
    el.focus();
    el.setSelectionRange(pos, pos);
    const line = value.slice(0, pos).split('\n').length;
    el.scrollTop = Math.max(0, (line - 5) * 20);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-h-[70vh] overflow-hidden rounded-xl border border-border-strong bg-surface focus-within:border-accent focus-within:shadow-halo">
        <div
          aria-hidden
          className="shrink-0 overflow-hidden border-r border-border bg-surface-muted px-2 py-2.5 text-right font-mono text-caption leading-5 text-ink-subtle select-none"
        >
          {Array.from({ length: lines }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <textarea
          ref={ref}
          aria-label={label}
          spellCheck={false}
          readOnly={readOnly}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => {
            const gutter = e.currentTarget.previousElementSibling;
            if (gutter) gutter.scrollTop = e.currentTarget.scrollTop;
          }}
          className="min-h-[50vh] flex-1 resize-none bg-transparent px-3 py-2.5 font-mono text-caption leading-5 text-ink outline-none"
        />
      </div>
      {issues.length > 0 && (
        <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto rounded-xl border border-danger-border bg-danger-soft p-3">
          {issues.map((i, n) => (
            <li key={n}>
              <button
                type="button"
                onClick={() => jump(i.path)}
                className={cn('w-full rounded-md px-2 py-1 text-left text-body text-danger hover:bg-surface')}
              >
                <code className="font-mono text-caption">{i.path || '(gốc)'}</code> — {i.message}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function issuesOf(err: unknown): Issue[] {
  const details = (err as { details?: { issues?: Issue[] } } | null)?.details;
  return Array.isArray(details?.issues) ? details.issues : [];
}

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-start gap-3 py-6', className)}>
      {icon && <div className="text-ink-muted [&_svg]:size-5">{icon}</div>}
      <h2 className="text-h3 font-semibold text-ink">{title}</h2>
      {body && <p className="max-w-[60ch] text-body text-ink-muted">{body}</p>}
      {action}
    </div>
  );
}

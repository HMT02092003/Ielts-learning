'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn('m-auto flex flex-col items-start gap-3 p-6', className)}>
      <AlertTriangle className="size-5 text-danger" aria-hidden />
      <h2 className="text-h3 font-semibold text-ink">{vi.common.errorTitle}</h2>
      {message && <p className="max-w-[60ch] text-body text-ink-muted">{message}</p>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {vi.common.retry}
        </Button>
      )}
    </div>
  );
}

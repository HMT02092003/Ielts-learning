import { Badge } from '@/components/ui/badge';
import { viAdmin } from '@/i18n/vi-admin';
import type { TestStatus } from '@/shared/enums';

export function StatusBadge({ status }: { status: TestStatus }) {
  return (
    <Badge variant={status === 'PUBLISHED' ? 'success' : status === 'DRAFT' ? 'warning' : 'neutral'}>
      {viAdmin.status[status]}
    </Badge>
  );
}

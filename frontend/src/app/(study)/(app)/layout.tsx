import type { ReactNode } from 'react';
import { StudyShell } from '@/components/layout/study-shell';

export default function AppLayout({ children }: { children: ReactNode }) {
  return <StudyShell>{children}</StudyShell>;
}

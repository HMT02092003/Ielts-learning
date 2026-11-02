'use client';

import { TestBuilder } from '@/components/admin/builder/test-builder';
import { emptyDoc } from '@/lib/builder/templates';

const initial = emptyDoc();

export default function NewTestBuilderPage() {
  return <TestBuilder initialDoc={initial} />;
}

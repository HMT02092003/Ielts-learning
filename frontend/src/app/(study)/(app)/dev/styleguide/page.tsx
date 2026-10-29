'use client';

import { Flag } from 'lucide-react';
import { NotFoundView } from '@/components/common/not-found-view';
import { QuestionNavButton } from '@/components/exam/question-nav';
import { Badge, SourceBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardLabel } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useSession } from '@/hooks/use-session';

const SWATCHES = [
  'background',
  'surface',
  'surface-muted',
  'ink',
  'ink-muted',
  'accent',
  'accent-soft',
  'success',
  'danger',
  'warning',
  'info',
  'highlight',
] as const;

/** Visual reference of tokens and component states (C-Components) for reviewing the design at each phase. */
export default function StyleguidePage() {
  const { data: user, isPending } = useSession();
  if (isPending) return null;
  if (process.env.NODE_ENV === 'production' && user?.role !== 'ADMIN') return <NotFoundView />;

  return (
    <div className="flex flex-col gap-8 pt-8">
      <h1 className="font-display text-h2 font-light">Styleguide · lặng</h1>

      <Card>
        <CardLabel>Màu (token theo vai trò)</CardLabel>
        <div className="mt-4 flex flex-wrap gap-4">
          {SWATCHES.map((name) => (
            <div key={name} className="flex w-28 flex-col gap-2">
              <div
                className="h-14 rounded-xl border border-border"
                style={{ background: `var(--${name})` }}
              />
              <code className="text-caption text-ink-muted">--{name}</code>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardLabel>Chữ</CardLabel>
        <div className="mt-4 flex flex-col gap-3">
          <p className="font-display text-display-xl font-extralight font-tabular">7.0</p>
          <p className="font-display text-h1 font-extralight">Chào Đạt.</p>
          <p className="font-display text-h2 font-light">Tiêu đề thẻ</p>
          <p className="text-h3 font-semibold">Questions 1–5</p>
          <p className="text-body-lg">Nội dung mặc định — Be Vietnam Pro: ệ ữ ặ ẳ ỡ.</p>
          <p lang="en" className="text-reading max-w-[640px]">
            Reading passage text in Newsreader. Most of us hum without noticing, while cooking or waiting for
            a bus.
          </p>
          <p className="text-caption text-ink-muted">Caption · trợ giúp</p>
        </div>
      </Card>

      <Card>
        <CardLabel>Button</CardLabel>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
          <Button loading loadingText="Đang lưu…">
            Lưu
          </Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </div>
      </Card>

      <Card>
        <CardLabel>Input · Checkbox</CardLabel>
        <div className="mt-4 grid max-w-[640px] gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sg-default">Mặc định</Label>
            <Input id="sg-default" placeholder="Nhập…" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sg-error">Lỗi</Label>
            <Input id="sg-error" aria-invalid defaultValue="sai định dạng" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sg-disabled">Vô hiệu</Label>
            <Input id="sg-disabled" disabled defaultValue="không sửa được" />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Checkbox id="sg-check" defaultChecked />
            <Label htmlFor="sg-check" className="text-body text-ink">
              Ghi nhớ
            </Label>
          </div>
        </div>
      </Card>

      <Card>
        <CardLabel>Tag · Progress</CardLabel>
        <div className="mt-4 flex flex-wrap gap-2">
          <SourceBadge source="CAM" />
          <SourceBadge source="VOL" />
          <SourceBadge source="PRE_IELTS" />
          <Badge variant="success">Đã đạt</Badge>
          <Badge variant="warning">Cần luyện</Badge>
          <Badge variant="danger">Sai</Badge>
          <Badge variant="mode-exam">Chế độ thi</Badge>
          <Badge variant="mode-practice">Luyện tập</Badge>
        </div>
        <div className="mt-6 flex max-w-[480px] flex-col gap-5">
          <Progress value={62} aria-label="Tiến độ mặc định" />
          <Progress value={80} large targetMarker={70} aria-label="Band so với mục tiêu" />
          <Progress value={100} tone="success" aria-label="Đạt mục tiêu" />
          <Progress value={45} tone="warning" aria-label="Thiếu số từ" />
        </div>
      </Card>

      <Card>
        <CardLabel>Nút điều hướng câu hỏi (Exam)</CardLabel>
        <div className="exam-mode mt-4 flex flex-wrap gap-2 rounded-xl bg-surface p-4">
          <QuestionNavButton
            number={1}
            answered={false}
            flagged={false}
            current={false}
            onSelect={() => {}}
          />
          <QuestionNavButton number={2} answered flagged={false} current={false} onSelect={() => {}} />
          <QuestionNavButton number={3} answered={false} flagged current={false} onSelect={() => {}} />
          <QuestionNavButton number={4} answered flagged current={false} onSelect={() => {}} />
          <QuestionNavButton number={5} answered={false} flagged={false} current onSelect={() => {}} />
          <span className="flex items-center gap-1 text-caption text-ink-muted">
            <Flag className="size-3.5" aria-hidden /> = đã đánh dấu
          </span>
        </div>
      </Card>
    </div>
  );
}

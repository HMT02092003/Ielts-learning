'use client';

// Settings (spec §6 P6): display name, target band, exam date, theme, exam text size, flashcard limits,
// change password.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardLabel } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { useSession } from '@/hooks/use-session';
import { vi } from '@/i18n/vi';
import { ApiError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { authService } from '@/services/auth.service';
import type { UserDto } from '@/shared/auth';

const BANDS = Array.from({ length: 11 }, (_, i) => 4 + i / 2);

function Profile({ user }: { user: UserDto }) {
  const qc = useQueryClient();
  const [name, setName] = useState(user.displayName);
  const [target, setTarget] = useState(user.targetBand === null ? '' : String(user.targetBand));
  const [examDate, setExamDate] = useState(user.examDate ?? '');
  const [prefs, setPrefs] = useState(user.preferences);
  const save = useMutation({
    mutationFn: () =>
      authService.updateMe({
        displayName: name,
        targetBand: target === '' ? null : Number(target),
        examDate: examDate || null,
        preferences: prefs,
      }),
    onSuccess: (u) => {
      qc.setQueryData(queryKeys.me, u);
      void qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success('Đã lưu cài đặt');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Không lưu được'),
  });

  return (
    <Card className="flex flex-col gap-4">
      <CardLabel>Hồ sơ & mục tiêu</CardLabel>
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label className="flex flex-col gap-1 text-label">
          Tên hiển thị
          <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        </label>
        <label className="flex flex-col gap-1 text-label">
          Band mục tiêu
          <NativeSelect value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Chưa đặt</option>
            {BANDS.map((b) => (
              <option key={b} value={b}>
                {b.toFixed(1)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-label">
          Ngày thi
          <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-label">
          Cỡ chữ đề thi
          <NativeSelect
            value={prefs.examFontSize}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, examFontSize: e.target.value as typeof p.examFontSize }))
            }
          >
            <option value="sm">Nhỏ</option>
            <option value="md">Vừa</option>
            <option value="lg">Lớn</option>
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-label">
          Giao diện
          <NativeSelect
            value={prefs.theme}
            onChange={(e) => setPrefs((p) => ({ ...p, theme: e.target.value as typeof p.theme }))}
          >
            <option value="system">{vi.theme.system}</option>
            <option value="light">{vi.theme.light}</option>
            <option value="dark">{vi.theme.dark}</option>
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-label">
          Tiếng Anh dùng để kiểm lỗi Writing
          <NativeSelect
            value={prefs.ltLanguage}
            onChange={(e) => setPrefs((p) => ({ ...p, ltLanguage: e.target.value as typeof p.ltLanguage }))}
          >
            <option value="en-GB">Anh – Anh (en-GB)</option>
            <option value="en-US">Anh – Mỹ (en-US)</option>
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-label">
          Số thẻ ôn tối đa mỗi ngày
          <Input
            type="number"
            min={1}
            max={500}
            value={prefs.dailyCardLimit}
            onChange={(e) => setPrefs((p) => ({ ...p, dailyCardLimit: Number(e.target.value) }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-label">
          Số thẻ mới mỗi ngày
          <Input
            type="number"
            min={0}
            max={100}
            value={prefs.newCardsPerDay}
            onChange={(e) => setPrefs((p) => ({ ...p, newCardsPerDay: Number(e.target.value) }))}
          />
        </label>
        <div className="md:col-span-2">
          <Button type="submit" disabled={save.isPending}>
            Lưu cài đặt
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Password() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const change = useMutation({
    mutationFn: () => authService.changePassword({ currentPassword: current, newPassword: next }),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      toast.success('Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Không đổi được mật khẩu'),
  });
  return (
    <Card className="flex flex-col gap-4">
      <CardLabel>Đổi mật khẩu</CardLabel>
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          change.mutate();
        }}
      >
        <label className="flex flex-col gap-1 text-label">
          Mật khẩu hiện tại
          <Input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-label">
          Mật khẩu mới (tối thiểu 8 ký tự)
          <Input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
        </label>
        <div className="md:col-span-2">
          <Button type="submit" variant="secondary" disabled={change.isPending}>
            Đổi mật khẩu
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function SettingsPage() {
  const { data: user } = useSession();
  return (
    <div className="flex flex-col gap-6 pt-8 pb-12">
      <h1 className="font-display text-h1 font-extralight">Cài đặt</h1>
      {user ? (
        <Profile key={user.id} user={user} />
      ) : (
        <p className="text-body text-ink-muted">{vi.common.loading}</p>
      )}
      <Password />
    </div>
  );
}

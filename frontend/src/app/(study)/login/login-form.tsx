'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { vi } from '@/i18n/vi';
import { ApiError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { authService } from '@/services/auth.service';

/** Only same-site relative paths are allowed as ?next= (no open redirect). */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const errorId = useId();
  const [remember, setRemember] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const login = useMutation({
    mutationFn: authService.login,
    onSuccess: (res) => {
      qc.setQueryData(queryKeys.me, res.user);
      router.replace(safeNext(params.get('next')));
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    login.mutate({
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
      remember,
    });
  }

  const error =
    login.error instanceof ApiError
      ? login.error
      : login.error
        ? new ApiError(0, 'INTERNAL', vi.login.failed)
        : null;

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-6"
      noValidate
      aria-describedby={error ? errorId : undefined}
    >
      <h2 className="text-title-sm font-semibold text-ink">{vi.login.title}</h2>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{vi.login.email}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          size="lg"
          autoComplete="username"
          required
          aria-invalid={!!error || undefined}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{vi.login.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          size="lg"
          autoComplete="current-password"
          required
          aria-invalid={!!error || undefined}
        />
      </div>

      <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
          <Label htmlFor="remember" className="text-body text-ink">
            {vi.login.remember}
          </Label>
        </div>
        <button
          type="button"
          onClick={() => setShowForgot((v) => !v)}
          className="rounded-md text-body text-accent underline-offset-4 outline-none hover:underline focus-visible:shadow-focus"
        >
          {vi.login.forgot}
        </button>
      </div>
      {showForgot && <p className="text-body text-ink-muted">{vi.login.forgotHelp}</p>}

      {error && (
        <p id={errorId} role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-body text-danger">
          {error.message}
        </p>
      )}

      <Button
        type="submit"
        size="xl"
        className="w-full"
        loading={login.isPending}
        loadingText={vi.login.submitting}
      >
        {vi.login.submit}
      </Button>
    </form>
  );
}

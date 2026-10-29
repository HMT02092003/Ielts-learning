'use client';

import { LogOut, Settings, Shield } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { BrandMark } from '@/components/common/brand-mark';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLogout, useSession } from '@/hooks/use-session';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { ThemeMenu } from './theme-menu';

const NAV = [
  { href: '/dashboard', label: vi.nav.dashboard },
  { href: '/practice', label: vi.nav.practice, disabled: true },
  { href: '/vocabulary', label: vi.nav.vocabulary, disabled: true },
  { href: '/history', label: vi.nav.history, disabled: true },
] as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function StudyShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const session = useSession();
  const logout = useLogout();
  const user = session.data;

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-dashboard flex-wrap items-center gap-x-8 gap-y-3 px-6 py-6 lg:px-8">
        <Link href="/dashboard" className="rounded-md outline-none focus-visible:shadow-focus">
          <BrandMark />
        </Link>
        <nav
          aria-label="Điều hướng chính"
          className="order-3 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto"
        >
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            if ('disabled' in item && item.disabled) {
              return (
                <span
                  key={item.href}
                  aria-disabled
                  className="flex h-9 items-center rounded-md px-3 text-body text-ink-subtle"
                >
                  {item.label}
                </span>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-9 items-center rounded-md px-3 text-body outline-none transition-colors duration-[120ms] focus-visible:shadow-focus',
                  active ? 'bg-surface font-medium text-ink shadow-xs' : 'text-ink-muted hover:text-ink',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeMenu />
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={vi.user.menu} className="rounded-full">
                  <span className="flex size-9 items-center justify-center rounded-full bg-accent-soft text-label-sm font-semibold text-accent">
                    {initials(user.displayName)}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <span className="block text-body font-medium text-ink">{user.displayName}</span>
                  <span className="block">{user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.role === 'ADMIN' && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <Shield aria-hidden /> {vi.nav.admin}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem disabled>
                  <Settings aria-hidden /> {vi.user.settings}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void logout()}>
                  <LogOut aria-hidden /> {vi.user.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-dashboard px-6 pb-16 lg:px-8">{children}</main>
    </div>
  );
}

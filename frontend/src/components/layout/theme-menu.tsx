'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { vi } from '@/i18n/vi';
import { applyTheme, parseTheme, readThemeCookie, subscribeTheme, type ThemeChoice } from '@/lib/theme';

const serverTheme = (): ThemeChoice => 'system';

export function ThemeMenu() {
  // The cookie is the source of truth; the server snapshot is "system" so hydration always matches.
  const theme = useSyncExternalStore(subscribeTheme, readThemeCookie, serverTheme);

  // Follow OS changes while on "system".
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={vi.theme.label} className="text-ink-muted">
          <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{vi.theme.label}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => applyTheme(parseTheme(v))}>
          <DropdownMenuRadioItem value="system">{vi.theme.system}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">{vi.theme.light}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">{vi.theme.dark}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

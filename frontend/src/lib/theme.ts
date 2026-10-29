// Light/dark/system for the Study shell, without a theme library. The choice lives in a cookie so the
// server renders the right class (no flash); "system" is resolved by a tiny inline script before paint.
export type ThemeChoice = 'system' | 'light' | 'dark';
export const THEME_COOKIE = 'ielts_theme';

export function parseTheme(v: string | undefined): ThemeChoice {
  return v === 'light' || v === 'dark' ? v : 'system';
}

/** Runs in <head> before first paint (string is inlined, keep it dependency-free). */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(\\w+)/);var t=m?m[1]:'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

const THEME_EVENT = 'ielts-theme-change';

export function readThemeCookie(): ThemeChoice {
  const m = new RegExp(`(?:^|; )${THEME_COOKIE}=(\\w+)`).exec(document.cookie);
  return parseTheme(m?.[1]);
}

/** For useSyncExternalStore: notified when the user picks a theme in any component. */
export function subscribeTheme(onChange: () => void): () => void {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

export function applyTheme(choice: ThemeChoice): void {
  document.cookie = `${THEME_COOKIE}=${choice}; Path=/; Max-Age=31536000; SameSite=Lax`;
  const dark =
    choice === 'dark' || (choice === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  window.dispatchEvent(new Event(THEME_EVENT));
}

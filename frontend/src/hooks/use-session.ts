'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { isSessionError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { authService } from '@/services/auth.service';

/**
 * Current user. When the session is gone (refresh failed → the API cleared both cookies), send the user
 * to /login. The cookies are already cleared, so the proxy will not bounce them back (no redirect loop).
 */
export function useSession() {
  const router = useRouter();
  const pathname = usePathname();
  const query = useQuery({ queryKey: queryKeys.me, queryFn: authService.me });

  useEffect(() => {
    if (query.error && isSessionError(query.error)) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [query.error, pathname, router]);

  return query;
}

export function useLogout() {
  const router = useRouter();
  const qc = useQueryClient();
  return async () => {
    await authService.logout().catch(() => undefined);
    qc.clear();
    router.replace('/login');
  };
}

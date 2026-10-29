import { z } from 'zod';
import { api } from '@/lib/api-client';
import { AuthResponse, UserDto, type LoginBody, type UpdateMeBody } from '@/shared/auth';

export const authService = {
  login: (body: LoginBody) => api('/auth/login', { method: 'POST', body, schema: AuthResponse }),
  logout: () => api('/auth/logout', { method: 'POST', body: {} }),
  me: () => api('/auth/me', { schema: UserDto }),
  updateMe: (body: UpdateMeBody) => api('/auth/me', { method: 'PATCH', body, schema: UserDto }),
};

export const AdminOverview = z.object({
  users: z.number(),
  activeUsers: z.number(),
  tests: z.number(),
  publishedTests: z.number(),
});

export const adminService = {
  overview: () => api('/admin/overview', { schema: AdminOverview }),
};

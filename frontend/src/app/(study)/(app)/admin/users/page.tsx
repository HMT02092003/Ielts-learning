'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { viAdmin } from '@/i18n/vi-admin';
import { ApiError } from '@/lib/api-client';
import { usersApi } from '@/services/admin.service';
import type { UserAdminDto } from '@/shared/admin';

const t = viAdmin.users;
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Có lỗi xảy ra');
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN') : t.never);

function CreateUserDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const create = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      toast.success(t.created);
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    create.mutate({
      email: String(d.get('email')),
      displayName: String(d.get('displayName')),
      role: d.get('role') === 'ADMIN' ? 'ADMIN' : 'STUDENT',
      password: String(d.get('password')),
    });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t.create}</Button>
      </DialogTrigger>
      <DialogContent title={t.create}>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="u-email">{t.email}</Label>
            <Input id="u-email" name="email" type="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="u-name">{t.name}</Label>
            <Input id="u-name" name="displayName" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="u-role">{t.role}</Label>
            <NativeSelect id="u-role" name="role" defaultValue="STUDENT">
              <option value="STUDENT">{viAdmin.role.STUDENT}</option>
              <option value="ADMIN">{viAdmin.role.ADMIN}</option>
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="u-pass">{t.password}</Label>
            <Input id="u-pass" name="password" type="text" minLength={8} required />
          </div>
          <Button type="submit" loading={create.isPending}>
            {t.create}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user }: { user: UserAdminDto }) {
  const [open, setOpen] = useState(false);
  const reset = useMutation({
    mutationFn: (pw: string) => usersApi.resetPassword(user.id, pw),
    onSuccess: () => {
      toast.success(t.saved);
      setOpen(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          {t.reset}
        </Button>
      </DialogTrigger>
      <DialogContent title={t.reset} description={user.email}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            reset.mutate(String(new FormData(e.currentTarget).get('pw')));
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="pw">{t.newPassword}</Label>
            <Input id="pw" name="pw" type="text" minLength={8} required />
          </div>
          <Button type="submit" loading={reset.isPending}>
            {t.reset}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const users = useQuery({
    queryKey: ['admin', 'users', page, q],
    queryFn: () => usersApi.list({ page, q }),
    placeholderData: keepPreviousData,
  });
  const toggle = useMutation({
    mutationFn: (u: UserAdminDto) => usersApi.update(u.id, { isActive: !u.isActive }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
    onError: (e) => toast.error(errMsg(e)),
  });

  const columns: Column<UserAdminDto>[] = [
    {
      header: t.name,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.displayName}</span>
          <span className="text-caption text-ink-muted">{row.original.email}</span>
        </div>
      ),
    },
    {
      header: t.role,
      cell: ({ row }) => (
        <Badge variant={row.original.role === 'ADMIN' ? 'source-cam' : 'neutral'}>
          {viAdmin.role[row.original.role]}
        </Badge>
      ),
    },
    {
      header: t.active,
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge variant="success">{t.activeYes}</Badge>
        ) : (
          <Badge variant="danger">{t.activeNo}</Badge>
        ),
    },
    {
      header: t.lastLogin,
      cell: ({ row }) => <span className="text-ink-muted">{fmtDate(row.original.lastLoginAt)}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <ResetPasswordDialog user={row.original} />
          <Button variant="secondary" size="sm" onClick={() => toggle.mutate(row.original)}>
            {row.original.isActive ? t.lock : t.unlock}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-h2 font-light">{t.title}</h1>
        <CreateUserDialog />
      </div>
      <Input
        placeholder={t.search}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
        className="max-w-sm"
        aria-label={t.search}
      />
      <DataTable
        columns={columns}
        data={users.data?.items ?? []}
        total={users.data?.total}
        page={page}
        pageSize={users.data?.pageSize}
        onPageChange={setPage}
        loading={users.isPending}
      />
    </div>
  );
}

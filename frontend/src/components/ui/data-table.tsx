'use client';

// Admin table on TanStack Table (MIT). v9 ships a v8-compatible `useLegacyTable`; we use it with server-side
// pagination (the API returns { items, page, pageSize, total }).
import { flexRender } from '@tanstack/react-table';
import { getCoreRowModel, useLegacyTable, type LegacyColumnDef } from '@tanstack/react-table/legacy';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export type Column<T extends object> = LegacyColumnDef<T, unknown>;

interface DataTableProps<T extends object> {
  columns: Column<T>[];
  data: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: T) => void;
  empty?: string;
  loading?: boolean;
}

export function DataTable<T extends object>({
  columns,
  data,
  total,
  page = 1,
  pageSize = 20,
  onPageChange,
  onRowClick,
  empty = 'Chưa có dữ liệu',
  loading,
}: DataTableProps<T>) {
  const table = useLegacyTable<T>({ data, columns, getCoreRowModel: getCoreRowModel() });
  const pages = total === undefined ? 1 : Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full border-collapse text-left text-body">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border bg-surface-muted">
                {hg.headers.map((h) => (
                  <th key={h.id} scope="col" className="px-4 py-2.5 text-label-sm font-medium text-ink-muted">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(
                  'border-b border-divider last:border-0',
                  onRowClick && 'cursor-pointer hover:bg-background',
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-ink-muted">
                  {loading ? 'Đang tải…' : empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {onPageChange && total !== undefined && total > pageSize && (
        <div className="flex items-center justify-end gap-2 text-body text-ink-muted">
          <span>
            Trang {page}/{pages} · {total} mục
          </span>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Trang trước"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Trang sau"
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}

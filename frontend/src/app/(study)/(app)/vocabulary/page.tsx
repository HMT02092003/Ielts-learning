'use client';

// Vocabulary notebook (spec §6 P6): search, add / edit with a dictionary lookup (English definition +
// pronunciation from dictionaryapi.dev; the Vietnamese meaning is typed by the student), delete, start a review.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, Plus, Search, Trash2, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { vi } from '@/i18n/vi';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { dictionaryApi, vocabApi } from '@/services/study.service';
import type { DictionaryEntryDto, VocabularyDto } from '@/shared/study';

const STATE_LABEL = { NEW: 'Mới', LEARNING: 'Đang học', REVIEW: 'Ôn tập', RELEARNING: 'Học lại' } as const;

interface Form {
  term: string;
  meaning: string;
  definition: string;
  partOfSpeech: string;
  phonetic: string;
  exampleSentence: string;
  notes: string;
}

const empty: Form = {
  term: '',
  meaning: '',
  definition: '',
  partOfSpeech: '',
  phonetic: '',
  exampleSentence: '',
  notes: '',
};

function WordDialog({ word, onDone }: { word: VocabularyDto | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<Form>(() =>
    word
      ? {
          term: word.term,
          meaning: word.meaning ?? '',
          definition: word.definition ?? '',
          partOfSpeech: word.partOfSpeech ?? '',
          phonetic: word.phonetic ?? '',
          exampleSentence: word.exampleSentence ?? '',
          notes: word.notes ?? '',
        }
      : empty,
  );
  const [entry, setEntry] = useState<DictionaryEntryDto | null>(null);
  const set = (k: keyof Form) => (e: { target: { value: string } }) =>
    setF((o) => ({ ...o, [k]: e.target.value }));
  const lookup = useMutation({
    mutationFn: () => dictionaryApi.lookup(f.term),
    onSuccess: (d) => {
      setEntry(d);
      const m = d.meanings[0];
      setF((o) => ({
        ...o,
        phonetic: o.phonetic || d.phonetic || '',
        partOfSpeech: o.partOfSpeech || m?.partOfSpeech || '',
        definition: o.definition || m?.definitions[0]?.definition || '',
      }));
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Không tra được từ điển'),
  });
  const save = useMutation({
    mutationFn: () => {
      const body = {
        meaning: f.meaning || null,
        definition: f.definition || null,
        partOfSpeech: f.partOfSpeech || null,
        phonetic: f.phonetic || null,
        exampleSentence: f.exampleSentence || null,
        notes: f.notes || null,
      };
      return word ? vocabApi.update(word.id, body) : vocabApi.create({ term: f.term, ...body });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['vocabulary'] });
      toast.success(word ? 'Đã lưu' : 'Đã thêm vào sổ từ');
      onDone();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Không lưu được'),
  });

  return (
    <DialogContent title={word ? `Sửa “${word.term}”` : 'Thêm từ'} className="max-w-xl">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1 text-label">
            Từ / cụm từ
            <Input value={f.term} onChange={set('term')} disabled={!!word} required lang="en" />
          </label>
          <Button
            type="button"
            variant="secondary"
            onClick={() => lookup.mutate()}
            disabled={!f.term.trim() || lookup.isPending}
          >
            <Search className="size-4" aria-hidden /> Tra từ điển
          </Button>
        </div>
        {entry && (
          <div className="flex flex-col gap-1 rounded-lg bg-surface-muted p-3 text-body">
            <p className="flex items-center gap-2">
              <strong lang="en">{entry.term}</strong>{' '}
              {entry.phonetic && <span className="text-ink-muted">{entry.phonetic}</span>}
              {entry.audioUrl && (
                <button
                  type="button"
                  aria-label="Nghe phát âm"
                  onClick={() => void new Audio(entry.audioUrl ?? '').play()}
                >
                  <Volume2 className="size-4 text-ink-muted" aria-hidden />
                </button>
              )}
            </p>
            {entry.meanings.slice(0, 3).map((m, i) => (
              <p key={i} lang="en" className="text-label-sm">
                <em>{m.partOfSpeech}</em> — {m.definitions[0]?.definition}
              </p>
            ))}
            <p className="text-caption text-ink-muted">
              Nguồn: Wiktionary qua dictionaryapi.dev ({entry.license ?? 'CC BY-SA'})
            </p>
          </div>
        )}
        <label className="flex flex-col gap-1 text-label">
          Nghĩa tiếng Việt
          <Input value={f.meaning} onChange={set('meaning')} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-label">
            Từ loại
            <Input value={f.partOfSpeech} onChange={set('partOfSpeech')} lang="en" />
          </label>
          <label className="flex flex-col gap-1 text-label">
            Phiên âm
            <Input value={f.phonetic} onChange={set('phonetic')} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-label">
          Định nghĩa (tiếng Anh)
          <Textarea rows={2} value={f.definition} onChange={set('definition')} lang="en" />
        </label>
        <label className="flex flex-col gap-1 text-label">
          Câu ví dụ
          <Textarea rows={2} value={f.exampleSentence} onChange={set('exampleSentence')} lang="en" />
        </label>
        <label className="flex flex-col gap-1 text-label">
          Ghi chú
          <Textarea rows={2} value={f.notes} onChange={set('notes')} />
        </label>
        <div className="flex justify-end">
          <Button type="submit" disabled={save.isPending || !f.term.trim()}>
            {word ? 'Lưu' : 'Thêm từ'}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}

export default function VocabularyPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<VocabularyDto | 'new' | null>(null);
  const list = useQuery({
    queryKey: ['vocabulary', { q, page }],
    queryFn: () => vocabApi.list({ q: q || undefined, page }),
  });
  const due = useQuery({ queryKey: ['vocabulary', 'queue'], queryFn: () => vocabApi.queue() });
  const remove = useMutation({
    mutationFn: (id: string) => vocabApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['vocabulary'] }),
  });
  const dueCount = due.data?.cards.length ?? 0;

  return (
    <div className="flex flex-col gap-6 pt-8 pb-12">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="flex-1 font-display text-h1 font-extralight">Từ vựng</h1>
        <Link
          href="/vocabulary/review"
          aria-disabled={dueCount === 0}
          className={cn(
            buttonVariants({ variant: dueCount > 0 ? 'primary' : 'secondary' }),
            dueCount === 0 && 'pointer-events-none opacity-60',
          )}
        >
          <Layers className="size-4" aria-hidden /> Ôn thẻ ({dueCount})
        </Link>
        <Button variant="secondary" onClick={() => setEditing('new')}>
          <Plus className="size-4" aria-hidden /> Thêm từ
        </Button>
      </div>
      <label className="relative max-w-md">
        <span className="sr-only">Tìm từ</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
          aria-hidden
        />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Tìm từ…"
          className="pl-9"
        />
      </label>
      {list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : !list.data ? (
        <p className="text-body text-ink-muted">{vi.common.loading}</p>
      ) : list.data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Layers strokeWidth={1.75} aria-hidden />}
            title={q ? 'Không tìm thấy từ nào' : 'Sổ từ đang trống'}
            body="Bôi đen một từ trong bài đọc (chế độ luyện tập hoặc màn xem lại) và bấm “Lưu từ”, hoặc thêm tay ở đây."
          />
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[720px] text-body">
              <thead>
                <tr className="border-b border-border text-left text-label text-ink-muted">
                  <th className="px-4 py-3 font-medium">Từ</th>
                  <th className="px-4 py-3 font-medium">Nghĩa</th>
                  <th className="px-4 py-3 font-medium">Ví dụ</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((w) => (
                  <tr key={w.id} className="border-b border-divider align-top last:border-0">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-left font-semibold hover:underline"
                        onClick={() => setEditing(w)}
                        lang="en"
                      >
                        {w.term}
                      </button>
                      <span className="block text-label-sm text-ink-muted">
                        {[w.partOfSpeech, w.phonetic].filter(Boolean).join(' · ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">{w.meaning ?? <span className="text-ink-subtle">—</span>}</td>
                    <td
                      className="max-w-sm px-4 py-3 font-reading text-label-sm text-ink-secondary italic"
                      lang="en"
                    >
                      {w.exampleSentence}
                      {w.sourceTestTitle && (
                        <span className="block font-sans not-italic text-ink-muted">{w.sourceTestTitle}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={w.state === 'REVIEW' ? 'success' : w.state === 'NEW' ? 'neutral' : 'warning'}
                      >
                        {STATE_LABEL[w.state]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Xóa ${w.term}`}
                        onClick={() => remove.mutate(w.id)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.data.total > list.data.pageSize && (
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Trang trước
              </Button>
              <span className="text-label-sm text-ink-muted">
                Trang {page}/{Math.ceil(list.data.total / list.data.pageSize)}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page * list.data.pageSize >= list.data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Trang sau
              </Button>
            </div>
          )}
        </>
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing !== null && (
          <WordDialog
            key={editing === 'new' ? 'new' : editing.id}
            word={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>
    </div>
  );
}

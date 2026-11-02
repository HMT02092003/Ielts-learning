'use client';

// Upload an image / audio file to the media library and reference it by fileId in the doc.
import { useMutation } from '@tanstack/react-query';
import { Upload, X } from 'lucide-react';
import { useId, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api-client';
import type { FileRefIn } from '@/lib/builder/types';
import { fileUrl, filesApi } from '@/services/admin.service';
import { useBuilder } from './context';

/** Duration of a local audio file (ms), read from its metadata. */
function audioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0);
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => {
      resolve(0);
      URL.revokeObjectURL(url);
    };
    audio.src = url;
  });
}

export const fileIdOf = (ref: FileRefIn | undefined | null) => (ref && 'fileId' in ref ? ref.fileId : null);

export function FilePicker({
  kind,
  label,
  value,
  onChange,
  optional,
}: {
  kind: 'image' | 'audio';
  label: string;
  value: FileRefIn | undefined | null;
  /** `durationMs` is set for audio uploads. */
  onChange: (ref: FileRefIn | undefined, durationMs?: number) => void;
  optional?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const { readOnly } = useBuilder();
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const [dto, durationMs] = await Promise.all([
        filesApi.upload(file, kind === 'image' ? 'TEST_IMAGE' : 'TEST_AUDIO'),
        kind === 'audio' ? audioDuration(file) : Promise.resolve(undefined),
      ]);
      return { dto, durationMs };
    },
    onSuccess: ({ dto, durationMs }) => onChange({ fileId: dto.id }, durationMs),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Tải file thất bại'),
  });
  const fileId = fileIdOf(value);
  const legacyPath = value && 'path' in value ? value.path : null;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {fileId && kind === 'image' && (
        // eslint-disable-next-line @next/next/no-img-element -- authenticated API file, not a static asset
        <img
          src={fileUrl(fileId)}
          alt=""
          className="max-h-56 w-fit rounded-lg border border-border object-contain"
        />
      )}
      {fileId && kind === 'audio' && (
        <audio controls preload="metadata" src={fileUrl(fileId)} className="w-full" />
      )}
      {legacyPath && (
        <p className="text-caption text-warning-ink">
          File theo đường dẫn {legacyPath} — tải lại để xem trước.
        </p>
      )}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={id}
            ref={input}
            type="file"
            className="sr-only"
            accept={
              kind === 'image'
                ? 'image/png,image/jpeg,image/webp'
                : 'audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg'
            }
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={upload.isPending}
            onClick={() => input.current?.click()}
          >
            <Upload className="size-4" aria-hidden />{' '}
            {value ? 'Thay file' : kind === 'image' ? 'Tải ảnh lên' : 'Tải audio lên'}
          </Button>
          {value && optional && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
              <X className="size-4" aria-hidden /> Bỏ file
            </Button>
          )}
          <span className="text-caption text-ink-subtle">
            {kind === 'image' ? 'PNG, JPG, WebP' : 'MP3, M4A, WAV, OGG'}
          </span>
        </div>
      )}
    </div>
  );
}

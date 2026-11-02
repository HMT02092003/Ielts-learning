'use client';

// Small form building blocks for the test builder (all styling through design tokens).
import { ArrowDown, ArrowUp, ClipboardPaste, Plus, Trash2 } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { WORD_LIMIT_PRESETS, wordLimitText } from '@/lib/builder/templates';
import { useBuilder } from './context';

export function Field({
  label,
  hint,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-caption text-ink-subtle">{hint}</p>}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  className,
  lang,
  disabled,
}: {
  label: ReactNode;
  value: string | undefined;
  onChange: (v: string) => void;
  hint?: ReactNode;
  placeholder?: string;
  className?: string;
  lang?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const { readOnly } = useBuilder();
  return (
    <Field label={label} hint={hint} className={className} htmlFor={id}>
      <Input
        id={id}
        lang={lang}
        value={value ?? ''}
        placeholder={placeholder}
        readOnly={readOnly || disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function AreaField({
  label,
  value,
  onChange,
  hint,
  rows = 3,
  placeholder,
  className,
  lang = 'en',
  actions,
}: {
  label: ReactNode;
  value: string | undefined;
  onChange: (v: string) => void;
  hint?: ReactNode;
  rows?: number;
  placeholder?: string;
  className?: string;
  lang?: string;
  actions?: ReactNode;
}) {
  const id = useId();
  const { readOnly } = useBuilder();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {actions}
      </div>
      <Textarea
        id={id}
        lang={lang}
        rows={rows}
        value={value ?? ''}
        placeholder={placeholder}
        readOnly={readOnly}
        className="min-h-0"
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="text-caption text-ink-subtle">{hint}</p>}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
  className,
}: {
  label: ReactNode;
  value: number | undefined;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  hint?: ReactNode;
  className?: string;
}) {
  const id = useId();
  const { readOnly } = useBuilder();
  return (
    <Field label={label} hint={hint} className={className} htmlFor={id}>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value ?? ''}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      />
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
  className,
}: {
  label: ReactNode;
  value: T | undefined;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  hint?: ReactNode;
  className?: string;
}) {
  const id = useId();
  const { readOnly } = useBuilder();
  return (
    <Field label={label} hint={hint} className={className} htmlFor={id}>
      <NativeSelect
        id={id}
        value={value ?? ''}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {value === undefined && <option value="">—</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  const { readOnly } = useBuilder();
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} disabled={readOnly} onCheckedChange={(v) => onChange(v === true)} />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  );
}

const wlKey = (wl: { maxWords: number; allowNumber?: boolean }) => `${wl.maxWords}:${wl.allowNumber ? 1 : 0}`;

export function WordLimitField({
  value,
  onChange,
}: {
  value: { maxWords: number; allowNumber?: boolean } | undefined;
  onChange: (v: { maxWords: number; allowNumber: boolean }) => void;
}) {
  const options = WORD_LIMIT_PRESETS.map((p) => ({ value: wlKey(p), label: wordLimitText(p) }));
  return (
    <SelectField
      label="Giới hạn số từ"
      hint={
        <>
          Mọi đáp án (kể cả đáp án chấp nhận thêm) phải nằm trong giới hạn này. Viết{' '}
          <code className="font-mono">(the) museum</code> để chấp nhận cả “the museum” lẫn “museum”.
        </>
      }
      value={value ? wlKey(value) : undefined}
      options={options}
      onChange={(k) => {
        const [w, n] = k.split(':');
        onChange({ maxWords: Number(w), allowNumber: n === '1' });
      }}
    />
  );
}

/** Small square icon button used in list rows. */
export function IconButton({
  label,
  onClick,
  children,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-ink-muted outline-none transition-colors hover:bg-surface-muted focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-40',
        danger && 'hover:text-danger',
      )}
    >
      {children}
    </button>
  );
}

/** Move / delete controls for an item at `index` of a list of `length`. */
export function RowControls({
  index,
  length,
  onMove,
  onRemove,
  minLength = 0,
  noun = 'mục',
}: {
  index: number;
  length: number;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
  minLength?: number;
  noun?: string;
}) {
  const { readOnly } = useBuilder();
  if (readOnly) return null;
  return (
    <div className="flex shrink-0 items-center">
      <IconButton label={`Đưa ${noun} lên`} disabled={index === 0} onClick={() => onMove(index, index - 1)}>
        <ArrowUp className="size-4" aria-hidden />
      </IconButton>
      <IconButton
        label={`Đưa ${noun} xuống`}
        disabled={index === length - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <ArrowDown className="size-4" aria-hidden />
      </IconButton>
      <IconButton label={`Xóa ${noun}`} danger disabled={length <= minLength} onClick={onRemove}>
        <Trash2 className="size-4" aria-hidden />
      </IconButton>
    </div>
  );
}

export function move<T>(list: T[], from: number, to: number): void {
  if (to < 0 || to >= list.length) return;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item as T);
}

export function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  const { readOnly } = useBuilder();
  if (readOnly) return null;
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick} className="self-start">
      <Plus className="size-4" aria-hidden /> {children}
    </Button>
  );
}

/** "Dán nhanh" dialog: a textarea and an apply button; `onApply` returns an error message or null. */
export function PasteButton({
  label,
  title,
  description,
  placeholder,
  onApply,
}: {
  label: string;
  title: string;
  description: ReactNode;
  placeholder: string;
  onApply: (text: string) => string | null;
}) {
  const { readOnly } = useBuilder();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  if (readOnly) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <ClipboardPaste className="size-4" aria-hidden /> {label}
      </Button>
      <DialogContent title={title} description={description} className="max-w-2xl">
        <Label htmlFor={id} className="sr-only">
          {title}
        </Label>
        <Textarea
          id={id}
          lang="en"
          rows={12}
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          className="font-mono text-label"
        />
        {error && <p className="text-body text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Hủy
          </Button>
          <Button
            type="button"
            onClick={() => {
              const err = onApply(text);
              if (err) setError(err);
              else {
                setText('');
                setOpen(false);
              }
            }}
          >
            Áp dụng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Textarea with an "insert blank" button: inserts {{0}} at the cursor; the builder renumbers it into the next
 * question number right away.
 */
export function BlankArea({
  label,
  value,
  onChange,
  rows = 4,
  hint,
  single,
}: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  hint?: ReactNode;
  /** one-line input (table cells, flow-chart steps, sentence prompts) */
  single?: boolean;
}) {
  const id = useId();
  const { readOnly } = useBuilder();
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  function insert() {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const pad = before && !/\s$/.test(before) ? ' ' : '';
    onChange(`${before}${pad}{{0}}${value.slice(end)}`);
    requestAnimationFrame(() => el?.focus());
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {!readOnly && (
          <Button type="button" variant="ghost" size="sm" onClick={insert}>
            <Plus className="size-4" aria-hidden /> Chèn ô trống
          </Button>
        )}
      </div>
      {single ? (
        <Input
          id={id}
          ref={ref}
          lang="en"
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Textarea
          id={id}
          ref={ref}
          lang="en"
          rows={rows}
          value={value}
          readOnly={readOnly}
          className="min-h-0"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {hint && <p className="text-caption text-ink-subtle">{hint}</p>}
    </div>
  );
}

/** Editable list of strings (Speaking questions, cue-card bullets, accepted answers…). */
export function StringList({
  label,
  items,
  onChange,
  addLabel,
  placeholder,
  minItems = 0,
  lang = 'en',
}: {
  label: ReactNode;
  items: string[];
  onChange: (items: string[]) => void;
  addLabel: string;
  placeholder?: string;
  minItems?: number;
  lang?: string;
}) {
  const { readOnly } = useBuilder();
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-6 shrink-0 text-right text-label-sm text-ink-subtle">{i + 1}.</span>
          <Input
            lang={lang}
            aria-label={`${typeof label === 'string' ? label : 'Mục'} ${i + 1}`}
            value={it}
            placeholder={placeholder}
            readOnly={readOnly}
            onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))}
          />
          <RowControls
            index={i}
            length={items.length}
            minLength={minItems}
            onMove={(from, to) => {
              const next = [...items];
              move(next, from, to);
              onChange(next);
            }}
            onRemove={() => onChange(items.filter((_, k) => k !== i))}
          />
        </div>
      ))}
      <AddButton onClick={() => onChange([...items, ''])}>{addLabel}</AddButton>
    </div>
  );
}

/** Key + text option rows (A–H, i–xv). Keys are re-lettered automatically after add / remove / move. */
export function OptionList({
  label,
  options,
  onChange,
  keyStyle = 'letter',
  min = 2,
  max = 15,
  hint,
  extra,
}: {
  label: ReactNode;
  options: { key: string; text: string }[];
  onChange: (options: { key: string; text: string }[]) => void;
  keyStyle?: 'letter' | 'roman';
  min?: number;
  max?: number;
  hint?: ReactNode;
  extra?: ReactNode;
}) {
  const { readOnly } = useBuilder();
  const rekey = (list: { key: string; text: string }[]) =>
    list.map((o, i) => ({
      ...o,
      key: keyStyle === 'roman' ? (ROMAN_KEYS[i] ?? String(i + 1)) : String.fromCharCode(65 + i),
    }));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>{label}</Label>
        {extra}
      </div>
      {hint && <p className="-mt-1 text-caption text-ink-subtle">{hint}</p>}
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-8 shrink-0 text-center font-mono text-label font-semibold text-ink-secondary">
            {o.key}
          </span>
          <Input
            lang="en"
            aria-label={`Lựa chọn ${o.key}`}
            value={o.text}
            readOnly={readOnly}
            onChange={(e) => onChange(options.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))}
          />
          <RowControls
            index={i}
            length={options.length}
            minLength={min}
            noun="lựa chọn"
            onMove={(from, to) => {
              const next = [...options];
              move(next, from, to);
              onChange(rekey(next));
            }}
            onRemove={() => onChange(rekey(options.filter((_, k) => k !== i)))}
          />
        </div>
      ))}
      {options.length < max && (
        <AddButton onClick={() => onChange(rekey([...options, { key: '', text: '' }]))}>
          Thêm lựa chọn
        </AddButton>
      )}
    </div>
  );
}

const ROMAN_KEYS = [
  'i',
  'ii',
  'iii',
  'iv',
  'v',
  'vi',
  'vii',
  'viii',
  'ix',
  'x',
  'xi',
  'xii',
  'xiii',
  'xiv',
  'xv',
];

/** Pill radio group for choosing an answer key (TRUE/FALSE/NG, A–D…). */
export function KeyPicker({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: string | undefined;
  choices: { key: string; label: string }[];
  onChange: (key: string) => void;
}) {
  const { readOnly } = useBuilder();
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {choices.map((c) => {
        const on = value === c.key;
        return (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={readOnly}
            onClick={() => onChange(c.key)}
            className={cn(
              'min-h-8 rounded-md border px-2.5 text-label font-medium outline-none transition-colors focus-visible:shadow-focus',
              on
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border-strong bg-surface text-ink-secondary hover:border-ink-muted',
            )}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

export function SectionTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider pb-2">
      <h3 className="text-title-sm font-semibold">{children}</h3>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

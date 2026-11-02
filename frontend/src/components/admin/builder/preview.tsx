'use client';

// Right column: what the student will see for the current selection, rendered with the real exam components.
import { QuestionGroupView } from '@/components/exam/questions';
import { questionCount } from '@/lib/builder/numbering';
import { toContentGroup } from '@/lib/builder/preview';
import type { Group, Paragraph } from '@/lib/builder/types';
import { fileUrl } from '@/services/admin.service';
import { useBuilder } from './context';
import { fileIdOf } from './file-picker';
import { SHORT_TYPE } from './outline';

function Groups({ groups, prefix, labels }: { groups: Group[]; prefix: string; labels: string[] }) {
  return (
    <div className="flex flex-col gap-8">
      {groups.map((g, k) => (
        <QuestionGroupView key={k} group={toContentGroup(g, `${prefix}-${k}`)} paragraphLabels={labels} />
      ))}
    </div>
  );
}

function PassageText({
  title,
  subtitle,
  paragraphs,
}: {
  title: string;
  subtitle?: string;
  paragraphs: Paragraph[];
}) {
  return (
    <article lang="en" className="flex flex-col gap-3 font-reading">
      <h3 className="text-center text-h3 font-semibold">{title || 'Chưa có tiêu đề'}</h3>
      {subtitle && <p className="text-center text-body text-ink-muted italic">{subtitle}</p>}
      {paragraphs.map((p, i) => {
        if (p.kind === 'HEADING')
          return (
            <h4 key={i} className="font-sans text-title-sm font-semibold">
              {p.text}
            </h4>
          );
        if (p.kind === 'SUBHEADING')
          return (
            <h5 key={i} className="font-sans text-body font-semibold">
              {p.text}
            </h5>
          );
        if (p.kind === 'FOOTNOTE')
          return (
            <p key={i} className="text-caption text-ink-muted">
              {p.text}
            </p>
          );
        const img = fileIdOf(p.image);
        return (
          <div key={i} className="flex gap-3">
            {p.label && <strong className="w-5 shrink-0 font-sans">{p.label}</strong>}
            <div className="flex flex-col gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API file */}
              {img && <img src={fileUrl(img)} alt="" className="max-w-full rounded-lg" />}
              <p className="text-body-lg leading-relaxed whitespace-pre-line">{p.text}</p>
            </div>
          </div>
        );
      })}
    </article>
  );
}

export function Preview() {
  const { doc, sel } = useBuilder();

  if (sel.kind === 'group') {
    const sec = sel.skill === 'reading' ? doc.reading?.passages[sel.i] : doc.listening?.parts[sel.i];
    const g = sec?.groups[sel.g];
    if (!sec || !g) return null;
    const labels = 'paragraphs' in sec ? sec.paragraphs.flatMap((p) => (p.label ? [p.label] : [])) : [];
    return <Groups groups={[g]} prefix={`pv-${sel.skill}-${sel.i}-${sel.g}`} labels={labels} />;
  }

  if (sel.kind === 'passage') {
    const p = doc.reading?.passages[sel.i];
    if (!p) return null;
    const labels = p.paragraphs.flatMap((x) => (x.label ? [x.label] : []));
    return (
      <div className="flex flex-col gap-8">
        {p.instructions && <p className="rounded-lg bg-surface-muted p-3 text-body">{p.instructions}</p>}
        <PassageText title={p.title} subtitle={p.subtitle} paragraphs={p.paragraphs} />
        <hr className="border-divider" />
        <Groups groups={p.groups} prefix={`pv-r-${sel.i}`} labels={labels} />
      </div>
    );
  }

  if (sel.kind === 'lpart') {
    const p = doc.listening?.parts[sel.i];
    if (!p) return null;
    const audio = fileIdOf(p.audio.file);
    return (
      <div className="flex flex-col gap-6">
        <h3 className="text-h3 font-semibold">{p.title || `Part ${sel.i + 1}`}</h3>
        {audio ? (
          <audio controls preload="metadata" src={fileUrl(audio)} className="w-full" />
        ) : (
          <p className="text-body text-warning-ink">Chưa có audio.</p>
        )}
        {p.instructions && <p className="text-body">{p.instructions}</p>}
        <Groups groups={p.groups} prefix={`pv-l-${sel.i}`} labels={[]} />
      </div>
    );
  }

  if (sel.kind === 'writing') {
    const t = doc.writing?.tasks[sel.i];
    if (!t) return null;
    const img = fileIdOf(t.image);
    return (
      <div lang="en" className="flex flex-col gap-4">
        <h3 className="font-sans text-h3 font-semibold">Writing Task {t.task}</h3>
        <p className="text-body text-ink-muted">
          You should spend about {t.suggestedMinutes} minutes on this task.
        </p>
        <div className="rounded-xl border border-border p-4 text-body-lg whitespace-pre-line">
          {t.prompt || '…'}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API file */}
        {img && <img src={fileUrl(img)} alt="" className="max-w-full rounded-lg border border-border" />}
        <p className="text-body text-ink-muted">Write at least {t.minWords} words.</p>
      </div>
    );
  }

  if (sel.kind === 'speaking') {
    const p = doc.speaking?.parts[sel.i];
    if (!p) return null;
    if (p.part === 2) {
      return (
        <div lang="en" className="flex flex-col gap-3 rounded-xl border border-border p-5">
          <p className="text-title-sm font-semibold">{p.cueCard.topic}</p>
          <p className="text-body">You should say:</p>
          <ul className="flex list-disc flex-col gap-1 pl-6 text-body">
            {p.cueCard.bullets.map((b, k) => (
              <li key={k}>{b}</li>
            ))}
          </ul>
          {p.cueCard.closing && <p className="text-body">{p.cueCard.closing}</p>}
          <p className="text-caption text-ink-muted">
            Chuẩn bị {p.prepSeconds ?? 60}s · nói {p.speakSeconds ?? 120}s
          </p>
        </div>
      );
    }
    return (
      <div lang="en" className="flex flex-col gap-3">
        <h3 className="font-sans text-h3 font-semibold">
          Part {p.part}
          {p.topic ? ` — ${p.topic}` : ''}
        </h3>
        <ol className="flex list-decimal flex-col gap-2 pl-6 text-body-lg">
          {p.questions.map((q, k) => (
            <li key={k}>{q}</li>
          ))}
        </ol>
      </div>
    );
  }

  // meta: overview of the test
  const typeCounts = new Map<string, number>();
  for (const s of [...(doc.reading?.passages ?? []), ...(doc.listening?.parts ?? [])])
    for (const g of s.groups)
      typeCounts.set(SHORT_TYPE[g.type], (typeCounts.get(SHORT_TYPE[g.type]) ?? 0) + g.questions.length);
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-h3 font-semibold">{doc.title || 'Đề chưa đặt tên'}</h3>
      <dl className="grid grid-cols-2 gap-3">
        {doc.reading && (
          <div className="rounded-xl bg-surface-muted p-3">
            <dt className="text-caption text-ink-muted">Reading</dt>
            <dd className="text-title-sm font-semibold">{questionCount(doc.reading.passages)}/40 câu</dd>
          </div>
        )}
        {doc.listening && (
          <div className="rounded-xl bg-surface-muted p-3">
            <dt className="text-caption text-ink-muted">Listening</dt>
            <dd className="text-title-sm font-semibold">{questionCount(doc.listening.parts)}/40 câu</dd>
          </div>
        )}
        {doc.writing && (
          <div className="rounded-xl bg-surface-muted p-3">
            <dt className="text-caption text-ink-muted">Writing</dt>
            <dd className="text-title-sm font-semibold">{doc.writing.tasks.length} task</dd>
          </div>
        )}
        {doc.speaking && (
          <div className="rounded-xl bg-surface-muted p-3">
            <dt className="text-caption text-ink-muted">Speaking</dt>
            <dd className="text-title-sm font-semibold">{doc.speaking.parts.length} part</dd>
          </div>
        )}
      </dl>
      {typeCounts.size > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-label font-medium">Phân bố dạng câu hỏi</span>
          <ul className="flex flex-col gap-1">
            {[...typeCounts].map(([t, n]) => (
              <li key={t} className="flex justify-between text-body">
                <span>{t}</span>
                <span className="font-mono text-ink-muted">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!doc.reading && !doc.listening && !doc.writing && !doc.speaking && (
        <p className="text-body text-ink-muted">Bật ít nhất một kỹ năng ở cột giữa để bắt đầu soạn.</p>
      )}
    </div>
  );
}

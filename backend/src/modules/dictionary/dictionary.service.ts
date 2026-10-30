// Dictionary lookup proxy (spec §6 P6): Free Dictionary API (dictionaryapi.dev, Wiktionary content under
// CC BY-SA) with a DB cache and a short timeout. Vietnamese meanings are typed by the student, never fetched.
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../lib/errors';
import { normalizeTerm, type DictionaryEntryDto } from '../../shared/study';

const PROVIDER = 'dictionaryapi.dev';

interface ApiEntry {
  word?: string;
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  meanings?: {
    partOfSpeech?: string;
    definitions?: { definition?: string; example?: string }[];
    synonyms?: string[];
  }[];
  license?: { name?: string };
  sourceUrls?: string[];
}

function toEntry(term: string, raw: ApiEntry[], cached: boolean): DictionaryEntryDto {
  const first = raw[0] ?? {};
  const phonetics = raw.flatMap((e) => e.phonetics ?? []);
  return {
    term: first.word ?? term,
    phonetic: first.phonetic ?? phonetics.find((p) => p.text)?.text ?? null,
    audioUrl: phonetics.find((p) => p.audio)?.audio || null,
    meanings: raw
      .flatMap((e) => e.meanings ?? [])
      .slice(0, 6)
      .map((m) => ({
        partOfSpeech: m.partOfSpeech ?? '',
        definitions: (m.definitions ?? [])
          .slice(0, 3)
          .map((d) => ({ definition: d.definition ?? '', example: d.example ?? null })),
        synonyms: (m.synonyms ?? []).slice(0, 6),
      })),
    sourceUrl: first.sourceUrls?.[0] ?? null,
    license: first.license?.name ?? null,
    cached,
  };
}

export const dictionaryService = {
  async lookup(termRaw: string, fetchImpl: typeof fetch = fetch): Promise<DictionaryEntryDto> {
    const term = normalizeTerm(termRaw);
    const hit = await prisma.dictionaryCache.findUnique({
      where: { provider_term: { provider: PROVIDER, term } },
    });
    if (hit && hit.expiresAt > new Date()) {
      if (Array.isArray(hit.payload) && hit.payload.length === 0) {
        throw new AppError('NOT_FOUND', `Không tìm thấy “${term}”`);
      }
      return toEntry(term, hit.payload as ApiEntry[], true);
    }
    let res: Response;
    try {
      res = await fetchImpl(`${env.DICTIONARY_URL}/${encodeURIComponent(term)}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(env.DICTIONARY_TIMEOUT_MS),
      });
    } catch (e) {
      const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
      throw new AppError(
        timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
        'Không tra được từ điển lúc này',
      );
    }
    const expiresAt = new Date(Date.now() + env.DICTIONARY_CACHE_DAYS * 86_400_000);
    if (res.status === 404) {
      // Negative results are cached too (an empty list), so typos do not hit the API again.
      await prisma.dictionaryCache.upsert({
        where: { provider_term: { provider: PROVIDER, term } },
        create: { provider: PROVIDER, term, payload: [], expiresAt },
        update: { payload: [], expiresAt },
      });
      throw new AppError('NOT_FOUND', `Không tìm thấy “${term}”`);
    }
    if (!res.ok) throw new AppError('UPSTREAM_UNAVAILABLE', `Từ điển trả lỗi ${res.status}`);
    const json: unknown = await res.json();
    if (!Array.isArray(json)) throw new AppError('UPSTREAM_UNAVAILABLE', 'Từ điển trả dữ liệu không hợp lệ');
    const payload = json as Prisma.InputJsonArray;
    const raw = json as ApiEntry[];
    await prisma.dictionaryCache.upsert({
      where: { provider_term: { provider: PROVIDER, term } },
      create: { provider: PROVIDER, term, payload, expiresAt },
      update: { payload, expiresAt },
    });
    return toEntry(term, raw, false);
  },
};

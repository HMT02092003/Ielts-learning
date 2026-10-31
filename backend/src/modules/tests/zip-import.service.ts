// Import tests from a .zip (the format zip-export.service writes, or any zip of test JSON + assets/).
// Every entry is checked before anything is written; then each test goes through the normal import on its own,
// so one invalid test does not block the others. Imports are always new DRAFT versions.
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import yauzl from 'yauzl';
import { env, resolveFromBackend } from '../../config/env';
import { AppError } from '../../lib/errors';
import type { ValidationIssue } from '../../shared/errors';
import type { ZipImportItemDto, ZipImportResultDto } from '../../shared/test-sets';
import { testsService, type UploadedAsset } from './tests.service';

export const ZIP_MAX_ENTRIES = 2000;
const ALLOWED_EXT = new Set(['.json', '.png', '.jpg', '.jpeg', '.webp', '.mp3', '.m4a', '.wav', '.ogg']);
const MANIFEST = 'bandup-export.json';

const invalid = (entry: string, message: string) =>
  new AppError('IMPORT_INVALID', 'File .zip không hợp lệ', {
    issues: [{ path: entry, code: 'zip_entry', message }],
  });

/** Reason an entry name is refused, or null when it is safe. */
function entryProblem(name: string): string | null {
  if (name.startsWith('/') || name.startsWith('\\') || /^[A-Za-z]:/.test(name)) return 'Đường dẫn tuyệt đối';
  if (name.split(/[\\/]/).some((seg) => seg === '..')) return 'Đường dẫn chứa ".."';
  if (name.endsWith('/')) return null; // directory
  if (!ALLOWED_EXT.has(path.posix.extname(name).toLowerCase())) return 'Loại file không được nhận';
  return null;
}

function openZip(zipPath: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: false, validateEntrySizes: true }, (err, zip) => {
      if (err) reject(new AppError('IMPORT_INVALID', 'File .zip không đọc được'));
      else resolve(zip);
    });
  });
}

/** All entries, validated (names, types, count, declared total size) before any byte is extracted. */
function listEntries(zip: yauzl.ZipFile): Promise<yauzl.Entry[]> {
  const maxBytes = env.UPLOAD_MAX_ZIP_MB * 1_048_576;
  return new Promise((resolve, reject) => {
    const entries: yauzl.Entry[] = [];
    let total = 0;
    zip.on('entry', (entry: yauzl.Entry) => {
      const problem = entryProblem(entry.fileName);
      if (problem) {
        reject(invalid(entry.fileName, problem));
        return;
      }
      if (entries.length >= ZIP_MAX_ENTRIES) {
        reject(invalid('', `Quá ${ZIP_MAX_ENTRIES} file trong một .zip`));
        return;
      }
      total += entry.uncompressedSize;
      if (total > maxBytes) {
        reject(invalid(entry.fileName, `Dữ liệu giải nén vượt quá ${env.UPLOAD_MAX_ZIP_MB} MB`));
        return;
      }
      if (!entry.fileName.endsWith('/')) entries.push(entry);
      zip.readEntry();
    });
    zip.on('end', () => resolve(entries));
    zip.on('error', () => reject(new AppError('IMPORT_INVALID', 'File .zip không đọc được')));
    zip.readEntry();
  });
}

function extractEntry(zip: yauzl.ZipFile, entry: yauzl.Entry, target: string): Promise<void> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, stream) => {
      if (err) {
        reject(invalid(entry.fileName, 'Không giải nén được'));
        return;
      }
      fsp
        .mkdir(path.dirname(target), { recursive: true })
        .then(() => pipeline(stream, fs.createWriteStream(target)))
        .then(resolve, () => reject(invalid(entry.fileName, 'Không giải nén được')));
    });
  });
}

interface ZipTest {
  file: string;
  jsonPath: string;
  assets: UploadedAsset[];
}

/** Which JSON files are tests: the manifest's list, else every <folder>/test.json and every root *.json. */
async function findTests(dir: string, names: string[]): Promise<string[]> {
  if (names.includes(MANIFEST)) {
    const manifest = JSON.parse(await fsp.readFile(path.join(dir, MANIFEST), 'utf8')) as { tests?: unknown };
    if (Array.isArray(manifest.tests)) {
      return manifest.tests.filter((t): t is string => typeof t === 'string' && names.includes(t));
    }
  }
  return names.filter((n) => n !== MANIFEST && (/^[^/]+\/test\.json$/.test(n) || /^[^/]+\.json$/.test(n)));
}

export const zipImportService = {
  /** Extract a zip into a fresh temp dir; the caller removes `dir`. */
  async extract(zipPath: string): Promise<{ dir: string; tests: ZipTest[] }> {
    const zip = await openZip(zipPath);
    const dir = path.join(resolveFromBackend(env.UPLOAD_TMP_DIR), `zip-${randomUUID()}`);
    try {
      const entries = await listEntries(zip);
      for (const e of entries) await extractEntry(zip, e, path.join(dir, ...e.fileName.split('/')));
      const names = entries.map((e) => e.fileName);
      const tests = (await findTests(dir, names)).map((file) => {
        const folder = path.posix.dirname(file) === '.' ? '' : `${path.posix.dirname(file)}/`;
        const assets = names
          .filter((n) => n.startsWith(`${folder}assets/`))
          .map((n) => ({ path: path.join(dir, ...n.split('/')), originalname: path.posix.basename(n) }));
        return { file, jsonPath: path.join(dir, ...file.split('/')), assets };
      });
      return { dir, tests };
    } catch (err) {
      await fsp.rm(dir, { recursive: true, force: true });
      throw err;
    } finally {
      zip.close();
    }
  },

  async importZip(zipPath: string, actorId: string, dryRun: boolean): Promise<ZipImportResultDto> {
    const { dir, tests } = await this.extract(zipPath);
    try {
      if (tests.length === 0) throw invalid('', 'Không tìm thấy file JSON đề nào trong .zip');
      const items: ZipImportItemDto[] = [];
      for (const t of tests) items.push(await importOne(t, actorId, dryRun));
      return { items };
    } finally {
      await fsp.rm(dir, { recursive: true, force: true });
    }
  },
};

async function importOne(t: ZipTest, actorId: string, dryRun: boolean): Promise<ZipImportItemDto> {
  let raw: unknown;
  try {
    raw = JSON.parse(await fsp.readFile(t.jsonPath, 'utf8'));
  } catch (err) {
    return {
      seriesKey: null,
      file: t.file,
      ok: false,
      issues: [issue('', 'invalid_json', (err as Error).message)],
    };
  }
  const key = (raw as { seriesKey?: unknown } | null)?.seriesKey;
  const seriesKey = typeof key === 'string' ? key : null;
  try {
    if (dryRun) {
      testsService.validate(raw);
      return { seriesKey, file: t.file, ok: true };
    }
    const { testId } = await testsService.importNew(raw, t.assets, actorId);
    return { seriesKey, file: t.file, ok: true, ...(testId ? { testId } : {}) };
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    const issues = (err.details as { issues?: ValidationIssue[] } | undefined)?.issues;
    return { seriesKey, file: t.file, ok: false, issues: issues ?? [issue('', err.code, err.message)] };
  }
}

const issue = (p: string, code: string, message: string): ValidationIssue => ({ path: p, code, message });

import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { AppError } from '../errors';
import { STORAGE_KEY_RE, type ByteRange, type Storage, type StoredObjectStat } from './storage';

export class LocalDiskStorage implements Storage {
  constructor(private readonly root: string) {}

  /** Resolve a key inside root; rejects traversal (works with Windows paths too). */
  private resolve(key: string): string {
    if (!STORAGE_KEY_RE.test(key)) throw new AppError('VALIDATION_ERROR', 'Storage key không hợp lệ');
    const abs = path.resolve(this.root, key);
    const rel = path.relative(this.root, abs);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new AppError('VALIDATION_ERROR', 'Storage key không hợp lệ');
    }
    return abs;
  }

  async put(key: string, data: Readable | Buffer): Promise<StoredObjectStat> {
    const target = this.resolve(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    // Write to a temp file then rename, so readers never see a half-written file.
    const tmp = `${target}.${randomUUID()}.tmp`;
    try {
      await pipeline(Buffer.isBuffer(data) ? Readable.from([data]) : data, createWriteStream(tmp));
      await fs.rename(tmp, target);
    } catch (err) {
      await fs.rm(tmp, { force: true });
      throw err;
    }
    const st = await fs.stat(target);
    return { sizeBytes: st.size };
  }

  getStream(key: string, range?: ByteRange): Promise<Readable> {
    const file = this.resolve(key);
    return Promise.resolve(createReadStream(file, range ? { start: range.start, end: range.end } : {}));
  }

  async stat(key: string): Promise<StoredObjectStat | null> {
    try {
      const st = await fs.stat(this.resolve(key));
      return { sizeBytes: st.size };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }

  async check(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
    await fs.access(this.root, fs.constants.W_OK);
  }
}

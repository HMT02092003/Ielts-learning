import type { Readable } from 'node:stream';

export interface ByteRange {
  start: number;
  end: number; // inclusive
}

export interface StoredObjectStat {
  sizeBytes: number;
}

/** All file I/O goes through this interface (spec §7) so the driver can be swapped (local disk now, S3 later). */
export interface Storage {
  /** Write the whole stream; resolves once durably stored. Keys are server-generated. */
  put(key: string, data: Readable | Buffer): Promise<StoredObjectStat>;
  getStream(key: string, range?: ByteRange): Promise<Readable>;
  stat(key: string): Promise<StoredObjectStat | null>;
  delete(key: string): Promise<void>;
  /** Liveness probe for /health/ready. */
  check(): Promise<void>;
}

/** Only lower-case letters, digits and / . _ - ; no "..", no leading slash. */
export const STORAGE_KEY_RE = /^(?!.*\.\.)[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/;

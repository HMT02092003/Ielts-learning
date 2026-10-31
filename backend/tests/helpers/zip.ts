import type { Response } from 'superagent';
import yauzl from 'yauzl';
import yazl from 'yazl';

/** All entries of a zip, by path. */
export function readZip(buf: Buffer): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buf, { lazyEntries: true }, (err, zip) => {
      if (err) {
        reject(err);
        return;
      }
      const out = new Map<string, Buffer>();
      zip.on('entry', (entry: yauzl.Entry) => {
        zip.openReadStream(entry, (e, stream) => {
          if (e) {
            reject(e);
            return;
          }
          const chunks: Buffer[] = [];
          stream.on('data', (c: Buffer) => chunks.push(c));
          stream.on('end', () => {
            out.set(entry.fileName, Buffer.concat(chunks));
            zip.readEntry();
          });
        });
      });
      zip.on('end', () => resolve(out));
      zip.on('error', reject);
      zip.readEntry();
    });
  });
}

/** Build a zip in memory; entry names are used verbatim (tests use this to craft hostile names). */
export function makeZip(entries: Record<string, Buffer | string>): Promise<Buffer> {
  const zip = new yazl.ZipFile();
  for (const [name, data] of Object.entries(entries)) {
    zip.addBuffer(Buffer.isBuffer(data) ? data : Buffer.from(data), name, { forceZip64Format: false });
  }
  zip.end();
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    zip.outputStream.on('data', (c: Buffer) => chunks.push(c));
    zip.outputStream.on('end', () => resolve(Buffer.concat(chunks)));
    zip.outputStream.on('error', reject);
  });
}

/** supertest parser that keeps a binary body as a Buffer. */
export function binary(res: Response, cb: (err: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

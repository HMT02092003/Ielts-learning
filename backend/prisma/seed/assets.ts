// Seed assets generated in code (no binary files in git, no third-party content — spec §3).
import { deflateSync, crc32 } from 'node:zlib';

/** 16-bit PCM mono WAV: a quiet 440 Hz tone with 1 s of silence every 4 s (stands in for recorded audio). */
export function makeToneWav(durationMs: number, sampleRate = 8000): Buffer {
  const samples = Math.round((durationMs / 1000) * sampleRate);
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const audible = t % 4 < 3;
    const v = audible ? Math.round(Math.sin(2 * Math.PI * 440 * t) * 0.2 * 32767) : 0;
    data.writeInt16LE(v, i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

type Rgb = readonly [number, number, number];

class Canvas {
  readonly pixels: Buffer;
  constructor(
    readonly width: number,
    readonly height: number,
    bg: Rgb,
  ) {
    this.pixels = Buffer.alloc(width * height * 3);
    this.rect(0, 0, width, height, bg);
  }
  rect(x: number, y: number, w: number, h: number, c: Rgb) {
    for (let yy = Math.max(0, y); yy < Math.min(this.height, y + h); yy++) {
      for (let xx = Math.max(0, x); xx < Math.min(this.width, x + w); xx++) {
        const o = (yy * this.width + xx) * 3;
        this.pixels[o] = c[0];
        this.pixels[o + 1] = c[1];
        this.pixels[o + 2] = c[2];
      }
    }
  }
  toPng(): Buffer {
    const raw = Buffer.alloc((this.width * 3 + 1) * this.height);
    for (let y = 0; y < this.height; y++) {
      raw[y * (this.width * 3 + 1)] = 0; // filter: none
      this.pixels.copy(raw, y * (this.width * 3 + 1) + 1, y * this.width * 3, (y + 1) * this.width * 3);
    }
    const chunk = (type: string, body: Buffer) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(body.length);
      const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(crc32(typed));
      return Buffer.concat([len, typed, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.width, 0);
    ihdr.writeUInt32BE(this.height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // colour type: RGB
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

const INK: Rgb = [19, 32, 28];
const GRID: Rgb = [227, 231, 235];

/** Writing Task 1: grouped bar chart of fictional ferry passenger numbers (3 routes × 5 years). */
export function makeFerryChartPng(): Buffer {
  const c = new Canvas(800, 500, [255, 255, 255]);
  const left = 80;
  const bottom = 440;
  for (let i = 0; i <= 5; i++) c.rect(left, bottom - i * 70, 680, 1, GRID);
  c.rect(left, 60, 2, bottom - 60, INK);
  c.rect(left, bottom, 680, 2, INK);
  const series: Rgb[] = [
    [31, 94, 75],
    [168, 85, 31],
    [30, 78, 140],
  ];
  const values = [
    [120, 150, 180, 210, 260],
    [200, 190, 170, 140, 120],
    [80, 90, 140, 200, 230],
  ];
  values.forEach((row, s) =>
    row.forEach((v, year) => {
      const x = left + 30 + year * 130 + s * 32;
      c.rect(x, bottom - v * 1.3, 28, v * 1.3, series[s] ?? INK);
    }),
  );
  return c.toPng();
}

/** Listening map: fictional park layout; option letters are drawn by the UI at the option coordinates. */
export function makeParkMapPng(): Buffer {
  const c = new Canvas(800, 560, [238, 241, 243]);
  c.rect(40, 40, 720, 480, [214, 232, 214]); // park
  c.rect(300, 180, 200, 120, [180, 210, 235]); // lake
  c.rect(40, 270, 720, 20, [210, 200, 180]); // main path
  c.rect(390, 40, 20, 480, [210, 200, 180]); // north–south path
  c.rect(60, 60, 120, 80, [200, 200, 200]); // building
  c.rect(620, 400, 120, 90, [200, 200, 200]); // building
  c.rect(380, 500, 40, 20, INK); // main gate
  return c.toPng();
}

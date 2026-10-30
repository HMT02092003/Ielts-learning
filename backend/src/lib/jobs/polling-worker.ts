import { logger } from '../../config/logger';

export interface PollingWorkerOptions {
  name: string;
  intervalMs: number;
  /** Do one unit of work. Return true when work was found (the next tick runs immediately). */
  tick: (signal: AbortSignal) => Promise<boolean>;
}

/** In-process background loop, concurrency 1 (spec §6 P2: simple queue, never blocks a request). */
export class PollingWorker {
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<void> | null = null;
  private readonly abort = new AbortController();
  private stopped = false;
  private started = false;

  constructor(private readonly opts: PollingWorkerOptions) {}

  start(): void {
    this.started = true;
    this.schedule(0);
  }

  /** Run as soon as possible (e.g. right after a job is queued). No-op unless start() was called. */
  nudge(): void {
    if (this.started && !this.stopped && !this.running) this.schedule(0);
  }

  private schedule(ms: number): void {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.running = this.loop().finally(() => {
        this.running = null;
      });
    }, ms);
  }

  private async loop(): Promise<void> {
    let more = true;
    while (more && !this.stopped) {
      try {
        more = await this.opts.tick(this.abort.signal);
      } catch (err) {
        logger.error({ err, worker: this.opts.name }, 'worker tick failed');
        more = false;
      }
    }
    this.schedule(this.opts.intervalMs);
  }

  async stop(timeoutMs = 10_000): Promise<void> {
    this.stopped = true;
    this.abort.abort();
    if (this.timer) clearTimeout(this.timer);
    if (this.running) {
      await Promise.race([this.running, new Promise((r) => setTimeout(r, timeoutMs))]);
    }
  }
}

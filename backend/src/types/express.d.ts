import type { Role } from '../shared/enums';

declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticate`. */
      user?: { id: string; role: Role };
    }
    interface Locals {
      /** Set by `validate()`: parsed params/query/body. */
      validated?: { params?: unknown; query?: unknown; body?: unknown };
    }
  }
}

export {};

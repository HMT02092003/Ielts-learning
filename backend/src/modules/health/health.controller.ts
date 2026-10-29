import type { RequestHandler } from 'express';
import { healthService } from './health.service';

export const live: RequestHandler = (_req, res) => {
  res.json(healthService.liveness());
};

export const ready: RequestHandler = async (_req, res) => {
  const result = await healthService.readiness();
  res.status(result.status === 'down' ? 503 : 200).json(result);
};

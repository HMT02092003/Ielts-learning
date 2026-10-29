import type { RequestHandler } from 'express';
import { adminService } from './admin.service';

export const overview: RequestHandler = async (_req, res) => {
  res.json(await adminService.overview());
};

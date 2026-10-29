import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { AppError } from '../lib/errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence in depth (cookies are SameSite already): state-changing requests coming from a browser
 * must originate from the web app. Non-browser clients (no Origin / Sec-Fetch-Site) are allowed — they
 * cannot carry the victim's cookies.
 */
export const originGuard: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const site = req.get('sec-fetch-site');
  const origin = req.get('origin');
  const crossSite = site !== undefined && site !== 'same-origin' && site !== 'same-site' && site !== 'none';
  const foreignOrigin = origin !== undefined && origin !== env.WEB_ORIGIN;
  if (crossSite || foreignOrigin) {
    next(new AppError('FORBIDDEN', 'Yêu cầu bị chặn (nguồn không hợp lệ)'));
    return;
  }
  next();
};

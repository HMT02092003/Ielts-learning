import { Router } from 'express';
import { z } from 'zod';
import { ChangePasswordBody, LoginBody, UpdateMeBody } from '../../shared/auth';
import { authenticate } from '../../middlewares/authenticate';
import { loginLimiter } from '../../middlewares/rate-limit';
import { validate } from '../../middlewares/validate';
import * as auth from './auth.controller';

const EmptyBody = z.strictObject({});

export const authRouter = Router();

authRouter.post('/login', loginLimiter, validate({ body: LoginBody }), auth.login);
authRouter.post('/refresh', validate({ body: EmptyBody }), auth.refresh);
authRouter.post('/logout', validate({ body: EmptyBody }), auth.logout);
authRouter.post('/logout-all', authenticate, validate({ body: EmptyBody }), auth.logoutAll);
authRouter.get('/me', authenticate, validate({}), auth.me);
authRouter.patch('/me', authenticate, validate({ body: UpdateMeBody }), auth.updateMe);
authRouter.post(
  '/change-password',
  authenticate,
  validate({ body: ChangePasswordBody }),
  auth.changePassword,
);

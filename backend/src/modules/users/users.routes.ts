import { Router } from 'express';
import { authenticate, requireRole } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import {
  CreateUserBody,
  IdParams,
  ListUsersQuery,
  ResetPasswordBody,
  UpdateUserBody,
} from '../../shared/admin';
import * as users from './users.controller';

/** Mounted at /admin/users. No public sign-up and no DELETE (users are deactivated, never removed). */
export const usersRouter = Router();

usersRouter.use(authenticate, requireRole('ADMIN'));
usersRouter.get('/', validate({ query: ListUsersQuery }), users.list);
usersRouter.post('/', validate({ body: CreateUserBody }), users.create);
usersRouter.get('/:id', validate({ params: IdParams }), users.get);
usersRouter.patch('/:id', validate({ params: IdParams, body: UpdateUserBody }), users.update);
usersRouter.post(
  '/:id/reset-password',
  validate({ params: IdParams, body: ResetPasswordBody }),
  users.resetPassword,
);

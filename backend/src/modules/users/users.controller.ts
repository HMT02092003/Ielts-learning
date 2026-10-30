import type { Request, RequestHandler } from 'express';
import { validated } from '../../middlewares/validate';
import { AppError } from '../../lib/errors';
import type {
  CreateUserBody,
  IdParams,
  ListUsersQuery,
  ResetPasswordBody,
  UpdateUserBody,
} from '../../shared/admin';
import { usersService } from './users.service';

const actorId = (req: Request) => {
  if (!req.user) throw new AppError('UNAUTHENTICATED', 'Bạn cần đăng nhập');
  return req.user.id;
};

export const list: RequestHandler = async (_req, res) => {
  res.json(await usersService.list(validated<ListUsersQuery>(res, 'query')));
};

export const get: RequestHandler = async (_req, res) => {
  res.json(await usersService.get(validated<IdParams>(res, 'params').id));
};

export const create: RequestHandler = async (_req, res) => {
  res.status(201).json(await usersService.create(validated<CreateUserBody>(res, 'body')));
};

export const update: RequestHandler = async (req, res) => {
  const { id } = validated<IdParams>(res, 'params');
  res.json(await usersService.update(actorId(req), id, validated<UpdateUserBody>(res, 'body')));
};

export const resetPassword: RequestHandler = async (_req, res) => {
  await usersService.resetPassword(
    validated<IdParams>(res, 'params').id,
    validated<ResetPasswordBody>(res, 'body'),
  );
  res.status(204).end();
};

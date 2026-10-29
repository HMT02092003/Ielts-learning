import { Router } from 'express';
import { authenticate, requireRole } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import * as admin from './admin.controller';

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole('ADMIN'));
adminRouter.get('/overview', validate({}), admin.overview);

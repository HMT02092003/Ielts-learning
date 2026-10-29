import { Router } from 'express';
import { validate } from '../../middlewares/validate';
import * as health from './health.controller';

export const healthRouter = Router();

healthRouter.get('/', validate({}), health.live);
healthRouter.get('/ready', validate({}), health.ready);

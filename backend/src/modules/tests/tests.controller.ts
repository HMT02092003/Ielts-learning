import fs from 'node:fs/promises';
import type { Request, RequestHandler } from 'express';
import { env } from '../../config/env';
import { uploadedFiles } from '../../middlewares/upload';
import { validated } from '../../middlewares/validate';
import { AppError } from '../../lib/errors';
import type {
  AdminListTestsQuery,
  HotfixQuestionBody,
  IdParams,
  ReplaceTestContentBody,
  UpdateTestMetaBody,
} from '../../shared/admin';
import { testsService } from './tests.service';
import { zipExportService } from './zip-export.service';

const actorId = (req: Request) => {
  if (!req.user) throw new AppError('UNAUTHENTICATED', 'Bạn cần đăng nhập');
  return req.user.id;
};

/** multipart "files": one *.json test document + any assets it references by `assets/<name>`. */
async function readImportUpload(req: Request) {
  const files = uploadedFiles(req);
  const json = files.find((f) => f.originalname.toLowerCase().endsWith('.json'));
  if (!json) throw new AppError('VALIDATION_ERROR', 'Thiếu file .json của đề');
  if (json.size > env.IMPORT_MAX_JSON_MB * 1_048_576) {
    throw new AppError('FILE_TOO_LARGE', `File JSON vượt quá ${env.IMPORT_MAX_JSON_MB} MB`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(json.path, 'utf8'));
  } catch (err) {
    throw new AppError('IMPORT_INVALID', 'File JSON không đọc được', {
      issues: [{ path: '', code: 'invalid_json', message: (err as Error).message }],
    });
  }
  const assets = files.filter((f) => f !== json).map((f) => ({ path: f.path, originalname: f.originalname }));
  return { raw, assets };
}

export const list: RequestHandler = async (_req, res) => {
  res.json(await testsService.list(validated<AdminListTestsQuery>(res, 'query')));
};

export const get: RequestHandler = async (_req, res) => {
  res.json(await testsService.get(validated<IdParams>(res, 'params').id));
};

export const questions: RequestHandler = async (_req, res) => {
  res.json(await testsService.questions(validated<IdParams>(res, 'params').id));
};

export const validateImport: RequestHandler = async (req, res) => {
  const { raw } = await readImportUpload(req);
  res.json(testsService.validate(raw));
};

export const importNew: RequestHandler = async (req, res) => {
  const { raw, assets } = await readImportUpload(req);
  res.status(201).json(await testsService.importNew(raw, assets, actorId(req)));
};

export const replaceContent: RequestHandler = async (req, res) => {
  const { id } = validated<IdParams>(res, 'params');
  const { doc } = validated<ReplaceTestContentBody>(res, 'body');
  res.json(await testsService.replaceContent(id, doc, actorId(req)));
};

export const updateMeta: RequestHandler = async (_req, res) => {
  const { id } = validated<IdParams>(res, 'params');
  res.json(await testsService.updateMeta(id, validated<UpdateTestMetaBody>(res, 'body')));
};

export const publish: RequestHandler = async (req, res) => {
  res.json(await testsService.publish(validated<IdParams>(res, 'params').id, actorId(req)));
};

export const unpublish: RequestHandler = async (_req, res) => {
  res.json(await testsService.unpublish(validated<IdParams>(res, 'params').id));
};

export const clone: RequestHandler = async (req, res) => {
  res.status(201).json(await testsService.clone(validated<IdParams>(res, 'params').id, actorId(req)));
};

export const remove: RequestHandler = async (_req, res) => {
  await testsService.remove(validated<IdParams>(res, 'params').id);
  res.status(204).end();
};

export const hotfix: RequestHandler = async (_req, res) => {
  const { id, questionId } = validated<{ id: string; questionId: string }>(res, 'params');
  await testsService.hotfixQuestion(id, questionId, validated<HotfixQuestionBody>(res, 'body'));
  res.status(204).end();
};

export const exportZip: RequestHandler = async (_req, res) => {
  const { id } = validated<IdParams>(res, 'params');
  const fileName = await zipExportService.testFileName(id);
  res.attachment(fileName).type('application/zip');
  await zipExportService.streamZip([id], res);
};

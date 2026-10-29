import { env, resolveFromBackend } from '../../config/env';
import { LocalDiskStorage } from './local-disk.storage';
import type { Storage } from './storage';

export type { Storage } from './storage';

export const storage: Storage = new LocalDiskStorage(resolveFromBackend(env.STORAGE_LOCAL_ROOT));

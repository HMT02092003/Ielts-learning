import argon2, { type Options } from 'argon2';
import { env } from '../../config/env';

// argon2 pinned to 0.44.0: the 0.45.x win32-x64 prebuild crashes on load (segfault) on Node 20 / Windows.
const options: Options = {
  type: argon2.argon2id,
  memoryCost: env.ARGON2_MEMORY_KIB,
  timeCost: env.ARGON2_TIME_COST,
  parallelism: env.ARGON2_PARALLELISM,
};

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, options);
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export function passwordNeedsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, options);
}

let dummyHash: Promise<string> | undefined;

/** Verified when the email does not exist, so response time does not reveal which emails are registered. */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword('dummy-password-for-timing');
  await argon2.verify(await dummyHash, password);
  return false;
}

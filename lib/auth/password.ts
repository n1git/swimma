import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;
const TEMP_PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateTempPassword(length = 10): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += TEMP_PASSWORD_CHARS[randomInt(TEMP_PASSWORD_CHARS.length)];
  }
  return out;
}

let dummyHash: Promise<string> | null = null;

export async function verifyPasswordOrDummy(password: string, hash: string | null | undefined): Promise<boolean> {
  if (hash) return verifyPassword(password, hash);
  dummyHash ??= bcrypt.hash("dummy-password-for-timing", SALT_ROUNDS);
  await verifyPassword(password, await dummyHash);
  return false;
}

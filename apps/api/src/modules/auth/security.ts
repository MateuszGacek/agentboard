import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";

const bcryptCostFactor = 12;

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, bcryptCostFactor);
}

export async function verifyPassword(password: string, storedHash: string) {
  return bcrypt.compare(password, storedHash);
}

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const deriveKey = promisify(scrypt);
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password) {
  if (typeof password !== "string" || !password) {
    throw new Error("Пароль не может быть пустым");
  }
  const salt = randomBytes(16).toString("hex");
  const key = await deriveKey(password, salt, 64, options);
  return `scrypt$32768$8$1$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(password, hash) {
  if (typeof password !== "string" || typeof hash !== "string") return false;
  const match = /^scrypt\$32768\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(hash);
  if (!match) return false;
  const key = await deriveKey(password, match[1], 64, options);
  return timingSafeEqual(key, Buffer.from(match[2], "hex"));
}

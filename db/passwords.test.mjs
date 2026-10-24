import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "./passwords.mjs";

test("scrypt uses random salts and verifies exact passwords", async () => {
  const password = " пароль 🔑 ";
  const first = await hashPassword(password);
  assert.notEqual(first, await hashPassword(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword(password.trim(), first), false);
  assert.equal(await verifyPassword("wrong", first), false);
});

test("empty passwords and malformed hashes are rejected", async () => {
  await assert.rejects(hashPassword(""));
  await assert.rejects(hashPassword(null));
  for (const hash of [null, "", "garbage", "scrypt$999999999$8$1$aa$bb"]) {
    assert.equal(await verifyPassword("password", hash), false);
  }
});

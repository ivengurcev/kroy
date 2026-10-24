import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { pool } from "./client.mjs";
import { createUser, findUserByEmail } from "./users.mjs";
import { verifyPassword } from "./passwords.mjs";

test("user creation, lookup and concurrent duplicate protection", async () => {
  assert.equal(process.env.PGDATABASE, "kroy_users_test", "Run only against the isolated test database");
  const email = `${randomUUID()}@example.org`;
  try {
    const created = await createUser({ email: ` ${email.toUpperCase()} `, password: "test password" });
    assert.equal(created.email, email);
    assert.equal(created.is_superadmin, false);
    assert.equal(created.status, "active");
    assert.ok(created.created_at);
    assert.equal("password_hash" in created, false);
    const found = await findUserByEmail(` ${email.toUpperCase()} `);
    assert.equal(found.id, created.id);
    assert.equal(await verifyPassword("test password", found.password_hash), true);
    assert.equal(await findUserByEmail(`missing-${email}`), null);
    await assert.rejects(createUser({ email, password: "other" }), { code: "EMAIL_EXISTS" });
    assert.equal((await findUserByEmail(email)).password_hash, found.password_hash);
    const root = await createUser({ email: `root-${email}`, password: "root password", is_superadmin: true });
    assert.equal(root.is_superadmin, true);
    const outcomes = await Promise.allSettled([
      createUser({ email: `race-${email}`, password: "one" }),
      createUser({ email: ` RACE-${email.toUpperCase()} `, password: "two" }),
    ]);
    assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(outcomes.find(result => result.status === "rejected").reason.code, "EMAIL_EXISTS");
    await assert.rejects(createUser({ email: " ", password: "test" }));
    await assert.rejects(createUser({ email, password: "test", is_superadmin: "false" }));
  } finally {
    await pool.end();
  }
});

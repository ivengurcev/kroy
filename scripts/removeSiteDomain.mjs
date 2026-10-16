import { pool } from "../db/client.mjs";
import isValidHostname from "./isValidHostname.mjs";

const [slug, hostname] = process.argv.slice(2);
let client;

try {
  if (!slug || !hostname) {
    throw new Error("Использование: yarn site:domain:remove <slug> <hostname>");
  }

  if (!isValidHostname(hostname)) {
    throw new Error("Некорректное доменное имя");
  }

  client = await pool.connect();
  await client.query("BEGIN");

  const {
    rows: [site],
  } = await client.query(
    "SELECT id FROM sites WHERE slug = $1 FOR UPDATE",
    [slug],
  );

  if (!site) {
    throw new Error(`Сайт со slug ${slug} не найден`);
  }

  const {
    rows: [domain],
  } = await client.query(
    "SELECT id, site_id FROM domains WHERE hostname = $1",
    [hostname],
  );

  if (!domain || domain.site_id !== site.id) {
    throw new Error(`Домен ${hostname} не принадлежит сайту ${slug}`);
  }

  const {
    rows: [{ count }],
  } = await client.query(
    "SELECT COUNT(*)::integer AS count FROM domains WHERE site_id = $1",
    [site.id],
  );

  if (count <= 1) {
    throw new Error("Нельзя удалить последний домен сайта");
  }

  await client.query("DELETE FROM domains WHERE id = $1", [domain.id]);
  await client.query("COMMIT");
  console.log(`Домен ${hostname} удалён у сайта ${slug}`);
} catch (error) {
  await client?.query("ROLLBACK").catch(() => {});
  console.error(`Не удалось удалить домен: ${error.message}`);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}

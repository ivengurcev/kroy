import { pool } from "../db/client.mjs";
import isValidHostname from "./isValidHostname.mjs";

const [slug, hostname] = process.argv.slice(2);

try {
  if (!slug || !hostname) {
    throw new Error("Использование: yarn site:domain:add <slug> <hostname>");
  }

  if (!isValidHostname(hostname)) {
    throw new Error("Некорректное доменное имя");
  }

  const {
    rows: [site],
  } = await pool.query("SELECT id FROM sites WHERE slug = $1", [slug]);

  if (!site) {
    throw new Error(`Сайт со slug ${slug} не найден`);
  }

  const {
    rows: [domain],
  } = await pool.query(
    "SELECT site_id FROM domains WHERE hostname = $1",
    [hostname],
  );

  if (domain?.site_id === site.id) {
    console.log(`Домен ${hostname} уже привязан к сайту ${slug}`);
  } else if (domain) {
    throw new Error(`Домен ${hostname} уже занят другим сайтом`);
  } else {
    await pool.query(
      `INSERT INTO domains (site_id, hostname)
       VALUES ($1, $2)`,
      [site.id, hostname],
    );
    console.log(`Домен ${hostname} добавлен к сайту ${slug}`);
  }
} catch (error) {
  if (error.code === "23505") {
    console.error(`Не удалось добавить домен: ${hostname} уже занят`);
  } else {
    console.error(`Не удалось добавить домен: ${error.message}`);
  }
  process.exitCode = 1;
} finally {
  await pool.end();
}

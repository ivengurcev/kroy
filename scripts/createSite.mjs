import { pool } from "../db/client.mjs";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCAL_HOSTNAME_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+localhost$/;
const [slug, hostname, providedName] = process.argv.slice(2);
const name = (providedName ?? slug)?.trim();
let client;

try {
  if (!slug || !hostname) {
    throw new Error("Использование: yarn site:create <slug> <hostname> [name]");
  }

  if (!SLUG_PATTERN.test(slug)) {
    throw new Error("Slug должен быть в формате kebab-case");
  }

  if (!LOCAL_HOSTNAME_PATTERN.test(hostname)) {
    throw new Error("Домен должен быть локальным поддоменом *.localhost");
  }

  if (!name) {
    throw new Error("Название сайта не может быть пустым");
  }

  client = await pool.connect();
  await client.query("BEGIN");

  const siteExists = await client.query(
    "SELECT 1 FROM sites WHERE slug = $1",
    [slug],
  );

  if (siteExists.rowCount > 0) {
    throw new Error(`Сайт со slug ${slug} уже существует`);
  }

  const domainExists = await client.query(
    "SELECT 1 FROM domains WHERE hostname = $1",
    [hostname],
  );

  if (domainExists.rowCount > 0) {
    throw new Error(`Домен ${hostname} уже занят`);
  }

  const {
    rows: [site],
  } = await client.query(
    `INSERT INTO sites (slug, name)
     VALUES ($1, $2)
     RETURNING id, slug, name`,
    [slug, name],
  );

  await client.query(
    `INSERT INTO domains (site_id, hostname)
     VALUES ($1, $2)`,
    [site.id, hostname],
  );

  await client.query(
    `INSERT INTO pages (site_id, path, title, content, deleted_at)
     VALUES ($1, '/', $2, '[]'::jsonb, NULL)`,
    [site.id, name],
  );

  await client.query("COMMIT");
  console.log(`Создан сайт: ${site.slug}`);
  console.log(`Название: ${site.name}`);
  console.log(`Домен: ${hostname}`);
} catch (error) {
  await client?.query("ROLLBACK").catch(() => {});

  if (error.code === "23505") {
    console.error("Не удалось создать сайт: slug или домен уже занят");
  } else {
    console.error(`Не удалось создать сайт: ${error.message}`);
  }

  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}

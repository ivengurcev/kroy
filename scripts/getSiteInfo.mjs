import { pool } from "../db/client.mjs";

const [slug] = process.argv.slice(2);

try {
  if (!slug) {
    throw new Error("Использование: yarn site:info <slug>");
  }

  const {
    rows: [site],
  } = await pool.query(
    `SELECT s.id,
            s.slug,
            s.name,
            COALESCE(
              (SELECT array_agg(d.hostname ORDER BY d.hostname)
               FROM domains d
               WHERE d.site_id = s.id),
              ARRAY[]::text[]
            ) AS domains,
            (SELECT COUNT(*)::integer
             FROM pages p
             WHERE p.site_id = s.id AND p.deleted_at IS NULL) AS active_pages,
            (SELECT COUNT(*)::integer
             FROM pages p
             WHERE p.site_id = s.id AND p.deleted_at IS NOT NULL) AS deleted_pages,
            (SELECT COUNT(*)::integer
             FROM redirects r
             WHERE r.site_id = s.id) AS redirects
     FROM sites s
     WHERE s.slug = $1`,
    [slug],
  );

  if (!site) {
    throw new Error(`Сайт со slug ${slug} не найден`);
  }

  console.log(`UUID: ${site.id}`);
  console.log(`Slug: ${site.slug}`);
  console.log(`Название: ${site.name}`);
  console.log(`Домены: ${site.domains.join(", ") || "—"}`);
  console.log(`Активных страниц: ${site.active_pages}`);
  console.log(`Удалённых страниц: ${site.deleted_pages}`);
  console.log(`Редиректов: ${site.redirects}`);
} catch (error) {
  console.error(`Не удалось получить информацию о сайте: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}

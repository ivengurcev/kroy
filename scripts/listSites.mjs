import { pool } from "../db/client.mjs";

try {
  const { rows: sites } = await pool.query(
    `SELECT s.slug,
            s.name,
            COALESCE(
              array_agg(DISTINCT d.hostname ORDER BY d.hostname)
                FILTER (WHERE d.hostname IS NOT NULL),
              ARRAY[]::text[]
            ) AS domains,
            COUNT(DISTINCT p.id)
              FILTER (WHERE p.deleted_at IS NULL)::integer AS active_pages
     FROM sites s
     LEFT JOIN domains d ON d.site_id = s.id
     LEFT JOIN pages p ON p.site_id = s.id
     GROUP BY s.id
     ORDER BY s.slug`,
  );

  if (sites.length === 0) {
    console.log("Сайтов пока нет.");
  } else {
    console.table(
      sites.map((site) => ({
        Slug: site.slug,
        Название: site.name,
        Домены: site.domains.join(", ") || "—",
        "Активных страниц": site.active_pages,
      })),
    );
  }
} catch (error) {
  console.error(`Не удалось получить список сайтов: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}

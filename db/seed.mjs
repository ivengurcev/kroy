import pageContent from "../demo/page.json" with { type: "json" };
import { pool } from "./client.mjs";

const client = await pool.connect();

try {
  await client.query("BEGIN");

  await client.query(
    `INSERT INTO sites (slug, name)
     VALUES ($1, $2)
     ON CONFLICT (slug) DO NOTHING`,
    ["demo", "Демонстрационный сайт"],
  );

  const {
    rows: [{ id: siteId }],
  } = await client.query("SELECT id FROM sites WHERE slug = $1", ["demo"]);

  await client.query(
    `INSERT INTO pages (site_id, path, title, content)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (site_id, path) DO NOTHING`,
    [siteId, "/", "Главная", JSON.stringify(pageContent)],
  );

  await client.query("COMMIT");
  console.log("Demo data is ready.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}

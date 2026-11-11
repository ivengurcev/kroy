import partCatalog from "../../dist/kroy/parts.json" with { type: "json" };
import widgetCatalog from "../../dist/kroy/widgets.json" with { type: "json" };
import { pool } from "../../db/client.mjs";
import getHostname from "./getHostname.mjs";
import isUuid from "./isUuid.mjs";
import { isPlainObject, validateContent } from "../../shared/pageContent.mjs";

export default async function putPage(c) {
  const pageId = c.req.param("pageId");

  if (!isUuid(pageId)) {
    return c.json({ error: "Invalid UUID", details: [{ path: "pageId", code: "invalid_format", message: "Некорректный идентификатор страницы." }] }, 400);
  }

  let body;

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request", details: [{ path: "body", code: "invalid_json", message: "Тело запроса должно содержать корректный JSON." }] }, 400);
  }

  const details = isPlainObject(body)
    ? validateContent(body.content, partCatalog, widgetCatalog)
    : [{ path: "content", code: "invalid_format", message: "Тело запроса должно быть объектом." }];
  if (details.length) {
    return c.json({ error: "Invalid content", details }, 400);
  }

  const hostname = getHostname(c);
  if (!hostname) return c.json({ error: "Page not found", details: [] }, 404);

  const sectionIds = [];
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const { rows: [page] } = await client.query(
      `SELECT p.site_id, p.page_type, p.data_source
       FROM pages p
       JOIN domains d ON d.site_id = p.site_id
       WHERE p.id = $1 AND p.deleted_at IS NULL AND d.hostname = $2
       FOR UPDATE OF p`,
      [pageId, hostname],
    );
    if (!page) {
      await client.query('ROLLBACK');
      return c.json({ error: 'Page not found', details: [] }, 404);
    }

    for (const [index, block] of body.content.entries()) {
      if (block.part !== '@kroy/material-list') continue;
      const sectionId = block.props.sectionId;
      if (sectionId === '' || sectionId === null || sectionId === undefined) {
        if (page.page_type === 'list' && page.data_source === 'materials') continue;
        await client.query('ROLLBACK');
        return c.json({ error: 'Select a material section for this block', details: [{ path: `content[${index}].props.sectionId`, code: 'required', message: 'Выберите раздел материалов.' }] }, 400);
      }
      if (!isUuid(sectionId)) {
        await client.query('ROLLBACK');
        return c.json({ error: 'Invalid material section', details: [{ path: 'content', code: 'invalid_section', message: 'Раздел материалов отсутствует или недоступен на этом сайте.' }] }, 400);
      }
      sectionIds.push(sectionId);
    }

    const uniqueSectionIds = [...new Set(sectionIds)];
    if (uniqueSectionIds.length) {
      const { rows } = await client.query(
        `SELECT id FROM material_sections
         WHERE site_id = $1 AND id = ANY($2::uuid[])
         FOR KEY SHARE`,
        [page.site_id, uniqueSectionIds],
      );
      if (rows.length !== uniqueSectionIds.length) {
        await client.query('ROLLBACK');
        return c.json({ error: 'Invalid material section', details: [{ path: 'content', code: 'invalid_section', message: 'Раздел материалов отсутствует или недоступен на этом сайте.' }] }, 400);
      }
    }

    const { rows } = await client.query(
      `UPDATE pages p
       SET content = $1
       FROM domains d
       WHERE p.id = $2
         AND p.site_id = $4
         AND p.site_id = d.site_id
         AND p.deleted_at IS NULL
         AND d.hostname = $3
       RETURNING p.id, p.site_id, p.path, p.title, p.content`,
      [JSON.stringify(body.content), pageId, hostname, page.site_id],
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return c.json({ error: 'Page not found', details: [] }, 404);
    }

    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client?.query('ROLLBACK').catch(() => {});
    console.error(JSON.stringify({ method: 'PUT', url: `/api/pages/${pageId}`, status: 500, reason: 'Page update failed', name: error?.name, frames: error?.stack?.split('\n').filter((line) => /^\s+at /.test(line)) }));
    return c.json({ error: 'Internal server error', details: [] }, 500);
  } finally {
    client?.release();
  }
}

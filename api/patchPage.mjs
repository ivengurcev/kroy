import { pool } from "../db/client.mjs";
import getHostname from "./getHostname.mjs";
import isUuid from "./isUuid.mjs";
import {
  createDetailPath,
  isPlainObject,
  isValidPagePath,
  isValidRouteParameter,
  normalizePageTitle,
} from "./pageFields.mjs";
import findPageRouteConflict from "./pageRouteConflicts.mjs";

export default async function patchPage(c) {
  const pageId = c.req.param("pageId");

  if (!isUuid(pageId)) return c.json({ error: "Invalid UUID" }, 400);

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }

  const keys = isPlainObject(body) ? Object.keys(body) : [];
  const hasTitle = Object.hasOwn(body ?? {}, "title");
  const hasPath = Object.hasOwn(body ?? {}, "path");
  const hasRouteParam = Object.hasOwn(body ?? {}, "routeParam");
  const title = hasTitle ? normalizePageTitle(body.title) : null;

  if (
    keys.length === 0
    || keys.length > 3
    || keys.some((key) => !["title", "path", "routeParam"].includes(key))
    || (hasTitle && !title)
    || (hasRouteParam && !isValidRouteParameter(body.routeParam))
  ) {
    return c.json({ error: "Invalid page" }, 400);
  }

  const hostname = getHostname(c);
  if (!hostname) return c.json({ error: "Page not found" }, 404);

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const { rows: sites } = await client.query(
      `SELECT s.id
       FROM sites s
       JOIN domains d ON d.site_id = s.id
       WHERE d.hostname = $1
       FOR UPDATE OF s`,
      [hostname],
    );
    if (!sites.length) {
      await client.query("ROLLBACK");
      return c.json({ error: "Page not found" }, 404);
    }

    const siteId = sites[0].id;
    const { rows: pages } = await client.query(
      `SELECT id, site_id, path, title, content, page_type, data_source,
              detail_parent_id, route_param
       FROM pages
       WHERE id = $1 AND site_id = $2 AND deleted_at IS NULL
       FOR UPDATE`,
      [pageId, siteId],
    );
    const page = pages[0];
    if (!page) {
      await client.query("ROLLBACK");
      return c.json({ error: "Page not found" }, 404);
    }

    if (
      page.page_type === "detail" && hasPath
      || page.page_type !== "detail" && hasRouteParam
    ) {
      await client.query("ROLLBACK");
      return c.json({ error: "Invalid page" }, 400);
    }

    const nextTitle = hasTitle ? title : page.title;
    const nextRouteParam = hasRouteParam ? body.routeParam : page.route_param;
    let nextPath = page.path;
    let pathChanged = false;
    let detailTemplate;

    if (page.page_type === "detail") {
      const { rows: parents } = await client.query(
        `SELECT path, page_type
         FROM pages
         WHERE id = $1 AND site_id = $2 AND deleted_at IS NULL`,
        [page.detail_parent_id, siteId],
      );
      if (!parents.length || parents[0].page_type !== "list") {
        await client.query("ROLLBACK");
        return c.json({ error: "Parent list page not found" }, 409);
      }
      nextPath = createDetailPath(parents[0].path, nextRouteParam);
      pathChanged = nextPath !== page.path;
    } else if (hasPath) {
      if (!isValidPagePath(body.path)) {
        await client.query("ROLLBACK");
        return c.json({ error: "Invalid page" }, 400);
      }
      pathChanged = body.path !== page.path;
      nextPath = body.path;
    }

    if (page.path === "/" && pathChanged) {
      await client.query("ROLLBACK");
      return c.json({ error: "Main page path cannot be changed" }, 400);
    }

    if (page.page_type === "list" && pathChanged) {
      const { rows: templates } = await client.query(
        `SELECT id, path, route_param
         FROM pages
         WHERE site_id = $1 AND detail_parent_id = $2 AND page_type = 'detail'
         FOR UPDATE`,
        [siteId, pageId],
      );
      detailTemplate = templates[0];
    }

    const excluded = [pageId, detailTemplate?.id].filter(Boolean);
    if (pathChanged) {
      const conflict = await findPageRouteConflict(client, siteId, nextPath, {
        excludePageIds: excluded,
        excludeRedirectPageIds: page.page_type === "detail" ? [] : [pageId],
      });
      if (conflict) {
        await client.query("ROLLBACK");
        return c.json({ error: "Page already exists" }, 409);
      }
    }

    const nextDetailPath = detailTemplate
      ? createDetailPath(nextPath, detailTemplate.route_param)
      : null;
    if (nextDetailPath && nextDetailPath !== detailTemplate.path) {
      const conflict = await findPageRouteConflict(client, siteId, nextDetailPath, {
        excludePageIds: excluded,
      });
      if (conflict) {
        await client.query("ROLLBACK");
        return c.json({ error: "Page already exists" }, 409);
      }
    }

    if (page.page_type !== "detail" && pathChanged) {
      const { rows: redirects } = await client.query(
        `SELECT page_id FROM redirects WHERE site_id = $1 AND from_path = $2`,
        [siteId, nextPath],
      );
      if (redirects[0]?.page_id === pageId) {
        await client.query(
          `DELETE FROM redirects WHERE site_id = $1 AND from_path = $2 AND page_id = $3`,
          [siteId, nextPath, pageId],
        );
      }
    }

    const { rows } = await client.query(
      `UPDATE pages
       SET title = $2, path = $3, route_param = $4
       WHERE id = $1
       RETURNING id, site_id, path, title, content, page_type AS type,
                 data_source AS "dataSource", detail_parent_id AS "detailParentId",
                 route_param AS "routeParam"`,
      [pageId, nextTitle, nextPath, page.page_type === "detail" ? nextRouteParam : null],
    );

    if (detailTemplate && nextDetailPath !== detailTemplate.path) {
      await client.query(
        `UPDATE pages SET path = $2 WHERE id = $1`,
        [detailTemplate.id, nextDetailPath],
      );
    }

    if (pathChanged && page.page_type !== "detail") {
      await client.query(
        `INSERT INTO redirects (site_id, from_path, page_id)
         VALUES ($1, $2, $3)`,
        [siteId, page.path, pageId],
      );
    }

    if (page.page_type === "list") {
      const { rows: templates } = await client.query(
        `SELECT id, path, deleted_at AS "deletedAt"
         FROM pages
         WHERE site_id = $1 AND detail_parent_id = $2 AND page_type = 'detail'`,
        [siteId, pageId],
      );
      rows[0].detailTemplateId = templates[0]?.id ?? null;
      rows[0].detailTemplatePath = templates[0]?.path ?? null;
      rows[0].detailTemplateDeletedAt = templates[0]?.deletedAt ?? null;
    }

    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") return c.json({ error: "Page already exists" }, 409);
    console.error("Failed to update page details", error);
    return c.json({ error: "Internal server error" }, 500);
  } finally {
    client?.release();
  }
}

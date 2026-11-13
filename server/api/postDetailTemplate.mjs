import { pool } from '../../db/client.mjs';
import getHostname from './getHostname.mjs';
import isUuid from './isUuid.mjs';
import { createDetailPath, isValidRouteParameter, normalizePageTitle } from '../../shared/pageFields.mjs';
import findPageRouteConflict, { releasePageRedirects } from './pageRouteConflicts.mjs';
import reusePagePath from './reusePagePath.mjs';
import partCatalog from '../../dist/kroy/parts.json' with { type: 'json' };
import widgetCatalog from '../../dist/kroy/widgets.json' with { type: 'json' };
import { defaultProps, createView } from '../../shared/partModel.js';

export function initialDetailContent(dataSource) {
    if (dataSource !== 'materials') return [];
    const part = partCatalog['@kroy/material'];
    return [{
        part: '@kroy/material',
        props: defaultProps(part.fields),
        view: createView(part.defaultWidget, widgetCatalog[part.defaultWidget].fields),
    }];
}

export default async function postDetailTemplate(c) {
    const listPageId = c.req.param('pageId');

    if (!isUuid(listPageId)) return c.json({ error: 'Invalid UUID' }, 400);

    let body;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid request' }, 400);
    }

    const title = normalizePageTitle(body?.title);
    const routeParam = body?.routeParam ?? 'slug';
    const keys = body && typeof body === 'object' ? Object.keys(body) : [];

    if (
        keys.some((key) => key !== 'title' && key !== 'routeParam')
        || !title
        || !isValidRouteParameter(routeParam)
    ) {
        return c.json({ error: 'Invalid detail template' }, 400);
    }

    const hostname = getHostname(c);
    if (!hostname) return c.json({ error: 'Page not found' }, 404);

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const { rows: sites } = await client.query(
            `SELECT s.id
             FROM sites s
             JOIN domains d ON d.site_id = s.id
             WHERE d.hostname = $1
             FOR UPDATE OF s`,
            [hostname],
        );
        if (!sites.length) {
            await client.query('ROLLBACK');
            return c.json({ error: 'Page not found' }, 404);
        }

        const siteId = sites[0].id;
        const { rows: lists } = await client.query(
            `SELECT id, path, title, page_type, data_source
             FROM pages
             WHERE id = $1 AND site_id = $2 AND deleted_at IS NULL
             FOR UPDATE`,
            [listPageId, siteId],
        );
        const list = lists[0];
        if (!list || list.page_type !== 'list') {
            await client.query('ROLLBACK');
            return c.json({ error: 'List page not found' }, 404);
        }

        const { rows: existing } = await client.query(
            `SELECT id, deleted_at
             FROM pages
             WHERE site_id = $1 AND detail_parent_id = $2 AND page_type = 'detail'`,
            [siteId, listPageId],
        );
        if (existing.length) {
            await client.query('ROLLBACK');
            return c.json({ error: existing[0].deleted_at ? 'Detail template is in trash' : 'Detail template already exists' }, 409);
        }

        const path = createDetailPath(list.path, routeParam);
        const conflict = await findPageRouteConflict(client, siteId, path, {
            excludePageIds: [listPageId],
            reclaimRedirects: true,
        });
        if (conflict) {
            await client.query('ROLLBACK');
            return c.json({ error: 'Page already exists' }, 409);
        }

        await releasePageRedirects(client, siteId, path);
        const reusedId = await reusePagePath(client, siteId, path, { keepRecord: true });
        const { rows } = await client.query(
            reusedId
                ? `UPDATE pages SET title = $2, path = $3, content = $4::jsonb, page_type = 'detail',
                        detail_parent_id = $5, route_param = $6, deleted_at = NULL,
                        seo = '{}'::jsonb, data_source = NULL, material_section_id = NULL
                   WHERE site_id = $1 AND id = $7
                   RETURNING id, site_id, path, title, content, page_type AS type,
                        data_source AS "dataSource", detail_parent_id AS "detailParentId",
                        route_param AS "routeParam"`
                : `INSERT INTO pages (site_id, title, path, content, page_type, detail_parent_id, route_param)
             VALUES ($1, $2, $3, $4::jsonb, 'detail', $5, $6)
             RETURNING id, site_id, path, title, content, page_type AS type,
                       data_source AS "dataSource", detail_parent_id AS "detailParentId",
                       route_param AS "routeParam"`,
            [siteId, title, path, JSON.stringify(initialDetailContent(list.data_source)), listPageId, routeParam, ...(reusedId ? [reusedId] : [])],
        );

        await client.query('COMMIT');
        return c.json(rows[0], 201);
    } catch (error) {
        await client?.query('ROLLBACK').catch(() => {});
        if (error.code === '23505' || error.code === 'PAGE_PATH_CONFLICT') return c.json({ error: 'Detail template already exists' }, 409);
        console.error('Failed to create detail template', error);
        return c.json({ error: 'Internal server error' }, 500);
    } finally {
        client?.release();
    }
}

import { routePatternsOverlap } from '../../shared/pageFields.mjs';

export default async function findPageRouteConflict(
    client,
    siteId,
    candidatePath,
    { excludePageIds = [], excludeRedirectPageIds = [], reclaimRedirects = false } = {}
) {
    const { rows: pages } = await client.query(
        `SELECT id, path
         FROM pages
         WHERE site_id = $1 AND deleted_at IS NULL`,
        [siteId],
    );
    const conflictingPage = pages.find(({ id, path }) =>
        !excludePageIds.includes(id) && routePatternsOverlap(candidatePath, path)
    );

    if (conflictingPage) return { type: 'page', path: conflictingPage.path };
    if (reclaimRedirects) return null;

    const { rows: redirects } = await client.query(
        `SELECT from_path, page_id
         FROM redirects
         WHERE site_id = $1`,
        [siteId],
    );
    const conflictingRedirect = redirects.find(({ from_path: path, page_id: pageId }) =>
        !excludeRedirectPageIds.includes(pageId)
        && routePatternsOverlap(candidatePath, path)
    );

    return conflictingRedirect
        ? { type: 'redirect', path: conflictingRedirect.from_path }
        : null;
}

// Call only inside a transaction holding the site's row lock, after checking pages.
export async function releasePageRedirects(client, siteId, candidatePath) {
    const { rows } = await client.query(
        'SELECT from_path FROM redirects WHERE site_id = $1', [siteId],
    );
    const paths = rows.filter(({ from_path }) => routePatternsOverlap(candidatePath, from_path))
        .map(({ from_path }) => from_path);
    if (paths.length) await client.query(
        'DELETE FROM redirects WHERE site_id = $1 AND from_path = ANY($2::text[])', [siteId, paths],
    );
}

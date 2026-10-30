import { routePatternsOverlap } from './pageFields.mjs';

export default async function findPageRouteConflict(
    client,
    siteId,
    candidatePath,
    { excludePageIds = [], excludeRedirectPageIds = [] } = {}
) {
    const { rows: pages } = await client.query(
        `SELECT id, path
         FROM pages
         WHERE site_id = $1`,
        [siteId],
    );
    const conflictingPage = pages.find(({ id, path }) =>
        !excludePageIds.includes(id) && routePatternsOverlap(candidatePath, path)
    );

    if (conflictingPage) return { type: 'page', path: conflictingPage.path };

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

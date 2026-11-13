// The caller holds the site row lock in the same transaction.
// Creation keeps the old UUID; moving an existing page removes the deleted owner.
export default async function reusePagePath(client, siteId, path, { keepRecord = false, excludePageIds = [] } = {}) {
    const { rows: owners } = await client.query(
        `SELECT id, deleted_at FROM pages
         WHERE site_id = $1 AND path = $2 AND NOT (id = ANY($3::uuid[]))
         FOR UPDATE`,
        [siteId, path, excludePageIds],
    );
    const owner = owners[0];
    if (!owner) return null;
    if (!owner.deleted_at) throw Object.assign(new Error('Page already exists'), { code: 'PAGE_PATH_CONFLICT' });

    const { rows: dependencies } = await client.query(
        `WITH RECURSIVE dependents AS (
             SELECT id, deleted_at FROM pages WHERE site_id = $1 AND detail_parent_id = $2
             UNION
             SELECT p.id, p.deleted_at FROM pages p
             JOIN dependents d ON p.detail_parent_id = d.id WHERE p.site_id = $1
         ) SELECT id, deleted_at FROM dependents`,
        [siteId, owner.id],
    );
    if (dependencies.some(({ deleted_at }) => !deleted_at)) {
        throw Object.assign(new Error('Active detail template depends on deleted page'), { code: 'PAGE_PATH_CONFLICT' });
    }
    const dependentIds = dependencies.map(({ id }) => id);
    await client.query(
        'DELETE FROM redirects WHERE site_id = $1 AND page_id = ANY($2::uuid[])',
        [siteId, [owner.id, ...dependentIds]],
    );
    const removedIds = keepRecord ? dependentIds : [owner.id, ...dependentIds];
    if (removedIds.length) await client.query(
        'DELETE FROM pages WHERE site_id = $1 AND id = ANY($2::uuid[])', [siteId, removedIds],
    );
    return owner.id;
}

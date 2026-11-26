const initialContent = [{
    part: '@kroy/header',
    props: { title: '', navigation: [] },
    view: { name: '@kroy/header', props: {} },
}];

export const templateColumns = 'id, name, content, slot_index AS "slotIndex", is_main AS "isMain", version';

export async function listPageTemplates(client, siteId) {
    return (await client.query(
        `SELECT ${templateColumns} FROM page_templates WHERE site_id = $1 ORDER BY is_main DESC, name, id`,
        [siteId],
    )).rows;
}

export async function createMainPageTemplate(client, siteId) {
    await client.query(
        `INSERT INTO page_templates (site_id, name, content, slot_index, is_main)
         VALUES ($1, 'Основной', $2::jsonb, 1, true)
         ON CONFLICT (site_id) WHERE is_main DO NOTHING`,
        [siteId, JSON.stringify(initialContent)],
    );
}

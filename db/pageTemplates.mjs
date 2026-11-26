const initialContent = [{
    part: '@kroy/header',
    props: { title: '', navigation: [] },
    view: { name: '@kroy/header', props: {} },
}];

export async function createMainPageTemplate(client, siteId) {
    await client.query(
        `INSERT INTO page_templates (site_id, name, content, slot_index, is_main)
         VALUES ($1, 'Основной', $2::jsonb, 1, true)
         ON CONFLICT (site_id) WHERE is_main DO NOTHING`,
        [siteId, JSON.stringify(initialContent)],
    );
}

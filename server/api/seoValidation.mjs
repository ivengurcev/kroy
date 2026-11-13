export async function seoReferenceErrors(client, siteId, seo) {
    const fields = {};
    if (seo.imageId) {
        const { rowCount } = await client.query('SELECT 1 FROM media WHERE id = $1 AND site_id = $2', [seo.imageId, siteId]);
        if (!rowCount) fields.imageId = 'Изображение недоступно для этого сайта';
    }
    if (seo.primaryDomain) {
        const { rowCount } = await client.query('SELECT 1 FROM domains WHERE hostname = $1 AND site_id = $2', [seo.primaryDomain, siteId]);
        if (!rowCount) fields.primaryDomain = 'Выберите привязанный домен этого сайта';
    }
    return fields;
}

import { pool } from './client.mjs';

function mapMaterial(row) {
    return {
        id: row.id,
        siteId: row.site_id,
        sectionId: row.section_id,
        slug: row.slug,
        title: row.title,
        summary: row.summary,
        content: row.content,
        coverMediaId: row.cover_media_id,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        publishedAt: row.published_at,
    };
}

const MATERIAL_COLUMNS = `
    id, site_id, section_id, slug, title, summary, content, cover_media_id,
    status, created_at, updated_at, published_at`;

export async function getMaterials(siteId, { sectionId } = {}, client = pool) {
    const sectionFilter = sectionId === undefined ? '' : ' AND section_id = $2';
    const values = sectionId === undefined ? [siteId] : [siteId, sectionId];
    const { rows } = await client.query(
        `SELECT ${MATERIAL_COLUMNS}
         FROM materials
         WHERE site_id = $1${sectionFilter}
         ORDER BY updated_at DESC, id`,
        values,
    );
    return rows.map(mapMaterial);
}

export async function getPublishedMaterials(siteId, { sectionId } = {}, client = pool) {
    const sectionFilter = sectionId === undefined ? '' : ' AND section_id = $2';
    const values = sectionId === undefined ? [siteId] : [siteId, sectionId];
    const { rows } = await client.query(
        `SELECT ${MATERIAL_COLUMNS}
         FROM materials
         WHERE site_id = $1 AND status = 'published'${sectionFilter}
         ORDER BY slug, id`,
        values,
    );
    return rows.map(mapMaterial);
}

export async function getMaterial(siteId, id, client = pool, { forUpdate = false } = {}) {
    const { rows: [row] } = await client.query(
        `SELECT ${MATERIAL_COLUMNS}
         FROM materials
         WHERE site_id = $1 AND id = $2${forUpdate ? ' FOR UPDATE' : ''}`,
        [siteId, id],
    );
    return row ? mapMaterial(row) : null;
}

export async function hasSiteMaterialSection(siteId, sectionId, client = pool) {
    const { rowCount } = await client.query(
        'SELECT 1 FROM material_sections WHERE id = $1 AND site_id = $2',
        [sectionId, siteId],
    );
    return rowCount > 0;
}

export async function hasSiteMedia(siteId, mediaId, client = pool) {
    if (mediaId === null) return true;
    const { rowCount } = await client.query(
        'SELECT 1 FROM media WHERE id = $1 AND site_id = $2',
        [mediaId, siteId],
    );
    return rowCount > 0;
}

export async function createMaterial(siteId, {
    sectionId,
    slug,
    title,
    summary,
    content,
    coverMediaId,
    status,
}) {
    const { rows: [row] } = await pool.query(
        `INSERT INTO materials
            (site_id, section_id, slug, title, summary, content, cover_media_id, status, published_at)
         SELECT $1, $2, $3, $4, $5, $6::jsonb, $7::uuid, $8,
                CASE WHEN $8 = 'published' THEN now() ELSE NULL END
         WHERE EXISTS (SELECT 1 FROM material_sections WHERE id = $2 AND site_id = $1)
           AND ($7::uuid IS NULL OR EXISTS (SELECT 1 FROM media WHERE id = $7 AND site_id = $1))
           AND ($8 <> 'published' OR $6::jsonb IS NOT NULL)
         RETURNING ${MATERIAL_COLUMNS}`,
        [siteId, sectionId, slug, title, summary, content === null ? null : JSON.stringify(content), coverMediaId, status],
    );
    return row ? mapMaterial(row) : null;
}

export async function updateMaterial(siteId, id, changes, client = pool) {
    const values = [siteId, id];
    const assignments = [];
    let statusParameter;
    let mediaParameter;
    let contentParameter;
    let sectionParameter;

    for (const [key, value] of Object.entries(changes)) {
        values.push(key === 'content' && value !== null ? JSON.stringify(value) : value);
        const parameter = `$${values.length}`;
        if (key === 'sectionId') {
            sectionParameter = parameter;
            assignments.push(`section_id = ${parameter}::uuid`);
        }
        else if (key === 'slug') assignments.push(`slug = ${parameter}`);
        else if (key === 'title') assignments.push(`title = ${parameter}`);
        else if (key === 'summary') assignments.push(`summary = ${parameter}`);
        else if (key === 'content') {
            contentParameter = parameter;
            assignments.push(`content = ${parameter}::jsonb`);
        } else if (key === 'coverMediaId') {
            mediaParameter = parameter;
            assignments.push(`cover_media_id = ${parameter}::uuid`);
        } else if (key === 'status') {
            statusParameter = parameter;
            assignments.push(`status = ${parameter}`);
        }
    }
    if (!assignments.length) return getMaterial(siteId, id, client);

    if (statusParameter) {
        assignments.push(`published_at = CASE WHEN ${statusParameter} = 'published'
            THEN COALESCE(published_at, now()) ELSE NULL END`);
    }
    assignments.push('updated_at = now()');
    const mediaCheck = mediaParameter
        ? `AND (${mediaParameter}::uuid IS NULL OR EXISTS (SELECT 1 FROM media WHERE id = ${mediaParameter} AND site_id = $1))`
        : '';
    const sectionCheck = sectionParameter
        ? `AND EXISTS (SELECT 1 FROM material_sections WHERE id = ${sectionParameter}::uuid AND site_id = $1)`
        : '';
    const nextStatus = statusParameter ?? 'status';
    const nextContent = contentParameter ? `${contentParameter}::jsonb` : 'content';
    const { rows: [row] } = await client.query(
        `UPDATE materials
         SET ${assignments.join(', ')}
         WHERE id = $2 AND site_id = $1
           ${sectionCheck}
           ${mediaCheck}
           AND (${nextStatus} <> 'published' OR ${nextContent} IS NOT NULL)
         RETURNING ${MATERIAL_COLUMNS}`,
        values,
    );
    return row ? mapMaterial(row) : null;
}

export async function deleteMaterial(siteId, id) {
    const { rowCount } = await pool.query(
        'DELETE FROM materials WHERE site_id = $1 AND id = $2',
        [siteId, id],
    );
    return rowCount > 0;
}

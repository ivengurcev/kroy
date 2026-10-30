import { pool } from './client.mjs';

function mapArticle(row) {
    return {
        id: row.id,
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

const ARTICLE_COLUMNS = `
    id, slug, title, summary, content, cover_media_id, status,
    created_at, updated_at, published_at`;

export async function getArticles(siteId) {
    const { rows } = await pool.query(
        `SELECT ${ARTICLE_COLUMNS}
         FROM articles
         WHERE site_id = $1
         ORDER BY updated_at DESC, id`,
        [siteId],
    );
    return rows.map(mapArticle);
}

export async function getArticle(siteId, id, client = pool, { forUpdate = false } = {}) {
    const { rows: [row] } = await client.query(
        `SELECT ${ARTICLE_COLUMNS}
         FROM articles
         WHERE site_id = $1 AND id = $2${forUpdate ? ' FOR UPDATE' : ''}`,
        [siteId, id],
    );
    return row ? mapArticle(row) : null;
}

export async function hasSiteMedia(siteId, mediaId, client = pool) {
    if (mediaId === null) return true;
    const { rowCount } = await client.query(
        'SELECT 1 FROM media WHERE id = $1 AND site_id = $2',
        [mediaId, siteId],
    );
    return rowCount > 0;
}

export async function createArticle(siteId, {
    slug,
    title,
    summary,
    content,
    coverMediaId,
    status,
}) {
    const { rows: [row] } = await pool.query(
        `INSERT INTO articles
            (site_id, slug, title, summary, content, cover_media_id, status, published_at)
         SELECT $1, $2, $3, $4, $5::jsonb, $6::uuid, $7,
                CASE WHEN $7 = 'published' THEN now() ELSE NULL END
         WHERE ($6::uuid IS NULL
            OR EXISTS (SELECT 1 FROM media WHERE id = $6 AND site_id = $1))
           AND ($7 <> 'published' OR $5::jsonb IS NOT NULL)
         RETURNING ${ARTICLE_COLUMNS}`,
        [siteId, slug, title, summary, content === null ? null : JSON.stringify(content), coverMediaId, status],
    );
    return row ? mapArticle(row) : null;
}

export async function updateArticle(siteId, id, changes, client = pool) {
    const values = [siteId, id];
    const assignments = [];
    let statusParameter;
    let mediaParameter;
    let contentParameter;

    for (const [key, value] of Object.entries(changes)) {
        const parameterValue = key === 'content' && value !== null ? JSON.stringify(value) : value;
        values.push(parameterValue);
        const parameter = `$${values.length}`;
        if (key === 'content') {
            contentParameter = parameter;
            assignments.push(`content = ${parameter}::jsonb`);
        }
        else if (key === 'coverMediaId') {
            mediaParameter = parameter;
            assignments.push(`cover_media_id = ${parameter}::uuid`);
        } else if (key === 'status') {
            statusParameter = parameter;
            assignments.push(`status = ${parameter}`);
        } else if (key === 'slug') assignments.push(`slug = ${parameter}`);
        else if (key === 'title') assignments.push(`title = ${parameter}`);
        else if (key === 'summary') assignments.push(`summary = ${parameter}`);
    }

    if (statusParameter) {
        assignments.push(`published_at = CASE WHEN ${statusParameter} = 'published'
            THEN COALESCE(published_at, now()) ELSE NULL END`);
    }
    assignments.push('updated_at = now()');

    const mediaCheck = mediaParameter
        ? `AND (${mediaParameter}::uuid IS NULL
               OR EXISTS (SELECT 1 FROM media WHERE id = ${mediaParameter} AND site_id = $1))`
        : '';
    const nextStatus = statusParameter ?? 'status';
    const nextContent = contentParameter ? `${contentParameter}::jsonb` : 'content';
    const { rows: [row] } = await client.query(
        `UPDATE articles
         SET ${assignments.join(', ')}
         WHERE id = $2 AND site_id = $1
           ${mediaCheck}
           AND (${nextStatus} <> 'published' OR ${nextContent} IS NOT NULL)
         RETURNING ${ARTICLE_COLUMNS}`,
        values,
    );
    return row ? mapArticle(row) : null;
}

export async function deleteArticle(siteId, id) {
    const { rowCount } = await pool.query(
        'DELETE FROM articles WHERE site_id = $1 AND id = $2',
        [siteId, id],
    );
    return rowCount > 0;
}

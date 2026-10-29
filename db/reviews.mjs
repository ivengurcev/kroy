import { pool } from './client.mjs';

function mapReview(row) {
    return {
        id: row.id,
        authorName: row.author_name,
        authorSubtitle: row.author_subtitle,
        text: row.text,
        mediaId: row.media_id,
        status: row.status,
        reviewDate: row.review_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        moderatedAt: row.moderated_at,
    };
}

export async function createReview(siteId, { authorName, authorSubtitle, text, mediaId, reviewDate = null, status = 'pending' }, client = pool) {
    const { rows } = await client.query(
        `INSERT INTO reviews (site_id, author_name, author_subtitle, text, media_id, review_date, status, moderated_at)
         SELECT $1, $2, $3, $4, $5::uuid, COALESCE($6::date, CURRENT_DATE), $7,
                CASE WHEN $7 = 'pending' THEN NULL ELSE now() END
         WHERE $5::uuid IS NULL
            OR EXISTS (SELECT 1 FROM media WHERE id = $5 AND site_id = $1)
         RETURNING id, author_name, author_subtitle, text, media_id, status,
                   review_date::text AS review_date, created_at, updated_at, moderated_at`,
        [siteId, authorName, authorSubtitle, text, mediaId, reviewDate, status],
    );
    return rows[0] ? mapReview(rows[0]) : null;
}

export async function getReviews(siteId, status = null) {
    const { rows } = await pool.query(
        `SELECT id, author_name, author_subtitle, text, media_id, status,
                review_date::text AS review_date, created_at, updated_at, moderated_at
         FROM reviews
         WHERE site_id = $1 AND ($2::text IS NULL OR status = $2)
         ORDER BY review_date DESC, created_at DESC, id`,
        [siteId, status],
    );
    return rows.map(mapReview);
}

export async function getPublishedReviews(siteId) {
    const { rows } = await pool.query(
        `SELECT r.id, r.author_name, r.author_subtitle, r.text, r.media_id, r.review_date::text AS review_date, m.filename
         FROM reviews r
         LEFT JOIN media m ON m.id = r.media_id AND m.site_id = r.site_id
         WHERE r.site_id = $1 AND r.status = 'published'
         ORDER BY r.review_date DESC, r.created_at DESC, r.id`,
        [siteId],
    );
    return rows.map((row) => ({
        id: row.id,
        authorName: row.author_name,
        authorSubtitle: row.author_subtitle,
        text: row.text,
        mediaId: row.media_id,
        mediaUrl: row.media_id ? `/api/media/${row.media_id}` : null,
        mediaFilename: row.filename,
        reviewDate: row.review_date,
    }));
}

export async function updateReview(siteId, id, changes) {
    const columns = {
        authorName: 'author_name',
        authorSubtitle: 'author_subtitle',
        text: 'text',
        mediaId: 'media_id',
        reviewDate: 'review_date',
        status: 'status',
    };
    const values = [siteId, id];
    let mediaParameter;
    let statusParameter;
    const assignments = Object.entries(changes).map(([key, value]) => {
        values.push(value);
        const parameter = `$${values.length}`;
        if (key === 'mediaId') mediaParameter = parameter;
        if (key === 'status') statusParameter = parameter;
        return `${columns[key]} = ${parameter}`;
    });
    if (statusParameter) {
        assignments.push(`moderated_at = CASE WHEN ${statusParameter} = 'pending' THEN NULL ELSE now() END`);
    }
    assignments.push('updated_at = now()');

    const mediaCheck = mediaParameter
        ? `AND (${mediaParameter}::uuid IS NULL
               OR EXISTS (SELECT 1 FROM media WHERE id = ${mediaParameter} AND site_id = $1))`
        : '';
    const { rows } = await pool.query(
        `UPDATE reviews
         SET ${assignments.join(', ')}
         WHERE id = $2 AND site_id = $1
         ${mediaCheck}
         RETURNING id, author_name, author_subtitle, text, media_id, status,
                   review_date::text AS review_date, created_at, updated_at, moderated_at`,
        values,
    );
    if (!rows[0] && mediaParameter && changes.mediaId !== null) {
        const { rows: [validation] } = await pool.query(
            `SELECT EXISTS (SELECT 1 FROM reviews WHERE id = $1 AND site_id = $2) AS review_exists,
                    EXISTS (SELECT 1 FROM media WHERE id = $3 AND site_id = $2) AS media_valid`,
            [id, siteId, changes.mediaId],
        );
        if (validation.review_exists && !validation.media_valid) return undefined;
    }
    return rows[0] ? mapReview(rows[0]) : null;
}

export async function deleteReview(siteId, id) {
    const { rowCount } = await pool.query(
        'DELETE FROM reviews WHERE site_id = $1 AND id = $2',
        [siteId, id],
    );
    return rowCount > 0;
}

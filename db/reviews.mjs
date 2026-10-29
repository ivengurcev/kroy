import { pool } from './client.mjs';

function mapReview(row) {
    return {
        id: row.id,
        authorName: row.author_name,
        authorSubtitle: row.author_subtitle,
        text: row.text,
        mediaId: row.media_id,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        moderatedAt: row.moderated_at,
    };
}

export async function createReview(siteId, { authorName, authorSubtitle, text, mediaId }) {
    const { rows } = await pool.query(
        `INSERT INTO reviews (site_id, author_name, author_subtitle, text, media_id)
         SELECT $1, $2, $3, $4, $5::uuid
         WHERE $5::uuid IS NULL
            OR EXISTS (SELECT 1 FROM media WHERE id = $5 AND site_id = $1)
         RETURNING id, author_name, author_subtitle, text, media_id, status,
                   created_at, updated_at, moderated_at`,
        [siteId, authorName, authorSubtitle, text, mediaId],
    );
    return rows[0] ? mapReview(rows[0]) : null;
}

export async function getReviews(siteId, status = null) {
    const { rows } = await pool.query(
        `SELECT id, author_name, author_subtitle, text, media_id, status,
                created_at, updated_at, moderated_at
         FROM reviews
         WHERE site_id = $1 AND ($2::text IS NULL OR status = $2)
         ORDER BY created_at DESC, id`,
        [siteId, status],
    );
    return rows.map(mapReview);
}

export async function moderateReview(siteId, id, status) {
    const { rows } = await pool.query(
        `UPDATE reviews
         SET status = $3, updated_at = now(), moderated_at = now()
         WHERE id = $2 AND site_id = $1
         RETURNING id, author_name, author_subtitle, text, media_id, status,
                   created_at, updated_at, moderated_at`,
        [siteId, id, status],
    );
    return rows[0] ? mapReview(rows[0]) : null;
}

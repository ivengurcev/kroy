import { pool } from './client.mjs';

function mapSection(row) {
    return {
        id: row.id,
        siteId: row.site_id,
        name: row.name,
        slug: row.slug,
        sortOrder: row.sort_order,
    };
}

export async function getMaterialSections(siteId, client = pool) {
    const { rows } = await client.query(
        `SELECT id, site_id, name, slug, sort_order
         FROM material_sections
         WHERE site_id = $1
         ORDER BY sort_order, id`,
        [siteId],
    );
    return rows.map(mapSection);
}

export async function getMaterialSection(siteId, id, client = pool, { forUpdate = false } = {}) {
    const { rows: [row] } = await client.query(
        `SELECT id, site_id, name, slug, sort_order
         FROM material_sections
         WHERE site_id = $1 AND id = $2${forUpdate ? ' FOR UPDATE' : ''}`,
        [siteId, id],
    );
    return row ? mapSection(row) : null;
}

export async function createMaterialSection(siteId, { name, slug, sortOrder }) {
    const { rows: [row] } = await pool.query(
        `INSERT INTO material_sections (site_id, name, slug, sort_order)
         VALUES ($1, $2, $3, $4)
         RETURNING id, site_id, name, slug, sort_order`,
        [siteId, name, slug, sortOrder],
    );
    return row ? mapSection(row) : null;
}

export async function updateMaterialSection(siteId, id, changes, client = pool) {
    const assignments = [];
    const values = [siteId, id];
    for (const [key, column] of [['name', 'name'], ['slug', 'slug'], ['sortOrder', 'sort_order']]) {
        if (!Object.hasOwn(changes, key)) continue;
        values.push(changes[key]);
        assignments.push(`${column} = $${values.length}`);
    }
    if (!assignments.length) return getMaterialSection(siteId, id, client);
    const { rows: [row] } = await client.query(
        `UPDATE material_sections SET ${assignments.join(', ')}
         WHERE site_id = $1 AND id = $2
         RETURNING id, site_id, name, slug, sort_order`,
        values,
    );
    return row ? mapSection(row) : null;
}

export async function hasMaterialSectionReferences(siteId, id, client = pool) {
    const { rows: [row] } = await client.query(
        `SELECT EXISTS (SELECT 1 FROM materials WHERE site_id = $1 AND section_id = $2)
            OR EXISTS (
                SELECT 1 FROM pages
                WHERE site_id = $1
                  AND (material_section_id = $2 OR EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(content) = 'array' THEN content ELSE '[]'::jsonb END) AS block
                    WHERE block->>'part' = '@kroy/material-list'
                      AND block #>> '{props,sectionId}' = $2::text
                  ))
            ) AS is_referenced`,
        [siteId, id],
    );
    return row?.is_referenced === true;
}

export async function countSectionMaterials(siteId, id, client = pool) {
    const { rows: [row] } = await client.query(
        'SELECT count(*)::integer AS count FROM materials WHERE site_id = $1 AND section_id = $2',
        [siteId, id],
    );
    return row.count;
}

export async function deleteMaterialSection(siteId, id, client = pool) {
    const { rowCount } = await client.query(
        'DELETE FROM material_sections WHERE site_id = $1 AND id = $2',
        [siteId, id],
    );
    return rowCount > 0;
}

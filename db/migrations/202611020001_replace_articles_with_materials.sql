-- migrate:up
DO $migration$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pages
        WHERE data_source = 'articles'
           OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements(CASE WHEN jsonb_typeof(content) = 'array' THEN content ELSE '[]'::jsonb END) AS block
                WHERE block->>'part' IN ('@kroy/article', '@kroy/article-list')
                   OR block #>> '{view,name}' IN ('@kroy/article-content', '@kroy/article-cards')
           )
    ) THEN
        RAISE EXCEPTION 'Cannot replace articles: Pages still reference the old article source or blocks. Remove those references before retrying.';
    END IF;
END
$migration$;

CREATE TABLE material_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
    slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE (site_id, id),
    UNIQUE (site_id, slug)
);

CREATE INDEX material_sections_site_order_idx
    ON material_sections(site_id, sort_order, id);

CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    section_id UUID NOT NULL,
    slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    content JSONB,
    cover_media_id UUID REFERENCES media(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    UNIQUE (site_id, section_id, slug),
    FOREIGN KEY (site_id, section_id)
        REFERENCES material_sections(site_id, id) ON DELETE RESTRICT,
    CHECK (content IS NULL OR jsonb_typeof(content) = 'object'),
    CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE INDEX materials_section_published_idx
    ON materials(site_id, section_id, published_at DESC, slug)
    WHERE status = 'published';

ALTER TABLE pages
    ADD COLUMN material_section_id UUID;

ALTER TABLE pages
    DROP CONSTRAINT pages_type_fields_check,
    ADD CONSTRAINT pages_material_section_fkey
        FOREIGN KEY (site_id, material_section_id)
        REFERENCES material_sections(site_id, id) ON DELETE RESTRICT,
    ADD CONSTRAINT pages_type_fields_check CHECK (
        (page_type = 'standard'
            AND data_source IS NULL
            AND material_section_id IS NULL
            AND detail_parent_id IS NULL
            AND route_param IS NULL)
        OR (page_type = 'list'
            AND data_source IN ('materials', 'products', 'reviews')
            AND ((data_source = 'materials' AND material_section_id IS NOT NULL)
                 OR (data_source IN ('products', 'reviews') AND material_section_id IS NULL))
            AND detail_parent_id IS NULL
            AND route_param IS NULL)
        OR (page_type = 'detail'
            AND data_source IS NULL
            AND material_section_id IS NULL
            AND detail_parent_id IS NOT NULL
            AND route_param ~ '^[A-Za-z][A-Za-z0-9_]*$')
    );

CREATE UNIQUE INDEX pages_one_active_material_list_per_section
    ON pages(site_id, material_section_id)
    WHERE page_type = 'list'
      AND data_source = 'materials'
      AND material_section_id IS NOT NULL
      AND deleted_at IS NULL;

DROP TABLE articles;

-- migrate:down
DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM material_sections)
       OR EXISTS (SELECT 1 FROM materials)
       OR EXISTS (SELECT 1 FROM pages WHERE data_source = 'materials') THEN
        RAISE EXCEPTION 'Cannot restore articles while material sections, materials, or material Pages exist.';
    END IF;
END
$migration$;

DROP INDEX pages_one_active_material_list_per_section;

ALTER TABLE pages
    DROP CONSTRAINT pages_material_section_fkey,
    DROP CONSTRAINT pages_type_fields_check,
    DROP COLUMN material_section_id,
    ADD CONSTRAINT pages_type_fields_check CHECK (
        (page_type = 'standard' AND data_source IS NULL AND detail_parent_id IS NULL AND route_param IS NULL)
        OR (page_type = 'list' AND data_source IN ('articles', 'products', 'reviews') AND detail_parent_id IS NULL AND route_param IS NULL)
        OR (page_type = 'detail' AND data_source IS NULL AND detail_parent_id IS NOT NULL AND route_param ~ '^[A-Za-z][A-Za-z0-9_]*$')
    );

DROP INDEX materials_section_published_idx;
DROP TABLE materials;
DROP INDEX material_sections_site_order_idx;
DROP TABLE material_sections;

CREATE TABLE articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    content JSONB,
    cover_media_id UUID REFERENCES media(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    UNIQUE (site_id, slug),
    CHECK (content IS NULL OR jsonb_typeof(content) = 'object'),
    CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE INDEX articles_site_published_idx
    ON articles(site_id, published_at DESC)
    WHERE status = 'published';
